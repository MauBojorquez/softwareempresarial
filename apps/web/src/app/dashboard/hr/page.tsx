"use client";

import { useEffect, useState } from "react";
import { Users, UserPlus, UserMinus, Heart, Plus, Loader2, LinkIcon, Trash2, X, Download, Upload } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";

type MetricEntry = { id: string; name: string; value: number; unit: string | null; period: string };

const METRIC_TEMPLATES = [
  { name: "Headcount", unit: "personas" },
  { name: "Nuevas Contrataciones", unit: "personas" },
  { name: "Bajas", unit: "personas" },
  { name: "Rotación (%)", unit: "%" },
  { name: "Satisfacción (1-10)", unit: "pts" },
  { name: "Costo Nómina", unit: "MXN" },
];

export default function HRPage() {
  const [metrics, setMetrics] = useState<MetricEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState({ name: "Headcount", value: "", period: new Date().toISOString().split("T")[0] });

  const load = () => {
    fetch("/api/metrics/manual?category=HR&months=3")
      .then((r) => r.json())
      .then((d) => { setMetrics(d.metrics || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", "HR");
    const res = await fetch("/api/metrics/import", { method: "POST", body: fd });
    const data = await res.json();
    if (data.errors?.length > 0) {
      alert(`Importados: ${data.imported}/${data.total}\nErrores:\n${data.errors.join("\n")}`);
    }
    setImporting(false);
    load();
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!form.value) return;
    setSaving(true);
    const template = METRIC_TEMPLATES.find((t) => t.name === form.name);
    await fetch("/api/metrics/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category: "HR", name: form.name, value: parseFloat(form.value), unit: template?.unit || "personas", period: form.period }),
    });
    setShowForm(false);
    setForm({ name: "Headcount", value: "", period: new Date().toISOString().split("T")[0] });
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
  const headcount = latest("Headcount");
  const nuevas = latest("Nuevas Contrataciones");
  const rotacion = latest("Rotación (%)");
  const satisfaccion = latest("Satisfacción (1-10)");
  const nomina = latest("Costo Nómina");
  const hasData = metrics.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Recursos Humanos</h1>
          <p className="text-sm text-muted-foreground">Métricas de equipo</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/metrics/template?category=HR"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Plantilla</span>
          </a>
          <label className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{importing ? "Importando..." : "Importar"}</span>
            <input type="file" accept=".csv" onChange={handleImport} className="hidden" />
          </label>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg gradient-bg px-3 py-2 sm:px-4 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Agregar Dato</span>
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-xl border border-primary/20 bg-card p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Nuevo Registro de RH</h3>
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
              <label className="text-xs font-medium text-muted-foreground">Valor</label>
              <input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder="0"
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
          <h3 className="text-lg font-semibold">Sin datos de RH</h3>
          <p className="mt-1 text-sm text-muted-foreground text-center max-w-md">
            Registra las métricas de tu equipo manualmente para dar seguimiento a headcount, rotación y satisfacción.
          </p>
          <button onClick={() => setShowForm(true)} className="mt-4 rounded-lg gradient-bg px-3 py-2 sm:px-4 text-sm font-medium text-white hover:opacity-90">
            Entrada Manual
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Headcount" value={headcount} icon={Users} format="number" />
            <MetricCard title="Nuevas Contrataciones" value={nuevas} icon={UserPlus} format="number" />
            <MetricCard title="Rotación" value={rotacion} icon={UserMinus} format="percentage" />
            <MetricCard title="Satisfacción" value={`${satisfaccion}/10`} icon={Heart} />
          </div>

          {nomina > 0 && (
            <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
              <h3 className="text-lg font-semibold">Costo de Nómina</h3>
              <p className="mt-2 text-3xl font-bold">{fmtMoney(nomina)}</p>
              <p className="text-sm text-muted-foreground">Mensual</p>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border p-4">
              <h3 className="font-semibold">Registros Recientes</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="p-3 font-medium">Métrica</th>
                    <th className="p-3 font-medium text-right">Valor</th>
                    <th className="p-3 font-medium">Fecha</th>
                    <th className="p-3 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0 hover:bg-secondary/30">
                      <td className="p-3 font-medium">{m.name}</td>
                      <td className="p-3 text-right font-semibold">
                        {m.unit === "MXN" ? fmtMoney(m.value) : `${m.value.toLocaleString("es-MX")} ${m.unit || ""}`}
                      </td>
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
