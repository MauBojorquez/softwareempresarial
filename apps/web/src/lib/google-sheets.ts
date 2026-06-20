// Helpers to read a public Google Sheet as a grid of cells (live, no OAuth).
// The sheet must be shared as "Anyone with the link can view".

/** Converts a Google Sheets URL to a CSV URL that a server can read.
 *
 * Handles two cases:
 *  1. "Publicar en la web" links (.../d/e/2PACX-.../pub...) — these are truly
 *     public (bypass Workspace sharing restrictions) and are returned as a CSV
 *     pub URL. This is the recommended path.
 *  2. Regular share links (.../d/{id}/edit) — converted to the export?format=csv
 *     endpoint as a fallback (only works if the file is public to anyone).
 */
export function toCsvUrl(url: string): string | null {
  const trimmed = url.trim();

  // Case 1 — "Publish to web" link: .../spreadsheets/d/e/{pubId}/pub...
  const pubMatch = trimmed.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9_-]+)\/pub/);
  if (pubMatch) {
    const pubId = pubMatch[1];
    const gidMatch = trimmed.match(/[?&#]gid=(\d+)/);
    const gid = gidMatch ? gidMatch[1] : null;
    let out = `https://docs.google.com/spreadsheets/d/e/${pubId}/pub?output=csv`;
    if (gid) out += `&single=true&gid=${gid}`;
    return out;
  }

  // Case 2 — regular share link: .../spreadsheets/d/{id}/edit
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  const id = match[1];
  const gidMatch = trimmed.match(/[?&#]gid=(\d+)/);
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

  const PUBLISH_HINT =
    "No se pudo leer la hoja. En Google Sheets ve a Archivo → Compartir → Publicar en la web → CSV, y pega ese enlace (el que termina en /pub).";

  try {
    const res = await fetch(csvUrl, {
      headers: {
        // A real browser User-Agent avoids Google rejecting server-side requests.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        Accept: "text/csv,text/plain,*/*",
      },
      redirect: "follow",
      cache: "no-store",
    });
    if (!res.ok) {
      return { ok: false, error: PUBLISH_HINT };
    }
    const text = await res.text();
    // Google returns an HTML login/error page (not CSV) when the sheet isn't public.
    if (text.trimStart().startsWith("<")) {
      return { ok: false, error: PUBLISH_HINT };
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
