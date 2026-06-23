"use client";

import { useEffect } from "react";
import { setCashflowOnly } from "@/lib/app-mode";

/**
 * Turns off the per-browser cashflow-only demo mode and restores the full app.
 */
export default function SalirDemo() {
  useEffect(() => {
    setCashflowOnly(false);
    window.location.replace("/dashboard/overview");
  }, []);

  return (
    <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
      Restaurando la vista completa…
    </div>
  );
}
