import type { JobRole } from "@prisma/client";
import {
  LayoutDashboard, DollarSign, Settings, UsersRound, Wallet, BarChart3, Receipt,
  Users, ListChecks, KanbanSquare, TrendingUp, ClipboardList,
  Mountain, Gauge, Megaphone, ClipboardCheck, Briefcase,
} from "lucide-react";

/**
 * Single source of truth for the app's navigation. The sidebar, bottom nav,
 * tab titles, breadcrumb, command palette (⌘K) and keyboard shortcuts all
 * derive from this map, so they can never point at a route that no longer
 * exists. `roles` only tailors what each puesto SEES — backend RBAC
 * (lib/access.ts) is the real gate.
 */

export type NavIcon = typeof LayoutDashboard;
export type NavChild = { name: string; href: string; icon: NavIcon; roles: JobRole[]; keywords?: string[]; shortcut?: string };
export type NavItem = NavChild & { children?: NavChild[]; groupOnly?: boolean };

export const ALL_ROLES: JobRole[] = ["DIRECCION", "OPERACIONES", "COMERCIAL", "MARKETING", "ADMINISTRACION"];

export const NAVIGATION: NavItem[] = [
  { name: "Resumen", href: "/dashboard/overview", icon: LayoutDashboard, roles: ALL_ROLES, shortcut: "g", keywords: ["inicio", "home"] },
  {
    name: "Finanzas",
    href: "/dashboard/finance",
    icon: DollarSign,
    roles: ["DIRECCION", "ADMINISTRACION"],
    children: [
      { name: "Panel financiero", href: "/dashboard/finance", icon: BarChart3, roles: ["DIRECCION"], shortcut: "f" },
      { name: "Flujo de efectivo", href: "/dashboard/finance/cashflow", icon: Wallet, roles: ["DIRECCION", "ADMINISTRACION"], shortcut: "e", keywords: ["bancos", "cuentas", "movimientos"] },
      { name: "Cobranza", href: "/dashboard/finance/cobranza", icon: Receipt, roles: ["DIRECCION", "ADMINISTRACION"], shortcut: "b", keywords: ["facturas", "pagos"] },
    ],
  },
  {
    name: "Operativo",
    href: "/dashboard/finance/cartera",
    icon: ClipboardCheck,
    roles: ["DIRECCION", "OPERACIONES", "ADMINISTRACION"],
    groupOnly: true,
    children: [
      { name: "Cartera", href: "/dashboard/finance/cartera", icon: Users, roles: ["DIRECCION", "OPERACIONES", "ADMINISTRACION"], shortcut: "k", keywords: ["clientes"] },
      { name: "Tareas", href: "/dashboard/finance/tareas", icon: ListChecks, roles: ["DIRECCION", "OPERACIONES", "ADMINISTRACION"], shortcut: "t", keywords: ["entregables"] },
    ],
  },
  {
    name: "Comercial",
    href: "/dashboard/crm",
    icon: Briefcase,
    roles: ["DIRECCION", "COMERCIAL", "MARKETING", "ADMINISTRACION"],
    groupOnly: true,
    children: [
      { name: "CRM", href: "/dashboard/crm", icon: KanbanSquare, roles: ["DIRECCION", "COMERCIAL", "MARKETING"], shortcut: "c", keywords: ["leads", "pipeline", "prospectos"] },
      { name: "Ventas", href: "/dashboard/ventas", icon: TrendingUp, roles: ["DIRECCION", "COMERCIAL", "ADMINISTRACION"], shortcut: "v" },
      { name: "Marketing", href: "/dashboard/marketing", icon: Megaphone, roles: ["DIRECCION", "MARKETING", "COMERCIAL"], shortcut: "m", keywords: ["meta", "ads", "campañas"] },
    ],
  },
  { name: "Reportes", href: "/dashboard/reportes", icon: ClipboardList, roles: ALL_ROLES, shortcut: "r", keywords: ["reporte diario"] },
  { name: "Rocas", href: "/dashboard/rocas", icon: Mountain, roles: ALL_ROLES, shortcut: "o", keywords: ["objetivos", "metas"] },
  { name: "Dirección", href: "/dashboard/direccion", icon: Gauge, roles: ["DIRECCION"], shortcut: "d", keywords: ["número crítico", "tablero"] },
  { name: "Configuración", href: "/dashboard/settings", icon: Settings, roles: ALL_ROLES, shortcut: "s", keywords: ["perfil", "google", "api"] },
];

/** Admin-only (membership ADMIN), visible regardless of jobRole. */
export const ADMIN_NAVIGATION: NavItem[] = [
  { name: "Equipo", href: "/dashboard/team", icon: UsersRound, roles: ALL_ROLES, keywords: ["miembros", "invitar"] },
];

/** Every navigable page (groups flattened), with the group name when nested. */
export type FlatRoute = NavChild & { group?: string };
export const ROUTES: FlatRoute[] = [...NAVIGATION, ...ADMIN_NAVIGATION].flatMap((item) =>
  item.children
    ? item.children.map((c) => ({ ...c, group: item.name }))
    : item.groupOnly
      ? []
      : [item],
);

/** Routes visible for a given puesto (null jobRole → shared pages only). */
export function routesFor(jobRole: JobRole | null, isAdmin = false): FlatRoute[] {
  return ROUTES.filter((r) => {
    if (r.href === "/dashboard/team") return isAdmin;
    return jobRole ? r.roles.includes(jobRole) : r.roles.length === ALL_ROLES.length;
  });
}

/** Most specific route matching a pathname. */
export function routeFor(pathname: string): FlatRoute | undefined {
  return [...ROUTES]
    .sort((a, b) => b.href.length - a.href.length)
    .find((r) => pathname === r.href || pathname.startsWith(r.href + "/"));
}
