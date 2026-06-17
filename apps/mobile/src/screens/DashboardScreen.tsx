import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { colors, spacing, fontSize, borderRadius } from "../theme";
import { fetchDashboardMetrics } from "../services/api";

function MetricCard({
  title,
  value,
  change,
}: {
  title: string;
  value: string;
  change?: string;
}) {
  const isPositive = change?.startsWith("+");
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardValue}>{value}</Text>
      {change && (
        <Text
          style={[
            styles.cardChange,
            { color: isPositive ? colors.success : colors.danger },
          ]}
        >
          {change} vs mes anterior
        </Text>
      )}
    </View>
  );
}

export function DashboardScreen() {
  const [metrics, setMetrics] = useState({
    revenue: 620000,
    revenueChange: 10.7,
    pipeline: 7400000,
    pipelineChange: 5.2,
    employees: 48,
    employeesChange: 4.3,
    conversion: 17.8,
    conversionChange: -2.1,
  });
  const [refreshing, setRefreshing] = useState(false);

  const loadMetrics = async () => {
    try {
      const data = await fetchDashboardMetrics();
      setMetrics(data);
    } catch {
      // Use cached/default data
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMetrics();
    setRefreshing(false);
  };

  const fmt = (n: number) =>
    n >= 1000000
      ? `$${(n / 1000000).toFixed(1)}M`
      : `$${(n / 1000).toFixed(0)}k`;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <Text style={styles.heading}>Resumen Ejecutivo</Text>
      <View style={styles.grid}>
        <MetricCard
          title="Ingresos"
          value={fmt(metrics.revenue)}
          change={`${metrics.revenueChange > 0 ? "+" : ""}${metrics.revenueChange}%`}
        />
        <MetricCard
          title="Pipeline"
          value={fmt(metrics.pipeline)}
          change={`${metrics.pipelineChange > 0 ? "+" : ""}${metrics.pipelineChange}%`}
        />
        <MetricCard
          title="Empleados"
          value={`${metrics.employees}`}
          change={`${metrics.employeesChange > 0 ? "+" : ""}${metrics.employeesChange}%`}
        />
        <MetricCard
          title="Conversión"
          value={`${metrics.conversion}%`}
          change={`${metrics.conversionChange > 0 ? "+" : ""}${metrics.conversionChange}%`}
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  heading: {
    fontSize: fontSize.xl,
    fontWeight: "800",
    color: colors.text,
    marginBottom: spacing.xl,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: "48%",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: fontSize.xs, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.5 },
  cardValue: { fontSize: fontSize.xl, fontWeight: "800", color: colors.text, marginTop: spacing.xs },
  cardChange: { fontSize: fontSize.xs, marginTop: spacing.xs },
});
