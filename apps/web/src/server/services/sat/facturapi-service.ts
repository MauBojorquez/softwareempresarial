/**
 * Facturapi service — wraps the Facturapi v2 REST API using fetch().
 * Base URL: https://www.facturapi.io/v2
 * Auth: Bearer token using FACTURAPI_SECRET_KEY env var (platform key).
 */

const BASE_URL = "https://www.facturapi.io/v2";

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.FACTURAPI_SECRET_KEY ?? ""}`,
  };
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface FacturapiOrganization {
  id: string;
  name: string;
  legal?: {
    name?: string;
    tax_id?: string;
  };
}

export interface FacturapiInvoice {
  id: string;
  type: "I" | "E" | "T" | "N" | "P"; // Ingreso, Egreso, Traslado, Nómina, Pago
  status: string;
  date: string; // ISO date
  total: number;
  subtotal: number;
  tax: number; // IVA total
  currency: string;
}

export interface FacturapiListResponse<T> {
  data: T[];
  total_pages: number;
  total_results: number;
}

// ─── Organization management ─────────────────────────────────────────────────

/**
 * Creates a Facturapi sub-organization for the customer.
 * Returns the created organization object including its `id`.
 */
export async function createFacturapiOrg(
  customerName: string,
): Promise<FacturapiOrganization> {
  const res = await fetch(`${BASE_URL}/organizations`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: customerName }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Facturapi createOrg failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<FacturapiOrganization>;
}

/**
 * Uploads the FIEL/e.firma files (cer + key + password) to Facturapi.
 * The files are passed directly as a FormData multipart upload — they are
 * never stored on our servers.
 */
export async function uploadFiel(
  facturapiOrgId: string,
  cerFile: File | Blob,
  keyFile: File | Blob,
  password: string,
  rfc: string,
): Promise<void> {
  const form = new FormData();
  form.append("cerFile", cerFile, "certificate.cer");
  form.append("keyFile", keyFile, "private.key");
  form.append("password", password);
  form.append("legal_name", rfc); // Facturapi also accepts the RFC here
  form.append("tax_id", rfc);

  const res = await fetch(`${BASE_URL}/organizations/${facturapiOrgId}/legal`, {
    method: "PUT",
    headers: authHeaders(),
    body: form,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Facturapi uploadFiel failed (${res.status}): ${text}`);
  }
}

/**
 * Deletes a Facturapi sub-organization (and all its stored credentials).
 */
export async function deleteFacturapiOrg(facturapiOrgId: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/organizations/${facturapiOrgId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });

  // 404 is fine — org may already be gone.
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`Facturapi deleteOrg failed (${res.status}): ${text}`);
  }
}

// ─── Invoice fetching ────────────────────────────────────────────────────────

/**
 * Fetches all invoices for a Facturapi sub-org within the given date range.
 * Handles pagination automatically.
 */
export async function fetchInvoices(
  facturapiOrgId: string,
  dateFrom: Date,
  dateTo: Date,
): Promise<FacturapiInvoice[]> {
  const orgKey = process.env.FACTURAPI_SECRET_KEY ?? "";
  // Facturapi sub-org invoices require the platform key + org ID path
  const params = new URLSearchParams({
    date_start: dateFrom.toISOString(),
    date_end: dateTo.toISOString(),
    limit: "50",
    page: "1",
  });

  const allInvoices: FacturapiInvoice[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    params.set("page", String(page));
    const res = await fetch(
      `${BASE_URL}/organizations/${facturapiOrgId}/invoices?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${orgKey}`,
        },
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Facturapi fetchInvoices failed (${res.status}): ${text}`);
    }

    const body = (await res.json()) as FacturapiListResponse<FacturapiInvoice>;
    allInvoices.push(...body.data);
    totalPages = body.total_pages;
    page++;
  }

  return allInvoices;
}

// ─── Metric mapping ──────────────────────────────────────────────────────────

export interface MonthlyFinancials {
  period: Date; // first day of month
  ingresos: number;
  egresos: number;
  ivaCobrado: number;
  balance: number;
}

/**
 * Groups a list of Facturapi invoices by month and computes the four
 * MetrixPro finance metrics: Ingresos, Egresos, IVA Cobrado, Balance Fiscal.
 */
export function groupInvoicesByMonth(
  invoices: FacturapiInvoice[],
): MonthlyFinancials[] {
  const map = new Map<string, MonthlyFinancials>();

  for (const inv of invoices) {
    if (inv.status === "canceled") continue;

    const d = new Date(inv.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

    if (!map.has(key)) {
      map.set(key, {
        period: new Date(d.getFullYear(), d.getMonth(), 1),
        ingresos: 0,
        egresos: 0,
        ivaCobrado: 0,
        balance: 0,
      });
    }

    const entry = map.get(key)!;

    if (inv.type === "I") {
      // Ingreso
      entry.ingresos += inv.total;
      entry.ivaCobrado += inv.tax ?? 0;
    } else if (inv.type === "E") {
      // Egreso
      entry.egresos += inv.total;
    }

    entry.balance = entry.ingresos - entry.egresos;
  }

  return Array.from(map.values()).sort(
    (a, b) => a.period.getTime() - b.period.getTime(),
  );
}
