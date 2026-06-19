"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";

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

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email o contraseña incorrectos");
    } else {
      router.push("/dashboard/overview");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="animate-fade-in-up w-full max-w-sm space-y-6 px-4">
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 animate-float">
            <div className="h-8 w-8 rounded-lg gradient-bg flex items-center justify-center">
              <span className="text-xs font-bold text-white">S</span>
            </div>
            <span className="text-xl font-bold text-foreground">MetrixPro</span>
          </Link>
          <h1 className="mt-8 text-2xl font-bold text-foreground">Iniciar Sesión</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ingresa a tu dashboard empresarial</p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="login-email" className="text-sm font-medium text-foreground">Email</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all duration-200"
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
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 transition-all duration-200"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg gradient-bg py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Iniciar Sesión
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-2 text-muted-foreground">O continúa con</span>
          </div>
        </div>

        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard/overview" })}
          className="w-full rounded-lg border border-border bg-card py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
        >
          Google
        </button>

        <p className="text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  );
}
