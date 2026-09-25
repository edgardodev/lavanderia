'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { formatCOP } from '@/lib/format';
import type { LaundryOrder } from '@/types';
import { Button, Field, Input } from '@/components/ui';

function centsToCop(value?: number | null) {
  return value == null ? '' : String(Math.round(value / 100));
}

export function OrderPricingEditor({
  order,
  onUpdated,
}: {
  order: LaundryOrder;
  onUpdated: () => void;
}) {
  const [deliveryFee, setDeliveryFee] = useState(centsToCop(order.deliveryFeeCents));
  const [stainFee, setStainFee] = useState(centsToCop(order.stainFeeCents));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setDeliveryFee(centsToCop(order.deliveryFeeCents));
    setStainFee(centsToCop(order.stainFeeCents));
  }, [order.deliveryFeeCents, order.stainFeeCents]);

  const baseCop = Math.round((order.baseAmountCents ?? order.amountCents ?? 0) / 100);
  const totalCop = useMemo(() => {
    const delivery = order.pickupType === 'DELIVERY' ? Number(deliveryFee || 0) : 0;
    const stain = order.stainService ? Number(stainFee || 0) : 0;
    return baseCop + (Number.isFinite(delivery) ? delivery : 0) + (Number.isFinite(stain) ? stain : 0);
  }, [baseCop, deliveryFee, order.pickupType, order.stainService, stainFee]);

  const locked = order.paymentStatus === 'APPROVED' || order.status !== 'QUEUED';
  const hasVariableCharge = order.pickupType === 'DELIVERY' || Boolean(order.stainService);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const data = await apiFetch<{ order: LaundryOrder; notificationSent?: boolean }>(
        `/admin/orders/${order.id}/pricing`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            deliveryFeeCop: order.pickupType === 'DELIVERY' ? deliveryFee : undefined,
            stainFeeCop: order.stainService ? stainFee : undefined,
          }),
        },
      );
      setMessage(
        data.notificationSent
          ? 'Valores guardados y cliente notificado.'
          : 'Valores guardados. El cliente verá el total actualizado.',
      );
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudieron guardar los cargos.');
    } finally {
      setSaving(false);
    }
  }

  if (!hasVariableCharge) {
    return (
      <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-black text-slate-900">Valor sin cargos variables</p>
        <p className="mt-1">Total del servicio: {formatCOP((order.amountCents ?? 0) / 100)}</p>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="grid gap-4">
      <div className="rounded-2xl bg-slate-50 p-4 text-sm">
        <div className="flex justify-between gap-3">
          <span className="font-bold text-slate-600">Servicio base</span>
          <span className="font-black text-slate-950">{formatCOP(baseCop)}</span>
        </div>
        <div className="mt-2 flex justify-between gap-3 border-t border-slate-200 pt-2">
          <span className="font-black text-slate-950">Total a cobrar</span>
          <span className="font-black text-aqua">{formatCOP(totalCop)}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {order.pickupType === 'DELIVERY' && (
          <Field label="Valor domicilio" hint="Valor total en pesos colombianos. Puede ser $0.">
            <Input
              inputMode="numeric"
              value={deliveryFee}
              onChange={(event) => setDeliveryFee(event.target.value.replace(/[^0-9]/g, '').slice(0, 7))}
              placeholder="Ej: 8000"
              disabled={locked}
              required
            />
          </Field>
        )}
        {order.stainService && (
          <Field label="Valor desmanche/despercude" hint="Carga aquí el valor total confirmado para esta orden.">
            <Input
              inputMode="numeric"
              value={stainFee}
              onChange={(event) => setStainFee(event.target.value.replace(/[^0-9]/g, '').slice(0, 7))}
              placeholder="Ej: 20000"
              disabled={locked}
              required
            />
          </Field>
        )}
      </div>

      {locked ? (
        <p className="text-xs font-bold text-slate-500">
          {order.paymentStatus === 'APPROVED'
            ? 'El pago ya fue aprobado; los valores de esta orden quedan cerrados.'
            : 'Los valores quedan cerrados cuando inicia el proceso de lavandería.'}
        </p>
      ) : (
        <Button type="submit" disabled={saving}>
          {saving ? 'Guardando valores...' : 'Confirmar valores para pago'}
        </Button>
      )}

      {message && <p className="text-xs font-bold text-emerald-700">{message}</p>}
      {error && <p className="text-xs font-bold text-rose-700">{error}</p>}
    </form>
  );
}
