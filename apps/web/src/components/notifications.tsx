"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, BellOff, X, Loader2, Check, SlidersHorizontal, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { pushSupported, isSubscribed, subscribeToPush, unsubscribeFromPush } from "@/lib/push-client";

type AppNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
};

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const ok = pushSupported();
    setSupported(ok);
    if (ok) isSubscribed().then(setSubscribed).catch(() => {});
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (subscribed) {
        await unsubscribeFromPush();
        setSubscribed(false);
      } else {
        const ok = await subscribeToPush();
        setSubscribed(ok);
      }
    } catch {}
    setPushBusy(false);
  };

  const markAllRead = async () => {
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read_all" }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const clearAll = async () => {
    try {
      await fetch("/api/notifications", { method: "DELETE" });
      setNotifications([]);
      setUnreadCount(0);
      setOpen(false);
    } catch {}
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
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
        data-tour="notifications"
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
                  <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground">Limpiar</button>
                )}
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center">
                  <BellOff className="mx-auto h-6 w-6 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">Sin notificaciones</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div key={n.id} className={`border-b border-border p-3 last:border-0 hover:bg-secondary/30 ${!n.read ? "bg-primary/5" : ""}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-1.5">
                        {!n.read && <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />}
                        <p className="text-xs font-medium">{n.title}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground ml-2 shrink-0">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
                  </div>
                ))
              )}
            </div>

            {supported && (
              <div className="border-t border-border p-3">
                {!subscribed ? (
                  <>
                    <div className="mb-2.5 rounded-lg bg-secondary/50 p-2.5">
                      <p className="text-[11px] font-medium text-foreground">Te avisamos cuando:</p>
                      <ul className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                        <li>📊 Un reporte de IA está listo</li>
                        <li>⚠️ Una métrica sube o baja de forma importante</li>
                        <li>🎯 Se dispara una alerta que configuraste</li>
                      </ul>
                      <p className="mt-1.5 text-[10px] text-muted-foreground">Te llegan aquí y a tu celular o navegador, aunque la app esté cerrada.</p>
                    </div>
                    <button
                      onClick={togglePush}
                      disabled={pushBusy}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg gradient-bg py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                    >
                      {pushBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
                      Activar notificaciones
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mb-2.5 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-500/10 py-1.5 text-[11px] font-medium text-emerald-600">
                      <Check className="h-3.5 w-3.5" /> Notificaciones activadas
                    </div>
                    <button
                      onClick={() => { setOpen(false); router.push("/dashboard/settings#alertas"); }}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg gradient-bg py-2 text-xs font-medium text-white hover:opacity-90"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Configurar alertas
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <div className="mt-1.5 flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
                      <button
                        onClick={() => fetch("/api/push/test", { method: "POST" }).catch(() => {})}
                        className="hover:text-foreground"
                      >
                        Enviar prueba
                      </button>
                      <span>·</span>
                      <button
                        onClick={togglePush}
                        disabled={pushBusy}
                        className="hover:text-foreground disabled:opacity-50"
                      >
                        {pushBusy ? "..." : "Desactivar"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
