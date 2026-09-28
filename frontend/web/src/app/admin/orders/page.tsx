'use client';

import { useCallback, useEffect, useState } from 'react';
import { AdminDashboardLink } from '@/components/AdminDashboardLink';
import { AppHeader } from '@/components/AppHeader';
import { AdminStatusActions } from '@/components/AdminStatusActions';
import { BranchTabs } from '@/components/BranchTabs';
import { EvidenceUploader } from '@/components/EvidenceUploader';
import { OrderConversation } from '@/components/OrderConversation';
import { OrderPricingEditor } from '@/components/OrderPricingEditor';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, Field, Input, Select } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { branchSeed, cycleLabels, statusLabels } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import type { LaundryOrder, OrderStatus } from '@/types';

function branchName(order: LaundryOrder) {
  return order.branchName ?? branchSeed.find((branch) => branch.id === order.branchId)?.name ?? 'Sede pendiente';
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<LaundryOrder[]>([]);
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (branchFilter !== 'all') params.set('branchId', branchFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const data = await apiFetch<{ orders: LaundryOrder[]; truncated?: boolean }>(`/admin/orders?${params.toString()}`);
      setOrders(data.orders);
      setTruncated(Boolean(data.truncated));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las órdenes.');
    } finally {
      setLoading(false);
    }
  }, [branchFilter, statusFilter, debouncedSearch]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const client = params.get('client');
    if (client) setSearch(client.slice(0, 120));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    void load();
    const refreshIfVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const timer = window.setInterval(refreshIfVisible, 5 * 60 * 1000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  return (
    <>
      <AppHeader />
      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-12">
        <AdminDashboardLink />

        <section>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-aqua">Administrador</p>
          <h1 className="mt-3 font-title text-5xl text-aqua">Órdenes “Lo hacemos por ti”</h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            Control real de estados, notificaciones, conversación e imágenes de evidencia. Esta vista no simula operaciones locales.
          </p>
        </section>

        <Card className="grid gap-5">
          <BranchTabs value={branchFilter} onChange={setBranchFilter} />
          <div className="grid gap-4 md:grid-cols-[1fr_240px]">
            <Field label="Buscar cliente">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, correo o celular" />
            </Field>
            <Field label="Estado">
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as OrderStatus | 'all')}>
                <option value="all">Todos</option>
                {Object.entries(statusLabels).map(([status, label]) => <option key={status} value={status}>{label}</option>)}
              </Select>
            </Field>
          </div>
          {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p>}
          {truncated && <p className="text-xs font-bold text-amber-700">Hay más resultados. Usa sede, estado o búsqueda para acotar la consulta.</p>}
        </Card>

        {loading && <Card><p className="text-center font-bold text-slate-500">Cargando órdenes...</p></Card>}

        <section className="grid gap-5">
          {orders.map((order) => (
            <Card key={order.id}>
              <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black text-slate-950">{order.client?.name ?? 'Cliente sin nombre'}</h2>
                      <p className="mt-1 text-sm text-slate-600">{order.client?.email ?? 'Sin correo'} · {order.client?.phone ?? 'Sin celular'}</p>
                      <p className="mt-1 text-sm font-bold text-aqua">{branchName(order)} · {cycleLabels[order.cycleType]}</p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="mt-5 grid gap-2 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
                    <p><strong>Ingreso:</strong> {formatDateTime(order.createdAt)}</p>
                    <p><strong>Tipo:</strong> {order.pickupType === 'DELIVERY' ? `Domicilio · ${order.address ?? 'Dirección pendiente'}` : 'Recoge en tienda'}</p>
                    <p><strong>Piezas:</strong> {order.pieces ?? 'Sin dato'}</p>
                    <p><strong>Manchas:</strong> {order.stainService ? 'Servicio/revisión de manchas solicitado' : 'No solicitado'}</p>
                    <p><strong>Pago:</strong> {order.paymentStatus ?? 'Sin intento de pago'}</p>
                    <p><strong>Valor base:</strong> {((order.baseAmountCents ?? order.amountCents ?? 0) / 100).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</p>
                    {order.pickupType === 'DELIVERY' && (
                      <p><strong>Domicilio:</strong> {order.deliveryFeeCents == null ? 'Pendiente por definir' : (order.deliveryFeeCents / 100).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</p>
                    )}
                    {order.stainService && (
                      <p><strong>Desmanche/despercude:</strong> {order.stainFeeCents == null ? 'Pendiente por definir' : (order.stainFeeCents / 100).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</p>
                    )}
                    <p><strong>Total:</strong> {((order.amountCents ?? 0) / 100).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</p>
                    <p><strong>Notas:</strong> {order.notes || 'Sin notas'}</p>
                  </div>

                  {(order.statusHistory ?? []).length > 0 && (
                    <div className="mt-4 rounded-3xl border border-slate-200 p-4">
                      <p className="text-sm font-black text-slate-950">Línea de tiempo</p>
                      <div className="mt-3 grid gap-3">
                        {(order.statusHistory ?? []).map((item) => (
                          <div key={item.id} className="border-l-2 border-aqua/30 pl-3">
                            <p className="text-xs font-black text-aqua">{statusLabels[item.status]}</p>
                            <p className="mt-1 text-xs leading-5 text-slate-600">{item.message}</p>
                            <p className="mt-1 text-[10px] font-bold text-slate-400">{formatDateTime(item.createdAt)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid gap-4">
                  <div className="rounded-[1.5rem] border border-yellowBrand/60 bg-yellowBrand/10 p-4">
                    <p className="mb-3 text-sm font-black text-slate-950">Valores variables y total a pagar</p>
                    <OrderPricingEditor order={order} onUpdated={() => void load()} />
                  </div>
                  <div className="rounded-[1.5rem] border border-aqua/10 p-4">
                    <p className="mb-3 text-sm font-black text-slate-950">Actualizar etapa y notificar</p>
                    <AdminStatusActions
                      orderId={order.id}
                      currentStatus={order.status}
                      pickupType={order.pickupType}
                      canAdvance={order.paymentStatus === 'APPROVED' && order.pricingReady !== false}
                      onUpdated={() => void load()}
                    />
                  </div>
                  <OrderConversation order={order} onChanged={() => void load()} />
                  <EvidenceUploader orderId={order.id} onUploaded={() => void load()} />
                </div>
              </div>
            </Card>
          ))}
          {!loading && orders.length === 0 && <Card><p className="text-center font-bold text-slate-500">No hay órdenes con estos filtros.</p></Card>}
        </section>
      </main>
    </>
  );
}
