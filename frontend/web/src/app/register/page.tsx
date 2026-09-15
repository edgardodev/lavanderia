'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppHeader } from '@/components/AppHeader';
import { RegistrationConsents, type RegistrationConsentState } from '@/components/RegistrationConsents';
import { Button, Card, Field, Input } from '@/components/ui';
import { apiFetch } from '@/lib/api';

const initialConsents: RegistrationConsentState = {
  privacyConsent: false,
  termsConsent: false,
  ageConfirmed: false,
  marketingConsent: false,
};

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [consents, setConsents] = useState<RegistrationConsentState>(initialConsents);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const requiredConsentsAccepted = consents.privacyConsent && consents.termsConsent && consents.ageConfirmed;

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (!requiredConsentsAccepted) {
      setError('Debes aceptar la autorización de datos, los términos y confirmar que eres mayor de edad.');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, phone, password, ...consents }),
      });
      router.push('/login?registered=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear cuenta');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AppHeader />
      <main className="bg-[radial-gradient(circle_at_top_left,rgba(248,247,0,0.25),transparent_30%)] px-6 py-12">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[0.8fr_1.2fr] md:items-start">
          <Card className="bg-slate-950 text-white">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-yellowBrand">Crear cuenta</p>
            <h1 className="mt-3 font-title text-5xl text-yellowBrand">Reserva y sigue tus servicios de forma segura.</h1>
            <p className="mt-4 leading-7 text-white/80">
              Solo pedimos los datos necesarios para prestar el servicio. La contraseña se procesa de forma segura y nunca se guarda en el navegador.
            </p>
            <div className="mt-6 rounded-3xl bg-white/10 p-4 text-sm leading-6 text-white/80">
              <strong className="text-white">Contraseña recomendada:</strong> usa una frase única de 12 o más caracteres y evita nombres, fechas, palabras como “admin” o “lavandería” y contraseñas reutilizadas.
            </div>
          </Card>

          <Card>
            <form onSubmit={onSubmit} className="grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Nombre completo">
                  <Input value={name} onChange={(event) => setName(event.target.value)} name="name" placeholder="Nombre completo" autoComplete="name" required maxLength={100} />
                </Field>
                <Field label="Celular" hint="Opcional al crear la cuenta; puede ser necesario para domicilios.">
                  <Input value={phone} onChange={(event) => setPhone(event.target.value.replace(/[^0-9+ ]/g, ''))} name="phone" placeholder="Celular" autoComplete="tel" maxLength={18} />
                </Field>
              </div>

              <Field label="Correo">
                <Input value={email} onChange={(event) => setEmail(event.target.value)} name="email" type="email" placeholder="Correo" autoComplete="email" required maxLength={190} />
              </Field>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Contraseña segura" hint="Mínimo 12 caracteres y al menos tres tipos de caracteres.">
                  <Input value={password} onChange={(event) => setPassword(event.target.value)} name="password" type="password" placeholder="Contraseña única" autoComplete="new-password" required minLength={12} maxLength={128} />
                </Field>
                <Field label="Confirmar contraseña">
                  <Input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} name="confirmPassword" type="password" placeholder="Repite la contraseña" autoComplete="new-password" required minLength={12} maxLength={128} />
                </Field>
              </div>

              <RegistrationConsents value={consents} onChange={setConsents} />

              {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}
              <Button type="submit" disabled={!requiredConsentsAccepted || submitting}>
                {submitting ? 'Creando cuenta...' : 'Crear cuenta'}
              </Button>
            </form>
          </Card>
        </div>
      </main>
    </>
  );
}
