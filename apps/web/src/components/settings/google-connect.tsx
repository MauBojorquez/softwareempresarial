"use client";

import { useEffect, useState } from "react";
import { Mail, RotateCcw, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/ui/confirm";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/states";
import { SettingsSection } from "@/components/settings/section";

type Status = {
  connected: boolean;
  googleEmail?: string;
  connectedAt?: string;
  lastUsedAt?: string | null;
  lastError?: string | null;
};

const RESULT_MSG: Record<string, { text: string; type: "success" | "error" | "info" }> = {
  ok: { text: "Google conectado. Desde mañana tus pendientes incluirán tu correo y reuniones.", type: "success" },
  cancelado: { text: "Cancelaste la conexión con Google.", type: "info" },
  permisos_incompletos: { text: "Faltó aceptar algún permiso (Gmail y Drive). Inténtalo de nuevo marcando todos.", type: "error" },
  no_configurado: { text: "La conexión con Google aún no está configurada. Avísale a Dirección.", type: "error" },
  error: { text: "No se pudo conectar Google. Inténtalo de nuevo.", type: "error" },
};

/** Per-user Google (Gmail + Drive read-only) connection for the 9:50 pendientes. */
export function GoogleConnectCard({ id = "google" }: { id?: string }) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [status, setStatus] = useState<Status | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoadError(null);
    try {
      const r = await fetch("/api/google");
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((data as { error?: string }).error || `Error ${r.status}`);
      setStatus(data as Status);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Sin conexión con el servidor.");
    }
  };

  useEffect(() => {
    load();
    // Show the result of the OAuth round-trip once, then clean the URL.
    const params = new URLSearchParams(window.location.search);
    const result = params.get("google");
    if (result && RESULT_MSG[result]) {
      const detalle = params.get("detalle");
      toast(RESULT_MSG[result].text + (detalle ? ` (código: ${detalle})` : ""), RESULT_MSG[result].type);
      params.delete("google");
      params.delete("detalle");
      const qs = params.toString();
      window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disconnect = async () => {
    const ok = await confirm({
      title: "Desconectar Google",
      description: "¿Desconectar tu Google? Tus pendientes ya no incluirán tu correo ni tus reuniones.",
      confirmLabel: "Desconectar",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch("/api/google", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "No se pudo desconectar");
      }
      toast("Google desconectado", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo desconectar", "error");
    }
    setBusy(false);
  };

  return (
    <SettingsSection
      id={id}
      icon={Mail}
      title="Mi correo y reuniones (Google)"
      description="Cada mañana a las 9:50 te llega un correo con tus pendientes. Si conectas tu Google, la IA también revisa tus correos y las notas de Gemini de tus reuniones de Meet para detectar compromisos y seguimientos."
    >
      <div className="flex items-start gap-2 rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
        <span>
          Solo lectura. Tus correos no se guardan: se leen al momento y el resultado te llega solo a ti. Nadie más
          del equipo, ni Dirección, ve tu correo. Puedes desconectarlo cuando quieras.
        </span>
      </div>

      {loadError ? (
        <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
          <p className="flex-1 text-sm text-destructive">No se pudo consultar tu conexión con Google: {loadError}</p>
          <Button variant="outline" size="sm" onClick={load}>
            <RotateCcw /> Reintentar
          </Button>
        </div>
      ) : status === null ? (
        <div className="space-y-2" aria-busy="true" aria-label="Cargando">
          <Skeleton className="h-4 w-56" />
          <Skeleton className="h-10 w-40" />
        </div>
      ) : status.connected ? (
        <div className="space-y-2">
          <p className="text-sm">
            Conectado como <span className="font-medium">{status.googleEmail || "tu cuenta de Google"}</span>
          </p>
          {status.lastError && (
            <p className="text-xs text-destructive">
              La última lectura falló. Si revocaste el acceso en Google, vuelve a conectar.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <a href="/api/google/connect" className={buttonVariants({ variant: "outline" })}>
              Volver a conectar
            </a>
            <Button
              variant="outline"
              onClick={disconnect}
              loading={busy}
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              Desconectar
            </Button>
          </div>
        </div>
      ) : (
        <a href="/api/google/connect" className={buttonVariants({ variant: "default" })}>
          Conectar mi Google
        </a>
      )}
    </SettingsSection>
  );
}
