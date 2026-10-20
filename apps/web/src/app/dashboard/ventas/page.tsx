"use client";

import { useState, useCallback } from "react";
import { Plus, TrendingUp, Trash2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select, MoneyInput } from "@/components/ui/field";
import { PageHeader, Card } from "@/components/ui/page-header";
import { EmptyState, ErrorState, RowsSkeleton, Skeleton } from "@/components/ui/states";
import { useConfirm } from "@/components/ui/confirm";
import { useApi, apiSend } from "@/hooks/use-api";

// ─── Types ──────────────────────────────────────────────────────────

type Tipo = "RECURRENTE" | "UNICA";
type Origen = "META" | "ORGANICO" | "OUTBOUND" | "REFERIDO" | "RED_DIRECTA";

interface Venta {
  id: string;
  monto: number;
  tipo: Tipo;
  concepto?: string | null;
  fechaCierre: string;
  fechaCobroEsperada?: string | null;
  origen?: Origen | null;
  leadId?: string | null;
  leadNombre?: string | null;
  clienteId?: string | null;
  clienteNombre?: string | null;
  vendedorId?: string | null;
  vendedorNombre?: string | null;
}

interface Totals {
  mesCount: number;
  mesMonto: number;
  totalCount: number;
  totalMonto: number;
}

interface Member {
  id: string;
  name: string | null;
}

interface ClienteOpt {
  id: string;
  nombre: string;
}

interface VentasResponse {
  ventas?: Venta[];
  totals?: Totals;
}

interface UserResponse {
  jobRole?: string | null;
  user?: { id?: string | null } | null;
}

const EMPTY_TOTALS: Totals = { mesCount: 0, mesMonto: 0, totalCount: 0, totalMonto: 0 };

const TIPO_LABEL: Record<Tipo, string> = { RECURRENTE: "Recurrente", UNICA: "Única" };

const ORIGENES: Origen[] = ["META", "ORGANICO", "OUTBOUND", "REFERIDO", "RED_DIRECTA"];
const ORIGEN_LABEL: Record<Origen, string> = {
  META: "Meta",
  ORGANICO: "Orgánico",
  OUTBOUND: "Outbound",
  REFERIDO: "Referido",
  RED_DIRECTA: "Red directa",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export default function VentasPage() {
  const { toast } = useToast();
  const confirm = useConfirm();
  const [showNew, setShowNew] = useState(false);

  const { data, error, initialLoading, reload } = useApi<VentasResponse>("/api/ventas");
  const { data: userData } = useApi<UserResponse>("/api/user");

  const jobRole = userData?.jobRole ?? null;
  const userId = userData?.user?.id ?? null;
  const isDireccion = jobRole === "DIRECCION";

  // Only Dirección captures manual sales; fetch dropdown data for the modal.
  const leadsApi = useApi<{ members?: Member[] }>(isDireccion ? "/api/leads" : null);
  const clientesApi = useApi<{ clientes?: { id: string; nombre: string }[] }>(isDireccion ? "/api/clientes" : null);
  const members = leadsApi.data?.members ?? [];
  const clientes: ClienteOpt[] = (clientesApi.data?.clientes ?? []).map((c) => ({ id: c.id, nombre: c.nombre }));

  const ventas = data?.ventas ?? [];
  const totals = data?.totals ?? EMPTY_TOTALS;
  const loadFailed = !!error && !data;

  const canDelete = useCallback(
    (v: Venta) => isDireccion || (jobRole === "COMERCIAL" && !!userId && v.vendedorId === userId),
    [isDireccion, jobRole, userId],
  );

  const remove = async (v: Venta) => {
    const ok = await confirm({
      title: "¿Eliminar esta venta?",
      description: `${v.clienteNombre || v.leadNombre || "Venta"} · ${formatCurrency(v.monto)}. Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiSend(`/api/ventas/${v.id}`, "DELETE");
      toast("Venta eliminada", "success");
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo eliminar", "error");
    }
  };

  const newButton = isDireccion ? (
    <Button onClick={() => setShowNew(true)}>
      <Plus /> Nueva venta
    </Button>
  ) : null;

  const empty = (
    <EmptyState
      icon={TrendingUp}
      title="Sin ventas todavía"
      description="Los cierres del pipeline y las ventas capturadas aparecerán aquí."
      action={newButton}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={TrendingUp}
        title="Ventas"
        description="Cierres del pipeline y ventas capturadas."
        actions={newButton}
      />

      {loadFailed ? (
        <Card>
          <ErrorState message={error} onRetry={reload} />
        </Card>
      ) : (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile
              label="Ventas del mes"
              value={formatCurrency(totals.mesMonto)}
              sub={`${totals.mesCount} cierres`}
              tone="success"
              loading={initialLoading}
            />
            <Tile
              label="Total histórico"
              value={formatCurrency(totals.totalMonto)}
              sub={`${totals.totalCount} cierres`}
              tone="default"
              loading={initialLoading}
            />
          </div>

          {/* Mobile card list (below md) */}
          <div className="md:hidden">
            {initialLoading ? (
              <Card>
                <RowsSkeleton rows={4} />
              </Card>
            ) : ventas.length === 0 ? (
              <Card>{empty}</Card>
            ) : (
              <div className="space-y-3">
                {ventas.map((v) => (
                  <Card key={v.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate font-semibold">{v.clienteNombre || v.leadNombre || "—"}</p>
                      <span className="flex-shrink-0 font-semibold tabular-nums">{formatCurrency(v.monto)}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <span>Cierre: {fmtDate(v.fechaCierre)}</span>
                      <span>Cobro: {fmtDate(v.fechaCobroEsperada)}</span>
                      <span>Vendedor: {v.vendedorNombre || "—"}</span>
                      <span>Tipo: {TIPO_LABEL[v.tipo]}</span>
                    </div>
                    {v.concepto && <p className="mt-2 text-xs text-muted-foreground">{v.concepto}</p>}
                    {canDelete(v) && (
                      <div className="mt-3 flex justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => remove(v)}
                          aria-label="Eliminar venta"
                          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Table (md and up) */}
          <Card className="hidden overflow-x-auto md:block">
            {initialLoading ? (
              <RowsSkeleton rows={6} />
            ) : ventas.length === 0 ? (
              empty
            ) : (
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Fecha cierre</th>
                    <th className="px-4 py-3 font-medium">Cliente / Lead</th>
                    <th className="px-4 py-3 font-medium">Vendedor</th>
                    <th className="px-4 py-3 font-medium">Concepto</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 text-right font-medium">Monto</th>
                    <th className="px-4 py-3 font-medium">Cobro esperado</th>
                    <th className="px-4 py-3 text-right font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {ventas.map((v) => (
                    <tr key={v.id} className="border-b border-border last:border-0 hover:bg-secondary/60">
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(v.fechaCierre)}</td>
                      <td className="px-4 py-3 font-medium">{v.clienteNombre || v.leadNombre || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{v.vendedorNombre || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{v.concepto || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{TIPO_LABEL[v.tipo]}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(v.monto)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(v.fechaCobroEsperada)}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">
                        {canDelete(v) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => remove(v)}
                            aria-label="Eliminar venta"
                            className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}

      {isDireccion && (
        <NewVentaDialog
          open={showNew}
          members={members}
          clientes={clientes}
          optionsError={leadsApi.error || clientesApi.error}
          onClose={() => setShowNew(false)}
          onSaved={async () => {
            setShowNew(false);
            await reload();
          }}
        />
      )}
    </div>
  );
}

function NewVentaDialog({
  open,
  members,
  clientes,
  optionsError,
  onClose,
  onSaved,
}: {
  open: boolean;
  members: Member[];
  clientes: ClienteOpt[];
  optionsError: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [clienteId, setClienteId] = useState("");
  const [monto, setMonto] = useState("");
  const [tipo, setTipo] = useState<"" | Tipo>("");
  const [vendedorId, setVendedorId] = useState("");
  const [fechaCierre, setFechaCierre] = useState(today());
  const [fechaCobroEsperada, setFechaCobro] = useState("");
  const [origen, setOrigen] = useState<"" | Origen>("");
  const [concepto, setConcepto] = useState("");
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ monto?: string; tipo?: string; fechaCierre?: string }>({});

  const reset = () => {
    setClienteId("");
    setMonto("");
    setTipo("");
    setVendedorId("");
    setFechaCierre(today());
    setFechaCobro("");
    setOrigen("");
    setConcepto("");
    setErrors({});
  };

  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const save = async () => {
    const m = Number(monto);
    const next: typeof errors = {};
    if (!Number.isFinite(m) || m <= 0) next.monto = "El monto debe ser mayor a 0";
    if (!tipo) next.tipo = "Selecciona el tipo";
    if (!fechaCierre) next.fechaCierre = "Selecciona la fecha de cierre";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await apiSend("/api/ventas", "POST", {
        clienteId: clienteId || null,
        monto: m,
        tipo,
        vendedorId: vendedorId || null,
        fechaCierre,
        fechaCobroEsperada: fechaCobroEsperada || null,
        origen: origen || null,
        concepto: concepto || null,
      });
      toast("Venta registrada", "success");
      reset();
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "No se pudo guardar", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        title="Nueva venta"
        description="Captura manual de una venta cerrada."
        footer={
          <>
            <Button variant="outline" onClick={close} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving}>
              Guardar venta
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Cliente" optional error={optionsError}>
            <Select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              <option value="">Sin cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Monto" error={errors.monto}>
              <MoneyInput
                placeholder="0.00"
                value={monto}
                onChange={(e) => {
                  setMonto(e.target.value);
                  if (errors.monto) setErrors((x) => ({ ...x, monto: undefined }));
                }}
              />
            </Field>
            <Field label="Tipo" error={errors.tipo}>
              <Select
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value as "" | Tipo);
                  if (errors.tipo) setErrors((x) => ({ ...x, tipo: undefined }));
                }}
              >
                <option value="">Selecciona…</option>
                <option value="RECURRENTE">Recurrente</option>
                <option value="UNICA">Única</option>
              </Select>
            </Field>
          </div>
          <Field label="Vendedor" optional>
            <Select value={vendedorId} onChange={(e) => setVendedorId(e.target.value)}>
              <option value="">Sin vendedor</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Fecha de cierre" error={errors.fechaCierre}>
              <Input
                type="date"
                value={fechaCierre}
                onChange={(e) => {
                  setFechaCierre(e.target.value);
                  if (errors.fechaCierre) setErrors((x) => ({ ...x, fechaCierre: undefined }));
                }}
              />
            </Field>
            <Field label="Cobro esperado" optional>
              <Input type="date" value={fechaCobroEsperada} onChange={(e) => setFechaCobro(e.target.value)} />
            </Field>
          </div>
          <Field label="Origen" optional>
            <Select value={origen} onChange={(e) => setOrigen(e.target.value as "" | Origen)}>
              <option value="">Sin origen</option>
              {ORIGENES.map((o) => (
                <option key={o} value={o}>
                  {ORIGEN_LABEL[o]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Concepto" optional>
            <Input value={concepto} onChange={(e) => setConcepto(e.target.value)} />
          </Field>
        </div>
      </DialogContent>
    </Dialog>
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
  tone: "success" | "default";
  loading?: boolean;
}) {
  const accent: Record<string, string> = {
    success: "text-success",
    default: "text-foreground",
  };
  return (
    <Card className="p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {loading ? (
        <>
          <Skeleton className="mt-2 h-6 w-28" />
          <Skeleton className="mt-2 h-3 w-16" />
        </>
      ) : (
        <>
          <p className={"mt-1 text-xl font-bold tracking-tight tabular-nums " + accent[tone]}>{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
        </>
      )}
    </Card>
  );
}
