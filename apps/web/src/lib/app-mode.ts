"use client";

/**
 * "Cashflow-only" presentation mode.
 *
 * Hides every module except Flujo de Efectivo (sidebar, bottom-nav, header
 * extras), so the app can be shown focused on that single feature — e.g. for a
 * live webinar demo — WITHOUT creating a separate deployment or database.
 *
 * It can be turned on two ways:
 *  1. Globally for a whole deployment via NEXT_PUBLIC_CASHFLOW_ONLY="true"
 *     (kept for a dedicated demo build; default off).
 *  2. Per-browser, by visiting /activar-demo (turns it on) or /salir-demo
 *     (turns it off). This only affects that one browser via localStorage, so
 *     production users are never impacted while someone presents the demo.
 *
 * Nothing is deleted — turning it off restores the full product exactly.
 */
import { useEffect, useState } from "react";

/** Global build-time switch (forces the mode on for the whole deployment). */
export const CASHFLOW_ONLY_ENV =
  process.env.NEXT_PUBLIC_CASHFLOW_ONLY === "true";

/** Where every route redirects to in cashflow-only mode. */
export const CASHFLOW_HOME = "/dashboard/finance/cashflow";

const STORAGE_KEY = "cashflow-only-demo";

/** Synchronous read. Server (and first client paint) sees the env default. */
export function readCashflowOnly(): boolean {
  if (CASHFLOW_ONLY_ENV) return true;
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/** Turn the per-browser demo mode on or off. */
export function setCashflowOnly(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (on) window.localStorage.setItem(STORAGE_KEY, "true");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Hydration-safe hook: starts from the env default (matches server render) and
 * resolves the real per-browser value after mount.
 */
export function useCashflowOnly(): boolean {
  const [on, setOn] = useState(CASHFLOW_ONLY_ENV);
  useEffect(() => {
    setOn(readCashflowOnly());
  }, []);
  return on;
}
