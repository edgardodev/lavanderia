'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AdminDashboardLink } from '@/components/AdminDashboardLink';
import { AppHeader } from '@/components/AppHeader';
import { BranchTabs } from '@/components/BranchTabs';
import { Card, Field, Input, Pill, Select } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { branchSeed, statusLabels } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import type { AdminClientSummary } from '@/types';

function branchName(branchId?: string) {
  return branchSeed.find((branch) => branch.id === branchId)?.name ?? branchId ?? 'Sin sede';
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<AdminClientSummary[]>([]);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'history'>('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ clients: AdminClientSummary[] }>('/admin/clients');
      setClients(data.clients);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los clientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 5 * 60 * 1000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  const filteredClients = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return clients.filter((client) => {
      const matchesSearch = !normalized || `${client.name} ${client.email} ${client.phone ?? ''}`.toLowerCase().includes(normalized);
      const matchesBranch = branchFilter === 'all' || client.activeOrders.some((order) => order.branchId === branchFilter);
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' ? client.activeAssistedCount > 0 : client.assistedCount > 0);
      return matchesSearch && matchesBranch && matchesStatus;
    });
  }, [clients, search, branchFilter, statusFilter]);

  return (
    <>
      <AppHeader />
      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-12">
        <AdminDashboardLink />

        <section>
          <Pill>Clientes</Pill>
          <h1 className="mt-3 font-title text-5xl text-aqua">Clientes e historial real</h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            Identifica rápidamente quién está usando “Lo hacemos por ti” y consulta su actividad previa. Esta información viene de la base de datos del servidor.
          </p>
        </section>

        <Card className="grid gap-5">
          <BranchTabs value={branchFilter} onChange={setBranchFilter} />
          <div className="grid gap-4 md:grid-cols-[1fr_240px]">
            <Field label="Buscar usuario">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, correo, celular" />
            </Field>
            <Field label="Vista">
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'history')}>
                <option value="all">Todos los clientes</option>
                <option value="active">Usando “Lo hacemos por ti”</option>
                <option value="history">Con historial asistido</option>
              </Select>
            </Field>
          </div>
          {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p>}
        </Card>

        {loading && <Card><p className="text-center font-bold text-slate-500">Cargando clientes...</p></Card>}

        <section className="grid gap-4">
          {filteredClients.map((client) => (
            <Card key={client.id} className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-black text-slate-950">{client.name}</h2>
                  {client.activeAssistedCount > 0 ? (
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">Servicio activo</span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">Sin servicio activo</span>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-600">{client.email} · {client.phone ?? 'Sin celular'}</p>
                <p className="mt-2 text-xs font-bold text-slate-400">Última actividad: {formatDateTime(client.lastActivityAt)}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-aqua/10 px-3 py-1 text-xs font-black text-aqua">{client.assistedCount} asistidos</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{client.reservationCount} reservas</span>
                </div>
                <Link href={`/admin/orders?client=${encodeURIComponent(client.email)}`} className="mt-5 inline-flex rounded-full bg-slate-950 px-4 py-2 text-xs font-black text-white">
                  Ver órdenes del cliente
                </Link>
              </div>

              <div className="grid gap-3">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">Servicios asistidos activos</p>
                {client.activeOrders.map((order) => (
                  <div key={order.id} className="rounded-3xl border border-aqua/15 bg-aqua/5 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">{branchName(order.branchId)}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{formatDateTime(order.createdAt)} · {order.pickupType === 'DELIVERY' ? 'Domicilio' : 'Recogida en sede'}</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-aqua">{statusLabels[order.status]}</span>
                    </div>
                  </div>
                ))}
                {client.activeOrders.length === 0 && <p className="rounded-3xl bg-slate-50 p-4 text-sm font-bold text-slate-500">No tiene un servicio asistido activo.</p>}
              </div>
            </Card>
          ))}
          {!loading && filteredClients.length === 0 && <Card><p className="text-center font-bold text-slate-500">No hay clientes con esos filtros.</p></Card>}
        </section>
      </main>
    </>
  );
}
