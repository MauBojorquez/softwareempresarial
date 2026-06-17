import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";

function MetricCard({ title, value, change }: { title: string; value: string; change?: string }) {
  const isPositive = change?.startsWith("+");
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardValue}>{value}</Text>
      {change && (
        <Text style={[styles.cardChange, { color: isPositive ? "#059669" : "#dc2626" }]}>
          {change} vs mes anterior
        </Text>
      )}
    </View>
  );
}

export function DashboardScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Resumen Ejecutivo</Text>
      <View style={styles.grid}>
        <MetricCard title="Ingresos" value="$620,000" change="+10.7%" />
        <MetricCard title="Pipeline" value="$7.4M" change="+5.2%" />
        <MetricCard title="Empleados" value="48" change="+4.3%" />
        <MetricCard title="Conversión" value="17.8%" change="-2.1%" />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16 },
  heading: { fontSize: 24, fontWeight: "bold", marginBottom: 16 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    width: "48%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardTitle: { fontSize: 12, color: "#64748b" },
  cardValue: { fontSize: 22, fontWeight: "bold", marginTop: 4 },
  cardChange: { fontSize: 11, marginTop: 4 },
});
