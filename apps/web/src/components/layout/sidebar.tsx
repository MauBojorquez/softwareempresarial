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
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="h-8 w-8 rounded-lg bg-primary" />
        <span className="text-lg font-bold">MetrixPro</span>
      </div>
      <nav className="flex-1 space-y-1 p-4">
        {navigation.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
