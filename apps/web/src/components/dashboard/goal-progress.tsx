"use client";

import { cn, formatCurrency } from "@/lib/utils";
import { Trophy, Trash2, Flame, Clock } from "lucide-react";

const fmtNum = (v: number) => new Intl.NumberFormat("es-MX").format(Math.round(v));

export function fmtGoalValue(v: number, unit: string) {
  if (unit === "MXN") return formatCurrency(v);
  if (unit === "%") return `${v.toFixed(1)}%`;
  if (unit === "pts") return `${fmtNum(v)} pts`;
  return fmtNum(v);
}

function ringColor(pct: number, done: boolean) {
  if (done) return "#00E87B";
  if (pct < 34) return "#FF4444";
  if (pct < 67) return "#FFB800";
  return "#00E87B";
}

function ringGlow(pct: number, done: boolean) {
  if (done || pct >= 67) return "drop-shadow(0 0 10px rgba(0,232,123,0.65))";
  if (pct < 34) return "drop-shadow(0 0 10px rgba(255,68,68,0.6))";
  return "drop-shadow(0 0 10px rgba(255,184,0,0.6))";
}

const R = 46;
const CIRC = 2 * Math.PI * R; // ≈ 289

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
  const remaining = Math.max(target - current, 0);
  const daysLeft = deadline
    ? Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000)
    : null;
  const deadlineUrgent = daysLeft !== null && daysLeft <= 7 && !done;
  const color = ringColor(pct, done);
  const dashOffset = CIRC * (1 - pct / 100);

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-card p-5 transition-all card-hover",
        done ? "border-emerald-500/25" : "border-border"
      )}
    >
      {done && <div className="pointer-events-none absolute inset-0 bg-emerald-500/[0.04]" />}

      {/* Top accent line */}
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }} />

      {/* Header */}
      <div className="relative flex items-center justify-between mb-4">
        <span className="truncate text-sm font-semibold text-foreground pr-2">{name}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          {done && (
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400 tracking-wide">
              ✓ META
            </span>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              aria-label="Eliminar meta"
              className="text-muted-foreground opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Ring + info */}
      <div className="flex items-center gap-4">
        {/* SVG ring */}
        <div className="relative shrink-0" style={{ filter: ringGlow(pct, done) }}>
          <svg
            width="106"
            height="106"
            viewBox="0 0 106 106"
            role="img"
            aria-label={`${Math.round(pct)}% de avance`}
          >
            {/* Background track */}
            <circle
              cx="53" cy="53" r={R}
              fill="none"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="9"
            />
            {/* Progress arc */}
            <circle
              cx="53" cy="53" r={R}
              fill="none"
              stroke={color}
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={`${CIRC}`}
              strokeDashoffset={dashOffset}
              transform="rotate(-90 53 53)"
              style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.34,1.1,0.64,1), stroke 0.4s ease" }}
            />
            {/* Percentage */}
            <text x="53" y="49" textAnchor="middle" fontSize="19" fontWeight="800" fill={color} style={{ fontFamily: "inherit" }}>
              {Math.round(pct)}%
            </text>
            <text x="53" y="64" textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.35)" style={{ fontFamily: "inherit" }}>
              {done ? "¡Logrado!" : "avance"}
            </text>
          </svg>
        </div>

        {/* Right side */}
        <div className="min-w-0 flex-1 space-y-2.5">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Actual</p>
            <p className="text-base font-extrabold tabular-nums leading-tight" style={{ color }}>
              {fmtGoalValue(current, unit)}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-0.5">Meta</p>
            <p className="text-sm font-semibold text-foreground/60 tabular-nums">
              {fmtGoalValue(target, unit)}
            </p>
          </div>
          {!compact && !done && remaining > 0 && (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Flame className="h-3 w-3 text-amber-400 shrink-0" />
              Faltan {fmtGoalValue(remaining, unit)}
            </p>
          )}
          {done && (
            <p className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <Trophy className="h-3.5 w-3.5" /> ¡Meta cumplida!
            </p>
          )}
          {daysLeft !== null && !done && (
            <p className={cn("flex items-center gap-1 text-[11px]", deadlineUrgent ? "text-red-400 font-medium" : "text-muted-foreground")}>
              <Clock className="h-3 w-3 shrink-0" />
              {daysLeft < 0 ? "Vencida" : daysLeft === 0 ? "Vence hoy" : `${daysLeft} días`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
