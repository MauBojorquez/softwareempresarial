"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Settings, ChevronRight, Trash2, X } from "lucide-react";

type Account = {
  id: string; name: string; bankName?: string; openingBalance: number;
};
type Category = {
  id: string; code: string; name: string; type: string;
};
type Transaction = {
  id: string; date: string; bankReference?: string; movementType?: string;
  deposit?: number; withdrawal?: number; runningBalance: number;
  concept?: string; provider?: string; reference?: string; invoiceUuid?: string;
  taxRate?: number; salesType?: string;
  incomeCategories?: Record<string, number>;
  expenseCategories?: Record<string, number>;
  notes?: string;
};
type ReportData = {
  accounts: { id: string; name: string; openingBalance: number; totalDeposits: number; totalWithdrawals: number; currentBalance: number }[];
  categories: { id: string; code: string; name: string; type: string; totalIncome: number; totalExpense: number }[];
  grandTotalDeposits: number; grandTotalWithdrawals: number; grandBalance: number;
};

const fmt = (n: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 2 }).format(n);
const todayIso = () => new Date().toISOString().slice(0,10);

function AddAccountModal({ onClose, onSave }: { onClose: () => void; onSave: (a: Account) => void }) {
  const [name, setName] = useState("");
  const [bank, setBank] = useState("");
  const [opening, setOpening] = useState("0");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/cashflow/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), bankName: bank.trim() || undefined, openingBalance: parseFloat(opening) || 0 }),
    });
    const data = await res.json();
    onSave(data.account);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">Nueva cuenta bancaria</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Nombre de la cuenta *</label>
            <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="BBVA DLC 1044"
              className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Banco</label>
            <input value={bank} onChange={e => setBank(e.target.value)} placeholder="BBVA, Santander..."
              className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground">Saldo inicial</label>
            <input type="number" value={opening} onChange={e => setOpening(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-secondary/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30" />
          </div>
        </div>
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:bg-secondary">Cancelar</button>
          <button onClick={submit} disabled={saving || !name.trim()} className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
            {saving ? "Guardando..." : "Agregar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CategoryPanel({ categories, onClose, onRefresh }: { categories: Category[]; onClose: () => void; onRefresh: () => void }) {
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("both");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!newCode.trim() || !newName.trim()) return;
    setSaving(true);
    await fetch("/api/cashflow/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: newCode, name: newName, type: newType }) });
    setNewCode(""); setNewName(""); setSaving(false);
    onRefresh();
  };

  const del = async (id: string) => {
    await fetch(`/api/cashflow/categories/${id}`, { method: "DELETE" });
    onRefresh();
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-80 border-l border-border bg-card shadow-2xl flex flex-col">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-sm font-semibold">Categorías</h2>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {categories.map(c => (
            <div key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary/50">
              <span className="w-10 text-[10px] font-mono font-bold text-primary">{c.code}</span>
              <span className="flex-1 text-sm">{c.name}</span>
              <span className="text-[10px] text-muted-foreground">{c.type === "income" ? "Ingreso" : c.type === "expense" ? "Egreso" : "Ambos"}</span>
              <button onClick={() => del(c.id)} className="text-muted-foreground hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-border p-4 space-y-2">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Nueva categoría</p>
        <div className="flex gap-2">
          <input value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} placeholder="CÓDIGO" maxLength={5}
            className="w-20 rounded-lg border border-border bg-secondary/50 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30" />
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nombre"
            className="flex-1 rounded-lg border border-border bg-secondary/50 px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/30" />
        </div>
        <select value={newType} onChange={e => setNewType(e.target.value)}
          className="w-full rounded-lg border border-border bg-secondary/50 px-2 py-1.5 text-xs focus:outline-none">
          <option value="both">Ingresos y Egresos</option>
          <option value="income">Solo Ingresos</option>
          <option value="expense">Solo Egresos</option>
        </select>
        <button onClick={add} disabled={saving || !newCode.trim() || !newName.trim()} className="w-full rounded-lg bg-primary py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-40">
          {saving ? "..." : "Agregar"}
        </button>
      </div>
    </div>
  );
}

function ReportTab({ onManageCategories }: { onManageCategories: () => void }) {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/cashflow/report").then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Cargando reporte...</div>;
  if (!data) return null;

  const today = new Date().toLocaleDateString("es-MX", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Estado de Flujo de Efectivo</p>
          <p className="text-xs text-muted-foreground capitalize">{today}</p>
        </div>
        <button onClick={onManageCategories} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground">
          <Settings className="h-3.5 w-3.5" /> Categorías
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Saldo Total</p>
          <p className="mt-1 text-xl font-extrabold tabular-nums" style={{ color: data.grandBalance >= 0 ? "#00E87B" : "#FF4444" }}>{fmt(data.grandBalance)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Ingresos</p>
          <p className="mt-1 text-xl font-extrabold tabular-nums text-emerald-400">{fmt(data.grandTotalDeposits)}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-500/30 to-transparent" />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Total Egresos</p>
          <p className="mt-1 text-xl font-extrabold tabular-nums text-red-400">{fmt(data.grandTotalWithdrawals)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="border-b border-border px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Saldo en Bancos</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left text-[10px] uppercase tracking-widest text-muted-foreground">Cuenta</th>
                <th className="px-4 py-2 text-right text-[10px] uppercase tracking-widest text-muted-foreground">Depósitos</th>
                <th className="px-4 py-2 text-right text-[10px] uppercase tracking-widest text-muted-foreground">Retiros</th>
                <th className="px-4 py-2 text-right text-[10px] uppercase tracking-widest text-muted-foreground">Disponible</th>
              </tr>
            </thead>
            <tbody>
              {data.accounts.map((a, i) => (
                <tr key={a.id} className={i % 2 === 0 ? "bg-secondary/20" : ""}>
                  <td className="px-4 py-2 font-medium">{a.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-emerald-400">{fmt(a.totalDeposits)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-red-400">{fmt(a.totalWithdrawals)}</td>
                  <td className="px-4 py-2 text-right tabular-nums font-bold" style={{ color: a.currentBalance >= 0 ? "#00E87B" : "#FF4444" }}>{fmt(a.currentBalance)}</td>
                </tr>
              ))}
              <tr className="border-t border-border font-bold">
                <td className="px-4 py-2 text-[10px] uppercase tracking-widest text-muted-foreground">Total</td>
                <td className="px-4 py-2 text-right tabular-nums text-emerald-400">{fmt(data.grandTotalDeposits)}</td>
                <td className="px-4 py-2 text-right tabular-nums text-red-400">{fmt(data.grandTotalWithdrawals)}</td>
                <td className="px-4 py-2 text-right tabular-nums" style={{ color: data.grandBalance >= 0 ? "#00E87B" : "#FF4444" }}>{fmt(data.grandBalance)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {data.categories.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Ingresos por Categoría</p>
            </div>
            <div className="p-2">
              {data.categories.filter(c => c.type !== "expense" && c.totalIncome > 0).map(c => (
                <div key={c.id} className="flex items-center justify-between rounded-lg px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-primary w-8">{c.code}</span>
                    <span className="text-xs text-muted-foreground">{c.name}</span>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-emerald-400">{fmt(c.totalIncome)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Egresos por Categoría</p>
            </div>
            <div className="p-2">
              {data.categories.filter(c => c.type !== "income" && c.totalExpense > 0).map(c => (
                <div key={c.id} className="flex items-center justify-between rounded-lg px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-primary w-8">{c.code}</span>
                    <span className="text-xs text-muted-foreground">{c.name}</span>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-red-400">{fmt(c.totalExpense)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

type CellProps = { value: string; onSave: (v: string) => void; className?: string; type?: string; placeholder?: string; readOnly?: boolean; colored?: string };
function Cell({ value, onSave, className = "", type = "text", placeholder = "", readOnly = false, colored }: CellProps) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocal(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => { setEditing(false); if (local !== value) onSave(local); };

  if (readOnly) return (
    <td className={`border-r border-border/40 px-2 py-1 text-right font-bold tabular-nums text-sm ${className}`} style={colored ? { color: colored } : {}}>
      {value}
    </td>
  );

  return (
    <td className={`border-r border-border/40 px-0 py-0 ${className}`} onClick={() => !editing && setEditing(true)}>
      {editing ? (
        <input ref={inputRef} type={type} value={local} onChange={e => setLocal(e.target.value)}
          onBlur={commit} onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setLocal(value); setEditing(false); } }}
          className="w-full bg-primary/10 px-2 py-1 text-sm outline-none ring-1 ring-primary/50" />
      ) : (
        <div className={`cursor-text px-2 py-1 text-sm ${value ? "" : "text-muted-foreground/40"}`} style={colored && value ? { color: colored } : {}}>
          {value || placeholder || <span className="opacity-0">·</span>}
        </div>
      )}
    </td>
  );
}

function AccountLedger({ account, categories }: { account: Account; categories: Category[] }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/cashflow/accounts/${account.id}/transactions`);
    const data = await res.json();
    setTransactions(data.transactions ?? []);
    setLoading(false);
  }, [account.id]);

  useEffect(() => { load(); }, [load]);

  const addRow = async () => {
    const res = await fetch(`/api/cashflow/accounts/${account.id}/transactions`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: todayIso() }),
    });
    const data = await res.json();
    setTransactions(prev => [...prev, { ...data.transaction, runningBalance: 0, date: data.transaction.date.slice(0,10) }]);
    load();
  };

  const saveField = useCallback((txId: string, field: string, value: unknown) => {
    clearTimeout(saveTimers.current[txId + field]);
    saveTimers.current[txId + field] = setTimeout(async () => {
      await fetch(`/api/cashflow/transactions/${txId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      load();
    }, 500);
  }, [load]);

  const updateLocal = (txId: string, field: string, value: unknown) => {
    setTransactions(prev => prev.map(t => t.id === txId ? { ...t, [field]: value } : t));
    saveField(txId, field, value);
  };

  const deleteRow = async (txId: string) => {
    await fetch(`/api/cashflow/transactions/${txId}`, { method: "DELETE" });
    setTransactions(prev => prev.filter(t => t.id !== txId));
    load();
  };

  const incomeCategories = categories.filter(c => c.type !== "expense");
  const expenseCategories = categories.filter(c => c.type !== "income");

  const currentBalance = transactions.length > 0 ? transactions[transactions.length - 1].runningBalance : account.openingBalance;

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">Cargando...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Saldo Inicial</p>
            <p className="text-sm font-bold tabular-nums text-muted-foreground">{fmt(account.openingBalance)}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Saldo Actual</p>
            <p className="text-sm font-bold tabular-nums" style={{ color: currentBalance >= 0 ? "#00E87B" : "#FF4444" }}>{fmt(currentBalance)}</p>
          </div>
        </div>
        <button onClick={addRow} className="flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/30 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
          <Plus className="h-3.5 w-3.5" /> Agregar fila
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ minWidth: "1200px" }}>
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="border-r border-border/40 px-2 py-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground w-8">#</th>
                <th className="border-r border-border/40 px-2 py-2 text-left text-[10px] uppercase tracking-widest text-muted-foreground w-24">Fecha</th>
                <th className="border-r border-border/40 px-2 py-2 text-left text-[10px] uppercase tracking-widest text-muted-foreground w-40">Ref. Bancaria</th>
                <th className="border-r border-border/40 px-2 py-2 text-left text-[10px] uppercase tracking-widest text-muted-foreground w-28">Tipo</th>
                <th className="border-r border-border/40 px-2 py-2 text-right text-[10px] uppercase tracking-widest text-muted-foreground w-28" style={{color:"#00E87B"}}>Depósito</th>
                <th className="border-r border-border/40 px-2 py-2 text-right text-[10px] uppercase tracking-widest text-muted-foreground w-28" style={{color:"#FF4444"}}>Retiro</th>
                <th className="border-r border-border/40 px-2 py-2 text-right text-[10px] uppercase tracking-widest text-muted-foreground w-28">Saldo</th>
                <th className="border-r border-border/40 px-2 py-2 text-left text-[10px] uppercase tracking-widest text-muted-foreground w-32">Concepto</th>
                <th className="border-r border-border/40 px-2 py-2 text-left text-[10px] uppercase tracking-widest text-muted-foreground w-28">Proveedor</th>
                <th className="border-r border-border/40 px-2 py-2 text-left text-[10px] uppercase tracking-widest text-muted-foreground w-24">Referencia</th>
                <th className="border-r border-border/40 px-2 py-2 text-left text-[10px] uppercase tracking-widest text-muted-foreground w-32">Folio UUID</th>
                <th className="border-r border-border/40 px-2 py-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground w-16">Tasa %</th>
                <th className="border-r border-border/40 px-2 py-2 text-left text-[10px] uppercase tracking-widest text-muted-foreground w-20">Ventas</th>
                {incomeCategories.map(c => (
                  <th key={c.id} className="border-r border-border/40 px-2 py-2 text-right text-[10px] uppercase tracking-widest w-24" style={{color:"#00E87B60"}}>
                    {c.code}
                  </th>
                ))}
                {expenseCategories.map(c => (
                  <th key={c.id} className="border-r border-border/40 px-2 py-2 text-right text-[10px] uppercase tracking-widest w-24" style={{color:"#FF444460"}}>
                    {c.code}
                  </th>
                ))}
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx, i) => (
                <tr key={tx.id} className={`border-b border-border/40 hover:bg-secondary/20 ${i % 2 === 0 ? "" : "bg-secondary/10"}`}>
                  <td className="border-r border-border/40 px-2 py-1 text-center text-muted-foreground/60">{i + 1}</td>
                  <Cell value={tx.date ? tx.date.slice(0,10) : ""} type="date"
                    onSave={v => updateLocal(tx.id, "date", v)} />
                  <Cell value={tx.bankReference ?? ""} placeholder="Referencia..."
                    onSave={v => updateLocal(tx.id, "bankReference", v)} />
                  <Cell value={tx.movementType ?? ""} placeholder="Tipo..."
                    onSave={v => updateLocal(tx.id, "movementType", v)} />
                  <Cell value={tx.deposit != null ? String(tx.deposit) : ""} type="number" placeholder="0.00"
                    colored="#00E87B" onSave={v => updateLocal(tx.id, "deposit", v === "" ? null : parseFloat(v))} />
                  <Cell value={tx.withdrawal != null ? String(tx.withdrawal) : ""} type="number" placeholder="0.00"
                    colored="#FF4444" onSave={v => updateLocal(tx.id, "withdrawal", v === "" ? null : parseFloat(v))} />
                  <Cell value={fmt(tx.runningBalance)} readOnly colored={tx.runningBalance >= 0 ? "#00E87B" : "#FF4444"} onSave={() => {}} />
                  <Cell value={tx.concept ?? ""} placeholder="Concepto..."
                    onSave={v => updateLocal(tx.id, "concept", v)} />
                  <Cell value={tx.provider ?? ""} placeholder="Proveedor..."
                    onSave={v => updateLocal(tx.id, "provider", v)} />
                  <Cell value={tx.reference ?? ""} placeholder="Ref..."
                    onSave={v => updateLocal(tx.id, "reference", v)} />
                  <Cell value={tx.invoiceUuid ?? ""} placeholder="UUID..."
                    onSave={v => updateLocal(tx.id, "invoiceUuid", v)} />
                  <Cell value={tx.taxRate != null ? String(tx.taxRate) : ""} type="number" placeholder="16"
                    onSave={v => updateLocal(tx.id, "taxRate", v === "" ? null : parseFloat(v))} />
                  <Cell value={tx.salesType ?? ""} placeholder="Tipo..."
                    onSave={v => updateLocal(tx.id, "salesType", v)} />
                  {incomeCategories.map(c => {
                    const val = (tx.incomeCategories ?? {})[c.code];
                    return (
                      <Cell key={c.id} value={val != null ? String(val) : ""} type="number" placeholder="0" colored="#00E87B"
                        onSave={v => {
                          const updated = { ...(tx.incomeCategories ?? {}), [c.code]: v === "" ? undefined : parseFloat(v) };
                          if (v === "") delete updated[c.code];
                          updateLocal(tx.id, "incomeCategories", updated);
                        }} />
                    );
                  })}
                  {expenseCategories.map(c => {
                    const val = (tx.expenseCategories ?? {})[c.code];
                    return (
                      <Cell key={c.id} value={val != null ? String(val) : ""} type="number" placeholder="0" colored="#FF4444"
                        onSave={v => {
                          const updated = { ...(tx.expenseCategories ?? {}), [c.code]: v === "" ? undefined : parseFloat(v) };
                          if (v === "") delete updated[c.code];
                          updateLocal(tx.id, "expenseCategories", updated);
                        }} />
                    );
                  })}
                  <td className="px-1 py-1">
                    <button onClick={() => deleteRow(tx.id)} className="text-muted-foreground/40 hover:text-red-400 p-0.5">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={99} className="py-10 text-center text-sm text-muted-foreground">
                    Sin movimientos — haz clic en &quot;Agregar fila&quot; para empezar
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function CashFlowPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeTab, setActiveTab] = useState<string>("report");
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    const [accRes, catRes] = await Promise.all([
      fetch("/api/cashflow/accounts"),
      fetch("/api/cashflow/categories"),
    ]);
    const [accData, catData] = await Promise.all([accRes.json(), catRes.json()]);
    setAccounts(accData.accounts ?? []);
    setCategories(catData.categories ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const activeAccount = accounts.find(a => a.id === activeTab);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-extrabold tracking-tight">Flujo de Efectivo</h1>
          <p className="text-xs text-muted-foreground">Gestiona los movimientos de cada cuenta bancaria</p>
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab("report")}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === "report" ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
        >
          REPORTE
        </button>
        {accounts.map(a => (
          <button key={a.id} onClick={() => setActiveTab(a.id)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${activeTab === a.id ? "bg-primary text-white" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
          >
            {a.name}
          </button>
        ))}
        <button onClick={() => setShowAddAccount(true)}
          className="shrink-0 flex items-center gap-1 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-primary">
          <Plus className="h-3 w-3" /> Agregar cuenta
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Cargando...</div>
      ) : activeTab === "report" ? (
        <ReportTab onManageCategories={() => setShowCategories(true)} />
      ) : activeAccount ? (
        <AccountLedger account={activeAccount} categories={categories} />
      ) : null}

      {showAddAccount && (
        <AddAccountModal
          onClose={() => setShowAddAccount(false)}
          onSave={acc => { setAccounts(prev => [...prev, acc]); setActiveTab(acc.id); loadAll(); }}
        />
      )}
      {showCategories && (
        <CategoryPanel categories={categories} onClose={() => setShowCategories(false)} onRefresh={loadAll} />
      )}
    </div>
  );
}
