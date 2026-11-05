"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { currentMonthMX } from "@/lib/day";

/**
 * Selected month ("YYYY-MM", America/Mexico_City) that follows the calendar:
 * while the user is on the current month, a tab or installed app left open
 * across the month change moves to the new month by itself (checked on focus
 * and every minute). Picking another month on purpose stops following until
 * they come back to the current one.
 */
export function useCurrentMonth(): [string, (mes: string) => void, string] {
  const [now, setNow] = useState(currentMonthMX);
  const [mes, setMesState] = useState(now);
  const following = useRef(true);

  useEffect(() => {
    const tick = () => {
      const cur = currentMonthMX();
      setNow(cur);
      if (following.current) setMesState(cur);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    const id = setInterval(tick, 60_000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const setMes = useCallback((next: string) => {
    const valid = /^\d{4}-\d{2}$/.test(next) ? next : currentMonthMX();
    following.current = valid === currentMonthMX();
    setMesState(valid);
  }, []);

  return [mes, setMes, now];
}
