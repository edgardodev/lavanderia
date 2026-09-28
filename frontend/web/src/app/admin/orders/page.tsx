'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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

type OrderView = 'active' | 'history';

const terminalStatuses: OrderStatus[] = ['DELIVERED', 'CANCELLED'];

function branchName(order: LaundryOrder) {
  return order.branchName ?? branchSeed.find((branch) => branch.id === order.branchId)?.name ?? 'Sede pendiente';
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<LaundryOrder[]>([]);
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [view, setView] = useState<OrderView>('active');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const visibleStatuses = useMemo(
    () => Object.entries(statusLabels).filter(([status]) => (
      view === 'history'
        ? terminalStatuses.includes(status as OrderStatus)
        : !terminalStatuses.includes(status as OrderStatus)
    )),
    [view],
  );

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '50', view });
      if (branchFilter !== 'all') params.set('branchId', branchFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);

      const data = await apiFetch<{ orders: LaundryOrder[]; truncated?: boolean }>(`/admin/orders?${params.toString()}`);
      setOrders(data.orders);
      setExpandedOrderId((current) => current && data.orders.some((order) => order.id === current) ? current : null);
      setTruncated(Boolean(data.truncated));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar las órdenes.');
    } finally {
      setLoading(false);
    }
  }, [branchFilter, statusFilter, debouncedSearch, view]);

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

  function changeView(next: OrderView) {
    setView(next);
    setStatusFilter('all');
    setExpandedOrderId(null);
    setLoading(true);
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-12">
        <AdminDashboardLink />

        <section>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-aqua">Administrador</p>
          <h1 className="mt-3 font-title text-5xl text-aqua">Órdenes “Lo hacemos por ti”</h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            La operación diaria muestra primero únicamente los pedidos activos. Los entregados y cancelados permanecen disponibles en Historial.
          </p>
        </section>

        <Card className="grid gap-5">
          <div className="flex flex-wrap gap-2 rounded-3xl bg-slate-100 p-2">
            <button
              type="button"
              onClick={() => changeView('active')}
              className={`rounded-2xl px-5 py-3 text-sm font-black transition ${view === 'active' ? 'bg-aqua text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
            >
              En atención
            </button>
            <button
              type="button"
              onClick={() => changeView('history')}
              className={`rounded-2xl px-5 py-3 text-sm font-black transition ${view === 'history' ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-white'}`}
            >
              Historial
            </button>
          </div>

          <BranchTabs value={branchFilter} onChange={setBranchFilter} />
          <div className="grid gap-4 md:grid-cols-[1fr_240px]">
            <Field label="Buscar cliente">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, correo o celular" />
            </Field>
            <Field label="Estado">
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as OrderStatus | 'all')}>
                <option value="all">{view === 'active' ? 'Todos los activos' : 'Todo el historial'}</option>
                {visibleStatuses.map(([status, label]) => <option key={status} value={status}>{label}</option>)}
              </Select>
            </Field>
          </div>
          {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p>}
          {truncated && <p className="text-xs font-bold text-amber-700">Hay más resultados. Usa sede, estado o búsqueda para acotar la consulta.</p>}
        </Card>

        {loading && <Card><p className="text-center font-bold text-slate-500">Cargando órdenes...</p></Card>}

        <section className="grid gap-4">
          {orders.map((order) => {
            const expanded = expandedOrderId === order.id;
            const terminal = terminalStatuses.includes(order.status);
            return (
              <Card key={order.id} className="overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-xl font-black text-slate-950">{order.client?.name ?? 'Cliente sin nombre'}</h2>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{order.client?.email ?? 'Sin correo'} · {order.client?.phone ?? 'Sin celular'}</p>
                    <p className="mt-2 text-sm font-bold text-aqua">{branchName(order)} · {cycleLabels[order.cycleType]}</p>
                    <p className="mt-1 text-xs font-bold text-slate-400">
                      {formatDateTime(order.createdAt)} · {order.pickupType === 'DELIVERY' ? 'Domicilio' : 'Recogida en sede'} · {order.pieces ?? '—'} piezas
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedOrderId(expanded ? null : order.id)}
                    className={`rounded-full px-4 py-2 text-xs font-black transition ${expanded ? 'bg-slate-200 text-slate-700' : 'bg-slate-950 text-white'}`}
                  >
                    {expanded ? 'Cerrar detalle' : terminal ? 'Ver servicio' : 'Gestionar pedido'}
                  </button>
                </div>

                {expanded && (
                  <div className="mt-5 grid gap-5 border-t border-slate-100 pt-5 xl:grid-cols-[0.85fr_1.15fr]">
                    <div>
                      <div className="grid gap-2 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
                        <p><strong>Tipo:</strong> {order.pickupType === 'DELIVERY' ? `Domicilio · ${order.address ?? 'Dirección pendiente'}` : 'Recoge en tienda'}</p>
                        <p><strong>Manchas:</strong> {order.stainService ? 'Servicio/revisión de manchas solicitado' : 'No solicitado'}</p>
                        <p><strong>Pago:</strong> {order.paymentStatus ?? 'Sin intento de pago'}</p>
                        <p><strong>Total:</strong> {((order.amountCents ?? 0) / 100).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 })}</p>
                        <p><strong>Notas:</strong> {order.notes || 'Sin notas'}</p>
                      </div>

                      {(order.statusHistory ?? []).length > 0 && (
                        <details className="mt-4 rounded-3xl border border-slate-200 p-4">
                          <summary className="cursor-pointer text-sm font-black text-slate-950">
                            Historial de etapas · {(order.statusHistory ?? []).length} movimiento{(order.statusHistory ?? []).length === 1 ? '' : 's'}
                          </summary>
                          <div className="mt-4 grid gap-3">
                            {(order.statusHistory ?? []).map((item) => (
                              <div key={item.id} className="border-l-2 border-aqua/30 pl-3">
                                <p className="text-xs font-black text-aqua">{statusLabels[item.status]}</p>
                                <p className="mt-1 text-xs leading-5 text-slate-600">{item.message}</p>
                                <p className="mt-1 text-[10px] font-bold text-slate-400">{formatDateTime(item.createdAt)}</p>
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>

                    <div className="grid gap-4">
                      {!terminal && (
                        <>
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
                        </>
                      )}
                      <OrderConversation order={order} onChanged={() => void load()} />
                      {!terminal && <EvidenceUploader orderId={order.id} onUploaded={() => void load()} />}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
          {!loading && orders.length === 0 && (
            <Card>
              <p className="text-center font-bold text-slate-500">
                {view === 'active' ? 'No hay pedidos activos con estos filtros.' : 'No hay servicios anteriores con estos filtros.'}
              </p>
            </Card>
          )}
        </section>
      </main>
    </>
  );
}
