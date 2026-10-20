"use client";

import { useEffect, useState } from "react";
import { Activity, Plus, FileText, Target, RefreshCw, Upload, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type LogEntry = {
  id: string;
  action: string;
  detail: string;
  time: string;
  icon: string;
};

const ICON_MAP: Record<string, any> = {
  add: Plus,
  report: FileText,
  goal: Target,
  sync: RefreshCw,
  import: Upload,
  delete: Trash2,
  default: Activity,
};

export function addActivityLog(action: string, detail: string, icon: string = "default") {
  try {
    const stored = localStorage.getItem("metrixpro-activity") || "[]";
    const log: LogEntry[] = JSON.parse(stored);
    log.unshift({
      id: Date.now().toString(),
      action,
      detail,
      time: new Date().toISOString(),
      icon,
    });
    localStorage.setItem("metrixpro-activity", JSON.stringify(log.slice(0, 50)));
  } catch {
    // El historial local es opcional: si el almacenamiento falla no debe romper la acción del usuario.
  }
}

export function ActivityLog() {
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("metrixpro-activity");
      if (stored) setLog(JSON.parse(stored));
    } catch {
      // Historial local ilegible: se muestra vacío.
    }
  }, []);

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Ahora";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  if (log.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Actividad Reciente</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { try { localStorage.removeItem("metrixpro-activity"); } catch { /* sin almacenamiento */ } setLog([]); }}
        >
          Limpiar
        </Button>
      </div>
      <div className="divide-y divide-border max-h-64 overflow-y-auto">
        {log.slice(0, 10).map((entry) => {
          const Icon = ICON_MAP[entry.icon] || ICON_MAP.default;
          return (
            <div key={entry.id} className="flex items-start gap-3 p-3">
              <div className="rounded-lg bg-secondary p-1.5 mt-0.5">
                <Icon className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{entry.action}</p>
                <p className="text-xs text-muted-foreground truncate">{entry.detail}</p>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{timeAgo(entry.time)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
