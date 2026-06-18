"use client";

import { Settings2, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";

export default function OperationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Operaciones</h1>
        <p className="text-sm text-muted-foreground">Eficiencia operativa</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Eficiencia" value={87.3} change={2.1} icon={Settings2} format="percentage" />
        <MetricCard title="Tiempo Promedio" value="4.2 días" icon={Clock} />
        <MetricCard title="Tareas Completadas" value={156} change={12.5} icon={CheckCircle} format="number" />
        <MetricCard title="Incidencias" value={3} change={-40.0} icon={AlertTriangle} format="number" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold">Proyectos Activos</h3>
          <div className="mt-4 space-y-4">
            {[
              { name: "Migración ERP", progress: 75, status: "En tiempo" },
              { name: "Rediseño Web", progress: 45, status: "En tiempo" },
              { name: "Expansión CDMX", progress: 90, status: "Retrasado" },
            ].map((project, i) => (
              <div key={i} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{project.name}</span>
                  <span className={project.status === "Retrasado" ? "text-red-500" : "text-emerald-600"}>
                    {project.status}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary/50">
                  <div className="h-2 rounded-full gradient-bg" style={{ width: `${project.progress}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-6">
          <h3 className="text-lg font-semibold">KPIs Operativos</h3>
          <div className="mt-4 space-y-3">
            {[
              { kpi: "SLA Cumplimiento", value: "98.5%", target: "99%" },
              { kpi: "Tiempo de Respuesta", value: "2.1 hrs", target: "< 4 hrs" },
              { kpi: "Utilización de Recursos", value: "82%", target: "85%" },
              { kpi: "Costo por Operación", value: "$1,250", target: "< $1,500" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
                <span className="text-sm">{item.kpi}</span>
                <div className="text-right">
                  <span className="text-sm font-semibold">{item.value}</span>
                  <span className="ml-2 text-xs text-muted-foreground">Meta: {item.target}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
