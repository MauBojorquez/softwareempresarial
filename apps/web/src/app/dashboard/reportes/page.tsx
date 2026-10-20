"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ClipboardList, Save, ChevronDown, CheckCircle2, Clock, History, Users, UserX } from "lucide-react";
import { useToast } from "@/components/toast";
import { apiSend } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import { PageHeader, Card } from "@/components/ui/page-header";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
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
  VERDE: "bg-success/10 text-success",
  AMARILLO: "bg-warning/10 text-warning",
  ROJO: "bg-destructive/10 text-destructive",
};

// ─── Field descriptors per role (editable inputs only) ──────────────

type FieldDef = {
  key: string;
  label: string;
  type: "int" | "num" | "text";
  min?: number;
  max?: number;
  /** Monetary amount: rendered with MoneyInput (decimal keypad + "$"). */
  money?: boolean;
};

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
    { key: "porCobrar", label: "Por cobrar", type: "num", min: 0, money: true },
    { key: "cobrado", label: "Cobrado", type: "num", min: 0, money: true },
    { key: "facturasPagadas", label: "Facturas pagadas", type: "int", min: 0 },
    { key: "facturasTotal", label: "Facturas totales", type: "int", min: 0 },
    { key: "vencido30", label: "Vencido +30 días", type: "num", min: 0, money: true },
    { key: "notas", label: "Notas", type: "text" },
  ],
};

function fmtNum(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("es-MX", { maximumFractionDigits: 1 });
}

/** GET JSON and throw the server's message on failure. */
async function getJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    throw new Error("Sin conexión con el servidor.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { error?: string }).error || `Error ${res.status}`);
  return body as T;
}

function SaludBadge({ value }: { value: string | null | undefined }) {
  return (
    <span
      className={cn(
        "inline-block rounded-md px-2 py-0.5 text-xs font-semibold",
        value ? SALUD_COLOR[value] : "bg-secondary text-muted-foreground",
      )}
    >
      {value || "Sin datos"}
    </span>
  );
}

function StatusBadge({ sent }: { sent: boolean }) {
  return sent ? (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
      <CheckCircle2 className="h-3.5 w-3.5" /> Enviado
    </span>
  ) : (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-xs font-semibold text-warning">
      <Clock className="h-3.5 w-3.5" /> Pendiente
    </span>
  );
}

function FormSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <Card className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function CardsGridSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2" aria-busy="true" aria-label="Cargando">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </Card>
      ))}
    </div>
  );
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
          <span className="break-words font-medium text-foreground">
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
              <SaludBadge value={payload.saludGeneral ? String(payload.saludGeneral) : null} />
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
  const hasData = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fecha, setFecha] = useState<string>("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [openHist, setOpenHist] = useState<Set<string>>(new Set());

  const load = useCallback(async (f?: string) => {
    setLoading(true);
    try {
      const qs = f ? `?fecha=${f}` : "";
      const d = await getJson<OwnData>(`/api/reportes${qs}`);
      setData(d);
      hasData.current = true;
      setError(null);
      if (!fecha) setFecha(d.fecha);
      // Prefill from existing report.
      const p = d.report?.payload ?? {};
      const next: Record<string, string> = {};
      for (const def of FIELDS[jobRole]) {
        next[def.key] = p[def.key] != null ? String(p[def.key]) : "";
      }
      setForm(next);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo cargar el reporte";
      setError(msg);
      // With data already on screen, a failed refresh is a toast, not a blank page.
      if (hasData.current) toast(msg, "error", { action: { label: "Reintentar", onClick: () => load(f) } });
    }
    setLoading(false);
  }, [jobRole, fecha, toast]);

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
      await apiSend("/api/reportes", "POST", { payload });
      toast("Reporte guardado", "success");
      await load(data?.today);
      setFecha(data?.today ?? fecha);
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo guardar", "error");
    }
    setSaving(false);
  };

  if (loading && !data) return <FormSkeleton />;

  if (!data) {
    return (
      <div className="space-y-6">
        <PageHeader icon={ClipboardList} title="Reporte diario" description={ROLE_LABEL[jobRole]} />
        <Card>
          <ErrorState message={error} onRetry={() => load(fecha || undefined)} />
        </Card>
      </div>
    );
  }

  const frozen = data.frozen;
  const computed = data.computed;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ClipboardList}
        title="Reporte diario"
        description={ROLE_LABEL[jobRole]}
        actions={
          <Field label="Día" className="w-full sm:w-44">
            <Input
              type="date"
              value={fecha}
              max={data.today}
              onChange={(e) => onDateChange(e.target.value)}
            />
          </Field>
        }
      />

      {frozen && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 px-4 py-2.5 text-sm text-warning">
          Estás viendo un día pasado. Los reportes anteriores no se pueden editar (congelados).
        </div>
      )}

      <Card className="p-5" aria-busy={loading || undefined}>
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS[jobRole].map((f) => {
            const common = {
              value: form[f.key] ?? "",
              disabled: frozen,
            };
            const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
              setForm((s) => ({ ...s, [f.key]: e.target.value }));

            let control: React.ReactElement;
            if (f.type === "text") {
              control = <Textarea {...common} onChange={onChange} rows={3} />;
            } else if (f.money) {
              control = (
                <MoneyInput
                  {...common}
                  type="number"
                  min={f.min}
                  max={f.max}
                  step="any"
                  onChange={onChange}
                />
              );
            } else {
              control = (
                <Input
                  {...common}
                  type="number"
                  // Integers: numeric keypad. Decimals: decimal keypad, except when
                  // negatives are allowed (no min), where the default number keyboard keeps "-".
                  inputMode={f.type === "int" ? "numeric" : f.min != null ? "decimal" : undefined}
                  min={f.min}
                  max={f.max}
                  step={f.type === "int" ? 1 : "any"}
                  onChange={onChange}
                  className="tabular-nums"
                />
              );
            }

            return (
              <Field
                key={f.key}
                label={f.label}
                optional={f.type === "text"}
                className={cn(f.type === "text" && "sm:col-span-2")}
              >
                {control}
              </Field>
            );
          })}
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
                <SaludBadge value={computed.saludGeneral} />
                <span className="text-xs text-muted-foreground">
                  V {computed.counts.verde} · A {computed.counts.amarillo} · R {computed.counts.rojo}
                </span>
              </div>
            </div>
          </div>
        )}

        {!frozen && (
          <div className="mt-5 flex justify-end">
            <Button onClick={save} loading={saving} size="lg" className="w-full sm:w-auto">
              {!saving && <Save />}
              Guardar reporte
            </Button>
          </div>
        )}
      </Card>

      {/* Historial */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-foreground">Historial</h2>
        {data.history.length === 0 ? (
          <Card>
            <EmptyState
              icon={History}
              title="Aún no tienes reportes"
              description="Tus reportes diarios guardados aparecerán aquí."
            />
          </Card>
        ) : (
          <div className="space-y-2">
            {data.history.map((h) => {
              const open = openHist.has(h.id);
              const panelId = `hist-${h.id}`;
              return (
                <Card key={h.id}>
                  <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={() =>
                      setOpenHist((prev) => {
                        const next = new Set(prev);
                        if (next.has(h.id)) next.delete(h.id); else next.add(h.id);
                        return next;
                      })
                    }
                    className="flex min-h-[44px] w-full items-center justify-between rounded-xl px-4 py-3 text-left transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="text-sm font-medium text-foreground">{h.fecha}</span>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
                  </button>
                  {open && (
                    <div id={panelId} className="border-t border-border px-4 py-3">
                      <PayloadView role={h.jobRole} payload={h.payload} />
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── DIRECCION consolidated view ────────────────────────────────────

function DireccionView() {
  const { toast } = useToast();
  const [data, setData] = useState<AllData | null>(null);
  const hasData = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fecha, setFecha] = useState<string>("");
  const [person, setPerson] = useState<string>("all");

  const load = useCallback(async (f?: string) => {
    setLoading(true);
    try {
      const qs = f ? `?scope=all&fecha=${f}` : "?scope=all";
      const d = await getJson<AllData>(`/api/reportes${qs}`);
      setData(d);
      hasData.current = true;
      setError(null);
      if (!fecha) setFecha(d.fecha);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudieron cargar los reportes";
      setError(msg);
      // With data already on screen, a failed refresh is a toast, not a blank page.
      if (hasData.current) toast(msg, "error", { action: { label: "Reintentar", onClick: () => load(f) } });
    }
    setLoading(false);
  }, [fecha, toast]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const header = (actions?: React.ReactNode) => (
    <PageHeader
      icon={ClipboardList}
      title="Reportes de hoy"
      description="Vista consolidada por puesto"
      actions={actions}
    />
  );

  if (loading && !data) {
    return (
      <div className="space-y-6">
        {header()}
        <CardsGridSkeleton />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-6">
        {header()}
        <Card>
          <ErrorState message={error} onRetry={() => load(fecha || undefined)} />
        </Card>
      </div>
    );
  }

  const reportByUser = new Map(data.reports.map((r) => [r.userId, r]));
  const members = data.members.filter((m) => person === "all" || m.userId === person);

  return (
    <div className="space-y-6">
      {header(
        <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2">
          <Field label="Persona" className="sm:w-52">
            <Select value={person} onChange={(e) => setPerson(e.target.value)}>
              <option value="all">Todas las personas</option>
              {data.members.map((m) => (
                <option key={m.userId} value={m.userId}>{m.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Día" className="sm:w-44">
            <Input
              type="date"
              value={fecha}
              max={data.today}
              onChange={(e) => { setFecha(e.target.value); load(e.target.value); }}
            />
          </Field>
        </div>,
      )}

      {members.length === 0 ? (
        <Card>
          <EmptyState
            icon={data.members.length === 0 ? Users : UserX}
            title={data.members.length === 0 ? "Sin miembros que reporten" : "Sin resultados"}
            description="No hay miembros con puesto que envíe reporte."
          />
        </Card>
      ) : (
        <div className={cn("grid gap-4 md:grid-cols-2", loading && "opacity-60 transition-opacity")} aria-busy={loading || undefined}>
          {members.map((m) => {
            const rep = reportByUser.get(m.userId);
            return (
              <Card key={m.userId} className="p-5">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.jobRole ? ROLE_LABEL[m.jobRole] : "—"}</p>
                  </div>
                  <StatusBadge sent={!!rep} />
                </div>
                {rep ? (
                  <PayloadView role={rep.jobRole} payload={rep.payload} />
                ) : (
                  <p className="text-sm text-muted-foreground">Sin reporte para este día.</p>
                )}
              </Card>
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
  const [error, setError] = useState<string | null>(null);

  const loadRole = useCallback(() => {
    setLoading(true);
    setError(null);
    getJson<{ jobRole?: JobRole | null }>("/api/user")
      .then((d) => setJobRole(d.jobRole ?? null))
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar tu perfil"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadRole(); }, [loadRole]);

  if (loading) return <FormSkeleton />;

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader icon={ClipboardList} title="Reportes" />
        <Card>
          <ErrorState message={error} onRetry={loadRole} />
        </Card>
      </div>
    );
  }

  if (jobRole === "DIRECCION") return <DireccionView />;
  if (jobRole) return <SubmitterView jobRole={jobRole} />;

  return (
    <div className="space-y-6">
      <PageHeader icon={ClipboardList} title="Reportes" />
      <Card>
        <EmptyState
          icon={ClipboardList}
          title="Sin reportes diarios"
          description="Tu puesto no tiene reportes diarios."
        />
      </Card>
    </div>
  );
}
