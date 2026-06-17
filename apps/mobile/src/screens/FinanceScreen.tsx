import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";

export function FinanceScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Finanzas</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Ingresos del Mes</Text>
        <Text style={styles.value}>$620,000 MXN</Text>
        <Text style={styles.positive}>+10.7%</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Gastos del Mes</Text>
        <Text style={styles.value}>$360,000 MXN</Text>
        <Text style={styles.negative}>+2.9%</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Utilidad Neta</Text>
        <Text style={styles.value}>$260,000 MXN</Text>
        <Text style={styles.positive}>+22.4%</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16 },
  heading: { fontSize: 24, fontWeight: "bold", marginBottom: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  label: { fontSize: 13, color: "#64748b" },
  value: { fontSize: 28, fontWeight: "bold", marginTop: 4 },
  positive: { color: "#059669", fontSize: 13, marginTop: 4 },
  negative: { color: "#dc2626", fontSize: 13, marginTop: 4 },
});
