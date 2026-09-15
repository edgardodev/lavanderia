'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { statusLabels } from '@/lib/constants';
import type { OrderStatus } from '@/types';

const statuses: OrderStatus[] = [
  'QUEUED',
  'PRE_WASH',
  'WASHING',
  'DRYING',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
];

export function AdminStatusActions({
  orderId,
  currentStatus,
  pickupType,
  onUpdated,
}: {
  orderId: string;
  currentStatus?: OrderStatus;
  pickupType?: 'STORE' | 'DELIVERY';
  onUpdated?: (status?: OrderStatus) => void;
}) {
  const [loadingStatus, setLoadingStatus] = useState<OrderStatus | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function update(status: OrderStatus) {
    if (status === currentStatus) return;
    setLoadingStatus(status);
    setMessage('');
    setError('');
    try {
      const data = await apiFetch<{ notificationSent?: boolean }>(`/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      setMessage(data.notificationSent ? 'Estado actualizado y push enviado.' : 'Estado actualizado. El cliente lo verá en su panel.');
      onUpdated?.(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el estado.');
    } finally {
      setLoadingStatus(null);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {statuses.map((status) => {
          const hiddenForPickup = pickupType === 'STORE' && status === 'OUT_FOR_DELIVERY';
          if (hiddenForPickup) return null;
          const active = currentStatus === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => void update(status)}
              disabled={Boolean(loadingStatus) || active}
              className={`rounded-full border px-3 py-2 text-xs font-black transition disabled:cursor-not-allowed ${
                active
                  ? 'border-aqua bg-aqua text-white'
                  : 'border-aqua/30 text-aqua hover:bg-aqua hover:text-white disabled:opacity-50'
              }`}
            >
              {loadingStatus === status ? 'Actualizando...' : statusLabels[status]}
            </button>
          );
        })}
      </div>
      {message && <p className="text-xs font-bold text-emerald-700">{message}</p>}
      {error && <p className="text-xs font-bold text-rose-700">{error}</p>}
    </div>
  );
}
