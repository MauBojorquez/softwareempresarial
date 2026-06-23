/**
 * "Cashflow-only" demo mode.
 *
 * When the env var NEXT_PUBLIC_CASHFLOW_ONLY is set to "true", the app hides
 * every module except Flujo de Efectivo: the sidebar/bottom-nav only show the
 * cashflow section, the brand label is hidden, and any other /dashboard route
 * redirects to the cashflow page. Nothing is deleted — flipping the flag off
 * (the default) restores the full product exactly as before.
 *
 * Intended for a separate deployment used only for the webinar demo, so the
 * production app is never affected.
 */
export const CASHFLOW_ONLY =
  process.env.NEXT_PUBLIC_CASHFLOW_ONLY === "true";

/** Where every route redirects to in cashflow-only mode. */
export const CASHFLOW_HOME = "/dashboard/finance/cashflow";
