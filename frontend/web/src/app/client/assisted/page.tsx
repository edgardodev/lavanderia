'use client';

import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { DataTreatmentConsent } from '@/components/DataTreatmentConsent';
import { PriceSummary } from '@/components/PriceSummary';
import { WompiCheckoutButton } from '@/components/WompiCheckoutButton';
import { Button, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { branchSeed, businessHours, cycleLabels, doneForYouPrices, storageKeys } from '@/lib/constants';
import { appendLocal, clearLocal, readLocal, writeLocal } from '@/lib/storage';
import type { CycleType, LaundryOrder, PickupType } from '@/types';

type AssistedDraft = {
  branchId: string;
  cycleType: CycleType;
  pickupType: PickupType;
  address: string;
  pieces: string;
  notes: string;
  stainService: boolean;
  consent: boolean;
};

const initialDraft: AssistedDraft = {
  branchId: branchSeed[0]?.id ?? '',
  cycleType: 'FULL',
  pickupType: 'STORE',
  address: '',
  pieces: '',
  notes: '',
  stainService: false,
  consent: false,
};

export default function AssistedPage() {
  const [draft, setDraft] = useState<AssistedDraft>(initialDraft);
  const [message, setMessage] = useState('');
  const [createdId, setCreatedId] = useState<string | null>(null);

  useEffect(() => {
    setDraft(readLocal<AssistedDraft>(storageKeys.assistedDraft, initialDraft));
  }, []);

  useEffect(() => {
    writeLocal(storageKeys.assistedDraft, draft);
  }, [draft]);

  function update<K extends keyof AssistedDraft>(key: K, value: AssistedDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    const payload = {
      branchId: draft.branchId,
      cycleType: draft.cycleType,
      pickupType: draft.pickupType,
      address: draft.pickupType === 'DELIVERY' ? draft.address : undefined,
      pieces: Number(draft.pieces || 0),
      notes: draft.notes,
      stainService: draft.stainService,
      status: 'QUEUED' as const,
    };

    try {
      const data = await apiFetch<{ order: LaundryOrder }>('/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setCreatedId(data.order.id);
      setMessage('Servicio creado. Recibirás notificaciones cuando el administrador actualice el estado.');
    } catch {
      const local = appendLocal<LaundryOrder>(storageKeys.assistedOrders, {
        ...payload,
        id: `order-${Date.now()}`,
        createdAt: new Date().toISOString(),
      });
      setCreatedId(local.id);
      setMessage('Modo frontend: servicio guardado localmente. La lógica real se conectará al backend.');
    }

    clearLocal(storageKeys.assistedDraft);
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[1fr_0.72fr] lg:items-start">
        <Card>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-aqua">Servicio asistido</p>
          <h1 className="mt-3 font-title text-5xl text-aqua">Lo hacemos por ti</h1>
          <p className="mt-3 leading-7 text-slate-600">Agenda lavado, secado o ciclo completo. Puedes indicar dirección, cantidad de piezas, manchas y cualquier recomendación para el equipo.</p>
          <form onSubmit={onSubmit} className="mt-8 grid gap-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Sede">
                <Select value={draft.branchId} onChange={(event) => update('branchId', event.target.value)} required>
                  {branchSeed.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </Select>
              </Field>
              <Field label="Tipo de ciclo">
                <Select value={draft.cycleType} onChange={(event) => update('cycleType', event.target.value as CycleType)} required>
                  {Object.entries(doneForYouPrices).map(([type, price]) => (
                    <option key={type} value={type}>{cycleLabels[type as CycleType]} - ${price.toLocaleString('es-CO')}</option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Entrega / recogida">
                <Select value={draft.pickupType} onChange={(event) => update('pickupType', event.target.value as PickupType)}>
                  <option value="STORE">Recojo en tienda</option>
                  <option value="DELIVERY">Necesito domicilio</option>
                </Select>
              </Field>
              <Field label="Cantidad de piezas" hint="Aproximado para preparar la operación.">
                <Input value={draft.pieces} onChange={(event) => update('pieces', event.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="Ej: 30" />
              </Field>
            </div>

            {draft.pickupType === 'DELIVERY' && (
              <Field label="Dirección de domicilio" hint="Las tarifas no incluyen el valor del domicilio.">
                <Input value={draft.address} onChange={(event) => update('address', event.target.value)} placeholder="Dirección, barrio, apartamento, referencia" required />
              </Field>
            )}

            <label className="flex items-start gap-3 rounded-3xl border border-aqua/15 bg-slate-50 p-4">
              <input type="checkbox" checked={draft.stainService} onChange={(event) => update('stainService', event.target.checked)} className="mt-1 h-5 w-5 accent-aqua" />
              <span className="text-sm leading-6 text-slate-700"><strong>Solicitar revisión de desmanche/despercude.</strong> El equipo confirma el valor por prenda entre $10.000 y $20.000 según la mancha.</span>
            </label>

            <Field label="Indicaciones o sugerencias">
              <Textarea value={draft.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Ej: separar ropa delicada, prenda manchada, no usar blanqueador..." />
            </Field>

            <DataTreatmentConsent checked={draft.consent} onChange={(checked) => update('consent', checked)} />

            <div className="grid gap-3 rounded-3xl bg-aqua/5 p-4 text-sm text-slate-600">
              <p className="font-black text-slate-950">Recordatorio operativo</p>
              <p>{businessHours.weekdays}. {businessHours.sundayHoliday}.</p>
              <p>Edredones y cobijas se cotizan según volumen y no cuentan como prendas de uso diario.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!draft.consent}>Agendar servicio</Button>
              {createdId && <WompiCheckoutButton type="order" id={createdId} />}
            </div>
            {message && <p className="rounded-2xl bg-yellowBrand/40 px-4 py-3 text-sm font-black text-slate-800">{message}</p>}
          </form>
        </Card>

        <div className="grid gap-6">
          <PriceSummary mode="ASSISTED" cycleType={draft.cycleType} includeStainService={draft.stainService} />
          <Card className="bg-aqua text-white">
            <h2 className="text-2xl font-black text-yellowBrand">Notificaciones del estado</h2>
            <p className="mt-3 text-sm leading-6 text-white/85">Cuando el admin actualice la orden, el usuario recibirá mensajes como: su ropa está en espera de lavado, se está lavando, se está secando, se está doblando, ya puede venir por su ropa o su ropa va en camino.</p>
          </Card>
        </div>
      </main>
    </>
  );
}
