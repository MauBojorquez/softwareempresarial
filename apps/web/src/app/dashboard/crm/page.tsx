"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Loader2, KanbanSquare, X, Check, Trash2, StickyNote } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/toast";

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
  NUEVO: "text-slate-500",
  CONTACTADO: "text-blue-500",
  SESION_AGENDADA: "text-indigo-500",
  DIAGNOSTICO_VENDIDO: "text-violet-500",
  PROPUESTA_ENVIADA: "text-amber-500",
  CERRADO_GANADO: "text-emerald-500",
  CERRADO_PERDIDO: "text-red-500",
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
  META: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  ORGANICO: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  OUTBOUND: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  REFERIDO: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  RED_DIRECTA: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export default function CrmPage() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Etapa | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [detail, setDetail] = useState<Lead | null>(null);

  // Modal that must collect data before a move can complete.
  const [ganadoModal, setGanadoModal] = useState<Lead | null>(null);
  const [perdidoModal, setPerdidoModal] = useState<Lead | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/leads");
      const data = await res.json();
      setLeads(data.leads ?? []);
      setMembers(data.members ?? []);
    } catch {
      /* noop */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Core stage transition. `extra` carries the modal-collected data when needed.
  const move = useCallback(
    async (lead: Lead, etapa: Etapa, extra?: Record<string, unknown>) => {
      try {
        const res = await fetch(`/api/leads/${lead.id}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ etapa, ...extra }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast(data.error || "No se pudo mover el lead", "error");
          return false;
        }
        if (etapa === "DIAGNOSTICO_VENDIDO" && data.venta) {
          toast("Se generó una venta de diagnóstico ($9,997)", "success");
        } else if (etapa === "CERRADO_GANADO") {
          toast("Lead cerrado como ganado", "success");
        } else if (etapa === "CERRADO_PERDIDO") {
          toast("Lead marcado como perdido", "info");
        }
        await load();
        return true;
      } catch {
        toast("No se pudo mover el lead", "error");
        return false;
      }
    },
    [toast, load],
  );

  const handleDrop = (etapa: Etapa) => {
    setDragOver(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.etapa === etapa) return;

    if (etapa === "CERRADO_GANADO") {
      setGanadoModal(lead);
      return;
    }
    if (etapa === "CERRADO_PERDIDO") {
      setPerdidoModal(lead);
      return;
    }
    move(lead, etapa);
  };

  const removeLead = async (lead: Lead) => {
    if (!confirm(`¿Eliminar el lead ${lead.nombre}?`)) return;
    try {
      const res = await fetch(`/api/leads/${lead.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setDetail(null);
      toast("Lead eliminado", "success");
      await load();
    } catch {
      toast("No se pudo eliminar", "error");
    }
  };

  const byEtapa = (e: Etapa) => leads.filter((l) => l.etapa === e);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2">
            <KanbanSquare className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">CRM · Pipeline</h1>
            <p className="text-sm text-muted-foreground">Arrastra los leads entre etapas para avanzarlos.</p>
          </div>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 rounded-lg gradient-bg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nuevo lead
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="pb-4 sm:overflow-x-auto">
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-3">
            {ETAPAS.map((etapa) => {
              const cards = byEtapa(etapa);
              const total = cards.reduce((s, c) => s + (c.valorEstimado ?? 0), 0);
              return (
                <div
                  key={etapa}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(etapa);
                  }}
                  onDragLeave={() => setDragOver((cur) => (cur === etapa ? null : cur))}
                  onDrop={() => handleDrop(etapa)}
                  className={
                    "flex w-full flex-col rounded-2xl border bg-secondary/30 sm:w-72 sm:flex-shrink-0 " +
                    (dragOver === etapa ? "border-primary" : "border-border")
                  }
                >
                  <div className="border-b border-border px-3 py-2.5">
                    <div className="flex items-center justify-between">
                      <span className={"text-sm font-semibold " + ETAPA_ACCENT[etapa]}>{ETAPA_LABEL[etapa]}</span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {cards.length}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{formatCurrency(total)}</p>
                  </div>
                  <div className="flex-1 space-y-2 p-2">
                    {cards.length === 0 ? (
                      <p className="py-6 text-center text-[11px] text-muted-foreground">Sin leads</p>
                    ) : (
                      cards.map((lead) => (
                        <div
                          key={lead.id}
                          draggable
                          onDragStart={() => setDragId(lead.id)}
                          onDragEnd={() => {
                            setDragId(null);
                            setDragOver(null);
                          }}
                          onClick={() => setDetail(lead)}
                          className="cursor-grab rounded-xl border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow active:cursor-grabbing"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-semibold leading-tight">{lead.nombre}</p>
                            <span
                              className={
                                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold " + ORIGEN_STYLE[lead.origen]
                              }
                            >
                              {ORIGEN_LABEL[lead.origen]}
                            </span>
                          </div>
                          {lead.empresa && <p className="mt-0.5 text-xs text-muted-foreground">{lead.empresa}</p>}
                          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                            <span className="font-medium text-foreground">
                              {lead.valorEstimado != null ? formatCurrency(lead.valorEstimado) : "—"}
                            </span>
                            <span className="flex items-center gap-2">
                              {lead.ventasCount > 0 && <span>{lead.ventasCount} venta(s)</span>}
                              {lead.notasCount > 0 && (
                                <span className="flex items-center gap-0.5">
                                  <StickyNote className="h-3 w-3" />
                                  {lead.notasCount}
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showNew && (
        <NewLeadModal
          members={members}
          onClose={() => setShowNew(false)}
          onSaved={async () => {
            setShowNew(false);
            await load();
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

      {detail && (
        <DetailPanel
          lead={detail}
          members={members}
          onClose={() => setDetail(null)}
          onRemove={() => removeLead(detail)}
          onSaved={load}
          toast={toast}
        />
      )}
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
  toast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [nombre, setNombre] = useState("");
  const [origen, setOrigen] = useState<"" | Origen>("");
  const [empresa, setEmpresa] = useState("");
  const [contacto, setContacto] = useState("");
  const [valorEstimado, setValorEstimado] = useState("");
  const [valorMensualEstimado, setValorMensualEstimado] = useState("");
  const [duenoId, setDuenoId] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!nombre.trim()) {
      toast("El nombre es obligatorio", "error");
      return;
    }
    if (!origen) {
      toast("Selecciona el origen", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          origen,
          empresa: empresa || null,
          contacto: contacto || null,
          valorEstimado: valorEstimado || null,
          valorMensualEstimado: valorMensualEstimado || null,
          duenoId: duenoId || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast("Lead creado", "success");
      onSaved();
    } catch {
      toast("No se pudo crear el lead", "error");
    }
    setSaving(false);
  };

  return (
    <Modal title="Nuevo lead" onClose={onClose}>
      <div className="space-y-3 p-6">
        <input
          className="min-h-[40px] w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
          placeholder="Nombre *"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <select
          className="min-h-[40px] w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
          value={origen}
          onChange={(e) => setOrigen(e.target.value as "" | Origen)}
        >
          <option value="">Origen *</option>
          {ORIGENES.map((o) => (
            <option key={o} value={o}>
              {ORIGEN_LABEL[o]}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-3">
          <input
            className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            placeholder="Empresa"
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
          />
          <input
            className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            placeholder="Contacto"
            value={contacto}
            onChange={(e) => setContacto(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="number"
            inputMode="numeric"
            className="min-h-[40px] w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            placeholder="Valor estimado"
            value={valorEstimado}
            onChange={(e) => setValorEstimado(e.target.value)}
          />
          <input
            type="number"
            inputMode="numeric"
            className="min-h-[40px] w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            placeholder="Valor mensual estimado"
            value={valorMensualEstimado}
            onChange={(e) => setValorMensualEstimado(e.target.value)}
          />
        </div>
        <select
          className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
          value={duenoId}
          onChange={(e) => setDuenoId(e.target.value)}
        >
          <option value="">Dueño (yo, por defecto)</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <ModalFooter onClose={onClose} onConfirm={save} saving={saving} confirmLabel="Crear lead" />
    </Modal>
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
  onConfirm: (payload: { monto: number; tipo: Tipo; fechaCobroEsperada: string }) => void;
}) {
  const [monto, setMonto] = useState(lead.valorEstimado != null ? String(lead.valorEstimado) : "");
  const [tipo, setTipo] = useState<"" | Tipo>("");
  const [fechaCobroEsperada, setFecha] = useState(today());
  const [error, setError] = useState("");

  const confirm = () => {
    const m = Number(monto);
    if (!Number.isFinite(m) || m <= 0) {
      setError("El monto debe ser mayor a 0");
      return;
    }
    if (!tipo) {
      setError("Selecciona el tipo");
      return;
    }
    if (!fechaCobroEsperada) {
      setError("Selecciona la fecha de cobro esperada");
      return;
    }
    onConfirm({ monto: m, tipo, fechaCobroEsperada });
  };

  return (
    <Modal title={`Cerrar ganado · ${lead.nombre}`} onClose={onClose}>
      <div className="space-y-3 p-6">
        <p className="text-xs text-muted-foreground">Registra los datos de la venta ganada.</p>
        <input
          type="number"
          inputMode="numeric"
          className="min-h-[40px] w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
          placeholder="Monto *"
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
        />
        <select
          className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
          value={tipo}
          onChange={(e) => setTipo(e.target.value as "" | Tipo)}
        >
          <option value="">Tipo *</option>
          <option value="RECURRENTE">Recurrente</option>
          <option value="UNICA">Única</option>
        </select>
        <label className="block text-xs text-muted-foreground">
          Fecha de cobro esperada *
          <input
            type="date"
            className="mt-1 w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
            value={fechaCobroEsperada}
            onChange={(e) => setFecha(e.target.value)}
          />
        </label>
        {error && <p className="text-[11px] text-red-500">{error}</p>}
      </div>
      <ModalFooter onClose={onClose} onConfirm={confirm} confirmLabel="Cerrar ganado" />
    </Modal>
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
  onConfirm: (motivo: string) => void;
}) {
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");

  const confirm = () => {
    if (!motivo.trim()) {
      setError("El motivo es obligatorio");
      return;
    }
    onConfirm(motivo.trim());
  };

  return (
    <Modal title={`Marcar perdido · ${lead.nombre}`} onClose={onClose}>
      <div className="space-y-3 p-6">
        <textarea
          className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
          placeholder="Motivo de pérdida *"
          rows={4}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
        />
        {error && <p className="text-[11px] text-red-500">{error}</p>}
      </div>
      <ModalFooter onClose={onClose} onConfirm={confirm} confirmLabel="Marcar perdido" />
    </Modal>
  );
}

// ─── Detail panel (fields + notas) ──────────────────────────────────

function DetailPanel({
  lead,
  members,
  onClose,
  onRemove,
  onSaved,
  toast,
}: {
  lead: Lead;
  members: Member[];
  onClose: () => void;
  onRemove: () => void;
  onSaved: () => void;
  toast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState(lead.nombre);
  const [empresa, setEmpresa] = useState(lead.empresa ?? "");
  const [contacto, setContacto] = useState(lead.contacto ?? "");
  const [origen, setOrigen] = useState<Origen>(lead.origen);
  const [duenoId, setDuenoId] = useState(lead.duenoId);
  const [valorEstimado, setValorEstimado] = useState(lead.valorEstimado != null ? String(lead.valorEstimado) : "");
  const [valorMensualEstimado, setValorMensual] = useState(
    lead.valorMensualEstimado != null ? String(lead.valorMensualEstimado) : "",
  );

  const [notas, setNotas] = useState<Nota[]>([]);
  const [nuevaNota, setNuevaNota] = useState("");
  const [loadingNotas, setLoadingNotas] = useState(true);

  const loadNotas = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${lead.id}/notas`);
      const data = await res.json();
      setNotas(data.notas ?? []);
    } catch {
      /* noop */
    }
    setLoadingNotas(false);
  }, [lead.id]);

  useEffect(() => {
    loadNotas();
  }, [loadNotas]);

  const saveFields = async () => {
    if (!nombre.trim()) {
      toast("El nombre es obligatorio", "error");
      return;
    }
    try {
      const res = await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          empresa: empresa || null,
          contacto: contacto || null,
          origen,
          duenoId,
          valorEstimado: valorEstimado || null,
          valorMensualEstimado: valorMensualEstimado || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast("Lead actualizado", "success");
      setEditing(false);
      onSaved();
    } catch {
      toast("No se pudo actualizar", "error");
    }
  };

  const addNota = async () => {
    if (!nuevaNota.trim()) return;
    try {
      const res = await fetch(`/api/leads/${lead.id}/notas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contenido: nuevaNota.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error();
      setNotas((prev) => [data.nota, ...prev]);
      setNuevaNota("");
      onSaved();
    } catch {
      toast("No se pudo agregar la nota", "error");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={onClose}>
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="font-semibold">Detalle del lead</h3>
          <div className="flex items-center gap-1">
            <button
              onClick={onRemove}
              title="Eliminar"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-6">
          {/* Fields */}
          {editing ? (
            <div className="space-y-3">
              <input
                className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
                placeholder="Nombre *"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
                  placeholder="Empresa"
                  value={empresa}
                  onChange={(e) => setEmpresa(e.target.value)}
                />
                <input
                  className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
                  placeholder="Contacto"
                  value={contacto}
                  onChange={(e) => setContacto(e.target.value)}
                />
              </div>
              <select
                className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
                value={origen}
                onChange={(e) => setOrigen(e.target.value as Origen)}
              >
                {ORIGENES.map((o) => (
                  <option key={o} value={o}>
                    {ORIGEN_LABEL[o]}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
                value={duenoId}
                onChange={(e) => setDuenoId(e.target.value)}
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
                  placeholder="Valor estimado"
                  value={valorEstimado}
                  onChange={(e) => setValorEstimado(e.target.value)}
                />
                <input
                  type="number"
                  className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
                  placeholder="Valor mensual"
                  value={valorMensualEstimado}
                  onChange={(e) => setValorMensual(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditing(false)}
                  className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveFields}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg gradient-bg py-2 text-sm font-semibold text-white hover:opacity-90"
                >
                  <Check className="h-4 w-4" /> Guardar
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-bold">{lead.nombre}</p>
                  {lead.empresa && <p className="text-sm text-muted-foreground">{lead.empresa}</p>}
                </div>
                <span className={"shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold " + ORIGEN_STYLE[lead.origen]}>
                  {ORIGEN_LABEL[lead.origen]}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                <Field label="Etapa" value={ETAPA_LABEL[lead.etapa]} />
                <Field label="Contacto" value={lead.contacto || "—"} />
                <Field
                  label="Valor estimado"
                  value={lead.valorEstimado != null ? formatCurrency(lead.valorEstimado) : "—"}
                />
                <Field
                  label="Valor mensual"
                  value={lead.valorMensualEstimado != null ? formatCurrency(lead.valorMensualEstimado) : "—"}
                />
                <Field label="Dueño" value={lead.duenoNombre || "—"} />
                <Field label="Ventas generadas" value={String(lead.ventasCount)} />
                <Field label="Último movimiento" value={fmtDate(lead.fechaUltimoMovimiento)} />
                <Field label="Creado" value={fmtDate(lead.createdAt)} />
              </dl>
              {lead.etapa === "CERRADO_PERDIDO" && lead.motivoPerdida && (
                <p className="rounded-lg bg-red-500/10 p-2 text-xs text-red-600 dark:text-red-400">
                  Motivo de pérdida: {lead.motivoPerdida}
                </p>
              )}
              <button
                onClick={() => setEditing(true)}
                className="mt-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Editar campos
              </button>
            </div>
          )}

          {/* Notas */}
          <div className="border-t border-border pt-4">
            <p className="mb-2 text-sm font-semibold">Notas</p>
            <div className="flex items-end gap-2">
              <textarea
                className="flex-1 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm"
                placeholder="Agregar una nota…"
                rows={2}
                value={nuevaNota}
                onChange={(e) => setNuevaNota(e.target.value)}
              />
              <button
                onClick={addNota}
                className="rounded-lg gradient-bg px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {loadingNotas ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" />
              ) : notas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin notas todavía.</p>
              ) : (
                notas.map((n) => (
                  <div key={n.id} className="rounded-lg border border-border bg-secondary/30 p-2.5">
                    <p className="text-sm">{n.contenido}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {n.autorNombre || "—"} · {fmtDate(n.createdAt)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

// ─── Shared modal shell ─────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ModalFooter({
  onClose,
  onConfirm,
  saving,
  confirmLabel,
}: {
  onClose: () => void;
  onConfirm: () => void;
  saving?: boolean;
  confirmLabel: string;
}) {
  return (
    <div className="flex gap-3 border-t border-border px-6 py-4">
      <button
        onClick={onClose}
        className="flex-1 rounded-lg border border-border py-2 text-sm text-muted-foreground hover:text-foreground"
      >
        Cancelar
      </button>
      <button
        onClick={onConfirm}
        disabled={saving}
        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg gradient-bg py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        {confirmLabel}
      </button>
    </div>
  );
}
