"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loads JSON from an internal API and keeps `loading`, `error` and `data`
 * apart, so a failed request shows an error with "Reintentar" instead of
 * masquerading as an empty list. `reload()` keeps the current data on screen
 * while refreshing (no flicker back to a skeleton).
 */
export function useApi<T>(url: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(!!url);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    if (!url) return;
    const mine = ++seq.current;
    setLoading(true);
    try {
      const res = await fetch(url);
      const body = await res.json().catch(() => ({}));
      if (mine !== seq.current) return;
      if (!res.ok) {
        setError((body as { error?: string }).error || `Error ${res.status}`);
      } else {
        setData(body as T);
        setError(null);
      }
    } catch {
      if (mine === seq.current) setError("Sin conexión con el servidor.");
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, setData, error, loading, reload, initialLoading: loading && data === null };
}

/** fetch + JSON for mutations; throws an Error with the server's message. */
export async function apiSend<T = unknown>(url: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || "No se pudo completar la acción.");
  return data as T;
}
