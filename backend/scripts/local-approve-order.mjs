import { OrderStatus, PaymentStatus, PrismaClient, Role } from '@prisma/client';

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
  throw new Error('Uso: npm run dev:approve-order -- cliente@correo.com');
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

  const order = await prisma.laundryOrder.findFirst({
    where: {
      clientId: client.id,
      status: OrderStatus.QUEUED,
    },
    include: {
      branch: { select: { name: true } },
      payment: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!order) throw new Error('Ese cliente no tiene un servicio asistido pendiente.');
  if (order.payment?.status === PaymentStatus.APPROVED) {
    throw new Error('El servicio asistido más reciente ya tiene un pago aprobado.');
  }

  const pricingReady =
    (order.pickupType !== 'DELIVERY' || order.deliveryFeeCents !== null)
    && (!order.stainService || order.stainFeeCents !== null);

  if (!pricingReady) {
    throw new Error('El servicio todavía tiene valores variables pendientes de cotización.');
  }

  const now = new Date();
  const reference = `LOCAL-ORDER-${order.id}-${Date.now()}`;

  const result = await prisma.$transaction(async (tx) => {
    if (order.paymentId && order.payment?.status === PaymentStatus.PENDING) {
      await tx.payment.update({
        where: { id: order.paymentId },
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
        amountCents: order.amountCents,
        currency: 'COP',
        environment: 'development',
        resourceType: 'order',
        resourceId: order.id,
        processedAt: now,
        rawResponse: {
          source: 'LOCAL_FLOW_TEST',
          note: 'No se realizó una transacción Wompi.',
        },
      },
    });

    const claimed = await tx.laundryOrder.updateMany({
      where: {
        id: order.id,
        clientId: client.id,
        status: OrderStatus.QUEUED,
        paymentId: order.paymentId ?? null,
      },
      data: { paymentId: payment.id },
    });

    if (claimed.count !== 1) {
      throw new Error('El servicio cambió mientras se simulaba el pago. No se aplicó el cambio.');
    }

    await tx.auditLog.create({
      data: {
        action: 'LOCAL_TEST_ORDER_PAYMENT_APPROVED',
        entity: 'LAUNDRY_ORDER',
        entityId: order.id,
        metadata: {
          paymentId: payment.id,
          amountCents: order.amountCents,
          clientEmail: client.email,
        },
      },
    });

    return payment;
  });

  console.log('Pago LOCAL de servicio asistido aprobado.');
  console.log('Orden:', order.id);
  console.log('Sede:', order.branch?.name ?? 'Sin sede');
  console.log('Total COP:', order.amountCents / 100);
  console.log('Estado operativo:', order.status);
  console.log('Estado de pago:', PaymentStatus.APPROVED);
  console.log('Payment:', result.id);
} finally {
  await prisma.$disconnect();
}
