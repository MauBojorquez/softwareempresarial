"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, ListChecks, Check, RotateCcw } from "lucide-react";
import { useToast } from "@/components/toast";

// ─── Types ──────────────────────────────────────────────────────────

interface Tarea {
  id: string;
  descripcion: string;
  mes: string;
  estatus: "PENDIENTE" | "COMPLETADA";
  fechaCompletada?: string | null;
  clienteId: string;
  clienteNombre?: string | null;
  responsableId?: string | null;
  responsableNombre?: string | null;
}

interface Velocidad { total: number; completadas: number; ratio: number; }
interface ClienteOpt { id: string; nombre: string; }
interface Member { id: string; name: string | null; }

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default function TareasPage() {
  const { toast } = useToast();
  const [mes, setMes] = useState(currentMonth());
  const [tareas, setTareas] = useState<Tarea[]>([]);
  const [velocidad, setVelocidad] = useState<Velocidad>({ total: 0, completadas: 0, ratio: 0 });
  const [members, setMembers] = useState<Member[]>([]);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ descripcion: "", clienteId: "", responsableId: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tareas?mes=${mes}`);
      const data = await res.json();
      setTareas(data.tareas ?? []);
      setVelocidad(data.velocidad ?? { total: 0, completadas: 0, ratio: 0 });
      setMembers(data.members ?? []);
    } catch {
      /* noop */
    }
    setLoading(false);
  }, [mes]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/clientes")
      .then((r) => r.json())
      .then((d) => setClientes((d.clientes ?? []).map((c: { id: string; nombre: string }) => ({ id: c.id, nombre: c.nombre }))))
      .catch(() => {});
  }, []);

  const add = async () => {
    if (!form.descripcion.trim()) { toast("Escribe la descripción", "error"); return; }
    if (!form.clienteId) { toast("Selecciona un cliente", "error"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/tareas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          descripcion: form.descripcion,
          clienteId: form.clienteId,
          responsableId: form.responsableId || null,
          mes,
        }),
      });
      if (!res.ok) throw new Error();
      setForm({ descripcion: "", clienteId: "", responsableId: "" });
      toast("Tarea creada", "success");
      await load();
    } catch {
      toast("No se pudo guardar", "error");
    }
    setSaving(false);
  };

  const toggle = async (t: Tarea) => {
    const next = t.estatus === "COMPLETADA" ? "PENDIENTE" : "COMPLETADA";
    try {
      await fetch(`/api/tareas/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estatus: next }),
      });
      await load();
    } catch {
      toast("No se pudo actualizar", "error");
    }
  };

  const remove = async (t: Tarea) => {
    if (!confirm("¿Eliminar la tarea?")) return;
    try {
      await fetch(`/api/tareas/${t.id}`, { method: "DELETE" });
      await load();
    } catch {
      toast("No se pudo eliminar", "error");
    }
  };

  const pct = Math.round(velocidad.ratio * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2">
          <ListChecks className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Tareas del mes</h1>
          <p className="text-sm text-muted-foreground">Entregables por cliente y velocidad de cumplimiento.</p>
        </div>
      </div>

      {/* Controls + velocity */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Mes</p>
          <input
            type="month"
            className="mt-1 w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            value={mes}
            onChange={(e) => setMes(e.target.value || currentMonth())}
          />
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Velocidad del mes</p>
            <p className="text-sm font-semibold">{velocidad.completadas}/{velocidad.total} ({pct}%)</p>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      {/* Add form */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">Nueva tarea</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm lg:col-span-2"
            placeholder="Descripción *"
            value={form.descripcion}
            onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
          />
          <select
            className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            value={form.clienteId}
            onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value }))}
          >
            <option value="">Cliente *</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select
            className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            value={form.responsableId}
            onChange={(e) => setForm((f) => ({ ...f, responsableId: e.target.value }))}
          >
            <option value="">Responsable (opcional)</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <button
          onClick={add}
          disabled={saving}
          className="mt-3 flex items-center gap-1.5 rounded-lg gradient-bg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Agregar tarea
        </button>
      </div>

      {/* List */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Responsable</th>
              <th className="px-4 py-3 font-medium">Estatus</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            ) : tareas.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Sin tareas para este mes.</td></tr>
            ) : (
              tareas.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium">{t.descripcion}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.clienteNombre || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{t.responsableNombre || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={
                      "inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold " +
                      (t.estatus === "COMPLETADA"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400")
                    }>
                      {t.estatus === "COMPLETADA" ? "Completada" : "Pendiente"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggle(t)}
                        title={t.estatus === "COMPLETADA" ? "Marcar pendiente" : "Marcar completada"}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        {t.estatus === "COMPLETADA" ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4 text-emerald-500" />}
                      </button>
                      <button
                        onClick={() => remove(t)}
                        title="Eliminar"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
