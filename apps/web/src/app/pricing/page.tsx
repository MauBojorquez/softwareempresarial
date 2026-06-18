"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Starter",
    description: "Para emprendedores y negocios pequeños",
    monthlyPrice: 799,
    annualPrice: 7990,
    features: [
      "Dashboard ejecutivo",
      "1 integración (QuickBooks o HubSpot)",
      "Métricas financieras y ventas",
      "Reporte IA mensual",
      "1 usuario",
    ],
  },
  {
    name: "Professional",
    description: "Para empresas en crecimiento",
    monthlyPrice: 1999,
    annualPrice: 19990,
    popular: true,
    features: [
      "Todo en Starter",
      "Integraciones ilimitadas",
      "Todas las categorías de métricas",
      "Reportes IA semanales",
      "Hasta 5 usuarios",
      "Dashboards personalizados",
    ],
  },
  {
    name: "Enterprise",
    description: "Para corporativos y grandes empresas",
    monthlyPrice: 4999,
    annualPrice: 49990,
    features: [
      "Todo en Professional",
      "API personalizada",
      "Usuarios ilimitados",
      "Reportes IA on-demand",
      "Soporte prioritario",
      "SSO / SAML",
    ],
  },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 z-50 w-full border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg gradient-bg" />
            <span className="text-lg font-bold">MetrixPro</span>
          </Link>
          <Link href="/login" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Iniciar Sesión
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 pt-32 pb-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Planes y <span className="gradient-text">Precios</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            14 días de prueba gratis. Sin tarjeta de crédito.
          </p>

          <div className="mt-8 inline-flex items-center rounded-xl border border-border bg-secondary/50 p-1">
            <button
              onClick={() => setAnnual(false)}
              className={cn(
                "rounded-lg px-5 py-2 text-sm font-medium transition-all",
                !annual ? "gradient-bg text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Mensual
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn(
                "rounded-lg px-5 py-2 text-sm font-medium transition-all",
                annual ? "gradient-bg text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Anual <span className="text-xs opacity-75">(-17%)</span>
            </button>
          </div>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative rounded-2xl border bg-card p-8 transition-all",
                plan.popular
                  ? "border-primary/30 glow"
                  : "border-border hover:border-border"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1.5 rounded-full gradient-bg px-4 py-1 text-xs font-medium text-white">
                    <Sparkles className="h-3 w-3" />
                    Más Popular
                  </div>
                </div>
              )}
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              <div className="mt-6">
                <span className="text-4xl font-bold">
                  ${(annual ? plan.annualPrice / 12 : plan.monthlyPrice).toLocaleString("es-MX")}
                </span>
                <span className="text-muted-foreground"> MXN/mes</span>
              </div>
              {annual && (
                <p className="mt-1 text-xs text-muted-foreground">
                  ${plan.annualPrice.toLocaleString("es-MX")} MXN facturado anualmente
                </p>
              )}
              <Link
                href="/register"
                className={cn(
                  "mt-6 block w-full rounded-xl py-3 text-center text-sm font-medium transition-all",
                  plan.popular
                    ? "gradient-bg text-white hover:opacity-90"
                    : "border border-border bg-secondary/50 hover:bg-secondary"
                )}
              >
                Comenzar Prueba Gratis
              </Link>
              <ul className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2.5 text-sm">
                    <div className="rounded-full bg-primary/10 p-0.5">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
