"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Settings, X, ChevronLeft, Trash2, Loader2 } from "lucide-react";

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
}

function Cell({ value, onChange, type = "text", className = "", readOnly = false, placeholder = "", align = "left" }: CellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const display = type === "date" ? toDateStr(value as string) : (value !== null && value !== undefined ? String(value) : "");

  const startEdit = () => {
    if (readOnly) return;
    setDraft(display);
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const commit = () => {
    setEditing(false);
    if (draft !== display) onChange(draft);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Tab") commit(); if (e.key === "Escape") setEditing(false); }}
        className={`w-full bg-[#1a1a2e] border border-[#3D7FFF] rounded px-1 py-0.5 text-xs outline-none ${align === "right" ? "text-right" : "text-left"} ${className}`}
      />
    );
  }

  return (
    <div
      onClick={startEdit}
      className={`w-full min-h-[22px] px-1 py-0.5 text-xs rounded cursor-pointer hover:bg-white/5 truncate ${readOnly ? "cursor-default" : ""} ${align === "right" ? "text-right" : "text-left"} ${className}`}
    >
      {display || <span className="text-muted-foreground/30 text-[10px]">{placeholder}</span>}
    </div>
  );
}

// ─── Transaction Row ─────────────────────────────────────────────────

interface TxRowProps {
  index: number;
  tx: CashFlowTransaction;
  categories: CashFlowCategory[];
  onUpdate: (id: string, field: string, value: unknown) => void;
  onDelete: (id: string) => void;
}

function TxRow({ index, tx, categories, onUpdate, onDelete }: TxRowProps) {
  const incCats = categories.filter((c) => c.type === "income" || c.type === "both");
  const expCats = categories.filter((c) => c.type === "expense" || c.type === "both");

  const updateCatValue = (catCode: string, catType: "income" | "expense", val: string) => {
    const key = catType === "income" ? "incomeCategories" : "expenseCategories";
    const current: Record<string, number> = catType === "income"
      ? (tx.incomeCategories ?? {})
      : (tx.expenseCategories ?? {});
    const parsed = parseFloat(val);
    const updated = { ...current };
    if (!val || isNaN(parsed)) {
      delete updated[catCode];
    } else {
      updated[catCode] = parsed;
    }
    onUpdate(tx.id, key, Object.keys(updated).length === 0 ? null : updated);
  };

  return (
    <tr className="border-b border-border/30 hover:bg-white/[0.02] group">
      <td className="px-2 py-1 text-xs text-muted-foreground/50 text-center w-8">{index + 1}</td>
      <td className="px-1 py-1 min-w-[100px]">
        <Cell
          value={toDateStr(tx.date)}
          type="date"
          onChange={(v) => onUpdate(tx.id, "date", v)}
          placeholder="fecha"
        />
      </td>
      <td className="px-1 py-1 min-w-[130px]">
        <Cell value={tx.bankReference} onChange={(v) => onUpdate(tx.id, "bankReference", v)} placeholder="referencia bancaria" />
      </td>
      <td className="px-1 py-1 min-w-[110px]">
        <Cell value={tx.movementType} onChange={(v) => onUpdate(tx.id, "movementType", v)} placeholder="tipo" />
      </td>
      <td className="px-1 py-1 min-w-[100px]">
        <Cell
          value={tx.deposit !== null && tx.deposit !== undefined ? fmxNum(tx.deposit) : ""}
          onChange={(v) => onUpdate(tx.id, "deposit", v)}
          placeholder="0.00"
          align="right"
          className="text-[#00E87B]"
        />
      </td>
      <td className="px-1 py-1 min-w-[100px]">
        <Cell
          value={tx.withdrawal !== null && tx.withdrawal !== undefined ? fmxNum(tx.withdrawal) : ""}
          onChange={(v) => onUpdate(tx.id, "withdrawal", v)}
          placeholder="0.00"
          align="right"
          className="text-[#FF4444]"
        />
      </td>
      <td className="px-1 py-1 min-w-[110px]">
        <div className={`text-xs text-right px-1 py-0.5 font-medium ${tx.balance >= 0 ? "text-[#00E87B]" : "text-[#FF4444]"}`}>
          {fmx(tx.balance)}
        </div>
      </td>
      <td className="px-1 py-1 min-w-[140px]">
        <Cell value={tx.concept} onChange={(v) => onUpdate(tx.id, "concept", v)} placeholder="concepto" />
      </td>
      <td className="px-1 py-1 min-w-[120px]">
        <Cell value={tx.provider} onChange={(v) => onUpdate(tx.id, "provider", v)} placeholder="proveedor" />
      </td>
      <td className="px-1 py-1 min-w-[100px]">
        <Cell value={tx.reference} onChange={(v) => onUpdate(tx.id, "reference", v)} placeholder="referencia" />
      </td>
      <td className="px-1 py-1 min-w-[120px]">
        <Cell value={tx.invoiceUuid} onChange={(v) => onUpdate(tx.id, "invoiceUuid", v)} placeholder="folio/uuid" />
      </td>
      <td className="px-1 py-1 min-w-[80px]">
        <Cell
          value={tx.taxRate !== null && tx.taxRate !== undefined ? String(tx.taxRate) : ""}
          onChange={(v) => onUpdate(tx.id, "taxRate", v)}
          placeholder="0%"
          align="right"
        />
      </td>
      <td className="px-1 py-1 min-w-[100px]">
        <Cell value={tx.salesType} onChange={(v) => onUpdate(tx.id, "salesType", v)} placeholder="ventas" />
      </td>
      {incCats.map((cat) => (
        <td key={`inc-${cat.id}`} className="px-1 py-1 min-w-[90px]">
          <Cell
            value={tx.incomeCategories?.[cat.code] !== undefined ? fmxNum(tx.incomeCategories[cat.code]) : ""}
            onChange={(v) => updateCatValue(cat.code, "income", v)}
            align="right"
            placeholder="0.00"
            className="text-[#00E87B]"
          />
        </td>
      ))}
      {expCats.map((cat) => (
        <td key={`exp-${cat.id}`} className="px-1 py-1 min-w-[90px]">
          <Cell
            value={tx.expenseCategories?.[cat.code] !== undefined ? fmxNum(tx.expenseCategories[cat.code]) : ""}
            onChange={(v) => updateCatValue(cat.code, "expense", v)}
            align="right"
            placeholder="0.00"
            className="text-[#FF4444]"
          />
        </td>
      ))}
      <td className="px-2 py-1 w-8">
        <button
          onClick={() => onDelete(tx.id)}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-[#FF4444] transition-opacity"
        >
          <Trash2 size={12} />
        </button>
      </td>
    </tr>
  );
}

// ─── Account Ledger View ─────────────────────────────────────────────

interface AccountLedgerProps {
  account: CashFlowAccount;
  categories: CashFlowCategory[];
}

function AccountLedger({ account, categories }: AccountLedgerProps) {
  const [transactions, setTransactions] = useState<CashFlowTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const debounceRefs = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cashflow/accounts/${account.id}/transactions`);
      const data = await res.json();
      if (data.transactions) setTransactions(data.transactions);
    } finally {
      setLoading(false);
    }
  }, [account.id]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const addRow = async () => {
    try {
      const res = await fetch(`/api/cashflow/accounts/${account.id}/transactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: new Date().toISOString() }),
      });
      const data = await res.json();
      if (data.transaction) {
        await fetchTransactions();
      }
    } catch {}
  };

  const handleUpdate = useCallback(
    (id: string, field: string, value: unknown) => {
      // Normalize numeric fields: strip thousands separators / currency chars
      let normalized: unknown = value;
      if (field === "deposit" || field === "withdrawal" || field === "taxRate") {
        if (value === "" || value === null || value === undefined) {
          normalized = null;
        } else {
          const cleaned = String(value).replace(/[^0-9.\-]/g, "");
          const num = parseFloat(cleaned);
          normalized = isNaN(num) ? null : num;
        }
      }

      setTransactions((prev) => {
        const idx = prev.findIndex((t) => t.id === id);
        if (idx === -1) return prev;
        const updated = [...prev];
        updated[idx] = { ...updated[idx], [field]: normalized };
        let bal = account.openingBalance;
        return updated.map((t) => {
          bal += (Number(t.deposit) || 0) - (Number(t.withdrawal) || 0);
          return { ...t, balance: bal };
        });
      });

      if (debounceRefs.current[id]) clearTimeout(debounceRefs.current[id]);
      debounceRefs.current[id] = setTimeout(async () => {
        setSaving(true);
        try {
          await fetch(`/api/cashflow/transactions/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ [field]: normalized }),
          });
        } finally {
          setSaving(false);
        }
      }, 500);
    },
    [account.openingBalance]
  );

  const handleDelete = async (id: string) => {
    setTransactions((prev) => {
      const filtered = prev.filter((t) => t.id !== id);
      let bal = account.openingBalance;
      return filtered.map((t) => {
        bal += (Number(t.deposit) || 0) - (Number(t.withdrawal) || 0);
        return { ...t, balance: bal };
      });
    });
    await fetch(`/api/cashflow/transactions/${id}`, { method: "DELETE" });
  };

  const incCats = categories.filter((c) => c.type === "income" || c.type === "both");
  const expCats = categories.filter((c) => c.type === "expense" || c.type === "both");

  const currentBalance = transactions[transactions.length - 1]?.balance ?? account.openingBalance;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-6 px-4 py-3 border-b border-border/50">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Banco</p>
          <p className="text-sm font-medium">{account.bankName || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Cuenta</p>
          <p className="text-sm font-medium">{account.accountNumber || "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Saldo Inicial</p>
          <p className="text-sm font-medium">{fmx(account.openingBalance)}</p>
        </div>
        <div className="ml-auto">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Saldo Actual</p>
          <p className={`text-base font-bold ${currentBalance >= 0 ? "text-[#00E87B]" : "text-[#FF4444]"}`}>{fmx(currentBalance)}</p>
        </div>
        {saving && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" />
            Guardando...
          </div>
        )}
      </div>

      <div className="overflow-auto flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
            <Loader2 size={16} className="animate-spin mr-2" />
            Cargando...
          </div>
        ) : (
          <table className="w-full border-collapse text-xs min-w-max">
            <thead className="sticky top-0 z-10 bg-background border-b border-border">
              <tr>
                <th className="px-2 py-2 text-center text-muted-foreground uppercase tracking-widest text-[10px] w-8">#</th>
                <th className="px-1 py-2 text-left text-muted-foreground uppercase tracking-widest text-[10px]">Fecha</th>
                <th className="px-1 py-2 text-left text-muted-foreground uppercase tracking-widest text-[10px]">Ref. Bancaria</th>
                <th className="px-1 py-2 text-left text-muted-foreground uppercase tracking-widest text-[10px]">Tipo Movimiento</th>
                <th className="px-1 py-2 text-right text-[#00E87B] uppercase tracking-widest text-[10px]">Deposito</th>
                <th className="px-1 py-2 text-right text-[#FF4444] uppercase tracking-widest text-[10px]">Retiro</th>
                <th className="px-1 py-2 text-right text-muted-foreground uppercase tracking-widest text-[10px]">Saldo</th>
                <th className="px-1 py-2 text-left text-muted-foreground uppercase tracking-widest text-[10px]">Concepto</th>
                <th className="px-1 py-2 text-left text-muted-foreground uppercase tracking-widest text-[10px]">Proveedor</th>
                <th className="px-1 py-2 text-left text-muted-foreground uppercase tracking-widest text-[10px]">Referencia</th>
                <th className="px-1 py-2 text-left text-muted-foreground uppercase tracking-widest text-[10px]">Folio/UUID</th>
                <th className="px-1 py-2 text-right text-muted-foreground uppercase tracking-widest text-[10px]">Impuesto</th>
                <th className="px-1 py-2 text-left text-muted-foreground uppercase tracking-widest text-[10px]">Ventas</th>
                {incCats.map((cat) => (
                  <th key={cat.id} className="px-1 py-2 text-right text-[#00E87B] uppercase tracking-widest text-[10px]">
                    {cat.code}
                  </th>
                ))}
                {expCats.map((cat) => (
                  <th key={cat.id} className="px-1 py-2 text-right text-[#FF4444] uppercase tracking-widest text-[10px]">
                    {cat.code}
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, i) => (
                <TxRow
                  key={tx.id}
                  index={i}
                  tx={tx}
                  categories={categories}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={13 + incCats.length + expCats.length} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    Sin movimientos. Haz clic en "Agregar fila" para comenzar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border/50">
        <button
          onClick={addRow}
          className="flex items-center gap-2 text-xs text-[#3D7FFF] hover:text-[#3D7FFF]/80 transition-colors"
        >
          <Plus size={14} />
          Agregar fila
        </button>
      </div>
    </div>
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
}

interface CategoryPanelProps {
  categories: CashFlowCategory[];
  onClose: () => void;
  onRefresh: () => void;
}

function CategoryPanel({ categories, onClose, onRefresh }: CategoryPanelProps) {
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"income" | "expense">("income");
  const [creating, setCreating] = useState(false);

  const createCategory = async () => {
    if (!newCode.trim() || !newName.trim()) return;
    setCreating(true);
    try {
      await fetch("/api/cashflow/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: newCode.trim().toUpperCase(), name: newName.trim(), type: newType }),
      });
      setNewCode("");
      setNewName("");
      onRefresh();
    } finally {
      setCreating(false);
    }
  };

  const deleteCategory = async (id: string) => {
    await fetch(`/api/cashflow/categories/${id}`, { method: "DELETE" });
    onRefresh();
  };

  const incCats = categories.filter((c) => c.type === "income" || c.type === "both");
  const expCats = categories.filter((c) => c.type === "expense" || c.type === "both");

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-card border-l border-border shadow-2xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-4 border-b border-border">
        <h3 className="font-semibold text-sm">Categorias</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <p className="text-xs text-[#00E87B] uppercase tracking-widest mb-2">Ingresos</p>
          <div className="space-y-1">
            {incCats.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between px-3 py-2 rounded bg-white/5">
                <span className="text-xs font-mono font-medium">{cat.code}</span>
                <span className="text-xs text-muted-foreground flex-1 mx-3 truncate">{cat.name}</span>
                <button onClick={() => deleteCategory(cat.id)} className="text-muted-foreground hover:text-[#FF4444]">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {incCats.length === 0 && <p className="text-xs text-muted-foreground/50">Sin categorias de ingreso</p>}
          </div>
        </div>

        <div>
          <p className="text-xs text-[#FF4444] uppercase tracking-widest mb-2">Gastos</p>
          <div className="space-y-1">
            {expCats.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between px-3 py-2 rounded bg-white/5">
                <span className="text-xs font-mono font-medium">{cat.code}</span>
                <span className="text-xs text-muted-foreground flex-1 mx-3 truncate">{cat.name}</span>
                <button onClick={() => deleteCategory(cat.id)} className="text-muted-foreground hover:text-[#FF4444]">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
            {expCats.length === 0 && <p className="text-xs text-muted-foreground/50">Sin categorias de gasto</p>}
          </div>
        </div>
      </div>

      <div className="border-t border-border p-4 space-y-3">
        <p className="text-xs text-muted-foreground uppercase tracking-widest">Nueva categoria</p>
        <div className="flex gap-2">
          <input
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            placeholder="Clave"
            className="w-20 bg-white/5 border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-[#3D7FFF]"
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nombre"
            className="flex-1 bg-white/5 border border-border rounded px-2 py-1.5 text-xs outline-none focus:border-[#3D7FFF]"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setNewType("income")}
            className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${newType === "income" ? "bg-[#00E87B]/20 text-[#00E87B] border border-[#00E87B]/30" : "bg-white/5 text-muted-foreground border border-transparent"}`}
          >
            Ingreso
          </button>
          <button
            onClick={() => setNewType("expense")}
            className={`flex-1 py-1.5 rounded text-xs font-medium transition-colors ${newType === "expense" ? "bg-[#FF4444]/20 text-[#FF4444] border border-[#FF4444]/30" : "bg-white/5 text-muted-foreground border border-transparent"}`}
          >
            Gasto
          </button>
        </div>
        <button
          onClick={createCategory}
          disabled={creating || !newCode.trim() || !newName.trim()}
          className="w-full py-2 rounded bg-[#3D7FFF] text-white text-xs font-medium hover:bg-[#3D7FFF]/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {creating ? "Creando..." : "Crear categoria"}
        </button>
      </div>
    </div>
  );
}

function ReportTab({ onCategoriesUpdated }: { onCategoriesUpdated: () => void }) {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCategories, setShowCategories] = useState(false);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/cashflow/report");
      const d = await res.json();
      setData(d);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground text-sm">
        <Loader2 size={16} className="animate-spin mr-2" />
        Cargando reporte...
      </div>
    );
  }

  if (!data || !data.totals || !Array.isArray(data.accounts)) return null;

  const categoryTotals = data.totals.categoryTotals ?? {};
  const incCats = (data.categories ?? []).filter((c) => c.type === "income" || c.type === "both");
  const expCats = (data.categories ?? []).filter((c) => c.type === "expense" || c.type === "both");

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-base">Reporte de Flujo de Efectivo</h2>
        <button
          onClick={() => setShowCategories(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-border text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings size={13} />
          Categorias
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Total Depositos</p>
          <p className="text-xl font-bold text-[#00E87B]">{fmx(data.totals.totalDeposits)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Total Retiros</p>
          <p className="text-xl font-bold text-[#FF4444]">{fmx(data.totals.totalWithdrawals)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Saldo Total</p>
          <p className={`text-xl font-bold ${data.totals.totalBalance >= 0 ? "text-[#00E87B]" : "text-[#FF4444]"}`}>
            {fmx(data.totals.totalBalance)}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50">
          <p className="text-xs text-muted-foreground uppercase tracking-widest">Cuentas Bancarias</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/30">
              <th className="px-4 py-2 text-left text-muted-foreground text-xs uppercase tracking-widest">Cuenta</th>
              <th className="px-4 py-2 text-left text-muted-foreground text-xs uppercase tracking-widest">Banco</th>
              <th className="px-4 py-2 text-right text-muted-foreground text-xs uppercase tracking-widest">Saldo Inicial</th>
              <th className="px-4 py-2 text-right text-[#00E87B] text-xs uppercase tracking-widest">Depositos</th>
              <th className="px-4 py-2 text-right text-[#FF4444] text-xs uppercase tracking-widest">Retiros</th>
              <th className="px-4 py-2 text-right text-muted-foreground text-xs uppercase tracking-widest">Saldo Actual</th>
              <th className="px-4 py-2 text-right text-muted-foreground text-xs uppercase tracking-widest">Movimientos</th>
            </tr>
          </thead>
          <tbody>
            {data.accounts.map((acc) => (
              <tr key={acc.id} className="border-b border-border/20 hover:bg-white/[0.02]">
                <td className="px-4 py-2 font-medium text-sm">{acc.name}</td>
                <td className="px-4 py-2 text-muted-foreground text-sm">{acc.bankName || "—"}</td>
                <td className="px-4 py-2 text-right text-sm">{fmx(acc.openingBalance)}</td>
                <td className="px-4 py-2 text-right text-[#00E87B] text-sm">{fmx(acc.totalDeposits)}</td>
                <td className="px-4 py-2 text-right text-[#FF4444] text-sm">{fmx(acc.totalWithdrawals)}</td>
                <td className={`px-4 py-2 text-right font-semibold text-sm ${acc.currentBalance >= 0 ? "text-[#00E87B]" : "text-[#FF4444]"}`}>
                  {fmx(acc.currentBalance)}
                </td>
                <td className="px-4 py-2 text-right text-muted-foreground text-sm">{acc.transactionCount}</td>
              </tr>
            ))}
            {data.accounts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground text-sm">
                  Sin cuentas bancarias. Agrega una cuenta para comenzar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(incCats.length > 0 || expCats.length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {incCats.length > 0 && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border/50">
                <p className="text-xs text-[#00E87B] uppercase tracking-widest">Ingresos por Categoria</p>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {incCats.map((cat) => {
                    const amount = categoryTotals[cat.code] ?? 0;
                    return (
                      <tr key={cat.id} className="border-b border-border/20">
                        <td className="px-4 py-2">
                          <span className="font-mono text-xs bg-[#00E87B]/10 text-[#00E87B] px-1.5 py-0.5 rounded">{cat.code}</span>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground text-xs">{cat.name}</td>
                        <td className="px-4 py-2 text-right text-[#00E87B] font-medium">{fmx(amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {expCats.length > 0 && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border/50">
                <p className="text-xs text-[#FF4444] uppercase tracking-widest">Gastos por Categoria</p>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {expCats.map((cat) => {
                    const amount = categoryTotals[cat.code] ?? 0;
                    return (
                      <tr key={cat.id} className="border-b border-border/20">
                        <td className="px-4 py-2">
                          <span className="font-mono text-xs bg-[#FF4444]/10 text-[#FF4444] px-1.5 py-0.5 rounded">{cat.code}</span>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground text-xs">{cat.name}</td>
                        <td className="px-4 py-2 text-right text-[#FF4444] font-medium">{fmx(amount)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showCategories && (
        <CategoryPanel
          categories={data.categories}
          onClose={() => setShowCategories(false)}
          onRefresh={() => {
            fetchReport();
            onCategoriesUpdated();
          }}
        />
      )}
    </div>
  );
}

// ─── Add Account Modal ───────────────────────────────────────────────

interface AddAccountModalProps {
  onClose: () => void;
  onCreated: (account: CashFlowAccount) => void;
}

function AddAccountModal({ onClose, onCreated }: AddAccountModalProps) {
  const [name, setName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [openingBalance, setOpeningBalance] = useState("");
  const [creating, setCreating] = useState(false);

  const create = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/cashflow/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          bankName: bankName.trim() || null,
          accountNumber: accountNumber.trim() || null,
          openingBalance: parseFloat(openingBalance) || 0,
        }),
      });
      const data = await res.json();
      if (data.account) {
        onCreated(data.account);
        onClose();
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="font-semibold">Agregar Cuenta Bancaria</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5 block">Nombre de la cuenta *</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Cuenta Operaciones BBVA"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && create()}
              className="w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#3D7FFF] transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5 block">Banco</label>
            <input
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="Ej: BBVA, Santander, HSBC..."
              className="w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#3D7FFF] transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5 block">Numero de cuenta / CLABE</label>
            <input
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              placeholder="Ultimos 4 digitos o CLABE completa"
              className="w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#3D7FFF] transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-widest mb-1.5 block">Saldo inicial</label>
            <input
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              type="number"
              placeholder="0.00"
              className="w-full bg-white/5 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-[#3D7FFF] transition-colors"
            />
          </div>
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={create}
            disabled={creating || !name.trim()}
            className="flex-1 py-2 rounded-lg bg-[#3D7FFF] text-white text-sm font-medium hover:bg-[#3D7FFF]/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {creating ? "Creando..." : "Crear cuenta"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────

export default function CashFlowPage() {
  const [accounts, setAccounts] = useState<CashFlowAccount[]>([]);
  const [categories, setCategories] = useState<CashFlowCategory[]>([]);
  const [activeTab, setActiveTab] = useState<"report" | string>("report");
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const fetchAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    try {
      const res = await fetch("/api/cashflow/accounts");
      const data = await res.json();
      if (data.accounts) setAccounts(data.accounts);
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    const res = await fetch("/api/cashflow/categories");
    const data = await res.json();
    if (data.categories) setCategories(data.categories);
  }, []);

  useEffect(() => {
    fetchAccounts();
    fetchCategories();
  }, [fetchAccounts, fetchCategories]);

  const activeAccount = accounts.find((a) => a.id === activeTab);

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-64px)] bg-background">
      <div className="px-4 pt-4 pb-0 border-b border-border">
        <div className="flex items-center gap-3 mb-4">
          <a href="/dashboard/finance" className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft size={18} />
          </a>
          <div>
            <h1 className="text-lg font-bold">Flujo de Efectivo</h1>
            <p className="text-xs text-muted-foreground">Gestion de cuentas bancarias y movimientos</p>
          </div>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-0">
          <button
            onClick={() => setActiveTab("report")}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === "report"
                ? "border-[#3D7FFF] text-[#3D7FFF]"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Reporte
          </button>
          {accounts.map((acc) => (
            <button
              key={acc.id}
              onClick={() => setActiveTab(acc.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === acc.id
                  ? "border-[#3D7FFF] text-[#3D7FFF]"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {acc.name}
            </button>
          ))}
          {loadingAccounts && (
            <div className="px-4 py-2.5">
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
            </div>
          )}
          <button
            onClick={() => setShowAddAccount(true)}
            className="px-3 py-2.5 text-sm font-medium text-[#3D7FFF] hover:text-[#3D7FFF]/80 flex items-center gap-1 whitespace-nowrap transition-colors"
          >
            <Plus size={14} />
            Agregar cuenta
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "report" ? (
          <div className="h-full overflow-y-auto">
            <ReportTab onCategoriesUpdated={fetchCategories} />
          </div>
        ) : activeAccount ? (
          <AccountLedger account={activeAccount} categories={categories} />
        ) : null}
      </div>

      {showAddAccount && (
        <AddAccountModal
          onClose={() => setShowAddAccount(false)}
          onCreated={(acc) => {
            setAccounts((prev) => [...prev, acc]);
            setActiveTab(acc.id);
          }}
        />
      )}
    </div>
  );
}
