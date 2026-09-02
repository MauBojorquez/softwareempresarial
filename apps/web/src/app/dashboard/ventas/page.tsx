"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Loader2, TrendingUp, X, Check, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/toast";

// ─── Types ──────────────────────────────────────────────────────────

type Tipo = "RECURRENTE" | "UNICA";
type Origen = "META" | "ORGANICO" | "OUTBOUND" | "REFERIDO" | "RED_DIRECTA";

interface Venta {
  id: string;
  monto: number;
  tipo: Tipo;
  concepto?: string | null;
  fechaCierre: string;
  fechaCobroEsperada?: string | null;
  origen?: Origen | null;
  leadId?: string | null;
  leadNombre?: string | null;
  clienteId?: string | null;
  clienteNombre?: string | null;
  vendedorId?: string | null;
  vendedorNombre?: string | null;
}

interface Totals {
  mesCount: number;
  mesMonto: number;
  totalCount: number;
  totalMonto: number;
}

interface Member {
  id: string;
  name: string | null;
}

interface ClienteOpt {
  id: string;
  nombre: string;
}

const EMPTY_TOTALS: Totals = { mesCount: 0, mesMonto: 0, totalCount: 0, totalMonto: 0 };

const TIPO_LABEL: Record<Tipo, string> = { RECURRENTE: "Recurrente", UNICA: "Única" };

const ORIGENES: Origen[] = ["META", "ORGANICO", "OUTBOUND", "REFERIDO", "RED_DIRECTA"];
const ORIGEN_LABEL: Record<Origen, string> = {
  META: "Meta",
  ORGANICO: "Orgánico",
  OUTBOUND: "Outbound",
  REFERIDO: "Referido",
  RED_DIRECTA: "Red directa",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export default function VentasPage() {
  const { toast } = useToast();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [totals, setTotals] = useState<Totals>(EMPTY_TOTALS);
  const [loading, setLoading] = useState(true);
  const [jobRole, setJobRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [showNew, setShowNew] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ventas");
      const data = await res.json();
      setVentas(data.ventas ?? []);
      setTotals(data.totals ?? EMPTY_TOTALS);
    } catch {
      /* noop */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((d) => {
        setJobRole(d.jobRole ?? null);
        setUserId(d.user?.id ?? null);
      })
      .catch(() => {});
  }, []);

  // Only Dirección captures manual sales; fetch dropdown data for the modal.
  useEffect(() => {
    if (jobRole !== "DIRECCION") return;
    fetch("/api/leads")
      .then((r) => r.json())
      .then((d) => setMembers(d.members ?? []))
      .catch(() => {});
    fetch("/api/clientes")
      .then((r) => r.json())
      .then((d) =>
        setClientes((d.clientes ?? []).map((c: { id: string; nombre: string }) => ({ id: c.id, nombre: c.nombre }))),
      )
      .catch(() => {});
  }, [jobRole]);

  const isDireccion = jobRole === "DIRECCION";

  const canDelete = useCallback(
    (v: Venta) =>
      isDireccion || (jobRole === "COMERCIAL" && !!userId && v.vendedorId === userId),
    [isDireccion, jobRole, userId],
  );

  const remove = async (v: Venta) => {
    if (!confirm("¿Eliminar esta venta?")) return;
    try {
      const res = await fetch(`/api/ventas/${v.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "No se pudo eliminar");
      }
      toast("Venta eliminada", "success");
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo eliminar", "error");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2">
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Ventas</h1>
            <p className="text-sm text-muted-foreground">Cierres del pipeline y ventas capturadas.</p>
          </div>
        </div>
        {isDireccion && (
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 rounded-lg gradient-bg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Nueva venta
          </button>
        )}
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Ventas del mes" value={formatCurrency(totals.mesMonto)} sub={`${totals.mesCount} cierres`} tone="emerald" />
        <Tile label="Total histórico" value={formatCurrency(totals.totalMonto)} sub={`${totals.totalCount} cierres`} tone="slate" />
      </div>

      {/* Mobile card list (below sm) */}
      <div className="space-y-3 sm:hidden">
        {loading ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : ventas.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center text-muted-foreground">
            Sin ventas todavía.
          </div>
        ) : (
          ventas.map((v) => (
            <div key={v.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate font-semibold">{v.clienteNombre || v.leadNombre || "—"}</p>
                <span className="flex-shrink-0 font-semibold">{formatCurrency(v.monto)}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>Cierre: {fmtDate(v.fechaCierre)}</span>
                <span>Cobro: {fmtDate(v.fechaCobroEsperada)}</span>
                <span>Vendedor: {v.vendedorNombre || "—"}</span>
                <span>Tipo: {TIPO_LABEL[v.tipo]}</span>
              </div>
              {v.concepto && <p className="mt-2 text-xs text-muted-foreground">{v.concepto}</p>}
              {canDelete(v) && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => remove(v)}
                    className="rounded-lg p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-600"
                    aria-label="Eliminar venta"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Table (sm and up) */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card sm:block">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Fecha cierre</th>
              <th className="px-4 py-3 font-medium">Cliente / Lead</th>
              <th className="px-4 py-3 font-medium">Vendedor</th>
              <th className="px-4 py-3 font-medium">Concepto</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 text-right font-medium">Monto</th>
              <th className="px-4 py-3 font-medium">Cobro esperado</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </td>
              </tr>
            ) : ventas.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Sin ventas todavía.
                </td>
              </tr>
            ) : (
              ventas.map((v) => (
                <tr key={v.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(v.fechaCierre)}</td>
                  <td className="px-4 py-3 font-medium">{v.clienteNombre || v.leadNombre || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.vendedorNombre || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.concepto || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{TIPO_LABEL[v.tipo]}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(v.monto)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(v.fechaCobroEsperada)}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {canDelete(v) && (
                      <button
                        onClick={() => remove(v)}
                        className="text-muted-foreground hover:text-red-600"
                        aria-label="Eliminar venta"
                      >
                        <Trash2 className="h-4 w-4 inline" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {isDireccion && showNew && (
        <NewVentaModal
          members={members}
          clientes={clientes}
          onClose={() => setShowNew(false)}
          onSaved={async () => {
            setShowNew(false);
            await load();
          }}
          toast={toast}
        />
      )}
    </div>
  );
}

function NewVentaModal({
  members,
  clientes,
  onClose,
  onSaved,
  toast,
}: {
  members: Member[];
  clientes: ClienteOpt[];
  onClose: () => void;
  onSaved: () => void;
  toast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [clienteId, setClienteId] = useState("");
  const [monto, setMonto] = useState("");
  const [tipo, setTipo] = useState<"" | Tipo>("");
  const [vendedorId, setVendedorId] = useState("");
  const [fechaCierre, setFechaCierre] = useState(today());
  const [fechaCobroEsperada, setFechaCobro] = useState("");
  const [origen, setOrigen] = useState<"" | Origen>("");
  const [concepto, setConcepto] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const m = Number(monto);
    if (!Number.isFinite(m) || m <= 0) {
      toast("El monto debe ser mayor a 0", "error");
      return;
    }
    if (!tipo) {
      toast("Selecciona el tipo", "error");
      return;
    }
    if (!fechaCierre) {
      toast("Selecciona la fecha de cierre", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: clienteId || null,
          monto: m,
          tipo,
          vendedorId: vendedorId || null,
          fechaCierre,
          fechaCobroEsperada: fechaCobroEsperada || null,
          origen: origen || null,
          concepto: concepto || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || "No se pudo guardar", "error");
        setSaving(false);
        return;
      }
      toast("Venta registrada", "success");
      onSaved();
    } catch {
      toast("No se pudo guardar", "error");
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="font-semibold">Nueva venta</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3 p-6">
          <select
            className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
          >
            <option value="">Cliente (opcional)</option>
            {clientes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="number"
              inputMode="numeric"
              className="min-h-[40px] w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
              placeholder="Monto *"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
            />
            <select
              className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "" | Tipo)}
            >
              <option value="">Tipo *</option>
              <option value="RECURRENTE">Recurrente</option>
              <option value="UNICA">Única</option>
            </select>
          </div>
          <select
            className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            value={vendedorId}
            onChange={(e) => setVendedorId(e.target.value)}
          >
            <option value="">Vendedor (opcional)</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-muted-foreground">
              Fecha de cierre *
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
                value={fechaCierre}
                onChange={(e) => setFechaCierre(e.target.value)}
              />
            </label>
            <label className="block text-xs text-muted-foreground">
              Cobro esperado
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
                value={fechaCobroEsperada}
                onChange={(e) => setFechaCobro(e.target.value)}
              />
            </label>
          </div>
          <select
            className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            value={origen}
            onChange={(e) => setOrigen(e.target.value as "" | Origen)}
          >
            <option value="">Origen (opcional)</option>
            {ORIGENES.map((o) => (
              <option key={o} value={o}>
                {ORIGEN_LABEL[o]}
              </option>
            ))}
          </select>
          <input
            className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            placeholder="Concepto (opcional)"
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
          />
        </div>
        <div className="flex gap-3 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg gradient-bg py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Guardar venta
          </button>
        </div>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "emerald" | "slate";
}) {
  const accent: Record<string, string> = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    slate: "text-foreground",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={"mt-1 text-xl font-bold tracking-tight " + accent[tone]}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}
