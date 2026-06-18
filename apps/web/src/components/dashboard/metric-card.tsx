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
    <div className="rounded-xl border border-border bg-card p-6 transition-all hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className="rounded-lg bg-primary/8 p-2">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold tracking-tight text-foreground">{formattedValue}</p>
        {change !== undefined && (
          <p
            className={cn(
              "mt-1.5 text-xs font-medium",
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
