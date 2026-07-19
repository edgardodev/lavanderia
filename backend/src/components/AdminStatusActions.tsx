'use client';

import { apiFetch } from '@/lib/api';
import { statusLabels } from '@/lib/constants';
import type { OrderStatus } from '@/types';

const statuses: OrderStatus[] = ['QUEUED', 'WASHING', 'DRYING', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export function AdminStatusActions({ orderId, onUpdated }: { orderId: string; onUpdated?: () => void }) {
  async function update(status: OrderStatus) {
    await apiFetch(`/admin/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
    onUpdated?.();
  }

  return (
    <div className="flex flex-wrap gap-2">
      {statuses.map((status) => (
        <button key={status} onClick={() => update(status)} className="rounded-full border border-aqua/30 px-3 py-2 text-xs font-bold hover:bg-aqua hover:text-white">
          {statusLabels[status]}
        </button>
      ))}
    </div>
  );
}
