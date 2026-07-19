import Image from "next/image";
import Link from "next/link";
import { AppHeader } from "@/components/AppHeader";
import { Card, Pill } from "@/components/ui";
import { businessHours, doneForYouPrices, selfServicePrices, stainServiceRange } from "@/lib/constants";
import { formatCOP } from "@/lib/format";

const planCards = [
  {
    title: "Autoservicio",
    subtitle: "Tú reservas la máquina y lavas a tu ritmo.",
    prices: selfServicePrices,
    highlight: "Incluye detergente y suavizante",
    href: "/client/self-service",
    cta: "Reservar máquina",
  },
  {
    title: "Lo hacemos por ti",
    subtitle: "Nosotros lavamos, secamos y doblamos tu ropa.",
    prices: doneForYouPrices,
    highlight: "Incluye detergente, suavizante y doblado",
    href: "/client/assisted",
    cta: "Agendar servicio",
  },
];

export default function HomePage() {
  return (
    <>
      <AppHeader />
      <main className="overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(248,247,0,0.28),transparent_34%),linear-gradient(180deg,#f6ffff_0%,#ffffff_55%,#efffff_100%)]">
        <section className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-12 md:grid-cols-[1.05fr_0.95fr] md:py-16">
          <div>
            <Pill>Buen día 🧼 La Lavandería & Bakery 🫧</Pill>
            <h1 className="mt-6 font-title text-5xl leading-[0.95] text-aqua md:text-7xl">
              Agenda, lava y sigue tu ropa sin enredos.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
              Reserva tu máquina a la hora que mejor te convenga o mejor agenda domicilio y deja que el equipo haga todo
              por ti. notificaremos atraves de la APP el estado de tu ropa.
            </p>
            <div className="mt-8 flex flex-wrap gap-3"></div>
          </div>

          <Card className="relative min-h-[440px] overflow-hidden bg-aqua p-0 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(248,247,0,0.35),transparent_22%),radial-gradient(circle_at_90%_15%,rgba(255,255,255,0.20),transparent_24%)]" />
            <div className="relative grid h-full gap-6 p-7">
              <div className="flex items-center justify-between gap-4">
                <Image
                  src="/logo.png"
                  alt="La Lavandería & Bakery"
                  width={116}
                  height={116}
                  className="rounded-3xl border border-white/20 object-cover"
                  priority
                />
                <div className="rounded-3xl bg-white/15 p-4 text-right backdrop-blur">
                  <p className="text-2xl font-black">0 a 8 kg</p>
                  <p className="text-xs text-white/80">30 a 35 prendas de uso diario</p>
                </div>
              </div>
              <div>
                <h2 className="font-title text-5xl text-slate-900">Ven y disfruta</h2>
                <p className="mt-3 text-lg leading-8 text-white/90">
                  Todo lo que tenemos para ti, o agenda tu domicilio
                </p>
              </div>

              <div className="grid gap-3 rounded-[1.75rem] bg-white p-5 text-slate-900 shadow-2xl">
                <span className="inline-flex items-center gap-0 leading-none drop-shadow-sm">
                  <span className="text-5xl">🛵</span>
                  <span className="-ml-4 translate-y-3 text-2xl">💨</span>
                </span>

                <p className="font-black text-aqua">Horarios de atención</p>
                <p className="text-sm font-bold">{businessHours.weekdays}</p>
                <p className="text-sm font-bold">{businessHours.sundayHoliday}</p>
                <p className="rounded-2xl bg-yellowBrand/80 px-3 py-2 text-xs font-black">
                  {businessHours.selfServiceLimit}
                </p>
              </div>
            </div>
          </Card>
        </section>

        <section className="mx-auto max-w-7xl px-6 pb-16">
          <div className="grid gap-6 lg:grid-cols-2">
            {planCards.map((plan) => (
              <Card key={plan.title} className="grid gap-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.25em] text-aqua">Plan</p>
                    <h2 className="mt-2 text-3xl font-black text-slate-950">{plan.title}</h2>
                    <p className="mt-2 text-slate-600">{plan.subtitle}</p>
                  </div>
                  <Link
                    href="/login"
                    className="rounded-full bg-slate-950 px-4 py-2 text-sm font-black text-white">
                    {plan.cta}
                  </Link>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-3xl bg-aqua/10 p-4">
                    <p className="text-sm font-black text-slate-700">Lavado</p>
                    <p className="mt-2 text-2xl font-black text-aqua">{formatCOP(plan.prices.WASH)}</p>
                  </div>
                  <div className="rounded-3xl bg-aqua/10 p-4">
                    <p className="text-sm font-black text-slate-700">Secado</p>
                    <p className="mt-2 text-2xl font-black text-aqua">{formatCOP(plan.prices.DRY)}</p>
                  </div>
                  <div className="rounded-3xl bg-yellowBrand/60 p-4">
                    <p className="text-sm font-black text-slate-700">Completo</p>
                    <p className="mt-2 text-2xl font-black text-slate-950">{formatCOP(plan.prices.FULL)}</p>
                  </div>
                </div>
                <p className="rounded-3xl bg-slate-50 p-4 text-sm font-bold leading-6 text-slate-600">
                  {plan.highlight}. Edredones y cobijas no clasifican como prendas de uso diario y la cantidad de
                  prendas por ciclo depende del volumen de las piezas.
                </p>
              </Card>
            ))}
          </div>

          <Card className="mt-6 grid gap-4 bg-slate-950 text-white md:grid-cols-[1fr_auto] md:items-baseline">
            <div>
              <h2 className="text-2xl font-black text-slate-900">Desmancha y despercude tus prendas:</h2>
              <p className="mt-2 text-white/80">Por prenda, según tipo de mancha. Entrega estimada de 2 a 3 días.</p>
            </div>
            <p className="rounded-3xl bg-white px-5 py-4 text-2xl font-black text-aqua flex items-center justify-center md:justify-end gap-6 self-baseline">
              <span className="whitespace-nowrap">{formatCOP(stainServiceRange.min)}</span>
              <span className="text-aqua">a</span>
              <span className="whitespace-nowrap">{formatCOP(stainServiceRange.max)}</span>
            </p>
          </Card>
        </section>
      </main>
    </>
  );
}
