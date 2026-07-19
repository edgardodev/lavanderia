import { orderFlow, statusDescriptions, statusLabels } from '@/lib/constants';
import type { OrderStatus } from '@/types';

export function StatusTimeline({ currentStatus = 'QUEUED' }: { currentStatus?: OrderStatus }) {
  const currentIndex = Math.max(0, orderFlow.indexOf(currentStatus));
  return (
    <div className="grid gap-3">
      {orderFlow.map((status, index) => {
        const active = index <= currentIndex;
        return (
          <div key={status} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`grid h-8 w-8 place-items-center rounded-full text-xs font-black ${active ? 'bg-aqua text-white' : 'bg-slate-100 text-slate-400'}`}>{index + 1}</span>
              {index < orderFlow.length - 1 && <span className={`h-full min-h-6 w-0.5 ${active ? 'bg-aqua' : 'bg-slate-200'}`} />}
            </div>
            <div className="pb-3">
              <p className={`font-black ${active ? 'text-slate-950' : 'text-slate-400'}`}>{statusLabels[status]}</p>
              <p className="text-sm text-slate-500">{statusDescriptions[status]}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
