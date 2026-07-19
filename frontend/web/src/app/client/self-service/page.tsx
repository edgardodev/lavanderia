"use client";

import { useEffect, useMemo, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { DataTreatmentConsent } from "@/components/DataTreatmentConsent";
import { PriceSummary } from "@/components/PriceSummary";
import { WompiCheckoutButton } from "@/components/WompiCheckoutButton";
import { Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { apiFetch } from "@/lib/api";
import {
  branchSeed,
  businessHours,
  cycleLabels,
  getTimeSlotsForDate,
  selfServicePrices,
  storageKeys,
} from "@/lib/constants";
import { clearLocal, readLocal, writeLocal } from "@/lib/storage";
import type { BlockedSlot, Branch, CycleType, Reservation } from "@/types";

type SelfServiceDraft = {
  branchId: string;
  machineId: string;
  cycleType: CycleType;
  date: string;
  slot: string;
  notes: string;
  consent: boolean;
};

const today = new Date().toISOString().slice(0, 10);

const initialDraft: SelfServiceDraft = {
  branchId: branchSeed[0]?.id ?? "",
  machineId: "",
  cycleType: "FULL",
  date: today,
  slot: "",
  notes: "",
  consent: false,
};

export default function SelfServicePage() {
  const [branches, setBranches] = useState<Branch[]>(branchSeed);
  const [draft, setDraft] = useState<SelfServiceDraft>(initialDraft);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [reservedMachineIds, setReservedMachineIds] = useState<string[]>([]);

  useEffect(() => {
    setDraft(readLocal<SelfServiceDraft>(storageKeys.selfServiceDraft, initialDraft));
    apiFetch<{ branches: Branch[] }>("/branches")
      .then((data) => {
        const nextBranches = data.branches.length ? data.branches : branchSeed;
        setBranches(nextBranches);
        setDraft((current) => ({
          ...current,
          branchId: nextBranches.some((branch) => branch.id === current.branchId)
            ? current.branchId
            : (nextBranches[0]?.id ?? ""),
        }));
      })
      .catch(() => setBranches(branchSeed));
  }, []);

  useEffect(() => {
    writeLocal(storageKeys.selfServiceDraft, draft);
  }, [draft]);

  const selected = branches.find((branch) => branch.id === draft.branchId) ?? branches[0];
  const slots = useMemo(() => getTimeSlotsForDate(draft.date), [draft.date]);
  const blockedSlots = useMemo(() => readLocal<BlockedSlot[]>(storageKeys.blockedSlots, []), []);

  useEffect(() => {
    setReservedMachineIds([]);
    setError("");
    if (!draft.branchId || !draft.date || !draft.slot) return;

    const params = new URLSearchParams({
      branchId: draft.branchId,
      date: draft.date,
      slot: draft.slot,
    });

    apiFetch<{ reservedMachineIds: string[] }>(`/reservations/availability?${params.toString()}`)
      .then((data) => {
        setReservedMachineIds(data.reservedMachineIds);
        if (draft.machineId && data.reservedMachineIds.includes(draft.machineId)) {
          setDraft((current) => ({ ...current, machineId: "" }));
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudo consultar disponibilidad."));
  }, [draft.branchId, draft.date, draft.slot, draft.machineId]);

  function update<K extends keyof SelfServiceDraft>(key: K, value: SelfServiceDraft[K]) {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "branchId") next.machineId = "";
      if (key === "date") {
        next.slot = "";
        next.machineId = "";
      }
      if (key === "slot") next.machineId = "";
      return next;
    });
  }

  function isBlocked(machineId: string, slot: string) {
    return (
      reservedMachineIds.includes(machineId) ||
      blockedSlots.some(
        (item) =>
          item.branchId === draft.branchId &&
          item.machineId === machineId &&
          item.date === draft.date &&
          item.slot === slot,
      )
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const payload = {
      branchId: draft.branchId,
      machineId: draft.machineId,
      cycleType: draft.cycleType,
      date: draft.date,
      slot: draft.slot,
      notes: draft.notes,
    };

    try {
      const data = await apiFetch<{ reservation: Reservation }>("/reservations", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCreatedId(data.reservation.id);
      setMessage("Reserva creada. Continúa con el pago desde tu panel.");
      clearLocal(storageKeys.selfServiceDraft);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la reserva.");
    }
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-12 lg:grid-cols-[1fr_0.74fr] lg:items-start">
        <Card>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-aqua">Autoservicio</p>
          <h1 className="mt-3 font-title text-5xl text-aqua">Reserva tu máquina</h1>
          <p className="mt-3 leading-7 text-slate-600">
            Cada sede tiene máquinas independientes. El sistema valida disponibilidad por sede, máquina, fecha y franja.
          </p>

          <form onSubmit={onSubmit} className="mt-8 grid gap-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Sede">
                <Select value={draft.branchId} onChange={(event) => update("branchId", event.target.value)} required>
                  {branches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Tipo de ciclo">
                <Select
                  value={draft.cycleType}
                  onChange={(event) => update("cycleType", event.target.value as CycleType)}
                  required>
                  {Object.entries(selfServicePrices).map(([type, price]) => (
                    <option key={type} value={type}>
                      {cycleLabels[type as CycleType]} - ${price.toLocaleString("es-CO")}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Día de reserva" hint="Domingos y festivos manejan horario especial.">
                <Input
                  type="date"
                  value={draft.date}
                  onChange={(event) => update("date", event.target.value)}
                  min={today}
                  required
                />
              </Field>
              <Field label="Franja horaria">
                <Select value={draft.slot} onChange={(event) => update("slot", event.target.value)} required>
                  <option value="">Selecciona franja</option>
                  {slots.map((slot) => (
                    <option key={slot.value} value={slot.value}>
                      {slot.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Máquina">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {selected?.machines.map((machine) => {
                  const blocked = draft.slot ? isBlocked(machine.id, draft.slot) : false;
                  const active = draft.machineId === machine.id;
                  return (
                    <button
                      key={machine.id}
                      type="button"
                      onClick={() => !blocked && update("machineId", machine.id)}
                      disabled={!draft.slot || blocked}
                      className={`rounded-3xl border p-4 text-left transition ${active ? "border-aqua bg-aqua text-white shadow-lg shadow-aqua/20" : "border-aqua/15 bg-white hover:border-aqua"} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400`}>
                      <span className="block text-lg font-black">{machine.code}</span>
                      <span className="mt-1 block text-xs font-bold">
                        {blocked ? "No disponible" : draft.slot ? "Disponible" : "Selecciona franja"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Notas opcionales">
              <Textarea
                value={draft.notes}
                onChange={(event) => update("notes", event.target.value)}
                placeholder="Ej: llegaré 10 minutos antes, necesito soporte, ropa delicada..."
              />
            </Field>

            <DataTreatmentConsent checked={draft.consent} onChange={(checked) => update("consent", checked)} />

            <div className="grid gap-2 rounded-3xl bg-slate-50 p-4 text-sm font-bold text-slate-600">
              <p>{businessHours.weekdays}</p>
              <p>{businessHours.sundayHoliday}</p>
              <p className="text-aqua">{businessHours.selfServiceLimit}</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!draft.consent || !draft.machineId || !draft.slot}>
                Reservar
              </Button>
              {createdId && <WompiCheckoutButton type="reservation" id={createdId} />}
            </div>
            {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p>}
            {message && (
              <p className="rounded-2xl bg-yellowBrand/40 px-4 py-3 text-sm font-black text-slate-800">{message}</p>
            )}
          </form>
        </Card>

        <div className="grid gap-6">
          <PriceSummary mode="SELF" cycleType={draft.cycleType} />
        </div>
      </main>
    </>
  );
}
