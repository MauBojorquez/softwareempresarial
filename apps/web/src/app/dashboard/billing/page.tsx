"use client";

import { CreditCard, Check, Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Starter",
    price: 799,
    current: false,
    features: ["1 integración", "Métricas básicas", "Reporte IA mensual", "1 usuario"],
  },
  {
    name: "Professional",
    price: 1999,
    current: true,
    features: ["Integraciones ilimitadas", "Todas las métricas", "Reportes IA semanales", "5 usuarios", "Dashboards custom"],
  },
  {
    name: "Enterprise",
    price: 4999,
    current: false,
    features: ["Todo en Pro", "API personalizada", "Usuarios ilimitados", "IA on-demand", "SSO/SAML", "Soporte prioritario"],
  },
];

export default function BillingPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Suscripción</h1>
        <p className="text-sm text-muted-foreground">Gestiona tu plan y facturación</p>
      </div>

      <div className="rounded-xl border border-primary/20 bg-card p-6 glow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Plan Professional</h3>
              <span className="rounded-full gradient-bg px-2.5 py-0.5 text-[10px] font-bold text-white">ACTIVO</span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Facturación mensual</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">$1,999</p>
            <p className="text-sm text-muted-foreground">MXN / mes</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-xs text-muted-foreground">Próximo cobro</p>
            <p className="mt-1 text-sm font-semibold">15 Jul 2024</p>
          </div>
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-xs text-muted-foreground">Método de pago</p>
            <div className="mt-1 flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-semibold">•••• 4242</p>
            </div>
          </div>
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-xs text-muted-foreground">Usuarios activos</p>
            <p className="mt-1 text-sm font-semibold">3 de 5</p>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold">Cambiar Plan</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "rounded-xl border p-6 transition-all",
                plan.current
                  ? "border-primary/30 bg-primary/5"
                  : "border-white/5 bg-card hover:border-white/10"
              )}
            >
              <h4 className="font-semibold">{plan.name}</h4>
              <p className="mt-1">
                <span className="text-2xl font-bold">${plan.price.toLocaleString()}</span>
                <span className="text-sm text-muted-foreground"> /mes</span>
              </p>
              <ul className="mt-4 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-3.5 w-3.5 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              {plan.current ? (
                <div className="mt-4 rounded-lg border border-primary/20 py-2 text-center text-sm font-medium text-primary">
                  Plan Actual
                </div>
              ) : (
                <button className="mt-4 flex w-full items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/5 py-2 text-sm font-medium transition-colors hover:bg-white/10">
                  {plan.price > 1999 ? "Upgrade" : "Downgrade"}
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-card p-6">
        <h3 className="font-semibold">Historial de Facturación</h3>
        <div className="mt-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-muted-foreground">
                <th className="pb-3 font-medium">Fecha</th>
                <th className="pb-3 font-medium">Concepto</th>
                <th className="pb-3 font-medium">Monto</th>
                <th className="pb-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {[
                { date: "15 Jun 2024", concept: "Plan Professional - Mensual", amount: 1999, status: "Pagado" },
                { date: "15 May 2024", concept: "Plan Professional - Mensual", amount: 1999, status: "Pagado" },
                { date: "15 Abr 2024", concept: "Plan Professional - Mensual", amount: 1999, status: "Pagado" },
              ].map((inv, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  <td className="py-3 text-muted-foreground">{inv.date}</td>
                  <td className="py-3">{inv.concept}</td>
                  <td className="py-3 font-medium">${inv.amount.toLocaleString()} MXN</td>
                  <td className="py-3">
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                      {inv.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-white/5 bg-card p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <h3 className="font-semibold">¿Necesitas factura fiscal?</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Configurar datos fiscales para recibir CFDI automáticamente cada mes.
        </p>
        <button className="mt-3 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium transition-colors hover:bg-white/10">
          Configurar Datos Fiscales
        </button>
      </div>
    </div>
  );
}
