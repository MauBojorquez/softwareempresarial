"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function useKeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;

      if (e.altKey || e.ctrlKey || e.metaKey) return;

      switch (e.key) {
        case "g":
          if (e.shiftKey) return;
          e.preventDefault();
          router.push("/dashboard/overview");
          break;
        case "f":
          e.preventDefault();
          router.push("/dashboard/finance");
          break;
        case "v":
          e.preventDefault();
          router.push("/dashboard/sales");
          break;
        case "o":
          e.preventDefault();
          router.push("/dashboard/operations");
          break;
        case "h":
          e.preventDefault();
          router.push("/dashboard/hr");
          break;
        case "m":
          e.preventDefault();
          router.push("/dashboard/marketing");
          break;
        case "r":
          e.preventDefault();
          router.push("/dashboard/reports");
          break;
        case "s":
          e.preventDefault();
          router.push("/dashboard/settings");
          break;
        case "?":
          e.preventDefault();
          const event = new CustomEvent("toggle-shortcuts-help");
          window.dispatchEvent(event);
          break;
      }
    }

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [router]);
}
