import Link from 'next/link';
import { Logo } from './Logo';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/20 bg-aqua/95 px-6 py-3 shadow-sm backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="focus-ring rounded-2xl">
          <Logo />
        </Link>
        <nav className="flex items-center gap-3 text-sm font-bold text-white">
          <Link href="/login" className="rounded-full px-4 py-2 hover:bg-white/15">Ingresar</Link>
          <Link href="/register" className="rounded-full bg-yellowBrand px-4 py-2 text-slate-900 hover:opacity-90">Crear cuenta</Link>
        </nav>
      </div>
    </header>
  );
}
