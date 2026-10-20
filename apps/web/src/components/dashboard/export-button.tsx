"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toast";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";

type Format = "xlsx" | "csv";

interface ExportButtonProps {
  category?: string;
  label?: string;
  className?: string;
}

export function ExportButton({ category, label = "Exportar", className }: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<Format | null>(null);
  const { toast } = useToast();

  const download = async (format: Format) => {
    setLoading(format);
    setOpen(false);
    try {
      const params = new URLSearchParams({ format });
      if (category) params.set("category", category);
      const res = await fetch(`/api/metrics/export?${params}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "No se pudo exportar. Intenta de nuevo.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.headers.get("content-disposition")?.match(/filename=(.+)/)?.[1] ??
        `stratiumetrics.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast("Exportación lista", "success");
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "No se pudo exportar. Intenta de nuevo.", "error");
    } finally {
      setLoading(null);
    }
  };

  const itemClass =
    "flex w-full cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm outline-none transition-colors data-[highlighted]:bg-secondary";

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <Button variant="outline" size="sm" loading={loading !== null} className={className}>
          {loading === null && <Download />}
          {label}
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 w-48 rounded-xl border border-border bg-card p-1 text-card-foreground shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DropdownMenu.Item className={itemClass} onSelect={() => download("xlsx")}>
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-success" />
            <div>
              <p className="font-medium">Excel (.xlsx)</p>
              <p className="text-xs text-muted-foreground">Con hojas por área</p>
            </div>
          </DropdownMenu.Item>
          <DropdownMenu.Item className={itemClass} onSelect={() => download("csv")}>
            <FileText className="h-4 w-4 shrink-0 text-info" />
            <div>
              <p className="font-medium">CSV</p>
              <p className="text-xs text-muted-foreground">Compatible con todo</p>
            </div>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
