"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  Loader2,
  ShieldCheck,
  Upload,
  Eye,
  EyeOff,
} from "lucide-react";

type Step = "privacy" | "credentials" | "success";

export default function SatConnectionPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("privacy");
  const [accepted, setAccepted] = useState(false);

  // Credentials form state
  const [rfc, setRfc] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [cerFile, setCerFile] = useState<File | null>(null);
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cerRef = useRef<HTMLInputElement>(null);
  const keyRef = useRef<HTMLInputElement>(null);

  const handleConnect = async () => {
    if (!rfc || !cerFile || !keyFile || !password) {
      setError("Por favor completa todos los campos.");
      return;
    }
    setError(null);
    setUploading(true);

    try {
      const form = new FormData();
      form.append("rfc", rfc.trim().toUpperCase());
      form.append("cer", cerFile);
      form.append("key", keyFile);
      form.append("password", password);

      const res = await fetch("/api/integrations/sat/connect", {
        method: "POST",
        body: form,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Error al conectar con el SAT");
      }

      setStep("success");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error inesperado. Intenta de nuevo.",
      );
    } finally {
      setUploading(false);
    }
  };

  // ── Step 1: Privacy notice ───────────────────────────────────────────────
  if (step === "privacy") {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Conecta tu RFC al SAT
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Importa tus CFDIs automáticamente para ver tus finanzas reales.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-6 w-6 text-emerald-500 mt-0.5 shrink-0" />
            <div>
              <h2 className="font-semibold text-sm">Aviso de Privacidad</h2>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Para importar tus facturas nos conectamos directamente al
                servicio de <strong>Descarga Masiva del SAT</strong> usando tu{" "}
                <strong>e.firma (FIEL)</strong>. Tu e.firma se cifra con{" "}
                <strong>AES-256</strong> y se almacena siempre cifrada en
                nuestros servidores. Se usa únicamente para descargar tus CFDIs
                desde el SAT y puedes eliminarla en cualquier momento al
                desconectar la integración.
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-secondary/40 p-4 space-y-2 text-sm">
            <p className="font-medium text-foreground">
              ¿Qué datos se comparten?
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Tu RFC (identificador fiscal)</li>
              <li>Tu e.firma/FIEL (.cer + .key + contraseña)</li>
              <li>
                Tus CFDIs emitidos y recibidos (facturas de ingresos y egresos)
              </li>
            </ul>
          </div>

          <div className="rounded-lg bg-secondary/40 p-4 space-y-2 text-sm">
            <p className="font-medium text-foreground">
              ¿Qué NO hacemos con tus datos?
            </p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Nunca guardamos tu e.firma ni tu contraseña en texto plano</li>
              <li>No compartimos tu información con terceros</li>
              <li>
                Puedes revocar el acceso y borrar tu e.firma en cualquier
                momento al desconectar esta integración
              </li>
            </ul>
          </div>

          <div className="flex items-start gap-3 pt-1">
            <input
              id="accept-privacy"
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border accent-primary cursor-pointer"
            />
            <label
              htmlFor="accept-privacy"
              className="text-sm cursor-pointer leading-relaxed"
            >
              Acepto el Aviso de Privacidad y autorizo el uso de mi e.firma
              (FIEL) para descargar mis CFDIs del SAT y calcular mis métricas
              financieras en StratiuMetrics.
            </label>
          </div>

          <button
            disabled={!accepted}
            onClick={() => setStep("credentials")}
            className="w-full rounded-lg gradient-bg py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continuar
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Upload credentials ───────────────────────────────────────────
  if (step === "credentials") {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <div>
          <button
            onClick={() => setStep("privacy")}
            className="text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
          >
            ← Volver
          </button>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Sube tu e.firma (FIEL)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Sube los archivos .cer y .key de tu <strong>e.firma (FIEL)</strong>{" "}
            (no del CSD). Se cifran con AES-256 y se almacenan siempre cifrados.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          {/* RFC */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">RFC</label>
            <input
              type="text"
              placeholder="XAXX010101000"
              value={rfc}
              onChange={(e) => setRfc(e.target.value.toUpperCase())}
              maxLength={13}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* .cer file */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Certificado (.cer)
            </label>
            <div
              onClick={() => cerRef.current?.click()}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-secondary/20 px-4 py-3 text-sm transition-colors hover:bg-secondary/40"
            >
              <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className={cerFile ? "text-foreground" : "text-muted-foreground"}>
                {cerFile ? cerFile.name : "Seleccionar archivo .cer"}
              </span>
            </div>
            <input
              ref={cerRef}
              type="file"
              accept=".cer"
              className="hidden"
              onChange={(e) => setCerFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* .key file */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Llave privada (.key)
            </label>
            <div
              onClick={() => keyRef.current?.click()}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-secondary/20 px-4 py-3 text-sm transition-colors hover:bg-secondary/40"
            >
              <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className={keyFile ? "text-foreground" : "text-muted-foreground"}>
                {keyFile ? keyFile.name : "Seleccionar archivo .key"}
              </span>
            </div>
            <input
              ref={keyRef}
              type="file"
              accept=".key"
              className="hidden"
              onChange={(e) => setKeyFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Contraseña de e.firma
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Contraseña de tu e.firma"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            disabled={uploading || !rfc || !cerFile || !keyFile || !password}
            onClick={handleConnect}
            className="w-full rounded-lg gradient-bg py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
            {uploading ? "Conectando..." : "Conectar con el SAT"}
          </button>
        </div>
      </div>
    );
  }

  // ── Step 3: Success ──────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="rounded-xl border border-border bg-card p-8 text-center space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <CheckCircle className="h-9 w-9 text-emerald-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Conectado</h2>
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            Ya solicitamos tus CFDIs al SAT. El SAT puede tardar entre 24 y 72
            horas en preparar la primera descarga; tus datos aparecerán
            automáticamente en cuanto estén listos. No necesitas hacer nada
            más.
          </p>
        </div>
        <button
          onClick={() => router.push("/dashboard")}
          className="w-full rounded-lg gradient-bg py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Ver mis métricas financieras
        </button>
        <button
          onClick={() => router.push("/dashboard/integrations")}
          className="w-full rounded-lg bg-secondary/50 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
        >
          Volver a Integraciones
        </button>
      </div>
    </div>
  );
}
