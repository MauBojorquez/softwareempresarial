"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

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

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError("Email o contraseña incorrectos");
    } else {
      router.push("/dashboard/overview");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="w-full max-w-sm space-y-6 px-4 animate-fade-in-up">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 group">
            <div className="h-10 w-10 rounded-xl gradient-bg flex items-center justify-center shadow-lg shadow-purple-500/25 animate-float-logo group-hover:scale-105 transition-transform">
              <span className="text-sm font-bold text-white">S</span>
            </div>
            <span className="text-xl font-bold text-foreground">MetrixPro</span>
          </Link>
          <h1 className="mt-8 text-2xl font-bold text-foreground anim-d1">Iniciar Sesión</h1>
          <p className="mt-1 text-sm text-muted-foreground anim-d2">Ingresa a tu dashboard empresarial</p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400 animate-slide-up">
            {error}
          </div>
        )}

        <form className="space-y-4 anim-d2" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="login-email" className="text-sm font-medium text-foreground">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 focus:shadow-lg focus:shadow-purple-500/10 transition-all duration-200"
              placeholder="tu@empresa.com"
            />
          </div>
          <div>
            <label htmlFor="login-password" className="text-sm font-medium text-foreground">Contraseña</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 focus:shadow-lg focus:shadow-purple-500/10 transition-all duration-200"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg gradient-bg py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 hover:shadow-lg hover:shadow-purple-500/25 hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0 pulse-glow"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Entrando..." : "Iniciar Sesión"}
          </button>
        </form>

        <div className="relative anim-d3">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-2 text-muted-foreground">O continúa con</span>
          </div>
        </div>

        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard/overview" })}
          className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-card py-2.5 text-sm font-medium text-foreground transition-all hover:bg-secondary hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 anim-d4"
        >
          <GoogleIcon />
          Continuar con Google
        </button>

        <p className="text-center text-sm text-muted-foreground anim-d5">
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline transition-colors">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
