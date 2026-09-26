'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Logo } from './Logo';

type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: 'CLIENT' | 'ADMIN';
};

export function AppHeader() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch<{ user: SessionUser }>('/auth/session')
      .then((data) => {
        if (active) setUser(data.user);
      })
      .catch(() => {
        if (active) setUser(null);
      });
    return () => {
      active = false;
    };
  }, []);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Even if the server session already expired, return to the public login screen.
    } finally {
      setUser(null);
      setSigningOut(false);
      router.replace('/login');
      router.refresh();
    }
  }

  const homeHref = user?.role === 'ADMIN'
    ? '/admin/dashboard'
    : user?.role === 'CLIENT'
      ? '/client/dashboard'
      : '/';

  return (
    <header className="sticky top-0 z-40 border-b border-white/20 bg-aqua/95 px-4 py-3 shadow-sm backdrop-blur md:px-6">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <Link href={homeHref} className="focus-ring rounded-2xl">
          <Logo />
        </Link>

        {user === undefined ? (
          <div className="h-10 min-w-24" aria-hidden="true" />
        ) : user?.role === 'ADMIN' ? (
          <>
            <nav className="hidden items-center gap-1 text-sm font-black text-white md:flex">
              <Link href="/admin/dashboard" className="rounded-full px-3 py-2 hover:bg-white/15">Dashboard</Link>
              <Link href="/admin/orders" className="rounded-full px-3 py-2 hover:bg-white/15">Órdenes</Link>
              <Link href="/admin/reservations" className="rounded-full px-3 py-2 hover:bg-white/15">Reservas</Link>
              <Link href="/admin/clients" className="rounded-full px-3 py-2 hover:bg-white/15">Clientes</Link>
              <Link href="/admin/security" className="rounded-full px-3 py-2 hover:bg-white/15">Seguridad</Link>
              <button type="button" onClick={() => void signOut()} disabled={signingOut} className="rounded-full bg-yellowBrand px-4 py-2 text-slate-950 hover:opacity-90 disabled:opacity-60">
                {signingOut ? 'Saliendo...' : 'Salir'}
              </button>
            </nav>
            <nav className="flex items-center gap-2 text-xs font-black text-white md:hidden">
              <Link href="/admin/dashboard" className="rounded-full px-3 py-2 hover:bg-white/15">Panel</Link>
              <button type="button" onClick={() => void signOut()} disabled={signingOut} className="rounded-full bg-yellowBrand px-3 py-2 text-slate-950 disabled:opacity-60">Salir</button>
            </nav>
          </>
        ) : user?.role === 'CLIENT' ? (
          <>
            <nav className="hidden items-center gap-1 text-sm font-black text-white md:flex">
              <Link href="/client/dashboard" className="rounded-full px-3 py-2 hover:bg-white/15">Panel</Link>
              <Link href="/client/self-service" className="rounded-full px-3 py-2 hover:bg-white/15">Autoservicio</Link>
              <Link href="/client/assisted" className="rounded-full px-3 py-2 hover:bg-white/15">Lo hacemos por ti</Link>
              <button type="button" onClick={() => void signOut()} disabled={signingOut} className="rounded-full bg-yellowBrand px-4 py-2 text-slate-950 hover:opacity-90 disabled:opacity-60">
                {signingOut ? 'Saliendo...' : 'Salir'}
              </button>
            </nav>
            <nav className="flex items-center gap-2 text-xs font-black text-white md:hidden">
              <Link href="/client/dashboard" className="rounded-full px-3 py-2 hover:bg-white/15">Panel</Link>
              <button type="button" onClick={() => void signOut()} disabled={signingOut} className="rounded-full bg-yellowBrand px-3 py-2 text-slate-950 disabled:opacity-60">Salir</button>
            </nav>
          </>
        ) : (
          <>
            <nav className="hidden items-center gap-2 text-sm font-black text-white md:flex">
              <Link href="/login" className="rounded-full px-4 py-2 hover:bg-white/15">Ingresar</Link>
              <Link href="/register" className="rounded-full bg-yellowBrand px-4 py-2 text-slate-950 hover:opacity-90">Crear cuenta</Link>
            </nav>
            <nav className="flex items-center gap-2 text-xs font-black text-white md:hidden">
              <Link href="/login" className="rounded-full px-3 py-2 hover:bg-white/15">Entrar</Link>
              <Link href="/register" className="rounded-full bg-yellowBrand px-3 py-2 text-slate-950">Cuenta</Link>
            </nav>
          </>
        )}
      </div>
    </header>
  );
}
