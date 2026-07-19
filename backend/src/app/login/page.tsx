'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Button, Card, Input } from '@/components/ui';
import { apiFetch } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    try {
      const data = await apiFetch<{ user: { role: string } }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
      });
      router.push(data.user.role === 'ADMIN' ? '/admin/dashboard' : '/client/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar sesión');
    }
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-md px-6 py-12">
        <Card>
          <h1 className="font-title text-4xl text-aqua">Ingresar</h1>
          <form onSubmit={onSubmit} className="mt-6 grid gap-4">
            <Input name="email" type="email" placeholder="Correo" required />
            <Input name="password" type="password" placeholder="Contraseña" required />
            {error && <p className="text-sm font-bold text-red-600">{error}</p>}
            <Button type="submit">Entrar</Button>
          </form>
        </Card>
      </main>
    </>
  );
}
