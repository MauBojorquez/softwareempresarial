import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl } from "react-native";
import { colors, spacing, fontSize, borderRadius } from "../theme";
import { fetchFinanceMetrics } from "../services/api";

function FinanceCard({
  label,
  value,
  change,
  positive,
}: {
  label: string;
  value: string;
  change: string;
  positive: boolean;
}) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
      <Text style={[styles.change, { color: positive ? colors.success : colors.danger }]}>
        {change}
      </Text>
    </View>
  );
}

export function FinanceScreen() {
  const [data, setData] = useState({
    income: 620000,
    incomeChange: 10.7,
    expenses: 360000,
    expensesChange: 2.9,
    netProfit: 260000,
    netProfitChange: 22.4,
    cashFlow: 180000,
    cashFlowChange: 8.1,
  });
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const d = await fetchFinanceMetrics();
      setData(d);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const fmt = (n: number) => `$${(n / 1000).toFixed(0)}k MXN`;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={styles.heading}>Finanzas</Text>
      <FinanceCard label="Ingresos del Mes" value={fmt(data.income)} change={`+${data.incomeChange}%`} positive />
      <FinanceCard label="Gastos del Mes" value={fmt(data.expenses)} change={`+${data.expensesChange}%`} positive={false} />
      <FinanceCard label="Utilidad Neta" value={fmt(data.netProfit)} change={`+${data.netProfitChange}%`} positive />
      <FinanceCard label="Flujo de Caja" value={fmt(data.cashFlow)} change={`+${data.cashFlowChange}%`} positive />
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
  change: { fontSize: fontSize.sm, marginTop: spacing.xs },
});
