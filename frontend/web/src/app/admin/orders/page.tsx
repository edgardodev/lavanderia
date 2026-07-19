'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { AdminStatusActions } from '@/components/AdminStatusActions';
import { BranchTabs } from '@/components/BranchTabs';
import { EvidenceUploader } from '@/components/EvidenceUploader';
import { StatusBadge } from '@/components/StatusBadge';
import { Card, Field, Input, Select } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { branchSeed, cycleLabels, statusLabels, storageKeys } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { readLocal, writeLocal } from '@/lib/storage';
import type { LaundryOrder, OrderStatus } from '@/types';

const fallbackOrders: LaundryOrder[] = [
  {
    id: 'demo-order-1',
    branchId: 'universidad-metropolitana',
    cycleType: 'FULL',
    pickupType: 'DELIVERY',
    address: 'Dirección registrada',
    pieces: 32,
    notes: 'Prenda clara con mancha en manga.',
    status: 'QUEUED',
    client: { name: 'Cliente demo', email: 'cliente@demo.com', phone: '3000000000' },
    createdAt: new Date().toISOString(),
  },
];

function branchName(branchId: string) {
  return branchSeed.find((branch) => branch.id === branchId)?.name ?? 'Sede pendiente';
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<LaundryOrder[]>([]);
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  async function load() {
    try {
      const data = await apiFetch<{ orders: LaundryOrder[] }>('/admin/orders');
      setOrders(data.orders);
    } catch {
      const localOrders = readLocal<LaundryOrder[]>(storageKeys.assistedOrders, []);
      setOrders(localOrders.length ? localOrders : fallbackOrders);
    }
  }

  useEffect(() => { load(); }, []);

  const filteredOrders = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return orders.filter((order) => {
      const matchesBranch = branchFilter === 'all' || order.branchId === branchFilter;
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const clientText = `${order.client?.name ?? ''} ${order.client?.email ?? ''} ${order.client?.phone ?? ''}`.toLowerCase();
      const matchesSearch = !normalized || clientText.includes(normalized);
      return matchesBranch && matchesStatus && matchesSearch;
    });
  }, [orders, branchFilter, statusFilter, search]);

  function updateLocalStatus(orderId: string, status?: OrderStatus) {
    if (!status) return;
    setOrders((current) => {
      const next = current.map((order) => (order.id === orderId ? { ...order, status } : order));
      writeLocal(storageKeys.assistedOrders, next);
      return next;
    });
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-12">
        <section>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-aqua">Administrador</p>
          <h1 className="mt-3 font-title text-5xl text-aqua">Órdenes activas y en espera</h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600">Actualiza estados, envía notificaciones al usuario y carga fotos de evidencia para prendas manchadas o dañadas.</p>
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
        </Card>

        <section className="grid gap-5">
          {filteredOrders.map((order) => (
            <Card key={order.id}>
              <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black text-slate-950">{order.client?.name ?? 'Cliente sin nombre'}</h2>
                      <p className="mt-1 text-sm text-slate-600">{order.client?.email ?? 'Sin correo'} · {order.client?.phone ?? 'Sin celular'}</p>
                      <p className="mt-1 text-sm font-bold text-aqua">{branchName(order.branchId)} · {cycleLabels[order.cycleType]}</p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="mt-5 grid gap-2 rounded-3xl bg-slate-50 p-4 text-sm text-slate-600">
                    <p><strong>Ingreso:</strong> {formatDateTime(order.createdAt)}</p>
                    <p><strong>Tipo:</strong> {order.pickupType === 'DELIVERY' ? `Domicilio · ${order.address ?? 'Dirección pendiente'}` : 'Recoge en tienda'}</p>
                    <p><strong>Piezas:</strong> {order.pieces ?? 'Sin dato'}</p>
                    <p><strong>Notas:</strong> {order.notes || 'Sin notas'}</p>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-[1.5rem] border border-aqua/10 p-4">
                    <p className="mb-3 text-sm font-black text-slate-950">Enviar etapa al usuario</p>
                    <AdminStatusActions orderId={order.id} onUpdated={(status) => updateLocalStatus(order.id, status)} />
                  </div>
                  <EvidenceUploader orderId={order.id} />
                </div>
              </div>
            </Card>
          ))}
          {filteredOrders.length === 0 && <Card><p className="text-center font-bold text-slate-500">No hay órdenes con estos filtros.</p></Card>}
        </section>
      </main>
    </>
  );
}
