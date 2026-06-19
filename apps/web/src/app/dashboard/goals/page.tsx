"use client";

import { useEffect, useState } from "react";
import { Target, Plus, X, Trophy, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { GoalProgress } from "@/components/dashboard/goal-progress";
import { useToast } from "@/components/toast";
import { addActivityLog } from "@/components/dashboard/activity-log";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { cn } from "@/lib/utils";

type Goal = { name: string; current: number; target: number; unit: string; deadline?: string };

const METRIC_OPTIONS: Array<{ value: string; unit: string }> = [
  { value: "Ingresos", unit: "MXN" },
  { value: "Gastos", unit: "MXN" },
  { value: "Pipeline Total", unit: "MXN" },
  { value: "Ventas del Mes", unit: "MXN" },
  { value: "Deals Cerrados", unit: "unidades" },
  { value: "Nuevos Leads", unit: "unidades" },
  { value: "Conversión", unit: "%" },
  { value: "Headcount", unit: "personas" },
  { value: "Nuevas Contrataciones", unit: "personas" },
  { value: "Tareas Completadas", unit: "unidades" },
  { value: "Eficiencia", unit: "%" },
  { value: "SLA Cumplimiento", unit: "%" },
  { value: "Rotación", unit: "%" },
  { value: "Satisfacción", unit: "pts" },
  { value: "Costo Nómina", unit: "MXN" },
];

export default function GoalsPage() {
  const { toast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ metric: "Ingresos", target: "", unit: "MXN", deadline: "" });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/metrics/goals");
      if (res.ok) {
        const d = await res.json();
        setGoals(Array.isArray(d.goals) ? d.goals.filter((g: Goal) => g.target > 0) : []);
      }
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveGoal = async () => {
    if (!form.target) return;
    setSaving(true);
    await fetch("/api/metrics/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metric: form.metric, target: parseFloat(form.target), unit: form.unit, deadline: form.deadline || undefined }),
    });
    addActivityLog("Meta establecida", `${form.metric}: ${form.target} ${form.unit}`, "goal");
    toast("Meta guardada", "success");
    setShowForm(false);
    setForm({ metric: "Ingresos", target: "", unit: "MXN", deadline: "" });
    setSaving(false);
    setLoading(true);
    load();
  };

  const deleteGoal = async (metric: string) => {
    await fetch(`/api/metrics/goals?metric=${encodeURIComponent(metric)}`, { method: "DELETE" });
    setGoals((prev) => prev.filter((g) => g.name !== metric));
    setConfirmDelete(null);
    toast("Meta eliminada", "success");
  };

  const completed = goals.filter((g) => g.target > 0 && g.current >= g.target).length;
  const total = goals.length;
  const avgProgress =
    total > 0
      ? Math.round(goals.reduce((s, g) => s + Math.min((g.current / g.target) * 100, 100), 0) / total)
      : 0;
  const globalLevel = Math.max(1, Math.floor(avgProgress / 20) + 1); // 1..6

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            <Target className="h-5 w-5 text-primary" />
            Metas
          </h1>
          <p className="text-sm text-muted-foreground">Define objetivos y avanza de nivel al cumplirlos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setLoading(true); load(); }}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-lg gradient-bg px-3 py-2 text-sm font-medium text-white transition-all hover:opacity-90 hover:shadow-lg hover:shadow-purple-500/20 sm:px-4"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nueva Meta</span>
          </button>
        </div>
      </div>

      {/* Gamified summary */}
      {total > 0 && (
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-card p-5 animate-fade-in-up" style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.05),rgba(139,92,246,0.1))" }}>
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl gradient-bg text-xl font-bold text-white shadow-lg shadow-purple-500/30 animate-float-logo">
                {globalLevel}
              </div>
              <div>
                <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Sparkles className="h-4 w-4 text-primary" /> Nivel global {globalLevel}
                </p>
                <p className="text-xs text-muted-foreground">{avgProgress}% de avance promedio en tus metas</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold gradient-text">{completed}/{total}</p>
                <p className="text-[11px] text-muted-foreground">Completadas</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-emerald-500/40 bg-emerald-500/5">
                <Trophy className={cn("h-6 w-6", completed > 0 ? "text-emerald-500" : "text-muted-foreground/40")} />
              </div>
            </div>
          </div>
          {/* overall bar */}
          <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-secondary/60">
            <div className="h-full rounded-full gradient-bg transition-all duration-700" style={{ width: `${avgProgress}%` }}>
              <div className="absolute inset-0 shimmer rounded-full" />
            </div>
          </div>
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="rounded-xl border border-primary/20 bg-card p-4 sm:p-5 animate-slide-up">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Nueva Meta</h3>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <select
              value={form.metric}
              onChange={(e) => {
                const opt = METRIC_OPTIONS.find((o) => o.value === e.target.value);
                setForm({ ...form, metric: e.target.value, unit: opt?.unit || "" });
              }}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            >
              {METRIC_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.value} ({o.unit})</option>
              ))}
            </select>
            <input
              type="number"
              value={form.target}
              onChange={(e) => setForm({ ...form, target: e.target.value })}
              placeholder="Valor objetivo"
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
            <button
              onClick={saveGoal}
              disabled={saving || !form.target}
              className="flex items-center justify-center gap-2 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
              {saving ? "Guardando..." : "Guardar Meta"}
            </button>
          </div>
        </div>
      )}

      {/* Goals grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : total === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 animate-float">
            <Target className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-base font-semibold">Aún no tienes metas</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Define tu primer objetivo y empieza a subir de nivel conforme lo cumples.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-5 flex items-center gap-2 rounded-lg gradient-bg px-5 py-2.5 text-sm font-medium text-white transition-all hover:opacity-90 hover:-translate-y-0.5 pulse-glow"
          >
            <Plus className="h-4 w-4" /> Crear mi primera meta
          </button>
        </div>
      ) : (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 stagger-children">
          {goals.map((g) => (
            <GoalProgress
              key={g.name}
              name={g.name}
              current={g.current}
              target={g.target}
              unit={g.unit}
              deadline={g.deadline}
              onDelete={() => setConfirmDelete(g.name)}
            />
          ))}
        </div>
      )}
      <ConfirmDialog
        open={confirmDelete !== null}
        title="Eliminar meta"
        description={`¿Eliminar la meta de ${confirmDelete}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => confirmDelete && deleteGoal(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
