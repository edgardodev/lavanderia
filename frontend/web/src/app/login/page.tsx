"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserRound } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { adminProfiles } from "@/lib/constants";
import { apiFetch } from "@/lib/api";

type LoginMode = "CLIENT" | "ADMIN";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("CLIENT");
  const [error, setError] = useState("");

  useEffect(() => {
    const queryMode = new URLSearchParams(window.location.search).get("role");
    if (queryMode === "admin") setMode("ADMIN");
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      email: form.get("email"),
      password: form.get("password"),
      role: mode,
      adminProfile: mode === "ADMIN" ? form.get("adminProfile") : undefined,
    };

    try {
      const data = await apiFetch<{ user: { role: string } }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");
      router.refresh();
      if (next) {
        router.push(next);
        return;
      }
      router.push(data.user.role === "ADMIN" ? "/admin/dashboard" : "/client/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    }
  }

  return (
    <>
      <AppHeader />
      <main className="min-h-[calc(100vh-88px)] bg-[radial-gradient(circle_at_top,rgba(0,193,193,0.16),transparent_34%)] px-6 py-12">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-start">
          <Card className="!bg-aqua text-white">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-yellowBrand">Acceso</p>
            <h1 className="mt-3 font-title text-5xl leading-tight text-yellowBrand">
              Bienvenido. Lava fácil, vive fresco 😎
            </h1>
          </Card>

          <Card>
            <div className="grid grid-cols-2 gap-2 rounded-3xl bg-slate-100 p-2">
              <button
                type="button"
                onClick={() => setMode("CLIENT")}
                className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${mode === "CLIENT" ? "bg-white text-aqua shadow-sm" : "text-slate-500"}`}>
                <UserRound size={18} /> Usuario
              </button>
              <button
                type="button"
                onClick={() => setMode("ADMIN")}
                className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${mode === "ADMIN" ? "bg-white text-aqua shadow-sm" : "text-slate-500"}`}>
                <ShieldCheck size={18} /> Admin
              </button>
            </div>

            <form onSubmit={onSubmit} className="mt-6 grid gap-4">
              {mode === "ADMIN" && (
                <Field
                  label="Perfil de administrador"
                  hint="La contraseña real se valida en backend con hash fuerte, bloqueo por intentos y auditoría.">
                  <Select name="adminProfile" required>
                    {adminProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.label} · {profile.scope}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Correo">
                <Input
                  name="email"
                  type="email"
                  placeholder={mode === "ADMIN" ? "admin@lalavanderia.com" : "tu-correo@email.com"}
                  autoComplete="email"
                  required
                />
              </Field>
              <Field
                label="Contraseña"
                hint="Mínimo recomendado: 12 caracteres, mayúsculas, minúsculas, número y símbolo.">
                <Input
                  name="password"
                  type="password"
                  placeholder="Contraseña segura"
                  autoComplete={mode === "ADMIN" ? "current-password" : "current-password"}
                  required
                  minLength={8}
                />
              </Field>
              {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}
              <Button type="submit" variant={mode === "ADMIN" ? "dark" : "primary"}>
                {mode === "ADMIN" ? "Entrar al dashboard admin" : "Entrar como usuario"}
              </Button>
              <p className="text-center text-sm text-slate-500">
                ¿No tienes cuenta?{" "}
                <a href="/register" className="font-black text-aqua">
                  Crear cuenta
                </a>
              </p>
            </form>
          </Card>
        </div>
      </main>
    </>
  );
}
