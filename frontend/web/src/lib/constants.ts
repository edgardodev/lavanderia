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
    name: 'Cra 46',
    address: 'Sede Cra 46',
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
  QUEUED: 'En espera de lavado',
  WASHING: 'Su ropa se está lavando',
  DRYING: 'Su ropa se está secando',
  PREPARING: 'Su ropa se está doblando',
  READY: 'Ya puede venir por su ropa',
  OUT_FOR_DELIVERY: 'Su ropa va en camino',
  DELIVERED: 'Entregada',
  CANCELLED: 'Cancelada',
};

export const statusDescriptions: Record<OrderStatus, string> = {
  QUEUED: 'Orden recibida y priorizada por hora de ingreso.',
  WASHING: 'La ropa ya está dentro del ciclo de lavado.',
  DRYING: 'La ropa pasó a secado.',
  PREPARING: 'El equipo está revisando, doblando y empacando.',
  READY: 'Pedido listo para recoger en sede.',
  OUT_FOR_DELIVERY: 'El domiciliario ya salió hacia la dirección registrada.',
  DELIVERED: 'Servicio cerrado satisfactoriamente.',
  CANCELLED: 'Servicio cancelado o no procesado.',
};

export const orderFlow: OrderStatus[] = ['QUEUED', 'WASHING', 'DRYING', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'];

export const adminProfiles = [
  { id: 'admin-01', label: 'Administrador 01', scope: 'Operación general' },
  { id: 'admin-02', label: 'Administrador 02', scope: 'Sede Universidad Metropolitana' },
  { id: 'admin-03', label: 'Administrador 03', scope: 'Sede Cra 46' },
  { id: 'admin-04', label: 'Administrador 04', scope: 'Sede Villa Carolina' },
  { id: 'admin-05', label: 'Administrador 05', scope: 'Auditoría y soporte' },
];

export const businessHours = {
  weekdays: 'Lunes a sábado de 7:00 a.m. a 7:00 p.m.',
  sundayHoliday: 'Domingos y festivos de 9:00 a.m. a 6:00 p.m.',
  selfServiceLimit: 'Autoservicio recibido hasta las 5:00 p.m.',
};

export const dataTreatmentText =
  'Autorizo a La Lavandería & Bakery para recolectar, almacenar, usar y consultar mis datos personales con la finalidad de gestionar reservas, domicilios, pagos, notificaciones del servicio y soporte al cliente, conforme a la Ley 1581 de 2012, el Decreto 1377 de 2013 y la política de tratamiento de datos de la empresa.';

export const storageKeys = {
  registerDraft: 'llb_register_draft_v2',
  assistedDraft: 'llb_assisted_draft_v2',
  selfServiceDraft: 'llb_self_service_draft_v2',
  assistedOrders: 'llb_assisted_orders_v2',
  selfServiceReservations: 'llb_self_service_reservations_v2',
  blockedSlots: 'llb_blocked_slots_v2',
  evidence: 'llb_evidence_v2',
};

export function getTimeSlotsForDate(dateValue: string) {
  if (!dateValue) return [];
  const date = new Date(`${dateValue}T12:00:00`);
  if (Number.isNaN(date.getTime())) return [];
  const day = date.getDay();
  const isSunday = day === 0;
  const starts = isSunday ? [9, 11, 13, 15] : [7, 9, 11, 13, 15, 17];
  return starts.map((hour) => {
    const end = hour + 2;
    const startLabel = `${String(hour).padStart(2, '0')}:00`;
    const endLabel = `${String(end).padStart(2, '0')}:00`;
    return {
      value: `${startLabel}-${endLabel}`,
      label: `${startLabel} - ${endLabel}`,
    };
  });
}
