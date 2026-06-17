import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { colors, spacing, fontSize, borderRadius } from "../theme";
import { fetchReports, generateReport } from "../services/api";

type Report = {
  id: string;
  title: string;
  createdAt: string;
  summary: string;
  status: string;
};

export function ReportsScreen() {
  const [reports, setReports] = useState<Report[]>([
    {
      id: "1",
      title: "Reporte Mensual - Junio 2024",
      createdAt: "2024-07-01",
      summary:
        "Los ingresos crecieron 10.7% impulsados por 3 deals enterprise. La tasa de conversión requiere atención. Se recomienda revisar el proceso de calificación de leads.",
      status: "COMPLETED",
    },
  ]);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    try {
      const data = await fetchReports();
      setReports(data);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await generateReport();
      await load();
    } catch {}
    setGenerating(false);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <Text style={styles.heading}>Reportes IA</Text>

      {reports.map((r) => (
        <View key={r.id} style={styles.card}>
          <Text style={styles.reportTitle}>{r.title}</Text>
          <Text style={styles.reportDate}>{new Date(r.createdAt).toLocaleDateString("es-MX")}</Text>
          <Text style={styles.reportSummary}>{r.summary}</Text>
          <TouchableOpacity style={styles.viewButton}>
            <Text style={styles.viewButtonText}>Ver Reporte Completo</Text>
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity
        style={[styles.generateButton, generating && { opacity: 0.6 }]}
        onPress={handleGenerate}
        disabled={generating}
      >
        {generating ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.generateButtonText}>Generar Nuevo Reporte</Text>
        )}
      </TouchableOpacity>
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
  reportTitle: { fontSize: fontSize.md, fontWeight: "700", color: colors.text },
  reportDate: { fontSize: fontSize.xs, color: colors.textMuted, marginTop: 2 },
  reportSummary: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: spacing.md, lineHeight: 20 },
  viewButton: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    alignItems: "center",
  },
  viewButtonText: { fontSize: fontSize.sm, fontWeight: "600", color: colors.primary },
  generateButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.xxxl,
  },
  generateButtonText: { color: "#fff", fontSize: fontSize.md, fontWeight: "700" },
});
