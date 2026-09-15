import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { PriceSummary } from "@/components/PriceSummary";
import { Card, Pill } from "@/components/ui";

export default function ClientDashboardPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-12">
        <section>
          <Pill>Panel usuario</Pill>
          <h1 className="mt-4 font-title text-5xl leading-tight text-aqua md:text-6xl">¿Cómo quieres lavar hoy?</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
            Elige una de las dos rutas. Cada modalidad mantiene su propia información y seguimiento dentro de su sección.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <Card className="relative overflow-hidden">
            <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[3rem] bg-aqua/10" />
            <p className="text-xs font-black uppercase tracking-[0.25em] text-aqua">Ruta 1</p>
            <h2 className="mt-3 text-3xl font-black text-slate-950">Lo haces tú mismo</h2>
            <p className="mt-3 leading-7 text-slate-600">Escoge sede, día, franja de 2 horas y una máquina realmente disponible.</p>
            <div className="mt-5"><PriceSummary mode="SELF" cycleType="FULL" /></div>
            <Link href="/client/self-service" className="mt-6 inline-flex rounded-2xl bg-aqua px-5 py-3 text-sm font-black text-white">Reservar máquina</Link>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[3rem] bg-yellowBrand/30" />
            <p className="text-xs font-black uppercase tracking-[0.25em] text-aqua">Ruta 2</p>
            <h2 className="mt-3 text-3xl font-black text-slate-950">Lo hacemos por ti</h2>
            <p className="mt-3 leading-7 text-slate-600">Deja tu ropa o solicita domicilio y recibe actualizaciones reales desde recepción hasta entrega.</p>
            <div className="mt-5"><PriceSummary mode="ASSISTED" cycleType="FULL" /></div>
            <Link href="/client/assisted" className="mt-6 inline-flex rounded-2xl bg-yellowBrand px-5 py-3 text-sm font-black text-slate-950">Agendar servicio</Link>
          </Card>
        </section>
      </main>
    </>
  );
}
