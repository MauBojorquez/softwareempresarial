"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { useEffect, useState, useRef } from "react";
import {
  LayoutDashboard, DollarSign, TrendingUp, Settings2, Users,
  Megaphone, FileText, Plug, CreditCard, LogOut, X, Settings, Target,
  Building2, ChevronDown, Plus, Check, UsersRound,
} from "lucide-react";

const navigation = [
  { name: "Resumen", href: "/dashboard/overview", icon: LayoutDashboard },
  { name: "Metas", href: "/dashboard/goals", icon: Target },
  { name: "Finanzas", href: "/dashboard/finance", icon: DollarSign },
  { name: "Ventas", href: "/dashboard/sales", icon: TrendingUp },
  { name: "Operaciones", href: "/dashboard/operations", icon: Settings2 },
  { name: "RRHH", href: "/dashboard/hr", icon: Users },
  { name: "Marketing", href: "/dashboard/marketing", icon: Megaphone },
  { name: "Reportes IA", href: "/dashboard/reports", icon: FileText },
  { name: "Equipo", href: "/dashboard/team", icon: UsersRound },
  { name: "Integraciones", href: "/dashboard/integrations", icon: Plug },
  { name: "Suscripción", href: "/dashboard/billing", icon: CreditCard },
  { name: "Configuración", href: "/dashboard/settings", icon: Settings },
];

type OrgItem = { id: string; name: string; logo?: string | null; brandColor?: string | null; isActive: boolean };

export function Sidebar({ open, onClose }: { open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const initials = session?.user?.name?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "MP";

  const [orgData, setOrgData] = useState<{ name: string; logo?: string | null; brandColor?: string | null } | null>(null);
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [showOrgMenu, setShowOrgMenu] = useState(false);
  const [allowedSections, setAllowedSections] = useState<string[]>([]);
  const orgMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/user")
      .then((r) => r.json())
      .then((data) => {
        if (data.organization) setOrgData(data.organization);
        if (data.user?.avatar) setAvatar(data.user.avatar);
        if (Array.isArray(data.allowedSections)) setAllowedSections(data.allowedSections);
      })
      .catch(() => {});

    fetch("/api/organizations")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.organizations)) setOrgs(data.organizations);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (orgMenuRef.current && !orgMenuRef.current.contains(e.target as Node)) setShowOrgMenu(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const switchOrg = async (orgId: string) => {
    await fetch("/api/organizations/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orgId }),
    });
    window.location.reload();
  };

  const brandColor = orgData?.brandColor;

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
        style={brandColor ? { "--sidebar-brand": brandColor } as React.CSSProperties : undefined}
      >
        {/* Logo / Brand */}
        <div className="flex h-14 items-center justify-between border-b border-border px-4 sm:h-16 sm:px-6">
          <div className="flex items-center gap-2.5 min-w-0">
            {orgData?.logo ? (
              <img
                src={orgData.logo}
                alt={orgData.name || "Logo"}
                className="h-8 w-8 rounded-lg object-contain border border-border bg-white p-0.5"
              />
            ) : (
              <Logo className="h-8 w-8 flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground leading-none">StratiuMetrics</p>
              <p className="text-sm font-bold text-foreground truncate leading-tight mt-0.5">
                {orgData?.name || "Mi Empresa"}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:text-foreground lg:hidden">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Org switcher (if multiple orgs) */}
        {orgs.length > 1 && (
          <div ref={orgMenuRef} className="relative border-b border-border px-3 py-2">
            <button
              onClick={() => setShowOrgMenu((v) => !v)}
              className="w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{orgs.find((o) => o.isActive)?.name || "Empresa activa"}</span>
              </div>
              <ChevronDown className={cn("h-3 w-3 flex-shrink-0 transition-transform", showOrgMenu && "rotate-180")} />
            </button>

            {showOrgMenu && (
              <div className="absolute left-3 right-3 top-full z-50 mt-1 rounded-xl border border-border bg-card shadow-lg">
                <div className="p-1">
                  {orgs.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => { setShowOrgMenu(false); if (!org.isActive) switchOrg(org.id); }}
                      className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-secondary transition-colors"
                    >
                      {org.logo ? (
                        <img src={org.logo} alt="" className="h-5 w-5 rounded object-contain border border-border bg-white" />
                      ) : (
                        <div className="h-5 w-5 rounded gradient-bg flex items-center justify-center flex-shrink-0">
                          <span className="text-[10px] font-bold text-white">{org.name[0]?.toUpperCase()}</span>
                        </div>
                      )}
                      <span className="flex-1 truncate">{org.name}</span>
                      {org.isActive && <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />}
                    </button>
                  ))}
                  <div className="border-t border-border mt-1 pt-1">
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setShowOrgMenu(false)}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Agregar empresa
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <nav aria-label="Navegación principal" className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {navigation.filter((item) => {
            const isAdmin = session?.user?.role === "ADMIN";
            // Billing and integrations are admin-only
            if (item.href === "/dashboard/billing" || item.href === "/dashboard/integrations") {
              return isAdmin;
            }
            // Section-based filtering for editors/viewers
            if (allowedSections.length === 0) return true;
            const sectionMap: Record<string, string> = {
              "/dashboard/finance": "FINANCE",
              "/dashboard/sales": "SALES",
              "/dashboard/operations": "OPERATIONS",
              "/dashboard/hr": "HR",
              "/dashboard/marketing": "MARKETING",
            };
            const section = sectionMap[item.href];
            return !section || allowedSections.includes(section);
          }).map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-tour={item.href}
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "nav-item group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium",
                  isActive
                    ? "bg-gradient-to-r from-primary/15 to-primary/5 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full gradient-bg" />
                )}
                <item.icon className={cn("h-4 w-4 transition-transform", isActive ? "scale-110" : "group-hover:scale-110")} />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
            {avatar ? (
              <img src={avatar} alt="Perfil" className="h-8 w-8 rounded-full object-cover border border-border" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-semibold text-primary">{initials}</span>
              </div>
            )}
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
