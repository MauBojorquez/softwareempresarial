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
    <div className="rounded-xl border border-border bg-card p-4 transition-all hover:shadow-md sm:p-5">
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
      </div>
    </div>
  );
}
