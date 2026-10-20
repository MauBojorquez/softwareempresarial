"use client";

import { useState, useCallback } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Plus, KanbanSquare, X, Check, Trash2, StickyNote, Upload, Pencil, Users } from "lucide-react";
import { formatCurrency, cn } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { ImportLeadsModal } from "@/components/crm/import-leads-modal";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea, MoneyInput } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, Skeleton, RowsSkeleton } from "@/components/ui/states";
import { useConfirm } from "@/components/ui/confirm";
import { useApi, apiSend } from "@/hooks/use-api";

type ToastFn = (m: string, t?: "success" | "error" | "info") => void;

// ─── Types ──────────────────────────────────────────────────────────

type Origen = "META" | "ORGANICO" | "OUTBOUND" | "REFERIDO" | "RED_DIRECTA";
type Etapa =
  | "NUEVO"
  | "CONTACTADO"
  | "SESION_AGENDADA"
  | "DIAGNOSTICO_VENDIDO"
  | "PROPUESTA_ENVIADA"
  | "CERRADO_GANADO"
  | "CERRADO_PERDIDO";
type Tipo = "RECURRENTE" | "UNICA";

interface Lead {
  id: string;
  nombre: string;
  empresa?: string | null;
  contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  campana?: string | null;
  participantes?: string | null;
  puesto?: string | null;
  urgencia?: string | null;
  origen: Origen;
  etapa: Etapa;
  valorEstimado?: number | null;
  valorMensualEstimado?: number | null;
  motivoPerdida?: string | null;
  diagnosticoVentaGenerada: boolean;
  fechaUltimoMovimiento: string;
  createdAt: string;
  duenoId: string;
  duenoNombre?: string | null;
  notasCount: number;
  ventasCount: number;
}

interface Member {
  id: string;
  name: string | null;
}

interface Nota {
  id: string;
  contenido: string;
  createdAt: string;
  autorId?: string | null;
  autorNombre?: string | null;
}

const ETAPAS: Etapa[] = [
  "NUEVO",
  "CONTACTADO",
  "SESION_AGENDADA",
  "DIAGNOSTICO_VENDIDO",
  "PROPUESTA_ENVIADA",
  "CERRADO_GANADO",
  "CERRADO_PERDIDO",
];

const ETAPA_LABEL: Record<Etapa, string> = {
  NUEVO: "Nuevo",
  CONTACTADO: "Contactado",
  SESION_AGENDADA: "Sesión agendada",
  DIAGNOSTICO_VENDIDO: "Diagnóstico vendido",
  PROPUESTA_ENVIADA: "Propuesta enviada",
  CERRADO_GANADO: "Cerrado ganado",
  CERRADO_PERDIDO: "Cerrado perdido",
};

const ETAPA_ACCENT: Record<Etapa, string> = {
  NUEVO: "text-muted-foreground",
  CONTACTADO: "text-info",
  SESION_AGENDADA: "text-info",
  DIAGNOSTICO_VENDIDO: "text-primary",
  PROPUESTA_ENVIADA: "text-warning",
  CERRADO_GANADO: "text-success",
  CERRADO_PERDIDO: "text-destructive",
};

const ORIGENES: Origen[] = ["META", "ORGANICO", "OUTBOUND", "REFERIDO", "RED_DIRECTA"];

const ORIGEN_LABEL: Record<Origen, string> = {
  META: "Meta",
  ORGANICO: "Orgánico",
  OUTBOUND: "Outbound",
  REFERIDO: "Referido",
  RED_DIRECTA: "Red directa",
};

const ORIGEN_STYLE: Record<Origen, string> = {
  META: "bg-info/10 text-info",
  ORGANICO: "bg-success/10 text-success",
  OUTBOUND: "bg-warning/10 text-warning",
  REFERIDO: "bg-primary/10 text-primary",
  RED_DIRECTA: "bg-secondary text-foreground",
};

// Client-side mirror of the API validation. Empty is always valid (optional).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailInvalid(v: string) {
  const s = v.trim();
  if (!s) return false;
  return !EMAIL_RE.test(s.toLowerCase());
}

function phoneInvalid(v: string) {
  const s = v.trim();
  if (!s) return false;
  const hasPlus = s.startsWith("+");
  const stripped = s.replace(/[\s\-()]/g, "");
  const digits = hasPlus ? stripped.slice(1) : stripped;
  if (!/^\d+$/.test(digits)) return true;
  const valid = digits.length === 10 || (hasPlus && digits.length >= 11 && digits.length <= 15);
  return !valid;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

interface LeadsResponse {
  leads: Lead[];
  members: Member[];
}

export default function CrmPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { data, setData, error, initialLoading, reload } = useApi<LeadsResponse>("/api/leads");
  const leads = data?.leads ?? [];
  const members = data?.members ?? [];

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Etapa | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [showImport, setShowImport] = useState(false);
  // The panel always reads the latest copy of the lead from `leads`.
  const [detailId, setDetailId] = useState<string | null>(null);
  const detail = detailId ? leads.find((l) => l.id === detailId) ?? null : null;

  // Modal that must collect data before a move can complete.
  const [ganadoModal, setGanadoModal] = useState<Lead | null>(null);
  const [perdidoModal, setPerdidoModal] = useState<Lead | null>(null);

  const setLeadEtapa = useCallback(
    (id: string, etapa: Etapa) =>
      setData((cur) => (cur ? { ...cur, leads: cur.leads.map((l) => (l.id === id ? { ...l, etapa } : l)) } : cur)),
    [setData],
  );

  // Core stage transition. `extra` carries the modal-collected data when needed.
  // Without modal data the move is optimistic: the card jumps right away and
  // goes back to its column if the server rejects it.
  const move = useCallback(
    async (lead: Lead, etapa: Etapa, extra?: Record<string, unknown>): Promise<boolean> => {
      const optimistic = !extra;
      if (optimistic) setLeadEtapa(lead.id, etapa);
      try {
        const res = await apiSend<{ venta?: unknown }>(`/api/leads/${lead.id}/move`, "POST", { etapa, ...extra });
        if (etapa === "DIAGNOSTICO_VENDIDO" && res?.venta) {
          toast("Se generó una venta de diagnóstico ($9,997)", "success");
        } else if (etapa === "CERRADO_GANADO") {
          toast("Lead cerrado como ganado", "success");
        } else if (etapa === "CERRADO_PERDIDO") {
          toast("Lead marcado como perdido", "info");
        }
        await reload();
        return true;
      } catch (e) {
        if (optimistic) setLeadEtapa(lead.id, lead.etapa);
        toast(e instanceof Error ? e.message : "No se pudo mover el lead", "error");
        return false;
      }
    },
    [toast, reload, setLeadEtapa],
  );

  // Route a stage change through the right modal, else move directly.
  // Shared by drag-and-drop and the "Cambiar etapa" control in the detail panel.
  const requestStage = useCallback(
    (lead: Lead, etapa: Etapa) => {
      if (lead.etapa === etapa) return;
      if (etapa === "CERRADO_GANADO") {
        setGanadoModal(lead);
        return;
      }
      if (etapa === "CERRADO_PERDIDO") {
        setPerdidoModal(lead);
        return;
      }
      move(lead, etapa);
    },
    [move],
  );

  const handleDrop = (etapa: Etapa) => {
    setDragOver(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const lead = leads.find((l) => l.id === id);
    if (!lead) return;
    requestStage(lead, etapa);
  };

  const removeLead = async (lead: Lead) => {
    const ok = await confirm({
      title: `¿Eliminar el lead ${lead.nombre}?`,
      description: "Se eliminarán también sus notas. Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiSend(`/api/leads/${lead.id}`, "DELETE");
      setDetailId(null);
      toast("Lead eliminado", "success");
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo eliminar", "error");
    }
  };

  const byEtapa = (e: Etapa) => leads.filter((l) => l.etapa === e);

  const actions = (
    <>
      <Button variant="outline" onClick={() => setShowImport(true)}>
        <Upload /> Importar CSV
      </Button>
      <Button onClick={() => setShowNew(true)}>
        <Plus /> Nuevo lead
      </Button>
    </>
  );

  let body: React.ReactNode;
  if (initialLoading) {
    body = <KanbanSkeleton />;
  } else if (error && !data) {
    body = (
      <div className="rounded-xl border border-border bg-card">
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  } else if (leads.length === 0) {
    body = (
      <div className="rounded-xl border border-border bg-card">
        <EmptyState
          icon={Users}
          title="Aún no hay leads"
          description="Crea tu primer lead o importa tus contactos desde un CSV."
          action={
            <Button onClick={() => setShowNew(true)}>
              <Plus /> Nuevo lead
            </Button>
          }
        />
      </div>
    );
  } else {
    body = (
      <div className="pb-4 sm:overflow-x-auto">
        <p id="crm-card-hint" className="sr-only">
          Presiona Enter para abrir el detalle del lead y cambiar su etapa.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-3">
          {ETAPAS.map((etapa) => {
            const cards = byEtapa(etapa);
            const total = cards.reduce((s, c) => s + (c.valorEstimado ?? 0), 0);
            const isTarget = dragOver === etapa && dragId !== null;
            return (
              <section
                key={etapa}
                aria-label={`${ETAPA_LABEL[etapa]}: ${cards.length} leads`}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOver !== etapa) setDragOver(etapa);
                }}
                onDragLeave={(e) => {
                  // Ignore leave events fired when moving over the column's own children.
                  if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
                  setDragOver((cur) => (cur === etapa ? null : cur));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(etapa);
                }}
                className={cn(
                  "flex w-full flex-col rounded-xl border bg-secondary/40 transition-[box-shadow,border-color] sm:w-72 sm:flex-shrink-0",
                  isTarget ? "border-primary ring-2 ring-primary" : "border-border",
                )}
              >
                <div className="border-b border-border px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <h2 className={cn("text-sm font-semibold", ETAPA_ACCENT[etapa])}>{ETAPA_LABEL[etapa]}</h2>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {cards.length}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatCurrency(total)}</p>
                </div>
                <div className="flex-1 space-y-2 p-2">
                  {cards.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      {isTarget ? "Suelta aquí" : "Sin leads"}
                    </p>
                  ) : (
                    cards.map((lead) => (
                      <button
                        key={lead.id}
                        type="button"
                        draggable
                        aria-describedby="crm-card-hint"
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", lead.id);
                          setDragId(lead.id);
                        }}
                        onDragEnd={() => {
                          setDragId(null);
                          setDragOver(null);
                        }}
                        onClick={() => setDetailId(lead.id)}
                        className={cn(
                          "block w-full cursor-grab rounded-xl border border-border bg-card p-3 text-left shadow-sm transition-[box-shadow,opacity,transform] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
                          dragId === lead.id && "scale-[0.98] opacity-40 shadow-lg",
                        )}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <span className="text-sm font-semibold leading-tight">{lead.nombre}</span>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                              ORIGEN_STYLE[lead.origen],
                            )}
                          >
                            {ORIGEN_LABEL[lead.origen]}
                          </span>
                        </span>
                        {lead.empresa && (
                          <span className="mt-0.5 block text-xs text-muted-foreground">{lead.empresa}</span>
                        )}
                        <span className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            {lead.valorEstimado != null ? formatCurrency(lead.valorEstimado) : "—"}
                          </span>
                          <span className="flex items-center gap-2">
                            {lead.ventasCount > 0 && <span>{lead.ventasCount} venta(s)</span>}
                            {lead.notasCount > 0 && (
                              <span className="flex items-center gap-0.5">
                                <StickyNote className="h-3 w-3" aria-hidden />
                                <span className="sr-only">Notas:</span>
                                {lead.notasCount}
                              </span>
                            )}
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={KanbanSquare}
        title="CRM · Pipeline"
        description="Arrastra los leads entre etapas o abre uno para cambiar su etapa."
        actions={actions}
      />

      {body}

      {showNew && (
        <NewLeadModal
          members={members}
          onClose={() => setShowNew(false)}
          onSaved={async () => {
            setShowNew(false);
            await reload();
          }}
          toast={toast}
        />
      )}

      {showImport && (
        <ImportLeadsModal
          members={members}
          onClose={() => setShowImport(false)}
          onDone={async () => {
            setShowImport(false);
            await reload();
          }}
          toast={toast}
        />
      )}

      {ganadoModal && (
        <GanadoModal
          lead={ganadoModal}
          onClose={() => setGanadoModal(null)}
          onConfirm={async (payload) => {
            const ok = await move(ganadoModal, "CERRADO_GANADO", payload);
            if (ok) setGanadoModal(null);
          }}
        />
      )}

      {perdidoModal && (
        <PerdidoModal
          lead={perdidoModal}
          onClose={() => setPerdidoModal(null)}
          onConfirm={async (motivo) => {
            const ok = await move(perdidoModal, "CERRADO_PERDIDO", { motivo });
            if (ok) setPerdidoModal(null);
          }}
        />
      )}

      <DialogPrimitive.Root open={!!detail} onOpenChange={(o) => !o && setDetailId(null)}>
        {detail && (
          <DetailPanel
            key={detail.id}
            lead={detail}
            members={members}
            onRemove={() => removeLead(detail)}
            onSaved={reload}
            onChangeStage={(etapa) => requestStage(detail, etapa)}
            toast={toast}
          />
        )}
      </DialogPrimitive.Root>
    </div>
  );
}

// ─── Loading skeleton shaped like the board ─────────────────────────

function KanbanSkeleton() {
  return (
    <div className="pb-4 sm:overflow-hidden" aria-busy="true" aria-label="Cargando pipeline">
      <div className="flex flex-col gap-4 sm:flex-row sm:gap-3">
        {ETAPAS.slice(0, 5).map((e, i) => (
          <div
            key={e}
            className={cn(
              "w-full space-y-2 rounded-xl border border-border bg-secondary/40 p-2 sm:w-72 sm:flex-shrink-0",
              i > 1 && "hidden sm:block",
            )}
          >
            <div className="space-y-1.5 px-1 py-1.5">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-16" />
            </div>
            {Array.from({ length: 3 - (i % 2) }).map((_, j) => (
              <div key={j} className="space-y-2 rounded-xl border border-border bg-card p-3">
                <div className="flex justify-between gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-12 rounded-full" />
                </div>
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── New lead modal ─────────────────────────────────────────────────

function NewLeadModal({
  members,
  onClose,
  onSaved,
  toast,
}: {
  members: Member[];
  onClose: () => void;
  onSaved: () => void;
  toast: ToastFn;
}) {
  const [nombre, setNombre] = useState("");
  const [origen, setOrigen] = useState<"" | Origen>("");
  const [empresa, setEmpresa] = useState("");
  const [contacto, setContacto] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [valorEstimado, setValorEstimado] = useState("");
  const [valorMensualEstimado, setValorMensualEstimado] = useState("");
  const [duenoId, setDuenoId] = useState("");
  const [saving, setSaving] = useState(false);
  const [tried, setTried] = useState(false);

  const telError = phoneInvalid(telefono);
  const emailError = emailInvalid(email);

  const save = async () => {
    setTried(true);
    if (!nombre.trim()) {
      toast("El nombre es obligatorio", "error");
      return;
    }
    if (!origen) {
      toast("Selecciona el origen", "error");
      return;
    }
    if (telError || emailError) {
      toast("Revisa el teléfono o el correo", "error");
      return;
    }
    setSaving(true);
    try {
      await apiSend("/api/leads", "POST", {
        nombre: nombre.trim(),
        origen,
        empresa: empresa || null,
        contacto: contacto || null,
        telefono: telefono || null,
        email: email || null,
        valorEstimado: valorEstimado || null,
        valorMensualEstimado: valorMensualEstimado || null,
        duenoId: duenoId || null,
      });
      toast("Lead creado", "success");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo crear el lead", "error");
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        title="Nuevo lead"
        footer={
          <>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving}>
              {!saving && <Check />} Crear lead
            </Button>
          </>
        }
      >
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <Field label="Nombre" error={tried && !nombre.trim() ? "El nombre es obligatorio" : null}>
            <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
          </Field>
          <Field label="Origen" error={tried && !origen ? "Selecciona el origen" : null}>
            <Select value={origen} onChange={(e) => setOrigen(e.target.value as "" | Origen)}>
              <option value="">Selecciona…</option>
              {ORIGENES.map((o) => (
                <option key={o} value={o}>
                  {ORIGEN_LABEL[o]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Empresa" optional>
              <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
            </Field>
            <Field label="Contacto" optional>
              <Input value={contacto} onChange={(e) => setContacto(e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Teléfono"
              optional
              error={telError ? "Teléfono inválido (incluye la lada, ej. 55 1234 5678)" : null}
            >
              <Input type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
            </Field>
            <Field label="Correo" optional error={emailError ? "Correo inválido" : null}>
              <Input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Valor estimado" optional>
              <MoneyInput value={valorEstimado} onChange={(e) => setValorEstimado(e.target.value)} />
            </Field>
            <Field label="Valor mensual estimado" optional>
              <MoneyInput value={valorMensualEstimado} onChange={(e) => setValorMensualEstimado(e.target.value)} />
            </Field>
          </div>
          <Field label="Dueño" optional>
            <Select value={duenoId} onChange={(e) => setDuenoId(e.target.value)}>
              <option value="">Yo (por defecto)</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Cerrado ganado modal ───────────────────────────────────────────

function GanadoModal({
  lead,
  onClose,
  onConfirm,
}: {
  lead: Lead;
  onClose: () => void;
  onConfirm: (payload: { monto: number; tipo: Tipo; fechaCobroEsperada: string }) => Promise<void>;
}) {
  const [monto, setMonto] = useState(lead.valorEstimado != null ? String(lead.valorEstimado) : "");
  const [tipo, setTipo] = useState<"" | Tipo>("");
  const [fechaCobroEsperada, setFecha] = useState(today());
  const [errors, setErrors] = useState<{ monto?: string; tipo?: string; fecha?: string }>({});
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const m = Number(monto);
    const next: typeof errors = {};
    if (!Number.isFinite(m) || m <= 0) next.monto = "El monto debe ser mayor a 0";
    if (!tipo) next.tipo = "Selecciona el tipo";
    if (!fechaCobroEsperada) next.fecha = "Selecciona la fecha de cobro esperada";
    setErrors(next);
    if (Object.keys(next).length > 0 || !tipo) return;
    setSaving(true);
    try {
      await onConfirm({ monto: m, tipo, fechaCobroEsperada });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent
        title={`Cerrar ganado · ${lead.nombre}`}
        description="Registra los datos de la venta ganada."
        footer={
          <>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} loading={saving}>
              {!saving && <Check />} Cerrar ganado
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Monto" error={errors.monto}>
            <MoneyInput value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus />
          </Field>
          <Field label="Tipo" error={errors.tipo}>
            <Select value={tipo} onChange={(e) => setTipo(e.target.value as "" | Tipo)}>
              <option value="">Selecciona…</option>
              <option value="RECURRENTE">Recurrente</option>
              <option value="UNICA">Única</option>
            </Select>
          </Field>
          <Field label="Fecha de cobro esperada" error={errors.fecha}>
            <Input type="date" value={fechaCobroEsperada} onChange={(e) => setFecha(e.target.value)} />
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Cerrado perdido modal ──────────────────────────────────────────

function PerdidoModal({
  lead,
  onClose,
  onConfirm,
}: {
  lead: Lead;
  onClose: () => void;
  onConfirm: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!motivo.trim()) {
      setError("El motivo es obligatorio");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onConfirm(motivo.trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent
        title={`Marcar perdido · ${lead.nombre}`}
        footer={
          <>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={submit} loading={saving}>
              Marcar perdido
            </Button>
          </>
        }
      >
        <Field label="Motivo de pérdida" error={error}>
          <Textarea rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
        </Field>
      </DialogContent>
    </Dialog>
  );
}

// ─── Detail panel (fields + notas) ──────────────────────────────────
// Side sheet built on Radix Dialog: focus trap, Escape to close, focus returns
// to the card that opened it.

function DetailPanel({
  lead,
  members,
  onRemove,
  onSaved,
  onChangeStage,
  toast,
}: {
  lead: Lead;
  members: Member[];
  onRemove: () => void;
  onSaved: () => void;
  onChangeStage: (etapa: Etapa) => void;
  toast: ToastFn;
}) {
  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState(lead.nombre);
  const [empresa, setEmpresa] = useState(lead.empresa ?? "");
  const [contacto, setContacto] = useState(lead.contacto ?? "");
  const [telefono, setTelefono] = useState(lead.telefono ?? "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [origen, setOrigen] = useState<Origen>(lead.origen);
  const [duenoId, setDuenoId] = useState(lead.duenoId);
  const [valorEstimado, setValorEstimado] = useState(lead.valorEstimado != null ? String(lead.valorEstimado) : "");
  const [valorMensualEstimado, setValorMensual] = useState(
    lead.valorMensualEstimado != null ? String(lead.valorMensualEstimado) : "",
  );
  const [saving, setSaving] = useState(false);

  const {
    data: notasData,
    setData: setNotasData,
    error: notasError,
    initialLoading: loadingNotas,
    reload: reloadNotas,
  } = useApi<{ notas: Nota[] }>(`/api/leads/${lead.id}/notas`);
  const notas = notasData?.notas ?? [];
  const [nuevaNota, setNuevaNota] = useState("");
  const [addingNota, setAddingNota] = useState(false);

  const telError = phoneInvalid(telefono);
  const emailError = emailInvalid(email);

  const startEdit = () => {
    setNombre(lead.nombre);
    setEmpresa(lead.empresa ?? "");
    setContacto(lead.contacto ?? "");
    setTelefono(lead.telefono ?? "");
    setEmail(lead.email ?? "");
    setOrigen(lead.origen);
    setDuenoId(lead.duenoId);
    setValorEstimado(lead.valorEstimado != null ? String(lead.valorEstimado) : "");
    setValorMensual(lead.valorMensualEstimado != null ? String(lead.valorMensualEstimado) : "");
    setEditing(true);
  };

  const saveFields = async () => {
    if (!nombre.trim()) {
      toast("El nombre es obligatorio", "error");
      return;
    }
    if (telError || emailError) {
      toast("Revisa el teléfono o el correo", "error");
      return;
    }
    setSaving(true);
    try {
      await apiSend(`/api/leads/${lead.id}`, "PATCH", {
        nombre: nombre.trim(),
        empresa: empresa || null,
        contacto: contacto || null,
        telefono: telefono || null,
        email: email || null,
        origen,
        duenoId,
        valorEstimado: valorEstimado || null,
        valorMensualEstimado: valorMensualEstimado || null,
      });
      toast("Lead actualizado", "success");
      setEditing(false);
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo actualizar", "error");
    }
    setSaving(false);
  };

  const addNota = async () => {
    if (!nuevaNota.trim()) return;
    setAddingNota(true);
    try {
      const data = await apiSend<{ nota: Nota }>(`/api/leads/${lead.id}/notas`, "POST", {
        contenido: nuevaNota.trim(),
      });
      setNotasData((cur) => ({ notas: [data.nota, ...(cur?.notas ?? [])] }));
      setNuevaNota("");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo agregar la nota", "error");
    }
    setAddingNota(false);
  };

  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <DialogPrimitive.Content className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-card text-card-foreground shadow-2xl outline-none duration-200 data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right">
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-base font-semibold">Detalle del lead</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Datos, etapa y notas de {lead.nombre}
            </DialogPrimitive.Description>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={onRemove}
              aria-label="Eliminar lead"
              title="Eliminar lead"
              className="hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 />
            </Button>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Cerrar">
                <X />
              </Button>
            </DialogPrimitive.Close>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {/* Fields */}
          {editing ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                saveFields();
              }}
            >
              <Field label="Nombre" error={!nombre.trim() ? "El nombre es obligatorio" : null}>
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Empresa" optional>
                  <Input value={empresa} onChange={(e) => setEmpresa(e.target.value)} />
                </Field>
                <Field label="Contacto" optional>
                  <Input value={contacto} onChange={(e) => setContacto(e.target.value)} />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Teléfono" optional error={telError ? "Teléfono inválido (incluye la lada)" : null}>
                  <Input type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
                </Field>
                <Field label="Correo" optional error={emailError ? "Correo inválido" : null}>
                  <Input type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </Field>
              </div>
              <Field label="Origen">
                <Select value={origen} onChange={(e) => setOrigen(e.target.value as Origen)}>
                  {ORIGENES.map((o) => (
                    <option key={o} value={o}>
                      {ORIGEN_LABEL[o]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Dueño">
                <Select value={duenoId} onChange={(e) => setDuenoId(e.target.value)}>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Valor estimado" optional>
                  <MoneyInput value={valorEstimado} onChange={(e) => setValorEstimado(e.target.value)} />
                </Field>
                <Field label="Valor mensual" optional>
                  <MoneyInput value={valorMensualEstimado} onChange={(e) => setValorMensual(e.target.value)} />
                </Field>
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="flex-1" loading={saving}>
                  {!saving && <Check />} Guardar
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold">{lead.nombre}</p>
                  {lead.empresa && <p className="text-sm text-muted-foreground">{lead.empresa}</p>}
                </div>
                <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", ORIGEN_STYLE[lead.origen])}>
                  {ORIGEN_LABEL[lead.origen]}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <InfoItem label="Etapa" value={ETAPA_LABEL[lead.etapa]} />
                <InfoItem label="Contacto" value={lead.contacto || "—"} />
                {lead.participantes && <InfoItem label="Participantes" value={lead.participantes} />}
                {lead.puesto && <InfoItem label="Puesto" value={lead.puesto} />}
                {lead.urgencia && <InfoItem label="Urgencia" value={lead.urgencia} />}
                {lead.campana && <InfoItem label="Campaña" value={lead.campana} />}
                <InfoItem
                  label="Valor estimado"
                  value={lead.valorEstimado != null ? formatCurrency(lead.valorEstimado) : "—"}
                />
                <InfoItem
                  label="Valor mensual"
                  value={lead.valorMensualEstimado != null ? formatCurrency(lead.valorMensualEstimado) : "—"}
                />
                <InfoItem label="Dueño" value={lead.duenoNombre || "—"} />
                <InfoItem label="Ventas generadas" value={String(lead.ventasCount)} />
                <InfoItem label="Último movimiento" value={fmtDate(lead.fechaUltimoMovimiento)} />
                <InfoItem label="Creado" value={fmtDate(lead.createdAt)} />
              </dl>
              {(lead.telefono || lead.email) && (
                <div className="flex flex-col gap-1 pt-1 text-sm">
                  {lead.telefono && (
                    <a href={`tel:${lead.telefono}`} className="text-primary hover:underline">
                      {lead.telefono}
                    </a>
                  )}
                  {lead.email && (
                    <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                      {lead.email}
                    </a>
                  )}
                </div>
              )}
              {lead.etapa === "CERRADO_PERDIDO" && lead.motivoPerdida && (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-2 text-xs text-destructive">
                  Motivo de pérdida: {lead.motivoPerdida}
                </p>
              )}

              {/* Cambiar etapa: same flow as drag-and-drop (modals for ganado/perdido). */}
              <div role="group" aria-labelledby="crm-cambiar-etapa" className="border-t border-border pt-3">
                <p id="crm-cambiar-etapa" className="mb-2 text-xs font-medium text-muted-foreground">
                  Cambiar etapa
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ETAPAS.map((e) => {
                    const active = e === lead.etapa;
                    return (
                      <Button
                        key={e}
                        size="sm"
                        variant={active ? "secondary" : "outline"}
                        aria-pressed={active}
                        aria-current={active ? "step" : undefined}
                        disabled={active}
                        onClick={() => onChangeStage(e)}
                        className={cn(
                          "h-9",
                          active && "border border-primary bg-primary/10 text-primary disabled:opacity-100",
                        )}
                      >
                        {ETAPA_LABEL[e]}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <Button variant="outline" size="sm" className="h-9" onClick={startEdit}>
                <Pencil /> Editar campos
              </Button>
            </div>
          )}

          {/* Notas */}
          <div className="border-t border-border pt-4">
            <h3 className="mb-2 text-sm font-semibold">Notas</h3>
            <div className="flex items-end gap-2">
              <Field label="Nueva nota" className="flex-1">
                <Textarea
                  rows={2}
                  className="min-h-[64px]"
                  value={nuevaNota}
                  onChange={(e) => setNuevaNota(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      addNota();
                    }
                  }}
                />
              </Field>
              <Button
                size="icon"
                onClick={addNota}
                loading={addingNota}
                disabled={!nuevaNota.trim()}
                aria-label="Agregar nota"
                title="Agregar nota"
              >
                {!addingNota && <Plus />}
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              {loadingNotas ? (
                <RowsSkeleton rows={2} className="rounded-lg border border-border" />
              ) : notasError && !notasData ? (
                <ErrorState message={notasError} onRetry={reloadNotas} className="py-6" />
              ) : notas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin notas todavía.</p>
              ) : (
                notas.map((n) => (
                  <div key={n.id} className="rounded-lg border border-border bg-secondary/40 p-2.5">
                    <p className="whitespace-pre-wrap text-sm">{n.contenido}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {n.autorNombre || "—"} · {fmtDate(n.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
