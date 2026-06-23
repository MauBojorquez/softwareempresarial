"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Target, DollarSign, TrendingUp, Menu, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { CASHFLOW_ONLY } from "@/lib/app-mode";

const TABS = CASHFLOW_ONLY
  ? [{ name: "Flujo de Efectivo", href: "/dashboard/finance/cashflow", icon: Wallet }]
  : [
      { name: "Inicio", href: "/dashboard/overview", icon: LayoutDashboard },
      { name: "Metas", href: "/dashboard/goals", icon: Target },
      { name: "Finanzas", href: "/dashboard/finance", icon: DollarSign },
      { name: "Ventas", href: "/dashboard/sales", icon: TrendingUp },
    ];

export function BottomNav({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 inset-x-0 z-40 lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Blur backdrop */}
      <div className="absolute inset-0 bg-card/90 backdrop-blur-xl border-t border-border" />

      <div className="relative flex items-stretch h-16">
        {TABS.map((tab) => {
          const active = pathname.startsWith(tab.href);
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
