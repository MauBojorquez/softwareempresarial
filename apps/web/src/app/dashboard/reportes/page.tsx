"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, ClipboardList, Save, ChevronDown, CheckCircle2, Clock } from "lucide-react";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";

type JobRole = "DIRECCION" | "OPERACIONES" | "COMERCIAL" | "MARKETING" | "ADMINISTRACION";

type Payload = Record<string, unknown>;

interface OwnReport {
  id: string;
  fecha: string;
  jobRole: JobRole | null;
  payload: Payload;
}
interface HistoryItem {
  id: string;
  fecha: string;
  jobRole: JobRole | null;
  payload: Payload;
  updatedAt: string;
}
interface Computed {
  velocidadDelMes: number;
  saludGeneral: "VERDE" | "AMARILLO" | "ROJO" | null;
  counts: { verde: number; amarillo: number; rojo: number };
}
interface OwnData {
  scope: "own";
  jobRole: JobRole | null;
  today: string;
  fecha: string;
  frozen: boolean;
  report: OwnReport | null;
  history: HistoryItem[];
  computed: Computed | null;
}
interface AllMember {
  userId: string;
  name: string;
  jobRole: JobRole | null;
  submitted: boolean;
}
interface AllReport {
  id: string;
  fecha: string;
  jobRole: JobRole | null;
  payload: Payload;
  userId: string;
  authorName: string | null;
}
interface AllData {
  scope: "all";
  today: string;
  fecha: string;
  reports: AllReport[];
  members: AllMember[];
}

const ROLE_LABEL: Record<JobRole, string> = {
  DIRECCION: "Dirección",
  OPERACIONES: "Operaciones",
  COMERCIAL: "Comercial",
  MARKETING: "Marketing",
  ADMINISTRACION: "Administración",
};

const SALUD_COLOR: Record<string, string> = {
  VERDE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  AMARILLO: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  ROJO: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
};

// ─── Field descriptors per role (editable inputs only) ──────────────

type FieldDef = { key: string; label: string; type: "int" | "num" | "text"; min?: number; max?: number };

const FIELDS: Record<Exclude<JobRole, "DIRECCION">, FieldDef[]> = {
  COMERCIAL: [
    { key: "leadsContactados", label: "Leads contactados", type: "int", min: 0 },
    { key: "sesionesAgendadas", label: "Sesiones agendadas", type: "int", min: 0 },
    { key: "respuestasRecibidas", label: "Respuestas recibidas", type: "int", min: 0 },
    { key: "notas", label: "Notas", type: "text" },
  ],
  MARKETING: [
    { key: "leadsGenerados", label: "Leads generados", type: "int", min: 0 },
    { key: "videosSubidos", label: "Videos subidos", type: "int", min: 0 },
    { key: "avanceOperativo", label: "Avance operativo (%)", type: "num", min: 0, max: 100 },
  ],
  OPERACIONES: [
    { key: "crecimientoCartera", label: "Crecimiento de cartera", type: "num" },
    { key: "clientesActivos", label: "Clientes activos", type: "int", min: 0 },
    { key: "proyectosActivos", label: "Proyectos activos", type: "int", min: 0 },
    { key: "notas", label: "Notas", type: "text" },
  ],
  ADMINISTRACION: [
    { key: "porCobrar", label: "Por cobrar", type: "num", min: 0 },
    { key: "cobrado", label: "Cobrado", type: "num", min: 0 },
    { key: "facturasPagadas", label: "Facturas pagadas", type: "int", min: 0 },
    { key: "facturasTotal", label: "Facturas totales", type: "int", min: 0 },
    { key: "vencido30", label: "Vencido +30 días", type: "num", min: 0 },
    { key: "notas", label: "Notas", type: "text" },
  ],
};

function fmtNum(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("es-MX", { maximumFractionDigits: 1 });
}

// ─── Read-only payload renderer (for history + DIRECCION cards) ─────

function PayloadView({ role, payload }: { role: JobRole | null; payload: Payload }) {
  if (!role || role === "DIRECCION") return null;
  const defs = FIELDS[role];
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
      {defs.map((f) => (
        <div key={f.key} className={cn("flex flex-col", f.type === "text" && "col-span-2")}>
          <span className="text-xs text-muted-foreground">{f.label}</span>
          <span className="font-medium text-foreground break-words">
            {f.type === "text" ? String(payload[f.key] ?? "—") || "—" : fmtNum(payload[f.key])}
          </span>
        </div>
      ))}
      {role === "OPERACIONES" && (
        <>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Velocidad del mes</span>
            <span className="font-medium text-foreground">{fmtNum(payload.velocidadDelMes)}%</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">Salud general</span>
            <span>
              <span className={cn("inline-block rounded px-2 py-0.5 text-xs font-semibold", payload.saludGeneral ? SALUD_COLOR[String(payload.saludGeneral)] : "bg-secondary text-muted-foreground")}>
                {payload.saludGeneral ? String(payload.saludGeneral) : "Sin datos"}
              </span>
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Submitter form + history ───────────────────────────────────────

function SubmitterView({ jobRole }: { jobRole: Exclude<JobRole, "DIRECCION"> }) {
  const { toast } = useToast();
  const [data, setData] = useState<OwnData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fecha, setFecha] = useState<string>("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [openHist, setOpenHist] = useState<Set<string>>(new Set());

  const load = useCallback(async (f?: string) => {
    setLoading(true);
    try {
      const qs = f ? `?fecha=${f}` : "";
      const res = await fetch(`/api/reportes${qs}`);
      const d: OwnData = await res.json();
      setData(d);
      if (!fecha) setFecha(d.fecha);
      // Prefill from existing report.
      const p = d.report?.payload ?? {};
      const next: Record<string, string> = {};
      for (const def of FIELDS[jobRole]) {
        next[def.key] = p[def.key] != null ? String(p[def.key]) : "";
      }
      setForm(next);
    } catch {
      /* noop */
    }
    setLoading(false);
  }, [jobRole, fecha]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onDateChange = (f: string) => {
    setFecha(f);
    load(f);
  };

  const save = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const def of FIELDS[jobRole]) {
        if (def.type === "text") payload[def.key] = form[def.key] ?? "";
        else payload[def.key] = form[def.key] === "" ? "" : Number(form[def.key]);
      }
      const res = await fetch("/api/reportes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Error");
      toast("Reporte guardado", "success");
      await load(data?.today);
      setFecha(data?.today ?? fecha);
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo guardar", "error");
    }
    setSaving(false);
  };

  if (loading && !data) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) return null;

  const frozen = data.frozen;
  const computed = data.computed;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <ClipboardList className="h-6 w-6 text-primary" /> Reporte diario
          </h1>
          <p className="text-sm text-muted-foreground">{ROLE_LABEL[jobRole]}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">Día</label>
          <input
            type="date"
            value={fecha}
            max={data.today}
            onChange={(e) => onDateChange(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {frozen && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Estás viendo un día pasado. Los reportes anteriores no se pueden editar (congelados).
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS[jobRole].map((f) => (
            <div key={f.key} className={cn("flex flex-col gap-1", f.type === "text" && "sm:col-span-2")}>
              <label className="text-sm font-medium text-foreground">{f.label}</label>
              {f.type === "text" ? (
                <textarea
                  value={form[f.key] ?? ""}
                  disabled={frozen}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  rows={3}
                  className="rounded-lg border border-border bg-background px-3 py-2.5 text-base disabled:opacity-60 sm:text-sm"
                />
              ) : (
                <input
                  type="number"
                  inputMode={f.type === "int" ? "numeric" : "decimal"}
                  value={form[f.key] ?? ""}
                  disabled={frozen}
                  min={f.min}
                  max={f.max}
                  step={f.type === "int" ? 1 : "any"}
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                  className="min-h-[44px] rounded-lg border border-border bg-background px-3 py-2.5 text-base disabled:opacity-60 sm:text-sm"
                />
              )}
            </div>
          ))}
        </div>

        {jobRole === "OPERACIONES" && computed && (
          <div className="mt-5 grid gap-3 rounded-lg border border-border bg-secondary/40 p-4 sm:grid-cols-2">
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Velocidad del mes (solo lectura)</span>
              <span className="text-lg font-semibold text-foreground">{fmtNum(computed.velocidadDelMes)}%</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Salud general (solo lectura)</span>
              <div className="mt-0.5 flex items-center gap-2">
                <span className={cn("inline-block rounded px-2 py-0.5 text-xs font-semibold", computed.saludGeneral ? SALUD_COLOR[computed.saludGeneral] : "bg-secondary text-muted-foreground")}>
                  {computed.saludGeneral ?? "Sin datos"}
                </span>
                <span className="text-xs text-muted-foreground">
                  V {computed.counts.verde} · A {computed.counts.amarillo} · R {computed.counts.rojo}
                </span>
              </div>
            </div>
          </div>
        )}

        {!frozen && (
          <div className="mt-5 flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex w-full min-h-[48px] items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-base font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60 sm:w-auto sm:min-h-0 sm:py-2 sm:text-sm"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Guardar reporte
            </button>
          </div>
        )}
      </div>

      {/* Historial */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Historial</h2>
        {data.history.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no tienes reportes.</p>
        ) : (
          <div className="space-y-2">
            {data.history.map((h) => {
              const open = openHist.has(h.id);
              return (
                <div key={h.id} className="rounded-lg border border-border bg-card">
                  <button
                    onClick={() =>
                      setOpenHist((prev) => {
                        const next = new Set(prev);
                        if (next.has(h.id)) next.delete(h.id); else next.add(h.id);
                        return next;
                      })
                    }
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <span className="text-sm font-medium text-foreground">{h.fecha}</span>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
                  </button>
                  {open && (
                    <div className="border-t border-border px-4 py-3">
                      <PayloadView role={h.jobRole} payload={h.payload} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DIRECCION consolidated view ────────────────────────────────────

function DireccionView() {
  const [data, setData] = useState<AllData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fecha, setFecha] = useState<string>("");
  const [person, setPerson] = useState<string>("all");

  const load = useCallback(async (f?: string) => {
    setLoading(true);
    try {
      const qs = f ? `?scope=all&fecha=${f}` : "?scope=all";
      const res = await fetch(`/api/reportes${qs}`);
      const d: AllData = await res.json();
      setData(d);
      if (!fecha) setFecha(d.fecha);
    } catch {
      /* noop */
    }
    setLoading(false);
  }, [fecha]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !data) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (!data) return null;

  const reportByUser = new Map(data.reports.map((r) => [r.userId, r]));
  const members = data.members.filter((m) => person === "all" || m.userId === person);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-foreground">
            <ClipboardList className="h-6 w-6 text-primary" /> Reportes de hoy
          </h1>
          <p className="text-sm text-muted-foreground">Vista consolidada por puesto</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          >
            <option value="all">Todas las personas</option>
            {data.members.map((m) => (
              <option key={m.userId} value={m.userId}>{m.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={fecha}
            max={data.today}
            onChange={(e) => { setFecha(e.target.value); load(e.target.value); }}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay miembros con puesto que envíe reporte.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {members.map((m) => {
            const rep = reportByUser.get(m.userId);
            return (
              <div key={m.userId} className="rounded-xl border border-border bg-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.jobRole ? ROLE_LABEL[m.jobRole] : "—"}</p>
                  </div>
                  {rep ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Enviado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      <Clock className="h-3.5 w-3.5" /> Pendiente
                    </span>
                  )}
                </div>
                {rep ? (
                  <PayloadView role={rep.jobRole} payload={rep.payload} />
                ) : (
                  <p className="text-sm text-muted-foreground">Sin reporte para este día.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────

export default function ReportesPage() {
  const [jobRole, setJobRole] = useState<JobRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((d) => setJobRole(d.jobRole ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (jobRole === "DIRECCION") return <DireccionView />;
  if (jobRole) return <SubmitterView jobRole={jobRole} />;

  return (
    <div className="py-20 text-center text-sm text-muted-foreground">
      Tu puesto no tiene reportes diarios.
    </div>
  );
}
