import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";

export function ReportsScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Reportes IA</Text>
      <View style={styles.card}>
        <Text style={styles.reportTitle}>Reporte Mensual - Junio 2024</Text>
        <Text style={styles.reportDate}>Generado el 1 de julio</Text>
        <Text style={styles.reportSummary}>
          Los ingresos crecieron 10.7% impulsados por 3 deals enterprise. La tasa de conversión
          requiere atención. Se recomienda revisar el proceso de calificación de leads.
        </Text>
        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Ver Reporte Completo</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity style={styles.generateButton}>
        <Text style={styles.generateButtonText}>Generar Nuevo Reporte</Text>
      </TouchableOpacity>
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
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  reportTitle: { fontSize: 16, fontWeight: "600" },
  reportDate: { fontSize: 12, color: "#64748b", marginTop: 2 },
  reportSummary: { fontSize: 14, color: "#334155", marginTop: 12, lineHeight: 20 },
  button: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
  },
  buttonText: { fontSize: 14, fontWeight: "500" },
  generateButton: {
    marginTop: 16,
    backgroundColor: "#3b82f6",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  generateButtonText: { color: "#fff", fontSize: 15, fontWeight: "600" },
});
