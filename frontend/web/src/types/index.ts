export type Role = 'CLIENT' | 'ADMIN';
export type CycleType = 'WASH' | 'DRY' | 'FULL';
export type PickupType = 'STORE' | 'DELIVERY';
export type OrderStatus = 'QUEUED' | 'PRE_WASH' | 'WASHING' | 'DRYING' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
  machines: { id: string; code: string }[];
}

export interface OrderStatusHistoryItem {
  id: string;
  status: OrderStatus;
  message: string;
  createdAt: string;
}

export interface OrderMessage {
  id: string;
  message: string;
  isInternal: boolean;
  author?: { name: string; role: Role };
  createdAt: string;
}

export interface OrderEvidence {
  id: string;
  description: string;
  mimeType: string;
  sizeBytes: number;
  url?: string;
  createdAt: string;
}

export interface LaundryOrder {
  id: string;
  branchId: string;
  branchName?: string;
  cycleType: CycleType;
  pickupType: PickupType;
  address?: string;
  pieces?: number;
  stainService?: boolean;
  notes?: string;
  status: OrderStatus;
  amountCents?: number;
  paymentStatus?: 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | null;
  client?: { id?: string; name: string; email: string; phone?: string };
  statusHistory?: OrderStatusHistoryItem[];
  messages?: OrderMessage[];
  evidence?: OrderEvidence[];
  createdAt: string;
  updatedAt?: string;
}

export interface Reservation {
  id: string;
  branchId: string;
  branchName?: string;
  machineId: string;
  machineCode?: string;
  cycleType: CycleType;
  status?: 'PENDING_PAYMENT' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED';
  paymentStatus?: 'PENDING' | 'APPROVED' | 'DECLINED' | 'VOIDED' | 'ERROR' | null;
  date: string;
  slot: string;
  notes?: string;
  client?: { name: string; email: string; phone?: string };
  createdAt: string;
}

export interface BlockedSlot {
  id: string;
  branchId: string;
  machineId: string;
  machineCode?: string;
  branchName?: string;
  date: string;
  slot: string;
  reason: string;
  createdAt: string;
}

export interface AdminClientSummary {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
  lastActivityAt: string;
  assistedCount: number;
  reservationCount: number;
  activeAssistedCount: number;
  activeOrders: Array<{
    id: string;
    branchId?: string;
    status: OrderStatus;
    pickupType: PickupType;
    createdAt: string;
  }>;
}
