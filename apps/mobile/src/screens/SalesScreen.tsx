import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { colors, spacing, fontSize, borderRadius } from "../theme";
import { fetchSalesMetrics } from "../services/api";

export function SalesScreen() {
  const [data, setData] = useState({
    pipeline: 7400000,
    activeDeals: 45,
    conversionRate: 17.8,
    avgDealSize: 164000,
  });
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const d = await fetchSalesMetrics();
      setData(d);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const cards = [
    { label: "Pipeline Total", value: `$${(data.pipeline / 1000000).toFixed(1)}M MXN` },
    { label: "Deals Activos", value: `${data.activeDeals}` },
    { label: "Tasa de Conversión", value: `${data.conversionRate}%` },
    { label: "Ticket Promedio", value: `$${(data.avgDealSize / 1000).toFixed(0)}k MXN` },
  ];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={styles.heading}>Ventas</Text>
      {cards.map((c, i) => (
        <View key={i} style={styles.card}>
          <Text style={styles.label}>{c.label}</Text>
          <Text style={styles.value}>{c.value}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  heading: { fontSize: fontSize.xl, fontWeight: "800", color: colors.text, marginBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  label: { fontSize: fontSize.sm, color: colors.textMuted },
  value: { fontSize: fontSize.xxl, fontWeight: "800", color: colors.text, marginTop: spacing.xs },
});
