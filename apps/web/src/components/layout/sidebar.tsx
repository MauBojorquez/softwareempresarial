"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  DollarSign,
  TrendingUp,
  Settings2,
  Users,
  Megaphone,
  FileText,
  Plug,
  CreditCard,
  LogOut,
} from "lucide-react";

const navigation = [
  { name: "Overview", href: "/dashboard/overview", icon: LayoutDashboard },
  { name: "Finanzas", href: "/dashboard/finance", icon: DollarSign },
  { name: "Ventas", href: "/dashboard/sales", icon: TrendingUp },
  { name: "Operaciones", href: "/dashboard/operations", icon: Settings2 },
  { name: "RRHH", href: "/dashboard/hr", icon: Users },
  { name: "Marketing", href: "/dashboard/marketing", icon: Megaphone },
  { name: "Reportes IA", href: "/dashboard/reports", icon: FileText },
  { name: "Integraciones", href: "/dashboard/integrations", icon: Plug },
  { name: "Suscripción", href: "/dashboard/billing", icon: CreditCard },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-white/5 bg-card/50">
      <div className="flex h-16 items-center gap-2.5 border-b border-white/5 px-6">
        <div className="h-8 w-8 rounded-lg gradient-bg" />
        <span className="text-lg font-bold">MetrixPro</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary/10 text-primary glow-sm"
                  : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/5 p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
          <div className="h-8 w-8 rounded-full gradient-bg opacity-60" />
          <div className="flex-1 truncate">
            <p className="text-sm font-medium">Mi Empresa</p>
            <p className="text-xs text-muted-foreground">Plan Professional</p>
          </div>
          <button className="text-muted-foreground transition-colors hover:text-foreground">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
