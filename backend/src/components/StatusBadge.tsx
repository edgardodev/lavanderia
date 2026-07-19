import { statusLabels } from '@/lib/constants';
import type { OrderStatus } from '@/types';

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className="rounded-full bg-yellowBrand px-3 py-1 text-xs font-black text-slate-900">{statusLabels[status]}</span>;
}
