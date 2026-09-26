'use client';

import { useCallback, useEffect, useState } from 'react';
import { Copy, ShieldCheck, UserPlus } from 'lucide-react';
import { AdminDashboardLink } from '@/components/AdminDashboardLink';
import { AppHeader } from '@/components/AppHeader';
import { Button, Card, Field, Input, Pill } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

type AdminRow = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  canManageAdmins: boolean;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
  lockedUntil?: string | null;
  lastLoginAt?: string | null;
};

export default function AdminSecurityPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState<{ email: string; password: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiFetch<{ admins: AdminRow[] }>('/admin/security/users');
      setAdmins(data.admins);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No tienes acceso a la administración de cuentas.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSubmitting(true);
    setError('');
    setNotice('');
    setTemporaryPassword(null);
    try {
      const data = await apiFetch<{ admin: AdminRow; temporaryPassword: string }>('/admin/security/users', {
        method: 'POST',
        body: JSON.stringify({ name: form.get('name'), email: form.get('email') }),
      });
      setTemporaryPassword({ email: data.admin.email, password: data.temporaryPassword });
      setNotice('Administrador creado. Entrega la contraseña temporal por un canal seguro y no la guardes en chats grupales.');
      formElement.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el administrador.');
    } finally {
      setSubmitting(false);
    }
  }

  async function setActive(admin: AdminRow, isActive: boolean) {
    setError('');
    setNotice('');
    try {
      await apiFetch(`/admin/security/users/${admin.id}/active`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive }),
      });
      setNotice(isActive ? 'Cuenta administrativa habilitada.' : 'Cuenta deshabilitada y sesiones anteriores invalidadas.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar la cuenta.');
    }
  }

  async function copyPassword() {
    if (!temporaryPassword) return;
    await navigator.clipboard.writeText(temporaryPassword.password);
    setNotice('Contraseña temporal copiada. Compártela únicamente con su propietario.');
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto grid max-w-6xl gap-8 px-6 py-12">
        <AdminDashboardLink />

        <section>
          <Pill>Seguridad</Pill>
          <h1 className="mt-3 font-title text-5xl text-aqua">Accesos administrativos</h1>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            Las cuentas son individuales. Los nuevos administradores deben cambiar la contraseña temporal y activar MFA antes de poder usar cualquier función administrativa.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <div className="flex items-center gap-3">
              <span className="rounded-2xl bg-aqua/10 p-3 text-aqua"><UserPlus size={22} /></span>
              <div>
                <h2 className="text-2xl font-black text-slate-950">Crear administrador</h2>
                <p className="text-sm text-slate-500">Solo disponible para el administrador con permiso de gestión de accesos.</p>
              </div>
            </div>
            <form onSubmit={createAdmin} className="mt-6 grid gap-4">
              <Field label="Nombre completo"><Input name="name" required maxLength={100} autoComplete="off" /></Field>
              <Field label="Correo individual"><Input name="email" type="email" required maxLength={190} autoComplete="off" /></Field>
              <Button type="submit" disabled={submitting}>{submitting ? 'Creando...' : 'Crear acceso seguro'}</Button>
            </form>

            {temporaryPassword && (
              <div className="mt-5 rounded-3xl border border-yellowBrand bg-yellowBrand/15 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-slate-600">Contraseña temporal · se muestra ahora</p>
                <p className="mt-2 text-sm font-black text-slate-900">{temporaryPassword.email}</p>
                <div className="mt-3 flex items-center gap-2">
                  <code className="min-w-0 flex-1 break-all rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-950">{temporaryPassword.password}</code>
                  <button type="button" onClick={() => void copyPassword()} className="rounded-full bg-slate-950 p-2 text-white" aria-label="Copiar contraseña"><Copy size={16} /></button>
                </div>
                <p className="mt-3 text-xs leading-5 text-slate-600">El administrador no podrá entrar al dashboard hasta cambiar esta contraseña y configurar su autenticador.</p>
              </div>
            )}
          </Card>

          <Card>
            <div className="flex items-center gap-3">
              <ShieldCheck className="text-aqua" />
              <h2 className="text-2xl font-black text-slate-950">Administradores registrados</h2>
            </div>
            <div className="mt-6 grid gap-3">
              {admins.map((admin) => (
                <div key={admin.id} className="rounded-3xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{admin.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{admin.email}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-black">
                        <span className={`rounded-full px-3 py-1 ${admin.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{admin.isActive ? 'Activo' : 'Deshabilitado'}</span>
                        <span className={`rounded-full px-3 py-1 ${admin.mfaEnabled ? 'bg-aqua/10 text-aqua' : 'bg-amber-100 text-amber-700'}`}>{admin.mfaEnabled ? 'MFA activo' : 'MFA pendiente'}</span>
                        {admin.mustChangePassword && <span className="rounded-full bg-yellowBrand/40 px-3 py-1 text-slate-700">Debe cambiar contraseña</span>}
                        {admin.canManageAdmins && <span className="rounded-full bg-slate-950 px-3 py-1 text-white">Gestiona accesos</span>}
                      </div>
                      <p className="mt-3 text-xs text-slate-400">Último acceso: {admin.lastLoginAt ? formatDateTime(admin.lastLoginAt) : 'Nunca'}</p>
                      {admin.lockedUntil && <p className="mt-1 text-xs font-bold text-rose-600">Bloqueada hasta: {formatDateTime(admin.lockedUntil)}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => void setActive(admin, !admin.isActive)}
                      className={`rounded-full px-4 py-2 text-xs font-black ${admin.isActive ? 'border border-rose-200 text-rose-700' : 'bg-aqua text-white'}`}
                    >
                      {admin.isActive ? 'Deshabilitar' : 'Habilitar'}
                    </button>
                  </div>
                </div>
              ))}
              {admins.length === 0 && !error && <p className="text-sm font-bold text-slate-500">No hay administradores visibles.</p>}
            </div>
          </Card>
        </div>

        {notice && <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{notice}</p>}
        {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p>}
      </main>
    </>
  );
}
