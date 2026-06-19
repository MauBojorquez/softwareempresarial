"use client";

import { Users, UserPlus, UserMinus, Heart } from "lucide-react";
import { MetricsDashboard } from "@/components/dashboard/metrics-page";

const TEMPLATES = [
  { name: "Headcount", unit: "personas" },
  { name: "Nuevas Contrataciones", unit: "personas" },
  { name: "Bajas", unit: "personas" },
  { name: "Rotación (%)", unit: "%" },
  { name: "Satisfacción (1-10)", unit: "pts" },
  { name: "Costo Nómina", unit: "MXN" },
];

const ICON_MAP: Record<string, typeof Users> = {
  Headcount: Users,
  "Nuevas Contrataciones": UserPlus,
  Bajas: UserMinus,
  "Rotación (%)": UserMinus,
  "Satisfacción (1-10)": Heart,
  "Costo Nómina": Users,
};

export default function HRPage() {
  return (
    <MetricsDashboard
      title="Recursos Humanos"
      subtitle="Métricas de equipo"
      category="HR"
      templates={TEMPLATES}
      defaultSelected={["Headcount", "Nuevas Contrataciones", "Rotación (%)", "Satisfacción (1-10)"]}
      iconMap={ICON_MAP}
      defaultIcon={Users}
      activityLabel="RRHH"
      emptyTitle="Sin datos de RH"
      emptySubtitle="Registra las métricas de tu equipo manualmente para dar seguimiento a headcount, rotación y satisfacción."
    />
  );
}
