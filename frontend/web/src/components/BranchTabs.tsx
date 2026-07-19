import { branchSeed } from '@/lib/constants';

export function BranchTabs({ value, onChange, includeAll = true }: { value: string; onChange: (value: string) => void; includeAll?: boolean }) {
  const items = includeAll ? [{ id: 'all', name: 'Todas las sedes' }, ...branchSeed] : branchSeed;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((branch) => {
        const active = value === branch.id;
        return (
          <button
            key={branch.id}
            type="button"
            onClick={() => onChange(branch.id)}
            className={`rounded-full px-4 py-2 text-sm font-black transition ${active ? 'bg-aqua text-white shadow-lg shadow-aqua/20' : 'border border-aqua/20 bg-white text-aqua hover:bg-aqua/10'}`}
          >
            {branch.name}
          </button>
        );
      })}
    </div>
  );
}
