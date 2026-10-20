"use client";

import { useEffect, useState } from "react";
import type { JobRole } from "@prisma/client";

export type Me = {
  user?: { id: string; name: string | null; email: string; avatar?: string | null };
  organization?: { name: string; logo?: string | null; brandColor?: string | null };
  jobRole: JobRole | null;
  role?: string | null; // membership role (ADMIN/EDITOR/VIEWER)
};

// One /api/user request shared by every component on the page (sidebar,
// bottom nav, header, palette) instead of each fetching its own copy.
let cache: Me | null = null;
let inflight: Promise<Me | null> | null = null;

export function loadMe(): Promise<Me | null> {
  if (cache) return Promise.resolve(cache);
  if (!inflight) {
    inflight = fetch("/api/user")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        cache = d ? { ...d, jobRole: d.jobRole ?? null } : null;
        return cache;
      })
      .catch(() => null)
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

/** Invalidate after profile/org changes so the next read refetches. */
export function refreshMe() {
  cache = null;
  return loadMe();
}

/** `me` is undefined while loading, null if it failed. */
export function useMe(): Me | null | undefined {
  const [me, setMe] = useState<Me | null | undefined>(cache ?? undefined);
  useEffect(() => {
    let alive = true;
    loadMe().then((m) => alive && setMe(m));
    return () => {
      alive = false;
    };
  }, []);
  return me;
}
