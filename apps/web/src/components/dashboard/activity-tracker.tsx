"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Fire-and-forget page-view beacon. Records the current dashboard route for
 * team usage analytics. Server-side dedup keeps the volume sane, so this can
 * fire on every navigation without flooding the DB.
 */
export function ActivityTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname?.startsWith("/dashboard")) return;
    const t = setTimeout(() => {
      fetch("/api/team/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathname }),
        keepalive: true,
      }).catch(() => {});
    }, 1200);
    return () => clearTimeout(t);
  }, [pathname]);

  return null;
}
