'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { BranchTabs } from '@/components/BranchTabs';
import { Card, Field, Input, Pill, Select } from '@/components/ui';
import { branchSeed, storageKeys } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import { readLocal } from '@/lib/storage';
import type { LaundryOrder, Reservation } from '@/types';

type ClientRow = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  visits: number;
  assistedCount: number;
  selfServiceCount: number;
  lastVisit?: string;
  favoriteBranch?: string;
};

const fallbackClients: ClientRow[] = [
  {
    id: 'client-demo',
    name: 'Cliente demo',
    email: 'cliente@demo.com',
    phone: '3000000000',
    isActive: true,
    visits: 3,
    assistedCount: 2,
    selfServiceCount: 1,
    lastVisit: new Date().toISOString(),
    favoriteBranch: 'universidad-metropolitana',
  },
];

function branchName(branchId?: string) {
  return branchSeed.find((branch) => branch.id === branchId)?.name ?? 'Sin sede frecuente';
}

export default function AdminClientsPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    const orders = readLocal<LaundryOrder[]>(storageKeys.assistedOrders, []);
    const reservations = readLocal<Reservation[]>(storageKeys.selfServiceReservations, []);
    const map = new Map<string, ClientRow>();

    orders.forEach((order) => {
      const email = order.client?.email ?? `orden-${order.id}@local`;
      const current = map.get(email) ?? {
        id: email,
        name: order.client?.name ?? 'Cliente local',
        email,
        phone: order.client?.phone,
        isActive: true,
        visits: 0,
        assistedCount: 0,
        selfServiceCount: 0,
        favoriteBranch: order.branchId,
      };
      current.visits += 1;
      current.assistedCount += 1;
      current.lastVisit = order.createdAt;
      current.favoriteBranch = order.branchId;
      map.set(email, current);
    });

    reservations.forEach((reservation) => {
      const email = reservation.client?.email ?? `reserva-${reservation.id}@local`;
      const current = map.get(email) ?? {
        id: email,
        name: reservation.client?.name ?? 'Usuario autoservicio',
        email,
        phone: reservation.client?.phone,
        isActive: true,
        visits: 0,
        assistedCount: 0,
        selfServiceCount: 0,
        favoriteBranch: reservation.branchId,
      };
      current.visits += 1;
      current.selfServiceCount += 1;
      current.lastVisit = reservation.createdAt;
      current.favoriteBranch = reservation.branchId;
      map.set(email, current);
    });

    const rows = Array.from(map.values());
    setClients(rows.length ? rows : fallbackClients);
  }, []);

  const filteredClients = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return clients.filter((client) => {
      const matchesSearch = !normalized || `${client.name} ${client.email} ${client.phone ?? ''}`.toLowerCase().includes(normalized);
      const matchesBranch = branchFilter === 'all' || client.favoriteBranch === branchFilter;
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? client.isActive : !client.isActive);
      return matchesSearch && matchesBranch && matchesStatus;
    });
  }, [clients, search, branchFilter, statusFilter]);

  return (
    <>
      <AppHeader />
      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-12">
        <section>
          <Pill>Base de datos</Pill>
          <h1 className="mt-3 font-title text-5xl text-aqua">Clientes e historial</h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600">Consulta datos de usuarios, número de visitas, servicio preferido, sede frecuente y estado activo para campañas o soporte.</p>
        </section>

        <Card className="grid gap-5">
          <BranchTabs value={branchFilter} onChange={setBranchFilter} />
          <div className="grid gap-4 md:grid-cols-[1fr_220px]">
            <Field label="Buscar usuario">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, correo, celular" />
            </Field>
            <Field label="Estado">
              <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as 'all' | 'active' | 'inactive')}>
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </Select>
            </Field>
          </div>
        </Card>

        <section className="grid gap-4">
          {filteredClients.map((client) => (
            <Card key={client.id} className="grid gap-5 lg:grid-cols-[1fr_1.2fr] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-black text-slate-950">{client.name}</h2>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${client.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{client.isActive ? 'Activo' : 'Inactivo'}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{client.email} · {client.phone ?? 'Sin celular'}</p>
                <p className="mt-2 text-sm font-bold text-aqua">Sede frecuente: {branchName(client.favoriteBranch)}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-3xl bg-aqua/10 p-4">
                  <p className="text-xs font-black uppercase text-slate-500">Visitas</p>
                  <p className="mt-2 text-3xl font-black text-aqua">{client.visits}</p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase text-slate-500">Lo hacemos</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{client.assistedCount}</p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-xs font-black uppercase text-slate-500">Autoservicio</p>
                  <p className="mt-2 text-3xl font-black text-slate-900">{client.selfServiceCount}</p>
                </div>
                <div className="rounded-3xl bg-yellowBrand/50 p-4">
                  <p className="text-xs font-black uppercase text-slate-500">Última visita</p>
                  <p className="mt-2 text-xs font-black text-slate-900">{formatDateTime(client.lastVisit)}</p>
                </div>
              </div>
            </Card>
          ))}
          {filteredClients.length === 0 && <Card><p className="text-center font-bold text-slate-500">No hay clientes con esos filtros.</p></Card>}
        </section>
      </main>
    </>
  );
}
