"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, UserRound } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button, Card, Field, Input } from "@/components/ui";
import { ApiError, apiFetch } from "@/lib/api";

type LoginMode = "CLIENT" | "ADMIN";

function safeNextPath(value: string | null, role: string) {
  const fallback = role === "ADMIN" ? "/admin/dashboard" : "/client/dashboard";
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  if (role === "ADMIN" && !value.startsWith("/admin")) return fallback;
  if (role !== "ADMIN" && !value.startsWith("/client")) return fallback;
  return value;
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<LoginMode>("CLIENT");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("role") === "admin") setMode("ADMIN");
    if (params.get("registered") === "1") setNotice("Cuenta creada. Ya puedes iniciar sesión.");
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      email: form.get("email"),
      password: form.get("password"),
      ...(mode === "ADMIN" ? { otp: form.get("otp") } : {}),
    };

    try {
      const data = await apiFetch<{ user: { role: string } }>(
        mode === "ADMIN" ? "/auth/admin/login" : "/auth/login",
        { method: "POST", body: JSON.stringify(payload) },
      );
      const params = new URLSearchParams(window.location.search);
      const next = safeNextPath(params.get("next"), data.user.role);
      router.refresh();
      router.push(next);
    } catch (err) {
      if (mode === "ADMIN" && err instanceof ApiError && err.status === 428) {
        router.push("/admin/security/setup");
        return;
      }
      setError(err instanceof Error ? err.message : "Error al iniciar sesión");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <AppHeader />
      <main className="min-h-[calc(100vh-88px)] bg-[radial-gradient(circle_at_top,rgba(0,193,193,0.16),transparent_34%)] px-6 py-12">
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-[0.9fr_1.1fr] md:items-start">
          <Card className="!bg-aqua text-white">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-yellowBrand">Acceso</p>
            <h1 className="mt-3 font-title text-5xl leading-tight text-yellowBrand">Bienvenido. Lava fácil, vive fresco 😎</h1>
            {mode === "ADMIN" && (
              <div className="mt-6 rounded-3xl bg-slate-950/20 p-4 text-sm leading-6 text-white/90">
                El acceso administrativo usa contraseña individual, bloqueo por intentos y autenticación de dos factores. Nunca compartas tu cuenta ni códigos MFA.
              </div>
            )}
          </Card>

          <Card>
            <div className="grid grid-cols-2 gap-2 rounded-3xl bg-slate-100 p-2">
              <button
                type="button"
                onClick={() => { setMode("CLIENT"); setError(""); }}
                className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${mode === "CLIENT" ? "bg-white text-aqua shadow-sm" : "text-slate-500"}`}>
                <UserRound size={18} /> Usuario
              </button>
              <button
                type="button"
                onClick={() => { setMode("ADMIN"); setError(""); }}
                className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black transition ${mode === "ADMIN" ? "bg-white text-aqua shadow-sm" : "text-slate-500"}`}>
                <ShieldCheck size={18} /> Admin
              </button>
            </div>

            <form onSubmit={onSubmit} className="mt-6 grid gap-4">
              <Field label="Correo">
                <Input
                  name="email"
                  type="email"
                  placeholder={mode === "ADMIN" ? "correo administrativo" : "tu-correo@email.com"}
                  autoComplete="email"
                  required
                />
              </Field>
              <Field label="Contraseña" hint={mode === "ADMIN" ? "La contraseña administrativa es individual y nunca se comparte." : "Usa la contraseña única de tu cuenta."}>
                <Input name="password" type="password" placeholder="Contraseña" autoComplete="current-password" required minLength={12} maxLength={128} />
              </Field>

              {mode === "ADMIN" && (
                <Field label="Código de seguridad" hint="Código de 6 dígitos del autenticador o un código de recuperación. En el primer acceso puede dejarse vacío.">
                  <Input name="otp" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" maxLength={24} />
                </Field>
              )}

              {notice && <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{notice}</p>}
              {error && <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}
              <Button type="submit" variant={mode === "ADMIN" ? "dark" : "primary"} disabled={submitting}>
                {submitting ? "Verificando..." : mode === "ADMIN" ? "Entrar al dashboard admin" : "Entrar como usuario"}
              </Button>
              {mode === "CLIENT" && (
                <p className="text-center text-sm text-slate-500">
                  ¿No tienes cuenta?{" "}
                  <a href="/register" className="font-black text-aqua">Crear cuenta</a>
                </p>
              )}
            </form>
          </Card>
        </div>
      </main>
    </>
  );
}
