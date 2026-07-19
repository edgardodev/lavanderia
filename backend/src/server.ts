import 'dotenv/config';
import argon2 from 'argon2';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { createHash } from 'crypto';
import express from 'express';
import helmet from 'helmet';
import jwt, { type Secret, type SignOptions } from 'jsonwebtoken';
import multer from 'multer';
import { nanoid } from 'nanoid';
import {
  CycleType,
  OrderStatus,
  Prisma,
  PrismaClient,
  ReservationStatus,
  Role,
  ServiceMode,
} from '@prisma/client';

const prisma = new PrismaClient();
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const port = Number(process.env.PORT ?? 4000);
const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
const jwtSecret: Secret = process.env.JWT_SECRET ?? 'local_development_secret_change_me';
const allowedOrigins = new Set([
  webOrigin,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
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

const orderExtras = new Map<string, { branchId?: string; pieces?: number; stainService?: boolean }>();
const allowedSlotByDay = {
  weekday: new Set(['07:00-09:00', '09:00-11:00', '11:00-13:00', '13:00-15:00', '15:00-17:00', '17:00-19:00']),
  sunday: new Set(['09:00-11:00', '11:00-13:00', '13:00-15:00', '15:00-17:00']),
};

function toWompiCents(amountInCop: number) {
  return amountInCop * 100;
}

function normalizeWompiCents(amount: number) {
  return amount < 100000 ? amount * 100 : amount;
}

function wompiIntegritySignature(reference: string, amountInCents: number, currency: string) {
  const secret = process.env.WOMPI_INTEGRITY_SECRET ?? '';
  if (!secret || secret.includes('xxxxx')) return 'local-development-signature';
  return createHash('sha256').update(`${reference}${amountInCents}${currency}${secret}`).digest('hex');
}

function hasValidWompiConfig() {
  const publicKey = process.env.WOMPI_PUBLIC_KEY ?? '';
  const integritySecret = process.env.WOMPI_INTEGRITY_SECRET ?? '';
  return Boolean(publicKey && integritySecret && !publicKey.includes('xxxxx') && !integritySecret.includes('xxxxx'));
}

app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(compression());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error(`Origen no permitido por CORS: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());

function signUser(user: { id: string; role: Role }) {
  const options: SignOptions = { expiresIn: (process.env.JWT_EXPIRES_IN ?? '8h') as SignOptions['expiresIn'] };
  return jwt.sign({ sub: user.id, role: user.role }, jwtSecret, options);
}

function currentUserId(req: express.Request) {
  const token = req.cookies?.auth_token;
  if (!token) return undefined;

  try {
    const payload = jwt.verify(token, jwtSecret) as { sub?: string };
    return payload.sub;
  } catch {
    return undefined;
  }
}

async function requireUser(req: express.Request, res: express.Response, role?: Role) {
  const userId = currentUserId(req);
  if (!userId) {
    res.status(401).json({ message: 'Debes iniciar sesión para continuar.' });
    return undefined;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    res.status(401).json({ message: 'Sesión inválida. Inicia sesión nuevamente.' });
    return undefined;
  }
  if (role && user.role !== role) {
    res.status(403).json({ message: 'No tienes permisos para esta acción.' });
    return undefined;
  }

  return user;
}

async function fallbackUser(role: Role = Role.CLIENT) {
  const email = role === Role.ADMIN ? 'admin1@lalavanderiabakery.com' : 'cliente.demo@lalavanderiabakery.com';
  const passwordHash = await argon2.hash('Cambiar1234!', { type: argon2.argon2id });

  return prisma.user.upsert({
    where: { email },
    update: { isActive: true, role },
    create: {
      name: role === Role.ADMIN ? 'Administrador 1' : 'Cliente demo',
      email,
      phone: role === Role.ADMIN ? '3000000001' : '3000000000',
      passwordHash,
      role,
    },
  });
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
  const today = new Date();
  const todayBogota = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(today);

  if (date < todayBogota) throw new Error('No puedes reservar fechas pasadas.');

  const day = selectedDate.getUTCDay();
  const allowed = day === 0 ? allowedSlotByDay.sunday : allowedSlotByDay.weekday;
  if (!allowed.has(slot)) throw new Error('La franja horaria no está disponible para ese día.');

  const { scheduledStart, scheduledEnd } = parseSlot(date, slot);
  if (scheduledStart >= scheduledEnd) throw new Error('La franja horaria es inválida.');
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

function slotFromReservation(reservation: { scheduledStart: Date; scheduledEnd: Date }) {
  const start = formatBogotaTime(reservation.scheduledStart);
  const end = formatBogotaTime(reservation.scheduledEnd);
  return `${start}-${end}`;
}

function reservationDto(reservation: any) {
  return {
    id: reservation.id,
    branchId: reservation.branchId,
    machineId: reservation.machineId,
    cycleType: reservation.cycleType,
    date: formatBogotaDate(reservation.scheduledStart),
    slot: slotFromReservation(reservation),
    notes: reservation.notes ?? undefined,
    client: reservation.client
      ? { name: reservation.client.name, email: reservation.client.email, phone: reservation.client.phone ?? undefined }
      : undefined,
    createdAt: reservation.createdAt.toISOString(),
  };
}

function orderDto(order: any) {
  const extras = orderExtras.get(order.id) ?? {};
  return {
    id: order.id,
    branchId: extras.branchId ?? 'universidad-metropolitana',
    cycleType: order.cycleType,
    pickupType: order.pickupType,
    address: order.address ?? undefined,
    pieces: extras.pieces,
    notes: order.notes ?? undefined,
    status: order.status,
    client: order.client
      ? { name: order.client.name, email: order.client.email, phone: order.client.phone ?? undefined }
      : undefined,
    createdAt: order.createdAt.toISOString(),
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, app: process.env.APP_NAME ?? 'La Lavanderia Bakery API' });
});

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { name, email, phone, password, consent } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Nombre, correo y contraseña son obligatorios.' });
    if (!consent) return res.status(400).json({ message: 'Debes aceptar el tratamiento de datos.' });

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    const user = await prisma.user.create({
      data: { name, email: String(email).toLowerCase(), phone, passwordHash, role: Role.CLIENT },
      select: { id: true, name: true, email: true, phone: true, role: true },
    });

    res.status(201).json({ user });
  } catch (error: any) {
    if (error?.code === 'P2002') return res.status(409).json({ message: 'Este correo ya está registrado.' });
    next(error);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password, role } = req.body;
    const user = await prisma.user.findUnique({ where: { email: String(email ?? '').toLowerCase() } });
    if (!user || !user.isActive) return res.status(401).json({ message: 'Credenciales inválidas.' });

    const validPassword = await argon2.verify(user.passwordHash, String(password ?? ''));
    if (!validPassword) return res.status(401).json({ message: 'Credenciales inválidas.' });
    if (role === 'ADMIN' && user.role !== Role.ADMIN) return res.status(403).json({ message: 'Este usuario no es administrador.' });

    res.cookie('auth_token', signUser(user), {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 8 * 60 * 60 * 1000,
    });
    res.cookie('csrf_token', nanoid(), { sameSite: 'lax', secure: false, maxAge: 8 * 60 * 60 * 1000 });

    res.json({
      user: { id: user.id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/branches', async (_req, res, next) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { isActive: true },
      include: { machines: { where: { isActive: true }, orderBy: { code: 'asc' } } },
      orderBy: { name: 'asc' },
    });

    res.json({
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

app.get('/api/reservations/availability', async (req, res, next) => {
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
    const reservations = await prisma.reservation.findMany({
      where: {
        branchId,
        status: { not: ReservationStatus.CANCELLED },
        scheduledStart: { lt: scheduledEnd },
        scheduledEnd: { gt: scheduledStart },
      },
      select: { machineId: true },
    });

    const reservedMachineIds = [...new Set(reservations.map((reservation) => reservation.machineId))];
    res.json({
      branchId,
      date,
      slot,
      reservedMachineIds,
      availableMachines: branch.machines
        .filter((machine) => !reservedMachineIds.includes(machine.id))
        .map((machine) => ({ id: machine.id, code: machine.code })),
    });
  } catch (error: any) {
    res.status(400).json({ message: error?.message ?? 'No se pudo consultar disponibilidad.' });
  }
});

app.post('/api/reservations', async (req, res, next) => {
  try {
    const user = await requireUser(req, res, Role.CLIENT);
    if (!user) return;

    const { branchId, machineId, cycleType, date, slot, notes } = req.body;
    if (!branchId || !machineId || !cycleType || !date || !slot) {
      return res.status(400).json({ message: 'Faltan datos para crear la reserva.' });
    }
    if (!Object.values(CycleType).includes(cycleType)) return res.status(400).json({ message: 'Tipo de ciclo inválido.' });

    const { scheduledStart, scheduledEnd } = validateReservationSlot(date, slot);
    const reservation = await prisma.$transaction(async (tx) => {
      const machine = await tx.machine.findFirst({
        where: { id: machineId, branchId, isActive: true, branch: { isActive: true } },
        include: { branch: true },
      });
      if (!machine) throw new Error('La máquina no pertenece a la sede seleccionada o no está activa.');

      const conflict = await tx.reservation.findFirst({
        where: {
          machineId,
          status: { not: ReservationStatus.CANCELLED },
          scheduledStart: { lt: scheduledEnd },
          scheduledEnd: { gt: scheduledStart },
        },
      });
      if (conflict) throw new Error('Esta máquina ya está reservada en esa franja. Selecciona otra.');

      return tx.reservation.create({
        data: {
          clientId: user.id,
          branchId,
          machineId,
          serviceMode: ServiceMode.SELF_SERVICE,
          cycleType,
          scheduledStart,
          scheduledEnd,
          status: ReservationStatus.PENDING_PAYMENT,
          amountCents: toWompiCents(selfServicePrices[cycleType as CycleType] ?? selfServicePrices.FULL),
          notes,
        },
        include: { client: true, branch: true, machine: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    res.status(201).json({ reservation: reservationDto(reservation) });
  } catch (error: any) {
    res.status(409).json({ message: error?.message ?? 'No se pudo crear la reserva.' });
  }
});

app.get('/api/admin/reservations', async (req, res, next) => {
  try {
    const user = await requireUser(req, res, Role.ADMIN);
    if (!user) return;

    const branchId = String(req.query.branchId ?? 'all');
    const machineId = String(req.query.machineId ?? 'all');
    const date = String(req.query.date ?? '');

    const dateRange = date ? validateReservationSlot(date, businessDate(date).getUTCDay() === 0 ? '09:00-11:00' : '07:00-09:00') : undefined;
    const startOfDay = date ? new Date(`${date}T00:00:00-05:00`) : undefined;
    const endOfDay = date ? new Date(`${date}T23:59:59-05:00`) : undefined;

    const reservations = await prisma.reservation.findMany({
      where: {
        ...(branchId !== 'all' ? { branchId } : {}),
        ...(machineId !== 'all' ? { machineId } : {}),
        ...(dateRange ? { scheduledStart: { gte: startOfDay, lte: endOfDay } } : {}),
      },
      include: { client: true, branch: true, machine: true },
      orderBy: [{ scheduledStart: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    });

    res.json({
      reservations: reservations.map(reservationDto),
      notifications: reservations.slice(0, 20).map((reservation) => ({
        id: reservation.id,
        title: 'Nueva reserva de autoservicio',
        message: `${reservation.client.name} reservó ${reservation.branch.name} · ${reservation.machine.code} · ${formatBogotaDate(reservation.scheduledStart)} ${slotFromReservation(reservation)}`,
        createdAt: reservation.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/orders', async (req, res, next) => {
  try {
    const { branchId, cycleType, pickupType, address, pieces, notes, stainService } = req.body;
    if (!cycleType) return res.status(400).json({ message: 'Selecciona el tipo de ciclo.' });

    const userId = currentUserId(req) ?? (await fallbackUser(Role.CLIENT)).id;
    const order = await prisma.laundryOrder.create({
      data: {
        clientId: userId,
        serviceMode: ServiceMode.DONE_FOR_YOU,
        cycleType,
        status: OrderStatus.QUEUED,
        amountCents: toWompiCents(doneForYouPrices[cycleType as CycleType] ?? doneForYouPrices.FULL),
        pickupType: pickupType ?? 'STORE',
        address,
        notes,
      },
      include: { client: true },
    });

    orderExtras.set(order.id, { branchId, pieces: Number(pieces || 0), stainService: Boolean(stainService) });
    res.status(201).json({ order: orderDto(order) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/orders', async (_req, res, next) => {
  try {
    const orders = await prisma.laundryOrder.findMany({
      include: { client: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ orders: orders.map(orderDto) });
  } catch (error) {
    next(error);
  }
});

app.patch('/api/admin/orders/:orderId/status', async (req, res, next) => {
  try {
    const orderId = String(req.params.orderId);
    const status = req.body.status as OrderStatus;
    if (!Object.values(OrderStatus).includes(status)) return res.status(400).json({ message: 'Estado inválido.' });

    const adminId = currentUserId(req) ?? (await fallbackUser(Role.ADMIN)).id;
    const order = await prisma.laundryOrder.update({
      where: { id: orderId },
      data: {
        status,
        statusHistory: {
          create: {
            status,
            adminId,
            message: `Estado actualizado a ${status}`,
          },
        },
      },
    });

    res.json({ order: orderDto(order) });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/orders/:orderId/evidence', upload.array('photos'), async (req, res, next) => {
  try {
    const orderId = String(req.params.orderId);
    const adminId = currentUserId(req) ?? (await fallbackUser(Role.ADMIN)).id;
    const rawDescription = req.body.description;
    const description = Array.isArray(rawDescription)
      ? String(rawDescription[0] ?? 'Evidencia cargada')
      : String(rawDescription ?? 'Evidencia cargada');
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];

    const photos = await Promise.all(
      files.map((file, index) =>
        prisma.evidencePhoto.create({
          data: {
            orderId,
            uploadedById: adminId,
            imageUrl: `local://${orderId}/${Date.now()}-${index}-${file.originalname}`,
            description,
          },
        }),
      ),
    );

    res.status(201).json({ evidence: photos });
  } catch (error) {
    next(error);
  }
});

app.post('/api/notifications/token', async (req, res, next) => {
  try {
    const userId = currentUserId(req) ?? (await fallbackUser(Role.CLIENT)).id;
    const { token, deviceType } = req.body;
    if (!token) return res.status(400).json({ message: 'Token requerido.' });

    await prisma.pushToken.upsert({
      where: { userId_token: { userId, token } },
      update: { lastSeenAt: new Date(), deviceType },
      create: { userId, token, deviceType },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

app.post('/api/payments/wompi/checkout', async (req, res, next) => {
  try {
    if (!hasValidWompiConfig()) {
      return res.status(503).json({
        message: 'Wompi no estÃ¡ configurado. Agrega WOMPI_PUBLIC_KEY y WOMPI_INTEGRITY_SECRET reales en backend/.env.',
      });
    }

    const { type, id } = req.body;
    const reference = `${type}-${id}-${Date.now()}`;
    const currency = process.env.WOMPI_CURRENCY ?? 'COP';
    const storedAmount = type === 'reservation'
      ? (await prisma.reservation.findUnique({ where: { id } }))?.amountCents ?? toWompiCents(selfServicePrices.FULL)
      : (await prisma.laundryOrder.findUnique({ where: { id } }))?.amountCents ?? toWompiCents(doneForYouPrices.FULL);
    const amountInCents = normalizeWompiCents(storedAmount);

    res.json({
      checkout: {
        widget: {
          publicKey: process.env.WOMPI_PUBLIC_KEY ?? 'pub_test_xxxxx',
          currency,
          amountInCents,
          reference,
          signature: wompiIntegritySignature(reference, amountInCents, currency),
          redirectUrl: process.env.APP_URL ?? webOrigin,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ message: err?.message ?? 'Error interno del servidor.' });
});

app.listen(port, () => {
  console.log(`API lista en http://localhost:${port}/api`);
});
