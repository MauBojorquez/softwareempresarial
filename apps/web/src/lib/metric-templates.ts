// Shared catalog of metric templates per category. Used by the CSV cell mapper
// so users can map an exact spreadsheet cell to the right metric.

export type MetricCategoryKey = "FINANCE" | "SALES" | "OPERATIONS" | "HR" | "MARKETING";

export type MetricTemplate = {
  name: string;
  unit: string;
  /**
   * If true, this metric is derived automatically from other metrics and
   * cannot be entered manually. The formula is evaluated client-side.
   * Format: "A - B" or "A + B" (names of other metrics in the same category).
   */
  computed?: string;
};

export const CATEGORY_LABELS: Record<MetricCategoryKey, string> = {
  FINANCE: "Finanzas",
  SALES: "Ventas",
  OPERATIONS: "Operaciones",
  HR: "Recursos Humanos",
  MARKETING: "Marketing",
};

export const CATEGORY_TEMPLATES: Record<MetricCategoryKey, MetricTemplate[]> = {
  FINANCE: [
    { name: "Ingresos", unit: "MXN" },
    { name: "Gastos", unit: "MXN" },
    { name: "Cuentas por Cobrar", unit: "MXN" },
    { name: "Cuentas por Pagar", unit: "MXN" },
    // Computed automatically — never entered manually.
    { name: "Flujo de Caja", unit: "MXN", computed: "Ingresos - Gastos" },
  ],
  SALES: [
    { name: "Ventas del Mes", unit: "MXN" },
    { name: "Deals Cerrados", unit: "unidades" },
    { name: "Nuevos Leads", unit: "unidades" },
    { name: "Pipeline Total", unit: "MXN" },
    { name: "Ticket Promedio", unit: "MXN" },
  ],
  OPERATIONS: [
    // Cartera de Clientes
    { name: "Proyectos", unit: "MXN" },
    { name: "Valor Cartera", unit: "MXN" },
    // Operacional
    { name: "Tareas Completadas", unit: "unidades" },
    { name: "Incidencias", unit: "unidades" },
    { name: "Tiempo Promedio (días)", unit: "días" },
    { name: "Eficiencia (%)", unit: "%" },
    { name: "SLA Cumplimiento (%)", unit: "%" },
    { name: "Costo por Operación", unit: "MXN" },
  ],
  HR: [
    { name: "Headcount", unit: "personas" },
    { name: "Nuevas Contrataciones", unit: "personas" },
    { name: "Bajas", unit: "personas" },
    { name: "Rotación (%)", unit: "%" },
    { name: "Satisfacción (1-10)", unit: "pts" },
    { name: "Costo Nómina", unit: "MXN" },
  ],
  MARKETING: [
    { name: "Gasto en Ads", unit: "MXN" },
    { name: "Clics", unit: "unidades" },
    { name: "Impresiones", unit: "unidades" },
    { name: "Alcance", unit: "unidades" },
    { name: "Conversiones", unit: "unidades" },
    { name: "Costo por Lead", unit: "MXN" },
    { name: "ROAS", unit: "x" },
  ],
};

export const ALL_CATEGORIES = Object.keys(CATEGORY_TEMPLATES) as MetricCategoryKey[];

// Maps a category to the section permission key used in Membership.allowedSections.
export const CATEGORY_SECTION: Record<MetricCategoryKey, string> = {
  FINANCE: "FINANCE",
  SALES: "SALES",
  OPERATIONS: "OPERATIONS",
  HR: "HR",
  MARKETING: "MARKETING",
};

/**
 * Evaluates a computed metric formula ("A - B" or "A + B") given a function
 * that returns the current month's sum for any metric name.
 */
export function evalFormula(formula: string, getValue: (name: string) => number): number {
  const parts = formula.match(/^(.+?)\s*([-+])\s*(.+)$/);
  if (!parts) return 0;
  const [, a, op, b] = parts;
  const va = getValue(a.trim());
  const vb = getValue(b.trim());
  return op === "-" ? va - vb : va + vb;
}
