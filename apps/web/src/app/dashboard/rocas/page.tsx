"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Mountain, Plus, Pencil, Trash2, X, Save } from "lucide-react";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";

type JobRole = "DIRECCION" | "OPERACIONES" | "COMERCIAL" | "MARKETING" | "ADMINISTRACION";
type Salud = "VERDE" | "AMARILLO" | "ROJO";

interface Roca {
  id: string;
  titulo: string;
  metricaExito: string;
  fechaLimite: string;
  estatus: Salud;
  porcentajeAvance: number;
  mes: string;
  duenoId: string;
  duenoNombre: string | null;
}

interface Member {
  id: string;
  name: string;
}

const SALUD_COLOR: Record<Salud, string> = {
  VERDE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  AMARILLO: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  ROJO: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

const BAR_COLOR: Record<Salud, string> = {
  VERDE: "bg-emerald-500",
  AMARILLO: "bg-amber-500",
  ROJO: "bg-red-500",
};

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export default function RocasPage() {
  const { toast } = useToast();
  const [jobRole, setJobRole] = useState<JobRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [mes, setMes] = useState<string>(currentMonth());
  const [rocas, setRocas] = useState<Roca[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Roca | null>(null);

  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((d) => {
        setJobRole(d.jobRole ?? null);
        setUserId(d.user?.id ?? null);
      })
      .catch(() => {});
    fetch("/api/tareas")
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((d) => setMembers(Array.isArray(d.members) ? d.members : []))
      .catch(() => {});
  }, []);

  const load = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rocas?mes=${m}`);
      const d = await res.json();
      setRocas(Array.isArray(d.rocas) ? d.rocas : []);
    } catch {
      /* noop */
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(mes); }, [mes, load]);

  const isDireccion = jobRole === "DIRECCION";

  const updateOwn = async (roca: Roca, patch: { porcentajeAvance?: number; estatus?: Salud }) => {
    try {
      const res = await fetch(`/api/rocas/${roca.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");
      setRocas((prev) => prev.map((r) => (r.id === roca.id ? d.roca : r)));
      toast("Roca actualizada", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo actualizar", "error");
    }
  };

  const remove = async (roca: Roca) => {
    if (!confirm(`¿Eliminar la roca "${roca.titulo}"?`)) return;
    try {
      const res = await fetch(`/api/rocas/${roca.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Error");
      }
      setRocas((prev) => prev.filter((r) => r.id !== roca.id));
      toast("Roca eliminada", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo eliminar", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <Mountain className="h-6 w-6 text-primary" /> Rocas del mes
          </h1>
          <p className="text-sm text-muted-foreground">Objetivos clave y su avance</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          />
          {isDireccion && (
            <button
              onClick={() => { setEditing(null); setShowForm(true); }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" /> Nueva roca
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rocas.length === 0 ? (
        <p className="py-16 text-center text-sm text-muted-foreground">No hay rocas para este mes.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Dueño</th>
                <th className="px-4 py-3 font-medium">Roca / Métrica de éxito</th>
                <th className="px-4 py-3 font-medium">Fecha límite</th>
                <th className="px-4 py-3 font-medium">Estatus</th>
                <th className="px-4 py-3 font-medium">% Avance</th>
                {isDireccion && <th className="px-4 py-3 font-medium text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {rocas.map((r) => {
                const canEditOwn = isDireccion || r.duenoId === userId;
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{r.duenoNombre ?? "—"}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{r.titulo}</p>
                      <p className="text-xs text-muted-foreground">{r.metricaExito}</p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{fmtDate(r.fechaLimite)}</td>
                    <td className="px-4 py-3">
                      {canEditOwn ? (
                        <select
                          value={r.estatus}
                          onChange={(e) => updateOwn(r, { estatus: e.target.value as Salud })}
                          className={cn("rounded px-2 py-1 text-xs font-semibold border-0", SALUD_COLOR[r.estatus])}
                        >
                          <option value="VERDE">VERDE</option>
                          <option value="AMARILLO">AMARILLO</option>
                          <option value="ROJO">ROJO</option>
                        </select>
                      ) : (
                        <span className={cn("inline-block rounded px-2 py-0.5 text-xs font-semibold", SALUD_COLOR[r.estatus])}>
                          {r.estatus}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 min-w-[160px]">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-secondary">
                          <div
                            className={cn("h-2 rounded-full", BAR_COLOR[r.estatus])}
                            style={{ width: `${Math.min(100, Math.max(0, r.porcentajeAvance))}%` }}
                          />
                        </div>
                        {canEditOwn ? (
                          <input
                            type="number"
                            min={0}
                            max={100}
                            defaultValue={r.porcentajeAvance}
                            onBlur={(e) => {
                              const p = Number(e.target.value);
                              if (Number.isInteger(p) && p >= 0 && p <= 100 && p !== r.porcentajeAvance) {
                                updateOwn(r, { porcentajeAvance: p });
                              }
                            }}
                            className="w-16 rounded border border-border bg-background px-2 py-1 text-xs"
                          />
                        ) : (
                          <span className="w-10 text-right text-xs font-medium text-foreground">{r.porcentajeAvance}%</span>
                        )}
                      </div>
                    </td>
                    {isDireccion && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => { setEditing(r); setShowForm(true); }}
                          className="mr-2 text-muted-foreground hover:text-foreground"
                          aria-label="Editar"
                        >
                          <Pencil className="h-4 w-4 inline" />
                        </button>
                        <button
                          onClick={() => remove(r)}
                          className="text-muted-foreground hover:text-red-600"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-4 w-4 inline" />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && isDireccion && (
        <RocaForm
          roca={editing}
          members={members}
          defaultMes={mes}
          onClose={() => setShowForm(false)}
          onSaved={(saved) => {
            setShowForm(false);
            if (saved.mes === mes) {
              setRocas((prev) => {
                const exists = prev.some((r) => r.id === saved.id);
                return exists ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved];
              });
            } else {
              load(mes);
            }
          }}
        />
      )}
    </div>
  );
}

function RocaForm({
  roca,
  members,
  defaultMes,
  onClose,
  onSaved,
}: {
  roca: Roca | null;
  members: Member[];
  defaultMes: string;
  onClose: () => void;
  onSaved: (r: Roca) => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo] = useState(roca?.titulo ?? "");
  const [metricaExito, setMetricaExito] = useState(roca?.metricaExito ?? "");
  const [fechaLimite, setFechaLimite] = useState(roca ? roca.fechaLimite.slice(0, 10) : "");
  const [duenoId, setDuenoId] = useState(roca?.duenoId ?? "");
  const [mes, setMes] = useState(roca?.mes ?? defaultMes);
  const [estatus, setEstatus] = useState<Salud>(roca?.estatus ?? "VERDE");
  const [porcentajeAvance, setPorcentajeAvance] = useState<string>(String(roca?.porcentajeAvance ?? 0));

  const submit = async () => {
    setSaving(true);
    try {
      const body = {
        titulo,
        metricaExito,
        fechaLimite,
        duenoId,
        mes,
        estatus,
        porcentajeAvance: Number(porcentajeAvance),
      };
      const res = await fetch(roca ? `/api/rocas/${roca.id}` : "/api/rocas", {
        method: roca ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");
      toast(roca ? "Roca actualizada" : "Roca creada", "success");
      onSaved(d.roca);
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo guardar", "error");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{roca ? "Editar roca" : "Nueva roca"}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground">Título</label>
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Métrica de éxito</label>
            <input value={metricaExito} onChange={(e) => setMetricaExito(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground">Fecha límite</label>
              <input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Mes</label>
              <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Dueño</label>
            <select value={duenoId} onChange={(e) => setDuenoId(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
              <option value="">Selecciona…</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground">Estatus</label>
              <select value={estatus} onChange={(e) => setEstatus(e.target.value as Salud)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                <option value="VERDE">VERDE</option>
                <option value="AMARILLO">AMARILLO</option>
                <option value="ROJO">ROJO</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">% Avance</label>
              <input type="number" min={0} max={100} value={porcentajeAvance} onChange={(e) => setPorcentajeAvance(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary">Cancelar</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
