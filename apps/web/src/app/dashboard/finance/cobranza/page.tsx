"use client";

import { useState, useRef } from "react";
import { Plus, Trash2, Receipt, FilterX } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, MoneyInput } from "@/components/ui/field";
import { PageHeader, Card } from "@/components/ui/page-header";
import { EmptyState, ErrorState, RowsSkeleton, Skeleton } from "@/components/ui/states";
import { useConfirm } from "@/components/ui/confirm";
import { useApi, apiSend } from "@/hooks/use-api";

// ─── Types ──────────────────────────────────────────────────────────

type Status = "PENDIENTE" | "PAGADA" | "VENCIDA";
type Tipo = "RECURRENTE" | "UNICA";

interface Receivable {
  id: string;
  clienteId?: string | null;
  clienteManual?: string | null;
  clienteNombre?: string | null;
  tipo?: Tipo | null;
  vendedorId?: string | null;
  vendedorNombre?: string | null;
  invoiceFolio?: string | null;
  concept?: string | null;
  amount: number;
  issueDate: string;
  pagado: boolean;
  fechaPago?: string | null;
  saldo: number;
  status: Status;
}

interface TipoTotals { cobrado: number; porCobrar: number; }

interface Totals {
  porCobrar: number; cobrado: number; vencido: number;
  pagadas: number; pendientes: number; vencidas: number;
  recurrente: TipoTotals;
  unica: TipoTotals;
}

interface ClienteOpt { id: string; nombre: string; }
interface Member { id: string; name: string | null; }

interface ReceivablesResponse {
  receivables?: Receivable[];
  totals?: Totals;
  members?: Member[];
  clientes?: ClienteOpt[];
}

const EMPTY_TOTALS: Totals = {
  porCobrar: 0, cobrado: 0, vencido: 0, pagadas: 0, pendientes: 0, vencidas: 0,
  recurrente: { cobrado: 0, porCobrar: 0 },
  unica: { cobrado: 0, porCobrar: 0 },
};

const STATUS_STYLE: Record<Status, string> = {
  PENDIENTE: "bg-warning/10 text-warning",
  PAGADA: "bg-success/10 text-success",
  VENCIDA: "bg-destructive/10 text-destructive",
};

const STATUS_LABEL: Record<Status, string> = {
  PENDIENTE: "Pendiente",
  PAGADA: "Pagada",
  VENCIDA: "Vencida",
};

const TIPO_LABEL: Record<Tipo, string> = { RECURRENTE: "Recurrente", UNICA: "Única" };

const DAY_MS = 24 * 60 * 60 * 1000;

function today() { return new Date().toISOString().slice(0, 10); }

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

/** Optimistic status guess until the server reload arrives. */
function guessStatus(r: Receivable, pagado: boolean): Status {
  if (pagado) return "PAGADA";
  if (r.status !== "PAGADA") return r.status;
  return Date.now() - new Date(r.issueDate).getTime() > 30 * DAY_MS ? "VENCIDA" : "PENDIENTE";
}

const EMPTY_FORM = {
  clienteId: "",
  clienteManual: "",
  tipo: "" as "" | Tipo,
  vendedorId: "",
  invoiceFolio: "",
  concept: "",
  amount: "",
  issueDate: today(),
  pagado: false,
};

export default function CobranzaPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const { data, setData, error, initialLoading, reload } = useApi<ReceivablesResponse>("/api/receivables");

  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"TODAS" | Status>("TODAS");
  const [clientMode, setClientMode] = useState<"elegir" | "escribir">("elegir");
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [formErrors, setFormErrors] = useState<{ cliente?: string; tipo?: string }>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const pendingRef = useRef<Set<string>>(new Set());

  const rows = data?.receivables ?? [];
  const totals = data?.totals ?? EMPTY_TOTALS;
  const members = data?.members ?? [];
  const clientes = data?.clientes ?? [];
  const loadFailed = !!error && !data;

  // Latest rows for async callbacks (e.g. the "Deshacer" toast action).
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const patchRow = (id: string, patch: (r: Receivable) => Receivable) => {
    setData((prev) =>
      prev ? { ...prev, receivables: (prev.receivables ?? []).map((x) => (x.id === id ? patch(x) : x)) } : prev,
    );
  };

  const add = async () => {
    const errs: typeof formErrors = {};
    if (clientMode === "elegir" && !form.clienteId) errs.cliente = "Selecciona un cliente";
    if (clientMode === "escribir" && !form.clienteManual.trim()) errs.cliente = "Escribe el nombre del cliente";
    if (!form.tipo) errs.tipo = "Selecciona el tipo";
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      await apiSend("/api/receivables", "POST", {
        clienteId: clientMode === "elegir" ? form.clienteId : null,
        clienteManual: clientMode === "escribir" ? form.clienteManual.trim() : null,
        tipo: form.tipo,
        vendedorId: form.vendedorId || null,
        invoiceFolio: form.invoiceFolio,
        concept: form.concept,
        amount: Number(form.amount) || 0,
        issueDate: form.issueDate,
        pagado: form.pagado,
      });
      setForm({ ...EMPTY_FORM, issueDate: today() });
      toast("Factura registrada", "success");
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: Receivable) => {
    const ok = await confirm({
      title: "¿Eliminar factura?",
      description: `Se eliminará la factura de ${r.clienteNombre ?? "este cliente"} por ${formatCurrency(r.amount)}.`,
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiSend(`/api/receivables/${r.id}`, "DELETE");
      toast("Factura eliminada", "success");
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo eliminar", "error");
    }
  };

  /** Optimistic toggle: update immediately, revert + error toast on failure. */
  const setPagado = async (id: string, next: boolean, undoable: boolean) => {
    const snapshot = rowsRef.current.find((x) => x.id === id);
    if (!snapshot || pendingRef.current.has(id)) return;

    pendingRef.current.add(id);
    patchRow(id, (x) => ({ ...x, pagado: next, status: guessStatus(x, next) }));
    setPending(new Set(pendingRef.current));
    try {
      await apiSend(`/api/receivables/${id}`, "PATCH", { pagado: next });
      if (next && undoable) {
        toast(`Factura de ${snapshot.clienteNombre || "cliente"} marcada como pagada`, "success", {
          action: { label: "Deshacer", onClick: () => { void setPagado(id, false, false); } },
        });
      }
      await reload();
    } catch (e) {
      patchRow(id, () => snapshot);
      toast(e instanceof Error ? e.message : "No se pudo actualizar", "error");
    } finally {
      pendingRef.current.delete(id);
      setPending(new Set(pendingRef.current));
    }
  };

  const visible = rows.filter((r) => filter === "TODAS" || r.status === filter);

  const empty =
    rows.length === 0 ? (
      <EmptyState
        icon={Receipt}
        title="Sin facturas todavía"
        description="Registra la primera con el formulario de arriba."
      />
    ) : (
      <EmptyState
        icon={FilterX}
        title={`Sin facturas con estatus "${filter === "TODAS" ? "" : STATUS_LABEL[filter]}"`}
        description="Prueba con otro filtro."
        action={<Button variant="outline" size="sm" onClick={() => setFilter("TODAS")}>Ver todas</Button>}
      />
    );

  const tileLoading = initialLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Receipt}
        title="Cobranza"
        description={<>Facturas por cliente. Marca &quot;Pagado&quot; y su monto completo cuenta como cobrado.</>}
      />

      {loadFailed ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : (
        <>
          {/* Summary tiles: recurrente vs única + grand total */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Tile
              label="Recurrente (mensual)"
              value={formatCurrency(totals.recurrente.cobrado)}
              sub={`Por cobrar: ${formatCurrency(totals.recurrente.porCobrar)}`}
              tone="success"
              loading={tileLoading}
            />
            <Tile
              label="Única (vendido)"
              value={formatCurrency(totals.unica.cobrado)}
              sub={`Por cobrar: ${formatCurrency(totals.unica.porCobrar)}`}
              tone="success"
              loading={tileLoading}
            />
            <Tile
              label="Cobrado total"
              value={formatCurrency(totals.cobrado)}
              sub={`Por cobrar: ${formatCurrency(totals.porCobrar)}`}
              tone="default"
              loading={tileLoading}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Tile label="Por cobrar" value={formatCurrency(totals.porCobrar)} sub={`${totals.pendientes} pendientes`} tone="warning" loading={tileLoading} />
            <Tile label="Vencido (+30 días)" value={formatCurrency(totals.vencido)} sub={`${totals.vencidas} facturas`} tone="destructive" loading={tileLoading} />
            <Tile label="Total facturas" value={String(rows.length)} sub={`${totals.pagadas} pagadas / ${totals.pendientes} por cobrar`} tone="default" loading={tileLoading} />
          </div>

          {/* Add form */}
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold">Registrar factura</h2>

            {/* Client picker toggle */}
            <div className="mb-3 inline-flex rounded-lg bg-secondary p-1" role="group" aria-label="Cómo indicar el cliente">
              {(["elegir", "escribir"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={clientMode === m}
                  onClick={() => { setClientMode(m); setFormErrors((x) => ({ ...x, cliente: undefined })); }}
                  className={cn(
                    "min-h-[36px] rounded-md px-3 text-xs font-medium transition-colors",
                    clientMode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m === "elegir" ? "Elegir cliente" : "Escribir nombre"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {clientMode === "elegir" ? (
                <Field label="Cliente" error={formErrors.cliente} className="lg:col-span-2">
                  <Select
                    value={form.clienteId}
                    onChange={(e) => { setForm((f) => ({ ...f, clienteId: e.target.value })); setFormErrors((x) => ({ ...x, cliente: undefined })); }}
                  >
                    <option value="">Selecciona…</option>
                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </Select>
                </Field>
              ) : (
                <Field label="Nombre del cliente" error={formErrors.cliente} className="lg:col-span-2">
                  <Input
                    value={form.clienteManual}
                    onChange={(e) => { setForm((f) => ({ ...f, clienteManual: e.target.value })); setFormErrors((x) => ({ ...x, cliente: undefined })); }}
                  />
                </Field>
              )}
              <Field label="Tipo" error={formErrors.tipo}>
                <Select
                  value={form.tipo}
                  onChange={(e) => { setForm((f) => ({ ...f, tipo: e.target.value as "" | Tipo })); setFormErrors((x) => ({ ...x, tipo: undefined })); }}
                >
                  <option value="">Selecciona…</option>
                  <option value="RECURRENTE">Recurrente</option>
                  <option value="UNICA">Única</option>
                </Select>
              </Field>
              <Field label="Vendedor" optional>
                <Select value={form.vendedorId} onChange={(e) => setForm((f) => ({ ...f, vendedorId: e.target.value }))}>
                  <option value="">Sin vendedor</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </Select>
              </Field>
              <Field label="Monto">
                <MoneyInput
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </Field>
              <Field label="Emitida">
                <Input type="date" value={form.issueDate} onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))} />
              </Field>
              <Field label="Folio / Factura" optional>
                <Input value={form.invoiceFolio} onChange={(e) => setForm((f) => ({ ...f, invoiceFolio: e.target.value }))} />
              </Field>
              <Field label="Concepto" optional className="sm:col-span-2 lg:col-span-2">
                <Input value={form.concept} onChange={(e) => setForm((f) => ({ ...f, concept: e.target.value }))} />
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
              <label className="flex min-h-[36px] cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border accent-primary"
                  checked={form.pagado}
                  onChange={(e) => setForm((f) => ({ ...f, pagado: e.target.checked }))}
                />
                Pagado
              </label>
              <Button onClick={add} loading={saving}>
                {!saving && <Plus />} Agregar factura
              </Button>
            </div>
          </Card>

          {/* Filters */}
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estatus">
            {(["TODAS", "PENDIENTE", "VENCIDA", "PAGADA"] as const).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
                className={cn(
                  "min-h-[36px] rounded-full px-3 text-xs font-medium transition-colors",
                  filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {f === "TODAS" ? "Todas" : STATUS_LABEL[f]}
              </button>
            ))}
          </div>

          {/* Mobile card list (below md) */}
          <div className="md:hidden">
            {initialLoading ? (
              <Card><RowsSkeleton rows={4} /></Card>
            ) : visible.length === 0 ? (
              <Card>{empty}</Card>
            ) : (
              <div className="space-y-3">
                {visible.map((r) => (
                  <FacturaCard
                    key={r.id}
                    r={r}
                    busy={pending.has(r.id)}
                    onRemove={() => remove(r)}
                    onTogglePagado={() => setPagado(r.id, !r.pagado, true)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Table (md and up) */}
          <Card className="hidden overflow-x-auto md:block">
            {initialLoading ? (
              <RowsSkeleton rows={6} />
            ) : visible.length === 0 ? (
              empty
            ) : (
              <table className="w-full min-w-[820px] text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Cliente</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Vendedor</th>
                    <th className="px-4 py-3 text-right font-medium">Monto</th>
                    <th className="px-4 py-3 font-medium">Emitida</th>
                    <th className="px-4 py-3 font-medium">Estatus</th>
                    <th className="px-4 py-3 text-center font-medium">Pagado</th>
                    <th className="px-4 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <FacturaRow
                      key={r.id}
                      r={r}
                      busy={pending.has(r.id)}
                      onRemove={() => remove(r)}
                      onTogglePagado={() => setPagado(r.id, !r.pagado, true)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={"inline-block flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold " + STATUS_STYLE[status]}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function PagadoCheckbox({
  r,
  busy,
  onToggle,
  showLabel,
}: {
  r: Receivable;
  busy: boolean;
  onToggle: () => void;
  showLabel?: boolean;
}) {
  return (
    <label
      className={cn(
        "inline-flex min-h-[36px] min-w-[36px] cursor-pointer items-center justify-center gap-2 rounded-lg text-sm",
        showLabel && "pr-2",
        busy && "cursor-wait",
      )}
    >
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-border accent-primary"
        checked={r.pagado}
        onChange={onToggle}
        aria-busy={busy || undefined}
        aria-label={showLabel ? undefined : `Marcar factura de ${r.clienteNombre || "cliente"} como pagada`}
      />
      {showLabel && "Pagado"}
    </label>
  );
}

function DeleteButton({ r, onRemove }: { r: Receivable; onRemove: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onRemove}
      aria-label={`Eliminar factura de ${r.clienteNombre || "cliente"}`}
      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
    >
      <Trash2 />
    </Button>
  );
}

function FacturaRow({ r, busy, onRemove, onTogglePagado }: { r: Receivable; busy: boolean; onRemove: () => void; onTogglePagado: () => void; }) {
  return (
    <tr className="border-b border-border last:border-0 hover:bg-secondary/60">
      <td className="px-4 py-3 font-medium">{r.clienteNombre || "—"}</td>
      <td className="px-4 py-3 text-muted-foreground">{r.tipo ? TIPO_LABEL[r.tipo] : "—"}</td>
      <td className="px-4 py-3 text-muted-foreground">{r.vendedorNombre || "—"}</td>
      <td className="px-4 py-3 text-right font-semibold">{formatCurrency(r.amount)}</td>
      <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.issueDate)}</td>
      <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
      <td className="px-4 py-1 text-center">
        <PagadoCheckbox r={r} busy={busy} onToggle={onTogglePagado} />
      </td>
      <td className="px-4 py-1">
        <div className="flex items-center justify-end">
          <DeleteButton r={r} onRemove={onRemove} />
        </div>
      </td>
    </tr>
  );
}

function FacturaCard({ r, busy, onRemove, onTogglePagado }: { r: Receivable; busy: boolean; onRemove: () => void; onTogglePagado: () => void; }) {
  return (
    <Card className="p-4 tabular-nums">
      <div className="flex items-start justify-between gap-2">
        <span className="truncate font-semibold">{r.clienteNombre || "—"}</span>
        <StatusBadge status={r.status} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Monto</p>
          <p className="font-semibold">{formatCurrency(r.amount)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Tipo</p>
          <p className="text-muted-foreground">{r.tipo ? TIPO_LABEL[r.tipo] : "—"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Emitida</p>
          <p className="text-muted-foreground">{fmtDate(r.issueDate)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Vendedor</p>
          <p className="text-muted-foreground">{r.vendedorNombre || "—"}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
        <PagadoCheckbox r={r} busy={busy} onToggle={onTogglePagado} showLabel />
        <DeleteButton r={r} onRemove={onRemove} />
      </div>
    </Card>
  );
}

function Tile({
  label,
  value,
  sub,
  tone,
  loading,
}: {
  label: string;
  value: string;
  sub: string;
  tone: "warning" | "success" | "destructive" | "default";
  loading?: boolean;
}) {
  const accent: Record<string, string> = {
    warning: "text-warning",
    success: "text-success",
    destructive: "text-destructive",
    default: "text-foreground",
  };
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {loading ? (
        <>
          <Skeleton className="mt-2 h-6 w-28" />
          <Skeleton className="mt-2 h-3 w-20" />
        </>
      ) : (
        <>
          <p className={"mt-1 text-xl font-bold tracking-tight tabular-nums " + accent[tone]}>{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{sub}</p>
        </>
      )}
    </Card>
  );
}
