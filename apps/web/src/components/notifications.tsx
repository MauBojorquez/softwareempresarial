"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";

type AppNotification = {
  id: string;
  title: string;
  message: string;
  time: Date;
  read: boolean;
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  useEffect(() => {
    if ("Notification" in window) {
      setPermission(Notification.permission);
    }
    const stored = localStorage.getItem("metrixpro-notifications");
    if (stored) {
      try { setNotifications(JSON.parse(stored)); } catch {}
    }
  }, []);

  const requestPermission = async () => {
    if ("Notification" in window) {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm === "granted") {
        addNotification("Notificaciones activadas", "Recibirás alertas cuando se actualicen tus métricas.");
      }
    }
  };

  const addNotification = (title: string, message: string) => {
    const notif: AppNotification = {
      id: Date.now().toString(),
      title,
      message,
      time: new Date(),
      read: false,
    };
    const updated = [notif, ...notifications].slice(0, 20);
    setNotifications(updated);
    localStorage.setItem("metrixpro-notifications", JSON.stringify(updated));

    if ("Notification" in window && window.Notification.permission === "granted") {
      new window.Notification(title, { body: message, icon: "/favicon.ico" });
    }
  };

  const markAllRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    localStorage.setItem("metrixpro-notifications", JSON.stringify(updated));
  };

  const clearAll = () => {
    setNotifications([]);
    localStorage.removeItem("metrixpro-notifications");
    setOpen(false);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const timeAgo = (date: Date) => {
    const d = new Date(date);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Ahora";
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) markAllRead(); }}
        aria-label="Notificaciones"
        className="relative rounded-lg border border-border bg-card p-2 text-muted-foreground transition-colors hover:text-foreground hover:bg-secondary"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border p-3">
              <h3 className="text-sm font-semibold">Notificaciones</h3>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground">
                    Limpiar
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <BellOff className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">Sin notificaciones</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className="border-b border-border p-3 last:border-0 hover:bg-secondary/30">
                    <div className="flex items-start justify-between">
                      <p className="text-xs font-medium">{n.title}</p>
                      <span className="text-[10px] text-muted-foreground ml-2 shrink-0">{timeAgo(n.time)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
                  </div>
                ))
              )}
            </div>

            {permission !== "granted" && (
              <div className="border-t border-border p-3">
                <button
                  onClick={requestPermission}
                  className="w-full rounded-lg gradient-bg py-2 text-xs font-medium text-white hover:opacity-90"
                >
                  Activar Notificaciones Push
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function sendMetricNotification(title: string, message: string) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body: message, icon: "/favicon.ico" });
  }
  const stored = localStorage.getItem("metrixpro-notifications");
  const list = stored ? JSON.parse(stored) : [];
  list.unshift({ id: Date.now().toString(), title, message, time: new Date(), read: false });
  localStorage.setItem("metrixpro-notifications", JSON.stringify(list.slice(0, 20)));
}
