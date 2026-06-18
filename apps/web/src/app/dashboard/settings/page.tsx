"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "@/components/theme-provider";
import { Sun, Moon, Monitor, Bell, User, Building2 } from "lucide-react";

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const [notifications, setNotifications] = useState({
    metrics: false,
    reports: false,
    goals: false,
  });

  const handleNotificationToggle = async (key: keyof typeof notifications, value: boolean) => {
    if (value && typeof Notification !== "undefined" && Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
    }
    setNotifications((prev) => ({ ...prev, [key]: value }));
  };

  const themeOptions = [
    { value: "light" as const, label: "Claro", icon: Sun },
    { value: "dark" as const, label: "Oscuro", icon: Moon },
    { value: "system" as const, label: "Sistema", icon: Monitor },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Configuración</h1>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Perfil</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Nombre</p>
            <p className="text-sm font-medium text-foreground">{session?.user?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Correo electrónico</p>
            <p className="text-sm font-medium text-foreground">{session?.user?.email ?? "—"}</p>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Empresa</p>
              <p className="text-sm font-medium text-foreground">Mi Empresa</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Tema</h2>
        <div className="grid grid-cols-3 gap-3">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-all ${
                theme === opt.value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"
              }`}
            >
              <opt.icon className="h-5 w-5" />
              <span className="text-sm font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Notificaciones</h2>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Actualización de métricas</p>
              <p className="text-xs text-muted-foreground">Recibe alertas cuando tus métricas cambien significativamente</p>
            </div>
            <Toggle enabled={notifications.metrics} onChange={(v) => handleNotificationToggle("metrics", v)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Reporte listo</p>
              <p className="text-xs text-muted-foreground">Notificación cuando un reporte de IA esté generado</p>
            </div>
            <Toggle enabled={notifications.reports} onChange={(v) => handleNotificationToggle("reports", v)} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Meta alcanzada</p>
              <p className="text-xs text-muted-foreground">Aviso cuando se cumpla un objetivo configurado</p>
            </div>
            <Toggle enabled={notifications.goals} onChange={(v) => handleNotificationToggle("goals", v)} />
          </div>
        </div>
      </div>
    </div>
  );
}
