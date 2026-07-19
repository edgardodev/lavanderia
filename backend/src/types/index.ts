export type Role = 'CLIENT' | 'ADMIN';
export type CycleType = 'WASH' | 'DRY' | 'FULL';
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
