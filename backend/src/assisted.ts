import type { Express, Request, RequestHandler, Response } from 'express';
import { OrderStatus, PaymentStatus, Prisma, PrismaClient, Role } from '@prisma/client';
import {
  deleteEvidenceImage,
  evidenceStorageReady,
  firebaseReady,
  isLocalEvidencePath,
  localEvidenceStorageReady,
  readLocalEvidenceImage,
  sendPush,
  signedEvidenceUrl,
  uploadEvidenceImage,
} from './firebase.js';
import type { AuthenticatedUser } from './auth.js';
import { expireStaleUnpaidOrders } from './payments.js';
import { boundedLimit, boundedQueryText, optionalFilterId, safeId } from './validation.js';

type RequireUser = (
  req: Request,
  res: Response,
  role?: Role,
) => Promise<AuthenticatedUser | undefined>;

const statusSequence: OrderStatus[] = [
  OrderStatus.QUEUED,
  OrderStatus.PRE_WASH,
  OrderStatus.WASHING,
  OrderStatus.DRYING,
  OrderStatus.PREPARING,
  OrderStatus.READY,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
];

const TERMINAL_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.DELIVERED,
  OrderStatus.CANCELLED,
];

function statusCopy(status: OrderStatus, pickupType: string) {
  switch (status) {
    case OrderStatus.QUEUED:
      return { title: 'Ropa recibida', body: 'Hemos recibido tu ropa. Está en espera de prelavado.' };
    case OrderStatus.PRE_WASH:
      return { title: 'Prelavado', body: 'Tu ropa está en prelavado y revisión inicial.' };
    case OrderStatus.WASHING:
      return { title: 'Lavado en proceso', body: 'Tu ropa está en proceso de lavado.' };
    case OrderStatus.DRYING:
      return { title: 'Secado en proceso', body: 'Tu ropa está en proceso de secado.' };
    case OrderStatus.PREPARING:
      return { title: 'Preparando tu ropa', body: 'Estamos revisando, doblando y preparando tu ropa.' };
    case OrderStatus.READY:
      return pickupType === 'DELIVERY'
        ? { title: 'Lista para domicilio', body: 'Tu ropa está lista. Estamos preparando el domicilio.' }
        : { title: 'Lista para recoger', body: 'Tu ropa está lista. Puedes pasar a recogerla en la sede.' };
    case OrderStatus.OUT_FOR_DELIVERY:
      return { title: 'Tu ropa va en camino', body: 'Tu ropa salió a domicilio hacia la dirección registrada.' };
    case OrderStatus.DELIVERED:
      return { title: 'Servicio entregado', body: 'Tu ropa fue entregada. Gracias por usar La Lavandería & Bakery.' };
    case OrderStatus.CANCELLED:
      return { title: 'Servicio cancelado', body: 'Tu servicio fue cancelado. Si necesitas ayuda, contáctanos desde la aplicación.' };
    default:
      return { title: 'Actualización del servicio', body: 'Tu servicio tiene una nueva actualización.' };
  }
}

function canTransition(current: OrderStatus, next: OrderStatus, pickupType: string) {
  if (current === next) return true;
  if (current === OrderStatus.DELIVERED || current === OrderStatus.CANCELLED) return false;
  if (next === OrderStatus.CANCELLED) return true;

  if (current === OrderStatus.READY) {
    return pickupType === 'DELIVERY'
      ? next === OrderStatus.OUT_FOR_DELIVERY
      : next === OrderStatus.DELIVERED;
  }

  const currentIndex = statusSequence.indexOf(current);
  const nextIndex = statusSequence.indexOf(next);
  return currentIndex >= 0 && nextIndex === currentIndex + 1;
}

async function notifyClient(
  prisma: PrismaClient,
  userId: string,
  title: string,
  body: string,
  data: Record<string, string>,
) {
  try {
    const tokenRows = await prisma.pushToken.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
      take: 10,
      select: { token: true },
    });
    const tokens = tokenRows.map((row) => row.token);
    if (tokens.length === 0) return { sent: 0 };

    const result = await sendPush(tokens, title, body, data);
    if (result.invalidTokens.length) {
      await prisma.pushToken.deleteMany({
        where: { userId, token: { in: result.invalidTokens } },
      });
    }
    return { sent: result.sent };
  } catch (error) {
    console.error('No se pudo enviar push FCM', error);
    return { sent: 0 };
  }
}

function queueClientNotification(
  prisma: PrismaClient,
  userId: string,
  title: string,
  body: string,
  data: Record<string, string>,
) {
  void notifyClient(prisma, userId, title, body, data);
}

function imageKind(file: Express.Multer.File) {
  const b = file.buffer;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }
  if (
    b.length >= 8
    && b[0] === 0x89
    && b[1] === 0x50
    && b[2] === 0x4e
    && b[3] === 0x47
    && b[4] === 0x0d
    && b[5] === 0x0a
    && b[6] === 0x1a
    && b[7] === 0x0a
  ) {
    return { mimeType: 'image/png', extension: 'png' };
  }
  if (
    b.length >= 12
    && b.subarray(0, 4).toString('ascii') === 'RIFF'
    && b.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }
  return undefined;
}

async function evidenceDto(photo: any, includeSignedUrl = false, localUrl?: string) {
  let url: string | undefined;
  if (includeSignedUrl && typeof photo.imageUrl === 'string') {
    if (photo.imageUrl.startsWith('evidence/')) {
      try {
        url = await signedEvidenceUrl(photo.imageUrl);
      } catch (error) {
        console.error('No se pudo firmar URL de evidencia', error);
      }
    } else if (isLocalEvidencePath(photo.imageUrl) && localUrl) {
      url = localUrl;
    }
  }
  return {
    id: photo.id,
    description: photo.description,
    mimeType: photo.mimeType,
    sizeBytes: photo.sizeBytes,
    url,
    createdAt: photo.createdAt.toISOString(),
  };
}

async function orderDto(order: any, includeInternal: boolean) {
  const evidence = await Promise.all([...(order.evidencePhotos ?? [])].reverse().map((photo: any) => evidenceDto(photo, false)));
  return {
    id: order.id,
    branchId: order.branchId,
    branchName: order.branch?.name,
    cycleType: order.cycleType,
    pickupType: order.pickupType,
    address: order.address ?? undefined,
    pieces: order.pieces ?? undefined,
    stainService: Boolean(order.stainService),
    notes: order.notes ?? undefined,
    status: order.status,
    baseAmountCents: order.baseAmountCents,
    deliveryFeeCents: order.deliveryFeeCents ?? null,
    stainFeeCents: order.stainFeeCents ?? null,
    amountCents: order.amountCents,
    pricingReady:
      (order.pickupType !== 'DELIVERY' || order.deliveryFeeCents !== null)
      && (!order.stainService || order.stainFeeCents !== null),
    pricingPending: [
      ...(order.pickupType === 'DELIVERY' && order.deliveryFeeCents === null ? ['DELIVERY'] : []),
      ...(order.stainService && order.stainFeeCents === null ? ['STAIN'] : []),
    ],
    paymentStatus: order.payment?.status ?? null,
    client: order.client
      ? { id: order.client.id, name: order.client.name, email: order.client.email, phone: order.client.phone ?? undefined }
      : undefined,
    statusHistory: [...(order.statusHistory ?? [])].reverse().map((item: any) => ({
      id: item.id,
      status: item.status,
      message: item.message,
      createdAt: item.createdAt.toISOString(),
    })),
    messages: [...(order.messages ?? [])]
      .reverse()
      .filter((item: any) => includeInternal || !item.isInternal)
      .map((item: any) => ({
        id: item.id,
        message: item.message,
        isInternal: Boolean(item.isInternal),
        author: item.author ? { name: item.author.name, role: item.author.role } : undefined,
        createdAt: item.createdAt.toISOString(),
      })),
    evidence,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

const orderInclude = {
  client: { select: { id: true, name: true, email: true, phone: true } },
  branch: { select: { id: true, name: true } },
  payment: { select: { status: true } },
  statusHistory: { orderBy: { createdAt: 'desc' as const }, take: 50 },
  messages: {
    include: { author: { select: { name: true, role: true } } },
    orderBy: { createdAt: 'desc' as const },
    take: 100,
  },
  evidencePhotos: { orderBy: { createdAt: 'desc' as const }, take: 40 },
};

export function registerAssistedRoutes(
  app: Express,
  prisma: PrismaClient,
  requireUser: RequireUser,
  evidenceUpload: RequestHandler,
) {
  app.get('/api/client/orders', async (req, res, next) => {
    try {
      const user = await requireUser(req, res, Role.CLIENT);
      if (!user) return;

      const view = String(req.query.view ?? 'active').trim();
      const limit = boundedLimit(req.query.limit, 20, 100);
      if (!['active', 'history', 'all'].includes(view)) {
        return res.status(400).json({ message: 'Vista inválida.' });
      }

      if (view === 'active') {
        await expireStaleUnpaidOrders(prisma, user.id);
      }

      const where: Prisma.LaundryOrderWhereInput = {
        clientId: user.id,
        ...(view === 'active'
          ? { status: { notIn: TERMINAL_ORDER_STATUSES } }
          : view === 'history'
            ? { status: { in: TERMINAL_ORDER_STATUSES } }
            : {}),
      };
      const orders = await prisma.laundryOrder.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return res.json({
        orders: await Promise.all(orders.map((order) => orderDto(order, false))),
        limit,
        truncated: orders.length === limit,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/client/orders/:orderId', async (req, res, next) => {
    try {
      const user = await requireUser(req, res, Role.CLIENT);
      if (!user) return;
      const orderId = safeId(req.params.orderId, 'Orden');
      const order = await prisma.laundryOrder.findFirst({
        where: { id: orderId, clientId: user.id },
        include: orderInclude,
      });
      if (!order) return res.status(404).json({ message: 'Orden no encontrada.' });
      return res.json({ order: await orderDto(order, false) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/client/orders/:orderId/evidence', async (req, res, next) => {
    try {
      const user = await requireUser(req, res, Role.CLIENT);
      if (!user) return;
      const orderId = safeId(req.params.orderId, 'Orden');

      const order = await prisma.laundryOrder.findFirst({
        where: { id: orderId, clientId: user.id },
        select: {
          id: true,
          evidencePhotos: { orderBy: { createdAt: 'desc' }, take: 40 },
        },
      });
      if (!order) return res.status(404).json({ message: 'Orden no encontrada.' });

      return res.json({
        evidence: await Promise.all([...order.evidencePhotos].reverse().map((photo) => (
          evidenceDto(photo, true, `/client/orders/${orderId}/evidence/${photo.id}/file`)
        ))),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/client/orders/:orderId/evidence/:evidenceId/file', async (req, res, next) => {
    try {
      const user = await requireUser(req, res, Role.CLIENT);
      if (!user) return;
      const orderId = safeId(req.params.orderId, 'Orden');
      const evidenceId = safeId(req.params.evidenceId, 'Evidencia');
      const photo = await prisma.evidencePhoto.findFirst({
        where: { id: evidenceId, orderId, order: { clientId: user.id } },
        select: { imageUrl: true, mimeType: true },
      });
      if (!photo || !isLocalEvidencePath(photo.imageUrl)) {
        return res.status(404).json({ message: 'Evidencia no encontrada.' });
      }
      const buffer = await readLocalEvidenceImage(photo.imageUrl).catch(() => undefined);
      if (!buffer) return res.status(404).json({ message: 'Evidencia no encontrada.' });
      res.setHeader('Content-Type', photo.mimeType);
      res.setHeader('Content-Length', String(buffer.length));
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/orders/:orderId/evidence', async (req, res, next) => {
    try {
      const admin = await requireUser(req, res, Role.ADMIN);
      if (!admin) return;
      const orderId = safeId(req.params.orderId, 'Orden');

      const order = await prisma.laundryOrder.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          evidencePhotos: { orderBy: { createdAt: 'desc' }, take: 40 },
        },
      });
      if (!order) return res.status(404).json({ message: 'Orden no encontrada.' });

      return res.json({
        evidence: await Promise.all([...order.evidencePhotos].reverse().map((photo) => (
          evidenceDto(photo, true, `/admin/orders/${orderId}/evidence/${photo.id}/file`)
        ))),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/orders/:orderId/evidence/:evidenceId/file', async (req, res, next) => {
    try {
      const admin = await requireUser(req, res, Role.ADMIN);
      if (!admin) return;
      const orderId = safeId(req.params.orderId, 'Orden');
      const evidenceId = safeId(req.params.evidenceId, 'Evidencia');
      const photo = await prisma.evidencePhoto.findFirst({
        where: { id: evidenceId, orderId },
        select: { imageUrl: true, mimeType: true },
      });
      if (!photo || !isLocalEvidencePath(photo.imageUrl)) {
        return res.status(404).json({ message: 'Evidencia no encontrada.' });
      }
      const buffer = await readLocalEvidenceImage(photo.imageUrl).catch(() => undefined);
      if (!buffer) return res.status(404).json({ message: 'Evidencia no encontrada.' });
      res.setHeader('Content-Type', photo.mimeType);
      res.setHeader('Content-Length', String(buffer.length));
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/capabilities', async (req, res, next) => {
    try {
      const admin = await requireUser(req, res, Role.ADMIN);
      if (!admin) return;
      return res.json({
        firebaseStorage: firebaseReady(),
        evidenceStorage: evidenceStorageReady(),
        localEvidenceStorage: localEvidenceStorageReady() && !firebaseReady(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/orders', async (req, res, next) => {
    try {
      const admin = await requireUser(req, res, Role.ADMIN);
      if (!admin) return;

      const branchId = optionalFilterId(req.query.branchId, 'Sede');
      const rawStatus = String(req.query.status ?? 'all').trim();
      const view = String(req.query.view ?? 'active').trim();
      const search = boundedQueryText(req.query.search, 120);
      const limit = boundedLimit(req.query.limit, 50, 100);
      const status = rawStatus === 'all' ? undefined : rawStatus as OrderStatus;
      if (status && !Object.values(OrderStatus).includes(status)) {
        return res.status(400).json({ message: 'Estado inválido.' });
      }
      if (!['active', 'history', 'all'].includes(view)) {
        return res.status(400).json({ message: 'Vista inválida.' });
      }

      const where: Prisma.LaundryOrderWhereInput = {
        ...(branchId !== 'all' ? { branchId } : {}),
        ...(status
          ? { status }
          : view === 'active'
            ? { status: { notIn: TERMINAL_ORDER_STATUSES } }
            : view === 'history'
              ? { status: { in: TERMINAL_ORDER_STATUSES } }
              : {}),
        ...(search
          ? {
              client: {
                is: {
                  OR: [
                    { name: { contains: search } },
                    { email: { contains: search } },
                    { phone: { contains: search } },
                  ],
                },
              },
            }
          : {}),
      };

      const orders = await prisma.laundryOrder.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return res.json({
        orders: await Promise.all(orders.map((order) => orderDto(order, true))),
        limit,
        truncated: orders.length === limit,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/orders/:orderId', async (req, res, next) => {
    try {
      const admin = await requireUser(req, res, Role.ADMIN);
      if (!admin) return;
      const orderId = safeId(req.params.orderId, 'Orden');
      const order = await prisma.laundryOrder.findUnique({
        where: { id: orderId },
        include: orderInclude,
      });
      if (!order) return res.status(404).json({ message: 'Orden no encontrada.' });
      return res.json({ order: await orderDto(order, true) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/admin/clients', async (req, res, next) => {
    try {
      const admin = await requireUser(req, res, Role.ADMIN);
      if (!admin) return;

      const search = boundedQueryText(req.query.search, 120);
      const branchId = optionalFilterId(req.query.branchId, 'Sede');
      const view = String(req.query.view ?? 'all').trim();
      const limit = boundedLimit(req.query.limit, 100, 200);
      if (!['all', 'active', 'history'].includes(view)) {
        return res.status(400).json({ message: 'Vista inválida.' });
      }

      const filters: Prisma.UserWhereInput[] = [{ role: Role.CLIENT, isActive: true }];
      if (search) {
        filters.push({
          OR: [
            { name: { contains: search } },
            { email: { contains: search } },
            { phone: { contains: search } },
          ],
        });
      }
      if (branchId !== 'all') {
        filters.push({
          OR: [
            { laundryOrders: { some: { branchId } } },
            { reservations: { some: { branchId } } },
          ],
        });
      }
      if (view === 'active') {
        filters.push({
          laundryOrders: {
            some: { status: { notIn: [OrderStatus.DELIVERED, OrderStatus.CANCELLED] } },
          },
        });
      } else if (view === 'history') {
        filters.push({ laundryOrders: { some: {} } });
      }

      const clients = await prisma.user.findMany({
        where: { AND: filters },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          createdAt: true,
          _count: { select: { laundryOrders: true, reservations: true } },
          laundryOrders: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: { id: true, branchId: true, status: true, pickupType: true, createdAt: true, updatedAt: true },
          },
          reservations: {
            orderBy: { createdAt: 'desc' },
            take: 20,
            select: { id: true, branchId: true, status: true, scheduledStart: true, createdAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return res.json({
        clients: clients.map((client) => {
          const activeAssisted = client.laundryOrders.filter(
            (order) => order.status !== OrderStatus.DELIVERED && order.status !== OrderStatus.CANCELLED,
          );
          const dates = [
            ...client.laundryOrders.map((order) => order.updatedAt),
            ...client.reservations.map((reservation) => reservation.createdAt),
          ].sort((a, b) => b.getTime() - a.getTime());
          return {
            id: client.id,
            name: client.name,
            email: client.email,
            phone: client.phone ?? undefined,
            createdAt: client.createdAt.toISOString(),
            lastActivityAt: dates[0]?.toISOString() ?? client.createdAt.toISOString(),
            assistedCount: client._count.laundryOrders,
            reservationCount: client._count.reservations,
            activeAssistedCount: activeAssisted.length,
            activeOrders: activeAssisted.map((order) => ({
              id: order.id,
              branchId: order.branchId,
              status: order.status,
              pickupType: order.pickupType,
              createdAt: order.createdAt.toISOString(),
            })),
          };
        }),
        limit,
        truncated: clients.length === limit,
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch('/api/admin/orders/:orderId/pricing', async (req, res, next) => {
    try {
      const admin = await requireUser(req, res, Role.ADMIN);
      if (!admin) return;
      const orderId = safeId(req.params.orderId, 'Orden');

      const existing = await prisma.laundryOrder.findUnique({
        where: { id: orderId },
        include: { payment: { select: { id: true, status: true, expiresAt: true } } },
      });
      if (!existing) return res.status(404).json({ message: 'Orden no encontrada.' });
      if (existing.status !== OrderStatus.QUEUED) {
        return res.status(409).json({ message: 'Los cargos solo pueden definirse antes de iniciar el proceso de lavandería.' });
      }
      if (existing.payment?.status === PaymentStatus.APPROVED) {
        return res.status(409).json({ message: 'No se pueden cambiar cargos después de un pago aprobado.' });
      }
      if (
        existing.payment?.status === PaymentStatus.PENDING
        && existing.payment.expiresAt
        && existing.payment.expiresAt > new Date()
      ) {
        return res.status(409).json({ message: 'Hay un checkout de Wompi activo. Espera a que termine o expire antes de cambiar los cargos.' });
      }

      const parseFee = (value: unknown, required: boolean, label: string) => {
        if (!required) return null;
        if (value === undefined || value === null || value === '') {
          throw new Error(`Debes ingresar el valor de ${label}.`);
        }
        const cop = Number(value);
        if (!Number.isInteger(cop) || cop < 0 || cop > 1_000_000) {
          throw new Error(`El valor de ${label} debe ser un número entero entre $0 y $1.000.000 COP.`);
        }
        return cop * 100;
      };

      const deliveryFeeCents = parseFee(
        req.body?.deliveryFeeCop,
        existing.pickupType === 'DELIVERY',
        'domicilio',
      );
      const stainFeeCents = parseFee(
        req.body?.stainFeeCop,
        existing.stainService,
        'desmanche/despercude',
      );
      const amountCents = existing.baseAmountCents + (deliveryFeeCents ?? 0) + (stainFeeCents ?? 0);

      const updated = await prisma.$transaction(async (tx) => {
        const current = await tx.laundryOrder.findUnique({
          where: { id: orderId },
          include: { payment: { select: { status: true, expiresAt: true } } },
        });
        if (!current || current.status !== OrderStatus.QUEUED) {
          throw new Error('La orden cambió mientras se actualizaba el valor. Recarga e intenta nuevamente.');
        }
        if (current.payment?.status === PaymentStatus.APPROVED) {
          throw new Error('El pago ya fue aprobado y el valor no puede cambiar.');
        }
        if (
          current.payment?.status === PaymentStatus.PENDING
          && current.payment.expiresAt
          && current.payment.expiresAt > new Date()
        ) {
          throw new Error('Hay un checkout de Wompi activo. No se modificó el valor.');
        }

        if (
          current.paymentId
          && current.payment?.status === PaymentStatus.PENDING
          && (!current.payment.expiresAt || current.payment.expiresAt <= new Date())
        ) {
          await tx.payment.update({
            where: { id: current.paymentId },
            data: {
              status: PaymentStatus.ERROR,
              processedAt: new Date(),
              rawResponse: { reason: 'ADMIN_PRICING_UPDATED_AFTER_CHECKOUT_EXPIRY' },
            },
          });
        }

        const order = await tx.laundryOrder.update({
          where: { id: orderId },
          data: {
            deliveryFeeCents,
            stainFeeCents,
            amountCents,
            paymentId: null,
          },
          include: orderInclude,
        });

        await tx.auditLog.create({
          data: {
            actorId: admin.id,
            action: 'ORDER_PRICING_UPDATED',
            entity: 'LAUNDRY_ORDER',
            entityId: orderId,
            metadata: {
              baseAmountCents: current.baseAmountCents,
              deliveryFeeCents,
              stainFeeCents,
              amountCents,
            },
          },
        });
        return order;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      queueClientNotification(
        prisma,
        existing.clientId,
        'Valor del servicio confirmado',
        'La sede confirmó los cargos variables. Revisa el total y continúa con el pago desde la aplicación.',
        { type: 'ORDER_PRICING', orderId, url: '/client/assisted' },
      );

      return res.json({ order: await orderDto(updated, true), notificationQueued: true });
    } catch (error: any) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        return res.status(409).json({ message: 'La orden cambió al mismo tiempo. Recarga e intenta nuevamente.' });
      }
      if (error instanceof Error && (
        error.message.startsWith('Debes ingresar')
        || error.message.startsWith('El valor de')
        || error.message.includes('checkout')
        || error.message.includes('pago ya fue aprobado')
        || error.message.includes('orden cambió')
      )) {
        return res.status(409).json({ message: error.message });
      }
      next(error);
    }
  });

  app.patch('/api/admin/orders/:orderId/status', async (req, res, next) => {
    try {
      const admin = await requireUser(req, res, Role.ADMIN);
      if (!admin) return;
      const orderId = safeId(req.params.orderId, 'Orden');
      const nextStatus = req.body?.status as OrderStatus;
      if (!Object.values(OrderStatus).includes(nextStatus)) {
        return res.status(400).json({ message: 'Estado inválido.' });
      }

      const existing = await prisma.laundryOrder.findUnique({
        where: { id: orderId },
        include: { client: true, payment: { select: { status: true } } },
      });
      if (!existing) return res.status(404).json({ message: 'Orden no encontrada.' });
      if (nextStatus !== OrderStatus.CANCELLED && existing.payment?.status !== PaymentStatus.APPROVED) {
        return res.status(409).json({ message: 'No se puede iniciar o avanzar el servicio hasta que el pago esté aprobado.' });
      }
      if (!canTransition(existing.status, nextStatus, existing.pickupType)) {
        return res.status(409).json({ message: `No se puede pasar de ${existing.status} a ${nextStatus}.` });
      }

      const copy = statusCopy(nextStatus, existing.pickupType);
      const order = await prisma.$transaction(async (tx) => {
        const claimed = await tx.laundryOrder.updateMany({
          where: { id: orderId, status: existing.status },
          data: { status: nextStatus },
        });
        if (claimed.count !== 1) {
          throw new Error('ORDER_STATUS_CONCURRENT_UPDATE');
        }

        await tx.statusHistory.create({
          data: { orderId, status: nextStatus, adminId: admin.id, message: copy.body },
        });
        await tx.auditLog.create({
          data: {
            actorId: admin.id,
            action: 'ORDER_STATUS_CHANGED',
            entity: 'LAUNDRY_ORDER',
            entityId: orderId,
            metadata: { from: existing.status, to: nextStatus },
          },
        });

        return tx.laundryOrder.findUniqueOrThrow({
          where: { id: orderId },
          include: orderInclude,
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

      queueClientNotification(prisma, existing.clientId, copy.title, copy.body, {
        type: 'ORDER_STATUS',
        orderId,
        status: nextStatus,
        url: '/client/assisted',
      });
      return res.json({ order: await orderDto(order, true), notificationQueued: true });
    } catch (error: any) {
      if (
        error?.message === 'ORDER_STATUS_CONCURRENT_UPDATE'
        || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034')
      ) {
        return res.status(409).json({ message: 'La orden cambió al mismo tiempo. Recarga antes de continuar.' });
      }
      next(error);
    }
  });

  app.post('/api/admin/orders/:orderId/messages', async (req, res, next) => {
    try {
      const admin = await requireUser(req, res, Role.ADMIN);
      if (!admin) return;
      const orderId = safeId(req.params.orderId, 'Orden');
      const message = String(req.body?.message ?? '').trim();
      const isInternal = req.body?.isInternal === true;
      if (!message || message.length > 1000) return res.status(400).json({ message: 'Mensaje inválido.' });

      const order = await prisma.laundryOrder.findUnique({ where: { id: orderId }, select: { id: true, clientId: true } });
      if (!order) return res.status(404).json({ message: 'Orden no encontrada.' });
      const record = await prisma.orderMessage.create({
        data: { orderId, authorId: admin.id, message, isInternal },
        include: { author: { select: { name: true, role: true } } },
      });
      await prisma.auditLog.create({
        data: {
          actorId: admin.id,
          action: isInternal ? 'ORDER_INTERNAL_NOTE_CREATED' : 'ORDER_MESSAGE_SENT',
          entity: 'LAUNDRY_ORDER',
          entityId: orderId,
        },
      });
      if (!isInternal) {
        queueClientNotification(
          prisma,
          order.clientId,
          'Mensaje sobre tu servicio',
          'Tienes un nuevo mensaje del equipo. Abre la aplicación para verlo.',
          { type: 'ORDER_MESSAGE', orderId, url: '/client/assisted' },
        );
      }
      return res.status(201).json({
        message: {
          id: record.id,
          message: record.message,
          isInternal: record.isInternal,
          author: record.author,
          createdAt: record.createdAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/client/orders/:orderId/messages', async (req, res, next) => {
    try {
      const user = await requireUser(req, res, Role.CLIENT);
      if (!user) return;
      const orderId = safeId(req.params.orderId, 'Orden');
      const message = String(req.body?.message ?? '').trim();
      if (!message || message.length > 1000) return res.status(400).json({ message: 'Mensaje inválido.' });
      const order = await prisma.laundryOrder.findFirst({ where: { id: orderId, clientId: user.id }, select: { id: true } });
      if (!order) return res.status(404).json({ message: 'Orden no encontrada.' });
      const record = await prisma.orderMessage.create({
        data: { orderId, authorId: user.id, message, isInternal: false },
        include: { author: { select: { name: true, role: true } } },
      });
      return res.status(201).json({
        message: {
          id: record.id,
          message: record.message,
          isInternal: false,
          author: record.author,
          createdAt: record.createdAt.toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/admin/orders/:orderId/evidence', evidenceUpload, async (req, res, next) => {
    const uploadedPaths: string[] = [];
    try {
      const admin = await requireUser(req, res, Role.ADMIN);
      if (!admin) return;
      if (!evidenceStorageReady()) {
        return res.status(503).json({ message: 'El almacenamiento privado de evidencias no está configurado.' });
      }

      const orderId = safeId(req.params.orderId, 'Orden');
      const description = String(Array.isArray(req.body?.description) ? req.body.description[0] : req.body?.description ?? 'Evidencia del servicio')
        .trim()
        .slice(0, 500);
      const files = (req.files as Express.Multer.File[] | undefined) ?? [];
      if (files.length === 0) return res.status(400).json({ message: 'Selecciona al menos una foto.' });

      const order = await prisma.laundryOrder.findUnique({ where: { id: orderId }, select: { id: true, clientId: true } });
      if (!order) return res.status(404).json({ message: 'Orden no encontrada.' });

      const prepared = files.map((file) => {
        const kind = imageKind(file);
        if (!kind || kind.mimeType !== file.mimetype) throw new Error('Una imagen no coincide con su tipo real de archivo.');
        return { file, kind };
      });

      const uploadResults = await Promise.allSettled(prepared.map(async (item) => {
        const path = await uploadEvidenceImage({
          orderId,
          buffer: item.file.buffer,
          mimeType: item.kind.mimeType,
          extension: item.kind.extension,
        });
        return { path, ...item };
      }));

      const uploads = uploadResults
        .filter((result): result is PromiseFulfilledResult<{ path: string; file: Express.Multer.File; kind: { mimeType: string; extension: string } }> => result.status === 'fulfilled')
        .map((result) => result.value);
      uploadedPaths.push(...uploads.map((item) => item.path));

      const failedUpload = uploadResults.find((result): result is PromiseRejectedResult => result.status === 'rejected');
      if (failedUpload) {
        await Promise.all(uploadedPaths.map((path) => deleteEvidenceImage(path).catch(() => undefined)));
        uploadedPaths.length = 0;
        throw failedUpload.reason instanceof Error ? failedUpload.reason : new Error('No se pudo completar la carga de evidencias.');
      }

      const records = await prisma.$transaction(async (tx) => {
        const created = [];
        for (const item of uploads) {
          created.push(await tx.evidencePhoto.create({
            data: {
              orderId,
              uploadedById: admin.id,
              imageUrl: item.path,
              mimeType: item.kind.mimeType,
              sizeBytes: item.file.size,
              description,
            },
          }));
        }
        await tx.orderMessage.create({
          data: {
            orderId,
            authorId: admin.id,
            message: description || 'Se agregó evidencia fotográfica al servicio.',
            isInternal: false,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: admin.id,
            action: 'ORDER_EVIDENCE_UPLOADED',
            entity: 'LAUNDRY_ORDER',
            entityId: orderId,
            metadata: { count: created.length },
          },
        });
        return created;
      });

      queueClientNotification(
        prisma,
        order.clientId,
        'Nueva evidencia de tu servicio',
        'Agregamos nueva evidencia fotográfica a tu servicio. Abre la aplicación para verla.',
        { type: 'ORDER_EVIDENCE', orderId, url: '/client/assisted' },
      );
      return res.status(201).json({ evidence: await Promise.all(records.map((photo) => evidenceDto(photo, false))) });
    } catch (error: any) {
      await Promise.all(uploadedPaths.map((path) => deleteEvidenceImage(path).catch(() => undefined)));
      if (error?.message?.includes('tipo real')) return res.status(400).json({ message: error.message });
      next(error);
    }
  });
}
