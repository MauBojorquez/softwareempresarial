"use client";

import { loadMe, refreshMe, type Me } from "@/hooks/use-me";

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

const BRAND_PROPS = [
  "--brand-h",
  "--brand-s",
  "--brand-l",
  "--primary",
  "--ring",
  "--gradient-start",
  "--gradient-end",
] as const;

/** Fired (with the fresh Me as detail) after refreshMe() resolves. */
export const ME_REFRESHED_EVENT = "me-refreshed";

/**
 * Refetch /api/user and tell listeners (BrandProvider) about it. useMe() only
 * reads once per mount, so components that must follow profile/org changes
 * listen for this event instead.
 */
export function refreshMeAndNotify(): Promise<Me | null> {
  return refreshMe().then((me) => {
    window.dispatchEvent(new CustomEvent(ME_REFRESHED_EVENT, { detail: me }));
    return me;
  });
}

/** Applies the org brand color, or restores the default theme when unset. */
function applyBrand(hex: string | null | undefined) {
  const root = document.documentElement;
  const hsl = hex ? hexToHsl(hex) : null;
  if (!hsl) {
    // No (valid) brand color: drop any overrides from a previous color so the
    // stylesheet defaults apply again.
    for (const p of BRAND_PROPS) root.style.removeProperty(p);
    document.body.classList.remove("has-brand");
    return;
  }

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
}

/**
 * Reads the active organization's brand color and applies it across the app
 * by overriding the CSS custom properties used for primary accents, gradients
 * and hover glows. Re-applied whenever /api/user is refreshed (e.g. after
 * saving branding); with no brand color the default theme is restored.
 */
export function BrandProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false;
    loadMe()
      .then((data) => {
        if (!cancelled && data) applyBrand(data.organization?.brandColor);
      })
      .catch(() => {});

    const onRefresh = (e: Event) => {
      const data = (e as CustomEvent<Me | null>).detail;
      if (data) applyBrand(data.organization?.brandColor);
    };
    window.addEventListener(ME_REFRESHED_EVENT, onRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener(ME_REFRESHED_EVENT, onRefresh);
    };
  }, []);

  return <>{children}</>;
}
