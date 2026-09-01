"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, Users, Pencil, X, Check } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/toast";

// ─── Types ──────────────────────────────────────────────────────────

type Estatus = "ACTIVO" | "ESPERA" | "VENCIDO" | "BAJA";
type Salud = "VERDE" | "AMARILLO" | "ROJO";

interface Cliente {
  id: string;
  nombre: string;
  contacto?: string | null;
  montoMensual: number;
  diaDePago?: number | null;
  estatus: Estatus;
  salud: Salud;
  fechaAlta: string;
  notas?: string | null;
}

const ESTATUS_LABEL: Record<Estatus, string> = {
  ACTIVO: "Activo",
  ESPERA: "En espera",
  VENCIDO: "Vencido",
  BAJA: "Baja",
};

const ESTATUS_STYLE: Record<Estatus, string> = {
  ACTIVO: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  ESPERA: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  VENCIDO: "bg-red-500/10 text-red-600 dark:text-red-400",
  BAJA: "bg-secondary text-muted-foreground",
};

const SALUD_DOT: Record<Salud, string> = {
  VERDE: "bg-emerald-500",
  AMARILLO: "bg-amber-500",
  ROJO: "bg-red-500",
};

const ESTATUS_OPTS: Estatus[] = ["ACTIVO", "ESPERA", "VENCIDO", "BAJA"];
const SALUD_OPTS: Salud[] = ["VERDE", "AMARILLO", "ROJO"];

const EMPTY_FORM = {
  nombre: "",
  contacto: "",
  montoMensual: "",
  diaDePago: "",
  estatus: "ACTIVO" as Estatus,
  salud: "VERDE" as Salud,
  notas: "",
};

export default function CarteraPage() {
  const { toast } = useToast();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<Cliente | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/clientes");
      const data = await res.json();
      setClientes(data.clientes ?? []);
    } catch {
      /* noop */
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.nombre.trim()) e.nombre = "El nombre es obligatorio";
    if (form.montoMensual !== "") {
      const n = Number(form.montoMensual);
      if (!Number.isFinite(n) || n < 0) e.montoMensual = "Monto inválido (>= 0)";
    }
    if (form.diaDePago !== "") {
      const d = Number(form.diaDePago);
      if (!Number.isInteger(d) || d < 1 || d > 31) e.diaDePago = "Día 1 a 31";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const add = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/clientes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre,
          contacto: form.contacto || null,
          montoMensual: Number(form.montoMensual) || 0,
          diaDePago: form.diaDePago === "" ? null : Number(form.diaDePago),
          estatus: form.estatus,
          salud: form.salud,
          notas: form.notas || null,
        }),
      });
      if (!res.ok) throw new Error();
      setForm({ ...EMPTY_FORM });
      setErrors({});
      toast("Cliente dado de alta", "success");
      await load();
    } catch {
      toast("No se pudo guardar", "error");
    }
    setSaving(false);
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/clientes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      toast("No se pudo actualizar", "error");
    }
  };

  const changeSalud = (c: Cliente, salud: Salud) => {
    setClientes((prev) => prev.map((x) => (x.id === c.id ? { ...x, salud } : x)));
    patch(c.id, { salud });
  };

  const remove = async (c: Cliente) => {
    if (!confirm(`¿Dar de baja a ${c.nombre}?`)) return;
    try {
      const res = await fetch(`/api/clientes/${c.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (data?.note) toast(data.note, "info");
      else toast("Cliente eliminado", "success");
      await load();
    } catch {
      toast("No se pudo eliminar", "error");
    }
  };

  // ── Totals / indicators ──────────────────────────────────────────
  const activos = clientes.filter((c) => c.estatus === "ACTIVO");
  const mrr = activos.reduce((s, c) => s + c.montoMensual, 0);
  const countByEstatus = ESTATUS_OPTS.reduce(
    (acc, e) => ({ ...acc, [e]: clientes.filter((c) => c.estatus === e).length }),
    {} as Record<Estatus, number>,
  );
  const noBaja = clientes.filter((c) => c.estatus !== "BAJA");
  const verde = noBaja.filter((c) => c.salud === "VERDE").length;
  const amarillo = noBaja.filter((c) => c.salud === "AMARILLO").length;
  const rojo = noBaja.filter((c) => c.salud === "ROJO").length;
  const grupoSalud: Salud = rojo > 0 ? "ROJO" : amarillo > 0 ? "AMARILLO" : "VERDE";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Cartera de clientes</h1>
          <p className="text-sm text-muted-foreground">Altas, estatus, salud y monto mensual recurrente.</p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">MRR activo</p>
          <p className="mt-1 text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{formatCurrency(mrr)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{activos.length} clientes activos</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Por estatus</p>
          <p className="mt-1 text-sm font-semibold">
            {countByEstatus.ACTIVO} activo · {countByEstatus.ESPERA} espera
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {countByEstatus.VENCIDO} vencido · {countByEstatus.BAJA} baja
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Salud del grupo</p>
          <div className="mt-1 flex items-center gap-2">
            <span className={"h-3 w-3 rounded-full " + SALUD_DOT[grupoSalud]} />
            <span className="text-sm font-semibold">{grupoSalud === "ROJO" ? "En riesgo" : grupoSalud === "AMARILLO" ? "Atención" : "Saludable"}</span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{verde} verde / {amarillo} amarillo / {rojo} rojo</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs font-medium text-muted-foreground">Total clientes</p>
          <p className="mt-1 text-xl font-bold tracking-tight">{clientes.length}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{noBaja.length} vigentes</p>
        </div>
      </div>

      {/* Add form */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">Alta de cliente</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <input
              className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
              placeholder="Nombre *"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            />
            {errors.nombre && <p className="mt-1 text-[11px] text-red-500">{errors.nombre}</p>}
          </div>
          <input
            className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            placeholder="Contacto"
            value={form.contacto}
            onChange={(e) => setForm((f) => ({ ...f, contacto: e.target.value }))}
          />
          <div>
            <input
              type="number"
              className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
              placeholder="Monto mensual"
              value={form.montoMensual}
              onChange={(e) => setForm((f) => ({ ...f, montoMensual: e.target.value }))}
            />
            {errors.montoMensual && <p className="mt-1 text-[11px] text-red-500">{errors.montoMensual}</p>}
          </div>
          <div>
            <input
              type="number"
              className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
              placeholder="Día de pago (1-31)"
              value={form.diaDePago}
              onChange={(e) => setForm((f) => ({ ...f, diaDePago: e.target.value }))}
            />
            {errors.diaDePago && <p className="mt-1 text-[11px] text-red-500">{errors.diaDePago}</p>}
          </div>
          <select
            className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            value={form.estatus}
            onChange={(e) => setForm((f) => ({ ...f, estatus: e.target.value as Estatus }))}
          >
            {ESTATUS_OPTS.map((e) => <option key={e} value={e}>{ESTATUS_LABEL[e]}</option>)}
          </select>
          <select
            className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            value={form.salud}
            onChange={(e) => setForm((f) => ({ ...f, salud: e.target.value as Salud }))}
          >
            {SALUD_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button
          onClick={add}
          disabled={saving}
          className="mt-3 flex items-center gap-1.5 rounded-lg gradient-bg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Dar de alta
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Contacto</th>
              <th className="px-4 py-3 text-right font-medium">Monto mensual</th>
              <th className="px-4 py-3 font-medium">Día pago</th>
              <th className="px-4 py-3 font-medium">Estatus</th>
              <th className="px-4 py-3 font-medium">Salud</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            ) : clientes.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Sin clientes todavía. Da de alta el primero arriba.</td></tr>
            ) : (
              clientes.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium">{c.nombre}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.contacto || "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(c.montoMensual)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.diaDePago ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={"inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold " + ESTATUS_STYLE[c.estatus]}>
                      {ESTATUS_LABEL[c.estatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className={"h-2.5 w-2.5 rounded-full " + SALUD_DOT[c.salud]} />
                      <select
                        value={c.salud}
                        onChange={(e) => changeSalud(c, e.target.value as Salud)}
                        className="rounded-lg border border-border bg-secondary/40 px-2 py-1 text-xs"
                      >
                        {SALUD_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditing(c)}
                        title="Editar"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove(c)}
                        title="Dar de baja"
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

      {editing && (
        <EditModal
          cliente={editing}
          onClose={() => setEditing(null)}
          onSaved={async (body) => {
            await patch(editing.id, body);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function EditModal({
  cliente,
  onClose,
  onSaved,
}: {
  cliente: Cliente;
  onClose: () => void;
  onSaved: (body: Record<string, unknown>) => void;
}) {
  const [nombre, setNombre] = useState(cliente.nombre);
  const [contacto, setContacto] = useState(cliente.contacto ?? "");
  const [montoMensual, setMontoMensual] = useState(String(cliente.montoMensual));
  const [diaDePago, setDiaDePago] = useState(cliente.diaDePago != null ? String(cliente.diaDePago) : "");
  const [estatus, setEstatus] = useState<Estatus>(cliente.estatus);
  const [notas, setNotas] = useState(cliente.notas ?? "");

  const save = () => {
    if (!nombre.trim()) return;
    onSaved({
      nombre: nombre.trim(),
      contacto: contacto.trim() || null,
      montoMensual: Number(montoMensual) || 0,
      diaDePago: diaDePago === "" ? null : Number(diaDePago),
      estatus,
      notas: notas.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="font-semibold">Editar cliente</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
        </div>
        <div className="space-y-3 p-6">
          <input className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm" placeholder="Nombre *" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <input className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm" placeholder="Contacto" value={contacto} onChange={(e) => setContacto(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm" placeholder="Monto mensual" value={montoMensual} onChange={(e) => setMontoMensual(e.target.value)} />
            <input type="number" className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm" placeholder="Día pago" value={diaDePago} onChange={(e) => setDiaDePago(e.target.value)} />
          </div>
          <select className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm" value={estatus} onChange={(e) => setEstatus(e.target.value as Estatus)}>
            {ESTATUS_OPTS.map((e) => <option key={e} value={e}>{ESTATUS_LABEL[e]}</option>)}
          </select>
          <textarea className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm" placeholder="Notas" rows={3} value={notas} onChange={(e) => setNotas(e.target.value)} />
        </div>
        <div className="flex gap-3 border-t border-border px-6 py-4">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:text-foreground">Cancelar</button>
          <button onClick={save} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg gradient-bg py-2 text-sm font-semibold text-white hover:opacity-90">
            <Check className="h-4 w-4" /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
