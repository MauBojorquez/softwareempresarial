"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="rounded-full bg-destructive/10 p-4 mb-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold">Algo salió mal</h2>
      <p className="mt-2 text-sm text-muted-foreground text-center max-w-md">
        Ocurrió un error al cargar esta página. Intenta recargar o vuelve al inicio.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </button>
        <a
          href="/dashboard/overview"
          className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-secondary transition-colors"
        >
          Ir al Dashboard
        </a>
      </div>
    </div>
  );
}
