import Image from 'next/image';

export function Logo({ size = 54, compact = false }: { size?: number; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Image src="/logo.png" width={size} height={size} alt="Logo La Lavandería & Bakery" className="rounded-2xl border border-white/25 object-cover" priority />
      {!compact && (
        <div className="leading-tight">
          <p className="font-title text-2xl text-yellowBrand drop-shadow-sm">La Lavandería</p>
          <p className="text-[10px] font-black tracking-[0.35em] text-white">& BAKERY</p>
        </div>
      )}
    </div>
  );
}
