"use client";

import { useState } from "react";
import { Plus, Trash2, ListChecks, Check, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { PageHeader, Card } from "@/components/ui/page-header";
import { EmptyState, ErrorState, RowsSkeleton } from "@/components/ui/states";
import { useConfirm } from "@/components/ui/confirm";
import { useApi, apiSend } from "@/hooks/use-api";

// ─── Types ──────────────────────────────────────────────────────────

type Estatus = "PENDIENTE" | "COMPLETADA";

interface Tarea {
  id: string;
  descripcion: string;
  mes: string;
  fechaLimite?: string | null;
  estatus: Estatus;
  fechaCompletada?: string | null;
  clienteId: string;
  clienteNombre?: string | null;
  responsableId?: string | null;
  responsableNombre?: string | null;
}

interface Velocidad { total: number; completadas: number; ratio: number; }
interface ClienteOpt { id: string; nombre: string; }
interface Member { id: string; name: string | null; }

interface TareasResponse {
  tareas?: Tarea[];
  velocidad?: Velocidad;
  members?: Member[];
}

const EMPTY_VELOCIDAD: Velocidad = { total: 0, completadas: 0, ratio: 0 };
const EMPTY_FORM = { descripcion: "", clienteId: "", responsableId: "", fechaLimite: "" };

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function errMsg(e: unknown, fallback: string) {
  return e instanceof Error && e.message ? e.message : fallback;
}

export default function TareasPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [mes, setMes] = useState(currentMonth());
  const { data, setData, error, loading, initialLoading, reload } = useApi<TareasResponse>(`/api/tareas?mes=${mes}`);
  const clientesApi = useApi<{ clientes?: ClienteOpt[] }>("/api/clientes");

  const tareas = data?.tareas ?? [];
  const velocidad = data?.velocidad ?? EMPTY_VELOCIDAD;
  const members = data?.members ?? [];
  const clientes: ClienteOpt[] = (clientesApi.data?.clientes ?? []).map((c) => ({ id: c.id, nombre: c.nombre }));

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<{ descripcion?: string; clienteId?: string }>({});

  const add = async () => {
    const e: typeof errors = {};
    if (!form.descripcion.trim()) e.descripcion = "Escribe la descripción";
    if (!form.clienteId) e.clienteId = "Selecciona un cliente";
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await apiSend("/api/tareas", "POST", {
        descripcion: form.descripcion,
        clienteId: form.clienteId,
        responsableId: form.responsableId || null,
        fechaLimite: form.fechaLimite || null,
        mes,
      });
      setForm({ ...EMPTY_FORM });
      toast("Tarea creada", "success");
      await reload();
    } catch (err) {
      toast(errMsg(err, "No se pudo guardar"), "error");
    }
    setSaving(false);
  };

  /** Optimistically sets a task's status (and the month's velocity). */
  const applyEstatus = (id: string, estatus: Estatus) => {
    setData((prev) => {
      if (!prev) return prev;
      const list = prev.tareas ?? [];
      const current = list.find((t) => t.id === id);
      if (!current || current.estatus === estatus) return prev;
      const v = prev.velocidad ?? EMPTY_VELOCIDAD;
      const completadas = Math.max(0, v.completadas + (estatus === "COMPLETADA" ? 1 : -1));
      return {
        ...prev,
        tareas: list.map((t) =>
          t.id === id
            ? { ...t, estatus, fechaCompletada: estatus === "COMPLETADA" ? new Date().toISOString() : null }
            : t,
        ),
        velocidad: { ...v, completadas, ratio: v.total > 0 ? completadas / v.total : 0 },
      };
    });
  };

  const setEstatus = async (t: Tarea, next: Estatus, withUndo: boolean) => {
    const prevEstatus: Estatus = next === "COMPLETADA" ? "PENDIENTE" : "COMPLETADA";
    applyEstatus(t.id, next);
    try {
      await apiSend(`/api/tareas/${t.id}`, "PATCH", { estatus: next });
      if (withUndo) {
        toast(next === "COMPLETADA" ? "Tarea completada" : "Tarea marcada como pendiente", "success", {
          action: { label: "Deshacer", onClick: () => setEstatus(t, prevEstatus, false) },
        });
      }
    } catch (err) {
      applyEstatus(t.id, prevEstatus);
      toast(errMsg(err, "No se pudo actualizar"), "error", {
        action: { label: "Reintentar", onClick: () => setEstatus(t, next, withUndo) },
      });
    }
  };

  const toggle = (t: Tarea) => setEstatus(t, t.estatus === "COMPLETADA" ? "PENDIENTE" : "COMPLETADA", true);

  const remove = async (t: Tarea) => {
    const ok = await confirm({
      title: "¿Eliminar la tarea?",
      description: t.descripcion,
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiSend(`/api/tareas/${t.id}`, "DELETE");
      toast("Tarea eliminada", "success");
      await reload();
    } catch (err) {
      toast(errMsg(err, "No se pudo eliminar"), "error");
    }
  };

  const pct = Math.round(velocidad.ratio * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ListChecks}
        title="Tareas del mes"
        description="Entregables por cliente y velocidad de cumplimiento."
      />

      {/* Controls + velocity */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="p-4">
          <Field label="Mes">
            <Input type="month" value={mes} onChange={(e) => setMes(e.target.value || currentMonth())} />
          </Field>
        </Card>
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-foreground">Velocidad del mes</p>
            <p className="text-sm font-semibold tabular-nums">
              {velocidad.completadas}/{velocidad.total} ({pct}%)
            </p>
          </div>
          <div
            className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary"
            role="progressbar"
            aria-label="Velocidad del mes"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
          </div>
        </Card>
      </div>

      {/* Add form */}
      <Card className="p-4">
        <p className="mb-3 text-sm font-semibold">Nueva tarea</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Descripción" error={errors.descripcion} className="sm:col-span-2">
              <Input
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              />
            </Field>
            <Field
              label="Cliente"
              error={errors.clienteId ?? (clientesApi.error ? "No se pudieron cargar los clientes" : null)}
            >
              <Select
                value={form.clienteId}
                onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value }))}
              >
                <option value="">Selecciona…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Responsable" optional>
              <Select
                value={form.responsableId}
                onChange={(e) => setForm((f) => ({ ...f, responsableId: e.target.value }))}
              >
                <option value="">Sin asignar</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fecha límite" optional>
              <Input
                type="date"
                value={form.fechaLimite}
                onChange={(e) => setForm((f) => ({ ...f, fechaLimite: e.target.value }))}
              />
            </Field>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button type="submit" loading={saving}>
              {!saving && <Plus />} Agregar tarea
            </Button>
            {clientesApi.error && (
              <Button type="button" variant="outline" size="sm" onClick={clientesApi.reload}>
                <RotateCcw /> Recargar clientes
              </Button>
            )}
          </div>
        </form>
      </Card>

      {error ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : initialLoading ? (
        <Card>
          <RowsSkeleton rows={5} />
        </Card>
      ) : tareas.length === 0 ? (
        <Card>
          <EmptyState
            icon={ListChecks}
            title="Sin tareas para este mes"
            description="Agrega la primera tarea con el formulario de arriba."
          />
        </Card>
      ) : (
        <div className={cn("transition-opacity", loading && "opacity-60")} aria-busy={loading}>
          {/* Mobile card list (below sm) */}
          <div className="space-y-3 sm:hidden">
            {tareas.map((t) => (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-medium">{t.descripcion}</p>
                  <EstatusBadge estatus={t.estatus} className="flex-shrink-0" />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>Cliente: {t.clienteNombre || "—"}</span>
                  <span>Resp.: {t.responsableNombre || "—"}</span>
                </div>
                {t.fechaLimite && (
                  <div className="mt-1 text-xs text-muted-foreground">Fecha límite: {t.fechaLimite.slice(0, 10)}</div>
                )}
                <div className="mt-3 flex justify-end gap-1">
                  <ToggleButton tarea={t} onToggle={toggle} size="icon" />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Eliminar tarea"
                    className="hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => remove(t)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Table (sm and up) */}
          <Card className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Descripción</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Responsable</th>
                  <th className="px-4 py-3 font-medium">Fecha límite</th>
                  <th className="px-4 py-3 font-medium">Estatus</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tareas.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-secondary/60">
                    <td className={cn("px-4 py-3 font-medium", t.estatus === "COMPLETADA" && "text-muted-foreground")}>
                      {t.descripcion}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.clienteNombre || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.responsableNombre || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.fechaLimite ? t.fechaLimite.slice(0, 10) : "—"}</td>
                    <td className="px-4 py-3">
                      <EstatusBadge estatus={t.estatus} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <ToggleButton tarea={t} onToggle={toggle} size="icon-sm" />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Eliminar tarea"
                          className="hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => remove(t)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </div>
  );
}

function EstatusBadge({ estatus, className }: { estatus: Estatus; className?: string }) {
  const done = estatus === "COMPLETADA";
  return (
    <span
      className={cn(
        "inline-block rounded-full border px-2.5 py-1 text-xs font-semibold",
        done ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning",
        className,
      )}
    >
      {done ? "Completada" : "Pendiente"}
    </span>
  );
}

function ToggleButton({
  tarea,
  onToggle,
  size,
}: {
  tarea: Tarea;
  onToggle: (t: Tarea) => void;
  size: "icon" | "icon-sm";
}) {
  const done = tarea.estatus === "COMPLETADA";
  const label = done ? "Marcar pendiente" : "Marcar completada";
  return (
    <Button
      variant="ghost"
      size={size}
      aria-label={label}
      title={label}
      onClick={() => onToggle(tarea)}
      className={cn(!done && "text-success hover:bg-success/10 hover:text-success")}
    >
      {done ? <RotateCcw /> : <Check />}
    </Button>
  );
}
