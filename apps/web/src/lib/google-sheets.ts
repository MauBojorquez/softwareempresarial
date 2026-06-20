// Helpers to read a public Google Sheet as a grid of cells (live, no OAuth).
// The sheet must be shared as "Anyone with the link can view".

/** Converts a Google Sheets share URL to its CSV export URL. */
export function toCsvUrl(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const id = match[1];
  const gidMatch = url.match(/[?&#]gid=(\d+)/);
  const gid = gidMatch ? gidMatch[1] : "0";
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

/** Minimal CSV parser that respects quoted fields (handles commas inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else if (ch === "\r") { /* skip */ }
      else cell += ch;
    }
  }
  if (cell !== "" || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

/** Fetches a public Google Sheet and returns its cells as a 2D string grid. */
export async function fetchSheetGrid(url: string): Promise<{ ok: true; grid: string[][] } | { ok: false; error: string }> {
  const csvUrl = toCsvUrl(url);
  if (!csvUrl) return { ok: false, error: "URL de Google Sheets inválida. Pega el enlace completo de la hoja." };

  try {
    const res = await fetch(csvUrl, { headers: { Accept: "text/csv" }, redirect: "follow" });
    if (!res.ok) {
      return { ok: false, error: "No se pudo leer la hoja. Compártela como 'Cualquier persona con el enlace puede ver'." };
    }
    const text = await res.text();
    // Google returns an HTML login page (not CSV) when the sheet isn't public.
    if (text.trimStart().startsWith("<")) {
      return { ok: false, error: "La hoja no es pública. Compártela como 'Cualquier persona con el enlace puede ver'." };
    }
    return { ok: true, grid: parseCsv(text) };
  } catch {
    return { ok: false, error: "Error al conectar con Google Sheets" };
  }
}

/** Parses a spreadsheet cell value into a number, stripping $ , % and spaces. */
export function parseCellNumber(raw: string | undefined): number | null {
  if (raw === undefined || raw === null) return null;
  const cleaned = String(raw).replace(/[$,%\s]/g, "");
  if (cleaned === "") return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Converts a 0-based column index to a spreadsheet letter (0→A, 1→B, 26→AA). */
export function colLetter(col: number): string {
  let s = "";
  let n = col;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}
