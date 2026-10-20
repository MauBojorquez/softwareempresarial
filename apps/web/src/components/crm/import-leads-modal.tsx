"use client";

import { useMemo, useRef, useState } from "react";
import { Check, Upload, FileUp, ArrowLeft } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/field";

type Member = { id: string; name: string | null };

type Origen = "META" | "ORGANICO" | "OUTBOUND" | "REFERIDO" | "RED_DIRECTA";

const ORIGENES: Origen[] = ["META", "ORGANICO", "OUTBOUND", "REFERIDO", "RED_DIRECTA"];
const ORIGEN_LABEL: Record<Origen, string> = {
  META: "Meta",
  ORGANICO: "Orgánico",
  OUTBOUND: "Outbound",
  REFERIDO: "Referido",
  RED_DIRECTA: "Red directa",
};

// Lead fields the import can fill, with header aliases for auto-mapping.
const FIELDS = [
  { key: "nombre", label: "Nombre", required: true, aliases: ["nombre", "name", "fullname", "cliente", "lead", "prospecto"] },
  { key: "empresa", label: "Empresa", aliases: ["empresa", "company", "negocio", "organizacion", "compania"] },
  { key: "contacto", label: "Contacto", aliases: ["contacto", "contact", "persona", "responsable", "atencion"] },
  { key: "telefono", label: "Teléfono", aliases: ["telefono", "phone", "celular", "movil", "whatsapp", "tel", "numero"] },
  { key: "email", label: "Correo", aliases: ["email", "correo", "mail", "e-mail", "correoelectronico"] },
  { key: "origen", label: "Origen", aliases: ["origen", "source", "fuente", "canal", "campana", "campaña"] },
  { key: "valorEstimado", label: "Valor estimado", aliases: ["valorestimado", "valor", "monto", "importe", "value", "dealvalue"] },
  { key: "valorMensualEstimado", label: "Valor mensual", aliases: ["valormensual", "mensual", "mrr", "recurrente", "valormensualestimado"] },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

type ImportResult = {
  imported: number;
  total: number;
  skipped: { row: number; reason: string }[];
  warnings: { row: number; reason: string }[];
};

function norm(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function detectDelimiter(headerLine: string): string {
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = -1;
  for (const d of candidates) {
    const count = headerLine.split(d).length;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

// Minimal RFC4180-ish CSV parser (handles quotes, escaped quotes, CRLF).
function parseCSV(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delim = detectDelimiter(firstLine);

  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === delim) {
      cur.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      cur.push(field);
      rows.push(cur);
      cur = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || cur.length > 0) {
    cur.push(field);
    rows.push(cur);
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

export function ImportLeadsModal({
  members,
  onClose,
  onDone,
  toast,
}: {
  members: Member[];
  onClose: () => void;
  onDone: () => void;
  toast: (m: string, t?: "success" | "error" | "info") => void;
}) {
  const [step, setStep] = useState<"upload" | "map">("upload");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, number>>(
    Object.fromEntries(FIELDS.map((f) => [f.key, -1])) as Record<FieldKey, number>,
  );
  const [defaultOrigen, setDefaultOrigen] = useState<"" | Origen>("");
  const [defaultDuenoId, setDefaultDuenoId] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const autoMap = (hdrs: string[]) => {
    const map = Object.fromEntries(FIELDS.map((f) => [f.key, -1])) as Record<FieldKey, number>;
    const used = new Set<number>();
    const normHdrs = hdrs.map(norm);
    for (const f of FIELDS) {
      const idx = normHdrs.findIndex(
        (h, j) => !used.has(j) && h !== "" && f.aliases.some((a) => h === norm(a) || h.includes(norm(a))),
      );
      if (idx >= 0) {
        map[f.key] = idx;
        used.add(idx);
      }
    }
    return map;
  };

  const onFile = async (file: File | null) => {
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (rows.length < 2) {
        toast("El archivo no tiene filas de datos", "error");
        return;
      }
      const hdrs = rows[0].map((h) => h.trim());
      setFileName(file.name);
      setHeaders(hdrs);
      setDataRows(rows.slice(1));
      setMapping(autoMap(hdrs));
      setStep("map");
    } catch {
      toast("No se pudo leer el archivo CSV", "error");
    }
  };

  const cell = (row: string[], key: FieldKey) => {
    const idx = mapping[key];
    return idx >= 0 ? (row[idx] ?? "").trim() : "";
  };

  const preview = useMemo(() => dataRows.slice(0, 5), [dataRows]);

  const submit = async () => {
    if (mapping.nombre < 0) {
      toast("Asigna la columna del Nombre", "error");
      return;
    }
    if (!defaultOrigen) {
      toast("Selecciona el origen por defecto", "error");
      return;
    }
    setImporting(true);
    try {
      const rows = dataRows.map((row) => {
        const obj: Record<string, string> = {};
        for (const f of FIELDS) {
          const v = cell(row, f.key);
          if (v) obj[f.key] = v;
        }
        return obj;
      });
      const res = await fetch("/api/leads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          defaultOrigen,
          defaultDuenoId: defaultDuenoId || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error || "No se pudo importar", "error");
        setImporting(false);
        return;
      }
      setResult(data as ImportResult);
      if (data.imported > 0) toast(`${data.imported} leads importados`, "success");
    } catch {
      toast("No se pudo importar", "error");
    }
    setImporting(false);
  };

  // Once rows were imported, closing (X / Escape / overlay) must still refresh the board.
  const close = () => {
    if (importing) return;
    if (result) onDone();
    else onClose();
  };

  const footer = result ? (
    <Button onClick={onDone}>
      <Check /> Listo
    </Button>
  ) : step === "upload" ? (
    <Button variant="outline" onClick={onClose}>
      Cancelar
    </Button>
  ) : (
    <>
      <Button variant="ghost" onClick={onClose} disabled={importing}>
        Cancelar
      </Button>
      <Button
        variant="outline"
        onClick={() => {
          setStep("upload");
          setResult(null);
        }}
        disabled={importing}
      >
        <ArrowLeft /> Atrás
      </Button>
      <Button onClick={submit} loading={importing}>
        {!importing && <Upload />}
        Importar {dataRows.length} filas
      </Button>
    </>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent
        size="lg"
        title="Importar leads desde CSV"
        description={
          result
            ? "Resultado de la importación."
            : step === "upload"
              ? "Paso 1 de 2 · Selecciona el archivo."
              : "Paso 2 de 2 · Asigna las columnas a los campos del lead."
        }
        footer={footer}
      >
        {result ? (
          /* ── Result screen ── */
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-secondary/40 p-4">
              <p className="text-sm">
                <span className="text-lg font-bold text-success">{result.imported}</span> de {result.total} leads
                importados.
              </p>
              {result.skipped.length > 0 && (
                <p className="mt-1 text-sm text-muted-foreground">{result.skipped.length} fila(s) omitidas.</p>
              )}
              {result.warnings.length > 0 && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {result.warnings.length} advertencia(s) (campos omitidos).
                </p>
              )}
            </div>
            {(result.skipped.length > 0 || result.warnings.length > 0) && (
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border p-3 text-xs">
                {result.skipped.map((s, i) => (
                  <li key={`s${i}`} className="text-destructive">
                    Fila {s.row}: {s.reason} (omitida)
                  </li>
                ))}
                {result.warnings.map((w, i) => (
                  <li key={`w${i}`} className="text-warning">
                    Fila {w.row}: {w.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : step === "upload" ? (
          /* ── Upload screen ── */
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sube un archivo <code>.csv</code> con tus contactos. En el siguiente paso podrás asignar cada columna del
              archivo a un campo del lead.
            </p>
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-secondary/40 px-6 py-10 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <FileUp className="h-8 w-8" aria-hidden />
              <span className="font-medium">Selecciona un archivo CSV</span>
              <span className="text-xs">Se acepta separador por coma, punto y coma o tabulador.</span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                onFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </div>
        ) : (
          /* ── Mapping screen ── */
          <div className="space-y-5">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{fileName}</span> · {dataRows.length} filas detectadas
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              {FIELDS.map((f) => {
                const required = "required" in f && f.required;
                return (
                  <Field key={f.key} label={f.label} optional={!required}>
                    <Select
                      value={mapping[f.key]}
                      onChange={(e) => setMapping((m) => ({ ...m, [f.key]: Number(e.target.value) }))}
                    >
                      <option value={-1}>— No importar —</option>
                      {headers.map((h, idx) => (
                        <option key={idx} value={idx}>
                          {h || `Columna ${idx + 1}`}
                        </option>
                      ))}
                    </Select>
                  </Field>
                );
              })}
            </div>

            <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
              <Field label="Origen por defecto" hint="Se usa cuando la fila no traiga un origen válido.">
                <Select value={defaultOrigen} onChange={(e) => setDefaultOrigen(e.target.value as "" | Origen)}>
                  <option value="">Selecciona…</option>
                  {ORIGENES.map((o) => (
                    <option key={o} value={o}>
                      {ORIGEN_LABEL[o]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Dueño por defecto" optional>
                <Select value={defaultDuenoId} onChange={(e) => setDefaultDuenoId(e.target.value)}>
                  <option value="">Yo (por defecto)</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            {mapping.nombre >= 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Vista previa</p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-secondary/40">
                      <tr className="text-xs font-medium text-muted-foreground">
                        <th className="px-2 py-1.5 font-medium">Nombre</th>
                        <th className="px-2 py-1.5 font-medium">Empresa</th>
                        <th className="px-2 py-1.5 font-medium">Correo</th>
                        <th className="px-2 py-1.5 font-medium">Teléfono</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-t border-border">
                          <td className="px-2 py-1.5">{cell(row, "nombre") || "—"}</td>
                          <td className="px-2 py-1.5">{cell(row, "empresa") || "—"}</td>
                          <td className="px-2 py-1.5">{cell(row, "email") || "—"}</td>
                          <td className="px-2 py-1.5">{cell(row, "telefono") || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
