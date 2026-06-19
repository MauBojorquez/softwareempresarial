"use client";

import { cn, formatCurrency, formatPercentage } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  format?: "currency" | "number" | "percentage";
  trend?: number[];
}

export function MetricCard({ title, value, change, icon: Icon, format, trend }: MetricCardProps) {
  const formattedValue =
    format === "currency" && typeof value === "number"
      ? formatCurrency(value)
      : format === "percentage" && typeof value === "number"
        ? `${value.toFixed(1)}%`
        : String(value);

  return (
    <div role="article" aria-label={`${title}: ${formattedValue}`} className="rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md sm:p-5 card-hover">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground sm:text-sm">{title}</p>
        <div className="rounded-lg bg-primary/8 p-1.5 sm:p-2">
          <Icon className="h-3.5 w-3.5 text-primary sm:h-4 sm:w-4" />
        </div>
      </div>
      <div className="mt-2 sm:mt-3">
        <p className="text-lg font-bold tracking-tight text-foreground sm:text-2xl">{formattedValue}</p>
        {change !== undefined && (
          <p
            className={cn(
              "mt-1 text-[11px] font-medium sm:mt-1.5 sm:text-xs",
              change >= 0 ? "text-emerald-600" : "text-red-500"
            )}
          >
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
