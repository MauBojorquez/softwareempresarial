"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { Plus, Settings, ChevronLeft, Trash2, Loader2, Download, Lock, Unlock, ArrowLeftRight, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, MoneyInput } from "@/components/ui/field";
import { ErrorState, RowsSkeleton, CardsSkeleton } from "@/components/ui/states";
import { useConfirm } from "@/components/ui/confirm";
import { useToast } from "@/components/toast";
import { useMe } from "@/hooks/use-me";

// ─── Types ──────────────────────────────────────────────────────────

interface CashFlowCategory {
  id: string;
  code: string;
  name: string;
  type: "income" | "expense" | "both";
  order: number;
}

interface CashFlowAccount {
  id: string;
  name: string;
  bankName?: string;
  accountNumber?: string;
  openingBalance: number;
  _count?: { transactions: number };
}

interface CashFlowTransaction {
  id: string;
  date: string;
  bankReference?: string;
  movementType?: string;
  deposit?: number;
  withdrawal?: number;
  balance: number;
  concept?: string;
  provider?: string;
  reference?: string;
  invoiceUuid?: string;
  taxRate?: number;
  salesType?: string;
  incomeCategories?: Record<string, number>;
  expenseCategories?: Record<string, number>;
  notes?: string;
  isTransfer?: boolean;
  transferGroupId?: string;
}

// ─── Month helpers ──────────────────────────────────────────────────

const MX_TZ = "America/Mexico_City";

/** Current month "YYYY-MM" in America/Mexico_City. */
function currentMonthMX(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MX_TZ, year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);
}

const MES_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** "2025-09" → "Septiembre 2025". */
function mesLabel(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  return `${MES_NAMES[m - 1]} ${y}`;
}

/** Month "YYYY-MM" `delta` months away from `mes`. */
function shiftMes(mes: string, delta: number): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Last 36 months + current, newest first. */
function monthOptions(): string[] {
  const cur = currentMonthMX();
  const out: string[] = [];
  for (let i = 0; i <= 36; i++) out.push(shiftMes(cur, -i));
  return out;
}

// ─── Helpers ────────────────────────────────────────────────────────

function fmx(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return "";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function fmxNum(value: number | undefined | null): string {
  if (value === undefined || value === null || isNaN(value)) return "";
  return new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function toDateStr(d: string | undefined): string {
  if (!d) return "";
  return d.substring(0, 10);
}

// ─── Inline Cell ────────────────────────────────────────────────────

interface CellProps {
  value: string | number | undefined | null;
  onChange: (v: string) => void;
  type?: "text" | "number" | "date";
  className?: string;
  readOnly?: boolean;
  placeholder?: string;
  align?: "left" | "right";
  /** Accessible name, e.g. "Depósito" (falls back to the placeholder). */
  label?: string;
  /** Numeric cell: rejects non-numeric input instead of silently saving null. */
  numeric?: boolean;
}

/**
 * Spreadsheet-style cell. Not editing: a focusable button (Tab moves cell to
 * cell; Enter/F2 or click edits). Editing: Enter/Tab saves, Escape cancels and
 * returns focus to the cell.
 */
function Cell({ value, onChange, type = "text", className = "", readOnly = false, placeholder = "", align = "left", label, numeric }: CellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const done = useRef(false);

  const display = type === "date" ? toDateStr(value as string) : (value !== null && value !== undefined ? String(value) : "");
  const name = label || placeholder || "Celda";

  const startEdit = () => {
    if (readOnly) return;
    done.current = false;
    setInvalid(false);
    setDraft(display);
    setEditing(true);
    setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  };

  const finish = (save: boolean, refocus: boolean) => {
    if (done.current) return;
    if (save && draft !== display && numeric && draft.trim() !== "") {
      const num = parseFloat(draft.replace(/[^0-9.\-]/g, ""));
      if (Number.isNaN(num)) {
        setInvalid(true);
        return; // keep editing until the value is valid or cancelled
      }
    }
    done.current = true;
    setEditing(false);
    if (save && draft !== display) onChange(draft);
    if (refocus) setTimeout(() => buttonRef.current?.focus(), 0);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type === "number" ? "text" : type}
        inputMode={numeric ? "decimal" : undefined}
        aria-label={name}
        aria-invalid={invalid || undefined}
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setInvalid(false);
        }}
        onBlur={() => finish(true, false)}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); finish(true, true); }
          if (e.key === "Escape") { e.preventDefault(); finish(false, true); }
          if (e.key === "Tab") finish(true, false);
        }}
        className={`w-full rounded border bg-background px-1.5 py-1 text-xs tabular-nums outline-none ring-2 ${invalid ? "border-destructive ring-destructive/25" : "border-ring ring-ring/20"} ${align === "right" ? "text-right" : "text-left"} ${className}`}
      />
    );
  }

  const content = display || <span className="text-xs text-muted-foreground/60">{placeholder}</span>;

  if (readOnly) {
    return (
      <div className={`w-full min-h-[28px] truncate rounded px-1.5 py-1 text-xs ${align === "right" ? "text-right tabular-nums" : "text-left"} ${className}`}>
        {content}
      </div>
    );
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={startEdit}
      onKeyDown={(e) => {
        if (e.key === "F2") { e.preventDefault(); startEdit(); }
      }}
      aria-label={`${name}: ${display || "vacío"}. Enter para editar`}
      className={`block w-full min-h-[28px] truncate rounded px-1.5 py-1 text-xs transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${align === "right" ? "text-right tabular-nums" : "text-left"} ${className}`}
    >
      {content}
    </button>
  );
}

// ─── Transaction Row (desktop table) ─────────────────────────────────

interface TxRowProps {
  index: number;
  tx: CashFlowTransaction;
  categories: CashFlowCategory[];
  readOnly: boolean;
  onUpdate: (id: string, field: string, value: unknown) => void;
  onDelete: (tx: CashFlowTransaction) => void;
}

/** Category amounts after setting `catCode` to `val` (empty removes it). */
function nextCategories(current: Record<string, number> | undefined, catCode: string, val: string) {
  const parsed = parseFloat(val.replace(/[^0-9.\-]/g, ""));
  const updated = { ...(current ?? {}) };
  if (!val.trim() || isNaN(parsed)) delete updated[catCode];
  else updated[catCode] = parsed;
  return Object.keys(updated).length === 0 ? null : updated;
}

function moneyValue(v: number | undefined | null) {
  return v !== null && v !== undefined ? fmxNum(v) : "";
}

function TxRow({ index, tx, categories, readOnly, onUpdate, onDelete }: TxRowProps) {
  const incCats = categories.filter((c) => c.type === "income" || c.type === "both");
  const expCats = categories.filter((c) => c.type === "expense" || c.type === "both");
  const locked = readOnly || !!tx.isTransfer;

  return (
    <tr className="group border-b border-border/40 hover:bg-secondary/40">
      <td className="w-8 px-2 py-1 text-center text-xs text-muted-foreground">{index + 1}</td>
      <td className="min-w-[110px] px-1 py-1">
        <Cell value={toDateStr(tx.date)} type="date" readOnly={locked} onChange={(v) => onUpdate(tx.id, "date", v)} placeholder="fecha" label="Fecha" />
      </td>
      <td className="min-w-[130px] px-1 py-1">
        <Cell value={tx.bankReference} readOnly={readOnly} onChange={(v) => onUpdate(tx.id, "bankReference", v)} placeholder="referencia bancaria" label="Referencia bancaria" />
      </td>
      <td className="min-w-[110px] px-1 py-1">
        <Cell value={tx.movementType} readOnly={locked} onChange={(v) => onUpdate(tx.id, "movementType", v)} placeholder="tipo" label="Tipo de movimiento" className={tx.isTransfer ? "text-info" : ""} />
      </td>
      <td className="min-w-[100px] px-1 py-1">
        <Cell
          value={moneyValue(tx.deposit)}
          readOnly={locked}
          numeric
          onChange={(v) => onUpdate(tx.id, "deposit", v)}
          placeholder="0.00"
          label="Depósito"
          align="right"
          className={`${tx.isTransfer ? "text-info" : "text-success"} whitespace-nowrap`}
        />
      </td>
      <td className="min-w-[100px] px-1 py-1">
        <Cell
          value={moneyValue(tx.withdrawal)}
          readOnly={locked}
          numeric
          onChange={(v) => onUpdate(tx.id, "withdrawal", v)}
          placeholder="0.00"
          label="Retiro"
          align="right"
          className={`${tx.isTransfer ? "text-info" : "text-destructive"} whitespace-nowrap`}
        />
      </td>
      <td className="min-w-[110px] px-1 py-1">
        <div className={`whitespace-nowrap px-1.5 py-1 text-right text-xs font-medium tabular-nums ${tx.balance >= 0 ? "text-success" : "text-destructive"}`}>
          {fmx(tx.balance)}
        </div>
      </td>
      <td className="min-w-[140px] px-1 py-1">
        <Cell value={tx.concept} readOnly={readOnly} onChange={(v) => onUpdate(tx.id, "concept", v)} placeholder="concepto" label="Concepto" />
      </td>
      <td className="min-w-[120px] px-1 py-1">
        <Cell value={tx.provider} readOnly={readOnly} onChange={(v) => onUpdate(tx.id, "provider", v)} placeholder="proveedor" label="Proveedor" />
      </td>
      <td className="min-w-[100px] px-1 py-1">
        <Cell value={tx.reference} readOnly={readOnly} onChange={(v) => onUpdate(tx.id, "reference", v)} placeholder="referencia" label="Referencia" />
      </td>
      <td className="min-w-[120px] px-1 py-1">
        <Cell value={tx.invoiceUuid} readOnly={readOnly} onChange={(v) => onUpdate(tx.id, "invoiceUuid", v)} placeholder="folio/uuid" label="Folio o UUID" />
      </td>
      <td className="min-w-[80px] px-1 py-1">
        <Cell
          value={tx.taxRate !== null && tx.taxRate !== undefined ? String(tx.taxRate) : ""}
          readOnly={readOnly}
          numeric
          onChange={(v) => onUpdate(tx.id, "taxRate", v)}
          placeholder="0%"
          label="Impuesto"
          align="right"
        />
      </td>
      <td className="min-w-[100px] px-1 py-1">
        <Cell value={tx.salesType} readOnly={readOnly} onChange={(v) => onUpdate(tx.id, "salesType", v)} placeholder="ventas" label="Ventas" />
      </td>
      {incCats.map((cat) => (
        <td key={`inc-${cat.id}`} className="min-w-[90px] px-1 py-1">
          <Cell
            value={tx.incomeCategories?.[cat.code] !== undefined ? fmxNum(tx.incomeCategories[cat.code]) : ""}
            readOnly={readOnly}
            numeric
            onChange={(v) => onUpdate(tx.id, "incomeCategories", nextCategories(tx.incomeCategories, cat.code, v))}
            align="right"
            placeholder="0.00"
            label={`Ingreso ${cat.code}`}
            className="whitespace-nowrap text-success"
          />
        </td>
      ))}
      {expCats.map((cat) => (
        <td key={`exp-${cat.id}`} className="min-w-[90px] px-1 py-1">
          <Cell
            value={tx.expenseCategories?.[cat.code] !== undefined ? fmxNum(tx.expenseCategories[cat.code]) : ""}
            readOnly={readOnly}
            numeric
            onChange={(v) => onUpdate(tx.id, "expenseCategories", nextCategories(tx.expenseCategories, cat.code, v))}
            align="right"
            placeholder="0.00"
            label={`Gasto ${cat.code}`}
            className="whitespace-nowrap text-destructive"
          />
        </td>
      ))}
      <td className="w-10 px-1 py-1">
        {!readOnly && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => onDelete(tx)}
            aria-label={`Eliminar movimiento ${index + 1}`}
            className="text-muted-foreground opacity-0 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </td>
    </tr>
  );
}

// ─── Transaction Card (mobile) ───────────────────────────────────────

function TxCard({ index, tx, readOnly, onUpdate, onDelete }: {
  index: number;
  tx: CashFlowTransaction;
  readOnly: boolean;
  onUpdate: (id: string, field: string, value: unknown) => void;
  onDelete: (tx: CashFlowTransaction) => void;
}) {
  const locked = readOnly || !!tx.isTransfer;
  return (
    <div className="space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <Cell value={toDateStr(tx.date)} type="date" readOnly={locked} onChange={(v) => onUpdate(tx.id, "date", v)} placeholder="fecha" label="Fecha" />
          </div>
        </div>
        {!readOnly && (
          <Button variant="ghost" size="icon" onClick={() => onDelete(tx)} aria-label={`Eliminar movimiento ${index + 1}`} className="shrink-0 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="min-w-0">
        <Cell value={tx.concept} readOnly={readOnly} onChange={(v) => onUpdate(tx.id, "concept", v)} placeholder="concepto" label="Concepto" className="font-medium" />
      </div>
      {tx.isTransfer ? (
        <p className="px-1.5 text-xs font-medium text-info">{tx.movementType || "Transferencia"}</p>
      ) : (
        <div className="min-w-0">
          <Cell value={tx.provider} readOnly={readOnly} onChange={(v) => onUpdate(tx.id, "provider", v)} placeholder="proveedor / referencia" label="Proveedor" className="text-muted-foreground" />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 border-t border-border/50 pt-1">
        <div className="min-w-0">
          <p className="px-1.5 text-xs text-muted-foreground">Depósito</p>
          <Cell
            value={moneyValue(tx.deposit)}
            readOnly={locked}
            numeric
            onChange={(v) => onUpdate(tx.id, "deposit", v)}
            placeholder="0.00"
            label="Depósito"
            align="right"
            className={`${tx.isTransfer ? "text-info" : "text-success"} whitespace-nowrap`}
          />
        </div>
        <div className="min-w-0">
          <p className="px-1.5 text-xs text-muted-foreground">Retiro</p>
          <Cell
            value={moneyValue(tx.withdrawal)}
            readOnly={locked}
            numeric
            onChange={(v) => onUpdate(tx.id, "withdrawal", v)}
            placeholder="0.00"
            label="Retiro"
            align="right"
            className={`${tx.isTransfer ? "text-info" : "text-destructive"} whitespace-nowrap`}
          />
        </div>
        <div className="min-w-0">
          <p className="px-1.5 text-right text-xs text-muted-foreground">Saldo</p>
          <p className={`truncate whitespace-nowrap px-1.5 py-1 text-right text-xs font-medium tabular-nums ${tx.balance >= 0 ? "text-success" : "text-destructive"}`}>
            {fmx(tx.balance)}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Account Ledger View ─────────────────────────────────────────────

interface AccountLedgerProps {
  account: CashFlowAccount;
  accounts: CashFlowAccount[];
  categories: CashFlowCategory[];
  mes: string;
  readOnly: boolean;
  onSettings: (closedThroughMes: string | null) => void;
}

const NUMERIC_FIELDS = new Set(["deposit", "withdrawal", "taxRate"]);

function normalizeField(field: string, value: unknown): unknown {
  if (!NUMERIC_FIELDS.has(field)) return value;
  if (value === "" || value === null || value === undefined) return null;
  const num = parseFloat(String(value).replace(/[^0-9.\-]/g, ""));
  return isNaN(num) ? null : num;
}

async function errorMessage(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return (data as { error?: string }).error || fallback;
}

type SaveState = "idle" | "saving" | "saved" | "error";

function StatTile({ label, value, tone }: { label: string; value: string; tone?: "success" | "destructive" }) {
  const color = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "";
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`whitespace-nowrap text-sm font-medium tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function AccountLedger({ account, accounts, categories, mes, readOnly, onSettings }: AccountLedgerProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [transactions, setTransactions] = useState<CashFlowTransaction[]>([]);
  const [saldoInicial, setSaldoInicial] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [showTransfer, setShowTransfer] = useState(false);

  // Edits are batched per row: fields accumulate for 500 ms and go out in one
  // PATCH. On failure the row reverts to its last saved state.
  const txRef = useRef(transactions);
  txRef.current = transactions;
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pending = useRef<Record<string, Record<string, unknown>>>({});
  const snapshots = useRef<Record<string, CashFlowTransaction>>({});
  const inflight = useRef(0);

  // Running balance is always derived, so it can't drift from the rows.
  const { rows, saldoFinal } = useMemo(() => {
    let bal = saldoInicial;
    const out = transactions.map((t) => {
      bal += (Number(t.deposit) || 0) - (Number(t.withdrawal) || 0);
      return { ...t, balance: bal };
    });
    return { rows: out, saldoFinal: bal };
  }, [transactions, saldoInicial]);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/cashflow/accounts/${account.id}/transactions?mes=${mes}`);
      if (!res.ok) throw new Error(await errorMessage(res, "No se pudieron cargar los movimientos"));
      const data = await res.json();
      setTransactions(data.transactions ?? []);
      setSaldoInicial(data.saldoInicial ?? account.openingBalance);
      onSettings(data.closedThroughMes ?? null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "No se pudieron cargar los movimientos");
    } finally {
      setLoading(false);
    }
  }, [account.id, account.openingBalance, mes, onSettings]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const addRow = async () => {
    // New rows land in the selected month (mid-month, MX noon) so they belong to it.
    const iso = new Date(`${mes}-15T18:00:00.000Z`).toISOString();
    setAdding(true);
    try {
      const res = await fetch(`/api/cashflow/accounts/${account.id}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: iso }),
      });
      if (!res.ok) throw new Error(await errorMessage(res, "No se pudo agregar la fila"));
      await fetchTransactions();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo agregar la fila", "error");
    } finally {
      setAdding(false);
    }
  };

  const flush = async (id: string) => {
    const fields = pending.current[id];
    const before = snapshots.current[id];
    delete pending.current[id];
    delete snapshots.current[id];
    delete timers.current[id];
    if (!fields) return;

    inflight.current += 1;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/cashflow/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error(await errorMessage(res, "No se pudo guardar el cambio"));
      inflight.current -= 1;
      if (inflight.current === 0) setSaveState((s) => (s === "error" ? s : "saved"));
    } catch (e) {
      inflight.current -= 1;
      setSaveState("error");
      // Revert only the fields that failed, keeping any newer edits.
      if (before) {
        setTransactions((prev) =>
          prev.map((t) => {
            if (t.id !== id) return t;
            const reverted = { ...t } as Record<string, unknown>;
            for (const k of Object.keys(fields)) {
              if (!(pending.current[id] && k in pending.current[id])) reverted[k] = (before as unknown as Record<string, unknown>)[k];
            }
            return reverted as unknown as CashFlowTransaction;
          }),
        );
      }
      toast(e instanceof Error ? e.message : "No se pudo guardar el cambio", "error", {
        action: { label: "Reintentar", onClick: () => queue(id, fields) },
        duration: 10000,
      });
    }
  };

  const queue = (id: string, fields: Record<string, unknown>) => {
    const current = txRef.current.find((t) => t.id === id);
    if (!current) return;
    if (!snapshots.current[id]) snapshots.current[id] = current;
    pending.current[id] = { ...pending.current[id], ...fields };
    setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, ...fields } : t)));
    if (timers.current[id]) clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(() => flush(id), 500);
  };

  const handleUpdate = (id: string, field: string, value: unknown) => {
    queue(id, { [field]: normalizeField(field, value) });
  };

  const handleDelete = async (tx: CashFlowTransaction) => {
    const ok = await confirm({
      title: "¿Eliminar este movimiento?",
      description: tx.isTransfer
        ? "Es una transferencia: se eliminarán ambos lados (esta cuenta y la otra)."
        : "Se recalculará el saldo de la cuenta.",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    if (timers.current[tx.id]) clearTimeout(timers.current[tx.id]);
    delete pending.current[tx.id];
    delete snapshots.current[tx.id];
    const prev = txRef.current;
    setTransactions((rows) => rows.filter((t) => t.id !== tx.id));
    try {
      const res = await fetch(`/api/cashflow/transactions/${tx.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await errorMessage(res, "No se pudo eliminar el movimiento"));
      toast("Movimiento eliminado", "success");
    } catch (e) {
      setTransactions(prev);
      toast(e instanceof Error ? e.message : "No se pudo eliminar el movimiento", "error");
    }
  };

  const incCats = categories.filter((c) => c.type === "income" || c.type === "both");
  const expCats = categories.filter((c) => c.type === "expense" || c.type === "both");

  // Transfers move balance between accounts but are not income/expense, so they
  // are excluded from the Depósitos/Retiros totals (they still affect saldo).
  const totalDeposits = transactions.reduce((s, t) => s + (t.isTransfer ? 0 : Number(t.deposit) || 0), 0);
  const totalWithdrawals = transactions.reduce((s, t) => s + (t.isTransfer ? 0 : Number(t.withdrawal) || 0), 0);
  const otherAccounts = accounts.filter((a) => a.id !== account.id);

  return (
    <div className="flex h-full flex-col">
      {/* Saldo band */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-border px-4 py-3">
        <StatTile label="Banco" value={account.bankName || "—"} />
        <StatTile label="Cuenta" value={account.accountNumber || "—"} />
        <StatTile label="Saldo inicial" value={fmx(saldoInicial)} />
        <StatTile label="Depósitos" value={fmx(totalDeposits)} tone="success" />
        <StatTile label="Retiros" value={fmx(totalWithdrawals)} tone="destructive" />
        <div className="sm:ml-auto">
          <p className="text-xs text-muted-foreground">Saldo final</p>
          <p className={`whitespace-nowrap text-base font-bold tabular-nums ${saldoFinal >= 0 ? "text-success" : "text-destructive"}`}>{fmx(saldoFinal)}</p>
        </div>
        <div className="flex items-center gap-2">
          {!readOnly && otherAccounts.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setShowTransfer(true)}>
              <ArrowLeftRight className="h-3.5 w-3.5" />
              Transferir
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <a href={`/api/cashflow/export?mes=${mes}&accountId=${account.id}`}>
              <Download className="h-3.5 w-3.5" />
              Descargar mes
            </a>
          </Button>
        </div>
        <div aria-live="polite" className="min-w-[110px] text-xs">
          {saveState === "saving" && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Guardando…
            </span>
          )}
          {saveState === "saved" && (
            <span className="flex items-center gap-1 text-success">
              <Check className="h-3 w-3" /> Guardado
            </span>
          )}
          {saveState === "error" && (
            <span className="flex items-center gap-1 text-destructive">
              <AlertCircle className="h-3 w-3" /> Error al guardar
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <RowsSkeleton rows={6} className="p-4" />
        ) : loadError ? (
          <div className="p-4">
            <ErrorState message={loadError} onRetry={fetchTransactions} />
          </div>
        ) : (
          <>
            {/* Mobile: stacked cards */}
            <div className="space-y-3 p-3 sm:hidden">
              {rows.map((tx, i) => (
                <TxCard key={tx.id} index={i} tx={tx} readOnly={readOnly} onUpdate={handleUpdate} onDelete={handleDelete} />
              ))}
              {rows.length === 0 && (
                <p className="px-2 py-10 text-center text-sm text-muted-foreground">Sin movimientos en {mesLabel(mes)}.</p>
              )}
            </div>

            {/* Desktop: table */}
            <table className="hidden w-full min-w-max border-collapse text-xs sm:table">
              <caption className="sr-only">Movimientos de {account.name} en {mesLabel(mes)}</caption>
              <thead className="sticky top-0 z-10 border-b border-border bg-background text-xs font-medium text-muted-foreground">
                <tr>
                  <th scope="col" className="w-8 px-2 py-2 text-center">#</th>
                  <th scope="col" className="px-2 py-2 text-left">Fecha</th>
                  <th scope="col" className="px-2 py-2 text-left">Ref. bancaria</th>
                  <th scope="col" className="px-2 py-2 text-left">Tipo de movimiento</th>
                  <th scope="col" className="px-2 py-2 text-right text-success">Depósito</th>
                  <th scope="col" className="px-2 py-2 text-right text-destructive">Retiro</th>
                  <th scope="col" className="px-2 py-2 text-right">Saldo</th>
                  <th scope="col" className="px-2 py-2 text-left">Concepto</th>
                  <th scope="col" className="px-2 py-2 text-left">Proveedor</th>
                  <th scope="col" className="px-2 py-2 text-left">Referencia</th>
                  <th scope="col" className="px-2 py-2 text-left">Folio/UUID</th>
                  <th scope="col" className="px-2 py-2 text-right">Impuesto</th>
                  <th scope="col" className="px-2 py-2 text-left">Ventas</th>
                  {incCats.map((cat) => (
                    <th scope="col" key={cat.id} title={cat.name} className="px-2 py-2 text-right text-success">{cat.code}</th>
                  ))}
                  {expCats.map((cat) => (
                    <th scope="col" key={cat.id} title={cat.name} className="px-2 py-2 text-right text-destructive">{cat.code}</th>
                  ))}
                  <th scope="col" className="w-10"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border bg-secondary/40">
                  <td />
                  <td colSpan={5} className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Saldo inicial — {mesLabel(mes)}</td>
                  <td className="whitespace-nowrap px-1.5 py-1.5 text-right text-xs font-semibold tabular-nums">{fmx(saldoInicial)}</td>
                  <td colSpan={100} />
                </tr>
                {rows.map((tx, i) => (
                  <TxRow key={tx.id} index={i} tx={tx} categories={categories} readOnly={readOnly} onUpdate={handleUpdate} onDelete={handleDelete} />
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={14 + incCats.length + expCats.length} className="px-4 py-12 text-center text-sm text-muted-foreground">
                      {readOnly ? `Sin movimientos en ${mesLabel(mes)}.` : "Sin movimientos. Usa «Agregar fila» para comenzar."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}
      </div>

      {!readOnly && (
        <div className="border-t border-border px-4 py-3">
          <Button variant="ghost" size="sm" onClick={addRow} loading={adding} className="text-primary">
            {!adding && <Plus className="h-4 w-4" />}
            Agregar fila
          </Button>
        </div>
      )}

      <TransferDialog
        open={showTransfer}
        fromAccount={account}
        otherAccounts={otherAccounts}
        mes={mes}
        onClose={() => setShowTransfer(false)}
        onDone={() => {
          setShowTransfer(false);
          toast("Transferencia registrada", "success");
          fetchTransactions();
        }}
      />
    </div>
  );
}

// ─── Transfer dialog ─────────────────────────────────────────────────

function TransferDialog({
  open,
  fromAccount,
  otherAccounts,
  mes,
  onClose,
  onDone,
}: {
  open: boolean;
  fromAccount: CashFlowAccount;
  otherAccounts: CashFlowAccount[];
  mes: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(`${mes}-15`);
  const [concept, setConcept] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ to?: string; amount?: string; form?: string }>({});

  useEffect(() => {
    if (!open) return;
    setToAccountId("");
    setAmount("");
    setDate(`${mes}-15`);
    setConcept("");
    setErrors({});
  }, [open, mes]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const monto = parseFloat(amount.replace(/[^0-9.\-]/g, ""));
    const next: typeof errors = {};
    if (!toAccountId) next.to = "Selecciona la cuenta destino";
    if (!Number.isFinite(monto) || monto <= 0) next.amount = "El monto debe ser mayor a 0";
    setErrors(next);
    if (next.to || next.amount) return;
    setSaving(true);
    try {
      const res = await fetch("/api/cashflow/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromAccountId: fromAccount.id,
          toAccountId,
          amount: monto,
          date: new Date(`${date}T18:00:00.000Z`).toISOString(),
          concept: concept.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(await errorMessage(res, "No se pudo transferir"));
      onDone();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "No se pudo transferir" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Transferir entre cuentas"
        description="No cuenta como entrada ni salida del mes; solo mueve el saldo entre cuentas."
        footer={
          <>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" form="transfer-form" loading={saving}>
              {!saving && <ArrowLeftRight className="h-4 w-4" />}
              Transferir
            </Button>
          </>
        }
      >
        <form id="transfer-form" onSubmit={save} className="space-y-4" noValidate>
          <Field label="Cuenta origen">
            <Input value={fromAccount.name} readOnly disabled />
          </Field>
          <Field label="Cuenta destino" error={errors.to}>
            <Select value={toAccountId} onChange={(e) => setToAccountId(e.target.value)}>
              <option value="">Selecciona…</option>
              {otherAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto" error={errors.amount}>
              <MoneyInput placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </Field>
            <Field label="Fecha">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Concepto" optional>
            <Input placeholder="Ej. Pago de tarjeta" value={concept} onChange={(e) => setConcept(e.target.value)} />
          </Field>
          {errors.form && (
            <p role="alert" className="text-sm text-destructive">{errors.form}</p>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Report Tab ──────────────────────────────────────────────────────

interface ReportData {
  accounts: Array<{
    id: string;
    name: string;
    bankName?: string;
    openingBalance: number;
    totalDeposits: number;
    totalWithdrawals: number;
    currentBalance: number;
    categoryTotals: Record<string, number>;
    transactionCount: number;
  }>;
  categories: CashFlowCategory[];
  totals: {
    totalDeposits: number;
    totalWithdrawals: number;
    totalBalance: number;
    categoryTotals: Record<string, number>;
  };
  closedThroughMes?: string | null;
}

interface CategoryDialogProps {
  open: boolean;
  categories: CashFlowCategory[];
  onClose: () => void;
  onRefresh: () => void;
}

function CategoryDialog({ open, categories, onClose, onRefresh }: CategoryDialogProps) {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"income" | "expense">("income");
  const [creating, setCreating] = useState(false);

  const createCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/cashflow/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: newCode.trim().toUpperCase(), name: newName.trim(), type: newType }),
      });
      if (!res.ok) throw new Error(await errorMessage(res, "No se pudo crear la categoría"));
      setNewCode("");
      setNewName("");
      toast("Categoría creada", "success");
      onRefresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo crear la categoría", "error");
    } finally {
      setCreating(false);
    }
  };

  const deleteCategory = async (cat: CashFlowCategory) => {
    const ok = await confirm({
      title: `¿Eliminar la categoría ${cat.code}?`,
      description: "Dejará de aparecer como columna en las cuentas y en el reporte.",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/cashflow/categories/${cat.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await errorMessage(res, "No se pudo eliminar la categoría"));
      onRefresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "No se pudo eliminar la categoría", "error");
    }
  };

  const incCats = categories.filter((c) => c.type === "income" || c.type === "both");
  const expCats = categories.filter((c) => c.type === "expense" || c.type === "both");

  const list = (title: string, cats: CashFlowCategory[], tone: string, empty: string) => (
    <section>
      <h3 className={`mb-2 text-sm font-medium ${tone}`}>{title}</h3>
      <ul className="space-y-1">
        {cats.map((cat) => (
          <li key={cat.id} className="flex items-center gap-3 rounded-lg bg-secondary px-3 py-1.5">
            <span className="font-mono text-xs font-medium">{cat.code}</span>
            <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">{cat.name}</span>
            <Button variant="ghost" size="icon-sm" onClick={() => deleteCategory(cat)} aria-label={`Eliminar categoría ${cat.code}`} className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
        {cats.length === 0 && <li className="text-sm text-muted-foreground">{empty}</li>}
      </ul>
    </section>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title="Categorías" description="Columnas de ingreso y gasto para clasificar movimientos." size="md">
        <div className="space-y-5">
          {list("Ingresos", incCats, "text-success", "Sin categorías de ingreso")}
          {list("Gastos", expCats, "text-destructive", "Sin categorías de gasto")}

          <form onSubmit={createCategory} className="space-y-3 border-t border-border pt-4">
            <h3 className="text-sm font-medium">Nueva categoría</h3>
            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <Field label="Clave">
                <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="VTA" maxLength={10} />
              </Field>
              <Field label="Nombre">
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ventas" />
              </Field>
            </div>
            <div role="radiogroup" aria-label="Tipo de categoría" className="grid grid-cols-2 gap-2">
              {(["income", "expense"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={newType === t}
                  onClick={() => setNewType(t)}
                  className={`rounded-lg border py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    newType === t
                      ? t === "income"
                        ? "border-success/40 bg-success/10 text-success"
                        : "border-destructive/40 bg-destructive/10 text-destructive"
                      : "border-border text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {t === "income" ? "Ingreso" : "Gasto"}
                </button>
              ))}
            </div>
            <Button type="submit" className="w-full" loading={creating} disabled={!newCode.trim() || !newName.trim()}>
              Crear categoría
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReportTab({ mes, onCategoriesUpdated, onSettings }: { mes: string; onCategoriesUpdated: () => void; onSettings: (c: string | null) => void }) {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCategories, setShowCategories] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cashflow/report?mes=${mes}`);
      if (!res.ok) throw new Error(await errorMessage(res, "No se pudo cargar el reporte"));
      const d = await res.json();
      setData(d);
      onSettings(d?.closedThroughMes ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el reporte");
    } finally {
      setLoading(false);
    }
  }, [mes, onSettings]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (loading) return <CardsSkeleton count={3} className="p-4" />;
  if (error) {
    return (
      <div className="p-4">
        <ErrorState message={error} onRetry={fetchReport} />
      </div>
    );
  }
  if (!data || !data.totals || !Array.isArray(data.accounts)) return null;

  const categoryTotals = data.totals.categoryTotals ?? {};
  const incCats = (data.categories ?? []).filter((c) => c.type === "income" || c.type === "both");
  const expCats = (data.categories ?? []).filter((c) => c.type === "expense" || c.type === "both");

  const categoryTable = (title: string, cats: CashFlowCategory[], tone: string, chip: string) => (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <h3 className={`border-b border-border px-4 py-3 text-sm font-medium ${tone}`}>{title}</h3>
      <table className="w-full text-sm">
        <tbody>
          {cats.map((cat) => (
            <tr key={cat.id} className="border-b border-border/50 last:border-0">
              <td className="px-4 py-2">
                <span className={`rounded px-1.5 py-0.5 font-mono text-xs ${chip}`}>{cat.code}</span>
              </td>
              <td className="px-4 py-2 text-muted-foreground">{cat.name}</td>
              <td className={`whitespace-nowrap px-4 py-2 text-right font-medium tabular-nums ${tone}`}>{fmx(categoryTotals[cat.code] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Reporte — {mesLabel(mes)}</h2>
        <Button variant="outline" size="sm" onClick={() => setShowCategories(true)}>
          <Settings className="h-3.5 w-3.5" />
          Categorías
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-1 text-sm text-muted-foreground">Total depósitos</p>
          <p className="whitespace-nowrap text-xl font-bold tabular-nums text-success">{fmx(data.totals.totalDeposits)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-1 text-sm text-muted-foreground">Total retiros</p>
          <p className="whitespace-nowrap text-xl font-bold tabular-nums text-destructive">{fmx(data.totals.totalWithdrawals)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-1 text-sm text-muted-foreground">Saldo total</p>
          <p className={`whitespace-nowrap text-xl font-bold tabular-nums ${data.totals.totalBalance >= 0 ? "text-success" : "text-destructive"}`}>
            {fmx(data.totals.totalBalance)}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <h3 className="border-b border-border px-4 py-3 text-sm font-medium">Cuentas bancarias</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="text-xs font-medium text-muted-foreground">
              <tr className="border-b border-border/50">
                <th scope="col" className="px-4 py-2 text-left">Cuenta</th>
                <th scope="col" className="px-4 py-2 text-left">Banco</th>
                <th scope="col" className="px-4 py-2 text-right">Saldo inicial</th>
                <th scope="col" className="px-4 py-2 text-right text-success">Depósitos</th>
                <th scope="col" className="px-4 py-2 text-right text-destructive">Retiros</th>
                <th scope="col" className="px-4 py-2 text-right">Saldo final</th>
                <th scope="col" className="px-4 py-2 text-right">Movimientos</th>
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((acc) => (
                <tr key={acc.id} className="border-b border-border/50 last:border-0 hover:bg-secondary/40">
                  <td className="px-4 py-2 font-medium">{acc.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{acc.bankName || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums">{fmx(acc.openingBalance)}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-success">{fmx(acc.totalDeposits)}</td>
                  <td className="whitespace-nowrap px-4 py-2 text-right tabular-nums text-destructive">{fmx(acc.totalWithdrawals)}</td>
                  <td className={`whitespace-nowrap px-4 py-2 text-right font-semibold tabular-nums ${acc.currentBalance >= 0 ? "text-success" : "text-destructive"}`}>
                    {fmx(acc.currentBalance)}
                  </td>
                  <td className="px-4 py-2 text-right text-muted-foreground">{acc.transactionCount}</td>
                </tr>
              ))}
              {data.accounts.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Sin cuentas bancarias. Usa «Agregar cuenta» para comenzar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(incCats.length > 0 || expCats.length > 0) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {incCats.length > 0 && categoryTable("Ingresos por categoría", incCats, "text-success", "bg-success/10 text-success")}
          {expCats.length > 0 && categoryTable("Gastos por categoría", expCats, "text-destructive", "bg-destructive/10 text-destructive")}
        </div>
      )}

      <CategoryDialog
        open={showCategories}
        categories={data.categories ?? []}
        onClose={() => setShowCategories(false)}
        onRefresh={() => {
          fetchReport();
          onCategoriesUpdated();
        }}
      />
    </div>
  );
}

// ─── Add Account Dialog ──────────────────────────────────────────────

function AddAccountDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (account: CashFlowAccount) => void }) {
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName("");
    setBankName("");
    setAccountNumber("");
    setOpeningBalance("");
    setError(null);
  }, [open]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Ponle un nombre a la cuenta");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/cashflow/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          bankName: bankName.trim() || null,
          accountNumber: accountNumber.trim() || null,
          openingBalance: parseFloat(openingBalance.replace(/[^0-9.\-]/g, "")) || 0,
        }),
      });
      if (!res.ok) throw new Error(await errorMessage(res, "No se pudo crear la cuenta"));
      const data = await res.json();
      if (!data.account) throw new Error("No se pudo crear la cuenta");
      onCreated(data.account);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la cuenta");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Agregar cuenta bancaria"
        footer={
          <>
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" form="add-account-form" loading={creating}>Crear cuenta</Button>
          </>
        }
      >
        <form id="add-account-form" onSubmit={create} className="space-y-4" noValidate>
          <Field label="Nombre de la cuenta" error={error}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Operaciones BBVA" autoFocus />
          </Field>
          <Field label="Banco" optional>
            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="BBVA, Santander, HSBC…" />
          </Field>
          <Field label="Número de cuenta / CLABE" optional>
            <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Últimos 4 dígitos o CLABE" />
          </Field>
          <Field label="Saldo inicial" optional>
            <MoneyInput value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} placeholder="0.00" />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────

const MES_STORAGE_KEY = "cashflow.mes";

export default function CashFlowPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const me = useMe();
  const [accounts, setAccounts] = useState<CashFlowAccount[]>([]);
  const [categories, setCategories] = useState<CashFlowCategory[]>([]);
  const [activeTab, setActiveTab] = useState<"report" | string>("report");
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [mes, setMes] = useState<string>(currentMonthMX());
  const [closedThroughMes, setClosedThroughMes] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const options = useMemo(() => monthOptions(), []);

  // Restore persisted month (client only).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(MES_STORAGE_KEY);
      if (saved && /^\d{4}-\d{2}$/.test(saved)) setMes(saved);
    } catch {}
  }, []);

  const changeMes = useCallback((next: string) => {
    setMes(next);
    try { localStorage.setItem(MES_STORAGE_KEY, next); } catch {}
  }, []);

  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch("/api/cashflow/accounts");
      if (!res.ok) throw new Error(await errorMessage(res, "No se pudieron cargar las cuentas"));
      const data = await res.json();
      if (data.accounts) setAccounts(data.accounts);
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudieron cargar las cuentas", "error", {
        action: { label: "Reintentar", onClick: () => fetchAccounts() },
      });
    } finally {
      setLoadingAccounts(false);
    }
  }, [toast]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/cashflow/categories");
      if (!res.ok) return;
      const data = await res.json();
      if (data.categories) setCategories(data.categories);
    } catch {
      // Columns just won't show; the ledger still works.
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetchCategories();
  }, [fetchAccounts, fetchCategories]);

  const activeAccount = accounts.find((a) => a.id === activeTab);

  const monthClosed = !!closedThroughMes && mes <= closedThroughMes;

  const deleteActiveAccount = async () => {
    if (!activeAccount) return;
    const ok = await confirm({
      title: `¿Eliminar el banco «${activeAccount.name}»?`,
      description: "Se ocultará junto con todos sus movimientos.",
      confirmLabel: "Eliminar banco",
      destructive: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/cashflow/accounts/${activeAccount.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await errorMessage(res, "No se pudo eliminar el banco"));
      setAccounts((prev) => prev.filter((a) => a.id !== activeAccount.id));
      setActiveTab("report");
      toast("Banco eliminado", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo eliminar el banco", "error");
    }
  };

  const closeMonth = async () => {
    const ok = await confirm({
      title: `¿Cerrar ${mesLabel(mes)}?`,
      description: "Ya no se podrán editar sus movimientos. Solo Dirección puede reabrirlo.",
      confirmLabel: "Cerrar mes",
    });
    if (!ok) return;
    setClosing(true);
    try {
      const res = await fetch("/api/cashflow/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes }),
      });
      if (!res.ok) throw new Error(await errorMessage(res, "No se pudo cerrar el mes"));
      const data = await res.json();
      setClosedThroughMes(data.closedThroughMes ?? mes);
      toast(`${mesLabel(mes)} cerrado`, "success");
      // Move working month forward to the next month.
      changeMes(shiftMes(mes, 1));
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo cerrar el mes", "error");
    } finally {
      setClosing(false);
    }
  };

  const reopenMonth = async () => {
    const ok = await confirm({
      title: `¿Reabrir ${mesLabel(mes)}?`,
      description: "También se reabren los meses posteriores.",
      confirmLabel: "Reabrir",
    });
    if (!ok) return;
    setClosing(true);
    try {
      const res = await fetch("/api/cashflow/reopen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes }),
      });
      if (!res.ok) throw new Error(await errorMessage(res, "No se pudo reabrir el mes"));
      const data = await res.json();
      setClosedThroughMes(data.closedThroughMes ?? null);
      toast(`${mesLabel(mes)} reabierto`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo reabrir el mes", "error");
    } finally {
      setClosing(false);
    }
  };

  const tabClass = (active: boolean) =>
    `whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
      active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="flex h-full min-h-[calc(100vh-64px)] flex-col bg-background">
      <div className="border-b border-border px-4 pb-0 pt-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/dashboard/finance" aria-label="Volver a Finanzas">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="mr-auto">
            <h1 className="text-lg font-bold">Flujo de efectivo</h1>
            <p className="text-sm text-muted-foreground">Cuentas bancarias y movimientos del mes</p>
          </div>

          {/* Month selector + lock controls */}
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="cashflow-mes" className="sr-only">Mes</label>
            <Select id="cashflow-mes" value={mes} onChange={(e) => changeMes(e.target.value)} className="h-9 w-auto py-1.5">
              {options.map((m) => (
                <option key={m} value={m}>{mesLabel(m)}</option>
              ))}
            </Select>

            {monthClosed ? (
              <span className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs font-medium text-warning-foreground dark:text-warning">
                <Lock className="h-3.5 w-3.5" />
                Mes cerrado
              </span>
            ) : (
              <Button variant="outline" size="sm" onClick={closeMonth} disabled={closing}>
                <Lock className="h-3.5 w-3.5" />
                Cerrar mes
              </Button>
            )}

            {monthClosed && me?.jobRole === "DIRECCION" && (
              <Button variant="outline" size="sm" onClick={reopenMonth} disabled={closing} title="Reabrir este mes (solo Dirección)">
                <Unlock className="h-3.5 w-3.5" />
                Reabrir
              </Button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Reporte y cuentas">
          <button role="tab" aria-selected={activeTab === "report"} onClick={() => setActiveTab("report")} className={tabClass(activeTab === "report")}>
            Reporte
          </button>
          {accounts.map((acc) => (
            <button key={acc.id} role="tab" aria-selected={activeTab === acc.id} onClick={() => setActiveTab(acc.id)} className={tabClass(activeTab === acc.id)}>
              {acc.name}
            </button>
          ))}
          {loadingAccounts && (
            <div className="px-4 py-2.5" aria-label="Cargando cuentas">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={() => setShowAddAccount(true)} className="text-primary">
            <Plus className="h-4 w-4" />
            Agregar cuenta
          </Button>
          {activeAccount && (
            <Button variant="ghost" size="sm" onClick={deleteActiveAccount} className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
              Eliminar banco
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden" role="tabpanel">
        {activeTab === "report" ? (
          <div className="h-full overflow-y-auto">
            <ReportTab mes={mes} onCategoriesUpdated={fetchCategories} onSettings={setClosedThroughMes} />
          </div>
        ) : activeAccount ? (
          <AccountLedger
            key={activeAccount.id + mes}
            account={activeAccount}
            accounts={accounts}
            categories={categories}
            mes={mes}
            readOnly={monthClosed}
            onSettings={setClosedThroughMes}
          />
        ) : null}
      </div>

      <AddAccountDialog
        open={showAddAccount}
        onClose={() => setShowAddAccount(false)}
        onCreated={(acc) => {
          setAccounts((prev) => [...prev, acc]);
          setActiveTab(acc.id);
          toast("Cuenta creada", "success");
        }}
      />
    </div>
  );
}
