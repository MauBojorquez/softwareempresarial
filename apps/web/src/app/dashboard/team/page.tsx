"use client";

import { useEffect, useState } from "react";
import { Users, Activity, Loader2, Circle, LogIn, Eye, Plus, Pencil, Trash2, FileText, Target, Plug, Mail, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

const ACTION_LABEL: Record<string, string> = {
  login: "inició sesión",
  "page.view": "visitó una sección",
  "metric.create": "agregó una métrica",
  "metric.update": "editó una métrica",
  "metric.delete": "eliminó una métrica",
  "report.generate": "generó un reporte IA",
  "goal.create": "creó una meta",
  "integration.connect": "conectó una integración",
  "integration.disconnect": "desconectó una integración",
  "invite.send": "envió una invitación",
};
const activityLabel = (a: string) => ACTION_LABEL[a] ?? a;

type Member = {
  id: string; name: string | null; email: string; avatar: string | null;
  role: string; joinedAt: string; lastSeen: string | null; events30d: number;
};
type ActivityItem = {
  id: string; action: string; detail: string | null; path: string | null; createdAt: string;
  user: { id: string; name: string | null; email: string; avatar: string | null };
};
type Data = {
  members: Member[];
  activity: ActivityItem[];
  stats: { totalMembers: number; activeMembers: number; events30d: number };
};

const ACTION_ICON: Record<string, any> = {
  login: LogIn,
  "page.view": Eye,
  "metric.create": Plus,
  "metric.update": Pencil,
  "metric.delete": Trash2,
  "report.generate": FileText,
  "goal.create": Target,
  "integration.connect": Plug,
  "integration.disconnect": Plug,
  "invite.send": Mail,
};

function relative(iso: string | null): string {
  if (!iso) return "Nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Justo ahora";
  if (m < 60) return `Hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `Hace ${d} d`;
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

const ROLE_LABEL: Record<string, string> = { ADMIN: "Administrador", EDITOR: "Editor", VIEWER: "Lector" };

function initials(name: string | null, email: string) {
  return (name || email).split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function Avatar({ user, size = 9 }: { user: { name: string | null; email: string; avatar: string | null }; size?: number }) {
  if (user.avatar) {
    return <img src={user.avatar} alt="" className="rounded-full object-cover border border-border flex-shrink-0" style={{ height: size * 4, width: size * 4 }} />;
  }
  return (
    <div className="rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0" style={{ height: size * 4, width: size * 4 }}>
      <span className="text-xs font-semibold text-primary">{initials(user.name, user.email)}</span>
    </div>
  );
}

export default function TeamPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/team/activity", { signal: controller.signal })
      .then((r) => { if (!r.ok) throw new Error("Error al cargar el equipo"); return r.json(); })
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { if (e.name !== "AbortError") { setError(e.message); setLoading(false); } });
    return () => controller.abort();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }
  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-16 text-center">
        <Activity className="h-8 w-8 text-muted-foreground mb-3" />
        <h3 className="text-base font-semibold">No se pudo cargar el equipo</h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">{error || "Sin datos disponibles"}</p>
        <button
          onClick={() => { setLoading(true); setError(null); fetch("/api/team/activity").then((r) => r.json()).then((d) => { setData(d); setLoading(false); }).catch((e) => { setError(e.message); setLoading(false); }); }}
          className="mt-4 flex items-center gap-2 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <RefreshCw className="h-4 w-4" /> Reintentar
        </button>
      </div>
    );
  }

  const isOnline = (iso: string | null) => iso != null && Date.now() - new Date(iso).getTime() < 10 * 60 * 1000;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2"><Users className="h-6 w-6 text-primary" /> Equipo</h1>
        <p className="text-sm text-muted-foreground mt-1">Quién usa MetrixPro, qué hacen y cuándo se conectaron por última vez.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Miembros", value: data.stats.totalMembers, icon: Users },
          { label: "Activos (30 días)", value: data.stats.activeMembers, icon: Circle },
          { label: "Acciones (30 días)", value: data.stats.events30d, icon: Activity },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-muted-foreground"><s.icon className="h-4 w-4" /><span className="text-xs font-medium">{s.label}</span></div>
            <p className="mt-2 text-3xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Members */}
        <div className="lg:col-span-3 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border"><h2 className="font-semibold text-foreground">Miembros</h2></div>
          <div className="divide-y divide-border">
            {data.members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="relative">
                  <Avatar user={m} />
                  {isOnline(m.lastSeen) && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-card" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.name || m.email}</p>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                </div>
                <div className="text-right">
                  <span className={cn("inline-block rounded-full px-2 py-0.5 text-[10px] font-medium",
                    m.role === "ADMIN" ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground")}>
                    {ROLE_LABEL[m.role] ?? m.role}
                  </span>
                  <p className="text-xs text-muted-foreground mt-1">{relative(m.lastSeen)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity feed */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-5 py-4 border-b border-border"><h2 className="font-semibold text-foreground">Actividad reciente</h2></div>
          <div className="divide-y divide-border max-h-[520px] overflow-y-auto">
            {data.activity.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted-foreground">Aún no hay actividad registrada.</p>}
            {data.activity.map((a) => {
              const Icon = ACTION_ICON[a.action] ?? Activity;
              return (
                <div key={a.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="mt-0.5 h-7 w-7 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{a.user.name || a.user.email}</span>{" "}
                      <span className="text-muted-foreground">{activityLabel(a.action)}</span>
                      {a.detail && <span className="text-muted-foreground"> · {a.detail}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{relative(a.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
