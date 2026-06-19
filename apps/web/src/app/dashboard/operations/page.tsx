"use client";

import { Settings2, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { MetricsDashboard } from "@/components/dashboard/metrics-page";

const TEMPLATES = [
  { name: "Tareas Completadas", unit: "unidades" },
  { name: "Incidencias", unit: "unidades" },
  { name: "Tiempo Promedio (días)", unit: "días" },
  { name: "Eficiencia (%)", unit: "%" },
  { name: "SLA Cumplimiento (%)", unit: "%" },
  { name: "Costo por Operación", unit: "MXN" },
];

const ICON_MAP: Record<string, typeof Settings2> = {
  "Tareas Completadas": CheckCircle,
  Incidencias: AlertTriangle,
  "Tiempo Promedio (días)": Clock,
  "Eficiencia (%)": Settings2,
  "SLA Cumplimiento (%)": CheckCircle,
  "Costo por Operación": Settings2,
};

export default function OperationsPage() {
  return (
    <MetricsDashboard
      title="Operaciones"
      subtitle="Métricas operacionales"
      category="OPERATIONS"
      templates={TEMPLATES}
      defaultSelected={["Eficiencia (%)", "Tiempo Promedio (días)", "Tareas Completadas", "Incidencias"]}
      iconMap={ICON_MAP}
      defaultIcon={Settings2}
      activityLabel="Operaciones"
      emptyTitle="Sin datos de Operaciones"
      emptySubtitle="Registra métricas operacionales para dar seguimiento a eficiencia, SLA y tareas completadas."
    />
  );
}
