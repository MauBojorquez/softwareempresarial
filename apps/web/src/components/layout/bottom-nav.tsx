"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { JobRole } from "@prisma/client";
import {
  LayoutDashboard, Gauge, KanbanSquare, ClipboardList,
  TrendingUp, Megaphone, Users, ListChecks, Receipt, Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = { name: string; href: string; icon: typeof LayoutDashboard };

const RESUMEN: Tab = { name: "Resumen", href: "/dashboard/overview", icon: LayoutDashboard };
const REPORTES: Tab = { name: "Reportes", href: "/dashboard/reportes", icon: ClipboardList };
const CRM: Tab = { name: "CRM", href: "/dashboard/crm", icon: KanbanSquare };
const CARTERA: Tab = { name: "Cartera", href: "/dashboard/finance/cartera", icon: Users };

// Up to 4 primary destinations per puesto; the "Más" button (sidebar) is always
// appended. Mirrors the sidebar's role map + icons. A null jobRole gets the
// minimal fallback. Backend RBAC is still the real gate.
const TABS_BY_ROLE: Record<JobRole, Tab[]> = {
  DIRECCION: [RESUMEN, { name: "Dirección", href: "/dashboard/direccion", icon: Gauge }, CRM, REPORTES],
  COMERCIAL: [RESUMEN, CRM, { name: "Ventas", href: "/dashboard/ventas", icon: TrendingUp }, REPORTES],
  MARKETING: [RESUMEN, { name: "Marketing", href: "/dashboard/marketing", icon: Megaphone }, CRM, REPORTES],
  OPERACIONES: [RESUMEN, CARTERA, { name: "Tareas", href: "/dashboard/finance/tareas", icon: ListChecks }, REPORTES],
  ADMINISTRACION: [RESUMEN, { name: "Cobranza", href: "/dashboard/finance/cobranza", icon: Receipt }, CARTERA, REPORTES],
};

const FALLBACK_TABS: Tab[] = [RESUMEN, REPORTES];

export function BottomNav({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const [jobRole, setJobRole] = useState<JobRole | null>(null);

  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((data) => {
        if (data.jobRole) setJobRole(data.jobRole);
      })
      .catch(() => {});
  }, []);

  const tabs = jobRole ? TABS_BY_ROLE[jobRole] : FALLBACK_TABS;

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Blur backdrop */}
      <div className="absolute inset-0 bg-card/90 backdrop-blur-xl border-t border-border" />

      <div className="relative flex items-stretch h-16">
        {tabs.map((tab) => {
          const active =
            tab.href === "/dashboard/overview"
              ? pathname === tab.href
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-1 transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <div className={cn(
                "relative flex h-8 w-12 items-center justify-center rounded-xl transition-all",
                active && "bg-primary/12"
              )}>
                {active && (
                  <div className="absolute inset-0 rounded-xl bg-primary/8" />
                )}
                <tab.icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} />
              </div>
              <span className={cn("text-[10px] font-medium leading-none", active ? "text-primary" : "text-muted-foreground/70")}>
                {tab.name}
              </span>
            </Link>
          );
        })}

        {/* Más / sidebar trigger */}
        <button
          onClick={onMenuClick}
          aria-label="Abrir menú"
          className="flex flex-1 flex-col items-center justify-center gap-1 text-muted-foreground transition-colors active:text-foreground"
        >
          <div className="flex h-8 w-12 items-center justify-center rounded-xl">
            <Menu className="h-5 w-5" />
          </div>
          <span className="text-[10px] font-medium leading-none text-muted-foreground/70">Más</span>
        </button>
      </div>
    </nav>
  );
}
