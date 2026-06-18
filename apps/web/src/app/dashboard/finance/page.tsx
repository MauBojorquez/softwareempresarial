"use client";

import { useEffect, useState } from "react";
import { DollarSign, TrendingDown, Wallet, PiggyBank, Plus, Loader2, LinkIcon, Trash2, X } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { cn } from "@/lib/utils";

type MetricEntry = { id: string; name: string; value: number; unit: string | null; period: string };

const METRIC_TEMPLATES = [
  { name: "Ingresos", unit: "MXN" },
  { name: "Gastos", unit: "MXN" },
  { name: "Cuentas por Cobrar", unit: "MXN" },
  { name: "Cuentas por Pagar", unit: "MXN" },
  { name: "Flujo de Caja", unit: "MXN" },
];

export default function FinancePage() {
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "Ingresos", value: "", period: new Date().toISOString().split("T")[0] });

  const load = () => {
    fetch("/api/metrics/manual?category=FINANCE&months=3")
      .then((r) => r.json())
      .then((d) => { setMetrics(d.metrics || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!form.value) return;
    setSaving(true);
    const template = METRIC_TEMPLATES.find((t) => t.name === form.name);
    await fetch("/api/metrics/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "FINANCE", name: form.name, value: parseFloat(form.value), unit: template?.unit || "MXN", period: form.period }),
    });
    setShowForm(false);
    setForm({ name: "Ingresos", value: "", period: new Date().toISOString().split("T")[0] });
    setSaving(false);
    load();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/metrics/manual?id=${id}`, { method: "DELETE" });
    load();
  };

  const fmtMoney = (v: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(v);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const latest = (name: string) => metrics.find((m) => m.name === name)?.value ?? 0;
  const ingresos = latest("Ingresos");
  const gastos = latest("Gastos");
  const utilidad = ingresos - gastos;
  const margen = ingresos > 0 ? (utilidad / ingresos) * 100 : 0;
  const hasData = metrics.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Finanzas</h1>
          <p className="text-sm text-muted-foreground">Métricas financieras</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg gradient-bg px-3 py-2 sm:px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Agregar Dato
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl border border-primary/20 bg-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Nuevo Registro Financiero</h3>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <select
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {METRIC_TEMPLATES.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Monto (MXN)</label>
              <input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="0.00"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Período</label>
              <input
                type="date"
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !form.value}
            className="mt-4 rounded-lg gradient-bg px-6 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      )}

      {!hasData ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-14 sm:py-20">
          <LinkIcon className="h-10 w-10 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Sin datos financieros</h3>
          <p className="mt-1 text-sm text-muted-foreground text-center max-w-md">
            Conecta QuickBooks desde integraciones o agrega tus datos financieros manualmente.
          </p>
          <div className="mt-4 flex gap-3">
            <a href="/dashboard/integrations" className="rounded-lg border border-border bg-secondary/50 px-3 py-2 sm:px-4 text-sm font-medium hover:bg-secondary">
              Conectar QuickBooks
            </a>
            <button onClick={() => setShowForm(true)} className="rounded-lg gradient-bg px-3 py-2 sm:px-4 text-sm font-medium text-white hover:opacity-90">
              Entrada Manual
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Ingresos" value={ingresos} icon={DollarSign} format="currency" />
            <MetricCard title="Gastos" value={gastos} icon={TrendingDown} format="currency" />
            <MetricCard title="Utilidad Neta" value={utilidad} icon={Wallet} format="currency" />
            <MetricCard title="Margen Neto" value={margen} icon={PiggyBank} format="percentage" />
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border p-4">
              <h3 className="font-semibold">Registros Recientes</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="p-3 font-medium">Concepto</th>
                    <th className="p-3 font-medium text-right">Monto</th>
                    <th className="p-3 font-medium">Fecha</th>
                    <th className="p-3 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                      <td className="p-3 font-medium">{m.name}</td>
                      <td className="p-3 text-right font-semibold">{fmtMoney(m.value)}</td>
                      <td className="p-3 text-muted-foreground">{new Date(m.period).toLocaleDateString("es-MX")}</td>
                      <td className="p-3">
                        <button onClick={() => handleDelete(m.id)} className="text-muted-foreground hover:text-red-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
