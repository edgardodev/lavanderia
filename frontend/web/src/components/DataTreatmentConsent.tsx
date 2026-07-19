import { dataTreatmentText } from '@/lib/constants';

export function DataTreatmentConsent({ checked, onChange, compact = false }: { checked: boolean; onChange: (checked: boolean) => void; compact?: boolean }) {
  return (
    <label className="flex items-start gap-3 rounded-3xl border border-aqua/15 bg-aqua/5 p-4">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        required
        className="mt-1 h-5 w-5 rounded border-slate-300 accent-aqua"
      />
      <span className={compact ? 'text-xs leading-5 text-slate-600' : 'text-sm leading-6 text-slate-700'}>
        {dataTreatmentText}
      </span>
    </label>
  );
}
