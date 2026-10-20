"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/nav";

// Single-key navigation shortcuts, read from the nav map (lib/nav.ts) so they
// always point at real pages. Ignored while typing or with modifier keys.
const BY_KEY = new Map(ROUTES.filter((r) => r.shortcut).map((r) => [r.shortcut as string, r.href]));

export function useKeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;

      if (e.key === "?") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("toggle-shortcuts-help"));
        return;
      }
      if (e.shiftKey) return;
      const href = BY_KEY.get(e.key);
      if (href) {
        e.preventDefault();
        router.push(href);
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [router]);
}
