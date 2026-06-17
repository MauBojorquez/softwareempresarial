"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
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
    <div className="min-h-screen">
      <header className="border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary" />
            <span className="text-xl font-bold">MetrixPro</span>
          </Link>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Iniciar Sesión
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold">Planes y Precios</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            14 días de prueba gratis. Sin tarjeta de crédito.
          </p>

          <div className="mt-8 inline-flex items-center rounded-lg border p-1">
            <button
              onClick={() => setAnnual(false)}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                !annual ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              Mensual
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                annual ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              )}
            >
              Anual <span className="text-xs opacity-75">(-17%)</span>
            </button>
          </div>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative rounded-2xl border p-8",
                plan.popular && "border-primary shadow-lg"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-medium text-primary-foreground">
                  Más Popular
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
                  "mt-6 block w-full rounded-lg py-3 text-center text-sm font-medium",
                  plan.popular
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "border hover:bg-accent"
                )}
              >
                Comenzar Prueba Gratis
              </Link>
              <ul className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    {feature}
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
