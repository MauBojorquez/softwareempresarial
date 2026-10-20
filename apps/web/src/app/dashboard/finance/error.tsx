"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FinanceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Finance route error:", error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <h2 className="mb-1 text-base font-semibold">No se pudo cargar Finanzas</h2>
      <p className="mb-5 max-w-sm text-sm text-muted-foreground">
        Ocurrió un error al mostrar esta sección. Puedes reintentar; si persiste, recarga la página.
      </p>
      <Button onClick={reset}>
        <RotateCcw />
        Reintentar
      </Button>
    </div>
  );
}
