"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function FinanceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Finance route error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-2xl bg-[#FF4444]/10 flex items-center justify-center mb-4">
        <AlertTriangle size={22} className="text-[#FF4444]" />
      </div>
      <h2 className="text-base font-semibold mb-1">No se pudo cargar Finanzas</h2>
      <p className="text-sm text-muted-foreground max-w-sm mb-5">
        Ocurrió un error al mostrar esta sección. Puedes reintentar; si persiste, recarga la página.
      </p>
      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3D7FFF] text-white text-sm font-medium hover:bg-[#3D7FFF]/80 transition-colors"
      >
        <RefreshCw size={14} />
        Reintentar
      </button>
    </div>
  );
}
