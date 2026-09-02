"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Settings2, GripVertical, Check, Loader2, Target, Users, KanbanSquare,
  TrendingUp, ClipboardList, Mountain, ListChecks, Receipt, Landmark, Megaphone,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { DashboardSkeleton } from "@/components/dashboard/skeleton";

type AvailableBlock = { id: string; label: string };

type PrefsResponse = {
  bloques: string[] | null;
  available: AvailableBlock[];
  defaults: string[];
};

const fmtMoney = formatCurrency;
const fmtNum = (v: number) => new Intl.NumberFormat("es-MX").format(Math.round(v || 0));
const fmtPct = (v: number) => `${(v || 0).toFixed(0)}%`;

const BLOCK_ICONS: Record<string, typeof Target> = {
  numeroCritico: Target,
  cartera: Users,
  embudo: KanbanSquare,
  ventasVendedor: TrendingUp,
  reportesDia: ClipboardList,
  rocas: Mountain,
  tareas: ListChecks,
  cobranza: Receipt,
  flujo: Landmark,
  marketing: Megaphone,
};

const ETAPA_LABELS: Record<string, string> = {
  NUEVO: "Nuevo",
  CONTACTADO: "Contactado",
  SESION_AGENDADA: "Sesión agendada",
  DIAGNOSTICO_VENDIDO: "Diagnóstico vendido",
  PROPUESTA_ENVIADA: "Propuesta enviada",
  CERRADO_GANADO: "Cerrado ganado",
  CERRADO_PERDIDO: "Cerrado perdido",
};

export default function OverviewPage() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<PrefsResponse | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [blockData, setBlockData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [showSelector, setShowSelector] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const fetchBlocks = useCallback(async (ids: string[]) => {
    if (ids.length === 0) { setBlockData({}); return; }
    setLoadingData(true);
    try {
      const res = await fetch(`/api/resumen?blocks=${ids.join(",")}`);
      if (res.ok) {
        const json = await res.json();
        setBlockData(json.blocks ?? {});
      } else {
        toast("Error al cargar los bloques", "error");
      }
    } catch {
      toast("Error de conexión", "error");
    }
    setLoadingData(false);
  }, [toast]);

  // Initial load.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/dashboard-preferences");
        if (!res.ok) { toast("Error al cargar el resumen", "error"); setLoading(false); return; }
        const data: PrefsResponse = await res.json();
        setPrefs(data);
        if (data.bloques === null) {
          // First time — show onboarding selector prefilled with defaults.
          setDraft(data.defaults);
          setShowSelector(true);
        } else {
          setOrder(data.bloques);
          await fetchBlocks(data.bloques);
        }
      } catch {
        toast("Error de conexión", "error");
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savePrefs = async (bloques: string[]): Promise<string[]> => {
    const res = await fetch("/api/dashboard-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bloques }),
    });
    if (!res.ok) throw new Error("save failed");
    const json = await res.json();
    return json.bloques as string[];
  };

  const handleSaveSelector = async () => {
    setSaving(true);
    try {
      const saved = await savePrefs(draft);
      setOrder(saved);
      setPrefs((p) => (p ? { ...p, bloques: saved } : p));
      setShowSelector(false);
      await fetchBlocks(saved);
    } catch {
      toast("No se pudo guardar tu selección", "error");
    }
    setSaving(false);
  };

  const openSelector = () => {
    setDraft(order);
    setShowSelector(true);
  };

  const toggleDraft = (id: string) => {
    setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  };

  // Drag-to-reorder rendered blocks; persist on drop.
  const onDrop = async (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const next = [...order];
    const from = next.indexOf(dragId);
    const to = next.indexOf(targetId);
    if (from === -1 || to === -1) { setDragId(null); return; }
    next.splice(from, 1);
    next.splice(to, 0, dragId);
    setDragId(null);
    setOrder(next);
    try {
      const saved = await savePrefs(next);
      setOrder(saved);
      setPrefs((p) => (p ? { ...p, bloques: saved } : p));
    } catch {
      toast("No se pudo guardar el nuevo orden", "error");
    }
  };

  if (loading) return <DashboardSkeleton />;

  const available = prefs?.available ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Resumen</h1>
          <p className="text-sm text-muted-foreground">Tu dashboard personalizado</p>
        </div>
        {!showSelector && (
          <button
            onClick={openSelector}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
          >
            <Settings2 className="h-4 w-4" /> Personalizar
          </button>
        )}
      </div>

      {showSelector ? (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground">
            {prefs?.bloques === null ? "¿Qué quieres ver en tu Resumen?" : "Personaliza tu Resumen"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Elige los bloques que quieres mostrar. Puedes cambiarlos cuando quieras.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {available.map((b) => {
              const on = draft.includes(b.id);
              const Icon = BLOCK_ICONS[b.id] ?? Target;
              return (
                <button
                  key={b.id}
                  onClick={() => toggleDraft(b.id)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 text-left text-sm transition-colors",
                    on ? "border-primary bg-primary/5 text-foreground" : "border-border bg-card text-muted-foreground hover:bg-secondary",
                  )}
                >
                  <span className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    on ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
                  )}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1 font-medium">{b.label}</span>
                  <span className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border",
                    on ? "border-primary bg-primary text-white" : "border-border",
                  )}>
                    {on && <Check className="h-3 w-3" />}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex items-center justify-end gap-2">
            {prefs?.bloques !== null && (
              <button
                onClick={() => setShowSelector(false)}
                className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary"
              >
                Cancelar
              </button>
            )}
            <button
              onClick={handleSaveSelector}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg gradient-bg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar
            </button>
          </div>
        </div>
      ) : order.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">No tienes bloques seleccionados.</p>
          <button onClick={openSelector} className="mt-3 rounded-lg gradient-bg px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            Elegir bloques
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {loadingData && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Actualizando…
            </div>
          )}
          {order.map((id) => {
            const data = blockData[id];
            if (data === undefined) return null; // omitted by API (no access / not computed)
            return (
              <div
                key={id}
                draggable
                onDragStart={() => setDragId(id)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(id)}
                className={cn(
                  "group rounded-2xl border border-border bg-card transition-shadow",
                  dragId === id && "opacity-50",
                )}
              >
                <BlockCard id={id} data={data} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BlockHeader({ id, title, extra }: { id: string; title: string; extra?: React.ReactNode }) {
  const Icon = BLOCK_ICONS[id] ?? Target;
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        {extra}
        <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </div>
  );
}

function Tile({ label, value, sub, tone = "slate" }: { label: string; value: string; sub?: string; tone?: "amber" | "emerald" | "red" | "slate" | "primary" }) {
  const accent: Record<string, string> = {
    amber: "text-amber-600 dark:text-amber-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    red: "text-red-600 dark:text-red-400",
    slate: "text-foreground",
    primary: "text-primary",
  };
  return (
    <div className="rounded-xl border border-border bg-background/50 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-bold tracking-tight", accent[tone])}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

const SEMAFORO_TONE: Record<string, "emerald" | "amber" | "red"> = {
  VERDE: "emerald", AMARILLO: "amber", ROJO: "red",
};

function BlockCard({ id, data }: { id: string; data: any }) {
  switch (id) {
    case "numeroCritico":
      return (
        <>
          <BlockHeader id={id} title="Número Crítico" extra={
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold",
              data.semaforo === "VERDE" ? "bg-emerald-500/15 text-emerald-500" :
              data.semaforo === "AMARILLO" ? "bg-amber-500/15 text-amber-500" : "bg-red-500/15 text-red-500")}>
              {data.semaforo}
            </span>
          } />
          <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-4">
            <Tile label="Meta del mes" value={fmtMoney(data.meta)} />
            <Tile label="Cobrado" value={fmtMoney(data.cobrado)} tone={SEMAFORO_TONE[data.semaforo]} sub={`${fmtPct(data.avancePct)} de avance`} />
            <Tile label="Faltante" value={fmtMoney(data.faltante)} tone="amber" />
            <Tile label="Ritmo diario" value={fmtMoney(data.ritmoDiario)} sub={`${data.diasRestantes} días restantes`} />
          </div>
        </>
      );

    case "cartera": {
      const t = data.totals;
      return (
        <>
          <BlockHeader id={id} title="Cartera" />
          <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-4">
            <Tile label="MRR activo" value={fmtMoney(t.mrrActivo)} tone="emerald" sub={`${t.activo.count} activos`} />
            <Tile label="Cobrado del mes" value={fmtMoney(t.cobradoMes)} tone="primary" />
            <Tile label="En espera" value={String(t.espera.count)} sub={fmtMoney(t.espera.monto)} tone="amber" />
            <Tile label="En riesgo" value={String(t.riesgo.count)} sub={fmtMoney(t.riesgo.monto)} tone="red" />
          </div>
        </>
      );
    }

    case "embudo": {
      const max = Math.max(...data.map((e: any) => e.count), 1);
      return (
        <>
          <BlockHeader id={id} title="Embudo del CRM" />
          <div className="space-y-2 p-5">
            {data.map((e: any) => (
              <div key={e.etapa} className="flex items-center gap-3">
                <span className="w-40 shrink-0 text-xs text-muted-foreground">{ETAPA_LABELS[e.etapa] ?? e.etapa}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-md bg-secondary/50">
                  <div className="h-full gradient-bg" style={{ width: `${Math.max((e.count / max) * 100, e.count > 0 ? 4 : 0)}%` }} />
                </div>
                <span className="w-10 shrink-0 text-right text-xs font-semibold text-foreground">{e.count}</span>
              </div>
            ))}
          </div>
        </>
      );
    }

    case "ventasVendedor":
      return (
        <>
          <BlockHeader id={id} title="Ventas por vendedor" />
          <div className="overflow-x-auto p-2">
            {data.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">Sin datos este mes.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="p-2 font-medium">Vendedor</th>
                    <th className="p-2 text-right font-medium">Meta</th>
                    <th className="p-2 text-right font-medium">Vendido</th>
                    <th className="p-2 text-right font-medium">Cobrado</th>
                    <th className="p-2 text-right font-medium">Avance</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((v: any) => (
                    <tr key={v.userId} className="border-t border-border">
                      <td className="p-2 font-medium text-foreground">{v.name}</td>
                      <td className="p-2 text-right">{fmtMoney(v.meta)}</td>
                      <td className="p-2 text-right">{fmtMoney(v.vendido)}</td>
                      <td className="p-2 text-right">{fmtMoney(v.cobrado)}</td>
                      <td className="p-2 text-right font-semibold">{fmtPct(v.avancePct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      );

    case "reportesDia": {
      const done = data.filter((r: any) => r.submitted).length;
      return (
        <>
          <BlockHeader id={id} title="Reportes del día" extra={
            <span className="text-xs font-medium text-muted-foreground">{done}/{data.length}</span>
          } />
          <div className="space-y-1.5 p-5">
            {data.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin miembros que reporten.</p>
            ) : data.map((r: any) => (
              <div key={r.userId} className="flex items-center justify-between rounded-lg px-2 py-1.5">
                <span className="text-sm text-foreground">{r.name}</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold",
                  r.submitted ? "bg-emerald-500/15 text-emerald-500" : "bg-secondary text-muted-foreground")}>
                  {r.submitted ? "Enviado" : "Pendiente"}
                </span>
              </div>
            ))}
          </div>
        </>
      );
    }

    case "rocas":
      return (
        <>
          <BlockHeader id={id} title="Rocas" />
          <div className="space-y-2 p-5">
            {data.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin rocas este mes.</p>
            ) : data.map((r: any) => (
              <div key={r.id} className="rounded-xl border border-border bg-background/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{r.titulo}</p>
                  <span className="text-xs font-semibold text-primary">{fmtPct(r.porcentajeAvance)}</span>
                </div>
                {r.duenoNombre && <p className="mt-0.5 text-[11px] text-muted-foreground">{r.duenoNombre}</p>}
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary/50">
                  <div className="h-full gradient-bg" style={{ width: `${Math.min(r.porcentajeAvance, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      );

    case "tareas":
      return (
        <>
          <BlockHeader id={id} title="Tareas del mes" />
          <div className="grid grid-cols-3 gap-3 p-5">
            <Tile label="Completadas" value={String(data.completadas)} tone="emerald" />
            <Tile label="Total" value={String(data.total)} />
            <Tile label="Velocidad" value={fmtPct((data.velocidad || 0) * 100)} tone="primary" />
          </div>
        </>
      );

    case "cobranza":
      return (
        <>
          <BlockHeader id={id} title="Cobranza" />
          <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-4">
            <Tile label="Por cobrar" value={fmtMoney(data.porCobrar)} tone="amber" sub={`${data.pendientes} pendientes`} />
            <Tile label="Cobrado" value={fmtMoney(data.cobrado)} tone="emerald" sub={`${data.pagadas} pagadas`} />
            <Tile label="Vencido (+30d)" value={fmtMoney(data.vencido)} tone="red" />
            <Tile label="Pendientes" value={String(data.pendientes)} />
          </div>
        </>
      );

    case "flujo":
      return (
        <>
          <BlockHeader id={id} title="Flujo de efectivo" />
          <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-4">
            <Tile label="Saldo en bancos" value={fmtMoney(data.saldoBancos)} />
            <Tile label="Ingresos del mes" value={fmtMoney(data.ingresosMes)} tone="emerald" />
            <Tile label="Egresos del mes" value={fmtMoney(data.egresosMes)} tone="red" />
            <Tile label="Flujo neto" value={fmtMoney(data.flujoNeto)} tone={data.flujoNeto >= 0 ? "emerald" : "red"} />
          </div>
        </>
      );

    case "marketing":
      return <MarketingBlock id={id} data={data} />;

    default:
      return null;
  }
}

function MarketingBlock({ id, data }: { id: string; data: any }) {
  // Count-only (COMERCIAL) shape has just the two lead counts.
  const countOnly = data.gasto === undefined && data.porCampana === undefined;
  return (
    <>
      <BlockHeader id={id} title="Marketing" extra={
        !countOnly && (
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold",
            data.metaConnected ? "bg-emerald-500/15 text-emerald-500" : "bg-secondary text-muted-foreground")}>
            {data.metaConnected ? "Meta conectado" : "Sin conexión"}
          </span>
        )
      } />
      {countOnly ? (
        <div className="grid grid-cols-2 gap-3 p-5">
          <Tile label="Leads Meta (mes)" value={fmtNum(data.metaLeadsMes)} tone="primary" />
          <Tile label="Leads Meta (hoy)" value={fmtNum(data.metaLeadsDia)} tone="emerald" />
        </div>
      ) : (
        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Leads Meta (mes)" value={fmtNum(data.metaLeadsMes)} tone="primary" sub={`${fmtNum(data.metaLeadsDia)} hoy`} />
            <Tile label="Gasto" value={fmtMoney(data.gasto)} tone="amber" />
            <Tile label="Costo por lead" value={data.cpl != null ? fmtMoney(data.cpl) : "—"} />
            <Tile label="Valor generado" value={fmtMoney(data.valorPesos)} tone="emerald" />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Avanzaron" value={fmtNum(data.conversion.avanzaron)} />
            <Tile label="Diagnóstico" value={fmtNum(data.conversion.diagnostico)} />
            <Tile label="Ganados" value={fmtNum(data.conversion.ganados)} tone="emerald" />
            <Tile label="Clics / CTR" value={fmtNum(data.clicks)} sub={`CTR ${(data.ctr || 0).toFixed(2)}%`} />
          </div>
          {data.porCampana?.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">Leads por campaña</p>
              <div className="space-y-1.5">
                {data.porCampana.map((c: any) => (
                  <div key={c.campana} className="flex items-center justify-between text-sm">
                    <span className="truncate pr-2 text-foreground">{c.campana}</span>
                    <span className="font-semibold text-foreground">{fmtNum(c.leads)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
