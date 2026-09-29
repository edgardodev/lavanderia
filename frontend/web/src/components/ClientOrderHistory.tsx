'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiBlob, apiFetch } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { statusLabels } from '@/lib/constants';
import type { LaundryOrder, OrderEvidence } from '@/types';

function EvidencePhotoCard({ photo }: { photo: OrderEvidence }) {
  const [src, setSrc] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    setSrc('');
    setLoadError('');
    if (!photo.url) return;

    if (/^https?:\/\//i.test(photo.url)) {
      setSrc(photo.url);
      return;
    }

    let active = true;
    let objectUrl = '';
    apiBlob(photo.url)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch((err) => {
        if (active) setLoadError(err instanceof Error ? err.message : 'No se pudo cargar la foto.');
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.url]);

  return (
    <figure className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <a href={src} target="_blank" rel="noreferrer">
          <img src={src} alt={photo.description} className="h-32 w-full object-cover" loading="lazy" />
        </a>
      ) : (
        <div className="grid h-32 place-items-center bg-slate-100 px-3 text-center text-xs font-bold text-slate-400">
          {loadError || 'Cargando foto...'}
        </div>
      )}
      <figcaption className="p-3 text-xs font-bold leading-5 text-slate-600">{photo.description}</figcaption>
    </figure>
  );
}

export function ClientOrderHistory({ order, onChanged }: { order: LaundryOrder; onChanged: () => void }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [evidence, setEvidence] = useState<OrderEvidence[]>(order.evidence ?? []);
  const [evidenceError, setEvidenceError] = useState('');
  const evidenceKey = useMemo(() => (order.evidence ?? []).map((photo) => photo.id).join(','), [order.evidence]);

  useEffect(() => {
    const metadata = order.evidence ?? [];
    setEvidence(metadata);
    setEvidenceError('');
    if (metadata.length === 0) return;

    let active = true;
    apiFetch<{ evidence: OrderEvidence[] }>(`/client/orders/${order.id}/evidence`)
      .then((data) => {
        if (active) setEvidence(data.evidence);
      })
      .catch((err) => {
        if (active) setEvidenceError(err instanceof Error ? err.message : 'No se pudieron cargar las fotos.');
      });

    return () => {
      active = false;
    };
  }, [order.id, evidenceKey]);

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = message.trim();
    if (!clean) return;
    setSending(true);
    setError('');
    try {
      await apiFetch(`/client/orders/${order.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message: clean }),
      });
      setMessage('');
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar el mensaje.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <h3 className="text-lg font-black text-slate-950">Historial del servicio</h3>
        <div className="mt-4 grid gap-3">
          {(order.statusHistory ?? []).map((item) => (
            <div key={item.id} className="border-l-2 border-aqua/30 pl-4">
              <p className="text-sm font-black text-aqua">
                {item.status === 'QUEUED' && order.paymentStatus !== 'APPROVED'
                  ? order.pricingReady === false
                    ? 'Solicitud creada · pendiente de cotización'
                    : 'Solicitud creada · pendiente de pago'
                  : statusLabels[item.status]}
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{item.message}</p>
              <p className="mt-1 text-[11px] font-bold text-slate-400">{formatDateTime(item.createdAt)}</p>
            </div>
          ))}
          {(order.statusHistory ?? []).length === 0 && <p className="text-sm font-bold text-slate-400">Todavía no hay movimientos registrados.</p>}
        </div>
      </div>

      {evidence.length > 0 && (
        <div>
          <h3 className="text-lg font-black text-slate-950">Fotos de evidencia</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">Los enlaces de las fotos son temporales y solo se generan después de validar tu sesión.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {evidence.map((photo) => <EvidencePhotoCard key={photo.id} photo={photo} />)}
          </div>
          {evidenceError && <p className="mt-2 text-xs font-bold text-amber-700">{evidenceError}</p>}
        </div>
      )}

      <div>
        <h3 className="text-lg font-black text-slate-950">Mensajes del servicio</h3>
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3">
          {(order.messages ?? []).map((item) => (
            <div key={item.id} className="rounded-2xl bg-white p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-black text-slate-900">{item.author?.role === 'ADMIN' ? 'Equipo de lavandería' : 'Tú'}</p>
                <p className="text-[11px] font-bold text-slate-400">{formatDateTime(item.createdAt)}</p>
              </div>
              <p className="mt-1 whitespace-pre-wrap leading-6 text-slate-600">{item.message}</p>
            </div>
          ))}
          {(order.messages ?? []).length === 0 && <p className="py-3 text-center text-xs font-bold text-slate-400">Sin mensajes por ahora.</p>}
        </div>
        <form onSubmit={send} className="mt-3 flex gap-2">
          <input
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            maxLength={1000}
            placeholder="Escribe una pregunta sobre este servicio"
            className="min-w-0 flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-aqua"
          />
          <button disabled={sending || !message.trim()} className="rounded-2xl bg-aqua px-4 py-2 text-sm font-black text-white disabled:opacity-50">
            {sending ? 'Enviando...' : 'Enviar'}
          </button>
        </form>
        {error && <p className="mt-2 text-xs font-bold text-rose-700">{error}</p>}
      </div>
    </div>
  );
}
