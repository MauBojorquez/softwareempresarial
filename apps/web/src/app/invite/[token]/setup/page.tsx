"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, Eye, EyeOff, Check, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function InviteSetupPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();

  const [invite, setInvite] = useState<{ email: string; orgName: string } | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [form, setForm] = useState({ name: "", password: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Pre-load invite details — GET only, no side effects
  useEffect(() => {
    fetch(`/api/invitations/preview?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setInviteError(d.error);
        } else {
          setInvite({ email: d.email, orgName: d.orgName });
        }
      })
      .catch(() => setInviteError("Error de conexión"));
  }, [token]);

  const passwordsMatch = form.password.length > 0 && form.password === form.confirm;
  const passwordOk = form.password.length >= 8;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordOk || !passwordsMatch) return;
    setError("");
    setLoading(true);

    const res = await fetch("/api/invitations/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name: form.name, password: form.password }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? "Error al crear tu cuenta");
      setLoading(false);
      return;
    }

    // Sign in automatically
    const result = await signIn("credentials", {
      email: data.email,
      password: form.password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Cuenta creada pero no se pudo iniciar sesión. Ve al inicio de sesión.");
    } else {
      setDone(true);
      setTimeout(() => router.push("/dashboard/overview"), 2000);
    }
  }

  if (inviteError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
          <div className="mb-2 text-3xl font-bold tracking-tight gradient-text">MetrixPro</div>
          <XCircle className="mx-auto mt-6 h-12 w-12 text-destructive" />
          <h2 className="mt-4 text-xl font-semibold">Invitación inválida</h2>
          <p className="mt-2 text-sm text-muted-foreground">{inviteError}</p>
          <a href="/login" className="mt-6 inline-block rounded-xl gradient-bg px-6 py-2.5 text-sm font-medium text-white">
            Ir al inicio
          </a>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
          <div className="mb-2 text-3xl font-bold tracking-tight gradient-text">MetrixPro</div>
          <Check className="mx-auto mt-6 h-12 w-12 text-emerald-500" />
          <h2 className="mt-4 text-xl font-semibold">¡Bienvenido a {invite.orgName}!</h2>
          <p className="mt-2 text-sm text-muted-foreground">Entrando al dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="w-full max-w-sm space-y-6 px-4">
        <div className="text-center">
          <div className="text-3xl font-bold tracking-tight gradient-text">MetrixPro</div>
          <h1 className="mt-6 text-2xl font-bold">Únete a {invite.orgName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Fuiste invitado como <span className="font-medium text-foreground">{invite.email}</span>. Crea tu contraseña para entrar.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Email — read-only, pre-filled from invitation */}
          <div>
            <label className="text-sm font-medium">Correo electrónico</label>
            <input
              type="email"
              value={invite.email}
              readOnly
              className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-3 py-2.5 text-sm text-muted-foreground cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="setup-name" className="text-sm font-medium">Tu nombre</label>
            <input
              id="setup-name"
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Ej. Anahí García"
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all"
            />
          </div>

          <div>
            <label htmlFor="setup-password" className="text-sm font-medium">Crear contraseña</label>
            <div className="relative mt-1">
              <input
                id="setup-password"
                type={show ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
                placeholder="Mínimo 8 caracteres"
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 transition-all"
              />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="setup-confirm" className="text-sm font-medium">Confirmar contraseña</label>
            <div className="relative mt-1">
              <input
                id="setup-confirm"
                type={show ? "text" : "password"}
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                required
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
            disabled={loading || !form.name.trim() || !passwordOk || !passwordsMatch}
            className="flex w-full items-center justify-center gap-2 rounded-lg gradient-bg py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Creando cuenta..." : "Crear cuenta y entrar"}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <a href={`/login?callbackUrl=/invite/${token}`} className="font-medium text-primary hover:underline">
            Inicia sesión
          </a>
        </p>
      </div>
    </div>
  );
}
