'use client';

import { useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { appendLocal } from '@/lib/storage';
import { storageKeys } from '@/lib/constants';
import type { EvidenceRecord } from '@/types';

export function EvidenceUploader({ orderId }: { orderId: string }) {
  const [message, setMessage] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const previews = useMemo(() => files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })), [files]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const form = new FormData(event.currentTarget);
    files.forEach((file) => form.append('photos', file));

    try {
      await apiFetch(`/admin/orders/${orderId}/evidence`, { method: 'POST', body: form });
      setMessage('Evidencia subida y enviada al usuario.');
    } catch {
      appendLocal<EvidenceRecord>(storageKeys.evidence, {
        id: `evidence-${Date.now()}`,
        orderId,
        description: String(form.get('description') ?? ''),
        fileNames: files.map((file) => file.name),
        createdAt: new Date().toISOString(),
      });
      setMessage('Modo frontend: evidencia guardada localmente. El backend enviará las fotos al usuario.');
    }

    setFiles([]);
    event.currentTarget.reset();
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 grid gap-3 rounded-[1.5rem] border border-aqua/10 bg-aqua/5 p-4">
      <div>
        <p className="text-sm font-black text-slate-900">Evidencia de prendas dañadas o manchadas</p>
        <p className="text-xs text-slate-500">Carga fotos antes de lavar para dejar soporte visual en el panel del usuario.</p>
      </div>
      <input
        name="photo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
        className="rounded-2xl border border-dashed border-aqua/40 bg-white p-3 text-sm"
      />
      {previews.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {previews.map((preview) => (
            <figure key={preview.url} className="overflow-hidden rounded-2xl border border-white bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.url} alt={preview.name} className="h-24 w-full object-cover" />
              <figcaption className="truncate px-2 py-1 text-[10px] font-bold text-slate-500">{preview.name}</figcaption>
            </figure>
          ))}
        </div>
      )}
      <input name="description" placeholder="Descripción: prenda manchada, rota, desteñida..." className="rounded-2xl border border-slate-200 px-3 py-2 text-sm" />
      <button className="rounded-2xl bg-slate-950 px-3 py-2 text-sm font-black text-white">Guardar evidencia y notificar</button>
      {message && <p className="text-xs font-bold text-slate-600">{message}</p>}
    </form>
  );
}
