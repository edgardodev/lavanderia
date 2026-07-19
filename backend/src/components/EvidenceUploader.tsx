'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';

export function EvidenceUploader({ orderId }: { orderId: string }) {
  const [message, setMessage] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await apiFetch(`/admin/orders/${orderId}/evidence`, { method: 'POST', body: form });
    setMessage('Evidencia subida correctamente.');
    event.currentTarget.reset();
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 grid gap-2 rounded-2xl bg-slate-50 p-3">
      <input name="photo" type="file" accept="image/png,image/jpeg,image/webp" required />
      <input name="description" placeholder="Descripción: prenda manchada, rota, desteñida..." className="rounded-xl border px-3 py-2" />
      <button className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white">Subir evidencia</button>
      {message && <p className="text-xs font-bold text-aqua">{message}</p>}
    </form>
  );
}
