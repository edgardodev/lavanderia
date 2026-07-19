'use client';

import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui';
import { apiFetch } from '@/lib/api';

type Client = { id: string; name: string; email: string; phone?: string; isActive: boolean; laundryOrders: unknown[]; reservations: unknown[] };

export default function AdminClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  useEffect(() => { apiFetch<{ clients: Client[] }>('/admin/clients').then((d) => setClients(d.clients)); }, []);

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="font-title text-5xl text-aqua">Clientes e historial</h1>
        <div className="mt-8 grid gap-4">
          {clients.map((client) => (
            <Card key={client.id}>
              <h2 className="text-xl font-black">{client.name}</h2>
              <p className="text-sm text-slate-600">{client.email} · {client.phone ?? 'Sin celular'}</p>
              <p className="mt-2 text-sm">Reservas recientes: {client.reservations.length} · Servicios recientes: {client.laundryOrders.length}</p>
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}
