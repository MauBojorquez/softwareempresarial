import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
  typescript: true,
});

export const PLANS = {
  STARTER: {
    name: "Starter",
    description: "Para emprendedores y negocios pequeños",
    features: [
      "Dashboard ejecutivo",
      "1 integración (QuickBooks o HubSpot)",
      "Métricas financieras y ventas",
      "Reporte IA mensual",
      "1 usuario",
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
      "Integraciones ilimitadas",
      "Todas las categorías de métricas",
      "Reportes IA semanales",
      "Hasta 5 usuarios",
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
