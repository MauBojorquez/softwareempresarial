"use client";

import { cn, formatCurrency, formatPercentage } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: LucideIcon;
  format?: "currency" | "number" | "percentage";
}

export function MetricCard({ title, value, change, icon: Icon, format }: MetricCardProps) {
  const formattedValue =
    format === "currency" && typeof value === "number"
      ? formatCurrency(value)
      : format === "percentage" && typeof value === "number"
        ? `${value.toFixed(1)}%`
        : String(value);

  return (
    <div className="group rounded-xl border border-white/5 bg-card p-6 transition-all hover:border-white/10 hover:glow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="rounded-lg bg-white/5 p-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold tracking-tight">{formattedValue}</p>
        {change !== undefined && (
          <p
            className={cn(
              "mt-1.5 text-xs font-medium",
              change >= 0 ? "text-emerald-400" : "text-red-400"
            )}
          >
            {formatPercentage(change)} vs mes anterior
          </p>
        )}
      </div>
    </div>
  );
}
