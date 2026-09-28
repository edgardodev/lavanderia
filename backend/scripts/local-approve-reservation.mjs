import { PrismaClient, PaymentStatus, ReservationStatus, Role } from '@prisma/client';

const databaseUrl = String(process.env.DATABASE_URL ?? '').trim();
if (!databaseUrl) throw new Error('DATABASE_URL no está configurado.');

const db = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(db.hostname)) {
  throw new Error('Este simulador solo puede ejecutarse contra una base de datos local.');
}
if (process.env.NODE_ENV === 'production') {
  throw new Error('Este simulador está bloqueado en producción.');
}

const email = String(process.argv[2] ?? '').trim().toLowerCase();
if (!email) {
  throw new Error('Uso: npm run dev:approve-reservation -- cliente@correo.com');
}

const prisma = new PrismaClient();

try {
  const client = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  });
  if (!client || client.role !== Role.CLIENT) {
    throw new Error('No existe un cliente con ese correo.');
  }

  const reservation = await prisma.reservation.findFirst({
    where: {
      clientId: client.id,
      status: ReservationStatus.PENDING_PAYMENT,
    },
    include: {
      branch: { select: { name: true } },
      machine: { select: { code: true } },
      payment: true,
      slotLock: { select: { id: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!reservation) throw new Error('Ese cliente no tiene una reserva pendiente de pago.');
  if (!reservation.slotLock) throw new Error('La reserva no tiene bloqueo de máquina; no se modificó nada.');

  const now = new Date();
  const reference = `LOCAL-RES-${reservation.id}-${Date.now()}`;

  const result = await prisma.$transaction(async (tx) => {
    if (reservation.paymentId && reservation.payment?.status === PaymentStatus.PENDING) {
      await tx.payment.update({
        where: { id: reservation.paymentId },
        data: {
          status: PaymentStatus.ERROR,
          processedAt: now,
          rawResponse: { reason: 'REPLACED_BY_LOCAL_FLOW_TEST' },
        },
      });
    }

    const payment = await tx.payment.create({
      data: {
        provider: 'LOCAL_TEST',
        externalReference: reference,
        status: PaymentStatus.APPROVED,
        amountCents: reservation.amountCents,
        currency: 'COP',
        environment: 'development',
        resourceType: 'reservation',
        resourceId: reservation.id,
        processedAt: now,
        rawResponse: {
          source: 'LOCAL_FLOW_TEST',
          note: 'No se realizó una transacción Wompi.',
        },
      },
    });

    const claimed = await tx.reservation.updateMany({
      where: {
        id: reservation.id,
        clientId: client.id,
        status: ReservationStatus.PENDING_PAYMENT,
        paymentId: reservation.paymentId ?? null,
      },
      data: {
        paymentId: payment.id,
        status: ReservationStatus.CONFIRMED,
      },
    });

    if (claimed.count !== 1) {
      throw new Error('La reserva cambió mientras se simulaba el pago. No se aplicó el cambio.');
    }

    await tx.auditLog.create({
      data: {
        action: 'LOCAL_TEST_RESERVATION_PAYMENT_APPROVED',
        entity: 'RESERVATION',
        entityId: reservation.id,
        metadata: {
          paymentId: payment.id,
          amountCents: reservation.amountCents,
          clientEmail: client.email,
        },
      },
    });

    return payment;
  });

  console.log('Pago LOCAL de reserva aprobado.');
  console.log('Reserva:', reservation.id);
  console.log('Sede:', reservation.branch.name);
  console.log('Máquina:', reservation.machine.code);
  console.log('Total COP:', reservation.amountCents / 100);
  console.log('Estado:', ReservationStatus.CONFIRMED);
  console.log('Payment:', result.id);
} finally {
  await prisma.$disconnect();
}
