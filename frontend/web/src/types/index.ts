export type Role = 'CLIENT' | 'ADMIN';
export type CycleType = 'WASH' | 'DRY' | 'FULL';
export type PickupType = 'STORE' | 'DELIVERY';
export type OrderStatus = 'QUEUED' | 'WASHING' | 'DRYING' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

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

export interface LaundryOrder {
  id: string;
  branchId: string;
  cycleType: CycleType;
  pickupType: PickupType;
  address?: string;
  pieces?: number;
  notes?: string;
  status: OrderStatus;
  client?: { name: string; email: string; phone?: string };
  createdAt: string;
}

export interface Reservation {
  id: string;
  branchId: string;
  machineId: string;
  cycleType: CycleType;
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
  date: string;
  slot: string;
  reason: string;
  createdAt: string;
}

export interface EvidenceRecord {
  id: string;
  orderId: string;
  description: string;
  fileNames: string[];
  createdAt: string;
}
