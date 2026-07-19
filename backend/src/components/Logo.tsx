import Image from 'next/image';

export function Logo({ size = 64 }: { size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <Image src="/logo.png" width={size} height={size} alt="Logo La Lavandería & Bakery" className="rounded-2xl" priority />
      <div className="leading-tight">
        <p className="font-title text-2xl text-yellowBrand drop-shadow-sm">La Lavandería</p>
        <p className="text-xs font-black tracking-[0.35em] text-white">& BAKERY</p>
      </div>
    </div>
  );
}
