'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui';
import { registerPushNotifications } from '@/lib/fcm';

export default function ClientDashboardPage() {
  useEffect(() => {
    registerPushNotifications().catch(console.error);
  }, []);

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="font-title text-5xl text-aqua">¿Cómo quieres lavar hoy?</h1>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card>
            <h2 className="text-2xl font-black">Autoservicio</h2>
            <p className="mt-3 text-slate-600">Escoge sede, máquina y horario. Tenemos 4 máquinas por sede.</p>
            <Link href="/client/self-service" className="mt-6 inline-flex rounded-2xl bg-aqua px-5 py-3 font-black text-white">Reservar máquina</Link>
          </Card>
          <Card>
            <h2 className="text-2xl font-black">Lo hacemos por ti</h2>
            <p className="mt-3 text-slate-600">Agenda tu servicio y recibe notificaciones del estado de tu ropa.</p>
            <Link href="/client/assisted" className="mt-6 inline-flex rounded-2xl bg-yellowBrand px-5 py-3 font-black text-slate-900">Agendar servicio</Link>
          </Card>
        </div>
      </main>
    </>
  );
}
