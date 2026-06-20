"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, LayoutDashboard, Database, Plug, FileBarChart, Target,
  Bell, ArrowRight, ArrowLeft, X, Check,
} from "lucide-react";
import { Logo } from "@/components/logo";

const TOUR_KEY = "stratiumetrics-tour-v1";

type Step = {
  icon: typeof Sparkles;
  title: string;
  body: string;
  cta?: { label: string; href: string };
};

const STEPS: Step[] = [
  {
    icon: Sparkles,
    title: "Te damos la bienvenida a StratiuMetrics",
    body: "En 6 pasos rápidos te mostramos cómo centralizar las métricas de tu empresa: finanzas, ventas, operaciones, RRHH y marketing en un solo lugar.",
  },
  {
    icon: LayoutDashboard,
    title: "Tu Dashboard ejecutivo",
    body: "El Resumen reúne tus indicadores clave en una sola vista. Puedes personalizar qué secciones ver y arrastrarlas para reordenarlas con el botón “Personalizar”.",
  },
  {
    icon: Database,
    title: "Agrega tus datos",
    body: "Cada área (Finanzas, Ventas, etc.) te deja capturar datos a mano o importar un CSV. Las métricas se suman por mes automáticamente y puedes comparar periodos.",
    cta: { label: "Ir a Finanzas", href: "/dashboard/finance" },
  },
  {
    icon: Plug,
    title: "Conecta tus fuentes",
    body: "Vincula el SAT para datos fiscales, Meta Ads para campañas y HubSpot para tu CRM. Una vez conectadas, los números se actualizan solos.",
    cta: { label: "Ver integraciones", href: "/dashboard/integrations" },
  },
  {
    icon: Target,
    title: "Define metas y recibe alertas",
    body: "Establece objetivos por métrica y sube de nivel al cumplirlos. La IA detecta cambios importantes mes a mes y te avisa antes de que sea un problema.",
    cta: { label: "Crear una meta", href: "/dashboard/goals" },
  },
  {
    icon: Bell,
    title: "Activa las notificaciones push",
    body: "Toca la campana 🔔 arriba a la derecha y activa las notificaciones para enterarte al instante —en tu navegador o celular— de reportes listos y alertas inteligentes.",
  },
  {
    icon: FileBarChart,
    title: "Genera reportes con IA",
    body: "Con un clic, la IA analiza tus métricas y redacta un reporte ejecutivo con hallazgos y recomendaciones. Listo para compartir con tu equipo o socios.",
    cta: { label: "Generar mi primer reporte", href: "/dashboard/reports" },
  },
];

export function GuidedTour() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Show only on first visit. Wait a tick so the dashboard paints first.
    const seen = localStorage.getItem(TOUR_KEY);
    if (!seen) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  // Allow re-opening from anywhere via a custom event (e.g. a help menu).
  useEffect(() => {
    const handler = () => { setStep(0); setOpen(true); };
    window.addEventListener("stratiumetrics:start-tour", handler);
    return () => window.removeEventListener("stratiumetrics:start-tour", handler);
  }, []);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  const finish = () => {
    localStorage.setItem(TOUR_KEY, "done");
    setOpen(false);
  };

  const next = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else finish();
  };

  const prev = () => setStep((s) => Math.max(0, s - 1));

  const goCta = (href: string) => {
    finish();
    router.push(href);
  };

  if (!open) return null;

  const s = STEPS[step];
  const Icon = s.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Tour de bienvenida">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={finish} />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl animate-in fade-in zoom-in-95">
        {/* Header band */}
        <div className="relative aurora px-6 pt-6 pb-5 text-white">
          <div className="aurora-shine pointer-events-none absolute inset-0" />
          <button
            onClick={finish}
            aria-label="Cerrar tour"
            className="absolute right-3 top-3 rounded-lg p-1 text-white/80 hover:bg-white/15 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="relative flex items-center gap-2">
            <Logo className="h-7 w-7" />
            <span className="text-xs font-medium text-white/85">StratiuMetrics</span>
          </div>
          <div className="relative mt-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
            <Icon className="h-6 w-6" />
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <h2 className="text-lg font-bold tracking-tight">{s.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>

          {s.cta && (
            <button
              onClick={() => goCta(s.cta!.href)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              {s.cta.label} <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Progress dots */}
          <div className="mt-6 flex items-center justify-center gap-1.5">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                aria-label={`Paso ${i + 1}`}
                className={
                  i === step
                    ? "h-1.5 w-6 rounded-full gradient-bg transition-all"
                    : "h-1.5 w-1.5 rounded-full bg-secondary transition-all hover:bg-muted-foreground/40"
                }
              />
            ))}
          </div>

          {/* Nav */}
          <div className="mt-5 flex items-center justify-between">
            <button
              onClick={step === 0 ? finish : prev}
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary"
            >
              {step === 0 ? "Omitir" : (<><ArrowLeft className="h-3.5 w-3.5" /> Anterior</>)}
            </button>
            <button
              onClick={next}
              className="flex items-center gap-1.5 rounded-lg gradient-bg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            >
              {isLast ? (<>Empezar <Check className="h-4 w-4" /></>) : (<>Siguiente <ArrowRight className="h-4 w-4" /></>)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Fire this from anywhere to re-open the tour (e.g. a “?” help button). */
export function startGuidedTour() {
  window.dispatchEvent(new Event("stratiumetrics:start-tour"));
}
