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
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2">
        <p className="text-2xl font-bold">{formattedValue}</p>
        {change !== undefined && (
          <p
            className={cn(
              "mt-1 text-xs font-medium",
              change >= 0 ? "text-emerald-600" : "text-destructive"
            )}
          >
            {formatPercentage(change)} vs mes anterior
          </p>
        )}
      </div>
    </div>
  );
}
