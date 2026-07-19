"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { PriceSummary } from "@/components/PriceSummary";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusTimeline } from "@/components/StatusTimeline";
import { Card, Pill } from "@/components/ui";
import { branchSeed, cycleLabels, storageKeys } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { registerPushNotifications } from "@/lib/fcm";
import { readLocal } from "@/lib/storage";
import type { EvidenceRecord, LaundryOrder, Reservation } from "@/types";

function branchName(branchId: string) {
  return branchSeed.find((branch) => branch.id === branchId)?.name ?? "Sede pendiente";
}

export default function ClientDashboardPage() {
  const [orders, setOrders] = useState<LaundryOrder[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRecord[]>([]);

  useEffect(() => {
    registerPushNotifications().catch(() => undefined);
    setOrders(readLocal<LaundryOrder[]>(storageKeys.assistedOrders, []));
    setReservations(readLocal<Reservation[]>(storageKeys.selfServiceReservations, []));
    setEvidence(readLocal<EvidenceRecord[]>(storageKeys.evidence, []));
  }, []);

  const activeOrder = useMemo(() => orders[0], [orders]);
  const latestReservation = useMemo(() => reservations[0], [reservations]);

  return (
    <>
      <AppHeader />
      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-12">
        <section>
          <div>
            <Pill>Panel usuario</Pill>
            <h1 className="mt-4 font-title text-5xl leading-tight text-aqua md:text-6xl">¿Cómo quieres lavar hoy?</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              Escoge una de las dos rutas: autoservicio con reserva de máquina, o servicio asistido con seguimiento por
              notificaciones.
            </p>
          </div>
          {false && (
            <Card className="bg-aqua text-white">
              <p className="text-xs font-black uppercase tracking-[0.28em] text-yellowBrand">Estado actual</p>
              {activeOrder ? (
                <div className="mt-4 grid gap-3">
                  <StatusBadge status={activeOrder.status} />
                  <h2 className="text-2xl font-black">
                    {cycleLabels[activeOrder.cycleType]} · {branchName(activeOrder.branchId)}
                  </h2>
                  <p className="text-sm text-white/85">Creado: {formatDateTime(activeOrder.createdAt)}</p>
                </div>
              ) : (
                <p className="mt-4 text-white/85">
                  Aún no tienes servicios asistidos activos. Agenda uno para ver el avance aquí.
                </p>
              )}
            </Card>
          )}
        </section>

        <section className="grid gap-6 md:grid-cols-2">
          <Card className="relative overflow-hidden">
            <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[3rem] bg-aqua/10" />
            <p className="text-xs font-black uppercase tracking-[0.25em] text-aqua">Ruta 1</p>
            <h2 className="mt-3 text-3xl font-black text-slate-950">Lo haces tú mismo</h2>
            <p className="mt-3 leading-7 text-slate-600">
              Escoge sede, día, franja de 2 horas y una de las 4 máquinas disponibles.
            </p>
            <div className="mt-5">
              <PriceSummary mode="SELF" cycleType="FULL" />
            </div>
            <Link
              href="/client/self-service"
              className="mt-6 inline-flex rounded-2xl bg-aqua px-5 py-3 text-sm font-black text-white">
              Reservar máquina
            </Link>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute right-0 top-0 h-28 w-28 rounded-bl-[3rem] bg-yellowBrand/30" />
            <p className="text-xs font-black uppercase tracking-[0.25em] text-aqua">Ruta 2</p>
            <h2 className="mt-3 text-3xl font-black text-slate-950">Lo hacemos por ti</h2>
            <p className="mt-3 leading-7 text-slate-600">
              Deja tu ropa o pasamos por ella y relajate iremos actualizando el progreso de cada etapa.
            </p>
            <div className="mt-5">
              <PriceSummary mode="ASSISTED" cycleType="FULL" />
            </div>
            <Link
              href="/client/assisted"
              className="mt-6 inline-flex rounded-2xl bg-yellowBrand px-5 py-3 text-sm font-black text-slate-950">
              Agendar servicio
            </Link>
          </Card>
        </section>

        {false && (
        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <h2 className="text-2xl font-black text-slate-950">Seguimiento de ropa</h2>
            <p className="mt-2 text-sm text-slate-500">
              Las etapas se notifican por app cuando el administrador actualiza el estado.
            </p>
            <div className="mt-6">
              <StatusTimeline currentStatus={activeOrder?.status ?? "QUEUED"} />
            </div>
          </Card>

          <div className="grid gap-6">
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-slate-950">Reserva autoservicio</h2>
                  <p className="mt-1 text-sm text-slate-500">Tu próxima máquina reservada.</p>
                </div>
                <Link
                  href="/client/self-service"
                  className="rounded-full border border-aqua/30 px-4 py-2 text-sm font-black text-aqua">
                  Nueva reserva
                </Link>
              </div>
              {latestReservation ? (
                <div className="mt-5 rounded-3xl bg-slate-50 p-4">
                  <p className="font-black text-slate-950">
                    {branchName(latestReservation.branchId)} · {latestReservation.machineId}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    {latestReservation.date} · {latestReservation.slot} · {cycleLabels[latestReservation.cycleType]}
                  </p>
                </div>
              ) : (
                <p className="mt-5 rounded-3xl bg-slate-50 p-4 text-sm font-bold text-slate-500">
                  No tienes reservas guardadas en este dispositivo.
                </p>
              )}
            </Card>

            <Card>
              <h2 className="text-2xl font-black text-slate-950">Prendas manchadas o dañadas</h2>
              <p className="mt-1 text-sm text-slate-500">
                Aquí aparecerán las fotos que el administrador envíe como evidencia.
              </p>
              {evidence.length > 0 ? (
                <div className="mt-5 grid gap-3">
                  {evidence.slice(0, 3).map((item) => (
                    <div key={item.id} className="rounded-3xl border border-aqua/10 bg-aqua/5 p-4">
                      <p className="font-black text-slate-950">Orden {item.orderId}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.description || "Sin descripción"}</p>
                      <p className="mt-2 text-xs font-bold text-slate-500">Archivos: {item.fileNames.join(", ")}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-5 rounded-3xl bg-yellowBrand/30 p-4 text-sm font-bold text-slate-700">
                  Sin evidencias por ahora.
                </p>
              )}
            </Card>
          </div>
        </section>
        )}
      </main>
    </>
  );
}
