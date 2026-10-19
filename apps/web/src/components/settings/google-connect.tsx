"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, ShieldCheck } from "lucide-react";
import { useToast } from "@/components/toast";

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
export function GoogleConnectCard() {
  const { toast } = useToast();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    fetch("/api/google")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ connected: false }));

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
    if (!confirm("¿Desconectar tu Google? Tus pendientes ya no incluirán tu correo ni tus reuniones.")) return;
    setBusy(true);
    try {
      await fetch("/api/google", { method: "DELETE" });
      toast("Google desconectado", "success");
      await load();
    } catch {
      toast("No se pudo desconectar", "error");
    }
    setBusy(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Mail className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Mi correo y reuniones (Google)</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Cada mañana a las 9:50 te llega un correo con tus pendientes. Si conectas tu Google, la IA también revisa
        tus correos y las notas de Gemini de tus reuniones de Meet para detectar compromisos y seguimientos.
      </p>
      <div className="flex items-start gap-2 rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
        <span>
          Solo lectura. Tus correos no se guardan: se leen al momento y el resultado te llega solo a ti. Nadie más
          del equipo, ni Dirección, ve tu correo. Puedes desconectarlo cuando quieras.
        </span>
      </div>

      {status === null ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : status.connected ? (
        <div className="space-y-2">
          <p className="text-sm">
            Conectado como <span className="font-medium">{status.googleEmail || "tu cuenta de Google"}</span>
          </p>
          {status.lastError && (
            <p className="text-xs text-red-500">
              La última lectura falló. Si revocaste el acceso en Google, vuelve a conectar.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <a
              href="/api/google/connect"
              className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
            >
              Volver a conectar
            </a>
            <button
              onClick={disconnect}
              disabled={busy}
              className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-500 hover:bg-red-500/10 disabled:opacity-60"
            >
              Desconectar
            </button>
          </div>
        </div>
      ) : (
        <a
          href="/api/google/connect"
          className="inline-flex items-center gap-2 rounded-lg gradient-bg px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
        >
          Conectar mi Google
        </a>
      )}
    </div>
  );
}
