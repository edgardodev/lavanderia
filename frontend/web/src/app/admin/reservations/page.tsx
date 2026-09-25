'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Card, Field, Input, Select } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { bogotaToday, branchSeed, cycleLabels } from '@/lib/constants';
import { formatDateTime } from '@/lib/format';
import type { Branch, Reservation } from '@/types';

type ReservationNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
};

function branchName(branches: Branch[], branchId: string) {
  return branches.find((branch) => branch.id === branchId)?.name ?? 'Sede pendiente';
}

function machineName(branches: Branch[], machineId: string) {
  const machine = branches.flatMap((branch) => branch.machines).find((item) => item.id === machineId);
  return machine?.code ?? machineId;
}

export default function AdminReservationsPage() {
  const [branches, setBranches] = useState<Branch[]>(branchSeed);
  const [branchFilter, setBranchFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState(bogotaToday());
  const [machineFilter, setMachineFilter] = useState('all');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [notifications, setNotifications] = useState<ReservationNotification[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ branches: Branch[] }>('/branches')
      .then((data) => setBranches(data.branches.length ? data.branches : branchSeed))
      .catch(() => setBranches(branchSeed));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (branchFilter !== 'all') params.set('branchId', branchFilter);
    if (machineFilter !== 'all') params.set('machineId', machineFilter);
    if (dateFilter) params.set('date', dateFilter);

    apiFetch<{ reservations: Reservation[]; notifications: ReservationNotification[] }>(`/admin/reservations?${params.toString()}`)
      .then((data) => {
        setReservations(data.reservations);
        setNotifications(data.notifications);
        setError('');
      })
      .catch((err) => {
        setReservations([]);
        setNotifications([]);
        setError(err instanceof Error ? err.message : 'No se pudieron cargar las reservas.');
      });
  }, [branchFilter, machineFilter, dateFilter]);

  const branchOptions = useMemo(() => [{ id: 'all', name: 'Todas las sedes' }, ...branches], [branches]);

  const machineOptions = useMemo(() => {
    const filteredBranches = branchFilter === 'all' ? branches : branches.filter((branch) => branch.id === branchFilter);
    return filteredBranches.flatMap((branch) => branch.machines.map((machine) => ({ ...machine, branchName: branch.name })));
  }, [branches, branchFilter]);

  return (
    <>
      <AppHeader />
      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-12">
        <section>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-aqua">Agenda</p>
          <h1 className="mt-3 font-title text-5xl text-aqua">Reservas de autoservicio</h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            Revisa qué cliente reservó, en qué sede, máquina y horario. Las reservas se leen desde la base de datos.
          </p>
        </section>

        <Card className="grid gap-5">
          <div className="flex flex-wrap gap-2">
            {branchOptions.map((branch) => {
              const active = branchFilter === branch.id;
              return (
                <button
                  key={branch.id}
                  type="button"
                  onClick={() => {
                    setBranchFilter(branch.id);
                    setMachineFilter('all');
                  }}
                  className={`rounded-full px-4 py-2 text-sm font-black transition ${active ? 'bg-aqua text-white shadow-lg shadow-aqua/20' : 'border border-aqua/20 bg-white text-aqua hover:bg-aqua/10'}`}
                >
                  {branch.name}
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Field label="Fecha">
              <Input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
            </Field>
            <Field label="Máquina">
              <Select value={machineFilter} onChange={(event) => setMachineFilter(event.target.value)}>
                <option value="all">Todas</option>
                {machineOptions.map((machine) => (
                  <option key={machine.id} value={machine.id}>{machine.branchName} · {machine.code}</option>
                ))}
              </Select>
            </Field>
            <div className="rounded-3xl bg-aqua/10 p-4">
              <p className="text-xs font-black uppercase text-slate-500">Reservas visibles</p>
              <p className="mt-2 text-3xl font-black text-aqua">{reservations.length}</p>
              <p className="text-xs font-bold text-slate-500">según filtros actuales</p>
            </div>
          </div>
        </Card>

        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <h2 className="text-2xl font-black text-slate-950">Notificaciones admin</h2>
            <p className="mt-2 text-sm text-slate-500">Cada reserva nueva muestra cliente, sede, máquina y horario.</p>
            <div className="mt-6 grid gap-3">
              {notifications.map((notification) => (
                <div key={notification.id} className="rounded-3xl border border-yellowBrand/60 bg-yellowBrand/25 p-4">
                  <p className="font-black text-slate-950">{notification.title}</p>
                  <p className="mt-1 text-sm font-bold text-slate-700">{notification.message}</p>
                  <p className="mt-2 text-xs font-bold text-slate-500">{formatDateTime(notification.createdAt)}</p>
                </div>
              ))}
              {notifications.length === 0 && (
                <p className="rounded-3xl bg-slate-50 p-4 text-sm font-bold text-slate-500">Sin notificaciones para estos filtros.</p>
              )}
            </div>
          </Card>

          <Card>
            <h2 className="text-2xl font-black text-slate-950">Reservas de usuarios</h2>
            {error && <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p>}
            <div className="mt-6 grid gap-3">
              {reservations.map((reservation) => (
                <div key={reservation.id} className="rounded-3xl border border-aqua/10 bg-aqua/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">
                        {branchName(branches, reservation.branchId)} · {machineName(branches, reservation.machineId)}
                      </p>
                      <p className="text-sm text-slate-600">
                        {reservation.date} · {reservation.slot} · {cycleLabels[reservation.cycleType]}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-aqua">Autoservicio</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    Cliente: {reservation.client?.name ?? 'Sin nombre'} · {reservation.client?.email ?? 'Sin correo'} · {reservation.client?.phone ?? 'Sin celular'}
                  </p>
                  <p className="mt-2 text-sm font-bold text-slate-600">
                    Estado: {reservation.status ?? 'PENDING_PAYMENT'} · Pago: {reservation.paymentStatus ?? 'Sin intento de pago'}
                  </p>
                  {reservation.status === 'CANCELLED' && reservation.paymentStatus === 'APPROVED' && (
                    <p className="mt-2 rounded-2xl bg-amber-100 px-3 py-2 text-sm font-black text-amber-900">
                      Revisión manual: Wompi aprobó el pago, pero la reserva está cancelada. No reasignes una máquina sin confirmar disponibilidad.
                    </p>
                  )}
                  {reservation.notes && <p className="mt-1 text-sm font-bold text-slate-600">Notas: {reservation.notes}</p>}
                  <p className="mt-1 text-xs font-bold text-slate-500">Creada: {formatDateTime(reservation.createdAt)}</p>
                </div>
              ))}
              {reservations.length === 0 && !error && (
                <p className="rounded-3xl bg-slate-50 p-4 text-sm font-bold text-slate-500">Sin reservas para estos filtros.</p>
              )}
            </div>
          </Card>
        </section>
      </main>
    </>
  );
}
