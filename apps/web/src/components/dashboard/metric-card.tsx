"use client";

import { useEffect, useRef, useState } from "react";
import { cn, formatCurrency, formatPercentage } from "@/lib/utils";
import { type LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  format?: "currency" | "number" | "percentage";
  trend?: number[];
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Counts up to `target` over ~900ms with an ease-out curve. Skips the
 * animation entirely when the user prefers reduced motion (accessibility).
 */
function useCountUp(target: number, enabled: boolean): number {
  const [val, setVal] = useState(enabled ? 0 : target);
  const prev = useRef(0);
  useEffect(() => {
    if (!enabled || prefersReducedMotion()) { setVal(target); prev.current = target; return; }
    const from = prev.current;
    const delta = target - from;
    if (delta === 0) { setVal(target); return; }
    const duration = 900;
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setVal(from + delta * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else prev.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);
  return val;
}

export function MetricCard({ title, value, change, icon: Icon, format, trend }: MetricCardProps) {
  const isNumeric = typeof value === "number";
  const animated = useCountUp(isNumeric ? (value as number) : 0, isNumeric);
  const display = isNumeric ? animated : 0;

  const formattedValue =
    format === "currency" && isNumeric
      ? formatCurrency(display)
      : format === "percentage" && isNumeric
        ? `${display.toFixed(1)}%`
        : isNumeric
          ? Math.round(display).toLocaleString("es-MX")
          : String(value);

  return (
    <div role="article" aria-label={`${title}: ${formattedValue}`} className="group relative rounded-2xl border border-border bg-card p-4 sm:p-5 transition-all card-hover overflow-hidden">
      {/* Top accent line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">{title}</p>
        <div className="rounded-xl bg-primary/10 p-1.5 sm:p-2 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 shrink-0">
          <Icon className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl tabular-nums">{formattedValue}</p>
        {change !== undefined && (
          <p
            className={cn(
              "mt-1.5 flex items-center gap-1 text-xs font-medium animate-scale-in",
              change > 0 ? "text-emerald-400" : change < 0 ? "text-red-400" : "text-muted-foreground"
            )}
          >
            {change > 0
              ? <TrendingUp className="h-3.5 w-3.5" />
              : change < 0
              ? <TrendingDown className="h-3.5 w-3.5" />
              : <Minus className="h-3.5 w-3.5" />}
            {formatPercentage(change)} vs mes anterior
          </p>
        )}
        {trend && trend.length > 1 && (
          <div className="mt-3">
            <svg viewBox="0 0 100 28" className="w-full h-7" preserveAspectRatio="none" style={{ filter: "drop-shadow(0 0 4px rgba(61,127,255,0.5))" }}>
              <polyline
                fill="none"
                stroke="#3D7FFF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={trend.map((v, i) => {
                  const min = Math.min(...trend);
                  const max = Math.max(...trend);
                  const range = max - min || 1;
                  const x = (i / (trend.length - 1)) * 100;
                  const y = 26 - ((v - min) / range) * 24;
                  return `${x},${y}`;
                }).join(" ")}
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
