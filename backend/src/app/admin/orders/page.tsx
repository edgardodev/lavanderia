'use client';

import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui';
import { AdminStatusActions } from '@/components/AdminStatusActions';
import { EvidenceUploader } from '@/components/EvidenceUploader';
import { StatusBadge } from '@/components/StatusBadge';
import { apiFetch } from '@/lib/api';
import type { OrderStatus } from '@/types';

type AdminOrder = { id: string; status: OrderStatus; client: { name: string; email: string; phone?: string }; pickupType: string; address?: string; createdAt: string };

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  async function load() { const data = await apiFetch<{ orders: AdminOrder[] }>('/admin/orders'); setOrders(data.orders); }
  useEffect(() => { load(); }, []);

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="font-title text-5xl text-aqua">Órdenes activas y en espera</h1>
        <div className="mt-8 grid gap-5">
          {orders.map((order) => (
            <Card key={order.id}>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black">{order.client.name}</h2>
                  <p className="text-sm text-slate-600">{order.client.email} · {order.client.phone}</p>
                  <p className="text-sm text-slate-600">{order.pickupType === 'DELIVERY' ? `Domicilio: ${order.address}` : 'Recoge en tienda'}</p>
                  <StatusBadge status={order.status} />
                </div>
                <AdminStatusActions orderId={order.id} onUpdated={load} />
              </div>
              <EvidenceUploader orderId={order.id} />
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}
