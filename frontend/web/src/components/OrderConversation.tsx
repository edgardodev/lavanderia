'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { LaundryOrder } from '@/types';

export function OrderConversation({ order, onChanged }: { order: LaundryOrder; onChanged: () => void }) {
  const [message, setMessage] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = message.trim();
    if (!clean) return;
    setSending(true);
    setError('');
    try {
      await apiFetch(`/admin/orders/${order.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: clean, isInternal }),
      });
      setMessage('');
      setIsInternal(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el mensaje.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-4">
      <div>
        <p className="text-sm font-black text-slate-950">Historial y canal con el cliente</p>
        <p className="mt-1 text-xs text-slate-500">Las notas internas solo las ve el equipo. Los mensajes al cliente también pueden generar una notificación push.</p>
      </div>

      <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3">
        {(order.messages ?? []).map((item) => (
          <div key={item.id} className={`rounded-2xl p-3 text-sm ${item.isInternal ? 'border border-yellowBrand/50 bg-yellowBrand/15' : 'bg-white'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-black text-slate-900">{item.author?.name ?? 'Equipo'}{item.isInternal ? ' · Nota interna' : ''}</p>
              <p className="text-[11px] font-bold text-slate-400">{formatDateTime(item.createdAt)}</p>
            </div>
            <p className="mt-1 whitespace-pre-wrap leading-6 text-slate-600">{item.message}</p>
          </div>
        ))}
        {(order.messages ?? []).length === 0 && <p className="py-4 text-center text-xs font-bold text-slate-400">Todavía no hay mensajes.</p>}
      </div>

      {(order.evidence ?? []).length > 0 && (
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">Evidencias</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(order.evidence ?? []).map((photo) => (
              <figure key={photo.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {photo.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a href={photo.url} target="_blank" rel="noreferrer"><img src={photo.url} alt={photo.description} className="h-24 w-full object-cover" loading="lazy" /></a>
                ) : (
                  <div className="grid h-24 place-items-center bg-slate-100 px-2 text-center text-[10px] font-bold text-slate-400">Vista temporal no disponible</div>
                )}
                <figcaption className="line-clamp-2 px-2 py-2 text-[10px] font-bold text-slate-500">{photo.description}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={send} className="grid gap-3">
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Ej: Detectamos una mancha en la manga izquierda antes del lavado..."
          className="rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-aqua"
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <input type="checkbox" checked={isInternal} onChange={(event) => setIsInternal(event.target.checked)} className="h-4 w-4 accent-aqua" />
            Nota interna (no visible para el cliente)
          </label>
          <button disabled={sending || !message.trim()} className="rounded-full bg-aqua px-4 py-2 text-xs font-black text-white disabled:opacity-50">
            {sending ? 'Guardando...' : isInternal ? 'Guardar nota' : 'Enviar al cliente'}
          </button>
        </div>
        {error && <p className="text-xs font-bold text-rose-700">{error}</p>}
      </form>
    </div>
  );
}
