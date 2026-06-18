import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2025-02-24.acacia",
    });
  }
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    return (getStripe() as any)[prop];
  },
});

export const PLANS = {
  STARTER: {
    name: "Starter",
    description: "Para emprendedores y negocios pequeños",
    features: [
      "Dashboard ejecutivo",
      "3 integraciones (CRM, ERP, Meta Ads)",
      "Finanzas, Ventas y Marketing",
      "Reporte IA mensual",
      "3 usuarios",
    ],
    prices: {
      MONTHLY: { amount: 799, priceId: process.env.STRIPE_STARTER_MONTHLY_PRICE_ID! },
      ANNUAL: { amount: 7990, priceId: process.env.STRIPE_STARTER_ANNUAL_PRICE_ID! },
    },
  },
  PROFESSIONAL: {
    name: "Professional",
    description: "Para empresas en crecimiento",
    features: [
      "Todo en Starter",
      "Hasta 10 integraciones",
      "Todas las categorías de métricas",
      "Reportes IA semanales",
      "Hasta 10 usuarios",
      "Dashboards personalizados",
    ],
    prices: {
      MONTHLY: { amount: 1999, priceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID! },
      ANNUAL: { amount: 19990, priceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID! },
    },
  },
  ENTERPRISE: {
    name: "Enterprise",
    description: "Para corporativos y grandes empresas",
    features: [
      "Todo en Professional",
      "API personalizada",
      "Usuarios ilimitados",
      "Reportes IA on-demand",
      "Soporte prioritario",
      "SSO / SAML",
    ],
    prices: {
      MONTHLY: { amount: 4999, priceId: process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID! },
      ANNUAL: { amount: 49990, priceId: process.env.STRIPE_ENTERPRISE_ANNUAL_PRICE_ID! },
    },
  },
} as const;
