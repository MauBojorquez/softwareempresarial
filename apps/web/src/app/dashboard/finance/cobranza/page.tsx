"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, Receipt, ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/toast";

// ─── Types ──────────────────────────────────────────────────────────

type Status = "PENDIENTE" | "PARCIAL" | "PAGADA" | "VENCIDA";
type Tipo = "RECURRENTE" | "UNICA";

interface Payment {
  id: string;
  monto: number;
  fecha: string;
  metodo?: string | null;
  notas?: string | null;
  registradoPorNombre?: string | null;
}

interface Receivable {
  id: string;
  clienteId?: string | null;
  clienteNombre?: string | null;
  tipo?: Tipo | null;
  vendedorId?: string | null;
  vendedorNombre?: string | null;
  invoiceFolio?: string | null;
  concept?: string | null;
  amount: number;
  issueDate: string;
  paidTotal: number;
  saldo: number;
  status: Status;
  payments: Payment[];
}

interface Totals {
  porCobrar: number; cobrado: number; vencido: number;
  pagadas: number; pendientes: number; vencidas: number;
}

interface ClienteOpt { id: string; nombre: string; }
interface Member { id: string; name: string | null; }

const EMPTY_TOTALS: Totals = { porCobrar: 0, cobrado: 0, vencido: 0, pagadas: 0, pendientes: 0, vencidas: 0 };

const STATUS_STYLE: Record<Status, string> = {
  PENDIENTE: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  PARCIAL: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  PAGADA: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  VENCIDA: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const STATUS_LABEL: Record<Status, string> = {
  PENDIENTE: "Pendiente",
  PARCIAL: "Parcial",
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
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [form, setForm] = useState({
    clienteId: "",
    tipo: "" as "" | Tipo,
    vendedorId: "",
    invoiceFolio: "",
    concept: "",
    amount: "",
    issueDate: today(),
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/receivables");
      const data = await res.json();
      setRows(data.receivables ?? []);
      setTotals(data.totals ?? EMPTY_TOTALS);
      setMembers(data.members ?? []);
    } catch {
      /* noop */
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch("/api/clientes")
      .then((r) => r.json())
      .then((d) => setClientes((d.clientes ?? []).map((c: { id: string; nombre: string }) => ({ id: c.id, nombre: c.nombre }))))
      .catch(() => {});
  }, []);

  const add = async () => {
    if (!form.clienteId) { toast("Selecciona un cliente", "error"); return; }
    if (!form.tipo) { toast("Selecciona el tipo", "error"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/receivables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: form.clienteId,
          tipo: form.tipo,
          vendedorId: form.vendedorId || null,
          invoiceFolio: form.invoiceFolio,
          concept: form.concept,
          amount: Number(form.amount) || 0,
          issueDate: form.issueDate,
        }),
      });
      if (!res.ok) throw new Error();
      setForm({ clienteId: "", tipo: "", vendedorId: "", invoiceFolio: "", concept: "", amount: "", issueDate: today() });
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

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addPayment = async (r: Receivable, monto: number, metodo: string, fecha: string) => {
    if (!Number.isFinite(monto) || monto <= 0) { toast("Monto de abono inválido", "error"); return; }
    try {
      const res = await fetch(`/api/receivables/${r.id}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monto, metodo: metodo || null, fecha }),
      });
      if (!res.ok) throw new Error();
      toast("Abono registrado", "success");
      await load();
    } catch {
      toast("No se pudo registrar el abono", "error");
    }
  };

  const removePayment = async (r: Receivable, paymentId: string) => {
    if (!confirm("¿Eliminar este abono?")) return;
    try {
      await fetch(`/api/receivables/${r.id}/payments/${paymentId}`, { method: "DELETE" });
      await load();
    } catch {
      toast("No se pudo eliminar el abono", "error");
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
          <p className="text-sm text-muted-foreground">Facturas por cliente, abonos y saldo por cobrar.</p>
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Por cobrar" value={formatCurrency(totals.porCobrar)} sub={`${totals.pendientes} pendientes`} tone="amber" />
        <Tile label="Cobrado" value={formatCurrency(totals.cobrado)} sub={`${totals.pagadas} pagadas`} tone="emerald" />
        <Tile label="Vencido (+30 días)" value={formatCurrency(totals.vencido)} sub={`${totals.vencidas} facturas`} tone="red" />
        <Tile label="Total facturas" value={String(rows.length)} sub={`${totals.pagadas} pagadas / ${totals.pendientes} por cobrar`} tone="slate" />
      </div>

      {/* Add form */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="mb-3 text-sm font-semibold">Registrar factura</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-6">
          <select
            className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm lg:col-span-2"
            value={form.clienteId}
            onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value }))}
          >
            <option value="">Cliente *</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <select
            className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            value={form.tipo}
            onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as "" | Tipo }))}
          >
            <option value="">Tipo *</option>
            <option value="RECURRENTE">Recurrente</option>
            <option value="UNICA">Única</option>
          </select>
          <select
            className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            value={form.vendedorId}
            onChange={(e) => setForm((f) => ({ ...f, vendedorId: e.target.value }))}
          >
            <option value="">Vendedor</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input
            type="number"
            className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            placeholder="Monto"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />
          <input
            type="date"
            className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            value={form.issueDate}
            onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))}
          />
          <input
            className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            placeholder="Folio / Factura"
            value={form.invoiceFolio}
            onChange={(e) => setForm((f) => ({ ...f, invoiceFolio: e.target.value }))}
          />
          <input
            className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm lg:col-span-2"
            placeholder="Concepto"
            value={form.concept}
            onChange={(e) => setForm((f) => ({ ...f, concept: e.target.value }))}
          />
        </div>
        <button
          onClick={add}
          disabled={saving}
          className="mt-3 flex items-center gap-1.5 rounded-lg gradient-bg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Agregar factura
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {(["TODAS", "PENDIENTE", "PARCIAL", "VENCIDA", "PAGADA"] as const).map((f) => (
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

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Vendedor</th>
              <th className="px-4 py-3 text-right font-medium">Monto</th>
              <th className="px-4 py-3 text-right font-medium">Saldo</th>
              <th className="px-4 py-3 font-medium">Emitida</th>
              <th className="px-4 py-3 font-medium">Estatus</th>
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
                <FacturaRow
                  key={r.id}
                  r={r}
                  expanded={expanded.has(r.id)}
                  onToggle={() => toggleExpand(r.id)}
                  onRemove={() => remove(r)}
                  onAddPayment={(monto, metodo, fecha) => addPayment(r, monto, metodo, fecha)}
                  onRemovePayment={(pid) => removePayment(r, pid)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FacturaRow({
  r, expanded, onToggle, onRemove, onAddPayment, onRemovePayment,
}: {
  r: Receivable;
  expanded: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onAddPayment: (monto: number, metodo: string, fecha: string) => void;
  onRemovePayment: (paymentId: string) => void;
}) {
  const [monto, setMonto] = useState("");
  const [metodo, setMetodo] = useState("");
  const [fecha, setFecha] = useState(today());

  const submit = () => {
    onAddPayment(Number(monto), metodo, fecha);
    setMonto("");
    setMetodo("");
    setFecha(today());
  };

  return (
    <>
      <tr className="border-b border-border last:border-0 hover:bg-secondary/30">
        <td className="px-4 py-3 font-medium">
          <button onClick={onToggle} className="flex items-center gap-1.5 text-left">
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <span>{r.clienteNombre || "—"}</span>
          </button>
        </td>
        <td className="px-4 py-3 text-muted-foreground">{r.tipo ? TIPO_LABEL[r.tipo] : "—"}</td>
        <td className="px-4 py-3 text-muted-foreground">{r.vendedorNombre || "—"}</td>
        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(r.amount)}</td>
        <td className="px-4 py-3 text-right font-semibold">{formatCurrency(r.saldo)}</td>
        <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.issueDate)}</td>
        <td className="px-4 py-3">
          <span className={"inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold " + STATUS_STYLE[r.status]}>
            {STATUS_LABEL[r.status]}
          </span>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1">
            <button onClick={onRemove} title="Eliminar" className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-border bg-secondary/20">
          <td colSpan={8} className="px-4 py-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                {r.invoiceFolio && <span>Folio: <span className="text-foreground">{r.invoiceFolio}</span></span>}
                {r.concept && <span>Concepto: <span className="text-foreground">{r.concept}</span></span>}
                <span>Abonado: <span className="text-foreground">{formatCurrency(r.paidTotal)}</span></span>
              </div>

              {/* Payments list */}
              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full min-w-[520px] text-xs">
                  <thead>
                    <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Fecha</th>
                      <th className="px-3 py-2 text-right font-medium">Monto</th>
                      <th className="px-3 py-2 font-medium">Método</th>
                      <th className="px-3 py-2 font-medium">Registró</th>
                      <th className="px-3 py-2 text-right font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.payments.length === 0 ? (
                      <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">Sin abonos todavía.</td></tr>
                    ) : (
                      r.payments.map((p) => (
                        <tr key={p.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 text-muted-foreground">{fmtDate(p.fecha)}</td>
                          <td className="px-3 py-2 text-right font-semibold">{formatCurrency(p.monto)}</td>
                          <td className="px-3 py-2 text-muted-foreground">{p.metodo || "—"}</td>
                          <td className="px-3 py-2 text-muted-foreground">{p.registradoPorNombre || "—"}</td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => onRemovePayment(p.id)} title="Eliminar abono" className="rounded p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-500">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Add payment */}
              {r.status !== "PAGADA" && (
                <div className="flex flex-wrap items-end gap-2">
                  <input
                    type="number"
                    className="w-32 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-sm"
                    placeholder="Monto abono"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                  />
                  <input
                    className="w-36 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-sm"
                    placeholder="Método"
                    value={metodo}
                    onChange={(e) => setMetodo(e.target.value)}
                  />
                  <input
                    type="date"
                    className="rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-sm"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                  />
                  <button onClick={submit} className="flex items-center gap-1.5 rounded-lg gradient-bg px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
                    <Plus className="h-4 w-4" /> Abono
                  </button>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
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
      <p className={"mt-1 text-xl font-bold tracking-tight " + accent[tone]}>{value}</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}
