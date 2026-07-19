'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Button, Card, Input } from '@/components/ui';
import { apiFetch } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: form.get('name'), email: form.get('email'), phone: form.get('phone'), password: form.get('password') }),
      });
      router.push('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear cuenta');
    }
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-md px-6 py-12">
        <Card>
          <h1 className="font-title text-4xl text-aqua">Crear usuario</h1>
          <form onSubmit={onSubmit} className="mt-6 grid gap-4">
            <Input name="name" placeholder="Nombre completo" required />
            <Input name="email" type="email" placeholder="Correo" required />
            <Input name="phone" placeholder="Celular" />
            <Input name="password" type="password" placeholder="Contraseña segura" required minLength={8} />
            {error && <p className="text-sm font-bold text-red-600">{error}</p>}
            <Button type="submit">Crear cuenta</Button>
          </form>
        </Card>
      </main>
    </>
  );
}
