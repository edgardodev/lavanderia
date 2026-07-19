import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui';

export default function HomePage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto grid max-w-6xl gap-10 px-6 py-12">
        <section className="grid items-center gap-8 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-yellowBrand px-4 py-2 text-sm font-black">Lavandería moderna + experiencia cómoda</p>
            <h1 className="font-title text-5xl leading-tight text-aqua md:text-7xl">Reserva, paga y sigue tu ropa en tiempo real.</h1>
            <p className="mt-5 max-w-2xl text-lg text-slate-700">Escoge autoservicio en una de nuestras sedes o agenda el servicio "Lo hacemos por ti" con notificaciones del estado de tu ropa.</p>
            <div className="mt-8 flex gap-3">
              <Link href="/register" className="rounded-2xl bg-aqua px-6 py-4 font-black text-white">Crear cuenta</Link>
              <Link href="/login" className="rounded-2xl border border-aqua px-6 py-4 font-black text-aqua">Ingresar</Link>
            </div>
          </div>
          <Card className="bg-aqua text-white">
            <h2 className="font-title text-4xl text-yellowBrand">Servicios</h2>
            <ul className="mt-5 space-y-4 text-lg">
              <li><strong>Autoservicio:</strong> lavado $18.000, secado $18.000, completo $36.000.</li>
              <li><strong>Lo hacemos por ti:</strong> lavado $22.000, secado $22.000, completo $44.000.</li>
              <li>Incluye detergente y suavizante. Servicio asistido incluye doblado.</li>
              <li>Ciclo de 0 a 8 kilos, aproximadamente 30 a 35 prendas de uso diario.</li>
            </ul>
          </Card>
        </section>
      </main>
    </>
  );
}
