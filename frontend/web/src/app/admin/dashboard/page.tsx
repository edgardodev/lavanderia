'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BellRing, CalendarClock, ShieldCheck, Shirt, UsersRound, WashingMachine } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { BranchTabs } from '@/components/BranchTabs';
import { StatusBadge } from '@/components/StatusBadge';
import { Button, Card, Field, Input, Select, Textarea } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { branchSeed, getTimeSlotsForDate, statusLabels, timeSlotOptions } from '@/lib/constants';
import type { BlockedSlot, Branch, LaundryOrder, OrderStatus, Reservation } from '@/types';

type Availability = {
  reservedMachineIds: string[];
  blockedMachineIds: string[];
  unavailableMachineIds: string[];
};

type DaySchedule = {
  date: string;
  isSunday: boolean;
  isHoliday: boolean;
  holidayName?: string | null;
  scheduleType: 'WEEKDAY' | 'SUNDAY_HOLIDAY';
  slots: string[];
};

type MachineCell =
  | { type: 'FREE' }
  | { type: 'RESERVED'; reservation: Reservation }
  | { type: 'BLOCKED'; block: BlockedSlot };

function branchName(branchId: string, branches: Branch[]) {
  return branches.find((branch) => branch.id === branchId)?.name
    ?? branchSeed.find((branch) => branch.id === branchId)?.name
    ?? branchId;
}

export default function AdminDashboardPage() {
  const [branches, setBranches] = useState<Branch[]>(branchSeed);
  const [branchFilter, setBranchFilter] = useState('all');
  const [orders, setOrders] = useState<LaundryOrder[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([]);
  const [reservedMachineIds, setReservedMachineIds] = useState<string[]>([]);
  const [blockedMachineIds, setBlockedMachineIds] = useState<string[]>([]);
  const [unavailableMachineIds, setUnavailableMachineIds] = useState<string[]>([]);
  const [machineBoardDate, setMachineBoardDate] = useState(new Date().toISOString().slice(0, 10));
  const [slots, setSlots] = useState(() => getTimeSlotsForDate(new Date().toISOString().slice(0, 10)));
  const [boardSlots, setBoardSlots] = useState(() => getTimeSlotsForDate(new Date().toISOString().slice(0, 10)));
  const [blockScheduleNote, setBlockScheduleNote] = useState('');
  const [boardScheduleNote, setBoardScheduleNote] = useState('');
  const [blockForm, setBlockForm] = useState({
    branchId: branchSeed[0]?.id ?? '',
    machineId: '',
    date: new Date().toISOString().slice(0, 10),
    slot: '',
    reason: 'Uso interno: Lo hacemos por ti',
  });
  const [notice, setNotice] = useState('');
  const [loadError, setLoadError] = useState('');
  const [blocking, setBlocking] = useState(false);

  const recordLoadError = useCallback((error: unknown) => {
    setLoadError(error instanceof Error ? error.message : 'No se pudo actualizar el dashboard.');
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const data = await apiFetch<{ orders: LaundryOrder[] }>('/admin/orders');
      setOrders(data.orders);
    } catch (error) {
      setOrders([]);
      recordLoadError(error);
    }
  }, [recordLoadError]);

  const loadBlocks = useCallback(async () => {
    try {
      const data = await apiFetch<{ blocks: BlockedSlot[] }>('/admin/machine-blocks');
      setBlockedSlots(data.blocks);
    } catch (error) {
      setBlockedSlots([]);
      recordLoadError(error);
    }
  }, [recordLoadError]);

  const loadReservations = useCallback(async () => {
    try {
      const data = await apiFetch<{ reservations: Reservation[] }>('/admin/reservations');
      setReservations(data.reservations);
    } catch (error) {
      setReservations([]);
      recordLoadError(error);
    }
  }, [recordLoadError]);

  const refreshOperationalData = useCallback(async () => {
    setLoadError('');
    await Promise.all([loadOrders(), loadReservations(), loadBlocks()]);
  }, [loadBlocks, loadOrders, loadReservations]);

  useEffect(() => {
    apiFetch<{ branches: Branch[] }>('/branches')
      .then((data) => {
        const nextBranches = data.branches.length ? data.branches : branchSeed;
        setBranches(nextBranches);
        setBlockForm((current) => {
          const branch = nextBranches.find((item) => item.id === current.branchId) ?? nextBranches[0];
          return {
            ...current,
            branchId: branch?.id ?? '',
            machineId: branch?.machines[0]?.id ?? '',
          };
        });
      })
      .catch(recordLoadError);

    void refreshOperationalData();
  }, [recordLoadError, refreshOperationalData]);

  useEffect(() => {
    const refresh = () => void refreshOperationalData();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [refreshOperationalData]);

  const filteredOrders = useMemo(
    () => orders.filter((order) => branchFilter === 'all' || order.branchId === branchFilter),
    [orders, branchFilter],
  );
  const filteredReservations = useMemo(
    () => reservations.filter((reservation) => branchFilter === 'all' || reservation.branchId === branchFilter),
    [reservations, branchFilter],
  );
  const filteredBlocked = useMemo(
    () => blockedSlots.filter((slot) => branchFilter === 'all' || slot.branchId === branchFilter),
    [blockedSlots, branchFilter],
  );
  const selectedBranch = branches.find((branch) => branch.id === blockForm.branchId) ?? branches[0];

  useEffect(() => {
    if (!blockForm.date) {
      setSlots([]);
      setBlockScheduleNote('');
      return;
    }
    apiFetch<DaySchedule>(`/calendar/day?date=${encodeURIComponent(blockForm.date)}`)
      .then((data) => {
        setSlots(timeSlotOptions(data.slots));
        setBlockScheduleNote(
          data.isHoliday
            ? `Festivo${data.holidayName ? ` · ${data.holidayName}` : ''}: horario de domingo.`
            : data.isSunday
              ? 'Domingo: horario especial.'
              : '',
        );
      })
      .catch((error) => {
        setSlots(getTimeSlotsForDate(blockForm.date));
        setBlockScheduleNote('');
        recordLoadError(error);
      });
  }, [blockForm.date, recordLoadError]);

  useEffect(() => {
    if (!machineBoardDate) {
      setBoardSlots([]);
      setBoardScheduleNote('');
      return;
    }
    apiFetch<DaySchedule>(`/calendar/day?date=${encodeURIComponent(machineBoardDate)}`)
      .then((data) => {
        setBoardSlots(timeSlotOptions(data.slots));
        setBoardScheduleNote(
          data.isHoliday
            ? `Festivo${data.holidayName ? ` · ${data.holidayName}` : ''}: horario de domingo.`
            : data.isSunday
              ? 'Domingo: horario especial.'
              : '',
        );
      })
      .catch((error) => {
        setBoardSlots(getTimeSlotsForDate(machineBoardDate));
        setBoardScheduleNote('');
        recordLoadError(error);
      });
  }, [machineBoardDate, recordLoadError]);

  const boardGridStyle = useMemo(
    () => ({ gridTemplateColumns: `130px repeat(${Math.max(boardSlots.length, 1)}, minmax(110px, 1fr))` }),
    [boardSlots.length],
  );
  const boardMinWidth = 130 + Math.max(boardSlots.length, 1) * 118;
  const visibleBranches = useMemo(
    () => branches.filter((branch) => branchFilter === 'all' || branch.id === branchFilter),
    [branches, branchFilter],
  );

  const boardReservations = useMemo(
    () => reservations.filter((reservation) => reservation.date === machineBoardDate),
    [reservations, machineBoardDate],
  );
  const boardBlocks = useMemo(
    () => blockedSlots.filter((block) => block.date === machineBoardDate),
    [blockedSlots, machineBoardDate],
  );

  function machineCell(branchId: string, machineId: string, slot: string): MachineCell {
    const reservation = boardReservations.find(
      (item) => item.branchId === branchId && item.machineId === machineId && item.slot === slot,
    );
    if (reservation) return { type: 'RESERVED', reservation };

    const block = boardBlocks.find(
      (item) => item.branchId === branchId && item.machineId === machineId && item.slot === slot,
    );
    if (block) return { type: 'BLOCKED', block };

    return { type: 'FREE' };
  }

  const loadBlockAvailability = useCallback(async () => {
    if (!blockForm.branchId || !blockForm.date || !blockForm.slot) {
      setReservedMachineIds([]);
      setBlockedMachineIds([]);
      setUnavailableMachineIds([]);
      return;
    }

    try {
      const params = new URLSearchParams({
        branchId: blockForm.branchId,
        date: blockForm.date,
        slot: blockForm.slot,
      });
      const data = await apiFetch<Availability>(`/reservations/availability?${params.toString()}`);
      setReservedMachineIds(data.reservedMachineIds);
      setBlockedMachineIds(data.blockedMachineIds);
      setUnavailableMachineIds(data.unavailableMachineIds);

      setBlockForm((current) => {
        if (!current.machineId || !data.unavailableMachineIds.includes(current.machineId)) return current;
        const branch = branches.find((item) => item.id === current.branchId);
        const nextMachine = branch?.machines.find((machine) => !data.unavailableMachineIds.includes(machine.id));
        return { ...current, machineId: nextMachine?.id ?? '' };
      });
    } catch (error) {
      setReservedMachineIds([]);
      setBlockedMachineIds([]);
      setUnavailableMachineIds([]);
      recordLoadError(error);
    }
  }, [blockForm.branchId, blockForm.date, blockForm.slot, branches, recordLoadError]);

  useEffect(() => {
    void loadBlockAvailability();
  }, [loadBlockAvailability]);

  const metrics = [
    { label: 'Órdenes asistidas', value: filteredOrders.length, icon: Shirt },
    { label: 'Reservas autoservicio', value: filteredReservations.length, icon: CalendarClock },
    { label: 'Máquinas bloqueadas', value: filteredBlocked.length, icon: WashingMachine },
    {
      label: 'Clientes activos',
      value: new Set(
        [...orders.map((order) => order.client?.email), ...reservations.map((reservation) => reservation.client?.email)].filter(Boolean),
      ).size,
      icon: UsersRound,
    },
  ];

  function updateBlockForm<K extends keyof typeof blockForm>(key: K, value: (typeof blockForm)[K]) {
    setBlockForm((current) => {
      const next = { ...current, [key]: value };
      if (key === 'branchId') {
        const branch = branches.find((item) => item.id === value);
        next.machineId = branch?.machines[0]?.id ?? '';
      }
      if (key === 'date') {
        next.slot = '';
        next.machineId = '';
      }
      if (key === 'slot') {
        const branch = branches.find((item) => item.id === next.branchId);
        next.machineId = branch?.machines[0]?.id ?? '';
      }
      return next;
    });
  }

  async function blockSlot(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice('');
    if (!blockForm.machineId || unavailableMachineIds.includes(blockForm.machineId)) {
      setNotice('Selecciona una máquina disponible para esa franja.');
      return;
    }

    setBlocking(true);
    try {
      await apiFetch<{ block: BlockedSlot }>('/admin/machine-blocks', {
        method: 'POST',
        body: JSON.stringify(blockForm),
      });
      setNotice('Máquina bloqueada. Los usuarios ya no pueden reservarla en esa franja.');
      await Promise.all([refreshOperationalData(), loadBlockAvailability()]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo bloquear la máquina.');
      await loadBlockAvailability();
    } finally {
      setBlocking(false);
    }
  }

  async function unblock(blockId: string) {
    setNotice('');
    try {
      await apiFetch(`/admin/machine-blocks/${blockId}`, { method: 'DELETE' });
      setNotice('Máquina desbloqueada. La franja vuelve a estar disponible si no existe una reserva.');
      await Promise.all([refreshOperationalData(), loadBlockAvailability()]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo desbloquear la máquina.');
    }
  }

  function machineOptionLabel(machine: { id: string; code: string }) {
    if (reservedMachineIds.includes(machine.id)) return `${machine.code} — Reservada`;
    if (blockedMachineIds.includes(machine.id)) return `${machine.code} — Bloqueada`;
    return machine.code;
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-12">
        <section className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-aqua">Administrador</p>
            <h1 className="mt-3 font-title text-5xl leading-tight text-aqua md:text-6xl">Dashboard operativo</h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
              Controla sedes, agenda, reservas, estados, fotos de evidencia y disponibilidad real de cada máquina.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/orders" className="rounded-2xl bg-aqua px-5 py-3 text-sm font-black text-white">Órdenes</Link>
            <Link href="/admin/reservations" className="rounded-2xl bg-yellowBrand px-5 py-3 text-sm font-black text-slate-950">Reservas</Link>
            <Link href="/admin/clients" className="rounded-2xl border border-aqua/30 bg-white px-5 py-3 text-sm font-black text-aqua">Clientes</Link>
            <Link href="/admin/security" className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-black text-slate-700"><ShieldCheck size={17} /> Seguridad</Link>
          </div>
        </section>

        {loadError && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-bold text-rose-700">
            {loadError} Los datos mostrados no se sustituyen por información demo. Reintenta o verifica el backend.
          </div>
        )}

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

        <Card>
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="flex items-center gap-3">
                <span className="rounded-2xl bg-aqua/10 p-3 text-aqua"><WashingMachine size={22} /></span>
                <div>
                  <h2 className="text-2xl font-black text-slate-950">Mapa visual de máquinas</h2>
                  <p className="mt-1 text-sm text-slate-500">Disponibilidad por sede, máquina y franja horaria.</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-black">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600">Libre</span>
                <span className="rounded-full bg-aqua px-3 py-1.5 text-white">Reservada</span>
                <span className="rounded-full bg-yellowBrand px-3 py-1.5 text-slate-950">Bloqueada por sede</span>
              </div>
            </div>
            <Field label="Día a visualizar" hint={boardScheduleNote || undefined}>
              <Input type="date" value={machineBoardDate} onChange={(event) => setMachineBoardDate(event.target.value)} />
            </Field>
          </div>

          <div className="mt-7 grid gap-6">
            {visibleBranches.map((branch) => {
              const branchReservations = boardReservations.filter((reservation) => reservation.branchId === branch.id);
              const branchBlocks = boardBlocks.filter((block) => block.branchId === branch.id);
              return (
                <section key={branch.id} className="overflow-hidden rounded-[1.75rem] border border-aqua/10 bg-slate-50/60">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-aqua/10 bg-white px-5 py-4">
                    <div>
                      <h3 className="text-xl font-black text-slate-950">{branch.name}</h3>
                      <p className="mt-1 text-xs font-bold text-slate-500">{branch.address}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-black">
                      <span className="rounded-full bg-aqua/10 px-3 py-1.5 text-aqua">{branchReservations.length} reservas</span>
                      <span className="rounded-full bg-yellowBrand/40 px-3 py-1.5 text-slate-800">{branchBlocks.length} bloqueos</span>
                    </div>
                  </div>

                  <div className="overflow-x-auto p-4">
                    <div style={{ minWidth: boardMinWidth }}>
                      <div className="grid gap-2" style={boardGridStyle}>
                        <div className="px-3 py-2 text-xs font-black uppercase tracking-wide text-slate-400">Máquina</div>
                        {boardSlots.map((slot) => (
                          <div key={slot.value} className="px-2 py-2 text-center text-xs font-black text-slate-500">{slot.label}</div>
                        ))}
                      </div>

                      <div className="mt-1 grid gap-2">
                        {branch.machines.map((machine) => (
                          <div key={machine.id} className="grid gap-2" style={boardGridStyle}>
                            <div className="flex min-h-20 items-center rounded-2xl bg-white px-3 py-3 shadow-sm">
                              <div>
                                <p className="font-black text-slate-950">{machine.code}</p>
                                <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">{branch.name}</p>
                              </div>
                            </div>

                            {boardSlots.map((slot) => {
                              const cell = machineCell(branch.id, machine.id, slot.value);
                              if (cell.type === 'RESERVED') {
                                const clientName = cell.reservation.client?.name ?? 'Cliente';
                                return (
                                  <div key={slot.value} title={`${clientName} · ${cell.reservation.slot}`} className="flex min-h-20 flex-col justify-center rounded-2xl bg-aqua px-3 py-2 text-white shadow-sm">
                                    <span className="text-xs font-black">Reservada</span>
                                    <span className="mt-1 truncate text-[11px] font-bold text-white/85">{clientName}</span>
                                  </div>
                                );
                              }
                              if (cell.type === 'BLOCKED') {
                                return (
                                  <div key={slot.value} title={cell.block.reason} className="flex min-h-20 flex-col justify-center rounded-2xl bg-yellowBrand px-3 py-2 text-slate-950 shadow-sm">
                                    <span className="text-xs font-black">Bloqueada</span>
                                    <span className="mt-1 line-clamp-2 text-[11px] font-bold text-slate-700">{cell.block.reason}</span>
                                  </div>
                                );
                              }
                              return <div key={slot.value} className="flex min-h-20 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-400">Libre</div>;
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        </Card>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Agenda y reservas</h2>
                <p className="mt-1 text-sm text-slate-500">Las reservas ocupan automáticamente la máquina seleccionada.</p>
              </div>
              <CalendarClock className="text-aqua" />
            </div>
            <div className="mt-6 grid gap-3">
              {filteredReservations.slice(0, 8).map((reservation) => (
                <div key={reservation.id} className="grid gap-2 rounded-3xl border border-aqua/10 bg-aqua/5 p-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <p className="font-black text-slate-950">{branchName(reservation.branchId, branches)} · {reservation.machineCode ?? reservation.machineId}</p>
                    <p className="text-sm text-slate-600">{reservation.date} · {reservation.slot} · {reservation.client?.name ?? 'Cliente autoservicio'}</p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-aqua">{reservation.status ?? 'Reservada'}</span>
                </div>
              ))}
              {filteredReservations.length === 0 && <p className="text-sm font-bold text-slate-500">No hay reservas para esta sede.</p>}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Bloquear máquina</h2>
                <p className="mt-1 text-sm text-slate-500">Para uso físico de la sede o para “Lo hacemos por ti”.</p>
              </div>
              <WashingMachine className="text-aqua" />
            </div>
            <form onSubmit={blockSlot} className="mt-6 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Sede">
                  <Select value={blockForm.branchId} onChange={(event) => updateBlockForm('branchId', event.target.value)}>
                    {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                  </Select>
                </Field>
                <Field label="Máquina">
                  <Select value={blockForm.machineId} onChange={(event) => updateBlockForm('machineId', event.target.value)} required>
                    <option value="">Selecciona máquina</option>
                    {selectedBranch?.machines.map((machine) => (
                      <option key={machine.id} value={machine.id} disabled={unavailableMachineIds.includes(machine.id)}>{machineOptionLabel(machine)}</option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Día">
                  <Input type="date" value={blockForm.date} onChange={(event) => updateBlockForm('date', event.target.value)} min={new Date().toISOString().slice(0, 10)} />
                </Field>
                <Field label="Franja" hint={blockScheduleNote || undefined}>
                  <Select value={blockForm.slot} onChange={(event) => updateBlockForm('slot', event.target.value)} required>
                    <option value="">Selecciona franja</option>
                    {slots.map((slot) => <option key={slot.value} value={slot.value}>{slot.label}</option>)}
                  </Select>
                </Field>
              </div>
              <Field label="Motivo">
                <Textarea value={blockForm.reason} onChange={(event) => updateBlockForm('reason', event.target.value)} />
              </Field>
              <Button type="submit" disabled={blocking || !blockForm.machineId || !blockForm.slot}>{blocking ? 'Bloqueando...' : 'Bloquear horario'}</Button>
              {notice && <p className="rounded-2xl bg-yellowBrand/40 px-4 py-3 text-sm font-black text-slate-800">{notice}</p>}
            </form>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <Card>
            <h2 className="text-2xl font-black text-slate-950">Bloqueos activos</h2>
            <p className="mt-1 text-sm text-slate-500">Estas máquinas no pueden ser reservadas por usuarios en las franjas indicadas.</p>
            <div className="mt-6 grid gap-3">
              {filteredBlocked.map((block) => (
                <div key={block.id} className="grid gap-3 rounded-3xl border border-yellowBrand/40 bg-yellowBrand/10 p-4 md:grid-cols-[1fr_auto] md:items-center">
                  <div>
                    <p className="font-black text-slate-950">{block.branchName ?? branchName(block.branchId, branches)} · {block.machineCode ?? block.machineId}</p>
                    <p className="text-sm text-slate-600">{block.date} · {block.slot}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{block.reason}</p>
                  </div>
                  <button type="button" onClick={() => void unblock(block.id)} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700">Desbloquear</button>
                </div>
              ))}
              {filteredBlocked.length === 0 && <p className="text-sm font-bold text-slate-500">No hay bloqueos activos para esta sede.</p>}
            </div>
          </Card>

          <Card className="bg-slate-950 text-white">
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-yellowBrand p-3 text-slate-950"><BellRing size={22} /></span>
              <div>
                <h2 className="text-2xl font-black text-yellowBrand">Centro de notificaciones</h2>
                <p className="text-sm text-white/70">Etapas notificables del servicio asistido.</p>
              </div>
            </div>
            <div className="mt-6 grid gap-2">
              {(['QUEUED', 'PRE_WASH', 'WASHING', 'DRYING', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY'] as OrderStatus[]).map((status) => (
                <div key={status} className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold text-white/90">{statusLabels[status]}</div>
              ))}
            </div>
          </Card>
        </section>

        <Card>
          <h2 className="text-2xl font-black text-slate-950">Órdenes “Lo hacemos por ti”</h2>
          <div className="mt-6 grid gap-3">
            {filteredOrders.slice(0, 6).map((order) => (
              <div key={order.id} className="rounded-3xl border border-slate-100 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{order.client?.name ?? 'Cliente'} · {branchName(order.branchId, branches)}</p>
                    <p className="text-sm text-slate-500">{order.pieces ?? 0} piezas · {order.pickupType === 'DELIVERY' ? 'Domicilio' : 'Recoge en sede'}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
              </div>
            ))}
            {filteredOrders.length === 0 && <p className="text-sm font-bold text-slate-500">No hay órdenes asistidas para esta sede.</p>}
          </div>
        </Card>
      </main>
    </>
  );
}
