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
import {
  apiLimiter,
  assertProductionSecrets,
  authLimiter,
  mutationGuard,
  paymentLimiter,
  uploadLimiter,
  webhookLimiter,
  writeLimiter,
} from './security.js';
import { readSession, registerAuthRoutes, type AuthenticatedUser } from './auth.js';
import { registerWompiPaymentRoutes } from './payments.js';
import { registerAssistedRoutes } from './assisted.js';
import { registerIdempotentClientServiceRoutes } from './client-services.js';
import { businessDaySchedule } from './business-calendar.js';

assertProductionSecrets();

function boundedInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function runtimeDatabaseUrl() {
  const raw = String(process.env.DATABASE_URL ?? '').trim();
  if (!raw || !raw.startsWith('mysql://')) return raw || undefined;

  const url = new URL(raw);
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', String(boundedInt(process.env.DB_CONNECTION_LIMIT, 10, 2, 50)));
  }
  if (!url.searchParams.has('connect_timeout')) url.searchParams.set('connect_timeout', '5');
  if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '5');
  if (!url.searchParams.has('socket_timeout')) url.searchParams.set('socket_timeout', '10');
  return url.toString();
}

const prisma = new PrismaClient({
  ...(runtimeDatabaseUrl() ? { datasourceUrl: runtimeDatabaseUrl() } : {}),
  transactionOptions: {
    maxWait: 2_000,
    timeout: 10_000,
  },
});
const app = express();

function concurrencyGuard(maxConcurrent: number, label: string) {
  let active = 0;
  return (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (active >= maxConcurrent) {
      res.setHeader('Retry-After', '2');
      return res.status(503).json({ message: `Servidor ocupado en ${label}. Intenta nuevamente en unos segundos.` });
    }

    active += 1;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      active = Math.max(0, active - 1);
    };
    res.once('finish', release);
    res.once('close', release);
    next();
  };
}

const globalConcurrency = concurrencyGuard(boundedInt(process.env.MAX_CONCURRENT_REQUESTS, 120, 20, 500), 'la API');
const uploadConcurrency = concurrencyGuard(boundedInt(process.env.MAX_CONCURRENT_UPLOADS, 6, 1, 20), 'carga de evidencias');

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
const isProduction = process.env.NODE_ENV === 'production';

function normalizeOrigin(value: string) {
  const url = new URL(value.trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Origen web inválido.');
  return url.origin;
}

const webOrigin = normalizeOrigin(process.env.WEB_ORIGIN ?? 'http://localhost:3000');
const allowedOrigins = new Set([
  webOrigin,
  ...String(process.env.WEB_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeOrigin),
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
app.use(globalConcurrency);
app.use(express.json({ limit: '256kb', strict: true }));
app.use(cookieParser());
app.use(apiLimiter);
app.use(mutationGuard(allowedOrigins));
app.use('/api/auth', authLimiter);
app.use('/api/payments/wompi/checkout', paymentLimiter);
app.use('/api/payments/wompi/webhook', webhookLimiter);
app.use('/api/admin/orders/:orderId/evidence', uploadLimiter, uploadConcurrency);
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.path !== '/payments/wompi/webhook') {
    return writeLimiter(req, res, next);
  }
  next();
});

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

async function validateReservationSlot(date: string, slot: string) {
  businessDate(date);
  const todayBogota = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  if (date < todayBogota) throw new Error('No puedes reservar fechas pasadas.');
  const schedule = await businessDaySchedule(prisma, date);
  if (!schedule.slots.includes(slot as never)) {
    throw new Error(schedule.scheduleType === 'SUNDAY_HOLIDAY'
      ? 'En domingos y festivos solo están disponibles las franjas de 9:00 a.m. a 5:00 p.m.'
      : 'La franja horaria no está disponible para ese día.');
  }

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
    paymentStatus: reservation.payment?.status ?? null,
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
registerIdempotentClientServiceRoutes(app, prisma, requireUser);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: process.env.APP_NAME ?? 'La Lavanderia Bakery API' });
});

let readinessCache: { checkedAt: number; ok: boolean } = { checkedAt: 0, ok: false };
app.get('/api/ready', async (_req, res) => {
  const now = Date.now();
  if (now - readinessCache.checkedAt < 5_000) {
    return res.status(readinessCache.ok ? 200 : 503).json({ ok: readinessCache.ok });
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    readinessCache = { checkedAt: now, ok: true };
    return res.json({ ok: true });
  } catch {
    readinessCache = { checkedAt: now, ok: false };
    return res.status(503).json({ ok: false });
  }
});

app.get('/api/calendar/day', async (req, res) => {
  try {
    const date = String(req.query.date ?? '');
    if (!date) return res.status(400).json({ message: 'La fecha es obligatoria.' });
    return res.json(await businessDaySchedule(prisma, date));
  } catch (error: any) {
    return res.status(400).json({ message: error?.message ?? 'No se pudo consultar el horario del día.' });
  }
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

    const { scheduledStart, scheduledEnd } = await validateReservationSlot(date, slot);
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
      include: { client: true, branch: true, machine: true, payment: { select: { status: true } } },
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

    const { scheduledStart, scheduledEnd } = await validateReservationSlot(date, slot);
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
  if (res.headersSent) return;
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: 'La carga de archivos supera los límites permitidos.' });
  }
  if (err?.code === 'P2024') {
    return res.status(503).json({ message: 'La base de datos está ocupada. Intenta nuevamente en unos segundos.' });
  }
  const message = isProduction ? 'Error interno del servidor.' : (err?.message ?? 'Error interno del servidor.');
  return res.status(500).json({ message });
});

const server = app.listen(port, () => {
  console.log(`API lista en http://localhost:${port}/api`);
});

server.requestTimeout = 60_000;
server.headersTimeout = 15_000;
server.keepAliveTimeout = 5_000;
server.timeout = 30_000;
server.maxRequestsPerSocket = 100;
server.maxHeadersCount = 100;
if ('keepAliveTimeoutBuffer' in server) {
  (server as typeof server & { keepAliveTimeoutBuffer: number }).keepAliveTimeoutBuffer = 1_000;
}

let shuttingDown = false;
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal}: cerrando API de forma segura...`);

  const forceTimer = setTimeout(() => {
    server.closeAllConnections?.();
  }, 8_000);
  forceTimer.unref();

  server.close(async (error) => {
    clearTimeout(forceTimer);
    try {
      await prisma.$disconnect();
    } finally {
      if (error) console.error('Error cerrando servidor', error);
      process.exit(error ? 1 : 0);
    }
  });
  server.closeIdleConnections?.();
}

process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGINT', () => shutdown('SIGINT'));
