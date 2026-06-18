"use client";

import { TrendingUp, Target, Users, ShoppingCart } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";
import { SalesPipelineChart } from "@/components/charts/sales-pipeline-chart";

export default function SalesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ventas</h1>
        <p className="text-sm text-muted-foreground">Métricas de ventas de HubSpot</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Pipeline Total" value={7410000} change={5.2} icon={TrendingUp} format="currency" />
        <MetricCard title="Deals Cerrados" value={8} change={14.3} icon={Target} format="number" />
        <MetricCard title="Nuevos Leads" value={45} change={8.1} icon={Users} format="number" />
        <MetricCard title="Conversión" value={17.8} change={-2.1} icon={ShoppingCart} format="percentage" />
      </div>

      <SalesPipelineChart />

      <div className="rounded-xl border border-border bg-card p-6">
        <h3 className="text-lg font-semibold">Deals Recientes</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-sm text-muted-foreground">
                <th className="pb-3 font-medium">Deal</th>
                <th className="pb-3 font-medium">Etapa</th>
                <th className="pb-3 font-medium">Valor</th>
                <th className="pb-3 font-medium">Cierre Esperado</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {[
                { name: "Proyecto Alpha", stage: "Cerrado", value: 180000, date: "2024-06-15", color: "text-emerald-600" },
                { name: "Implementación Beta", stage: "Negociación", value: 250000, date: "2024-07-01", color: "text-amber-600" },
                { name: "Consultoría Gamma", stage: "Propuesta", value: 95000, date: "2024-07-15", color: "text-primary" },
                { name: "Licencia Delta", stage: "Calificado", value: 320000, date: "2024-08-01", color: "text-muted-foreground" },
              ].map((deal, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-3 font-medium">{deal.name}</td>
                  <td className={`py-3 ${deal.color}`}>{deal.stage}</td>
                  <td className="py-3">
                    {new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(deal.value)}
                  </td>
                  <td className="py-3 text-muted-foreground">{deal.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
