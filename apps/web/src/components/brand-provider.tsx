"use client";

import { useEffect } from "react";

/** Converts #RRGGBB to {h, s, l} (s, l in 0-100). */
function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = ((g - b) / d) % 6; break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: Math.round(h), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/**
 * Reads the active organization's brand color and applies it across the app
 * by overriding the CSS custom properties used for primary accents, gradients
 * and hover glows. Non-destructive: if no brand color is set, the default
 * theme is left untouched.
 */
export function BrandProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false;
    fetch("/api/user")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const hex: string | undefined = data?.organization?.brandColor;
        const root = document.documentElement;
        if (!hex) {
          document.body.classList.remove("has-brand");
          return;
        }
        const hsl = hexToHsl(hex);
        if (!hsl) return;

        const { h, s } = hsl;
        // Clamp lightness into a usable accent range for both themes.
        const l = Math.min(Math.max(hsl.l, 30), 62);

        root.style.setProperty("--brand-h", String(h));
        root.style.setProperty("--brand-s", `${s}%`);
        root.style.setProperty("--brand-l", `${l}%`);

        const triplet = `${h} ${s}% ${l}%`;
        root.style.setProperty("--primary", triplet);
        root.style.setProperty("--ring", triplet);
        root.style.setProperty("--gradient-start", triplet);
        root.style.setProperty("--gradient-end", `${h} ${Math.max(s - 10, 0)}% ${Math.max(l - 14, 12)}%`);

        document.body.classList.add("has-brand");
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  return <>{children}</>;
}
