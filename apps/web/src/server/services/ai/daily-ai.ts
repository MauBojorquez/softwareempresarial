import Anthropic from "@anthropic-ai/sdk";

// Model for the daily automations. Overridable from the environment so it can
// be changed without a deploy of new code.
const MODEL = process.env.AI_DAILY_MODEL || "claude-opus-5-5";

let client: Anthropic | null = null;
function anthropic(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

type JsonSchema = Record<string, unknown>;

/**
 * Calls Claude with structured outputs (output_config.format) so the reply is
 * guaranteed to be JSON matching `schema`. Thinking is always on for this
 * model and counts toward max_tokens, hence the generous cap; effort "low"
 * keeps each run well inside Vercel's 60s function limit.
 * The installed SDK (0.39) predates output_config in its types, so the field
 * is passed through untyped — the API accepts it as-is.
 */
async function askJson<T>(system: string, user: string, schema: JsonSchema): Promise<T> {
  const params = {
    model: MODEL,
    max_tokens: 16000,
    system,
    messages: [{ role: "user" as const, content: user }],
    output_config: { effort: "low", format: { type: "json_schema", schema } },
  };
  const msg = await anthropic().messages.create(
    params as unknown as Anthropic.MessageCreateParamsNonStreaming,
  );
  // Old SDK types don't list "refusal"; compare as a plain string.
  const stop = msg.stop_reason as string | null;
  if (stop === "refusal") throw new Error("La IA declinó la solicitud (refusal)");
  if (stop === "max_tokens") throw new Error("La IA se quedó sin espacio (max_tokens)");
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  if (!text) throw new Error(`La IA no devolvió texto (stop_reason: ${stop})`);
  return JSON.parse(text) as T;
}

const S = { type: "string" };
const strArr = { type: "array", items: S };
const itemArr = {
  type: "array",
  items: {
    type: "object",
    properties: { texto: S, fuente: S },
    required: ["texto", "fuente"],
    additionalProperties: false,
  },
};

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const strList = (v: unknown, max = 12) =>
  (Array.isArray(v) ? v : []).map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean).slice(0, max);

// ─── Consolidado del equipo (para Dirección) ────────────────────────

export type ConsolidadoAI = { resumen: string; destacados: string[]; alertas: string[] };

export async function summarizeConsolidado(input: {
  periodoTexto: string;
  reportesTexto: string;
  faltantes: string[];
  contextoTexto: string;
}): Promise<ConsolidadoAI> {
  const system = `Eres el analista de operaciones de Stratium, una agencia pequeña (5 personas) en México.
Cada colaborador envía un reporte diario con números de su área. Tu trabajo es leerlos juntos y darle al
director un resumen ejecutivo muy breve y accionable, en español de México, tono directo y sin relleno.
Reglas:
- Usa SOLO los datos que te doy. No inventes cifras ni personas.
- Si un dato es cero o se ve bajo frente al contexto del mes, dilo.
- Las alertas son cosas que el director debería atender hoy.
Responde ÚNICAMENTE con un objeto JSON con esta forma:
{"resumen": "2 a 4 frases", "destacados": ["..."], "alertas": ["..."]}
Máximo 5 destacados y 5 alertas, cada uno de una línea.`;
  const user = `Periodo: ${input.periodoTexto}

REPORTES DEL EQUIPO:
${input.reportesTexto || "(nadie envió reporte)"}

NO ENVIARON REPORTE: ${input.faltantes.length ? input.faltantes.join(", ") : "todos enviaron"}

CONTEXTO DEL MES:
${input.contextoTexto}`;
  const r = await askJson<Record<string, unknown>>(system, user, {
    type: "object",
    properties: { resumen: S, destacados: strArr, alertas: strArr },
    required: ["resumen", "destacados", "alertas"],
    additionalProperties: false,
  });
  return { resumen: str(r.resumen), destacados: strList(r.destacados, 5), alertas: strList(r.alertas, 5) };
}

// ─── Pendientes personales (9:50am) ─────────────────────────────────

export type PendienteItem = { texto: string; fuente: string };
export type PendientesAI = {
  resumen: string;
  prioridades: string[];
  compromisos: PendienteItem[];
  seguimientos: PendienteItem[];
  incongruencias: string[];
};

function items(v: unknown, max = 15): PendienteItem[] {
  return (Array.isArray(v) ? v : [])
    .map((x) => (x && typeof x === "object" ? (x as Record<string, unknown>) : {}))
    .map((x) => ({ texto: str(x.texto), fuente: str(x.fuente) }))
    .filter((x) => x.texto)
    .slice(0, max);
}

export async function buildPendientes(input: {
  nombre: string;
  puesto: string;
  hoyTexto: string;
  appTexto: string;
  correosTexto: string | null;
  sesionesTexto: string | null;
}): Promise<PendientesAI> {
  const system = `Eres el asistente personal de pendientes de un colaborador de Stratium (agencia en México).
Cada mañana le preparas su lista de pendientes en español de México, tono directo y amable, sin relleno.
Recibes: datos de la app (tareas, rocas, meta, su reporte de ayer) y, si los hay, extractos de sus correos
y de las notas/transcripciones de sus reuniones de Google Meet.
Tu trabajo:
1. COMPROMISOS: cosas que ESTA persona prometió o le pidieron hacer (en correos o reuniones) y que siguen abiertas.
2. SEGUIMIENTOS: conversaciones que esperan una respuesta o acción suya (alguien le escribió y no ha contestado,
   o quedó en dar seguimiento).
3. INCONGRUENCIAS: cosas que no cuadran entre fuentes. Ej.: su reporte dice que avanzó algo pero la roca no se
   movió; prometió algo por correo que no tiene tarea en la app; una roca va atrasada y no aparece en su trabajo.
4. PRIORIDADES: las 3 cosas más importantes para HOY, considerando todo.
Reglas:
- Usa SOLO la información que te doy; no inventes. Si no hay correos o reuniones, no inventes compromisos.
- Ignora boletines, promociones, notificaciones automáticas y spam.
- En "fuente" pon de dónde salió, corto: "Correo de Juan Pérez (lun)", "Reunión con Acme", "App".
- No repitas como compromiso algo que ya es una tarea de la app.
Responde ÚNICAMENTE con un objeto JSON con esta forma:
{"resumen": "1 o 2 frases", "prioridades": ["..."], "compromisos": [{"texto": "...", "fuente": "..."}],
 "seguimientos": [{"texto": "...", "fuente": "..."}], "incongruencias": ["..."]}`;
  const user = `Colaborador: ${input.nombre} (${input.puesto})
Hoy es ${input.hoyTexto}.

DATOS DE LA APP:
${input.appTexto}

CORREOS RECIENTES:
${input.correosTexto ?? "(Google no conectado: no hay correos disponibles)"}

NOTAS Y TRANSCRIPCIONES DE REUNIONES:
${input.sesionesTexto ?? "(Google no conectado: no hay reuniones disponibles)"}`;
  const r = await askJson<Record<string, unknown>>(system, user, {
    type: "object",
    properties: {
      resumen: S,
      prioridades: strArr,
      compromisos: itemArr,
      seguimientos: itemArr,
      incongruencias: strArr,
    },
    required: ["resumen", "prioridades", "compromisos", "seguimientos", "incongruencias"],
    additionalProperties: false,
  });
  return {
    resumen: str(r.resumen),
    prioridades: strList(r.prioridades, 3),
    compromisos: items(r.compromisos),
    seguimientos: items(r.seguimientos),
    incongruencias: strList(r.incongruencias, 8),
  };
}
