"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/toast";

// ─── Types ──────────────────────────────────────────────────────────

type Status = "PENDIENTE" | "PAGADA" | "VENCIDA";
type Tipo = "RECURRENTE" | "UNICA";

interface Receivable {
  id: string;
  clienteId?: string | null;
  clienteManual?: string | null;
  clienteNombre?: string | null;
  tipo?: Tipo | null;
  vendedorId?: string | null;
  vendedorNombre?: string | null;
  invoiceFolio?: string | null;
  concept?: string | null;
  amount: number;
  issueDate: string;
  pagado: boolean;
  fechaPago?: string | null;
  saldo: number;
  status: Status;
}

interface TipoTotals { cobrado: number; porCobrar: number; }

interface Totals {
  porCobrar: number; cobrado: number; vencido: number;
  pagadas: number; pendientes: number; vencidas: number;
  recurrente: TipoTotals;
  unica: TipoTotals;
}

interface ClienteOpt { id: string; nombre: string; }
interface Member { id: string; name: string | null; }

const EMPTY_TOTALS: Totals = {
  porCobrar: 0, cobrado: 0, vencido: 0, pagadas: 0, pendientes: 0, vencidas: 0,
  recurrente: { cobrado: 0, porCobrar: 0 },
  unica: { cobrado: 0, porCobrar: 0 },
};

const STATUS_STYLE: Record<Status, string> = {
  PENDIENTE: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  PAGADA: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  VENCIDA: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const STATUS_LABEL: Record<Status, string> = {
  PENDIENTE: "Pendiente",
  PAGADA: "Pagada",
  VENCIDA: "Vencida",
};

const TIPO_LABEL: Record<Tipo, string> = { RECURRENTE: "Recurrente", UNICA: "Única" };

function today() { return new Date().toISOString().slice(0, 10); }

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export default function CobranzaPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Receivable[]>([]);
  const [totals, setTotals] = useState<Totals>(EMPTY_TOTALS);
  const [members, setMembers] = useState<Member[]>([]);
  const [clientes, setClientes] = useState<ClienteOpt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"TODAS" | Status>("TODAS");
  const [clientMode, setClientMode] = useState<"elegir" | "escribir">("elegir");

  const [form, setForm] = useState({
    clienteId: "",
    clienteManual: "",
    tipo: "" as "" | Tipo,
    vendedorId: "",
    invoiceFolio: "",
    concept: "",
    amount: "",
    issueDate: today(),
    pagado: false,
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/receivables");
      const data = await res.json();
      setRows(data.receivables ?? []);
      setTotals(data.totals ?? EMPTY_TOTALS);
      setMembers(data.members ?? []);
      setClientes(data.clientes ?? []);
    } catch {
      /* noop */
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (clientMode === "elegir" && !form.clienteId) { toast("Selecciona un cliente", "error"); return; }
    if (clientMode === "escribir" && !form.clienteManual.trim()) { toast("Escribe el nombre del cliente", "error"); return; }
    if (!form.tipo) { toast("Selecciona el tipo", "error"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/receivables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: clientMode === "elegir" ? form.clienteId : null,
          clienteManual: clientMode === "escribir" ? form.clienteManual.trim() : null,
          tipo: form.tipo,
          vendedorId: form.vendedorId || null,
          invoiceFolio: form.invoiceFolio,
          concept: form.concept,
          amount: Number(form.amount) || 0,
          issueDate: form.issueDate,
          pagado: form.pagado,
        }),
      });
      if (!res.ok) throw new Error();
      setForm({ clienteId: "", clienteManual: "", tipo: "", vendedorId: "", invoiceFolio: "", concept: "", amount: "", issueDate: today(), pagado: false });
      toast("Factura registrada", "success");
      await load();
    } catch {
      toast("No se pudo guardar", "error");
    }
    setSaving(false);
  };

  const remove = async (r: Receivable) => {
    if (!confirm(`¿Eliminar la factura de ${r.clienteNombre ?? "este cliente"}?`)) return;
    try {
      await fetch(`/api/receivables/${r.id}`, { method: "DELETE" });
      await load();
    } catch {
      toast("No se pudo eliminar", "error");
    }
  };

  const togglePagado = async (r: Receivable) => {
    // optimistic
    const next = !r.pagado;
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, pagado: next } : x)));
    try {
      const res = await fetch(`/api/receivables/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pagado: next }),
      });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      toast("No se pudo actualizar", "error");
      await load();
    }
  };

  const visible = rows.filter((r) => filter === "TODAS" || r.status === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2">
          <Receipt className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Cobranza</h1>
          <p className="text-sm text-muted-foreground">Facturas por cliente. Marca &quot;Pagado&quot; y su monto completo cuenta como cobrado.</p>
        </div>
      </div>

      {/* Summary tiles: recurrente vs única + grand total */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile
          label="Recurrente (mensual)"
          value={formatCurrency(totals.recurrente.cobrado)}
          sub={`Por cobrar: ${formatCurrency(totals.recurrente.porCobrar)}`}
          tone="emerald"
        />
        <Tile
          label="Única (vendido)"
          value={formatCurrency(totals.unica.cobrado)}
          sub={`Por cobrar: ${formatCurrency(totals.unica.porCobrar)}`}
          tone="emerald"
        />
        <Tile
          label="Cobrado total"
          value={formatCurrency(totals.cobrado)}
          sub={`Por cobrar: ${formatCurrency(totals.porCobrar)}`}
          tone="slate"
        />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Tile label="Por cobrar" value={formatCurrency(totals.porCobrar)} sub={`${totals.pendientes} pendientes`} tone="amber" />
        <Tile label="Vencido (+30 días)" value={formatCurrency(totals.vencido)} sub={`${totals.vencidas} facturas`} tone="red" />
        <Tile label="Total facturas" value={String(rows.length)} sub={`${totals.pagadas} pagadas / ${totals.pendientes} por cobrar`} tone="slate" />
      </div>

      {/* Add form */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">Registrar factura</p>

        {/* Client picker toggle */}
        <div className="mb-2 flex gap-2">
          <button
            type="button"
            onClick={() => setClientMode("elegir")}
            className={"rounded-full px-3 py-1 text-xs font-medium transition-colors " + (clientMode === "elegir" ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-foreground")}
          >
            Elegir cliente
          </button>
          <button
            type="button"
            onClick={() => setClientMode("escribir")}
            className={"rounded-full px-3 py-1 text-xs font-medium transition-colors " + (clientMode === "escribir" ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-foreground")}
          >
            Escribir nombre
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
          {clientMode === "elegir" ? (
            <select
              className="min-h-[40px] rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm lg:col-span-2"
              value={form.clienteId}
              onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value }))}
            >
              <option value="">Cliente *</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          ) : (
            <input
              className="min-h-[40px] rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm lg:col-span-2"
              placeholder="Nombre del cliente *"
              value={form.clienteManual}
              onChange={(e) => setForm((f) => ({ ...f, clienteManual: e.target.value }))}
            />
          )}
          <select
            className="min-h-[40px] rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            value={form.tipo}
            onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as "" | Tipo }))}
          >
            <option value="">Tipo *</option>
            <option value="RECURRENTE">Recurrente</option>
            <option value="UNICA">Única</option>
          </select>
          <select
            className="min-h-[40px] rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            value={form.vendedorId}
            onChange={(e) => setForm((f) => ({ ...f, vendedorId: e.target.value }))}
          >
            <option value="">Vendedor</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input
            type="number"
            inputMode="numeric"
            className="min-h-[40px] rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            placeholder="Monto"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />
          <input
            type="date"
            className="min-h-[40px] rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            value={form.issueDate}
            onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))}
          />
          <input
            className="min-h-[40px] rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            placeholder="Folio / Factura"
            value={form.invoiceFolio}
            onChange={(e) => setForm((f) => ({ ...f, invoiceFolio: e.target.value }))}
          />
          <input
            className="min-h-[40px] rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm lg:col-span-2"
            placeholder="Concepto"
            value={form.concept}
            onChange={(e) => setForm((f) => ({ ...f, concept: e.target.value }))}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={form.pagado}
              onChange={(e) => setForm((f) => ({ ...f, pagado: e.target.checked }))}
            />
            Pagado
          </label>
          <button
            onClick={add}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg gradient-bg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Agregar factura
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(["TODAS", "PENDIENTE", "VENCIDA", "PAGADA"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors " +
              (filter === f ? "bg-primary text-white" : "bg-secondary text-muted-foreground hover:text-foreground")
            }
          >
            {f === "TODAS" ? "Todas" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {/* Mobile card list (below sm) */}
      <div className="space-y-3 sm:hidden">
        {loading ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center text-muted-foreground">
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card px-4 py-10 text-center text-muted-foreground">
            Sin facturas todavía. Registra la primera arriba.
          </div>
        ) : (
          visible.map((r) => (
            <FacturaCard key={r.id} r={r} onRemove={() => remove(r)} onTogglePagado={() => togglePagado(r)} />
          ))
        )}
      </div>

      {/* Table (sm and up) */}
      <div className="hidden overflow-x-auto rounded-2xl border border-border bg-card sm:block">
        <table className="w-full min-w-[820px] text-sm tabular-nums">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Vendedor</th>
              <th className="px-4 py-3 text-right font-medium">Monto</th>
              <th className="px-4 py-3 font-medium">Emitida</th>
              <th className="px-4 py-3 font-medium">Estatus</th>
              <th className="px-4 py-3 text-center font-medium">Pagado</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            ) : visible.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Sin facturas todavía. Registra la primera arriba.</td></tr>
            ) : (
              visible.map((r) => (
                <FacturaRow key={r.id} r={r} onRemove={() => remove(r)} onTogglePagado={() => togglePagado(r)} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FacturaRow({ r, onRemove, onTogglePagado }: { r: Receivable; onRemove: () => void; onTogglePagado: () => void; }) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-secondary/30">
      <td className="px-4 py-3 font-medium">{r.clienteNombre || "—"}</td>
      <td className="px-4 py-3 text-muted-foreground">{r.tipo ? TIPO_LABEL[r.tipo] : "—"}</td>
      <td className="px-4 py-3 text-muted-foreground">{r.vendedorNombre || "—"}</td>
      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(r.amount)}</td>
      <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.issueDate)}</td>
      <td className="px-4 py-3">
        <span className={"inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold " + STATUS_STYLE[r.status]}>
          {STATUS_LABEL[r.status]}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-border"
          checked={r.pagado}
          onChange={onTogglePagado}
          title="Marcar como pagado"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1">
          <button onClick={onRemove} title="Eliminar" className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function FacturaCard({ r, onRemove, onTogglePagado }: { r: Receivable; onRemove: () => void; onTogglePagado: () => void; }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 tabular-nums">
      <div className="flex items-start justify-between gap-2">
        <span className="truncate font-semibold">{r.clienteNombre || "—"}</span>
        <span className={"inline-block flex-shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold " + STATUS_STYLE[r.status]}>
          {STATUS_LABEL[r.status]}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-[11px] text-muted-foreground">Monto</p>
          <p className="font-semibold">{formatCurrency(r.amount)}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">Tipo</p>
          <p className="text-muted-foreground">{r.tipo ? TIPO_LABEL[r.tipo] : "—"}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">Emitida</p>
          <p className="text-muted-foreground">{fmtDate(r.issueDate)}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">Vendedor</p>
          <p className="text-muted-foreground">{r.vendedorNombre || "—"}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border"
            checked={r.pagado}
            onChange={onTogglePagado}
          />
          Pagado
        </label>
        <button onClick={onRemove} title="Eliminar" className="rounded-lg p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: "amber" | "emerald" | "red" | "slate" }) {
  const accent: Record<string, string> = {
    amber: "text-amber-600 dark:text-amber-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    red: "text-red-600 dark:text-red-400",
    slate: "text-foreground",
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={"mt-1 text-xl font-bold tracking-tight tabular-nums " + accent[tone]}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">{sub}</p>
    </div>
  );
}
