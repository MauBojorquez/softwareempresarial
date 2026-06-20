"use client";

import { useState } from "react";
import { Settings2, Clock, CheckCircle, AlertTriangle, Briefcase, Wallet } from "lucide-react";
import { MetricsDashboard } from "@/components/dashboard/metrics-page";
import { CATEGORY_TEMPLATES } from "@/lib/metric-templates";
import { cn } from "@/lib/utils";

const ALL_TEMPLATES = CATEGORY_TEMPLATES.OPERATIONS;
const CARTERA_NAMES = ["Proyectos", "Valor Cartera"];
const OPERACIONAL_NAMES = ["Tareas Completadas", "Incidencias", "Tiempo Promedio (días)", "Eficiencia (%)", "SLA Cumplimiento (%)", "Costo por Operación"];

const CARTERA_TEMPLATES = ALL_TEMPLATES.filter((t) => CARTERA_NAMES.includes(t.name));
const OPERACIONAL_TEMPLATES = ALL_TEMPLATES.filter((t) => OPERACIONAL_NAMES.includes(t.name));

const ICON_MAP_CARTERA: Record<string, typeof Briefcase> = {
  Proyectos: Briefcase,
  "Valor Cartera": Wallet,
};

const ICON_MAP_OPERACIONAL: Record<string, typeof Settings2> = {
  "Tareas Completadas": CheckCircle,
  Incidencias: AlertTriangle,
  "Tiempo Promedio (días)": Clock,
  "Eficiencia (%)": Settings2,
  "SLA Cumplimiento (%)": CheckCircle,
  "Costo por Operación": Settings2,
};

type Tab = "cartera" | "operacional";

export default function OperationsPage() {
  const [tab, setTab] = useState<Tab>("cartera");

  return (
    <div className="space-y-5">
      {/* Tab switcher */}
      <div className="flex gap-1 rounded-xl border border-border bg-card p-1 w-fit">
        <button
          onClick={() => setTab("cartera")}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
            tab === "cartera" ? "gradient-bg text-white" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Cartera de Clientes
        </button>
        <button
          onClick={() => setTab("operacional")}
          className={cn(
            "rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
            tab === "operacional" ? "gradient-bg text-white" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Operacional
        </button>
      </div>

      {tab === "cartera" ? (
        <MetricsDashboard
          key="cartera"
          title="Cartera de Clientes"
          subtitle="Proyectos activos y clientes de acompañamiento mensual"
          category="OPERATIONS"
          templates={CARTERA_TEMPLATES}
          defaultSelected={["Proyectos", "Valor Cartera"]}
          iconMap={ICON_MAP_CARTERA}
          defaultIcon={Briefcase}
          activityLabel="Operaciones - Cartera"
          emptyTitle="Sin datos de cartera"
          emptySubtitle="Registra proyectos activos y el valor de tu cartera de clientes de acompañamiento mensual."
          hideTitle
        />
      ) : (
        <MetricsDashboard
          key="operacional"
          title="Operacional"
          subtitle="Eficiencia, SLA y tareas del equipo"
          category="OPERATIONS"
          templates={OPERACIONAL_TEMPLATES}
          defaultSelected={["Eficiencia (%)", "Tiempo Promedio (días)", "Tareas Completadas", "Incidencias"]}
          iconMap={ICON_MAP_OPERACIONAL}
          defaultIcon={Settings2}
          activityLabel="Operaciones - Operacional"
          emptyTitle="Sin datos operacionales"
          emptySubtitle="Registra métricas de eficiencia, SLA y tareas completadas para dar seguimiento al equipo."
          hideTitle
        />
      )}
    </div>
  );
}
