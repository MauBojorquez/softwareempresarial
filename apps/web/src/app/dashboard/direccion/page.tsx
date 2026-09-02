"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, Gauge, Pencil, Check, X, CheckCircle2, Clock, Mountain,
  Users, TrendingUp, Filter,
} from "lucide-react";
import { useToast } from "@/components/toast";
import { cn, formatCurrency } from "@/lib/utils";

type JobRole = "DIRECCION" | "OPERACIONES" | "COMERCIAL" | "MARKETING" | "ADMINISTRACION";
type Salud = "VERDE" | "AMARILLO" | "ROJO";
type Estatus = "ACTIVO" | "ESPERA" | "VENCIDO" | "BAJA";

interface NumeroCritico {
  meta: number; cobrado: number; avancePct: number; faltante: number;
  diasRestantes: number; ritmoDiario: number; mesTranscurridoPct: number; semaforo: Salud;
}
interface CarteraCliente {
  id: string; nombre: string; montoMensual: number; diaDePago: number | null;
  estatus: Estatus; salud: Salud; cobradoMes: number;
}
interface Cartera {
  clientes: CarteraCliente[];
  totals: {
    mrrActivo: number; cobradoMes: number;
    activo: { count: number; monto: number };
    espera: { count: number; monto: number };
    riesgo: { count: number; monto: number };
    baja: { count: number; monto: number };
  };
  saludGrupo: Salud;
  saludCounts: { verde: number; amarillo: number; rojo: number };
}
interface EmbudoRow { etapa: string; count: number; pctOfTotal: number; valor: number; }
interface VendedorRow { userId: string; name: string; meta: number; vendido: number; cobrado: number; avancePct: number; }
interface ReporteRow { userId: string; name: string; jobRole: JobRole | null; submitted: boolean; payload: Record<string, unknown> | null; }
interface RocaRow { id: string; titulo: string; metricaExito: string; fechaLimite: string; estatus: Salud; porcentajeAvance: number; duenoNombre: string | null; }

interface Data {
  mes: string; hoy: string;
  numeroCritico: NumeroCritico;
  cartera: Cartera;
  embudo: EmbudoRow[];
  ventasPorVendedor: VendedorRow[];
  reportesHoy: ReporteRow[];
  rocas: RocaRow[];
}

const SALUD_COLOR: Record<Salud, string> = {
  VERDE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  AMARILLO: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  ROJO: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};
const SEMA_TEXT: Record<Salud, string> = {
  VERDE: "text-emerald-600 dark:text-emerald-400",
  AMARILLO: "text-amber-600 dark:text-amber-400",
  ROJO: "text-red-600 dark:text-red-400",
};
const SEMA_BAR: Record<Salud, string> = {
  VERDE: "bg-emerald-500", AMARILLO: "bg-amber-500", ROJO: "bg-red-500",
};
const ETAPA_LABEL: Record<string, string> = {
  NUEVO: "Nuevo",
  CONTACTADO: "Contactado",
  SESION_AGENDADA: "Sesión agendada",
  DIAGNOSTICO_VENDIDO: "Diagnóstico vendido",
  PROPUESTA_ENVIADA: "Propuesta enviada",
  CERRADO_GANADO: "Cerrado ganado",
  CERRADO_PERDIDO: "Cerrado perdido",
};
const ESTATUS_LABEL: Record<Estatus, string> = {
  ACTIVO: "Activo", ESPERA: "En espera", VENCIDO: "En riesgo", BAJA: "De baja",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}
function pct(n: number): string {
  return `${n.toFixed(0)}%`;
}

// Key numbers to surface per role in the "reportes de hoy" cards.
const REPORT_SUMMARY: Record<Exclude<JobRole, "DIRECCION">, { key: string; label: string; money?: boolean }[]> = {
  COMERCIAL: [
    { key: "leadsContactados", label: "Leads contactados" },
    { key: "sesionesAgendadas", label: "Sesiones agendadas" },
    { key: "respuestasRecibidas", label: "Respuestas" },
  ],
  MARKETING: [
    { key: "leadsGenerados", label: "Leads generados" },
    { key: "videosSubidos", label: "Videos subidos" },
    { key: "avanceOperativo", label: "Avance operativo (%)" },
  ],
  OPERACIONES: [
    { key: "clientesActivos", label: "Clientes activos" },
    { key: "proyectosActivos", label: "Proyectos activos" },
    { key: "velocidadDelMes", label: "Velocidad del mes (%)" },
  ],
  ADMINISTRACION: [
    { key: "porCobrar", label: "Por cobrar", money: true },
    { key: "cobrado", label: "Cobrado", money: true },
    { key: "vencido30", label: "Vencido +30d", money: true },
  ],
};

export default function DireccionDashboardPage() {
  const { toast } = useToast();
  const [jobRole, setJobRole] = useState<JobRole | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((d) => setJobRole(d.jobRole ?? null))
      .catch(() => {})
      .finally(() => setRoleLoaded(true));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/direccion");
      if (res.ok) setData(await res.json());
    } catch {
      /* noop */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (jobRole === "DIRECCION") load();
  }, [jobRole, load]);

  if (!roleLoaded) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (jobRole !== "DIRECCION") {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        No autorizado. Este panel es exclusivo de Dirección.
      </div>
    );
  }
  if (loading && !data) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <Gauge className="h-6 w-6 text-primary" /> Dirección
        </h1>
        <p className="text-sm text-muted-foreground">Panorama del mes {data.mes}</p>
      </div>

      <NumeroCriticoHero nc={data.numeroCritico} mes={data.mes} onSaved={load} toast={toast} />

      <CarteraBlock cartera={data.cartera} />

      <div className="grid gap-6 lg:grid-cols-2">
        <EmbudoBlock rows={data.embudo} />
        <VendedoresBlock rows={data.ventasPorVendedor} mes={data.mes} onSaved={load} toast={toast} />
      </div>

      <ReportesBlock rows={data.reportesHoy} hoy={data.hoy} />

      <RocasBlock rows={data.rocas} />
    </div>
  );
}

// ── 1. Número Crítico ──
function NumeroCriticoHero({ nc, mes, onSaved, toast }: {
  nc: NumeroCritico; mes: string; onSaved: () => void; toast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(nc.meta));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/targets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, monthlyMeta: Number(val) }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");
      toast("Meta actualizada", "success");
      setEditing(false);
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo guardar", "error");
    }
    setSaving(false);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Número Crítico · Cobranza del mes</h2>
        <span className={cn("rounded-full px-3 py-1 text-xs font-bold", SALUD_COLOR[nc.semaforo])}>{nc.semaforo}</span>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-[auto_1fr]">
        <div>
          <p className={cn("text-5xl font-black leading-none", SEMA_TEXT[nc.semaforo])}>{pct(nc.avancePct)}</p>
          <p className="mt-1 text-xs text-muted-foreground">de avance</p>
          <div className="mt-3 h-3 w-56 overflow-hidden rounded-full bg-secondary">
            <div className={cn("h-3 rounded-full", SEMA_BAR[nc.semaforo])} style={{ width: `${Math.min(100, nc.avancePct)}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Mes transcurrido: {pct(nc.mesTranscurridoPct)}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Meta">
            {editing ? (
              <div className="flex items-center gap-1">
                <input type="number" min={0} value={val} onChange={(e) => setVal(e.target.value)}
                  className="w-28 rounded border border-border bg-background px-2 py-1 text-sm" />
                <button onClick={save} disabled={saving} className="text-emerald-600" aria-label="Guardar">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </button>
                <button onClick={() => { setEditing(false); setVal(String(nc.meta)); }} className="text-muted-foreground" aria-label="Cancelar"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                {formatCurrency(nc.meta)}
                <button onClick={() => setEditing(true)} className="text-muted-foreground hover:text-foreground" aria-label="Editar meta"><Pencil className="h-3.5 w-3.5" /></button>
              </span>
            )}
          </Stat>
          <Stat label="Cobrado">{formatCurrency(nc.cobrado)}</Stat>
          <Stat label="Faltante">{formatCurrency(nc.faltante)}</Stat>
          <Stat label="Días restantes">{nc.diasRestantes}</Stat>
          <Stat label="Ritmo requerido/día">{formatCurrency(nc.ritmoDiario)}</Stat>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-foreground">{children}</p>
    </div>
  );
}

// ── 2. Cartera ──
function CarteraBlock({ cartera }: { cartera: Cartera }) {
  const t = cartera.totals;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Users className="h-5 w-5 text-primary" /> Cartera</h2>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Salud del grupo:</span>
          <span className={cn("rounded px-2 py-0.5 font-semibold", SALUD_COLOR[cartera.saludGrupo])}>{cartera.saludGrupo}</span>
          <span className="text-muted-foreground">V {cartera.saludCounts.verde} · A {cartera.saludCounts.amarillo} · R {cartera.saludCounts.rojo}</span>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MiniStat label="MRR activo" value={formatCurrency(t.mrrActivo)} />
        <MiniStat label="Cobrado mes" value={formatCurrency(t.cobradoMes)} />
        <MiniStat label="Activos" value={`${t.activo.count}`} sub={formatCurrency(t.activo.monto)} />
        <MiniStat label="En espera" value={`${t.espera.count}`} sub={formatCurrency(t.espera.monto)} />
        <MiniStat label="En riesgo" value={`${t.riesgo.count}`} sub={formatCurrency(t.riesgo.monto)} />
        <MiniStat label="De baja" value={`${t.baja.count}`} sub={formatCurrency(t.baja.monto)} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Cliente</th>
              <th className="px-3 py-2 font-medium">Monto mensual</th>
              <th className="px-3 py-2 font-medium">Día de pago</th>
              <th className="px-3 py-2 font-medium">Estatus</th>
              <th className="px-3 py-2 font-medium">Salud</th>
              <th className="px-3 py-2 font-medium">Cobrado mes</th>
            </tr>
          </thead>
          <tbody>
            {cartera.clientes.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium text-foreground">{c.nombre}</td>
                <td className="px-3 py-2">{formatCurrency(c.montoMensual)}</td>
                <td className="px-3 py-2 text-muted-foreground">{c.diaDePago ?? "—"}</td>
                <td className="px-3 py-2 text-muted-foreground">{ESTATUS_LABEL[c.estatus]}</td>
                <td className="px-3 py-2"><span className={cn("inline-block rounded px-2 py-0.5 text-xs font-semibold", SALUD_COLOR[c.salud])}>{c.salud}</span></td>
                <td className="px-3 py-2">{formatCurrency(c.cobradoMes)}</td>
              </tr>
            ))}
            {cartera.clientes.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Sin clientes.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-foreground">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── 3. Embudo ──
function EmbudoBlock({ rows }: { rows: EmbudoRow[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground"><Filter className="h-5 w-5 text-primary" /> Embudo</h2>
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div key={r.etapa}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">{ETAPA_LABEL[r.etapa] ?? r.etapa}</span>
              <span className="text-muted-foreground">{r.count} · {pct(r.pctOfTotal)} · {formatCurrency(r.valor)}</span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-secondary">
              <div className="h-2.5 rounded-full bg-primary" style={{ width: `${Math.min(100, r.pctOfTotal)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 4. Ventas por vendedor ──
function VendedoresBlock({ rows, mes, onSaved, toast }: {
  rows: VendedorRow[]; mes: string; onSaved: () => void; toast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [val, setVal] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (userId: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/targets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mes, vendors: [{ userId, meta: Number(val) }] }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");
      toast("Meta actualizada", "success");
      setEditing(null);
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo guardar", "error");
    }
    setSaving(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground"><TrendingUp className="h-5 w-5 text-primary" /> Ventas por vendedor</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-2 py-2 font-medium">Vendedor</th>
              <th className="px-2 py-2 font-medium">Meta</th>
              <th className="px-2 py-2 font-medium">Vendido</th>
              <th className="px-2 py-2 font-medium">Cobrado</th>
              <th className="px-2 py-2 font-medium">Avance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.userId} className="border-b border-border last:border-0">
                <td className="px-2 py-2 font-medium text-foreground">{r.name}</td>
                <td className="px-2 py-2">
                  {editing === r.userId ? (
                    <div className="flex items-center gap-1">
                      <input type="number" min={0} value={val} onChange={(e) => setVal(e.target.value)} className="w-24 rounded border border-border bg-background px-2 py-1 text-xs" />
                      <button onClick={() => save(r.userId)} disabled={saving} className="text-emerald-600" aria-label="Guardar">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}</button>
                      <button onClick={() => setEditing(null)} className="text-muted-foreground" aria-label="Cancelar"><X className="h-3.5 w-3.5" /></button>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      {formatCurrency(r.meta)}
                      <button onClick={() => { setEditing(r.userId); setVal(String(r.meta)); }} className="text-muted-foreground hover:text-foreground" aria-label="Editar meta"><Pencil className="h-3 w-3" /></button>
                    </span>
                  )}
                </td>
                <td className="px-2 py-2">{formatCurrency(r.vendido)}</td>
                <td className="px-2 py-2">{formatCurrency(r.cobrado)}</td>
                <td className="px-2 py-2 min-w-[120px]">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-secondary">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, r.avancePct)}%` }} />
                    </div>
                    <span className="w-9 text-right text-xs text-muted-foreground">{pct(r.avancePct)}</span>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">Sin vendedores.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 5. Reportes de hoy ──
function ReportesBlock({ rows, hoy }: { rows: ReporteRow[]; hoy: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground"><CheckCircle2 className="h-5 w-5 text-primary" /> Reportes de hoy <span className="text-sm font-normal text-muted-foreground">({hoy})</span></h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const defs = r.jobRole && r.jobRole !== "DIRECCION" ? REPORT_SUMMARY[r.jobRole] : [];
          return (
            <div key={r.userId} className="rounded-lg border border-border bg-secondary/20 p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold text-foreground">{r.name}</p>
                {r.submitted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"><CheckCircle2 className="h-3 w-3" /> Enviado</span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200"><Clock className="h-3 w-3" /> Pendiente</span>
                )}
              </div>
              {r.submitted && r.payload ? (
                <div className="grid grid-cols-1 gap-1 text-sm">
                  {defs.map((d) => {
                    const raw = r.payload?.[d.key];
                    const num = Number(raw);
                    const display = d.money && Number.isFinite(num) ? formatCurrency(num) : (raw != null ? String(raw) : "—");
                    return (
                      <div key={d.key} className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{d.label}</span>
                        <span className="font-medium text-foreground">{display}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Sin reporte para hoy.</p>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No hay miembros que envíen reporte.</p>}
      </div>
    </div>
  );
}

// ── 6. Rocas del mes ──
function RocasBlock({ rows }: { rows: RocaRow[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground"><Mountain className="h-5 w-5 text-primary" /> Rocas del mes</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">Dueño</th>
              <th className="px-3 py-2 font-medium">Roca / Métrica</th>
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Estatus</th>
              <th className="px-3 py-2 font-medium">% Avance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 align-top">
                <td className="px-3 py-2 whitespace-nowrap font-medium text-foreground">{r.duenoNombre ?? "—"}</td>
                <td className="px-3 py-2">
                  <p className="font-medium text-foreground">{r.titulo}</p>
                  <p className="text-xs text-muted-foreground">{r.metricaExito}</p>
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{fmtDate(r.fechaLimite)}</td>
                <td className="px-3 py-2"><span className={cn("inline-block rounded px-2 py-0.5 text-xs font-semibold", SALUD_COLOR[r.estatus])}>{r.estatus}</span></td>
                <td className="px-3 py-2 min-w-[140px]">
                  <div className="flex items-center gap-2">
                    <div className="h-2 flex-1 rounded-full bg-secondary">
                      <div className={cn("h-2 rounded-full", SEMA_BAR[r.estatus])} style={{ width: `${Math.min(100, r.porcentajeAvance)}%` }} />
                    </div>
                    <span className="w-9 text-right text-xs text-muted-foreground">{r.porcentajeAvance}%</span>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">Sin rocas este mes.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
