'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { statusLabels } from '@/lib/constants';
import type { OrderStatus } from '@/types';

const statuses: OrderStatus[] = ['QUEUED', 'WASHING', 'DRYING', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED'];

export function AdminStatusActions({ orderId, onUpdated }: { orderId: string; onUpdated?: (status?: OrderStatus) => void }) {
  const [loadingStatus, setLoadingStatus] = useState<OrderStatus | null>(null);
  const [message, setMessage] = useState('');

  async function update(status: OrderStatus) {
    setLoadingStatus(status);
    setMessage('');
    try {
      await apiFetch(`/admin/orders/${orderId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      setMessage('Estado actualizado y notificación enviada.');
    } catch {
      setMessage('Modo frontend: estado simulado. Se conectará al backend para enviar push real.');
    } finally {
      setLoadingStatus(null);
      onUpdated?.(status);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {statuses.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => update(status)}
            disabled={loadingStatus === status}
            className="rounded-full border border-aqua/30 px-3 py-2 text-xs font-black text-aqua transition hover:bg-aqua hover:text-white disabled:opacity-60"
          >
            {loadingStatus === status ? 'Enviando...' : statusLabels[status]}
          </button>
        ))}
      </div>
      {message && <p className="text-xs font-bold text-slate-500">{message}</p>}
    </div>
  );
}
