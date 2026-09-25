import type { Express, Request, Response } from 'express';
import { PaymentStatus, PrismaClient, ReservationStatus, Role } from '@prisma/client';
import { nanoid } from 'nanoid';
import {
  createWompiIntegritySignature,
  fetchWompiTransaction,
  getWompiConfig,
  verifyWompiEvent,
} from './wompi.js';

type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
};

type RequireUser = (
  req: Request,
  res: Response,
  role?: Role,
) => Promise<AuthenticatedUser | undefined>;

type ResourceType = 'reservation' | 'order';

const FINAL_PAYMENT_STATUSES = new Set<PaymentStatus>([
  PaymentStatus.APPROVED,
  PaymentStatus.DECLINED,
  PaymentStatus.VOIDED,
  PaymentStatus.ERROR,
]);

function isFailedPaymentStatus(status: PaymentStatus) {
  return status === PaymentStatus.DECLINED
    || status === PaymentStatus.VOIDED
    || status === PaymentStatus.ERROR;
}

function mapWompiStatus(status: unknown): PaymentStatus | undefined {
  const value = String(status ?? '').toUpperCase();
  if (value === 'PENDING') return PaymentStatus.PENDING;
  if (value === 'APPROVED') return PaymentStatus.APPROVED;
  if (value === 'DECLINED') return PaymentStatus.DECLINED;
  if (value === 'VOIDED') return PaymentStatus.VOIDED;
  if (value === 'ERROR') return PaymentStatus.ERROR;
  return undefined;
}

function paymentReference(type: ResourceType, id: string) {
  const prefix = type === 'reservation' ? 'R' : 'O';
  return `LLB-${prefix}-${id}-${nanoid(10)}`;
}

function buildCheckout(payment: {
  id: string;
  externalReference: string;
  amountCents: number;
  currency: string;
  expiresAt: Date | null;
}, user: AuthenticatedUser) {
  const config = getWompiConfig();
  if (!payment.expiresAt) throw new Error('El intento de pago no tiene vencimiento.');
  const expirationTime = payment.expiresAt.toISOString();

  return {
    paymentId: payment.id,
    status: PaymentStatus.PENDING,
    widget: {
      publicKey: config.publicKey,
      currency: payment.currency,
      amountInCents: payment.amountCents,
      reference: payment.externalReference,
      expirationTime,
      signature: createWompiIntegritySignature(
        payment.externalReference,
        payment.amountCents,
        payment.currency,
        expirationTime,
      ),
      redirectUrl: config.redirectUrl,
      customerData: {
        email: user.email,
        fullName: user.name,
        phoneNumber: user.phone ?? undefined,
      },
    },
  };
}

export async function releaseExpiredWompiCheckouts(prisma: PrismaClient) {
  const now = new Date();
  const expired = await prisma.payment.findMany({
    where: {
      provider: 'WOMPI',
      status: PaymentStatus.PENDING,
      wompiTransactionId: null,
      expiresAt: { lt: now },
    },
    select: { id: true, resourceType: true, resourceId: true },
    take: 100,
  });

  for (const candidate of expired) {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.payment.updateMany({
        where: {
          id: candidate.id,
          status: PaymentStatus.PENDING,
          wompiTransactionId: null,
          expiresAt: { lt: now },
        },
        data: {
          status: PaymentStatus.ERROR,
          processedAt: now,
          rawResponse: { reason: 'CHECKOUT_EXPIRED_WITHOUT_TRANSACTION' },
        },
      });
      if (claimed.count !== 1) return;

      if (candidate.resourceType === 'reservation') {
        const reservation = await tx.reservation.findFirst({
          where: {
            id: candidate.resourceId,
            paymentId: candidate.id,
            status: ReservationStatus.PENDING_PAYMENT,
          },
          select: { id: true, machineId: true, branchId: true },
        });
        if (!reservation) return;

        await tx.machineSlot.deleteMany({ where: { reservationId: reservation.id } });
        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: ReservationStatus.CANCELLED },
        });
        await tx.auditLog.create({
          data: {
            action: 'RESERVATION_PAYMENT_EXPIRED',
            entity: 'RESERVATION',
            entityId: reservation.id,
            metadata: { paymentId: candidate.id, branchId: reservation.branchId, machineId: reservation.machineId },
          },
        });
      } else if (candidate.resourceType === 'order') {
        await tx.laundryOrder.updateMany({
          where: { id: candidate.resourceId, paymentId: candidate.id },
          data: { paymentId: null },
        });
      }
    });
  }
}

async function ownedResource(
  prisma: PrismaClient,
  type: ResourceType,
  id: string,
  userId: string,
) {
  if (type === 'reservation') {
    return prisma.reservation.findFirst({
      where: { id, clientId: userId },
      select: { id: true, amountCents: true, status: true, paymentId: true },
    });
  }

  return prisma.laundryOrder.findFirst({
    where: { id, clientId: userId },
    select: {
      id: true,
      amountCents: true,
      status: true,
      paymentId: true,
      pickupType: true,
      stainService: true,
      deliveryFeeCents: true,
      stainFeeCents: true,
    },
  });
}

function transactionMatchesPayment(transaction: Record<string, unknown>, payment: {
  externalReference: string;
  amountCents: number;
  currency: string;
}) {
  return String(transaction.reference ?? '') === payment.externalReference
    && Number(transaction.amount_in_cents) === payment.amountCents
    && String(transaction.currency ?? '') === payment.currency;
}

function summarizeWompiEvent(body: any, transaction: Record<string, unknown>) {
  return {
    event: String(body?.event ?? ''),
    environment: String(body?.environment ?? ''),
    timestamp: Number.isInteger(body?.timestamp) ? body.timestamp : null,
    transaction: {
      id: String(transaction.id ?? ''),
      reference: String(transaction.reference ?? ''),
      status: String(transaction.status ?? ''),
      amountInCents: Number(transaction.amount_in_cents),
      currency: String(transaction.currency ?? ''),
      paymentMethodType: String(transaction.payment_method_type ?? ''),
    },
  };
}

export function registerWompiPaymentRoutes(
  app: Express,
  prisma: PrismaClient,
  requireUser: RequireUser,
) {
  app.post('/api/payments/wompi/checkout', async (req, res) => {
    try {
      const user = await requireUser(req, res, Role.CLIENT);
      if (!user) return;

      const config = getWompiConfig();
      await releaseExpiredWompiCheckouts(prisma);

      const type = String(req.body?.type ?? '') as ResourceType;
      const id = String(req.body?.id ?? '').trim();
      if (!['reservation', 'order'].includes(type) || !id) {
        return res.status(400).json({ message: 'Pago inválido.' });
      }

      const resource = await ownedResource(prisma, type, id, user.id);
      if (!resource) return res.status(404).json({ message: 'Servicio no encontrado.' });
      if (type === 'reservation') {
        const reservation = resource as { status: ReservationStatus };
        if (reservation.status === ReservationStatus.CONFIRMED || reservation.status === ReservationStatus.COMPLETED) {
          return res.status(409).json({ message: 'Esta reserva ya está pagada.' });
        }
        if (reservation.status === ReservationStatus.CANCELLED) {
          return res.status(409).json({ message: 'Esta reserva fue cancelada. Crea una nueva reserva.' });
        }
      } else {
        const order = resource as typeof resource & {
          pickupType: string;
          stainService: boolean;
          deliveryFeeCents: number | null;
          stainFeeCents: number | null;
        };
        const pendingLabels = [
          ...(order.pickupType === 'DELIVERY' && order.deliveryFeeCents === null ? ['domicilio'] : []),
          ...(order.stainService && order.stainFeeCents === null ? ['desmanche/despercude'] : []),
        ];
        if (pendingLabels.length) {
          return res.status(409).json({
            message: `La sede debe confirmar el valor de ${pendingLabels.join(' y ')} antes de abrir el pago.`,
          });
        }
      }

      if (resource.paymentId) {
        const linkedPayment = await prisma.payment.findUnique({ where: { id: resource.paymentId } });
        if (linkedPayment?.status === PaymentStatus.APPROVED) {
          return res.status(409).json({ message: 'Este servicio ya está pagado.' });
        }
      }

      const activePayment = await prisma.payment.findFirst({
        where: {
          provider: 'WOMPI',
          resourceType: type,
          resourceId: id,
          status: PaymentStatus.PENDING,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (activePayment?.wompiTransactionId) {
        return res.status(409).json({
          message: 'Tu pago ya está siendo procesado por Wompi. Espera la confirmación antes de intentar nuevamente.',
        });
      }

      if (activePayment) {
        return res.json({ checkout: buildCheckout(activePayment, user) });
      }

      const expiresAt = new Date(Date.now() + config.checkoutTtlMinutes * 60_000);
      const reference = paymentReference(type, id);
      const payment = await prisma.$transaction(async (tx) => {
        const created = await tx.payment.create({
          data: {
            provider: 'WOMPI',
            externalReference: reference,
            status: PaymentStatus.PENDING,
            amountCents: resource.amountCents,
            currency: config.currency,
            environment: config.environment,
            resourceType: type,
            resourceId: id,
            expiresAt,
          },
        });

        const linked = type === 'reservation'
          ? await tx.reservation.updateMany({
              where: {
                id,
                clientId: user.id,
                status: ReservationStatus.PENDING_PAYMENT,
                paymentId: resource.paymentId ?? null,
              },
              data: { paymentId: created.id },
            })
          : await tx.laundryOrder.updateMany({
              where: {
                id,
                clientId: user.id,
                paymentId: resource.paymentId ?? null,
              },
              data: { paymentId: created.id },
            });

        if (linked.count !== 1) {
          await tx.payment.delete({ where: { id: created.id } });
          return null;
        }
        return created;
      });

      if (!payment) {
        const concurrentResource = await ownedResource(prisma, type, id, user.id);
        const concurrentPayment = concurrentResource?.paymentId
          ? await prisma.payment.findUnique({ where: { id: concurrentResource.paymentId } })
          : null;
        if (
          concurrentPayment?.status === PaymentStatus.PENDING
          && concurrentPayment.expiresAt
          && concurrentPayment.expiresAt > new Date()
        ) {
          return res.json({ checkout: buildCheckout(concurrentPayment, user) });
        }
        return res.status(409).json({ message: 'Otro intento de pago se creó al mismo tiempo. Actualiza el estado antes de reintentar.' });
      }

      return res.json({ checkout: buildCheckout(payment, user) });
    } catch (error: any) {
      return res.status(503).json({ message: error?.message ?? 'Wompi no está configurado correctamente.' });
    }
  });

  app.get('/api/payments/:type/:id/status', async (req, res) => {
    try {
      const user = await requireUser(req, res, Role.CLIENT);
      if (!user) return;

      const type = String(req.params.type) as ResourceType;
      const id = String(req.params.id);
      if (!['reservation', 'order'].includes(type)) return res.status(400).json({ message: 'Tipo de pago inválido.' });
      const resource = await ownedResource(prisma, type, id, user.id);
      if (!resource) return res.status(404).json({ message: 'Servicio no encontrado.' });

      const payment = resource.paymentId
        ? await prisma.payment.findUnique({ where: { id: resource.paymentId } })
        : null;

      return res.json({
        payment: payment
          ? {
              id: payment.id,
              status: payment.status,
              reference: payment.externalReference,
              transactionId: payment.wompiTransactionId,
              processedAt: payment.processedAt?.toISOString() ?? null,
            }
          : null,
        resourceStatus: resource.status,
      });
    } catch (error: any) {
      return res.status(500).json({ message: error?.message ?? 'No se pudo consultar el pago.' });
    }
  });

  app.post('/api/payments/wompi/webhook', async (req, res) => {
    try {
      const checksum = req.get('X-Event-Checksum') ?? undefined;
      if (!verifyWompiEvent(req.body, checksum)) {
        return res.status(401).json({ message: 'Firma de evento Wompi inválida.' });
      }

      if (req.body?.event !== 'transaction.updated') return res.status(200).json({ received: true });
      const transaction = req.body?.data?.transaction as Record<string, unknown> | undefined;
      if (!transaction) return res.status(400).json({ message: 'Evento Wompi sin transacción.' });

      const reference = String(transaction.reference ?? '');
      const transactionId = String(transaction.id ?? '');
      const status = mapWompiStatus(transaction.status);
      if (!reference || !transactionId || !status) return res.status(400).json({ message: 'Transacción Wompi incompleta.' });

      const payment = await prisma.payment.findUnique({ where: { externalReference: reference } });
      if (!payment) {
        console.warn(`Evento Wompi ignorado: referencia desconocida ${reference}`);
        return res.status(200).json({ received: true });
      }

      if (!transactionMatchesPayment(transaction, payment)) {
        return res.status(409).json({ message: 'El evento no coincide con el pago registrado.' });
      }

      if (FINAL_PAYMENT_STATUSES.has(payment.status)) {
        if (payment.status !== status) {
          await prisma.auditLog.create({
            data: {
              action: 'WOMPI_EVENT_IGNORED_AFTER_FINAL',
              entity: 'PAYMENT',
              entityId: payment.id,
              metadata: {
                storedStatus: payment.status,
                incomingStatus: status,
                reference,
                transactionId,
              },
            },
          });
        }
        return res.status(200).json({ received: true });
      }

      if (FINAL_PAYMENT_STATUSES.has(status)) {
        const remote = await fetchWompiTransaction(transactionId);
        if (!transactionMatchesPayment(remote, payment) || String(remote.status ?? '').toUpperCase() !== String(transaction.status ?? '').toUpperCase()) {
          return res.status(409).json({ message: 'La verificación directa con Wompi no coincide.' });
        }
      }

      await prisma.$transaction(async (tx) => {
        const processedAt = FINAL_PAYMENT_STATUSES.has(status) ? new Date() : null;
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status,
            wompiTransactionId: transactionId,
            rawResponse: summarizeWompiEvent(req.body, transaction),
            processedAt,
          },
        });

        let appliedToResource = false;
        let requiresManualReview = false;
        if (payment.resourceType === 'reservation') {
          const reservation = await tx.reservation.findFirst({
            where: { id: payment.resourceId, paymentId: payment.id },
            select: { id: true, status: true },
          });
          if (reservation) {
            if (status === PaymentStatus.APPROVED) {
              const slot = await tx.machineSlot.findUnique({
                where: { reservationId: reservation.id },
                select: { id: true },
              });
              if (reservation.status === ReservationStatus.PENDING_PAYMENT && slot) {
                await tx.reservation.update({
                  where: { id: reservation.id },
                  data: { status: ReservationStatus.CONFIRMED },
                });
                appliedToResource = true;
              } else {
                requiresManualReview = true;
              }
            } else if (isFailedPaymentStatus(status) && reservation.status === ReservationStatus.PENDING_PAYMENT) {
              await tx.machineSlot.deleteMany({ where: { reservationId: reservation.id } });
              await tx.reservation.update({
                where: { id: reservation.id },
                data: { status: ReservationStatus.CANCELLED },
              });
              appliedToResource = true;
            }
          }
        } else if (payment.resourceType === 'order') {
          const order = await tx.laundryOrder.findFirst({
            where: { id: payment.resourceId, paymentId: payment.id },
            select: { id: true, status: true },
          });
          if (order) {
            if (status === PaymentStatus.APPROVED && order.status === 'CANCELLED') {
              requiresManualReview = true;
            } else {
              appliedToResource = true;
            }
            if (isFailedPaymentStatus(status)) {
              await tx.laundryOrder.update({ where: { id: order.id }, data: { paymentId: null } });
            }
          }
        }

        await tx.auditLog.create({
          data: {
            action: appliedToResource ? 'WOMPI_PAYMENT_UPDATED' : 'WOMPI_LATE_PAYMENT_EVENT',
            entity: 'PAYMENT',
            entityId: payment.id,
            metadata: {
              resourceType: payment.resourceType,
              resourceId: payment.resourceId,
              reference,
              transactionId,
              status,
              requiresManualReview,
            },
          },
        });
      });

      return res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('Error procesando webhook Wompi', error);
      return res.status(503).json({ message: 'No se pudo procesar el evento de Wompi.' });
    }
  });

  void releaseExpiredWompiCheckouts(prisma).catch((error) => console.error('Error limpiando pagos Wompi vencidos', error));
  const cleanupTimer = setInterval(() => {
    void releaseExpiredWompiCheckouts(prisma).catch((error) => console.error('Error limpiando pagos Wompi vencidos', error));
  }, 60_000);
  cleanupTimer.unref();
}
