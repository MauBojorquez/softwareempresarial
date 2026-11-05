"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const { status } = useSession();
  const router = useRouter();
  const [state, setState] = useState<"loading" | "success" | "error" | "auth">("loading");
  const [message, setMessage] = useState("");
  const [orgName, setOrgName] = useState("");

  // Accept is not idempotent (a second POST answers 409). The session object
  // changes identity on every refetch (focus, polling), so key the effect on
  // `status` and remember which resolved status already ran the accept; once
  // it succeeded, never run it again.
  const acceptedFor = useRef<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    if (status === "loading") return;
    if (done.current || acceptedFor.current === status) return;
    acceptedFor.current = status;
    fetch("/api/invitations/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.requiresAuth) {
          setOrgName(d.orgName);
          setState("auth");
        } else if (d.success) {
          done.current = true;
          setOrgName(d.orgName);
          setState("success");
          setTimeout(() => router.push("/dashboard/overview"), 2500);
        } else {
          setMessage(d.error ?? "Error al aceptar la invitación");
          setState("error");
        }
      })
      .catch(() => { setMessage("Error de conexión"); setState("error"); });
  }, [token, status, router]);

  if (state === "loading") return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lg">
        <div className="mb-2 text-3xl font-bold tracking-tight gradient-text">StratiuMetrics</div>

        {state === "success" && (
          <>
            <CheckCircle className="mx-auto mt-6 h-12 w-12 text-emerald-500" />
            <h2 className="mt-4 text-xl font-semibold">¡Bienvenido a {orgName}!</h2>
            <p className="mt-2 text-sm text-muted-foreground">Te redirigimos al dashboard...</p>
          </>
        )}

        {state === "error" && (
          <>
            <XCircle className="mx-auto mt-6 h-12 w-12 text-destructive" />
            <h2 className="mt-4 text-xl font-semibold">Invitación inválida</h2>
            <p className="mt-2 text-sm text-muted-foreground">{message}</p>
            <a href="/login" className="mt-6 inline-block rounded-xl gradient-bg px-6 py-2.5 text-sm font-medium text-white">
              Ir al inicio
            </a>
          </>
        )}

        {state === "auth" && (
          <>
            <h2 className="mt-6 text-xl font-semibold">Invitación a {orgName}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Inicia sesión o crea una contraseña para unirte a este equipo.
            </p>
            <div className="mt-6 flex flex-col gap-3">
              <a href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`} className="rounded-xl gradient-bg px-6 py-2.5 text-sm font-medium text-white">
                Iniciar sesión
              </a>
              <a href={`/invite/${token}/setup`} className="rounded-xl border border-border bg-secondary/50 px-6 py-2.5 text-sm font-medium hover:bg-secondary">
                Crear cuenta nueva
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
