"use client";

import { CASHFLOW_ONLY_ENV, DEMO_CTA_URL } from "@/lib/app-mode";
import { ArrowRight } from "lucide-react";

export function DemoBanner() {
  if (!CASHFLOW_ONLY_ENV) return null;

  return (
    <div className="relative z-50 flex items-center justify-center gap-3 bg-gradient-to-r from-violet-600 via-primary to-indigo-600 px-4 py-2.5 text-white">
      <span className="text-xs font-medium sm:text-sm">
        Esta es una <strong>demo gratuita</strong> de Flujo de Efectivo
      </span>
      <a
        href={DEMO_CTA_URL}
        target="_blank"
        rel="noopener noreferrer"
        data-tour="cashflow-cta"
        className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold transition-colors hover:bg-white/30"
      >
        Crea el tuyo para tu negocio
        <ArrowRight className="h-3 w-3" />
      </a>
    </div>
  );
}
