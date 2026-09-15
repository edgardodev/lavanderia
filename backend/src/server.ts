import 'dotenv/config';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import {
  CycleType,
  MachineSlotType,
  OrderStatus,
  Prisma,
  PrismaClient,
  ReservationStatus,
  Role,
  ServiceMode,
} from '@prisma/client';
import { apiLimiter, assertProductionSecrets, authLimiter, mutationGuard } from './security.js';
import { readSession, registerAuthRoutes, type AuthenticatedUser } from './auth.js';
import { registerWompiPaymentRoutes } from './payments.js';
import { registerAssistedRoutes } from './assisted.js';

assertProductionSecrets();

const prisma = new PrismaClient();
const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 4,
    fields: 10,
    parts: 16,
    fieldSize: 16 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (allowed.has(file.mimetype)) {
      callback(null, true);
      return;
    }
    callback(new Error('Tipo de archivo no permitido.'));
  },
});

const port = Number(process.env.PORT ?? 4000);
const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const isProduction = process.env.NODE_ENV === 'production';
const allowedOrigins = new Set([
  webOrigin,
  ...String(process.env.WEB_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  ...(isProduction
    ? []
    : [
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:3001',
        'http://127.0.0.1:3001',
      ]),
]);

const selfServicePrices: Record<CycleType, number> = {
  WASH: 18000,
  DRY: 18000,
  FULL: 36000,
};

const doneForYouPrices: Record<CycleType, number> = {
  WASH: 22000,
  DRY: 22000,
  FULL: 44000,
};

const allowedSlotByDay = {
  weekday: new Set(['07:00-09:00', '09:00-11:00', '11:00-13:00', '13:00-15:00', '15:00-17:00', '17:00-19:00']),
  sunday: new Set(['09:00-11:00', '11:00-13:00', '13:00-15:00', '15:00-17:00']),
};

if (isProduction) app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Origen no permitido por CORS.'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(apiLimiter);
app.use(mutationGuard(allowedOrigins));
app.use('/api/auth', authLimiter);

function toWompiCents(amountInCop: number) {
  return amountInCop * 100;
}

async function requireUser(
  req: express.Request,
  res: express.Response,
  role?: Role,
): Promise<AuthenticatedUser | undefined> {
  const session = readSession(req);
  if (!session?.sub || session.purpose !== 'session' || typeof session.ver !== 'number') {
    res.status(401).json({ message: 'Debes iniciar sesión para continuar.' });
    return undefined;
  }

  const user = await prisma.user.findUnique({ where: { id: session.sub } });
  if (!user || !user.isActive || user.sessionVersion !== session.ver) {
    res.status(401).json({ message: 'Sesión inválida. Inicia sesión nuevamente.' });
    return undefined;
  }
  if (role && user.role !== role) {
    res.status(403).json({ message: 'No tienes permisos para esta acción.' });
    return undefined;
  }
  if (user.role === Role.ADMIN && (session.mfa !== true || !user.mfaEnabled || user.mustChangePassword)) {
    res.status(403).json({ message: 'El acceso administrativo requiere completar la configuración de seguridad y MFA.' });
    return undefined;
  }

  return user;
}

function parseSlot(date: string, slot: string) {
  const [start, end] = slot.split('-');
  if (!date || !start || !end) throw new Error('Fecha o franja inválida');
  return {
    scheduledStart: new Date(`${date}T${start}:00-05:00`),
    scheduledEnd: new Date(`${date}T${end}:00-05:00`),
  };
}

function businessDate(date: string) {
  const parsed = new Date(`${date}T12:00:00-05:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error('Fecha inválida');
  return parsed;
}

function validateReservationSlot(date: string, slot: string) {
  const selectedDate = businessDate(date);
  const todayBogota = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  if (date < todayBogota) throw new Error('No puedes reservar fechas pasadas.');
  const day = selectedDate.getUTCDay();
  const allowed = day === 0 ? allowedSlotByDay.sunday : allowedSlotByDay.weekday;
  if (!allowed.has(slot)) throw new Error('La franja horaria no está disponible para ese día.');

  const { scheduledStart, scheduledEnd } = parseSlot(date, slot);
  if (scheduledStart >= scheduledEnd) throw new Error('La franja horaria es inválida.');
  if (scheduledStart.getTime() <= Date.now()) throw new Error('Esta franja ya inició. Selecciona una hora posterior.');
  return { scheduledStart, scheduledEnd };
}

function formatBogotaDate(date: Date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatBogotaTime(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Bogota',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function slotFromRange(range: { scheduledStart: Date; scheduledEnd: Date }) {
  return `${formatBogotaTime(range.scheduledStart)}-${formatBogotaTime(range.scheduledEnd)}`;
}

function reservationDto(reservation: any) {
  return {
    id: reservation.id,
    branchId: reservation.branchId,
    machineId: reservation.machineId,
    machineCode: reservation.machine?.code,
    branchName: reservation.branch?.name,
    cycleType: reservation.cycleType,
    status: reservation.status,
    date: formatBogotaDate(reservation.scheduledStart),
    slot: slotFromRange(reservation),
    notes: reservation.notes ?? undefined,
    client: reservation.client
      ? { name: reservation.client.name, email: reservation.client.email, phone: reservation.client.phone ?? undefined }
      : undefined,
    createdAt: reservation.createdAt.toISOString(),
  };
}

function machineBlockDto(block: any) {
  return {
    id: block.id,
    branchId: block.branchId,
    machineId: block.machineId,
    machineCode: block.machine?.code,
    branchName: block.branch?.name,
    date: formatBogotaDate(block.scheduledStart),
    slot: slotFromRange(block),
    reason: block.reason ?? 'Bloqueo administrativo',
    createdAt: block.createdAt.toISOString(),
  };
}

registerAuthRoutes(app, prisma, requireUser);
registerWompiPaymentRoutes(app, prisma, requireUser);
registerAssistedRoutes(app, prisma, requireUser, upload.array('photos'));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: process.env.APP_NAME ?? 'La Lavanderia Bakery API' });
});

app.get('/api/branches', async (_req, res, next) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      include: { machines: { where: { isActive: true }, orderBy: { code: 'asc' } } },
      orderBy: { name: 'asc' },
    });
    return res.json({
      branches: branches.map((branch) => ({
        id: branch.id,
        name: branch.name,
        address: branch.address,
        machines: branch.machines.map((machine) => ({ id: machine.id, code: machine.code })),
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/reservations/availability', async (req, res) => {
  try {
    const branchId = String(req.query.branchId ?? '');
    const date = String(req.query.date ?? '');
    const slot = String(req.query.slot ?? '');
    if (!branchId || !date || !slot) return res.status(400).json({ message: 'Sede, fecha y franja son obligatorias.' });

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { machines: { where: { isActive: true }, orderBy: { code: 'asc' } } },
    });
    if (!branch || !branch.isActive) return res.status(404).json({ message: 'Sede no disponible.' });

    const { scheduledStart, scheduledEnd } = validateReservationSlot(date, slot);
    const occupancies = await prisma.machineSlot.findMany({
      where: { branchId, scheduledStart, scheduledEnd },
      select: { machineId: true, type: true },
    });

    const reservedMachineIds = [...new Set(
      occupancies.filter((item) => item.type === MachineSlotType.RESERVATION).map((item) => item.machineId),
    )];
    const blockedMachineIds = [...new Set(
      occupancies.filter((item) => item.type === MachineSlotType.ADMIN_BLOCK).map((item) => item.machineId),
    )];
    const unavailableMachineIds = [...new Set([...reservedMachineIds, ...blockedMachineIds])];

    return res.json({
      branchId,
      date,
      slot,
      reservedMachineIds,
      blockedMachineIds,
      unavailableMachineIds,
      availableMachines: branch.machines
        .filter((machine) => !unavailableMachineIds.includes(machine.id))
        .map((machine) => ({ id: machine.id, code: machine.code })),
    });
  } catch (error: any) {
    return res.status(400).json({ message: error?.message ?? 'No se pudo consultar disponibilidad.' });
  }
});

app.post('/api/reservations', async (req, res) => {
  try {
    const user = await requireUser(req, res, Role.CLIENT);
    if (!user) return;

    const branchId = String(req.body?.branchId ?? '');
    const machineId = String(req.body?.machineId ?? '');
    const cycleType = req.body?.cycleType as CycleType;
    const date = String(req.body?.date ?? '');
    const slot = String(req.body?.slot ?? '');
    const notes = String(req.body?.notes ?? '').trim().slice(0, 500) || undefined;
    if (!branchId || !machineId || !cycleType || !date || !slot) {
      return res.status(400).json({ message: 'Faltan datos para crear la reserva.' });
    }
    if (!Object.values(CycleType).includes(cycleType)) return res.status(400).json({ message: 'Tipo de ciclo inválido.' });

    const { scheduledStart, scheduledEnd } = validateReservationSlot(date, slot);
    const reservation = await prisma.$transaction(async (tx) => {
      const machine = await tx.machine.findFirst({
        where: { id: machineId, branchId, isActive: true, branch: { isActive: true } },
      });
      if (!machine) throw new Error('La máquina no pertenece a la sede seleccionada o no está activa.');

      const created = await tx.reservation.create({
        data: {
          clientId: user.id,
          branchId,
          machineId,
          serviceMode: ServiceMode.SELF_SERVICE,
          cycleType,
          scheduledStart,
          scheduledEnd,
          status: ReservationStatus.PENDING_PAYMENT,
          amountCents: toWompiCents(selfServicePrices[cycleType]),
          notes,
        },
        include: { client: true, branch: true, machine: true },
      });

      await tx.machineSlot.create({
        data: {
          branchId,
          machineId,
          type: MachineSlotType.RESERVATION,
          scheduledStart,
          scheduledEnd,
          reservationId: created.id,
          reason: 'Reserva de autoservicio',
        },
      });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return res.status(201).json({ reservation: reservationDto(reservation) });
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ message: 'Esta máquina acaba de ser reservada o bloqueada. Selecciona otra.' });
    }
    return res.status(409).json({ message: error?.message ?? 'No se pudo crear la reserva.' });
  }
});

app.get('/api/admin/reservations', async (req, res, next) => {
  try {
    const admin = await requireUser(req, res, Role.ADMIN);
    if (!admin) return;

    const branchId = String(req.query.branchId ?? 'all');
    const machineId = String(req.query.machineId ?? 'all');
    const date = String(req.query.date ?? '');
    if (date) businessDate(date);
    const startOfDay = date ? new Date(`${date}T00:00:00-05:00`) : undefined;
    const endOfDay = date ? new Date(`${date}T23:59:59.999-05:00`) : undefined;

    const reservations = await prisma.reservation.findMany({
      where: {
        ...(branchId !== 'all' ? { branchId } : {}),
        ...(machineId !== 'all' ? { machineId } : {}),
        ...(date ? { scheduledStart: { gte: startOfDay, lte: endOfDay } } : {}),
      },
      include: { client: true, branch: true, machine: true },
      orderBy: [{ scheduledStart: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });

    return res.json({
      reservations: reservations.map(reservationDto),
      notifications: reservations.slice(0, 20).map((reservation) => ({
        id: reservation.id,
        title: 'Reserva de autoservicio',
        message: `${reservation.client.name} · ${reservation.branch.name} · ${reservation.machine.code} · ${formatBogotaDate(reservation.scheduledStart)} ${slotFromRange(reservation)}`,
        createdAt: reservation.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/machine-blocks', async (req, res, next) => {
  try {
    const admin = await requireUser(req, res, Role.ADMIN);
    if (!admin) return;

    const branchId = String(req.query.branchId ?? 'all');
    const date = String(req.query.date ?? '');
    if (date) businessDate(date);
    const startOfDay = date ? new Date(`${date}T00:00:00-05:00`) : undefined;
    const endOfDay = date ? new Date(`${date}T23:59:59.999-05:00`) : undefined;

    const blocks = await prisma.machineSlot.findMany({
      where: {
        type: MachineSlotType.ADMIN_BLOCK,
        ...(branchId !== 'all' ? { branchId } : {}),
        ...(date
          ? { scheduledStart: { gte: startOfDay, lte: endOfDay } }
          : { scheduledEnd: { gt: new Date() } }),
      },
      include: { machine: true, branch: true },
      orderBy: [{ scheduledStart: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });
    return res.json({ blocks: blocks.map(machineBlockDto) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/machine-blocks', async (req, res) => {
  try {
    const admin = await requireUser(req, res, Role.ADMIN);
    if (!admin) return;

    const branchId = String(req.body?.branchId ?? '');
    const machineId = String(req.body?.machineId ?? '');
    const date = String(req.body?.date ?? '');
    const slot = String(req.body?.slot ?? '');
    const reason = String(req.body?.reason ?? 'Uso interno de la sede').trim().slice(0, 300);
    if (!branchId || !machineId || !date || !slot) {
      return res.status(400).json({ message: 'Sede, máquina, fecha y franja son obligatorias.' });
    }

    const { scheduledStart, scheduledEnd } = validateReservationSlot(date, slot);
    const machine = await prisma.machine.findFirst({
      where: { id: machineId, branchId, isActive: true, branch: { isActive: true } },
    });
    if (!machine) return res.status(404).json({ message: 'La máquina no existe en la sede seleccionada.' });

    const block = await prisma.$transaction(async (tx) => {
      const created = await tx.machineSlot.create({
        data: {
          branchId,
          machineId,
          type: MachineSlotType.ADMIN_BLOCK,
          scheduledStart,
          scheduledEnd,
          adminId: admin.id,
          reason,
        },
        include: { machine: true, branch: true },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.id,
          action: 'MACHINE_SLOT_BLOCKED',
          entity: 'MACHINE',
          entityId: machineId,
          metadata: { branchId, date, slot, reason },
        },
      });
      return created;
    });
    return res.status(201).json({ block: machineBlockDto(block) });
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(409).json({ message: 'Esa máquina ya está reservada o bloqueada en esa franja.' });
    }
    return res.status(400).json({ message: error?.message ?? 'No se pudo bloquear la máquina.' });
  }
});

app.delete('/api/admin/machine-blocks/:blockId', async (req, res, next) => {
  try {
    const admin = await requireUser(req, res, Role.ADMIN);
    if (!admin) return;
    const blockId = String(req.params.blockId);
    const block = await prisma.machineSlot.findFirst({ where: { id: blockId, type: MachineSlotType.ADMIN_BLOCK } });
    if (!block) return res.status(404).json({ message: 'Bloqueo no encontrado.' });

    await prisma.$transaction([
      prisma.machineSlot.delete({ where: { id: blockId } }),
      prisma.auditLog.create({
        data: {
          actorId: admin.id,
          action: 'MACHINE_SLOT_UNBLOCKED',
          entity: 'MACHINE',
          entityId: block.machineId,
          metadata: {
            branchId: block.branchId,
            date: formatBogotaDate(block.scheduledStart),
            slot: slotFromRange(block),
          },
        },
      }),
    ]);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders', async (req, res, next) => {
  try {
    const user = await requireUser(req, res, Role.CLIENT);
    if (!user) return;

    const branchId = String(req.body?.branchId ?? '');
    const cycleType = req.body?.cycleType as CycleType;
    const pickupType = String(req.body?.pickupType ?? 'STORE');
    const address = String(req.body?.address ?? '').trim().slice(0, 250) || undefined;
    const pieces = Number(req.body?.pieces ?? 0);
    const notes = String(req.body?.notes ?? '').trim().slice(0, 500) || undefined;
    const stainService = Boolean(req.body?.stainService);

    if (!branchId || !Object.values(CycleType).includes(cycleType)) {
      return res.status(400).json({ message: 'Sede y tipo de ciclo son obligatorios.' });
    }
    if (!['STORE', 'DELIVERY'].includes(pickupType)) return res.status(400).json({ message: 'Tipo de entrega inválido.' });
    if (pickupType === 'DELIVERY' && !address) return res.status(400).json({ message: 'La dirección es obligatoria para domicilio.' });
    if (!Number.isInteger(pieces) || pieces < 0 || pieces > 500) return res.status(400).json({ message: 'Cantidad de piezas inválida.' });

    const branch = await prisma.branch.findFirst({ where: { id: branchId, isActive: true } });
    if (!branch) return res.status(404).json({ message: 'Sede no disponible.' });

    const order = await prisma.laundryOrder.create({
      data: {
        clientId: user.id,
        branchId,
        serviceMode: ServiceMode.DONE_FOR_YOU,
        cycleType,
        status: OrderStatus.QUEUED,
        amountCents: toWompiCents(doneForYouPrices[cycleType]),
        pickupType,
        address,
        pieces: pieces || undefined,
        stainService,
        notes,
        statusHistory: {
          create: {
            status: OrderStatus.QUEUED,
            message: 'Hemos recibido tu solicitud. La ropa quedará en espera de prelavado cuando ingrese a la sede.',
          },
        },
      },
      include: { client: true },
    });
    return res.status(201).json({
      order: {
        id: order.id,
        branchId: order.branchId,
        cycleType: order.cycleType,
        pickupType: order.pickupType,
        address: order.address ?? undefined,
        pieces: order.pieces ?? undefined,
        stainService: order.stainService,
        notes: order.notes ?? undefined,
        status: order.status,
        createdAt: order.createdAt.toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/notifications/token', async (req, res, next) => {
  try {
    const user = await requireUser(req, res);
    if (!user) return;
    const token = String(req.body?.token ?? '').trim();
    const deviceType = String(req.body?.deviceType ?? '').trim().slice(0, 50) || undefined;
    if (!token || token.length > 500) return res.status(400).json({ message: 'Token inválido.' });

    await prisma.pushToken.upsert({
      where: { userId_token: { userId: user.id, token } },
      update: { lastSeenAt: new Date(), deviceType },
      create: { userId: user.id, token, deviceType },
    });
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: 'La carga de archivos supera los límites permitidos.' });
  }
  const message = isProduction ? 'Error interno del servidor.' : (err?.message ?? 'Error interno del servidor.');
  return res.status(500).json({ message });
});

app.listen(port, () => {
  console.log(`API lista en http://localhost:${port}/api`);
});
