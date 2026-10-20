"use client";

import { useState } from "react";
import { Plus, Trash2, Users, Pencil } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { saludGrupoFromCounts } from "@/lib/salud";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, MoneyInput, Select, Textarea } from "@/components/ui/field";
import { PageHeader, Card } from "@/components/ui/page-header";
import { EmptyState, ErrorState, RowsSkeleton, CardsSkeleton } from "@/components/ui/states";
import { useConfirm } from "@/components/ui/confirm";
import { useApi, apiSend } from "@/hooks/use-api";

// ─── Types ──────────────────────────────────────────────────────────

type Estatus = "ACTIVO" | "ESPERA" | "VENCIDO" | "BAJA";
type Salud = "VERDE" | "AMARILLO" | "ROJO";

interface Cliente {
  id: string;
  nombre: string;
  contacto?: string | null;
  montoMensual: number;
  diaDePago?: number | null;
  diaReporte?: number | null;
  estatus: Estatus;
  salud: Salud;
  fechaAlta: string;
  notas?: string | null;
}

const ESTATUS_LABEL: Record<Estatus, string> = {
  ACTIVO: "Activo",
  ESPERA: "En espera",
  VENCIDO: "Vencido",
  BAJA: "Baja",
};

const ESTATUS_STYLE: Record<Estatus, string> = {
  ACTIVO: "border-success/30 bg-success/10 text-success",
  ESPERA: "border-warning/30 bg-warning/10 text-warning",
  VENCIDO: "border-destructive/30 bg-destructive/10 text-destructive",
  BAJA: "border-border bg-secondary text-muted-foreground",
};

const SALUD_DOT: Record<Salud, string> = {
  VERDE: "bg-success",
  AMARILLO: "bg-warning",
  ROJO: "bg-destructive",
};

const ESTATUS_OPTS: Estatus[] = ["ACTIVO", "ESPERA", "VENCIDO", "BAJA"];
const SALUD_OPTS: Salud[] = ["VERDE", "AMARILLO", "ROJO"];

const EMPTY_FORM = {
  nombre: "",
  contacto: "",
  montoMensual: "",
  diaDePago: "",
  diaReporte: "",
  estatus: "ACTIVO" as Estatus,
  salud: "VERDE" as Salud,
  notas: "",
};

type FormState = typeof EMPTY_FORM;

function errMsg(e: unknown, fallback: string) {
  return e instanceof Error && e.message ? e.message : fallback;
}

export default function CarteraPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { data, setData, error, initialLoading, reload } = useApi<{ clientes: Cliente[] }>("/api/clientes");
  const clientes = data?.clientes ?? [];
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);

  const patch = async (id: string, body: Record<string, unknown>) => {
    try {
      await apiSend(`/api/clientes/${id}`, "PATCH", body);
      await reload();
      return true;
    } catch (e) {
      toast(errMsg(e, "No se pudo actualizar"), "error");
      await reload();
      return false;
    }
  };

  const changeSalud = (c: Cliente, salud: Salud) => {
    setData((prev) =>
      prev ? { ...prev, clientes: prev.clientes.map((x) => (x.id === c.id ? { ...x, salud } : x)) } : prev,
    );
    patch(c.id, { salud });
  };

  const remove = async (c: Cliente) => {
    const ok = await confirm({
      title: `¿Dar de baja a ${c.nombre}?`,
      description: "El cliente dejará de contar en la cartera vigente.",
      confirmLabel: "Dar de baja",
      destructive: true,
    });
    if (!ok) return;
    try {
      const res = await apiSend<{ note?: string }>(`/api/clientes/${c.id}`, "DELETE");
      if (res?.note) toast(res.note, "info");
      else toast("Cliente eliminado", "success");
      await reload();
    } catch (e) {
      toast(errMsg(e, "No se pudo eliminar"), "error");
    }
  };

  // ── Totals / indicators ──────────────────────────────────────────
  const activos = clientes.filter((c) => c.estatus === "ACTIVO");
  const mrr = activos.reduce((s, c) => s + c.montoMensual, 0);
  const countByEstatus = ESTATUS_OPTS.reduce(
    (acc, e) => ({ ...acc, [e]: clientes.filter((c) => c.estatus === e).length }),
    {} as Record<Estatus, number>,
  );
  const noBaja = clientes.filter((c) => c.estatus !== "BAJA");
  const verde = noBaja.filter((c) => c.salud === "VERDE").length;
  const amarillo = noBaja.filter((c) => c.salud === "AMARILLO").length;
  const rojo = noBaja.filter((c) => c.salud === "ROJO").length;
  const grupoSalud: Salud | null = saludGrupoFromCounts({ verde, amarillo, rojo });

  const newButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus /> Dar de alta
    </Button>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Cartera de clientes"
        description="Altas, estatus, salud y monto mensual recurrente."
        actions={newButton}
      />

      {error ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : initialLoading ? (
        <>
          <CardsSkeleton count={4} className="grid-cols-2 sm:grid-cols-2" />
          <Card>
            <RowsSkeleton rows={6} />
          </Card>
        </>
      ) : (
        <>
          {/* Summary tiles */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground">MRR activo</p>
              <p className="mt-1 text-xl font-bold tracking-tight text-success">{formatCurrency(mrr)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{activos.length} clientes activos</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Por estatus</p>
              <p className="mt-1 text-sm font-semibold">
                {countByEstatus.ACTIVO} activo · {countByEstatus.ESPERA} espera
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {countByEstatus.VENCIDO} vencido · {countByEstatus.BAJA} baja
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Salud del grupo</p>
              <div className="mt-1 flex items-center gap-2">
                {grupoSalud ? (
                  <>
                    <span className={cn("h-3 w-3 rounded-full", SALUD_DOT[grupoSalud])} aria-hidden />
                    <span className="text-sm font-semibold">
                      {grupoSalud === "ROJO" ? "En riesgo" : grupoSalud === "AMARILLO" ? "Atención" : "Saludable"}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="h-3 w-3 rounded-full bg-secondary" aria-hidden />
                    <span className="text-sm font-semibold text-muted-foreground">Sin clientes activos</span>
                  </>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {verde} verde / {amarillo} amarillo / {rojo} rojo
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground">Total clientes</p>
              <p className="mt-1 text-xl font-bold tracking-tight">{clientes.length}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{noBaja.length} vigentes</p>
            </Card>
          </div>

          {clientes.length === 0 ? (
            <Card>
              <EmptyState
                icon={Users}
                title="Sin clientes todavía"
                description="Da de alta tu primer cliente para empezar a medir el MRR y la salud de la cartera."
                action={newButton}
              />
            </Card>
          ) : (
            <>
              {/* Mobile card list (below md) */}
              <div className="space-y-3 md:hidden">
                {clientes.map((c) => (
                  <Card key={c.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold">{c.nombre}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.contacto || "—"}</p>
                      </div>
                      <EstatusBadge estatus={c.estatus} className="flex-shrink-0" />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="font-semibold tabular-nums">{formatCurrency(c.montoMensual)}</span>
                      <span className="text-xs text-muted-foreground">
                        Pago: {c.diaDePago ?? "—"} · Reporte: {c.diaReporte ?? "—"}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <SaludSelect cliente={c} onChange={changeSalud} />
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" aria-label={`Editar ${c.nombre}`} onClick={() => setEditing(c)}>
                          <Pencil />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Dar de baja a ${c.nombre}`}
                          className="hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => remove(c)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Table (md and up) */}
              <Card className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Cliente</th>
                      <th className="px-4 py-3 font-medium">Contacto</th>
                      <th className="px-4 py-3 text-right font-medium">Monto mensual</th>
                      <th className="px-4 py-3 font-medium">Día pago</th>
                      <th className="px-4 py-3 font-medium">Día reporte</th>
                      <th className="px-4 py-3 font-medium">Estatus</th>
                      <th className="px-4 py-3 font-medium">Salud</th>
                      <th className="px-4 py-3 text-right font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientes.map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/60">
                        <td className="px-4 py-3 font-medium">{c.nombre}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.contacto || "—"}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(c.montoMensual)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.diaDePago ?? "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{c.diaReporte ?? "—"}</td>
                        <td className="px-4 py-3">
                          <EstatusBadge estatus={c.estatus} />
                        </td>
                        <td className="px-4 py-3">
                          <SaludSelect cliente={c} onChange={changeSalud} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon-sm" aria-label={`Editar ${c.nombre}`} onClick={() => setEditing(c)}>
                              <Pencil />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Dar de baja a ${c.nombre}`}
                              className="hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => remove(c)}
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
            </>
          )}
        </>
      )}

      {creating && (
        <CreateDialog
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false);
            toast("Cliente dado de alta", "success");
            await reload();
          }}
        />
      )}

      {editing && (
        <EditDialog
          cliente={editing}
          onClose={() => setEditing(null)}
          onSave={async (body) => {
            const ok = await patch(editing.id, body);
            if (ok) {
              toast("Cliente actualizado", "success");
              setEditing(null);
            }
          }}
        />
      )}
    </div>
  );
}

function EstatusBadge({ estatus, className }: { estatus: Estatus; className?: string }) {
  return (
    <span className={cn("inline-block rounded-full border px-2.5 py-1 text-xs font-semibold", ESTATUS_STYLE[estatus], className)}>
      {ESTATUS_LABEL[estatus]}
    </span>
  );
}

function SaludSelect({ cliente, onChange }: { cliente: Cliente; onChange: (c: Cliente, s: Salud) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className={cn("h-2.5 w-2.5 flex-shrink-0 rounded-full", SALUD_DOT[cliente.salud])} aria-hidden />
      <Select
        aria-label={`Salud de ${cliente.nombre}`}
        value={cliente.salud}
        onChange={(e) => onChange(cliente, e.target.value as Salud)}
        className="w-auto text-xs"
      >
        {SALUD_OPTS.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>
    </div>
  );
}

// ─── Shared form fields ─────────────────────────────────────────────

function ClienteFields({
  form,
  setForm,
  errors,
  showSalud,
}: {
  form: FormState;
  setForm: (fn: (f: FormState) => FormState) => void;
  errors: Record<string, string>;
  showSalud: boolean;
}) {
  return (
    <div className="space-y-4">
      <Field label="Nombre" error={errors.nombre}>
        <Input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} autoFocus />
      </Field>
      <Field label="Contacto" optional>
        <Input value={form.contacto} onChange={(e) => setForm((f) => ({ ...f, contacto: e.target.value }))} />
      </Field>
      <Field label="Monto mensual" optional error={errors.montoMensual}>
        <MoneyInput
          value={form.montoMensual}
          placeholder="0.00"
          onChange={(e) => setForm((f) => ({ ...f, montoMensual: e.target.value }))}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Día de pago" optional hint="1 a 31" error={errors.diaDePago}>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={form.diaDePago}
            onChange={(e) => setForm((f) => ({ ...f, diaDePago: e.target.value }))}
          />
        </Field>
        <Field label="Día de reporte" optional hint="1 a 31" error={errors.diaReporte}>
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={form.diaReporte}
            onChange={(e) => setForm((f) => ({ ...f, diaReporte: e.target.value }))}
          />
        </Field>
      </div>
      <div className={cn("grid gap-3", showSalud ? "grid-cols-2" : "grid-cols-1")}>
        <Field label="Estatus">
          <Select value={form.estatus} onChange={(e) => setForm((f) => ({ ...f, estatus: e.target.value as Estatus }))}>
            {ESTATUS_OPTS.map((e) => (
              <option key={e} value={e}>
                {ESTATUS_LABEL[e]}
              </option>
            ))}
          </Select>
        </Field>
        {showSalud && (
          <Field label="Salud">
            <Select value={form.salud} onChange={(e) => setForm((f) => ({ ...f, salud: e.target.value as Salud }))}>
              {SALUD_OPTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <Field label="Notas" optional>
        <Textarea rows={3} value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} />
      </Field>
    </div>
  );
}

function CreateDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.nombre.trim()) e.nombre = "El nombre es obligatorio";
    if (form.montoMensual !== "") {
      const n = Number(form.montoMensual);
      if (!Number.isFinite(n) || n < 0) e.montoMensual = "Monto inválido (>= 0)";
    }
    if (form.diaDePago !== "") {
      const d = Number(form.diaDePago);
      if (!Number.isInteger(d) || d < 1 || d > 31) e.diaDePago = "Día 1 a 31";
    }
    if (form.diaReporte !== "") {
      const d = Number(form.diaReporte);
      if (!Number.isInteger(d) || d < 1 || d > 31) e.diaReporte = "Día 1 a 31";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const add = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await apiSend("/api/clientes", "POST", {
        nombre: form.nombre,
        contacto: form.contacto || null,
        montoMensual: Number(form.montoMensual) || 0,
        diaDePago: form.diaDePago === "" ? null : Number(form.diaDePago),
        diaReporte: form.diaReporte === "" ? null : Number(form.diaReporte),
        estatus: form.estatus,
        salud: form.salud,
        notas: form.notas || null,
      });
      onCreated();
    } catch (e) {
      toast(errMsg(e, "No se pudo guardar"), "error");
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Alta de cliente"
        description="Registra un cliente nuevo en la cartera."
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={add} loading={saving}>
              Dar de alta
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <ClienteFields form={form} setForm={setForm} errors={errors} showSalud />
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  cliente,
  onClose,
  onSave,
}: {
  cliente: Cliente;
  onClose: () => void;
  onSave: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState<FormState>({
    nombre: cliente.nombre,
    contacto: cliente.contacto ?? "",
    montoMensual: String(cliente.montoMensual),
    diaDePago: cliente.diaDePago != null ? String(cliente.diaDePago) : "",
    diaReporte: cliente.diaReporte != null ? String(cliente.diaReporte) : "",
    estatus: cliente.estatus,
    salud: cliente.salud,
    notas: cliente.notas ?? "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.nombre.trim()) {
      setErrors({ nombre: "El nombre es obligatorio" });
      return;
    }
    setErrors({});
    setSaving(true);
    await onSave({
      nombre: form.nombre.trim(),
      contacto: form.contacto.trim() || null,
      montoMensual: Number(form.montoMensual) || 0,
      diaDePago: form.diaDePago === "" ? null : Number(form.diaDePago),
      diaReporte: form.diaReporte === "" ? null : Number(form.diaReporte),
      estatus: form.estatus,
      notas: form.notas.trim() || null,
    });
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Editar cliente"
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving}>
              Guardar
            </Button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <ClienteFields form={form} setForm={setForm} errors={errors} showSalud={false} />
          <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
        </form>
      </DialogContent>
    </Dialog>
  );
}
