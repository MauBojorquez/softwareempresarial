"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCw } from "lucide-react";

type Check = { name: string; status: "operational" | "degraded" | "down"; latencyMs?: number; note?: string };
type Data = { status: Check["status"]; checks: Check[]; timestamp: string };

const META: Record<Check["status"], { label: string; color: string; bg: string; Icon: any }> = {
  operational: { label: "Operativo", color: "#16a34a", bg: "#dcfce7", Icon: CheckCircle2 },
  degraded: { label: "Degradado", color: "#d97706", bg: "#fef3c7", Icon: AlertTriangle },
  down: { label: "Caído", color: "#dc2626", bg: "#fee2e2", Icon: XCircle },
};

const OVERALL_TEXT: Record<Check["status"], string> = {
  operational: "Todos los sistemas operativos",
  degraded: "Algunos sistemas con rendimiento degradado",
  down: "Interrupción detectada en uno o más sistemas",
};

export default function StatusPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  const overall = data ? META[data.status] : META.operational;

  return (
    <div style={{ minHeight: "100vh", background: "#f5f6f8", fontFamily: "Inter, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700 }}>M</div>
          <span style={{ fontSize: 18, fontWeight: 700, color: "#18181b" }}>StratiuMetrics · Estado</span>
        </div>

        {loading && !data ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 64 }}>
            <Loader2 className="animate-spin" style={{ color: "#6b7280" }} />
          </div>
        ) : data ? (
          <>
            <div style={{ background: "#fff", border: "1px solid #e4e4e7", borderRadius: 16, padding: 24, marginBottom: 16, display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: overall.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <overall.Icon style={{ color: overall.color }} size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#18181b" }}>{OVERALL_TEXT[data.status]}</p>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: "#6b7280" }}>
                  Actualizado {new Date(data.timestamp).toLocaleTimeString("es-MX")}
                </p>
              </div>
              <button onClick={load} aria-label="Actualizar" style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}>
                <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              </button>
            </div>

            <div style={{ background: "#fff", border: "1px solid #e4e4e7", borderRadius: 16, overflow: "hidden" }}>
              {data.checks.map((c, i) => {
                const m = META[c.status];
                return (
                  <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderTop: i === 0 ? "none" : "1px solid #f4f4f5" }}>
                    <m.Icon size={18} style={{ color: m.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 14, color: "#18181b" }}>{c.name}</span>
                    {c.latencyMs != null && <span style={{ fontSize: 12, color: "#6b7280" }}>{c.latencyMs} ms</span>}
                    <span style={{ fontSize: 12, fontWeight: 600, color: m.color }}>{c.note ?? m.label}</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p style={{ textAlign: "center", color: "#6b7280" }}>No se pudo cargar el estado.</p>
        )}

        <p style={{ textAlign: "center", fontSize: 12, color: "#6b7280", marginTop: 28 }}>
          © 2026 StratiuMetrics · Esta página se actualiza automáticamente cada minuto
        </p>
      </div>
    </div>
  );
}
