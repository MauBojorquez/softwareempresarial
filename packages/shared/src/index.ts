export const APP_NAME = "MetrixPro";

export type MetricCategory = "FINANCE" | "SALES" | "OPERATIONS" | "HR" | "MARKETING";

export interface MetricData {
  name: string;
  value: number;
  unit?: string;
  change?: number;
  period: string;
}

export interface DashboardConfig {
  widgets: Widget[];
}

export interface Widget {
  id: string;
  type: "metric" | "chart" | "table" | "ai-insight";
  category: MetricCategory;
  position: { x: number; y: number; w: number; h: number };
  config: Record<string, unknown>;
}
