import { getAccessToken } from "./oauth";

// Limits keep each run inside Vercel's 60s window and the prompt reasonable.
const MAX_EMAILS = 40;
const EMAIL_BODY_CHARS = 1200;
const MAX_DOCS = 6;
const DOC_CHARS = 12000;

type GmailHeader = { name: string; value: string };
type GmailPart = { mimeType?: string; body?: { data?: string }; parts?: GmailPart[] };
type GmailMessage = {
  id: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart & { headers?: GmailHeader[] };
};

async function gget<T>(token: string, url: string): Promise<T> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Google ${res.status} en ${new URL(url).pathname}`);
  return (await res.json()) as T;
}

const b64 = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

/** First text/plain body found in a message (falls back to stripped HTML). */
function extractBody(part: GmailPart | undefined): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) return b64(part.body.data);
  for (const p of part.parts ?? []) {
    const t = extractBody(p);
    if (t) return t;
  }
  if (part.mimeType === "text/html" && part.body?.data) {
    return b64(part.body.data).replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ");
  }
  return "";
}

/** Drops quoted history ("El lun... escribió:") so only the new message remains. */
function cleanBody(text: string): string {
  const cut = text.search(/\n(?:El .{5,120} escribió:|On .{5,120} wrote:|-{2,} ?Mensaje original|From: )/);
  return (cut > 0 ? text.slice(0, cut) : text).replace(/\s+\n/g, "\n").replace(/[ \t]{2,}/g, " ").trim();
}

const fechaCorta = (ms: number) =>
  new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));

async function readEmails(token: string, since: Date): Promise<string> {
  const q = `after:${Math.floor(since.getTime() / 1000)} -category:promotions -category:social -category:forums -in:spam -in:trash`;
  const list = await gget<{ messages?: { id: string }[] }>(
    token,
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${MAX_EMAILS}&q=${encodeURIComponent(q)}`,
  );
  const ids = (list.messages ?? []).map((m) => m.id);
  if (ids.length === 0) return "(sin correos en el periodo)";

  const msgs = await Promise.all(
    ids.map((id) =>
      gget<GmailMessage>(token, `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`).catch(() => null),
    ),
  );

  return msgs
    .filter((m): m is GmailMessage => !!m)
    .sort((a, b) => Number(a.internalDate ?? 0) - Number(b.internalDate ?? 0))
    .map((m) => {
      const h = (n: string) => m.payload?.headers?.find((x) => x.name.toLowerCase() === n)?.value ?? "";
      const enviado = m.labelIds?.includes("SENT");
      const body = cleanBody(extractBody(m.payload) || m.snippet || "").slice(0, EMAIL_BODY_CHARS);
      return [
        `--- ${enviado ? "ENVIADO por ti" : "RECIBIDO"} · ${fechaCorta(Number(m.internalDate ?? 0))}`,
        `De: ${h("from")}`,
        `Para: ${h("to")}`,
        `Asunto: ${h("subject")}`,
        body,
      ].join("\n");
    })
    .join("\n\n");
}

async function readMeetNotes(token: string, since: Date): Promise<string> {
  // Gemini in Meet saves "Notas de Gemini" / "Transcripción" as Google Docs.
  const q = [
    `modifiedTime > '${since.toISOString()}'`,
    "mimeType = 'application/vnd.google-apps.document'",
    "trashed = false",
    "(name contains 'Gemini' or name contains 'Transcrip' or name contains 'Transcript')",
  ].join(" and ");
  const list = await gget<{ files?: { id: string; name: string; modifiedTime: string }[] }>(
    token,
    `https://www.googleapis.com/drive/v3/files?pageSize=${MAX_DOCS}&orderBy=modifiedTime desc` +
      `&fields=files(id,name,modifiedTime)&includeItemsFromAllDrives=true&supportsAllDrives=true&q=${encodeURIComponent(q)}`,
  );
  const files = list.files ?? [];
  if (files.length === 0) return "(sin notas ni transcripciones de reuniones en el periodo)";

  const docs = await Promise.all(
    files.map(async (f) => {
      try {
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${f.id}/export?mimeType=text/plain`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return null;
        const text = (await res.text()).replace(/\n{3,}/g, "\n\n").trim().slice(0, DOC_CHARS);
        return `=== ${f.name} (${fechaCorta(new Date(f.modifiedTime).getTime())})\n${text}`;
      } catch {
        return null;
      }
    }),
  );
  return docs.filter(Boolean).join("\n\n") || "(no se pudieron leer las notas de reuniones)";
}

/**
 * Reads the user's own recent email and Meet notes for the morning digest.
 * Returns null when the user has not connected Google (or access failed).
 * Nothing read here is persisted.
 */
export async function getGoogleContext(
  userId: string,
  since: Date,
): Promise<{ correosTexto: string; sesionesTexto: string; googleEmail: string; errores: string[] } | null> {
  const auth = await getAccessToken(userId);
  if (!auth) return null;

  const errores: string[] = [];
  const [correosTexto, sesionesTexto] = await Promise.all([
    readEmails(auth.token, since).catch((e) => {
      errores.push(`Gmail: ${e instanceof Error ? e.message : e}`);
      return "(no se pudieron leer los correos)";
    }),
    readMeetNotes(auth.token, since).catch((e) => {
      errores.push(`Drive: ${e instanceof Error ? e.message : e}`);
      return "(no se pudieron leer las notas de reuniones)";
    }),
  ]);
  return { correosTexto, sesionesTexto, googleEmail: auth.googleEmail, errores };
}
