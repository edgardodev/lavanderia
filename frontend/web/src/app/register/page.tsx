'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { DataTreatmentConsent } from '@/components/DataTreatmentConsent';
import { Button, Card, Field, Input } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { clearLocal, readLocal, writeLocal } from '@/lib/storage';
import { storageKeys } from '@/lib/constants';

type RegisterDraft = {
  name: string;
  email: string;
  phone: string;
  documentId: string;
  consent: boolean;
};

const initialDraft: RegisterDraft = {
  name: '',
  email: '',
  phone: '',
  documentId: '',
  consent: false,
};

export default function RegisterPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<RegisterDraft>(initialDraft);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const stored = readLocal<RegisterDraft>(storageKeys.registerDraft, initialDraft);
    setDraft(stored);
    setRestored(Object.values(stored).some(Boolean));
  }, []);

  useEffect(() => {
    writeLocal(storageKeys.registerDraft, draft);
  }, [draft]);

  function update<K extends keyof RegisterDraft>(key: K, value: RegisterDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...draft, password }),
      });
      clearLocal(storageKeys.registerDraft);
      router.push('/login');
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        clearLocal(storageKeys.registerDraft);
        router.push('/login');
        return;
      }
      setError(err instanceof Error ? err.message : 'Error al crear cuenta');
    }
  }

  return (
    <>
      <AppHeader />
      <main className="bg-[radial-gradient(circle_at_top_left,rgba(248,247,0,0.25),transparent_30%)] px-6 py-12">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-start">
          <Card className="bg-slate-950 text-white">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-yellowBrand">Crear cuenta</p>
            <h1 className="mt-3 font-title text-5xl text-yellowBrand">Tus datos quedan listos para reservar.</h1>
            <p className="mt-4 leading-7 text-white/80">La app conserva un borrador local del formulario para evitar repetir datos si se corta internet o la energía. Por seguridad, la contraseña nunca se guarda en el navegador.</p>
            {restored && <p className="mt-5 rounded-3xl bg-aqua px-4 py-3 text-sm font-black text-white">Se restauró un borrador guardado en este dispositivo.</p>}
          </Card>

          <Card>
            <form onSubmit={onSubmit} className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nombre completo">
                  <Input value={draft.name} onChange={(event) => update('name', event.target.value)} name="name" placeholder="Nombre completo" autoComplete="name" required maxLength={90} />
                </Field>
                <Field label="Cédula o documento">
                  <Input value={draft.documentId} onChange={(event) => update('documentId', event.target.value.replace(/[^0-9]/g, ''))} name="documentId" placeholder="Documento" inputMode="numeric" required maxLength={15} />
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Correo">
                  <Input value={draft.email} onChange={(event) => update('email', event.target.value)} name="email" type="email" placeholder="Correo" autoComplete="email" required />
                </Field>
                <Field label="Celular">
                  <Input value={draft.phone} onChange={(event) => update('phone', event.target.value.replace(/[^0-9+ ]/g, ''))} name="phone" placeholder="Celular" autoComplete="tel" maxLength={18} />
                </Field>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Contraseña segura" hint="No se almacena en localStorage.">
                  <Input value={password} onChange={(event) => setPassword(event.target.value)} name="password" type="password" placeholder="Mínimo 8 caracteres" autoComplete="new-password" required minLength={8} />
                </Field>
                <Field label="Confirmar contraseña">
                  <Input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} name="confirmPassword" type="password" placeholder="Repite la contraseña" autoComplete="new-password" required minLength={8} />
                </Field>
              </div>
              <DataTreatmentConsent checked={draft.consent} onChange={(checked) => update('consent', checked)} />
              {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}
              <Button type="submit" disabled={!draft.consent}>Crear cuenta</Button>
            </form>
          </Card>
        </div>
      </main>
    </>
  );
}
