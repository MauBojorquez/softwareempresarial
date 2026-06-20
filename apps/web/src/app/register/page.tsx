"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Eye, EyeOff, Check } from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1Z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
    </svg>
  );
}

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", company: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);
  const [plan, setPlan] = useState<"STARTER" | "FREE">("STARTER");
  const router = useRouter();

  const passwordsMatch = form.password.length > 0 && form.password === form.confirm;
  const passwordLongEnough = form.password.length >= 8;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!passwordLongEnough) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, company: form.company, email: form.email, password: form.password, plan }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Error al registrar");
      setLoading(false);
      return;
    }

    const result = await signIn("credentials", { email: form.email, password: form.password, redirect: false });
    setLoading(false);

    if (result?.error) {
      setError("Cuenta creada pero no se pudo iniciar sesión automáticamente");
    } else {
      router.push("/dashboard/overview");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="w-full max-w-sm space-y-6 px-4 animate-fade-in-up">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="h-10 w-10 rounded-xl gradient-bg flex items-center justify-center shadow-lg shadow-primary/25 animate-float-logo group-hover:scale-105 transition-transform text-white">
              <Logo className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold">StratiuMetrics</span>
          </Link>
          <h1 className="mt-8 text-2xl font-bold">Crear Cuenta</h1>
          <p className="mt-1 text-sm text-muted-foreground">Elige cómo quieres empezar</p>
        </div>

        {/* Plan selector */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPlan("STARTER")}
            className={cn(
              "rounded-xl border p-3 text-left transition-all",
              plan === "STARTER" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border bg-card hover:border-primary/40"
            )}
          >
            <p className="text-sm font-semibold">Prueba 14 días</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Todo Starter. Cancela cuando quieras, no se te cobra.</p>
          </button>
          <button
            type="button"
            onClick={() => setPlan("FREE")}
            className={cn(
              "rounded-xl border p-3 text-left transition-all",
              plan === "FREE" ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border bg-card hover:border-primary/40"
            )}
          >
            <p className="text-sm font-semibold">Gratis</p>
            <p className="mt-0.5 text-xs text-muted-foreground">1 usuario, captura manual. Sin tarjeta.</p>
          </button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400 animate-slide-up">
            {error}
          </div>
        )}

        {/* Google first — most prominent */}
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard/overview" })}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-card py-2.5 text-sm font-medium text-foreground transition-all hover:bg-secondary hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5"
        >
          <GoogleIcon />
          Continuar con Google
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-background px-2 text-muted-foreground">o con tu correo</span></div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="reg-name" className="text-sm font-medium">Nombre</label>
            <input
              id="reg-name" type="text" value={form.name} required
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all"
            />
          </div>
          <div>
            <label htmlFor="reg-company" className="text-sm font-medium">Empresa</label>
            <input
              id="reg-company" type="text" value={form.company} required
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all"
            />
          </div>
          <div>
            <label htmlFor="reg-email" className="text-sm font-medium">Email</label>
            <input
              id="reg-email" type="email" value={form.email} required
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="tu@empresa.com"
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all"
            />
          </div>
          <div>
            <label htmlFor="reg-password" className="text-sm font-medium">Crear contraseña</label>
            <div className="relative mt-1">
              <input
                id="reg-password" type={show ? "text" : "password"} value={form.password} required minLength={8}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Mínimo 8 caracteres"
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all"
              />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={show ? "Ocultar" : "Mostrar"}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="reg-confirm" className="text-sm font-medium">Confirmar contraseña</label>
            <div className="relative mt-1">
              <input
                id="reg-confirm" type={show ? "text" : "password"} value={form.confirm} required
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                placeholder="Vuelve a escribir tu contraseña"
                className={cn(
                  "w-full rounded-lg border bg-card px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 transition-all",
                  form.confirm.length === 0
                    ? "border-border focus:border-primary focus:ring-primary/25"
                    : passwordsMatch
                      ? "border-emerald-500/50 focus:ring-emerald-500/25"
                      : "border-red-400/60 focus:ring-red-500/25"
                )}
              />
              {form.confirm.length > 0 && passwordsMatch && (
                <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
              )}
            </div>
            {form.confirm.length > 0 && !passwordsMatch && (
              <p className="mt-1 text-xs text-red-500">Las contraseñas no coinciden</p>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || !passwordsMatch || !passwordLongEnough}
            className="flex w-full items-center justify-center gap-2 rounded-lg gradient-bg py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 hover:shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0 pulse-glow"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Creando..." : "Crear Cuenta"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">Inicia Sesión</Link>
        </p>
      </div>
    </div>
  );
}
