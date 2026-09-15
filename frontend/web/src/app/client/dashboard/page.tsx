"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { ClientOrderHistory } from "@/components/ClientOrderHistory";
import { PriceSummary } from "@/components/PriceSummary";
import { StatusBadge } from "@/components/StatusBadge";
import { StatusTimeline } from "@/components/StatusTimeline";
import { Card, Pill } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import { branchSeed, cycleLabels } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { registerPushNotifications } from "@/lib/fcm";
import type { LaundryOrder } from "@/types";

function branchName(order: LaundryOrder) {
  return order.branchName ?? branchSeed.find((branch) => branch.id === order.branchId)?.name ?? "Sede pendiente";
}

export default function ClientDashboardPage() {
  const [orders, setOrders] = useState<LaundryOrder[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    try {
      const data = await apiFetch<{ orders: LaundryOrder[] }>("/client/orders");
      setOrders(data.orders);
      setSelectedOrderId((current) => current ?? data.orders.find((order) => !["DELIVERED", "CANCELLED"].includes(order.status))?.id ?? data.orders[0]?.id ?? null);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar tu historial.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void registerPushNotifications().catch(() => undefined);
    void loadOrders();
    const timer = window.setInterval(() => void loadOrders(), 20000);
    const onFocus = () => void loadOrders();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadOrders]);

  const activeOrder = useMemo(
    () => orders.find((order) => !["DELIVERED", "CANCELLED"].includes(order.status)),
    [orders],
  );
  const selectedOrder = useMemo(
    () => orders.find((order) => order.id === selectedOrderId) ?? activeOrder ?? orders[0],
    [orders, selectedOrderId, activeOrder],
  );

  return (
    <>
      <AppHeader />
      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-12">
        <section className="grid gap-6 lg:grid-cols-[1fr_0.75fr] lg:items-start">
          <div>
            <Pill>Panel usuario</Pill>
            <h1 className="mt-4 font-title text-5xl leading-tight text-aqua md:text-6xl">¿Cómo quieres lavar hoy?</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
              Reserva una máquina para autoservicio o deja tu ropa con el equipo y sigue cada etapa desde aquí.
            </p>
          </div>
          <Card className="!bg-aqua text-white">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-yellowBrand">Estado actual</p>
            {activeOrder ? (
              <div className="mt-4 grid gap-3">
                <StatusBadge status={activeOrder.status} />
                <h2 className="text-2xl font-black">{cycleLabels[activeOrder.cycleType]} · {branchName(activeOrder)}</h2>
                <p className="text-sm text-white/85">Creado: {formatDateTime(activeOrder.createdAt)}</p>
                <p className="text-sm text-white/85">{activeOrder.pickupType === "DELIVERY" ? "Entrega a domicilio" : "Recogida en sede"}</p>
              </div>
            ) : (
              <p className="mt-4 text-white/85">No tienes servicios asistidos activos en este momento.</p>
            )}
          </Card>
        </section>

        {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p>}

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

        <section className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <Card>
            <h2 className="text-2xl font-black text-slate-950">Seguimiento de ropa</h2>
            <p className="mt-2 text-sm text-slate-500">Cada cambio realizado por el equipo queda registrado y puede generar una notificación.</p>
            <div className="mt-6">
              <StatusTimeline currentStatus={selectedOrder?.status ?? "QUEUED"} />
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Mis servicios asistidos</h2>
                <p className="mt-1 text-sm text-slate-500">Historial guardado en tu cuenta, no en este dispositivo.</p>
              </div>
              {orders.length > 1 && (
                <select value={selectedOrder?.id ?? ""} onChange={(event) => setSelectedOrderId(event.target.value)} className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700">
                  {orders.map((order) => <option key={order.id} value={order.id}>{branchName(order)} · {formatDateTime(order.createdAt)}</option>)}
                </select>
              )}
            </div>

            {loading ? (
              <p className="mt-6 text-sm font-bold text-slate-500">Cargando historial...</p>
            ) : selectedOrder ? (
              <div className="mt-6 grid gap-5">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-slate-50 p-4">
                  <div>
                    <p className="font-black text-slate-950">{branchName(selectedOrder)} · {cycleLabels[selectedOrder.cycleType]}</p>
                    <p className="mt-1 text-sm text-slate-500">{selectedOrder.pickupType === "DELIVERY" ? "Domicilio" : "Recoge en sede"}</p>
                  </div>
                  <StatusBadge status={selectedOrder.status} />
                </div>
                <ClientOrderHistory order={selectedOrder} onChanged={() => void loadOrders()} />
              </div>
            ) : (
              <p className="mt-6 rounded-3xl bg-slate-50 p-4 text-sm font-bold text-slate-500">Aún no tienes servicios asistidos.</p>
            )}
          </Card>
        </section>
      </main>
    </>
  );
}
