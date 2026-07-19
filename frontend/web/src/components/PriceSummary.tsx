import { cycleLabels, doneForYouPrices, selfServicePrices, stainServiceRange } from '@/lib/constants';
import { formatCOP } from '@/lib/format';
import type { CycleType } from '@/types';

export function PriceSummary({ mode, cycleType, includeStainService = false }: { mode: 'SELF' | 'ASSISTED'; cycleType: CycleType; includeStainService?: boolean }) {
  const price = mode === 'SELF' ? selfServicePrices[cycleType] : doneForYouPrices[cycleType];
  return (
    <aside className="rounded-[1.75rem] border border-aqua/15 bg-gradient-to-br from-aqua/10 via-white to-yellowBrand/20 p-5">
      <p className="text-xs font-black uppercase tracking-[0.25em] text-aqua">Resumen</p>
      <div className="mt-3 flex items-end justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-slate-900">{cycleLabels[cycleType]}</h3>
          <p className="text-sm text-slate-600">{mode === 'SELF' ? 'Autoservicio' : 'Lo hacemos por ti'}</p>
        </div>
        <p className="text-3xl font-black text-aqua">{formatCOP(price)}</p>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-slate-700">
        <p>Incluye detergente y suavizante.</p>
        {mode === 'ASSISTED' && <p>Incluye doblado de ropa.</p>}
        <p>Ciclo de 0 a 8 kilos, aprox. 30 a 35 prendas de uso diario.</p>
        {includeStainService && (
          <p className="font-bold text-slate-900">
            Desmanche/despercude: {formatCOP(stainServiceRange.min)} a {formatCOP(stainServiceRange.max)} por prenda. Entrega de 2 a 3 días.
          </p>
        )}
        <p className="text-xs font-bold text-slate-500">Las tarifas no incluyen domicilio.</p>
      </div>
    </aside>
  );
}
