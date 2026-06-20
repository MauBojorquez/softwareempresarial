// Shared catalog of metric templates per category. Used by the CSV cell mapper
// so users can map an exact spreadsheet cell to the right metric.

export type MetricCategoryKey = "FINANCE" | "SALES" | "OPERATIONS" | "HR" | "MARKETING";

export type MetricTemplate = { name: string; unit: string };

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
    { name: "Flujo de Caja", unit: "MXN" },
  ],
  SALES: [
    { name: "Ventas del Mes", unit: "MXN" },
    { name: "Deals Cerrados", unit: "unidades" },
    { name: "Nuevos Leads", unit: "unidades" },
    { name: "Pipeline Total", unit: "MXN" },
    { name: "Ticket Promedio", unit: "MXN" },
  ],
  OPERATIONS: [
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
// (They happen to be identical, but this keeps the intent explicit.)
export const CATEGORY_SECTION: Record<MetricCategoryKey, string> = {
  FINANCE: "FINANCE",
  SALES: "SALES",
  OPERATIONS: "OPERATIONS",
  HR: "HR",
  MARKETING: "MARKETING",
};
