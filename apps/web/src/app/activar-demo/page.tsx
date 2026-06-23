"use client";

import { useEffect } from "react";
import { setCashflowOnly, CASHFLOW_HOME } from "@/lib/app-mode";

/**
 * Turns on the cashflow-only presentation mode for THIS browser only and sends
 * the user straight to Flujo de Efectivo. Used for live demos — production
 * users are unaffected. Undo by visiting /salir-demo.
 */
export default function ActivarDemo() {
  useEffect(() => {
    setCashflowOnly(true);
    window.location.replace(CASHFLOW_HOME);
  }, []);

  return (
    <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
      Activando vista de Flujo de Efectivo…
    </div>
  );
}
