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
    <div role="article" aria-label={`${title}: ${formattedValue}`} className="group rounded-xl border border-border bg-card p-4 transition-all sm:p-5 card-hover">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground sm:text-sm">{title}</p>
        <div className="rounded-lg bg-primary/8 p-1.5 sm:p-2 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
          <Icon className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
        </div>
      </div>
      <div className="mt-2 sm:mt-3">
        <p className="text-lg font-bold tracking-tight text-foreground sm:text-2xl">{formattedValue}</p>
        {change !== undefined && (
          <p
            className={cn(
              "mt-1 flex items-center gap-0.5 text-[11px] font-medium sm:mt-1.5 sm:text-xs animate-scale-in",
              change > 0 ? "text-emerald-600" : change < 0 ? "text-red-500" : "text-muted-foreground"
            )}
          >
            {change > 0
              ? <TrendingUp className="h-3 w-3" />
              : change < 0
              ? <TrendingDown className="h-3 w-3" />
              : <Minus className="h-3 w-3" />}
            {formatPercentage(change)} vs mes anterior
          </p>
        )}
        {trend && trend.length > 1 && (
          <div className="mt-2">
            <svg viewBox="0 0 100 24" className="w-full h-6" preserveAspectRatio="none">
              <polyline
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={trend.map((v, i) => {
                  const min = Math.min(...trend);
                  const max = Math.max(...trend);
                  const range = max - min || 1;
                  const x = (i / (trend.length - 1)) * 100;
                  const y = 22 - ((v - min) / range) * 20;
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
