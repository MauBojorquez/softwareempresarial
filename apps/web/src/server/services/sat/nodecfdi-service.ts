/**
 * Thin wrapper around @nodecfdi/sat-ws-descarga-masiva (ESM-only).
 *
 * Because the package is ESM-only and this project compiles to CommonJS,
 * every entry point loads it via dynamic `await import(...)`.
 *
 * SECURITY: never log e.firma contents, the private key, or the password.
 */

// We intentionally avoid importing the package's types at module scope
// (ESM-only). Service instances are therefore typed as `any` at the boundary.
/* eslint-disable @typescript-eslint/no-explicit-any */

import { XMLParser } from "fast-xml-parser";

export interface ParsedCfdi {
  date: string;
  total: number;
  subtotal: number;
  tax: number;
  type: string;
  uuid?: string;
}

export interface VerifyResult {
  statusName: string;
  packageIds: string[];
  isFinished: boolean;
  isFailure: boolean;
}

/** Formats a Date as "YYYY-MM-DD HH:mm:ss" (local components) for SAT. */
function formatSat(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

export async function buildService(
  cerBin: Buffer,
  keyBin: Buffer,
  password: string,
): Promise<{ service: any; fiel: any }> {
  const {
    Fiel,
    HttpsWebClient,
    FielRequestBuilder,
    Service,
    ServiceEndpoints,
  } = await import("@nodecfdi/sat-ws-descarga-masiva");

  const fiel = Fiel.create(
    cerBin.toString("binary"),
    keyBin.toString("binary"),
    password,
  );
  if (!fiel.isValid()) {
    throw new Error("La e.firma no es válida o la contraseña es incorrecta.");
  }

  const service = new Service(
    new FielRequestBuilder(fiel),
    new HttpsWebClient(),
    undefined,
    ServiceEndpoints.cfdi(),
  );

  return { service, fiel };
}

export async function createQuery(
  service: any,
  from: Date,
  to: Date,
  downloadType: "issued" | "received",
): Promise<string> {
  const {
    QueryParameters,
    DateTimePeriod,
    DownloadType,
    RequestType,
    DocumentStatus,
  } = await import("@nodecfdi/sat-ws-descarga-masiva");

  const period = DateTimePeriod.createFromValues(formatSat(from), formatSat(to));
  let q = QueryParameters.create(period).withRequestType(
    new RequestType("xml"),
  );
  q = q.withDownloadType(
    new DownloadType(downloadType === "issued" ? "issued" : "received"),
  );
  // SAT no permite descargar XML de comprobantes cancelados; al pedir XML
  // hay que filtrar por estado "active" (vigentes), de lo contrario rechaza
  // la solicitud con "No se permite la descarga de xml que se encuentren
  // cancelados".
  q = q.withDocumentStatus(new DocumentStatus("active"));

  const query = await service.query(q);
  if (!query.getStatus().isAccepted()) {
    throw new Error(
      `SAT rechazó la solicitud: ${query.getStatus().getMessage()}`,
    );
  }
  return query.getRequestId();
}

export async function verifyRequest(
  service: any,
  requestId: string,
): Promise<VerifyResult> {
  const verify = await service.verify(requestId);

  const statusRequest = verify.getStatusRequest();
  const status = verify.getStatus();

  const statusName =
    typeof status?.getMessage === "function" ? status.getMessage() : "unknown";

  const isFinished =
    typeof statusRequest?.isTypeOf === "function"
      ? statusRequest.isTypeOf("Finished")
      : false;

  const isFailure =
    typeof statusRequest?.isTypeOf === "function"
      ? statusRequest.isTypeOf("Failure") ||
        statusRequest.isTypeOf("Rejected") ||
        statusRequest.isTypeOf("Expired")
      : false;

  let packageIds: string[] = [];
  try {
    const ids = verify.getPackageIds();
    packageIds = Array.isArray(ids) ? ids : Array.from(ids ?? []);
  } catch {
    packageIds = [];
  }

  return { statusName, packageIds, isFinished, isFailure };
}

export async function downloadPackage(
  service: any,
  packageId: string,
): Promise<Buffer> {
  const d = await service.download(packageId);
  if (!d.getStatus().isAccepted()) {
    throw new Error(
      `SAT rechazó la descarga del paquete: ${d.getStatus().getMessage()}`,
    );
  }
  return Buffer.from(d.getPackageContent(), "base64");
}

function toNum(v: unknown): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export async function parsePackage(zip: Buffer): Promise<ParsedCfdi[]> {
  const { CfdiPackageReader } = await import(
    "@nodecfdi/sat-ws-descarga-masiva"
  );

  const reader = await CfdiPackageReader.createFromContents(
    zip.toString("binary"),
  );

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    removeNSPrefix: false,
  });

  const out: ParsedCfdi[] = [];

  for await (const map of reader.cfdis()) {
    // `map` is a Map<uuid, xmlString> for each CFDI in the package.
    const entries =
      map instanceof Map ? Array.from(map.entries()) : Object.entries(map ?? {});

    for (const [uuid, xml] of entries) {
      try {
        const parsed = parser.parse(xml as string);
        const comp =
          parsed["cfdi:Comprobante"] ?? parsed["Comprobante"] ?? null;
        if (!comp) continue;

        const imp =
          comp["cfdi:Impuestos"] ?? comp["Impuestos"] ?? undefined;
        const tax = imp ? toNum(imp.TotalImpuestosTrasladados) : 0;

        out.push({
          uuid: typeof uuid === "string" ? uuid : undefined,
          date: String(comp.Fecha ?? ""),
          total: toNum(comp.Total),
          subtotal: toNum(comp.SubTotal),
          tax,
          type: String(comp.TipoDeComprobante ?? ""),
        });
      } catch {
        // Skip malformed CFDIs rather than failing the whole package.
      }
    }
  }

  return out;
}
