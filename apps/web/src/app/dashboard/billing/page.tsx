"use client";

import { useEffect, useState } from "react";
import { CreditCard, Check, Sparkles, ArrowRight, Loader2, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toast";

const plans = [
  {
    key: "FREE",
    name: "Gratis",
    price: 0,
    annualPrice: 0,
    features: ["1 usuario", "Carga manual de métricas", "Finanzas, Ventas y Marketing", "Sin integraciones", "Sin reportes ni chat IA"],
  },
  {
    key: "STARTER",
    name: "Starter",
    price: 799,
    annualPrice: 7990,
    features: ["3 integraciones (CRM, ERP, Meta)", "Finanzas, Ventas y Marketing", "Reporte IA mensual", "3 usuarios"],
  },
  {
    key: "PROFESSIONAL",
    name: "Professional",
    price: 1999,
    annualPrice: 19990,
    features: ["10 integraciones", "Todas las métricas", "Reportes IA semanales", "10 usuarios", "Dashboards personalizados"],
  },
  {
    key: "ENTERPRISE",
    name: "Enterprise",
    price: 4999,
    annualPrice: 49990,
    features: ["Todo en Pro", "API personalizada", "Usuarios ilimitados", "IA on-demand", "SSO/SAML", "Soporte prioritario"],
  },
];

export default function BillingPage() {
  const { toast } = useToast();
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [interval, setInterval] = useState<"MONTHLY" | "ANNUAL">("MONTHLY");
  const [usage, setUsage] = useState<any>(null);

  useEffect(() => {
    fetch("/api/billing/plan")
      .then((r) => r.json())
      .then((data) => {
        setCurrentPlan(data.plan || null);
        setUsage(data.usage || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleSelectFree = async () => {
    setCheckoutLoading("FREE");
    try {
      const res = await fetch("/api/billing/free", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setCurrentPlan("FREE");
        toast("Cambiaste al plan Gratis", "success");
      } else {
        toast(data.error || "Error al cambiar de plan", "error");
      }
    } catch {
      toast("Error de conexión", "error");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handleCheckout = async (plan: string) => {
    setCheckoutLoading(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else toast(data.error || "Error al crear sesión de pago", "error");
    } catch {
      toast("Error de conexión", "error");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else toast(data.error || "Error al abrir portal", "error");
    } catch {
      toast("Error de conexión", "error");
    } finally {
      setPortalLoading(false);
    }
  };

  const handleSyncStripe = async () => {
    setSyncLoading(true);
    try {
      const res = await fetch("/api/billing/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setCurrentPlan(data.plan);
        toast(`Plan actualizado a ${data.plan}`, "success");
      } else {
        toast(data.error || "Error al sincronizar", "error");
      }
    } catch {
      toast("Error de conexión", "error");
    } finally {
      setSyncLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Suscripción</h1>
          <p className="text-sm text-muted-foreground">Gestiona tu plan y facturación</p>
        </div>
        <button
          onClick={handleSyncStripe}
          disabled={syncLoading}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary disabled:opacity-50 transition-colors"
          title="Sincronizar estado real desde Stripe"
        >
          {syncLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Sincronizar con Stripe
        </button>
      </div>

      {currentPlan && (
        <div className="rounded-xl border border-primary/15 bg-card p-4 sm:p-6 glow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">Plan {currentPlan}</h3>
                <span className="rounded-full gradient-bg px-2.5 py-0.5 text-[10px] font-bold text-white">ACTIVO</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">Facturación mensual</p>
            </div>
            <button
              onClick={handlePortal}
              disabled={portalLoading}
              className="flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-2 sm:px-4 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
            >
              {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Gestionar Facturación
            </button>
          </div>

          {usage && (
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Integraciones</p>
                <p className="mt-1 text-sm font-semibold">{usage.integrations} activas</p>
              </div>
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Usuarios</p>
                <p className="mt-1 text-sm font-semibold">{usage.users} activos</p>
              </div>
              <div className="rounded-lg bg-secondary/50 p-3">
                <p className="text-xs text-muted-foreground">Reportes IA este mes</p>
                <p className="mt-1 text-sm font-semibold">{usage.aiReports} generados</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{currentPlan ? "Cambiar Plan" : "Selecciona un Plan"}</h3>
          <div className="flex items-center gap-1 rounded-lg border border-border bg-secondary/50 p-1">
            <button
              onClick={() => setInterval("MONTHLY")}
              className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", interval === "MONTHLY" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground")}
            >
              Mensual
            </button>
            <button
              onClick={() => setInterval("ANNUAL")}
              className={cn("rounded-md px-3 py-1 text-xs font-medium transition-colors", interval === "ANNUAL" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground")}
            >
              Anual <span className="text-emerald-600">-17%</span>
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const isCurrent = currentPlan === plan.key || currentPlan === plan.name;
            const price = interval === "MONTHLY" ? plan.price : plan.annualPrice;
            const isLoading = checkoutLoading === plan.key;
            const isFree = plan.key === "FREE";

            return (
              <div
                key={plan.key}
                className={cn(
                  "rounded-xl border p-4 sm:p-6 transition-all",
                  isCurrent ? "border-primary/30 bg-primary/5" : "border-border bg-card hover:border-border"
                )}
              >
                <h4 className="font-semibold">{plan.name}</h4>
                <p className="mt-1">
                  {isFree ? (
                    <span className="text-2xl font-bold">Gratis</span>
                  ) : (
                    <>
                      <span className="text-2xl font-bold">${price.toLocaleString()}</span>
                      <span className="text-sm text-muted-foreground"> MXN /{interval === "MONTHLY" ? "mes" : "año"}</span>
                    </>
                  )}
                </p>
                <ul className="mt-4 space-y-2">
                  {plan.features.map((f) => {
                    const negative = f.startsWith("Sin ");
                    return (
                      <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                        {negative ? <X className="h-3.5 w-3.5 text-red-500 shrink-0" /> : <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        {f}
                      </li>
                    );
                  })}
                </ul>
                {isCurrent ? (
                  <div className="mt-4 rounded-lg border border-primary/15 py-2 text-center text-sm font-medium text-primary">
                    Plan Actual
                  </div>
                ) : isFree ? (
                  <button
                    onClick={handleSelectFree}
                    disabled={isLoading}
                    className="mt-4 flex w-full items-center justify-center gap-1 rounded-lg border border-border bg-secondary/50 py-2 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Usar plan Gratis"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleCheckout(plan.key)}
                    disabled={isLoading}
                    className="mt-4 flex w-full items-center justify-center gap-1 rounded-lg gradient-bg py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Suscribirse
                        <ArrowRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="hidden lg:block rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="p-3 text-left font-medium text-muted-foreground">Funcionalidad</th>
                {plans.map((p) => (
                  <th key={p.key} className="p-3 text-center font-medium">{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { name: "Integraciones", values: ["—", "3", "10", "Ilimitadas"] },
                { name: "Usuarios", values: ["1", "3", "10", "Ilimitados"] },
                { name: "Carga manual", values: ["✓", "✓", "✓", "✓"] },
                { name: "Reportes IA", values: ["—", "Mensual", "Semanal", "On-demand"] },
                { name: "Chat IA", values: ["—", "—", "✓", "✓"] },
                { name: "Dashboards", values: ["1", "1", "Múltiples", "Ilimitados"] },
                { name: "API Personalizada", values: ["—", "—", "—", "✓"] },
                { name: "SSO / SAML", values: ["—", "—", "—", "✓"] },
                { name: "Soporte", values: ["—", "Email", "Email + Chat", "Prioritario"] },
              ].map((row) => (
                <tr key={row.name} className="border-b border-border last:border-0">
                  <td className="p-3 text-muted-foreground">{row.name}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="p-3 text-center font-medium">
                      {v === "✓" ? <Check className="h-4 w-4 text-emerald-500 mx-auto" /> : v === "—" ? <span className="text-muted-foreground">—</span> : v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-600" />
          <h3 className="font-semibold">Gestionar método de pago y facturas</h3>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Accede al portal de Stripe para ver facturas, cambiar método de pago y descargar recibos.
        </p>
        <button
          onClick={handlePortal}
          disabled={portalLoading}
          className="mt-3 rounded-lg border border-border bg-secondary/50 px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50"
        >
          {portalLoading ? "Abriendo..." : "Abrir Portal de Facturación"}
        </button>
      </div>

      <p className="text-center text-sm text-muted-foreground">
        ¿Tienes dudas? Consulta nuestras{" "}
        <Link href="/pricing" className="text-primary hover:underline font-medium">
          preguntas frecuentes
        </Link>
      </p>
    </div>
  );
}
