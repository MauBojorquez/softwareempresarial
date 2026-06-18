"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, DollarSign, TrendingUp, Settings2, Users,
  Megaphone, FileText, Plug, CreditCard, LogOut, X, Settings,
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
  { name: "Configuración", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const initials = session?.user?.name?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "MP";

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-border bg-card transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-border px-4 sm:h-16 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg gradient-bg flex items-center justify-center">
              <span className="text-xs font-bold text-white">S</span>
            </div>
            <span className="text-lg font-bold text-foreground">MetrixPro</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav aria-label="Navegación principal" className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {navigation.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/8 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-semibold text-primary">{initials}</span>
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium text-foreground">{session?.user?.name || "Usuario"}</p>
              <p className="text-xs text-muted-foreground">{session?.user?.email || ""}</p>
            </div>
            <button
              aria-label="Cerrar sesión"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
