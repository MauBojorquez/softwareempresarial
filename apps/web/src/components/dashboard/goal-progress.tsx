"use client";

import { cn, formatCurrency } from "@/lib/utils";
import { Trophy, Target, Trash2, Flame, Clock } from "lucide-react";

const fmtNum = (v: number) => new Intl.NumberFormat("es-MX").format(Math.round(v));

export function fmtGoalValue(v: number, unit: string) {
  if (unit === "MXN") return formatCurrency(v);
  if (unit === "%") return `${v}%`;
  if (unit === "pts") return `${fmtNum(v)} pts`;
  return fmtNum(v);
}

export function GoalProgress({
  name,
  current,
  target,
  unit,
  compact,
  deadline,
  onDelete,
}: {
  name: string;
  current: number;
  target: number;
  unit: string;
  compact?: boolean;
  deadline?: string;
  onDelete?: () => void;
}) {
  const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const done = pct >= 100;
  const level = Math.min(Math.floor(pct / 25) + 1, 4); // 1..4
  const remaining = Math.max(target - current, 0);
  const daysLeft = deadline ? Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000) : null;
  const deadlineUrgent = daysLeft !== null && daysLeft <= 7 && !done;

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border bg-card p-4 transition-all card-hover",
        done ? "border-emerald-500/50 neon-pulse" : "border-border"
      )}
    >
      {done && <div className="pointer-events-none absolute inset-0 bg-emerald-500/[0.06]" />}

      <div className="relative flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {done ? (
            <Trophy className="h-4 w-4 shrink-0 text-emerald-500" />
          ) : (
            <Target className="h-4 w-4 shrink-0 text-primary" />
          )}
          <span className="truncate text-sm font-semibold">{name}</span>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide",
            done ? "bg-emerald-500/15 text-emerald-600" : "bg-primary/10 text-primary"
          )}
        >
          {done ? "¡COMPLETADO!" : `NV. ${level}`}
        </span>
      </div>

      <div className="relative mt-3 flex items-end justify-between">
        <span className={cn("text-2xl font-bold tabular-nums", done ? "text-emerald-600" : "gradient-text")}>
          {pct.toFixed(0)}%
        </span>
        <span className="text-[11px] text-muted-foreground">
          {fmtGoalValue(current, unit)} / {fmtGoalValue(target, unit)}
        </span>
      </div>

      {/* XP-style bar with milestone ticks */}
      <div className="relative mt-2 h-3 overflow-hidden rounded-full bg-secondary/60">
        {[25, 50, 75].map((t) => (
          <div key={t} className="absolute bottom-0 top-0 z-10 w-px bg-background/70" style={{ left: `${t}%` }} />
        ))}
        <div
          className={cn("relative h-full rounded-full transition-all duration-700", done ? "bg-emerald-500" : "gradient-bg")}
          style={{ width: `${pct}%` }}
        >
          <div className="absolute inset-0 rounded-full shimmer" />
        </div>
      </div>

      {!compact && (
        <div className="relative mt-2 space-y-1">
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {done ? (
              <>🎉 ¡Lograste esta meta!</>
            ) : (
              <>
                <Flame className="h-3 w-3 text-amber-500" />
                Te falta {fmtGoalValue(remaining, unit)} para completarla
              </>
            )}
          </p>
          {daysLeft !== null && !done && (
            <p className={cn("flex items-center gap-1 text-[11px]", deadlineUrgent ? "text-red-500 font-medium" : "text-muted-foreground")}>
              <Clock className="h-3 w-3" />
              {daysLeft < 0 ? "Vencida" : daysLeft === 0 ? "Vence hoy" : `${daysLeft} días restantes`}
            </p>
          )}
        </div>
      )}

      {onDelete && (
        <button
          onClick={onDelete}
          aria-label="Eliminar meta"
          className="absolute bottom-3 right-3 text-muted-foreground opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
