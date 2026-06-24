"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, X, Check } from "lucide-react";
import { readCashflowOnly, CASHFLOW_HOME } from "@/lib/app-mode";

type Step = {
  /** CSS selector of the element to highlight. */
  selector: string;
  /** Route to navigate to before showing this step. */
  route?: string;
  title: string;
  body: string;
};

const FULL_STEPS: Step[] = [
  {
    selector: '[data-tour="/dashboard/overview"]',
    route: "/dashboard/overview",
    title: "Tu Resumen",
    body: "Aquí ves de un vistazo los números más importantes de tu empresa. Puedes personalizar y reordenar las secciones.",
  },
  {
    selector: '[data-tour="/dashboard/finance"]',
    route: "/dashboard/finance",
    title: "Captura tus datos",
    body: "En cada área agregas datos a mano o importas un CSV. Aquí está Finanzas; Ventas, Operaciones y RRHH funcionan igual.",
  },
  {
    selector: '[data-tour="/dashboard/integrations"]',
    route: "/dashboard/integrations",
    title: "Conecta tus fuentes",
    body: "Vincula el SAT, Meta Ads y HubSpot para que los números se actualicen solos, sin capturar nada a mano.",
  },
  {
    selector: '[data-tour="/dashboard/goals"]',
    route: "/dashboard/goals",
    title: "Define tus metas",
    body: "Pon objetivos por métrica y mira tu avance. Subes de nivel conforme las cumples.",
  },
  {
    selector: '[data-tour="/dashboard/reports"]',
    route: "/dashboard/reports",
    title: "Reportes con IA",
    body: "Con un clic, la IA analiza tus métricas y redacta un reporte ejecutivo listo para compartir.",
  },
  {
    selector: '[data-tour="notifications"]',
    title: "Mantente al tanto",
    body: "Activa las notificaciones aquí 🔔 para enterarte —en tu celular o navegador— cuando un reporte esté listo o una métrica cambie de forma importante.",
  },
];

// In cashflow-only mode the tour teaches just the three things that matter:
// add a bank, add movements, and acquire your own personalized version.
const CASHFLOW_STEPS: Step[] = [
  {
    selector: '[data-tour="cashflow-dashboard"]',
    route: CASHFLOW_HOME,
    title: "Tu Dashboard",
    body: "Aquí ves el resumen de tu flujo de efectivo: total de depósitos, retiros y saldo de todas tus cuentas.",
  },
  {
    selector: '[data-tour="cashflow-add-account"]',
    route: CASHFLOW_HOME,
    title: "1. Agrega tu banco",
    body: "Haz clic en «Agregar cuenta» para registrar un banco. Pones nombre, banco y saldo inicial.",
  },
  {
    selector: '[data-tour="cashflow-add-account"]',
    route: CASHFLOW_HOME,
    title: "2. Agrega tus movimientos",
    body: "Al entrar a una cuenta, usa «Agregar fila» para registrar cada depósito y retiro. El saldo se calcula solo.",
  },
  {
    selector: '[data-tour="cashflow-cta"]',
    route: CASHFLOW_HOME,
    title: "3. Adquiere el tuyo",
    body: "¿Te gustó? Arriba puedes adquirir tu propio dashboard personalizado para tu negocio, con tu logo y tus datos.",
  },
];

const CASHFLOW_ONLY = typeof window !== "undefined" && readCashflowOnly();
const STEPS = CASHFLOW_ONLY ? CASHFLOW_STEPS : FULL_STEPS;
const TOUR_KEY = CASHFLOW_ONLY ? "cashflow-tour-v1" : "stratiumetrics-tour-v2";

const PADDING = 8;

export function GuidedTour() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const rafRef = useRef<number>();

  const start = useCallback(() => { setStep(0); setOpen(true); }, []);

  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) {
      const t = setTimeout(start, 700);
      return () => clearTimeout(t);
    }
  }, [start]);

  // Re-openable from anywhere (e.g. the "Ver tour" button).
  useEffect(() => {
    window.addEventListener("stratiumetrics:start-tour", start);
    return () => window.removeEventListener("stratiumetrics:start-tour", start);
  }, [start]);

  // Track viewport size.
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const finish = useCallback(() => {
    localStorage.setItem(TOUR_KEY, "done");
    setOpen(false);
    setRect(null);
    window.dispatchEvent(new Event("stratiumetrics:close-sidebar"));
  }, []);

  // Measure the current step's target, retrying until it appears.
  const measure = useCallback((attempt = 0) => {
    const s = STEPS[step];
    if (!s) return;
    const el = document.querySelector(s.selector) as HTMLElement | null;
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      setRect(el.getBoundingClientRect());
    } else if (attempt < 8) {
      // Target not ready (route still loading or hidden) — retry briefly.
      rafRef.current = window.setTimeout(() => measure(attempt + 1), 120) as unknown as number;
    } else {
      // Give up on this step (e.g. integrations hidden for non-admins): skip.
      setStep((p) => (p < STEPS.length - 1 ? p + 1 : p));
    }
  }, [step]);

  // When the step changes: reveal sidebar (mobile), navigate, then measure.
  useEffect(() => {
    if (!open) return;
    const s = STEPS[step];
    window.dispatchEvent(new Event("stratiumetrics:open-sidebar"));
    if (s.route) router.push(s.route);
    const t = setTimeout(() => measure(), s.route ? 350 : 60);
    return () => { clearTimeout(t); if (rafRef.current) clearTimeout(rafRef.current); };
  }, [open, step, measure, router]);

  // Keep the highlight aligned on scroll/resize.
  useEffect(() => {
    if (!open) return;
    const onMove = () => measure();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open, measure]);

  // Keyboard nav.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  const next = () => { if (step < STEPS.length - 1) setStep((s) => s + 1); else finish(); };
  const prev = () => setStep((s) => Math.max(0, s - 1));

  if (!open) return null;

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  // ── Tooltip placement ──
  const TT_W = 300;
  let ttStyle: React.CSSProperties;
  if (isMobile || !rect) {
    // Bottom sheet on mobile (or before the target is measured).
    ttStyle = { left: 12, right: 12, bottom: 16, maxWidth: 480, margin: "0 auto" };
  } else {
    const spaceRight = window.innerWidth - rect.right;
    if (spaceRight > TT_W + 24) {
      // To the right of the element (typical for the sidebar).
      ttStyle = {
        left: rect.right + 16,
        top: Math.min(rect.top, window.innerHeight - 220),
        width: TT_W,
      };
    } else {
      // Below the element, aligned to its right edge, clamped to viewport.
      const left = Math.max(12, Math.min(rect.left, window.innerWidth - TT_W - 12));
      ttStyle = { left, top: Math.min(rect.bottom + 16, window.innerHeight - 220), width: TT_W };
    }
  }

  return (
    <div className="fixed inset-0 z-[120]" role="dialog" aria-modal="true" aria-label="Tour guiado">
      {/* Dim everything, with a "hole" punched around the target via box-shadow. */}
      {rect ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-primary transition-all duration-300"
          style={{
            left: rect.left - PADDING,
            top: rect.top - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.62)",
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/60" />
      )}

      {/* Catch clicks outside the tooltip to do nothing (keeps focus on tour). */}
      <div className="absolute inset-0" onClick={(e) => e.stopPropagation()} />

      {/* Tooltip card */}
      <div
        className="absolute rounded-2xl border border-border bg-card p-4 shadow-2xl animate-in fade-in zoom-in-95"
        style={ttStyle}
      >
        <button
          onClick={finish}
          aria-label="Cerrar tour"
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
          Paso {step + 1} de {STEPS.length}
        </p>
        <h3 className="mt-1 text-base font-bold tracking-tight">{s.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>

        {/* Progress dots */}
        <div className="mt-4 flex items-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={
                i === step
                  ? "h-1.5 w-5 rounded-full gradient-bg transition-all"
                  : i < step
                  ? "h-1.5 w-1.5 rounded-full bg-primary/40"
                  : "h-1.5 w-1.5 rounded-full bg-secondary"
              }
            />
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <button
            onClick={step === 0 ? finish : prev}
            className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary"
          >
            {step === 0 ? "Omitir" : (<><ArrowLeft className="h-3.5 w-3.5" /> Atrás</>)}
          </button>
          <button
            onClick={next}
            className="flex items-center gap-1.5 rounded-lg gradient-bg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            {isLast ? (<>Listo <Check className="h-4 w-4" /></>) : (<>Siguiente <ArrowRight className="h-4 w-4" /></>)}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Fire this from anywhere to re-open the tour. */
export function startGuidedTour() {
  window.dispatchEvent(new Event("stratiumetrics:start-tour"));
}
