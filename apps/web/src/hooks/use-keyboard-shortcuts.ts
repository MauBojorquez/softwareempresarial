"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { routesFor } from "@/lib/nav";
import { useMe } from "@/hooks/use-me";

// Single-key navigation shortcuts, read from the nav map (lib/nav.ts) so they
// always point at real pages. Ignored while typing, with modifier keys, or
// while a dialog is open, and limited to the pages the user's puesto can see.
export function useKeyboardShortcuts() {
  const router = useRouter();
  const me = useMe();

  const byKey = useMemo(() => {
    // Until /api/user answers we don't know the role: no navigation shortcuts.
    if (!me) return new Map<string, string>();
    const allowed = routesFor(me.jobRole ?? null, me.role === "ADMIN");
    return new Map(allowed.filter((r) => r.shortcut).map((r) => [r.shortcut as string, r.href]));
  }, [me]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      // Keys inside an open dialog (forms, confirmations, drawers) belong to it.
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;

      if (e.key === "?") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("toggle-shortcuts-help"));
        return;
      }
      if (e.shiftKey) return;
      const href = byKey.get(e.key);
      if (href) {
        e.preventDefault();
        router.push(href);
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [router, byKey]);
}
