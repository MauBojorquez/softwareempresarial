"use client";

import { useState, useEffect } from "react";
import { CheckCircle, ArrowRight, Sparkles, Database, Link2, FileBarChart } from "lucide-react";

const STEPS = [
  { id: "profile", label: "Configura tu perfil", description: "Personaliza tu experiencia", href: "/dashboard/settings", icon: Sparkles },
  { id: "data", label: "Agrega tus datos", description: "Manual o importa CSV", href: "/dashboard/finance", icon: Database },
  { id: "integration", label: "Conecta integraciones", description: "SAT, Meta Ads, HubSpot", href: "/dashboard/integrations", icon: Link2 },
  { id: "report", label: "Genera tu primer reporte", description: "Análisis con IA", href: "/dashboard/reports", icon: FileBarChart },
];

export function Onboarding() {
  const [completed, setCompleted] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("metrixpro-onboarding");
    if (stored === "dismissed") { setDismissed(true); return; }
    if (stored) try { setCompleted(JSON.parse(stored)); } catch {}
  }, []);

  const complete = (id: string) => {
    const next = [...new Set([...completed, id])];
    setCompleted(next);
    localStorage.setItem("metrixpro-onboarding", JSON.stringify(next));
  };

  const dismiss = () => {
    setDismissed(true);
    localStorage.setItem("metrixpro-onboarding", "dismissed");
  };

  if (dismissed) return null;

  const progress = Math.round((completed.length / STEPS.length) * 100);

  return (
    <div className="rounded-xl border border-primary/20 bg-card p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold sm:text-base">Bienvenido a MetrixPro</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Completa estos pasos para aprovechar al máximo la plataforma</p>
        </div>
        <button onClick={dismiss} className="text-xs text-muted-foreground hover:text-foreground">
          Omitir
        </button>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">{completed.length} de {STEPS.length} completados</span>
          <span className="font-medium">{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-secondary/50">
          <div className="h-2 rounded-full gradient-bg transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
        {STEPS.map((step) => {
          const done = completed.includes(step.id);
          return (
            <a
              key={step.id}
              href={step.href}
              onClick={() => complete(step.id)}
              className="flex items-center gap-3 rounded-lg border border-border p-3 text-sm hover:bg-secondary/50 transition-colors"
            >
              <div className="shrink-0">
                {done ? (
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                ) : (
                  <step.icon className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={done ? "font-medium line-through text-muted-foreground" : "font-medium"}>{step.label}</p>
                <p className="text-xs text-muted-foreground truncate">{step.description}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </a>
          );
        })}
      </div>
    </div>
  );
}
