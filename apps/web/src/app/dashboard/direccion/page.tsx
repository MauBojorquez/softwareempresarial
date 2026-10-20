"use client";

import { useState, useEffect, useRef } from "react";
import {
  Gauge, Pencil, Check, X, CheckCircle2, Clock, Mountain,
  Users, TrendingUp, Filter, Lock,
} from "lucide-react";
import { useToast } from "@/components/toast";
import { useApi, apiSend } from "@/hooks/use-api";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/ui/field";
import { PageHeader, Card } from "@/components/ui/page-header";
import { EmptyState, ErrorState, Skeleton, CardsSkeleton, RowsSkeleton } from "@/components/ui/states";
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
  saludGrupo: Salud | null;
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

// Semáforos: always the semantic tokens so they read in light and dark mode.
const SALUD_COLOR: Record<Salud, string> = {
  VERDE: "border-success/30 bg-success/10 text-success",
  AMARILLO: "border-warning/30 bg-warning/10 text-warning",
  ROJO: "border-destructive/30 bg-destructive/10 text-destructive",
};
const SEMA_TEXT: Record<Salud, string> = {
  VERDE: "text-success",
  AMARILLO: "text-warning",
  ROJO: "text-destructive",
};
const SEMA_BAR: Record<Salud, string> = {
  VERDE: "bg-success", AMARILLO: "bg-warning", ROJO: "bg-destructive",
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

function SaludBadge({ value, className }: { value: Salud; className?: string }) {
  return (
    <span className={cn("inline-block shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold", SALUD_COLOR[value], className)}>
      {value}
    </span>
  );
}

type ToastFn = ReturnType<typeof useToast>["toast"];

/** Inline money editor for a meta: Enter saves, Escape cancels. */
function MetaEditor({ initial, label, saving, onSave, onCancel }: {
  initial: string; label: string; saving: boolean; onSave: (v: string) => void; onCancel: () => void;
}) {
  const [val, setVal] = useState(initial);
  return (
    <div className="flex items-center gap-1">
      <div className="w-32">
        <MoneyInput
          type="number"
          min={0}
          step="any"
          autoFocus
          aria-label={label}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSave(val);
            if (e.key === "Escape") onCancel();
          }}
          className="h-9 text-sm"
        />
      </div>
      <Button variant="ghost" size="icon-sm" className="h-9 w-9 text-success hover:text-success" onClick={() => onSave(val)} loading={saving} aria-label="Guardar">
        {!saving && <Check />}
      </Button>
      <Button variant="ghost" size="icon-sm" className="h-9 w-9" onClick={onCancel} disabled={saving} aria-label="Cancelar">
        <X />
      </Button>
    </div>
  );
}

function EditMetaButton({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon-sm" className="h-9 w-9" onClick={onClick} aria-label="Editar meta">
      <Pencil />
    </Button>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <Card className="space-y-4 p-6">
        <Skeleton className="h-4 w-56" />
        <div className="grid gap-6 md:grid-cols-[auto_1fr]">
          <div className="space-y-3">
            <Skeleton className="h-12 w-28" />
            <Skeleton className="h-3 w-56 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))}
          </div>
        </div>
      </Card>
      <CardsSkeleton count={6} className="sm:grid-cols-3 lg:grid-cols-6" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><RowsSkeleton rows={5} /></Card>
        <Card><RowsSkeleton rows={5} /></Card>
      </div>
    </div>
  );
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
  const user = useApi<{ jobRole?: JobRole | null }>("/api/user");
  const jobRole = user.data?.jobRole ?? null;
  const dash = useApi<Data>(jobRole === "DIRECCION" ? "/api/dashboard/direccion" : null);
  const { data, error, reload } = dash;

  // A failed refresh (after a save) keeps the board on screen and reports it.
  const hadData = useRef(false);
  useEffect(() => {
    if (data) hadData.current = true;
  }, [data]);
  useEffect(() => {
    if (error && hadData.current) toast(error, "error", { action: { label: "Reintentar", onClick: reload } });
  }, [error, reload, toast]);

  const header = (description?: string) => (
    <PageHeader icon={Gauge} title="Dirección" description={description} />
  );

  if (user.initialLoading) {
    return (
      <div className="space-y-6">
        {header()}
        <DashboardSkeleton />
      </div>
    );
  }
  if (user.error) {
    return (
      <div className="space-y-6">
        {header()}
        <Card><ErrorState message={user.error} onRetry={user.reload} /></Card>
      </div>
    );
  }
  if (jobRole !== "DIRECCION") {
    return (
      <div className="space-y-6">
        {header()}
        <Card>
          <EmptyState icon={Lock} title="No autorizado" description="Este panel es exclusivo de Dirección." />
        </Card>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="space-y-6">
        {header()}
        {error ? <Card><ErrorState message={error} onRetry={reload} /></Card> : <DashboardSkeleton />}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header(`Panorama del mes ${data.mes}`)}

      <NumeroCriticoHero nc={data.numeroCritico} mes={data.mes} onSaved={reload} toast={toast} />

      <CarteraBlock cartera={data.cartera} />

      <div className="grid gap-6 lg:grid-cols-2">
        <EmbudoBlock rows={data.embudo} />
        <VendedoresBlock rows={data.ventasPorVendedor} mes={data.mes} onSaved={reload} toast={toast} />
      </div>

      <ReportesBlock rows={data.reportesHoy} hoy={data.hoy} />

      <RocasBlock rows={data.rocas} />
    </div>
  );
}

// ── 1. Número Crítico ──
function NumeroCriticoHero({ nc, mes, onSaved, toast }: {
  nc: NumeroCritico; mes: string; onSaved: () => void; toast: ToastFn;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async (val: string) => {
    setSaving(true);
    try {
      await apiSend("/api/targets", "PUT", { mes, monthlyMeta: Number(val) });
      toast("Meta actualizada", "success");
      setEditing(false);
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo guardar", "error");
    }
    setSaving(false);
  };

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Número Crítico · Cobranza del mes</h2>
        <SaludBadge value={nc.semaforo} className="rounded-full px-3 py-1 font-bold" />
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-[auto_1fr]">
        <div>
          <p className={cn("text-5xl font-black leading-none", SEMA_TEXT[nc.semaforo])}>{pct(nc.avancePct)}</p>
          <p className="mt-1 text-xs text-muted-foreground">de avance</p>
          <div
            className="mt-3 h-3 w-full max-w-56 overflow-hidden rounded-full bg-secondary sm:w-56"
            role="progressbar"
            aria-label="Avance de cobranza"
            aria-valuenow={Math.round(nc.avancePct)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className={cn("h-3 rounded-full", SEMA_BAR[nc.semaforo])} style={{ width: `${Math.min(100, nc.avancePct)}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Mes transcurrido: {pct(nc.mesTranscurridoPct)}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Meta">
            {editing ? (
              <MetaEditor
                initial={String(nc.meta)}
                label="Meta de cobranza del mes"
                saving={saving}
                onSave={save}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <span className="inline-flex items-center gap-1">
                {formatCurrency(nc.meta)}
                <EditMetaButton onClick={() => setEditing(true)} />
              </span>
            )}
          </Stat>
          <Stat label="Cobrado">{formatCurrency(nc.cobrado)}</Stat>
          <Stat label="Faltante">{formatCurrency(nc.faltante)}</Stat>
          <Stat label="Días restantes">{nc.diasRestantes}</Stat>
          <Stat label="Ritmo requerido/día">{formatCurrency(nc.ritmoDiario)}</Stat>
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="text-lg font-bold tabular-nums text-foreground">{children}</div>
    </div>
  );
}

// ── 2. Cartera ──
function CarteraBlock({ cartera }: { cartera: Cartera }) {
  const t = cartera.totals;
  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Users className="h-5 w-5 text-primary" /> Cartera</h2>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Salud del grupo:</span>
          {cartera.saludGrupo ? (
            <SaludBadge value={cartera.saludGrupo} />
          ) : (
            <span className="rounded-md bg-secondary px-2 py-0.5 font-semibold text-muted-foreground">Sin clientes activos</span>
          )}
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

      {cartera.clientes.length === 0 ? (
        <EmptyState icon={Users} title="Sin clientes" description="Aún no hay clientes en la cartera." className="py-8" />
      ) : (
      <>
      <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
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
                <td className="px-3 py-2"><SaludBadge value={c.salud} /></td>
                <td className="px-3 py-2">{formatCurrency(c.cobradoMes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 sm:hidden">
        {cartera.clientes.map((c) => (
          <div key={c.id} className="rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-foreground">{c.nombre}</p>
              <SaludBadge value={c.salud} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Monto mensual</p>
                <p className="font-medium text-foreground">{formatCurrency(c.montoMensual)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Día de pago</p>
                <p className="font-medium text-foreground">{c.diaDePago ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Estatus</p>
                <p className="font-medium text-foreground">{ESTATUS_LABEL[c.estatus]}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cobrado mes</p>
                <p className="font-medium text-foreground">{formatCurrency(c.cobradoMes)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      </>
      )}
    </Card>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-bold tabular-nums text-foreground">{value}</p>
      {sub && <p className="text-xs tabular-nums text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── 3. Embudo ──
function EmbudoBlock({ rows }: { rows: EmbudoRow[] }) {
  return (
    <Card className="p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground"><Filter className="h-5 w-5 text-primary" /> Embudo</h2>
      {rows.length === 0 ? (
        <EmptyState icon={Filter} title="Embudo vacío" description="Aún no hay leads en el embudo." className="py-8" />
      ) : (
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
      )}
    </Card>
  );
}

// ── 4. Ventas por vendedor ──
function VendedoresBlock({ rows, mes, onSaved, toast }: {
  rows: VendedorRow[]; mes: string; onSaved: () => void; toast: ToastFn;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (userId: string, val: string) => {
    setSaving(true);
    try {
      await apiSend("/api/targets", "PUT", { mes, vendors: [{ userId, meta: Number(val) }] });
      toast("Meta actualizada", "success");
      setEditing(null);
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo guardar", "error");
    }
    setSaving(false);
  };

  const metaCell = (r: VendedorRow) =>
    editing === r.userId ? (
      <MetaEditor
        initial={String(r.meta)}
        label={`Meta de ${r.name}`}
        saving={saving}
        onSave={(v) => save(r.userId, v)}
        onCancel={() => setEditing(null)}
      />
    ) : (
      <span className="inline-flex items-center gap-1 font-medium text-foreground">
        {formatCurrency(r.meta)}
        <EditMetaButton onClick={() => setEditing(r.userId)} />
      </span>
    );

  return (
    <Card className="p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground"><TrendingUp className="h-5 w-5 text-primary" /> Ventas por vendedor</h2>
      {rows.length === 0 ? (
        <EmptyState icon={TrendingUp} title="Sin vendedores" description="No hay vendedores con ventas este mes." className="py-8" />
      ) : (
      <>
      <div className="hidden overflow-x-auto sm:block">
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
                <td className="px-2 py-2">{metaCell(r)}</td>
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
          </tbody>
        </table>
      </div>

      <div className="space-y-3 sm:hidden">
        {rows.map((r) => (
          <div key={r.userId} className="rounded-lg border border-border p-3">
            <p className="font-medium text-foreground">{r.name}</p>
            <div className="mt-2 space-y-1.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">Meta</span>
                {metaCell(r)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Vendido</span>
                <span className="font-medium text-foreground">{formatCurrency(r.vendido)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Cobrado</span>
                <span className="font-medium text-foreground">{formatCurrency(r.cobrado)}</span>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Avance</span>
                  <span className="text-xs text-muted-foreground">{pct(r.avancePct)}</span>
                </div>
                <div className="h-2 rounded-full bg-secondary">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${Math.min(100, r.avancePct)}%` }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      </>
      )}
    </Card>
  );
}

// ── 5. Reportes de hoy ──
function ReportesBlock({ rows, hoy }: { rows: ReporteRow[]; hoy: string }) {
  return (
    <Card className="p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground"><CheckCircle2 className="h-5 w-5 text-primary" /> Reportes de hoy <span className="text-sm font-normal text-muted-foreground">({hoy})</span></h2>
      {rows.length === 0 ? (
        <EmptyState icon={Users} title="Sin reportes" description="No hay miembros que envíen reporte." className="py-8" />
      ) : (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const defs = r.jobRole && r.jobRole !== "DIRECCION" ? REPORT_SUMMARY[r.jobRole] : [];
          return (
            <div key={r.userId} className="rounded-lg border border-border bg-secondary/40 p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="min-w-0 truncate font-semibold text-foreground">{r.name}</p>
                {r.submitted ? (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-xs font-semibold text-success"><CheckCircle2 className="h-3 w-3" /> Enviado</span>
                ) : (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning"><Clock className="h-3 w-3" /> Pendiente</span>
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
      </div>
      )}
    </Card>
  );
}

// ── 6. Rocas del mes ──
function RocasBlock({ rows }: { rows: RocaRow[] }) {
  return (
    <Card className="p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-foreground"><Mountain className="h-5 w-5 text-primary" /> Rocas del mes</h2>
      {rows.length === 0 ? (
        <EmptyState icon={Mountain} title="Sin rocas este mes" description="Las rocas trimestrales del mes aparecerán aquí." className="py-8" />
      ) : (
      <>
      <div className="hidden overflow-x-auto sm:block">
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
                <td className="px-3 py-2"><SaludBadge value={r.estatus} /></td>
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
          </tbody>
        </table>
      </div>

      <div className="space-y-3 sm:hidden">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-foreground">{r.titulo}</p>
                <p className="text-xs text-muted-foreground">{r.metricaExito}</p>
              </div>
              <SaludBadge value={r.estatus} />
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Dueño</p>
                <p className="font-medium text-foreground">{r.duenoNombre ?? "—"}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Fecha</p>
                <p className="font-medium text-foreground">{fmtDate(r.fechaLimite)}</p>
              </div>
            </div>
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">% Avance</span>
                <span className="text-xs text-muted-foreground">{r.porcentajeAvance}%</span>
              </div>
              <div className="h-2 rounded-full bg-secondary">
                <div className={cn("h-2 rounded-full", SEMA_BAR[r.estatus])} style={{ width: `${Math.min(100, r.porcentajeAvance)}%` }} />
              </div>
            </div>
          </div>
        ))}
      </div>
      </>
      )}
    </Card>
  );
}
