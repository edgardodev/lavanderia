'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui';
import { apiFetch } from '@/lib/api';

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<any>(null);
  useEffect(() => { apiFetch<{ metrics: any }>('/admin/dashboard').then((d) => setMetrics(d.metrics)); }, []);

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="font-title text-5xl text-aqua">Dashboard administrador</h1>
        <div className="mt-8 grid gap-4 md:grid-cols-4">
          {Object.entries(metrics ?? {}).map(([key, value]) => (
            <Card key={key}><p className="text-sm font-bold uppercase text-slate-500">{key}</p><p className="text-4xl font-black text-aqua">{String(value)}</p></Card>
          ))}
        </div>
        <div className="mt-8 flex gap-3">
          <Link href="/admin/orders" className="rounded-2xl bg-aqua px-5 py-3 font-black text-white">Gestionar órdenes</Link>
          <Link href="/admin/clients" className="rounded-2xl bg-yellowBrand px-5 py-3 font-black text-slate-900">Ver clientes</Link>
        </div>
      </main>
    </>
  );
}
