import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { Card, Pill } from '@/components/ui';

export default function PaymentReturnPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto grid max-w-3xl gap-6 px-6 py-12">
        <Pill>Pago recibido por Wompi</Pill>
        <Card>
          <h1 className="font-title text-4xl text-aqua">Estamos verificando el resultado</h1>
          <p className="mt-4 leading-7 text-slate-600">
            El regreso desde Wompi no confirma por sí solo que el pago fue aprobado. El estado definitivo se actualiza
            cuando nuestro servidor valida la transacción y recibe el evento firmado de Wompi.
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Si el pago queda pendiente, espera unos minutos y vuelve a consultar tu servicio. No repitas el pago mientras
            Wompi todavía lo esté procesando.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/client/self-service" className="rounded-2xl bg-aqua px-5 py-3 text-sm font-black text-white">
              Ver autoservicio
            </Link>
            <Link href="/client/assisted" className="rounded-2xl bg-yellowBrand px-5 py-3 text-sm font-black text-slate-950">
              Ver servicio asistido
            </Link>
          </div>
        </Card>
      </main>
    </>
  );
}
