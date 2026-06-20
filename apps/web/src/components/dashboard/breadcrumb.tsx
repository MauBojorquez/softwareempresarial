"use client";

import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

const LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  overview: "Resumen",
  goals: "Metas",
  finance: "Finanzas",
  sales: "Ventas",
  operations: "Operaciones",
  hr: "RH",
  marketing: "Marketing",
  reports: "Reportes",
  "ai-chat": "Reportes IA",
  team: "Equipo",
  billing: "Suscripción",
  integrations: "Integraciones",
  sat: "SAT",
  settings: "Configuración",
};

export function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) return null;

  return (
    <nav aria-label="Ruta de navegación" className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
      <a href="/dashboard/overview" aria-label="Inicio" className="hover:text-foreground transition-colors">
        <Home className="h-3 w-3" />
      </a>
      {segments.slice(1).map((seg, i) => (
        <span key={seg} className="flex items-center gap-1">
          <ChevronRight className="h-3 w-3" />
          {i === segments.length - 2 ? (
            <span className="font-medium text-foreground">{LABELS[seg] || seg}</span>
          ) : (
            <a href={`/${segments.slice(0, i + 2).join("/")}`} className="hover:text-foreground transition-colors">
              {LABELS[seg] || seg}
            </a>
          )}
        </span>
      ))}
    </nav>
  );
}
