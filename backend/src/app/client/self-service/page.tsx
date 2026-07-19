'use client';

import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Button, Card, Input } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import type { Branch, CycleType } from '@/types';

export default function SelfServicePage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    apiFetch<{ branches: Branch[] }>('/branches').then((data) => setBranches(data.branches));
  }, []);

  const selected = branches.find((b) => b.id === branchId);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {
      branchId,
      machineId: form.get('machineId'),
      cycleType: form.get('cycleType') as CycleType,
      scheduledStart: new Date(String(form.get('scheduledStart'))).toISOString(),
      notes: form.get('notes'),
    };
    await apiFetch('/reservations', { method: 'POST', body: JSON.stringify(payload) });
    setMessage('Reserva creada. Continúa con el pago desde tu panel.');
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Card>
          <h1 className="font-title text-4xl text-aqua">Reservar autoservicio</h1>
          <p className="mt-2 text-sm text-slate-600">Lunes a sábado 7 a.m. a 7 p.m. Autoservicio hasta 5 p.m. Domingos y festivos 9 a.m. a 6 p.m.</p>
          <form onSubmit={onSubmit} className="mt-6 grid gap-4">
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} required className="rounded-2xl border px-4 py-3">
              <option value="">Selecciona sede</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name} - {b.address}</option>)}
            </select>
            <select name="machineId" required className="rounded-2xl border px-4 py-3" disabled={!selected}>
              <option value="">Selecciona máquina</option>
              {selected?.machines.map((m) => <option key={m.id} value={m.id}>{m.code}</option>)}
            </select>
            <select name="cycleType" required className="rounded-2xl border px-4 py-3">
              <option value="FULL">Ciclo completo - $36.000</option>
              <option value="WASH">Lavado - $18.000</option>
              <option value="DRY">Secado - $18.000</option>
            </select>
            <Input name="scheduledStart" type="datetime-local" required />
            <Input name="notes" placeholder="Notas opcionales" />
            <Button type="submit">Reservar</Button>
            {message && <p className="font-bold text-aqua">{message}</p>}
          </form>
        </Card>
      </main>
    </>
  );
}
