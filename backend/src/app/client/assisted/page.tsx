'use client';

import { useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Button, Card, Input } from '@/components/ui';
import { apiFetch } from '@/lib/api';

export default function AssistedPage() {
  const [pickupType, setPickupType] = useState('STORE');
  const [message, setMessage] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await apiFetch('/orders', {
      method: 'POST',
      body: JSON.stringify({ cycleType: form.get('cycleType'), pickupType, address: form.get('address'), notes: form.get('notes') }),
    });
    setMessage('Servicio creado. Recibirás notificaciones cuando el administrador actualice el estado.');
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-6 py-12">
        <Card>
          <h1 className="font-title text-4xl text-aqua">Lo hacemos por ti</h1>
          <form onSubmit={onSubmit} className="mt-6 grid gap-4">
            <select name="cycleType" className="rounded-2xl border px-4 py-3">
              <option value="FULL">Ciclo completo - $44.000</option>
              <option value="WASH">Lavado - $22.000</option>
              <option value="DRY">Secado - $22.000</option>
            </select>
            <select value={pickupType} onChange={(e) => setPickupType(e.target.value)} className="rounded-2xl border px-4 py-3">
              <option value="STORE">Recoger en tienda</option>
              <option value="DELIVERY">Domicilio</option>
            </select>
            {pickupType === 'DELIVERY' && <Input name="address" placeholder="Dirección de domicilio" required />}
            <Input name="notes" placeholder="Notas sobre prendas, manchas o instrucciones" />
            <Button type="submit">Agendar servicio</Button>
            {message && <p className="font-bold text-aqua">{message}</p>}
          </form>
        </Card>
      </main>
    </>
  );
}
