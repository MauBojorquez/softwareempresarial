import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";
import { colors, spacing, fontSize, borderRadius } from "../theme";
import { useAuth } from "../contexts/AuthContext";

export function SettingsScreen() {
  const { logout } = useAuth();

  const rows = [
    { label: "Perfil", value: "Editar" },
    { label: "Empresa", value: "Mi Empresa S.A." },
    { label: "Integraciones", value: "2 activas" },
    { label: "Suscripción", value: "Professional" },
    { label: "Notificaciones", value: "Activadas" },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Configuración</Text>
      <View style={styles.section}>
        {rows.map((item, i) => (
          <TouchableOpacity key={i} style={[styles.row, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={styles.rowLabel}>{item.label}</Text>
            <Text style={styles.rowValue}>{item.value}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  heading: { fontSize: fontSize.xl, fontWeight: "800", color: colors.text, marginBottom: spacing.xl },
  section: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  rowLabel: { fontSize: fontSize.md, color: colors.text },
  rowValue: { fontSize: fontSize.sm, color: colors.textMuted },
  logoutButton: {
    marginTop: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: "center",
  },
  logoutText: { color: colors.danger, fontSize: fontSize.md, fontWeight: "700" },
});
