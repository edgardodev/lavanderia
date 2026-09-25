import type { Branch, CycleType, OrderStatus } from '@/types';

export const brand = {
  aqua: '#00C1C1',
  yellow: '#F8F700',
  ink: '#082F34',
};

export const cycleLabels: Record<CycleType, string> = {
  WASH: 'Ciclo de lavado',
  DRY: 'Ciclo de secado',
  FULL: 'Ciclo completo',
};

export const selfServicePrices: Record<CycleType, number> = {
  WASH: 18000,
  DRY: 18000,
  FULL: 36000,
};

export const doneForYouPrices: Record<CycleType, number> = {
  WASH: 22000,
  DRY: 22000,
  FULL: 44000,
};

export const stainServiceRange = {
  min: 10000,
  max: 20000,
};

export const branchSeed: Branch[] = [
  {
    id: 'universidad-metropolitana',
    name: 'Universidad Metropolitana',
    address: 'Sede Universidad Metropolitana',
    machines: [
      { id: 'um-1', code: 'Máquina 1' },
      { id: 'um-2', code: 'Máquina 2' },
      { id: 'um-3', code: 'Máquina 3' },
      { id: 'um-4', code: 'Máquina 4' },
    ],
  },
  {
    id: 'cra-46',
    name: 'Cra 46 con 93',
    address: 'Sede Cra 46 con 93',
    machines: [
      { id: 'c46-1', code: 'Máquina 1' },
      { id: 'c46-2', code: 'Máquina 2' },
      { id: 'c46-3', code: 'Máquina 3' },
      { id: 'c46-4', code: 'Máquina 4' },
    ],
  },
  {
    id: 'villa-carolina',
    name: 'Villa Carolina',
    address: 'Sede Villa Carolina',
    machines: [
      { id: 'vc-1', code: 'Máquina 1' },
      { id: 'vc-2', code: 'Máquina 2' },
      { id: 'vc-3', code: 'Máquina 3' },
      { id: 'vc-4', code: 'Máquina 4' },
    ],
  },
];

export const statusLabels: Record<OrderStatus, string> = {
  QUEUED: 'Recibida · esperando prelavado',
  PRE_WASH: 'En prelavado',
  WASHING: 'En lavado',
  DRYING: 'En secado',
  PREPARING: 'Revisión, doblado y empaque',
  READY: 'Lista',
  OUT_FOR_DELIVERY: 'En domicilio',
  DELIVERED: 'Entregada',
  CANCELLED: 'Cancelada',
};

export const statusDescriptions: Record<OrderStatus, string> = {
  QUEUED: 'La ropa fue recibida y está esperando la revisión de prelavado.',
  PRE_WASH: 'La ropa está en prelavado y revisión inicial de manchas o condiciones visibles.',
  WASHING: 'La ropa está dentro del ciclo de lavado.',
  DRYING: 'La ropa está en proceso de secado.',
  PREPARING: 'El equipo está revisando, doblando y empacando la ropa.',
  READY: 'La ropa está lista para recogida o para preparar el domicilio.',
  OUT_FOR_DELIVERY: 'La ropa salió hacia la dirección registrada.',
  DELIVERED: 'Servicio entregado y cerrado.',
  CANCELLED: 'Servicio cancelado o no procesado.',
};

export const orderFlow: OrderStatus[] = [
  'QUEUED',
  'PRE_WASH',
  'WASHING',
  'DRYING',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export const businessHours = {
  weekdays: 'Lunes a sábado de 7:00 a.m. a 7:00 p.m.',
  sundayHoliday: 'Domingos y festivos de 9:00 a.m. a 6:00 p.m.',
  selfServiceLimit: 'Autoservicio recibido hasta las 5:00 p.m.',
};

export function bogotaToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export const dataTreatmentText =
  'Autorizo a La Lavandería & Bakery para tratar los datos necesarios para gestionar esta solicitud, conforme a la política de tratamiento de datos personales disponible en la aplicación.';

export const storageKeys = {
  registerDraft: 'llb_register_draft_v2',
  assistedDraft: 'llb_assisted_draft_v2',
  selfServiceDraft: 'llb_self_service_draft_v2',
  assistedOrders: 'llb_assisted_orders_v2',
  selfServiceReservations: 'llb_self_service_reservations_v2',
  blockedSlots: 'llb_blocked_slots_v2',
  evidence: 'llb_evidence_v2',
};

export function timeSlotOptions(values: string[]) {
  return values.map((value) => {
    const [startLabel, endLabel] = value.split('-');
    return { value, label: `${startLabel} - ${endLabel}` };
  });
}

export function getTimeSlotsForDate(dateValue: string, isHoliday = false) {
  if (!dateValue) return [];
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return [];
  const day = date.getDay();
  const isSundayHoliday = day === 0 || isHoliday;
  const starts = isSundayHoliday ? [9, 11, 13, 15] : [7, 9, 11, 13, 15, 17];
  return timeSlotOptions(starts.map((hour) => {
    const end = hour + 2;
    const startLabel = `${String(hour).padStart(2, '0')}:00`;
    const endLabel = `${String(end).padStart(2, '0')}:00`;
    return `${startLabel}-${endLabel}`;
  }));
}
