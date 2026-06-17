import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";

export function SalesScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Ventas</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Pipeline Total</Text>
        <Text style={styles.value}>$7.4M MXN</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Deals Activos</Text>
        <Text style={styles.value}>45</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.label}>Tasa de Conversión</Text>
        <Text style={styles.value}>17.8%</Text>
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
});
