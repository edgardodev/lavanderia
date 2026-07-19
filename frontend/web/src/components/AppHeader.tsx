import Link from 'next/link';
import { Logo } from './Logo';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/20 bg-aqua/95 px-4 py-3 shadow-sm backdrop-blur md:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <Link href="/" className="focus-ring rounded-2xl">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-2 text-sm font-black text-white md:flex">
          <Link href="/login" className="rounded-full px-4 py-2 hover:bg-white/15">Ingresar</Link>
          <Link href="/register" className="rounded-full bg-yellowBrand px-4 py-2 text-slate-950 hover:opacity-90">Crear cuenta</Link>
        </nav>
        <nav className="flex items-center gap-2 text-xs font-black text-white md:hidden">
          <Link href="/login" className="rounded-full px-3 py-2 hover:bg-white/15">Entrar</Link>
          <Link href="/register" className="rounded-full bg-yellowBrand px-3 py-2 text-slate-950">Cuenta</Link>
        </nav>
      </div>
    </header>
  );
}
