"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2, Check, RotateCcw, Receipt } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/toast";

// ─── Types ──────────────────────────────────────────────────────────

type Status = "ENVIADA" | "PAGADA" | "VENCIDA";

interface Receivable {
  id: string;
  client: string;
  invoiceFolio?: string | null;
  concept?: string | null;
  amount: number;
  issueDate: string;
  status: string;
  paidDate?: string | null;
  effectiveStatus: Status;
}

interface Totals {
  porCobrar: number;
  cobrado: number;
  vencido: number;
  pagadas: number;
  pendientes: number;
  vencidas: number;
}

const EMPTY_TOTALS: Totals = {
  porCobrar: 0, cobrado: 0, vencido: 0, pagadas: 0, pendientes: 0, vencidas: 0,
};

const STATUS_STYLE: Record<Status, string> = {
  ENVIADA: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  PAGADA: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  VENCIDA: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const STATUS_LABEL: Record<Status, string> = {
  ENVIADA: "Enviada",
  PAGADA: "Pagada",
  VENCIDA: "Vencida",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export default function CobranzaPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Receivable[]>([]);
  const [totals, setTotals] = useState<Totals>(EMPTY_TOTALS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"TODAS" | Status>("TODAS");

  const [form, setForm] = useState({
    client: "",
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
    } catch {
      /* noop */
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!form.client.trim()) {
      toast("Escribe el nombre del cliente", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/receivables", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, amount: Number(form.amount) || 0 }),
      });
      if (!res.ok) throw new Error();
      setForm({ client: "", invoiceFolio: "", concept: "", amount: "", issueDate: today() });
      toast("Factura registrada", "success");
      await load();
    } catch {
      toast("No se pudo guardar", "error");
    }
    setSaving(false);
  };

  const togglePaid = async (r: Receivable) => {
    const next = r.effectiveStatus === "PAGADA" ? "ENVIADA" : "PAGADA";
    try {
      await fetch(`/api/receivables/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, paidDate: next === "PAGADA" ? today() : null }),
      });
      await load();
    } catch {
      toast("No se pudo actualizar", "error");
    }
  };

  const remove = async (r: Receivable) => {
    if (!confirm(`¿Eliminar la factura de ${r.client}?`)) return;
    try {
      await fetch(`/api/receivables/${r.id}`, { method: "DELETE" });
      await load();
    } catch {
      toast("No se pudo eliminar", "error");
    }
  };

  const visible = rows.filter((r) => filter === "TODAS" || r.effectiveStatus === filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2">
          <Receipt className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Cobranza</h1>
          <p className="text-sm text-muted-foreground">Facturas emitidas y su estatus de pago.</p>
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
          <input
            className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm lg:col-span-2"
            placeholder="Cliente *"
            value={form.client}
            onChange={(e) => setForm((f) => ({ ...f, client: e.target.value }))}
          />
          <input
            className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            placeholder="Folio / Factura"
            value={form.invoiceFolio}
            onChange={(e) => setForm((f) => ({ ...f, invoiceFolio: e.target.value }))}
          />
          <input
            className="rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            placeholder="Concepto"
            value={form.concept}
            onChange={(e) => setForm((f) => ({ ...f, concept: e.target.value }))}
          />
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
        {(["TODAS", "ENVIADA", "VENCIDA", "PAGADA"] as const).map((f) => (
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
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Folio</th>
              <th className="px-4 py-3 font-medium">Concepto</th>
              <th className="px-4 py-3 text-right font-medium">Monto</th>
              <th className="px-4 py-3 font-medium">Enviada</th>
              <th className="px-4 py-3 font-medium">Estatus</th>
              <th className="px-4 py-3 font-medium">Pago</th>
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
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                  <td className="px-4 py-3 font-medium">{r.client}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.invoiceFolio || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.concept || "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(r.amount)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.issueDate)}</td>
                  <td className="px-4 py-3">
                    <span className={"inline-block rounded-full px-2.5 py-1 text-[11px] font-semibold " + STATUS_STYLE[r.effectiveStatus]}>
                      {STATUS_LABEL[r.effectiveStatus]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.paidDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => togglePaid(r)}
                        title={r.effectiveStatus === "PAGADA" ? "Marcar como no pagada" : "Marcar como pagada"}
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      >
                        {r.effectiveStatus === "PAGADA" ? <RotateCcw className="h-4 w-4" /> : <Check className="h-4 w-4 text-emerald-500" />}
                      </button>
                      <button
                        onClick={() => remove(r)}
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
