"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Format = "xlsx" | "csv";

interface ExportButtonProps {
  category?: string;
  label?: string;
  className?: string;
}

export function ExportButton({ category, label = "Exportar", className }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<Format | null>(null);

  const download = async (format: Format) => {
    setLoading(format);
    setOpen(false);
    try {
      const params = new URLSearchParams({ format });
      if (category) params.set("category", category);
      const res = await fetch(`/api/metrics/export?${params}`);
      if (!res.ok) throw new Error("Error al exportar");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("content-disposition")?.match(/filename=(.+)/)?.[1] ??
        `metrixpro.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silent — could add toast here
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={loading !== null}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
      >
        {loading ? (
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-border border-t-primary" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        {label}
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-border bg-card shadow-lg">
            <div className="p-1">
              <button
                onClick={() => download("xlsx")}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary transition-colors"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <div>
                  <p className="font-medium">Excel (.xlsx)</p>
                  <p className="text-xs text-muted-foreground">Con hojas por área</p>
                </div>
              </button>
              <button
                onClick={() => download("csv")}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm hover:bg-secondary transition-colors"
              >
                <FileText className="h-4 w-4 text-blue-600" />
                <div>
                  <p className="font-medium">CSV</p>
                  <p className="text-xs text-muted-foreground">Compatible con todo</p>
                </div>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
