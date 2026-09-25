import type { Express, Request, Response } from 'express';
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
import type { AuthenticatedUser } from './auth.js';

type RequireUser = (
  req: Request,
  res: Response,
  role?: Role,
) => Promise<AuthenticatedUser | undefined>;

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

function toWompiCents(amountInCop: number) {
  return amountInCop * 100;
}

function requestKey(req: Request) {
  const value = String(req.get('Idempotency-Key') ?? req.body?.requestKey ?? '').trim();
  if (!/^[A-Za-z0-9:_-]{8,80}$/.test(value)) {
    throw new Error('Idempotency-Key obligatorio e inválido.');
  }
  return value;
}

function parseSlot(date: string, slot: string) {
  const [start, end] = slot.split('-');
  if (!date || !start || !end) throw new Error('Fecha o franja inválida.');
  return {
    scheduledStart: new Date(`${date}T${start}:00-05:00`),
    scheduledEnd: new Date(`${date}T${end}:00-05:00`),
  };
}

function validateReservationSlot(date: string, slot: string) {
  const selectedDate = new Date(`${date}T12:00:00-05:00`);
  if (Number.isNaN(selectedDate.getTime())) throw new Error('Fecha inválida.');
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

  const range = parseSlot(date, slot);
  if (range.scheduledStart >= range.scheduledEnd) throw new Error('La franja horaria es inválida.');
  if (range.scheduledStart.getTime() <= Date.now()) throw new Error('Esta franja ya inició. Selecciona una hora posterior.');
  return range;
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

function reservationDto(reservation: any) {
  return {
    id: reservation.id,
    branchId: reservation.branchId,
    branchName: reservation.branch?.name,
    machineId: reservation.machineId,
    machineCode: reservation.machine?.code,
    cycleType: reservation.cycleType,
    status: reservation.status,
    paymentStatus: reservation.payment?.status ?? null,
    date: formatBogotaDate(reservation.scheduledStart),
    slot: `${formatBogotaTime(reservation.scheduledStart)}-${formatBogotaTime(reservation.scheduledEnd)}`,
    notes: reservation.notes ?? undefined,
    createdAt: reservation.createdAt.toISOString(),
  };
}

function orderDto(order: any) {
  return {
    id: order.id,
    branchId: order.branchId,
    cycleType: order.cycleType,
    pickupType: order.pickupType,
    address: order.address ?? undefined,
    pieces: order.pieces ?? undefined,
    stainService: Boolean(order.stainService),
    notes: order.notes ?? undefined,
    status: order.status,
    createdAt: order.createdAt.toISOString(),
  };
}

export function registerIdempotentClientServiceRoutes(
  app: Express,
  prisma: PrismaClient,
  requireUser: RequireUser,
) {
  app.post('/api/reservations', async (req, res) => {
    let key = '';
    let user: AuthenticatedUser | undefined;
    try {
      user = await requireUser(req, res, Role.CLIENT);
      if (!user) return;
      key = requestKey(req);

      const existing = await prisma.reservation.findUnique({
        where: { requestKey: key },
        include: { branch: true, machine: true, payment: { select: { status: true } } },
      });
      if (existing) {
        if (existing.clientId !== user.id) return res.status(409).json({ message: 'Clave de solicitud ya utilizada.' });
        return res.status(200).json({ reservation: reservationDto(existing), idempotentReplay: true });
      }

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
            requestKey: key,
            clientId: user!.id,
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
          include: { branch: true, machine: true, payment: { select: { status: true } } },
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

      return res.status(201).json({ reservation: reservationDto(reservation), idempotentReplay: false });
    } catch (error: any) {
      if (key && user && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await prisma.reservation.findUnique({
          where: { requestKey: key },
          include: { branch: true, machine: true, payment: { select: { status: true } } },
        });
        if (existing?.clientId === user.id) {
          return res.status(200).json({ reservation: reservationDto(existing), idempotentReplay: true });
        }
        return res.status(409).json({ message: 'Esta máquina acaba de ser reservada o bloqueada. Selecciona otra.' });
      }
      return res.status(409).json({ message: error?.message ?? 'No se pudo crear la reserva.' });
    }
  });

  app.get('/api/client/reservations', async (req, res, next) => {
    try {
      const user = await requireUser(req, res, Role.CLIENT);
      if (!user) return;
      const reservations = await prisma.reservation.findMany({
        where: { clientId: user.id },
        include: { branch: true, machine: true, payment: { select: { status: true } } },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return res.json({ reservations: reservations.map(reservationDto) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/orders', async (req, res, next) => {
    let key = '';
    let user: AuthenticatedUser | undefined;
    try {
      user = await requireUser(req, res, Role.CLIENT);
      if (!user) return;
      key = requestKey(req);

      const existing = await prisma.laundryOrder.findUnique({ where: { requestKey: key } });
      if (existing) {
        if (existing.clientId !== user.id) return res.status(409).json({ message: 'Clave de solicitud ya utilizada.' });
        return res.status(200).json({ order: orderDto(existing), idempotentReplay: true });
      }

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

      const branch = await prisma.branch.findFirst({ where: { id: branchId, isActive: true }, select: { id: true } });
      if (!branch) return res.status(404).json({ message: 'Sede no disponible.' });

      const order = await prisma.laundryOrder.create({
        data: {
          requestKey: key,
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
      });
      return res.status(201).json({ order: orderDto(order), idempotentReplay: false });
    } catch (error: any) {
      if (key && user && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await prisma.laundryOrder.findUnique({ where: { requestKey: key } });
        if (existing?.clientId === user.id) {
          return res.status(200).json({ order: orderDto(existing), idempotentReplay: true });
        }
      }
      next(error);
    }
  });
}
