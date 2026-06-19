// Human-friendly Spanish labels for metric names, so reports read naturally
// for business owners (e.g. "pipeline_value" → "Dinero en pipeline").
//
// Used by the WhatsApp/email digest. Unknown names fall back to a humanizer
// that turns "some_metric_name" into "Some metric name".

const METRIC_LABELS: Record<string, string> = {
  // Ventas / CRM
  pipeline_value: "Dinero en pipeline",
  won_revenue: "Ingresos ganados",
  conversion_rate: "Porcentaje de conversión",
  total_deals: "Deals",
  closed_won_count: "Negocios ganados",
  closed_won_amount: "Monto ganado",
  open_deals: "Deals abiertos",
  avg_deal_size: "Ticket promedio",
  // Contactos
  total_contacts: "Contactos totales",
  new_contacts_month: "Contactos nuevos del mes",
  new_contacts: "Contactos nuevos",
  // Meta Ads
  meta_clicks: "Clics en Meta",
  meta_impressions: "Impresiones en Meta",
  meta_ctr: "CTR de Meta",
  meta_spend: "Gasto en Meta",
  meta_reach: "Alcance en Meta",
  meta_cpc: "Costo por clic (Meta)",
  meta_cpm: "Costo por mil (Meta)",
  meta_conversions: "Conversiones en Meta",
};

/** Turns a raw metric name into a readable label. */
export function metricLabel(name: string): string {
  if (METRIC_LABELS[name]) return METRIC_LABELS[name];
  const lower = name.toLowerCase();
  if (METRIC_LABELS[lower]) return METRIC_LABELS[lower];
  // Fallback: humanize snake_case / camelCase into "Sentence case".
  const spaced = name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  if (!spaced) return name;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
