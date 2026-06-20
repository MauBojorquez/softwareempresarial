"use client";

import { cn } from "@/lib/utils";

function Pulse({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-secondary/70", className)} />;
}

export function MetricCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <Pulse className="h-3 w-20" />
        <Pulse className="h-8 w-8 rounded-lg" />
      </div>
      <div className="mt-3">
        <Pulse className="h-7 w-28" />
        <Pulse className="mt-2 h-3 w-16" />
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border p-4">
        <Pulse className="h-5 w-32" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <Pulse className="h-4 w-32" />
            <Pulse className="h-4 w-20 ml-auto" />
            <Pulse className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      {/* Aurora welcome banner */}
      <Pulse className="h-24 w-full rounded-2xl" />
      <div className="flex items-center justify-between">
        <div>
          <Pulse className="h-7 w-32" />
          <Pulse className="mt-2 h-4 w-52" />
        </div>
        <div className="flex gap-2">
          <Pulse className="h-9 w-24 rounded-lg" />
          <Pulse className="h-9 w-24 rounded-lg" />
          <Pulse className="h-9 w-9 rounded-lg" />
        </div>
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>
      <Pulse className="h-48 w-full rounded-xl" />
      <Pulse className="h-32 w-full rounded-xl" />
    </div>
  );
}

export function OverviewSkeleton() {
  return <DashboardSkeleton />;
}
