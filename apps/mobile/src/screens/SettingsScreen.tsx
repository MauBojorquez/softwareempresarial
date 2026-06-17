import React from "react";
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from "react-native";

export function SettingsScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.heading}>Configuración</Text>
      {[
        { label: "Perfil", value: "Editar" },
        { label: "Empresa", value: "Mi Empresa S.A." },
        { label: "Integraciones", value: "2 activas" },
        { label: "Suscripción", value: "Professional" },
        { label: "Notificaciones", value: "Activadas" },
      ].map((item, i) => (
        <TouchableOpacity key={i} style={styles.row}>
          <Text style={styles.rowLabel}>{item.label}</Text>
          <Text style={styles.rowValue}>{item.value}</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity style={styles.logoutButton}>
        <Text style={styles.logoutText}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc", padding: 16 },
  heading: { fontSize: 24, fontWeight: "bold", marginBottom: 16 },
  row: {
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderColor: "#e2e8f0",
  },
  rowLabel: { fontSize: 15 },
  rowValue: { fontSize: 14, color: "#64748b" },
  logoutButton: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#dc2626",
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
  },
  logoutText: { color: "#dc2626", fontSize: 15, fontWeight: "600" },
});
