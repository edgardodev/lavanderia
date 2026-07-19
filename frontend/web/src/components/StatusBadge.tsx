import { statusLabels } from '@/lib/constants';
import type { OrderStatus } from '@/types';

const tone: Record<OrderStatus, string> = {
  QUEUED: 'bg-slate-100 text-slate-700',
  WASHING: 'bg-aqua/10 text-aqua',
  DRYING: 'bg-cyan-50 text-cyan-700',
  PREPARING: 'bg-yellowBrand text-slate-950',
  READY: 'bg-emerald-100 text-emerald-700',
  OUT_FOR_DELIVERY: 'bg-indigo-100 text-indigo-700',
  DELIVERED: 'bg-slate-900 text-white',
  CANCELLED: 'bg-rose-100 text-rose-700',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${tone[status]}`}>{statusLabels[status]}</span>;
}
