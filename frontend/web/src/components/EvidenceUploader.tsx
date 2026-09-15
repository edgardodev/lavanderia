'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

const MAX_FILES = 4;
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;
const MAX_DIMENSION = 1600;

async function compressImage(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error(`${file.name}: formato no permitido.`);
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error(`${file.name}: la imagen original supera 12 MB.`);
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('No se pudo preparar la imagen.');
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82));
  if (!blob) throw new Error(`${file.name}: no se pudo comprimir.`);
  if (blob.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${file.name}: sigue siendo demasiado grande después de comprimir.`);
  }
  const stem = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 80) || 'evidencia';
  return new File([blob], `${stem}.webp`, { type: 'image/webp', lastModified: Date.now() });
}

export function EvidenceUploader({ orderId, onUploaded }: { orderId: string; onUploaded?: () => void }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const previews = useMemo(() => files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) })), [files]);

  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);

  async function selectFiles(selected: File[]) {
    setError('');
    setMessage('');
    if (selected.length > MAX_FILES) {
      setError(`Puedes cargar máximo ${MAX_FILES} fotos por envío.`);
      return;
    }
    setProcessing(true);
    try {
      const compressed: File[] = [];
      for (const file of selected) compressed.push(await compressImage(file));
      setFiles(compressed);
      setMessage(`${compressed.length} foto${compressed.length === 1 ? '' : 's'} preparada${compressed.length === 1 ? '' : 's'} para subir.`);
    } catch (err) {
      setFiles([]);
      setError(err instanceof Error ? err.message : 'No se pudieron preparar las imágenes.');
    } finally {
      setProcessing(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    if (!files.length) {
      setError('Selecciona al menos una foto.');
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    files.forEach((file) => form.append('photos', file));
    setUploading(true);
    try {
      await apiFetch(`/admin/orders/${orderId}/evidence`, { method: 'POST', body: form });
      setMessage('Evidencia guardada de forma privada y notificada al usuario.');
      setFiles([]);
      formElement.reset();
      onUploaded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la evidencia.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 grid gap-3 rounded-[1.5rem] border border-aqua/10 bg-aqua/5 p-4">
      <div>
        <p className="text-sm font-black text-slate-900">Evidencia de prendas dañadas o manchadas</p>
        <p className="text-xs leading-5 text-slate-500">Máximo 4 fotos. Se comprimen antes de subir y se almacenan de forma privada; el usuario recibe un acceso temporal autorizado.</p>
      </div>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        disabled={processing || uploading}
        onChange={(event) => void selectFiles(Array.from(event.target.files ?? []))}
        className="rounded-2xl border border-dashed border-aqua/40 bg-white p-3 text-sm disabled:opacity-60"
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
      <input name="description" maxLength={500} placeholder="Descripción: prenda manchada, rota, desteñida..." className="rounded-2xl border border-slate-200 px-3 py-2 text-sm" />
      <button disabled={processing || uploading || files.length === 0} className="rounded-2xl bg-slate-950 px-3 py-2 text-sm font-black text-white disabled:opacity-50">
        {processing ? 'Comprimiendo...' : uploading ? 'Subiendo...' : 'Guardar evidencia y notificar'}
      </button>
      {message && <p className="text-xs font-bold text-emerald-700">{message}</p>}
      {error && <p className="text-xs font-bold text-rose-700">{error}</p>}
    </form>
  );
}
