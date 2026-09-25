'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { ClientOrderHistory } from '@/components/ClientOrderHistory';
import { PriceSummary } from '@/components/PriceSummary';
import { StatusBadge } from '@/components/StatusBadge';
import { StatusTimeline } from '@/components/StatusTimeline';
import { WompiCheckoutButton } from '@/components/WompiCheckoutButton';
import { Button, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { branchSeed, businessHours, cycleLabels, doneForYouPrices } from '@/lib/constants';
import { registerPushNotifications } from '@/lib/fcm';
import { formatCOP, formatDateTime } from '@/lib/format';
import type { Branch, CycleType, LaundryOrder, PickupType } from '@/types';

type AssistedDraft = {
  branchId: string;
  cycleType: CycleType;
  pickupType: PickupType;
  address: string;
  pieces: string;
  notes: string;
  stainService: boolean;
};

const initialDraft: AssistedDraft = {
  branchId: branchSeed[0]?.id ?? '',
  cycleType: 'FULL',
  pickupType: 'STORE',
  address: '',
  pieces: '',
  notes: '',
  stainService: false,
};

function branchName(order: LaundryOrder) {
  return order.branchName ?? branchSeed.find((branch) => branch.id === order.branchId)?.name ?? 'Sede pendiente';
}

export default function AssistedPage() {
  const [branches, setBranches] = useState<Branch[]>(branchSeed);
  const [draft, setDraft] = useState<AssistedDraft>(initialDraft);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<LaundryOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState('');
  const requestKeyRef = useRef<string | null>(null);

  useEffect(() => {
    apiFetch<{ branches: Branch[] }>('/branches')
      .then((data) => {
        if (!data.branches.length) return;
        setBranches(data.branches);
        setDraft((current) => ({
          ...current,
          branchId: data.branches.some((branch) => branch.id === current.branchId) ? current.branchId : data.branches[0].id,
        }));
      })
      .catch(() => undefined);
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const data = await apiFetch<{ orders: LaundryOrder[] }>('/client/orders');
      setOrders(data.orders);
      setSelectedOrderId((current) => current ?? data.orders.find((order) => !['DELIVERED', 'CANCELLED'].includes(order.status))?.id ?? data.orders[0]?.id ?? null);
      setHistoryError('');
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : 'No se pudo cargar el seguimiento de tus servicios.');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void registerPushNotifications().catch(() => undefined);
    void loadOrders();
    const timer = window.setInterval(() => void loadOrders(), 20000);
    const onFocus = () => void loadOrders();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [loadOrders]);

  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? orders.find((order) => !['DELIVERED', 'CANCELLED'].includes(order.status)) ?? orders[0],
    [orders, selectedOrderId],
  );

  const createdOrder = useMemo(
    () => orders.find((order) => order.id === createdId),
    [createdId, orders],
  );

  function update<K extends keyof AssistedDraft>(key: K, value: AssistedDraft[K]) {
    requestKeyRef.current = null;
    setCreatedId(null);
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setMessage('');
    setError('');
    setSubmitting(true);

    const key = requestKeyRef.current ?? crypto.randomUUID();
    requestKeyRef.current = key;

    try {
      const data = await apiFetch<{ order: LaundryOrder; idempotentReplay?: boolean }>('/orders', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify({
          branchId: draft.branchId,
          cycleType: draft.cycleType,
          pickupType: draft.pickupType,
          address: draft.pickupType === 'DELIVERY' ? draft.address : undefined,
          pieces: Number(draft.pieces || 0),
          notes: draft.notes,
          stainService: draft.stainService,
        }),
      });
      requestKeyRef.current = null;
      setCreatedId(data.order.id);
      setSelectedOrderId(data.order.id);
      setOrders((current) => [data.order, ...current.filter((order) => order.id !== data.order.id)]);
      setMessage(data.idempotentReplay
        ? 'La solicitud ya había sido recibida. Recuperamos el mismo servicio sin duplicarlo.'
        : 'Servicio creado. Continúa con el pago; el seguimiento de tu ropa ya está disponible en esta sección.');
      setDraft((current) => ({ ...initialDraft, branchId: current.branchId }));
      void loadOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el servicio. Puedes reintentar: no se duplicará la solicitud.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[1fr_0.72fr] lg:items-start">
        <Card>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-aqua">Servicio asistido</p>
          <h1 className="mt-3 font-title text-5xl text-aqua">Lo hacemos por ti</h1>
          <p className="mt-3 leading-7 text-slate-600">Agenda lavado, secado o ciclo completo. Los datos de esta solicitud se envían al servidor al confirmar y no se guardan como borrador permanente en el navegador.</p>
          <form onSubmit={onSubmit} className="mt-8 grid gap-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Sede">
                <Select value={draft.branchId} onChange={(event) => update('branchId', event.target.value)} required>
                  {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
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
                <Input value={draft.pieces} onChange={(event) => update('pieces', event.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric" placeholder="Ej: 30" maxLength={3} />
              </Field>
            </div>

            {draft.pickupType === 'DELIVERY' && (
              <Field label="Dirección de domicilio" hint="Las tarifas no incluyen el valor del domicilio cuando este aplique.">
                <Input value={draft.address} onChange={(event) => update('address', event.target.value)} placeholder="Dirección, barrio, apartamento, referencia" required maxLength={250} autoComplete="street-address" />
              </Field>
            )}

            <label className="flex items-start gap-3 rounded-3xl border border-aqua/15 bg-slate-50 p-4">
              <input type="checkbox" checked={draft.stainService} onChange={(event) => update('stainService', event.target.checked)} className="mt-1 h-5 w-5 accent-aqua" />
              <span className="text-sm leading-6 text-slate-700"><strong>Solicitar revisión de desmanche/despercude.</strong> El equipo confirma el valor antes de aplicar un cargo adicional.</span>
            </label>

            <Field label="Indicaciones o sugerencias">
              <Textarea value={draft.notes} onChange={(event) => update('notes', event.target.value)} placeholder="Ej: separar ropa delicada, prenda manchada, no usar blanqueador..." maxLength={500} />
            </Field>

            <div className="grid gap-3 rounded-3xl bg-aqua/5 p-4 text-sm text-slate-600">
              <p className="font-black text-slate-950">Antes de confirmar</p>
              <p>{businessHours.weekdays}. {businessHours.sundayHoliday}.</p>
              <p>Revisa sede, modalidad, prendas y valor antes de abrir el pago. Los cargos adicionales deben ser informados antes de cobrarse.</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={submitting}>{submitting ? 'Creando...' : 'Crear servicio'}</Button>
              {createdId && createdOrder?.pricingReady !== false && <WompiCheckoutButton type="order" id={createdId} />}
              {createdId && createdOrder?.pricingReady === false && (
                <p className="text-sm font-bold text-amber-700">
                  La sede debe confirmar primero los valores variables solicitados. Cuando estén listos podrás pagar desde “Mis servicios asistidos”.
                </p>
              )}
            </div>
            {message && <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{message}</p>}
            {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p>}
          </form>
        </Card>

        <div className="grid gap-6">
          <PriceSummary mode="ASSISTED" cycleType={draft.cycleType} includeStainService={draft.stainService} />
        </div>

        <section className="grid gap-6 lg:col-span-2 lg:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <h2 className="text-2xl font-black text-slate-950">Seguimiento de ropa</h2>
            <p className="mt-2 text-sm text-slate-500">Aquí ves el avance solamente de los servicios que entregas al equipo para que nosotros hagamos el proceso.</p>
            {selectedOrder?.paymentStatus === 'APPROVED' ? (
              <div className="mt-6">
                <StatusTimeline currentStatus={selectedOrder.status} pickupType={selectedOrder.pickupType} />
              </div>
            ) : selectedOrder ? (
              <p className="mt-6 rounded-3xl bg-amber-50 p-4 text-sm font-bold text-amber-800">
                {selectedOrder.pricingReady === false
                  ? 'La sede está confirmando los valores de domicilio y/o desmanche. El botón de pago se habilitará cuando el total esté definido.'
                  : selectedOrder.paymentStatus && selectedOrder.paymentStatus !== 'PENDING'
                    ? 'El pago no está aprobado. El proceso de lavandería no comenzará hasta tener un pago aprobado.'
                    : 'Tu solicitud está creada y pendiente de pago. El seguimiento de la ropa comenzará cuando el pago sea aprobado.'}
              </p>
            ) : (
              <p className="mt-6 rounded-3xl bg-slate-50 p-4 text-sm font-bold text-slate-500">Cuando crees tu primer servicio “Lo hacemos por ti”, aquí aparecerá su seguimiento.</p>
            )}
          </Card>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Mis servicios asistidos</h2>
                <p className="mt-1 text-sm text-slate-500">Historial y novedades de los servicios de esta modalidad.</p>
              </div>
              {orders.length > 1 && (
                <Select value={selectedOrder?.id ?? ''} onChange={(event) => setSelectedOrderId(event.target.value)} className="max-w-xs">
                  {orders.map((order) => <option key={order.id} value={order.id}>{branchName(order)} · {formatDateTime(order.createdAt)}</option>)}
                </Select>
              )}
            </div>

            {historyError && <p className="mt-5 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{historyError}</p>}
            {historyLoading ? (
              <p className="mt-6 text-sm font-bold text-slate-500">Cargando servicios...</p>
            ) : selectedOrder ? (
              <div className="mt-6 grid gap-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-slate-50 p-4">
                  <div>
                    <p className="font-black text-slate-950">{branchName(selectedOrder)} · {cycleLabels[selectedOrder.cycleType]}</p>
                    <p className="mt-1 text-sm text-slate-500">{selectedOrder.pickupType === 'DELIVERY' ? 'Domicilio' : 'Recoge en sede'}</p>
                  </div>
                  {selectedOrder.paymentStatus === 'APPROVED' ? (
                    <StatusBadge status={selectedOrder.status} />
                  ) : (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
                      {selectedOrder.pricingReady === false
                        ? 'Pendiente de cotización'
                        : selectedOrder.paymentStatus && selectedOrder.paymentStatus !== 'PENDING'
                          ? 'Pago no aprobado'
                          : 'Pendiente de pago'}
                    </span>
                  )}
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm">
                  <p className="font-black text-slate-950">Detalle del valor</p>
                  <div className="mt-3 grid gap-2 text-slate-600">
                    <div className="flex justify-between gap-3">
                      <span>Servicio base</span>
                      <strong>{formatCOP((selectedOrder.baseAmountCents ?? selectedOrder.amountCents ?? 0) / 100)}</strong>
                    </div>
                    {selectedOrder.pickupType === 'DELIVERY' && (
                      <div className="flex justify-between gap-3">
                        <span>Domicilio</span>
                        <strong>{selectedOrder.deliveryFeeCents == null ? 'Pendiente' : formatCOP(selectedOrder.deliveryFeeCents / 100)}</strong>
                      </div>
                    )}
                    {selectedOrder.stainService && (
                      <div className="flex justify-between gap-3">
                        <span>Desmanche/despercude</span>
                        <strong>{selectedOrder.stainFeeCents == null ? 'Pendiente' : formatCOP(selectedOrder.stainFeeCents / 100)}</strong>
                      </div>
                    )}
                    <div className="mt-1 flex justify-between gap-3 border-t border-slate-200 pt-2 text-slate-950">
                      <span className="font-black">Total</span>
                      <strong className="text-aqua">{formatCOP((selectedOrder.amountCents ?? 0) / 100)}</strong>
                    </div>
                  </div>
                </div>
                {selectedOrder.paymentStatus !== 'APPROVED' && selectedOrder.status !== 'CANCELLED' && (
                  selectedOrder.pricingReady === false ? (
                    <div className="rounded-3xl border border-yellowBrand/60 bg-yellowBrand/15 p-4 text-sm font-bold text-slate-700">
                      La persona encargada de la sede debe cargar los valores variables antes de habilitar el pago.
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-yellowBrand/60 bg-yellowBrand/15 p-4">
                      <p className="mb-3 text-sm font-black text-slate-900">Pago pendiente</p>
                      <WompiCheckoutButton type="order" id={selectedOrder.id} />
                    </div>
                  )
                )}
                <ClientOrderHistory order={selectedOrder} onChanged={() => void loadOrders()} />
              </div>
            ) : (
              <p className="mt-6 rounded-3xl bg-slate-50 p-4 text-sm font-bold text-slate-500">Aún no tienes servicios asistidos.</p>
            )}
          </Card>
        </section>
      </main>
    </>
  );
}
