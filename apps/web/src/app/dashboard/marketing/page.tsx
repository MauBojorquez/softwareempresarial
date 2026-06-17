import { Megaphone, MousePointerClick, DollarSign, Users } from "lucide-react";
import { MetricCard } from "@/components/dashboard/metric-card";

export default function MarketingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Marketing</h1>
        <p className="text-sm text-muted-foreground">Rendimiento de campañas y adquisición</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard title="Leads Generados" value={127} change={15.4} icon={Users} format="number" />
        <MetricCard title="CAC" value={3200} change={-8.6} icon={DollarSign} format="currency" />
        <MetricCard title="Tráfico Web" value="24.5K" icon={MousePointerClick} />
        <MetricCard title="ROI Marketing" value={340} change={12.0} icon={Megaphone} format="percentage" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-lg font-semibold">Canales de Adquisición</h3>
          <div className="mt-4 space-y-3">
            {[
              { channel: "Google Ads", leads: 45, spend: 58000, color: "bg-blue-500" },
              { channel: "LinkedIn", leads: 32, spend: 42000, color: "bg-sky-500" },
              { channel: "Orgánico", leads: 28, spend: 0, color: "bg-emerald-500" },
              { channel: "Referidos", leads: 22, spend: 15000, color: "bg-purple-500" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between border-b pb-3 last:border-0">
                <div className="flex items-center gap-3">
                  <div className={`h-3 w-3 rounded-full ${item.color}`} />
                  <div>
                    <p className="text-sm font-medium">{item.channel}</p>
                    <p className="text-xs text-muted-foreground">{item.leads} leads</p>
                  </div>
                </div>
                <span className="text-sm">
                  {item.spend > 0
                    ? new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(item.spend)
                    : "Gratis"}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h3 className="text-lg font-semibold">Campañas Activas</h3>
          <div className="mt-4 space-y-3">
            {[
              { name: "Q2 Lead Gen", status: "Activa", budget: 85000, spent: 58000 },
              { name: "Brand Awareness", status: "Activa", budget: 50000, spent: 32000 },
              { name: "Webinar Series", status: "Pausada", budget: 25000, spent: 12000 },
            ].map((item, i) => (
              <div key={i} className="space-y-2 border-b pb-3 last:border-0">
                <div className="flex justify-between">
                  <span className="text-sm font-medium">{item.name}</span>
                  <span className={`text-xs ${item.status === "Activa" ? "text-emerald-600" : "text-amber-600"}`}>
                    {item.status}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-primary"
                    style={{ width: `${(item.spent / item.budget) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  ${(item.spent / 1000).toFixed(0)}k / ${(item.budget / 1000).toFixed(0)}k gastado
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
