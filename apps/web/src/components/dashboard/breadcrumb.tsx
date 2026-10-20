"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { routeFor } from "@/lib/nav";

/** Inicio › Grupo › Página, derived from the single nav map (lib/nav.ts). */
export function Breadcrumb() {
  const pathname = usePathname();
  const route = routeFor(pathname);
  if (!route || route.href === "/dashboard/overview") return null;

  return (
    <nav aria-label="Ruta de navegación" className="mb-4 flex items-center gap-1 text-xs text-muted-foreground">
      <Link href="/dashboard/overview" aria-label="Inicio" className="transition-colors hover:text-foreground">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {route.group && (
        <>
          <ChevronRight className="h-3 w-3" aria-hidden />
          <span>{route.group}</span>
        </>
      )}
      <ChevronRight className="h-3 w-3" aria-hidden />
      <span className="font-medium text-foreground" aria-current="page">{route.name}</span>
    </nav>
  );
}
