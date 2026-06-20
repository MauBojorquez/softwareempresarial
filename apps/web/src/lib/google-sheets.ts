// Helpers to read a spreadsheet CSV (exported manually by the user) as a grid
// of cells. Nothing is fetched from the network and nothing is made public —
// the user exports their sheet to CSV and uploads the file directly.

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

/**
 * Parses a spreadsheet cell value into a number. Strips currency/percent symbols
 * and handles both US ("1,234.56") and es-MX ("1.234,56") number formats, which
 * matters because Mexican Excel/Sheets exports often use comma as the decimal.
 */
export function parseCellNumber(raw: string | undefined): number | null {
  if (raw === undefined || raw === null) return null;
  let s = String(raw).trim().replace(/[$%\s]/g, "");
  if (s === "") return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    // Both present: the right-most symbol is the decimal separator.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", "."); // es: 1.234,56
    else s = s.replace(/,/g, ""); // us: 1,234.56
  } else if (lastComma > -1) {
    // Only commas. A single comma not acting as a thousands group (≠3 trailing
    // digits) is treated as a decimal separator; otherwise it's a group.
    const trailing = s.length - lastComma - 1;
    const commaCount = (s.match(/,/g) || []).length;
    s = commaCount === 1 && trailing !== 3 ? s.replace(",", ".") : s.replace(/,/g, "");
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Converts a 0-based column index to a spreadsheet letter (0→A, 1→B, 26→AA). */
export function colLetter(col: number): string {
  let s = "";
  let n = col;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}
