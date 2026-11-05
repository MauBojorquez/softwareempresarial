import type { MetricCategory } from "@prisma/client";
import type { Resource } from "@/lib/access";

export const METRIC_CATEGORIES: MetricCategory[] = ["FINANCE", "SALES", "OPERATIONS", "HR", "MARKETING"];

export function isMetricCategory(v: unknown): v is MetricCategory {
  return typeof v === "string" && (METRIC_CATEGORIES as string[]).includes(v);
}

/**
 * RBAC resource that guards reading/writing generic Metric rows of a category.
 * FINANCE rows back the Finanzas panel (DIRECCION-only page), so they use
 * "dashboard_direccion". Categories without a dedicated area (OPERATIONS, HR)
 * are DIRECCION-only as well.
 */
export function metricResource(category: MetricCategory): Resource {
  switch (category) {
    case "SALES":
      return "ventas";
    case "MARKETING":
      return "marketing";
    case "FINANCE":
    case "OPERATIONS":
    case "HR":
    default:
      return "dashboard_direccion";
  }
}

export const FINANCE_MANUAL_ERROR =
  "Finanzas se alimenta automáticamente del SAT y del Flujo de Efectivo. No se permiten registros manuales.";
