'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, KeyRound, ShieldCheck } from 'lucide-react';
import { AppHeader } from '@/components/AppHeader';
import { Button, Card, Field, Input } from '@/components/ui';
import { apiFetch } from '@/lib/api';

type SecurityStatus = {
  setupRequired: boolean;
  mustChangePassword: boolean;
  mustConfigureMfa: boolean;
};

type MfaSetup = {
  configured: boolean;
  secret?: string;
  otpauthUri?: string;
};

export default function AdminSecuritySetupPage() {
  const router = useRouter();
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [mfa, setMfa] = useState<MfaSetup | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const loadMfa = useCallback(async () => {
    try {
      const data = await apiFetch<MfaSetup>('/auth/admin/security/mfa');
      setMfa(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar la configuración MFA.');
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const data = await apiFetch<SecurityStatus>('/auth/admin/security/status');
      setStatus(data);
      if (!data.mustChangePassword && data.mustConfigureMfa) await loadMfa();
      if (!data.setupRequired) router.replace('/admin/dashboard');
    } catch {
      router.replace('/login?role=admin');
    } finally {
      setLoading(false);
    }
  }, [loadMfa, router]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    const form = new FormData(event.currentTarget);
    const password = String(form.get('password') ?? '');
    const confirmation = String(form.get('confirmation') ?? '');
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    try {
      const data = await apiFetch<SecurityStatus>('/auth/admin/security/password', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setStatus(data);
      setNotice('Contraseña administrativa actualizada. Ahora configura el segundo factor.');
      if (data.mustConfigureMfa) await loadMfa();
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cambiar la contraseña.');
    }
  }

  async function confirmMfa(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const otp = String(form.get('otp') ?? '');
    try {
      const data = await apiFetch<{ configured: boolean; recoveryCodes: string[] }>('/auth/admin/security/mfa', {
        method: 'POST',
        body: JSON.stringify({ otp }),
      });
      setRecoveryCodes(data.recoveryCodes);
      setStatus({ setupRequired: false, mustChangePassword: false, mustConfigureMfa: false });
      setNotice('MFA activado. Guarda los códigos de recuperación antes de continuar.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido.');
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setNotice('Copiado al portapapeles.');
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center text-sm font-black text-slate-500">Verificando seguridad administrativa...</main>;
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto grid max-w-4xl gap-6 px-6 py-12">
        <Card className="!bg-slate-950 text-white">
          <div className="flex items-start gap-4">
            <span className="rounded-2xl bg-yellowBrand p-3 text-slate-950"><ShieldCheck size={24} /></span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-yellowBrand">Seguridad administrativa</p>
              <h1 className="mt-2 font-title text-4xl text-white">Protege tu cuenta antes de entrar al dashboard</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">
                Cada administrador debe usar una contraseña individual y un autenticador TOTP. No compartas la contraseña, el secreto MFA ni los códigos de recuperación.
              </p>
            </div>
          </div>
        </Card>

        {status?.mustChangePassword && (
          <Card>
            <div className="flex items-center gap-3">
              <KeyRound className="text-aqua" />
              <div>
                <h2 className="text-2xl font-black text-slate-950">1. Cambia la contraseña temporal</h2>
                <p className="mt-1 text-sm text-slate-500">Mínimo 16 caracteres. No uses nombre, correo, “admin”, “lavandería” ni contraseñas reutilizadas.</p>
              </div>
            </div>
            <form onSubmit={changePassword} className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Nueva contraseña">
                <Input name="password" type="password" autoComplete="new-password" minLength={16} maxLength={128} required />
              </Field>
              <Field label="Confirmar contraseña">
                <Input name="confirmation" type="password" autoComplete="new-password" minLength={16} maxLength={128} required />
              </Field>
              <div className="md:col-span-2"><Button type="submit">Guardar contraseña segura</Button></div>
            </form>
          </Card>
        )}

        {!status?.mustChangePassword && status?.mustConfigureMfa && mfa?.secret && (
          <Card>
            <h2 className="text-2xl font-black text-slate-950">2. Activa autenticación de dos factores</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              En Google Authenticator, Microsoft Authenticator, 1Password u otra app TOTP, agrega una cuenta manualmente con este secreto. También puedes intentar abrir el enlace directamente desde el dispositivo.
            </p>
            <div className="mt-5 rounded-3xl bg-slate-100 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-slate-500">Secreto TOTP</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <code className="break-all rounded-xl bg-white px-3 py-2 text-sm font-black text-slate-950">{mfa.secret}</code>
                <button type="button" onClick={() => void copy(mfa.secret!)} className="rounded-full border border-slate-300 bg-white p-2 text-slate-600" aria-label="Copiar secreto"><Copy size={16} /></button>
              </div>
              {mfa.otpauthUri && (
                <a href={mfa.otpauthUri} className="mt-4 inline-flex rounded-full bg-aqua px-4 py-2 text-xs font-black text-white">Abrir en autenticador</a>
              )}
            </div>
            <form onSubmit={confirmMfa} className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <Field label="Código de 6 dígitos">
                <Input name="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required placeholder="123456" />
              </Field>
              <Button type="submit">Confirmar MFA</Button>
            </form>
          </Card>
        )}

        {recoveryCodes.length > 0 && (
          <Card className="border border-yellowBrand/60">
            <h2 className="text-2xl font-black text-slate-950">Códigos de recuperación</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Se muestran una sola vez. Guarda estos códigos fuera del computador de la sede; cada uno sirve una única vez si pierdes el autenticador.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {recoveryCodes.map((code) => <code key={code} className="rounded-2xl bg-slate-100 px-4 py-3 text-center font-black text-slate-950">{code}</code>)}
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="button" onClick={() => void copy(recoveryCodes.join('\n'))}>Copiar códigos</Button>
              <Button type="button" variant="dark" onClick={() => router.replace('/admin/dashboard')}>Ya los guardé · continuar</Button>
            </div>
          </Card>
        )}

        {notice && <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">{notice}</p>}
        {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">{error}</p>}
      </main>
    </>
  );
}
