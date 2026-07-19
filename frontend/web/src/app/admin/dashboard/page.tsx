'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BellRing, CalendarClock, Shirt, UsersRound, WashingMachine } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { BranchTabs } from '@/components/BranchTabs';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { branchSeed, getTimeSlotsForDate, statusLabels, storageKeys } from '@/lib/constants';
import { appendLocal, readLocal } from '@/lib/storage';
import type { BlockedSlot, LaundryOrder, OrderStatus, Reservation } from '@/types';

const sampleOrders: LaundryOrder[] = [
  {
    id: 'demo-1001',
    branchId: 'universidad-metropolitana',
    cycleType: 'FULL',
    pickupType: 'DELIVERY',
    address: 'Dirección registrada por el cliente',
    pieces: 34,
    notes: 'Separar prenda blanca manchada.',
    status: 'WASHING',
    client: { name: 'Cliente demo', email: 'cliente@demo.com', phone: '3000000000' },
    createdAt: new Date().toISOString(),
  },
];

const sampleReservations: Reservation[] = [
  {
    id: 'reservation-demo-1',
    branchId: 'cra-46',
    machineId: 'c46-2',
    cycleType: 'FULL',
    date: new Date().toISOString().slice(0, 10),
    slot: '09:00-11:00',
    notes: 'Reserva demo',
    client: { name: 'Usuario autoservicio', email: 'usuario@demo.com' },
    createdAt: new Date().toISOString(),
  },
];

function branchName(branchId: string) {
  return branchSeed.find((branch) => branch.id === branchId)?.name ?? branchId;
}

export default function AdminDashboardPage() {
  const [branchFilter, setBranchFilter] = useState('all');
  const [orders, setOrders] = useState<LaundryOrder[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [blockForm, setBlockForm] = useState({ branchId: branchSeed[0].id, machineId: branchSeed[0].machines[0].id, date: new Date().toISOString().slice(0, 10), slot: '', reason: 'Uso interno: Lo hacemos por ti' });
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const localOrders = readLocal<LaundryOrder[]>(storageKeys.assistedOrders, []);
    const localReservations = readLocal<Reservation[]>(storageKeys.selfServiceReservations, []);
    const localBlocked = readLocal<BlockedSlot[]>(storageKeys.blockedSlots, []);
    setOrders(localOrders.length ? localOrders : sampleOrders);
    setReservations(localReservations.length ? localReservations : sampleReservations);
    setBlockedSlots(localBlocked);

    apiFetch<{ reservations: Reservation[] }>('/admin/reservations')
      .then((data) => {
        if (data.reservations.length) setReservations(data.reservations);
      })
      .catch(() => undefined);
  }, []);

  const filteredOrders = useMemo(() => orders.filter((order) => branchFilter === 'all' || order.branchId === branchFilter), [orders, branchFilter]);
  const filteredReservations = useMemo(() => reservations.filter((reservation) => branchFilter === 'all' || reservation.branchId === branchFilter), [reservations, branchFilter]);
  const filteredBlocked = useMemo(() => blockedSlots.filter((slot) => branchFilter === 'all' || slot.branchId === branchFilter), [blockedSlots, branchFilter]);
  const selectedBranch = branchSeed.find((branch) => branch.id === blockForm.branchId) ?? branchSeed[0];
  const slots = getTimeSlotsForDate(blockForm.date);

  const metrics = [
    { label: 'Órdenes asistidas', value: filteredOrders.length, icon: Shirt },
    { label: 'Reservas autoservicio', value: filteredReservations.length, icon: CalendarClock },
    { label: 'Máquinas bloqueadas', value: filteredBlocked.length, icon: WashingMachine },
    { label: 'Clientes activos', value: new Set([...orders.map((order) => order.client?.email), ...reservations.map((reservation) => reservation.client?.email)].filter(Boolean)).size || 1, icon: UsersRound },
  ];

  function blockSlot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const record = appendLocal<BlockedSlot>(storageKeys.blockedSlots, {
      id: `blocked-${Date.now()}`,
      ...blockForm,
      createdAt: new Date().toISOString(),
    });
    setBlockedSlots((current) => [record, ...current]);
    setNotice('Horario bloqueado en modo frontend. El backend sincronizará disponibilidad real por sede.');
  }

  function updateBlockForm<K extends keyof typeof blockForm>(key: K, value: (typeof blockForm)[K]) {
    setBlockForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'branchId') {
        const branch = branchSeed.find((item) => item.id === value);
        next.machineId = branch?.machines[0]?.id ?? '';
      }
      if (key === 'date') next.slot = '';
      return next;
    });
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-12">
        <section className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-aqua">Administrador</p>
            <h1 className="mt-3 font-title text-5xl leading-tight text-aqua md:text-6xl">Dashboard operativo</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">Controla sedes, agenda, reservas, estados, fotos de evidencia y base de datos de clientes desde una misma vista.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/orders" className="rounded-2xl bg-aqua px-5 py-3 text-sm font-black text-white">Órdenes</Link>
            <Link href="/admin/reservations" className="rounded-2xl bg-yellowBrand px-5 py-3 text-sm font-black text-slate-950">Reservas</Link>
            <Link href="/admin/clients" className="rounded-2xl border border-aqua/30 bg-white px-5 py-3 text-sm font-black text-aqua">Clientes</Link>
          </div>
        </section>

        <BranchTabs value={branchFilter} onChange={setBranchFilter} />

        <section className="grid gap-4 md:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <Card key={metric.label} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">{metric.label}</p>
                    <p className="mt-2 text-4xl font-black text-aqua">{metric.value}</p>
                  </div>
                  <span className="rounded-2xl bg-aqua/10 p-3 text-aqua"><Icon size={22} /></span>
                </div>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Agenda y reservas</h2>
                <p className="mt-1 text-sm text-slate-500">Vista rápida para anticipar capacidad de máquinas.</p>
              </div>
              <CalendarClock className="text-aqua" />
            </div>
            <div className="mt-6 grid gap-3">
              {filteredReservations.slice(0, 5).map((reservation) => (
                <div key={reservation.id} className="grid gap-2 rounded-3xl border border-aqua/10 bg-aqua/5 p-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <p className="font-black text-slate-950">{branchName(reservation.branchId)} · {reservation.machineId}</p>
                    <p className="text-sm text-slate-600">{reservation.date} · {reservation.slot} · {reservation.client?.name ?? 'Cliente autoservicio'}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-aqua">Autoservicio</span>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Bloquear horario</h2>
                <p className="mt-1 text-sm text-slate-500">Para uso de máquinas en “Lo hacemos por ti”.</p>
              </div>
              <WashingMachine className="text-aqua" />
            </div>
            <form onSubmit={blockSlot} className="mt-6 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Sede">
                  <Select value={blockForm.branchId} onChange={(event) => updateBlockForm('branchId', event.target.value)}>
                    {branchSeed.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </Select>
                </Field>
                <Field label="Máquina">
                  <Select value={blockForm.machineId} onChange={(event) => updateBlockForm('machineId', event.target.value)}>
                    {selectedBranch.machines.map((machine) => <option key={machine.id} value={machine.id}>{machine.code}</option>)}
                  </Select>
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Día">
                  <Input type="date" value={blockForm.date} onChange={(event) => updateBlockForm('date', event.target.value)} />
                </Field>
                <Field label="Franja">
                  <Select value={blockForm.slot} onChange={(event) => updateBlockForm('slot', event.target.value)} required>
                    <option value="">Selecciona franja</option>
                    {slots.map((slot) => <option key={slot.value} value={slot.value}>{slot.label}</option>)}
                  </Select>
                </Field>
              </div>
              <Field label="Motivo">
                <Textarea value={blockForm.reason} onChange={(event) => updateBlockForm('reason', event.target.value)} />
              </Field>
              <Button type="submit">Bloquear horario</Button>
              {notice && <p className="rounded-2xl bg-yellowBrand/40 px-4 py-3 text-sm font-black text-slate-800">{notice}</p>}
            </form>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <Card>
            <h2 className="text-2xl font-black text-slate-950">Órdenes “Lo hacemos por ti”</h2>
            <div className="mt-6 grid gap-3">
              {filteredOrders.slice(0, 6).map((order) => (
                <div key={order.id} className="rounded-3xl border border-slate-100 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{order.client?.name ?? 'Cliente'} · {branchName(order.branchId)}</p>
                      <p className="text-sm text-slate-500">{order.pieces ?? 0} piezas · {order.pickupType === 'DELIVERY' ? 'Domicilio' : 'Recoge en sede'}</p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="bg-slate-950 text-white">
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-yellowBrand p-3 text-slate-950"><BellRing size={22} /></span>
              <div>
                <h2 className="text-2xl font-black text-yellowBrand">Centro de notificaciones</h2>
                <p className="text-sm text-white/70">Mensajes que recibirá cada usuario activo.</p>
              </div>
            </div>
            <div className="mt-6 grid gap-2">
              {(['QUEUED', 'WASHING', 'DRYING', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] as OrderStatus[]).map((status) => (
                <div key={status} className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white/90">{statusLabels[status]}</div>
              ))}
            </div>
          </Card>
        </section>
      </main>
    </>
  );
}
