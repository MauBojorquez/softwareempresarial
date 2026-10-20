"use client";

import { useState, useCallback } from "react";
import { Mountain, Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/components/toast";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { PageHeader, Card } from "@/components/ui/page-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useConfirm } from "@/components/ui/confirm";
import { useApi, apiSend } from "@/hooks/use-api";

type JobRole = "DIRECCION" | "OPERACIONES" | "COMERCIAL" | "MARKETING" | "ADMINISTRACION";
type Salud = "VERDE" | "AMARILLO" | "ROJO";

interface ChecklistItem {
  id: string;
  titulo: string;
  done: boolean;
  order: number;
}

interface Roca {
  id: string;
  titulo: string;
  metricaExito: string;
  fechaLimite: string;
  estatus: Salud;
  porcentajeAvance: number;
  usaChecklist: boolean;
  mes: string;
  duenoId: string;
  duenoNombre: string | null;
  checklist: ChecklistItem[];
}

interface Member {
  id: string;
  name: string;
}

const SALUD_COLOR: Record<Salud, string> = {
  VERDE: "border-success/30 bg-success/10 text-success",
  AMARILLO: "border-warning/30 bg-warning/10 text-warning",
  ROJO: "border-destructive/30 bg-destructive/10 text-destructive",
};

const BAR_COLOR: Record<Salud, string> = {
  VERDE: "bg-success",
  AMARILLO: "bg-warning",
  ROJO: "bg-destructive",
};

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

function errMsg(e: unknown, fallback: string) {
  return e instanceof Error && e.message ? e.message : fallback;
}

export default function RocasPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [mes, setMes] = useState<string>(currentMonth());
  const userApi = useApi<{ jobRole?: JobRole | null; user?: { id?: string } | null }>("/api/user");
  const membersApi = useApi<{ members?: Member[] }>("/api/tareas");
  const { data, setData, error, initialLoading, reload } = useApi<{ rocas?: Roca[] }>(`/api/rocas?mes=${mes}`);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Roca | null>(null);

  const jobRole = userApi.data?.jobRole ?? null;
  const userId = userApi.data?.user?.id ?? null;
  const members = Array.isArray(membersApi.data?.members) ? membersApi.data!.members! : [];
  const rocas = Array.isArray(data?.rocas) ? data!.rocas! : [];

  const setRocas = useCallback(
    (fn: (prev: Roca[]) => Roca[]) =>
      setData((prev) => ({ ...(prev ?? {}), rocas: fn(Array.isArray(prev?.rocas) ? prev!.rocas! : []) })),
    [setData],
  );

  const isDireccion = jobRole === "DIRECCION";

  const updateOwn = async (roca: Roca, patch: { porcentajeAvance?: number }) => {
    try {
      const d = await apiSend<{ roca: Roca }>(`/api/rocas/${roca.id}`, "PATCH", patch);
      setRocas((prev) => prev.map((r) => (r.id === roca.id ? d.roca : r)));
      toast("Roca actualizada", "success");
    } catch (e) {
      toast(errMsg(e, "No se pudo actualizar"), "error");
    }
  };

  const replaceRoca = useCallback(
    (saved: Roca) => {
      setRocas((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
    },
    [setRocas],
  );

  const toggleItem = async (roca: Roca, item: ChecklistItem, done: boolean) => {
    try {
      const d = await apiSend<{ roca: Roca }>(`/api/rocas/${roca.id}/checklist/${item.id}`, "PATCH", { done });
      replaceRoca(d.roca);
    } catch (e) {
      toast(errMsg(e, "No se pudo actualizar"), "error");
    }
  };

  const remove = async (roca: Roca) => {
    const ok = await confirm({
      title: `¿Eliminar la roca "${roca.titulo}"?`,
      description: "Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiSend(`/api/rocas/${roca.id}`, "DELETE");
      setRocas((prev) => prev.filter((r) => r.id !== roca.id));
      toast("Roca eliminada", "success");
    } catch (e) {
      toast(errMsg(e, "No se pudo eliminar"), "error");
    }
  };

  const openNew = () => {
    setEditing(null);
    setShowForm(true);
  };

  const newButton = isDireccion ? (
    <Button onClick={openNew}>
      <Plus /> Nueva roca
    </Button>
  ) : null;

  const loadError = error ?? userApi.error;
  const retry = () => {
    if (userApi.error) userApi.reload();
    reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Mountain}
        title="Rocas del mes"
        description="Objetivos clave y su avance"
        actions={
          <>
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span>Mes</span>
              <Input
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value || currentMonth())}
                className="w-auto"
              />
            </label>
            {newButton}
          </>
        }
      />

      {loadError ? (
        <Card>
          <ErrorState message={loadError} onRetry={retry} />
        </Card>
      ) : initialLoading ? (
        <Card>
          <RowsSkeleton rows={4} />
        </Card>
      ) : rocas.length === 0 ? (
        <Card>
          <EmptyState
            icon={Mountain}
            title="No hay rocas para este mes"
            description={
              isDireccion
                ? "Define los objetivos clave del mes y asigna un dueño a cada uno."
                : "Dirección aún no ha definido las rocas de este mes."
            }
            action={newButton}
          />
        </Card>
      ) : (
        <>
          {/* Mobile card list (below sm) */}
          <div className="space-y-3 sm:hidden">
            {rocas.map((r) => {
              const canEditOwn = isDireccion || r.duenoId === userId;
              return (
                <Card key={r.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{r.titulo}</p>
                      <p className="text-xs text-muted-foreground">{r.metricaExito}</p>
                    </div>
                    <SaludBadge estatus={r.estatus} className="flex-shrink-0" />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>Dueño: {r.duenoNombre ?? "—"}</span>
                    <span>Límite: {fmtDate(r.fechaLimite)}</span>
                  </div>
                  <ProgressRow roca={r} canEdit={canEditOwn} onCommit={updateOwn} />
                  {r.usaChecklist && <ChecklistView roca={r} canEdit={canEditOwn} onToggle={toggleItem} />}
                  {isDireccion && (
                    <div className="mt-3 flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Editar roca ${r.titulo}`}
                        onClick={() => {
                          setEditing(r);
                          setShowForm(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Eliminar roca ${r.titulo}`}
                        className="hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => remove(r)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Table (sm and up) */}
          <Card className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Dueño</th>
                  <th className="px-4 py-3 font-medium">Roca / Métrica de éxito</th>
                  <th className="px-4 py-3 font-medium">Fecha límite</th>
                  <th className="px-4 py-3 font-medium">Estatus</th>
                  <th className="px-4 py-3 font-medium">% Avance</th>
                  {isDireccion && <th className="px-4 py-3 text-right font-medium">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {rocas.map((r) => {
                  const canEditOwn = isDireccion || r.duenoId === userId;
                  return (
                    <tr key={r.id} className="border-b border-border align-top last:border-0 hover:bg-secondary/60">
                      <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">{r.duenoNombre ?? "—"}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{r.titulo}</p>
                        <p className="text-xs text-muted-foreground">{r.metricaExito}</p>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">{fmtDate(r.fechaLimite)}</td>
                      <td className="px-4 py-3">
                        <SaludBadge estatus={r.estatus} />
                      </td>
                      <td className="min-w-[180px] px-4 py-3">
                        <ProgressRow roca={r} canEdit={canEditOwn} onCommit={updateOwn} compact />
                        {r.usaChecklist && <ChecklistView roca={r} canEdit={canEditOwn} onToggle={toggleItem} />}
                      </td>
                      {isDireccion && (
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Editar roca ${r.titulo}`}
                              onClick={() => {
                                setEditing(r);
                                setShowForm(true);
                              }}
                            >
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Eliminar roca ${r.titulo}`}
                              className="hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => remove(r)}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {showForm && isDireccion && (
        <RocaForm
          roca={editing}
          members={members}
          membersError={membersApi.error}
          defaultMes={mes}
          onClose={() => setShowForm(false)}
          onSaved={(saved) => {
            setShowForm(false);
            if (saved.mes === mes) {
              setRocas((prev) => {
                const exists = prev.some((r) => r.id === saved.id);
                return exists ? prev.map((r) => (r.id === saved.id ? saved : r)) : [...prev, saved];
              });
            } else {
              reload();
            }
          }}
        />
      )}
    </div>
  );
}

function SaludBadge({ estatus, className }: { estatus: Salud; className?: string }) {
  return (
    <span className={cn("inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold", SALUD_COLOR[estatus], className)}>
      {estatus}
    </span>
  );
}

function ProgressRow({
  roca: r,
  canEdit,
  onCommit,
  compact,
}: {
  roca: Roca;
  canEdit: boolean;
  onCommit: (roca: Roca, patch: { porcentajeAvance?: number }) => void;
  compact?: boolean;
}) {
  const pct = Math.min(100, Math.max(0, r.porcentajeAvance));
  return (
    <div className={cn("flex items-center gap-2", !compact && "mt-3")}>
      <div
        className="h-2 flex-1 rounded-full bg-secondary"
        role="progressbar"
        aria-label={`Avance de ${r.titulo}`}
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cn("h-2 rounded-full transition-all", BAR_COLOR[r.estatus])} style={{ width: `${pct}%` }} />
      </div>
      {canEdit && !r.usaChecklist ? (
        <Input
          key={r.porcentajeAvance}
          type="number"
          inputMode="numeric"
          min={0}
          max={100}
          aria-label={`% de avance de ${r.titulo}`}
          defaultValue={r.porcentajeAvance}
          onBlur={(e) => {
            const p = Number(e.target.value);
            if (Number.isInteger(p) && p >= 0 && p <= 100 && p !== r.porcentajeAvance) {
              onCommit(r, { porcentajeAvance: p });
            }
          }}
          className="w-20 tabular-nums"
        />
      ) : (
        <span className="w-10 text-right text-xs font-medium tabular-nums text-foreground">{r.porcentajeAvance}%</span>
      )}
    </div>
  );
}

function ChecklistView({
  roca,
  canEdit,
  onToggle,
}: {
  roca: Roca;
  canEdit: boolean;
  onToggle: (roca: Roca, item: ChecklistItem, done: boolean) => void;
}) {
  const items = roca.checklist ?? [];
  if (items.length === 0) {
    return <p className="mt-2 text-xs text-muted-foreground">Sin elementos en la checklist.</p>;
  }
  return (
    <ul className="mt-2 space-y-1">
      {items.map((item) => (
        <li key={item.id}>
          <label
            className={cn(
              "flex items-start gap-2 rounded-md py-1 text-xs",
              canEdit ? "cursor-pointer" : "cursor-default",
            )}
          >
            <input
              type="checkbox"
              checked={item.done}
              disabled={!canEdit}
              onChange={(e) => onToggle(roca, item, e.target.checked)}
              className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-border accent-primary disabled:cursor-not-allowed"
            />
            <span className={cn("text-foreground", item.done && "text-muted-foreground line-through")}>{item.titulo}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

function RocaForm({
  roca,
  members,
  membersError,
  defaultMes,
  onClose,
  onSaved,
}: {
  roca: Roca | null;
  members: Member[];
  membersError: string | null;
  defaultMes: string;
  onClose: () => void;
  onSaved: (r: Roca) => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [titulo, setTitulo] = useState(roca?.titulo ?? "");
  const [metricaExito, setMetricaExito] = useState(roca?.metricaExito ?? "");
  const [fechaLimite, setFechaLimite] = useState(roca ? roca.fechaLimite.slice(0, 10) : "");
  const [duenoId, setDuenoId] = useState(roca?.duenoId ?? "");
  const [mes, setMes] = useState(roca?.mes ?? defaultMes);
  const [porcentajeAvance, setPorcentajeAvance] = useState<string>(String(roca?.porcentajeAvance ?? 0));
  const [usaChecklist, setUsaChecklist] = useState<boolean>(roca?.usaChecklist ?? false);
  const [items, setItems] = useState<{ id?: string; titulo: string }[]>(
    roca?.checklist?.map((i) => ({ id: i.id, titulo: i.titulo })) ?? [],
  );
  const [newItem, setNewItem] = useState("");
  const [addingItem, setAddingItem] = useState(false);

  const addItem = async () => {
    const t = newItem.trim();
    if (!t) return;
    // For an existing roca, persist immediately so the % stays derived.
    if (roca) {
      setAddingItem(true);
      try {
        const d = await apiSend<{ roca: Roca }>(`/api/rocas/${roca.id}/checklist`, "POST", { titulo: t });
        setItems((d.roca.checklist as ChecklistItem[]).map((i) => ({ id: i.id, titulo: i.titulo })));
      } catch (e) {
        toast(errMsg(e, "No se pudo agregar"), "error");
        setAddingItem(false);
        return;
      }
      setAddingItem(false);
    } else {
      setItems((prev) => [...prev, { titulo: t }]);
    }
    setNewItem("");
  };

  const removeItem = async (idx: number) => {
    const item = items[idx];
    if (roca && item.id) {
      try {
        const d = await apiSend<{ roca: Roca }>(`/api/rocas/${roca.id}/checklist/${item.id}`, "DELETE");
        setItems((d.roca.checklist as ChecklistItem[]).map((i) => ({ id: i.id, titulo: i.titulo })));
      } catch (e) {
        toast(errMsg(e, "No se pudo eliminar"), "error");
      }
    } else {
      setItems((prev) => prev.filter((_, i) => i !== idx));
    }
  };

  const submit = async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        titulo,
        metricaExito,
        fechaLimite,
        duenoId,
        mes,
        usaChecklist,
      };
      if (!usaChecklist) body.porcentajeAvance = Number(porcentajeAvance);
      if (!roca && usaChecklist) body.items = items.map((i) => i.titulo);
      const d = await apiSend<{ roca: Roca }>(roca ? `/api/rocas/${roca.id}` : "/api/rocas", roca ? "PATCH" : "POST", body);
      toast(roca ? "Roca actualizada" : "Roca creada", "success");
      onSaved(d.roca);
    } catch (e) {
      toast(errMsg(e, "No se pudo guardar"), "error");
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        size="lg"
        title={roca ? "Editar roca" : "Nueva roca"}
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={submit} loading={saving}>
              Guardar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Título">
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus />
          </Field>
          <Field label="Métrica de éxito">
            <Input value={metricaExito} onChange={(e) => setMetricaExito(e.target.value)} />
          </Field>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Fecha límite">
              <Input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} />
            </Field>
            <Field label="Mes">
              <Input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
            </Field>
          </div>
          <Field label="Dueño" error={membersError ? "No se pudo cargar el equipo" : null}>
            <Select value={duenoId} onChange={(e) => setDuenoId(e.target.value)}>
              <option value="">Selecciona…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <fieldset>
            <legend className="text-sm font-medium text-foreground">Tipo de avance</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={!usaChecklist}
                onClick={() => setUsaChecklist(false)}
                className={cn(
                  "h-10 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  !usaChecklist
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-secondary/60",
                )}
              >
                Manual (%)
              </button>
              <button
                type="button"
                aria-pressed={usaChecklist}
                onClick={() => setUsaChecklist(true)}
                className={cn(
                  "h-10 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  usaChecklist
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:bg-secondary/60",
                )}
              >
                Checklist
              </button>
            </div>
          </fieldset>
          {usaChecklist ? (
            <div>
              <p className="text-sm font-medium text-foreground">Elementos de la checklist</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                El % se calcula automáticamente según los elementos completados.
              </p>
              {items.length > 0 && (
                <ul className="mt-2 space-y-2">
                  {items.map((it, idx) => (
                    <li key={it.id ?? `new-${idx}`} className="flex items-center gap-2">
                      <span className="flex-1 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm">
                        {it.titulo}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Quitar elemento ${it.titulo}`}
                        className="hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeItem(idx)}
                      >
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-3 flex items-end gap-2">
                <Field label="Nuevo elemento" className="flex-1">
                  <Input
                    value={newItem}
                    onChange={(e) => setNewItem(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addItem();
                      }
                    }}
                  />
                </Field>
                <Button type="button" variant="outline" onClick={addItem} loading={addingItem}>
                  {!addingItem && <Plus />} Agregar
                </Button>
              </div>
            </div>
          ) : (
            <Field label="% Avance">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={porcentajeAvance}
                onChange={(e) => setPorcentajeAvance(e.target.value)}
              />
            </Field>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
