"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { useTheme } from "@/components/theme-provider";
import { useToast } from "@/components/toast";
import { useConfirm } from "@/components/ui/confirm";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { PageHeader, Card } from "@/components/ui/page-header";
import { EmptyState, ErrorState, RowsSkeleton, Skeleton } from "@/components/ui/states";
import { useApi } from "@/hooks/use-api";
import { refreshMe } from "@/hooks/use-me";
import {
  Sun, Moon, Monitor, User, Building2, Download, Trash2,
  AlertTriangle, Key, Plus, Copy, Eye, EyeOff, Save, Lock, Users, Mail, X,
  Camera, ImagePlus, BellRing, MessageCircle, Settings, UserPlus, SunMoon,
} from "lucide-react";
import { PhoneInput } from "@/components/settings/phone-input";
import { GoogleConnectCard } from "@/components/settings/google-connect";
import { SettingsSection } from "@/components/settings/section";


function Toggle({ enabled, onChange, label }: { enabled: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
    >
      <span className={`absolute left-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

type ApiKeyItem = { id: string; name: string; key: string; lastUsed: string | null; isActive: boolean; createdAt: string };

type AlertRuleItem = {
  id: string;
  metricName: string;
  category: string;
  condition: string;
  threshold: number;
  isActive: boolean;
  lastTriggered: string | null;
  createdAt: string;
};

const ROLE_LABELS: Record<string, string> = {
  VIEWER: "Visor",
  EDITOR: "Editor",
  ADMIN: "Administrador",
};

const JOB_ROLES = ["DIRECCION", "OPERACIONES", "COMERCIAL", "MARKETING", "ADMINISTRACION"] as const;
type JobRoleValue = (typeof JOB_ROLES)[number];
const JOB_ROLE_LABELS: Record<JobRoleValue, string> = {
  DIRECCION: "Dirección",
  OPERACIONES: "Operaciones",
  COMERCIAL: "Comercial",
  MARKETING: "Marketing",
  ADMINISTRACION: "Administración",
};

type Member = {
  membershipId: string;
  userId: string;
  name: string | null;
  email: string;
  role: string;
  jobRole: JobRoleValue | null;
};

type Invitation = { id: string; email: string; role: string; expiresAt: string; invitedBy: { name: string | null; email: string } };

const CONDITION_LABELS: Record<string, string> = {
  below: "Cae por debajo de",
  above: "Sube por encima de",
  change_pct_down: "Baja más de (%) vs mes anterior",
  change_pct_up: "Sube más de (%) vs mes anterior",
};

const CATEGORY_OPTIONS = ["FINANCE", "SALES", "OPERATIONS", "HR", "MARKETING"] as const;

const CATEGORY_LABELS: Record<string, string> = {
  FINANCE: "Finanzas",
  SALES: "Ventas",
  OPERATIONS: "Operaciones",
  HR: "RRHH",
  MARKETING: "Marketing",
};

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Read the server's error message from a failed response (or a fallback). */
async function errorOf(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return (data as { error?: string }).error || fallback;
}

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState({ name: "", email: "" });
  const [org, setOrg] = useState({ name: "", industry: "" });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState("#224CA0");
  const [savingBranding, setSavingBranding] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [contact, setContact] = useState({ phone: "", notifyEmail: true, notifyWhatsapp: false });
  const [savingContact, setSavingContact] = useState(false);

  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [clearingData, setClearingData] = useState(false);
  const [exportingCSV, setExportingCSV] = useState(false);

  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"VIEWER" | "EDITOR" | "ADMIN">("VIEWER");
  const [inviteJobRole, setInviteJobRole] = useState<"" | "DIRECCION" | "OPERACIONES" | "COMERCIAL" | "MARKETING" | "ADMINISTRACION">("");
  const [inviteSections, setInviteSections] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);

  const [newAlert, setNewAlert] = useState({
    metricName: "",
    category: "FINANCE" as (typeof CATEGORY_OPTIONS)[number],
    condition: "below" as string,
    threshold: "",
  });
  const [savingAlert, setSavingAlert] = useState(false);

  // Lists. Admin-only endpoints are requested once we know the user is Dirección.
  const keysApi = useApi<{ keys?: ApiKeyItem[] }>(isAdmin ? "/api/user/api-keys" : null);
  const invitesApi = useApi<{ invitations?: Invitation[] }>(isAdmin ? "/api/invitations" : null);
  const membersApi = useApi<{ members?: Member[]; ownerId?: string | null; currentUserId?: string | null }>(
    isAdmin ? "/api/members" : null,
  );
  const alertsApi = useApi<{ rules?: AlertRuleItem[] }>("/api/alerts");

  const apiKeys = Array.isArray(keysApi.data?.keys) ? keysApi.data!.keys! : [];
  const invitations = Array.isArray(invitesApi.data?.invitations) ? invitesApi.data!.invitations! : [];
  const members = Array.isArray(membersApi.data?.members) ? membersApi.data!.members! : [];
  const membersOwnerId = membersApi.data?.ownerId ?? null;
  const membersCurrentUserId = membersApi.data?.currentUserId ?? null;
  const alertRules = Array.isArray(alertsApi.data?.rules) ? alertsApi.data!.rules! : [];

  const setMembers = (fn: (prev: Member[]) => Member[]) =>
    membersApi.setData((d) => ({ ...(d ?? {}), members: fn(Array.isArray(d?.members) ? d!.members! : []) }));
  const setAlertRules = (fn: (prev: AlertRuleItem[]) => AlertRuleItem[]) =>
    alertsApi.setData((d) => ({ ...(d ?? {}), rules: fn(Array.isArray(d?.rules) ? d!.rules! : []) }));
  const setApiKeys = (fn: (prev: ApiKeyItem[]) => ApiKeyItem[]) =>
    keysApi.setData((d) => ({ ...(d ?? {}), keys: fn(Array.isArray(d?.keys) ? d!.keys! : []) }));
  const setInvitations = (fn: (prev: Invitation[]) => Invitation[]) =>
    invitesApi.setData((d) => ({ ...(d ?? {}), invitations: fn(Array.isArray(d?.invitations) ? d!.invitations! : []) }));

  const loadUser = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await fetch("/api/user");
      if (!r.ok) throw new Error(await errorOf(r, `Error ${r.status}`));
      const data = await r.json();
      if (data.user) {
        setProfile({ name: data.user.name || "", email: data.user.email || "" });
        if (data.user.theme && data.user.theme !== theme) setTheme(data.user.theme);
        if (data.user.avatar) setAvatar(data.user.avatar);
        setContact({
          phone: data.user.phone || "",
          notifyEmail: data.user.notifyEmail ?? true,
          notifyWhatsapp: data.user.notifyWhatsapp ?? false,
        });
      }
      if (data.organization) {
        setOrg({ name: data.organization.name || "", industry: data.organization.industry || "" });
        if (data.organization.logo) setOrgLogo(data.organization.logo);
        if (data.organization.brandColor) setBrandColor(data.organization.brandColor);
      }
      // Org/admin sections are Dirección-only. DIRECCION == ADMIN membership
      // here; accept either signal from /api/user.
      setIsAdmin(data.role === "ADMIN" || data.jobRole === "DIRECCION");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Sin conexión con el servidor.");
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUser();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast("La foto no debe superar 2 MB", "error"); return; }
    const base64 = await fileToBase64(file);
    setAvatar(base64);
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { toast("El logo no debe superar 2 MB", "error"); return; }
    const base64 = await fileToBase64(file);
    setOrgLogo(base64);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profile.name, orgName: org.name, industry: org.industry, theme, avatar }),
      });
      const data = await res.json();
      if (res.ok) {
        toast("Perfil actualizado", "success");
        await updateSession({ name: profile.name });
        // Sidebar / header read the cached /api/user: refresh name, avatar, org.
        refreshMe();
      } else {
        toast(data.error || "Error al guardar", "error");
      }
    } catch {
      toast("Error de conexión", "error");
    }
    setSaving(false);
  };

  const handleSaveBranding = async () => {
    setSavingBranding(true);
    try {
      const res = await fetch("/api/organizations/branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo: orgLogo, brandColor }),
      });
      const data = await res.json();
      if (res.ok) {
        toast("Marca actualizada", "success");
        refreshMe();
      } else {
        toast(data.error || "Error al guardar", "error");
      }
    } catch {
      toast("Error de conexión", "error");
    }
    setSavingBranding(false);
  };

  const handleChangePassword = async () => {
    if (passwords.new !== passwords.confirm) { toast("Las contraseñas no coinciden", "error"); return; }
    if (passwords.new.length < 8) { toast("Mínimo 8 caracteres", "error"); return; }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.new }),
      });
      const data = await res.json();
      if (res.ok) {
        toast("Contraseña actualizada", "success");
        setPasswords({ current: "", new: "", confirm: "" });
      } else {
        toast(data.error || "Error al cambiar contraseña", "error");
      }
    } catch {
      toast("Error de conexión", "error");
    }
    setSavingPassword(false);
  };

  const handleThemeChange = async (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: newTheme }),
      });
      if (!res.ok) toast(await errorOf(res, "No se pudo guardar el tema en tu cuenta"), "error");
    } catch {
      toast("No se pudo guardar el tema en tu cuenta", "error");
    }
  };

  const handleSaveContact = async () => {
    if (contact.notifyWhatsapp && !contact.phone) {
      toast("Agrega tu número de WhatsApp para recibir por ese medio", "error");
      return;
    }
    setSavingContact(true);
    try {
      const res = await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: contact.phone,
          notifyEmail: contact.notifyEmail,
          notifyWhatsapp: contact.notifyWhatsapp,
        }),
      });
      const data = await res.json();
      if (res.ok) toast("Preferencias guardadas", "success");
      else toast(data.error || "Error al guardar", "error");
    } catch {
      toast("Error de conexión", "error");
    }
    setSavingContact(false);
  };

  const handleCreateKey = async () => {
    setCreatingKey(true);
    try {
      const res = await fetch("/api/user/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName || "API Key" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNewKeyValue(data.key);
        setNewKeyName("");
        await keysApi.reload();
        toast("API Key creada", "success");
      } else {
        toast(data.error || "Error al crear API Key", "error");
      }
    } catch {
      toast("Error al crear API Key", "error");
    }
    setCreatingKey(false);
  };

  const handleDeleteKey = async (id: string) => {
    const ok = await confirm({
      title: "Eliminar API Key",
      description: "¿Eliminar esta API Key? Cualquier integración que la use dejará de funcionar.",
      confirmLabel: "Eliminar",
      destructive: true,
    });
    if (!ok) return;
    try {
      const res = await fetch("/api/user/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        toast(await errorOf(res, "Error al eliminar la API Key"), "error");
        return;
      }
      setApiKeys((prev) => prev.filter((k) => k.id !== id));
      toast("API Key eliminada", "success");
    } catch {
      toast("Error de conexión", "error");
    }
  };

  const handleExportCSV = async () => {
    setExportingCSV(true);
    try {
      const res = await fetch("/api/metrics/export?format=csv");
      if (!res.ok) throw new Error(await errorOf(res, "No se pudo exportar"));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `metrixpro-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Datos exportados", "success");
    } catch (e) {
      toast(e instanceof Error && e.message ? e.message : "No se pudo exportar", "error");
    }
    setExportingCSV(false);
  };

  const handleClearData = async () => {
    const ok = await confirm({
      title: "Eliminar todos los datos",
      description: "¿Eliminar todos los datos de métricas? Esta acción no se puede deshacer y perderás toda tu información.",
      confirmLabel: "Eliminar todo",
      destructive: true,
    });
    if (!ok) return;
    setClearingData(true);
    try {
      const res = await fetch("/api/metrics", { method: "DELETE" });
      if (res.ok) {
        toast("Datos eliminados correctamente. Recarga el dashboard para ver los cambios.", "success");
        setTimeout(() => window.location.reload(), 2000);
      } else {
        toast(await errorOf(res, "Error al eliminar los datos"), "error");
      }
    } catch {
      toast("Error de conexión", "error");
    }
    setClearingData(false);
  };

  const handleCreateAlert = async () => {
    if (!newAlert.metricName.trim()) { toast("Ingresa el nombre de la métrica", "error"); return; }
    const threshold = parseFloat(newAlert.threshold);
    if (isNaN(threshold) || threshold <= 0) { toast("El umbral debe ser mayor a 0", "error"); return; }
    setSavingAlert(true);
    try {
      const res = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metricName: newAlert.metricName.trim(),
          category: newAlert.category,
          condition: newAlert.condition,
          threshold,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAlertRules((prev) => [data.rule, ...prev]);
        setNewAlert({ metricName: "", category: "FINANCE", condition: "below", threshold: "" });
        toast("Alerta creada", "success");
      } else {
        toast(data.error || "Error al crear alerta", "error");
      }
    } catch {
      toast("Error de conexión", "error");
    }
    setSavingAlert(false);
  };

  const handleDeleteAlert = async (id: string) => {
    try {
      const res = await fetch(`/api/alerts?id=${id}`, { method: "DELETE" });
      if (!res.ok) { toast(await errorOf(res, "Error al eliminar la alerta"), "error"); return; }
      setAlertRules((prev) => prev.filter((r) => r.id !== id));
      toast("Alerta eliminada", "success");
    } catch {
      toast("Error de conexión", "error");
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      toast("Ingresa un correo electrónico válido", "error");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, allowedSections: inviteSections, jobRole: inviteJobRole || null }),
      });
      const data = await res.json();
      if (res.ok) {
        toast("Invitación enviada a " + inviteEmail, "success");
        setInviteEmail("");
        setInviteJobRole("");
        await invitesApi.reload();
      } else {
        toast(data.error || "Error al invitar", "error");
      }
    } catch {
      toast("Error de conexión", "error");
    }
    setInviting(false);
  };

  const handleSetJobRole = async (membershipId: string, jobRole: string) => {
    setSavingMemberId(membershipId);
    try {
      const res = await fetch("/api/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId, jobRole: jobRole || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setMembers((prev) => prev.map((m) => (m.membershipId === membershipId ? { ...m, jobRole: (jobRole || null) as JobRoleValue | null } : m)));
        toast("Puesto actualizado", "success");
      } else {
        toast(data.error || "No se pudo actualizar el puesto", "error");
      }
    } catch {
      toast("Error de conexión", "error");
    }
    setSavingMemberId(null);
  };

  const handleDeleteMember = async (member: Member) => {
    const ok = await confirm({
      title: "Eliminar acceso",
      description: `¿Eliminar el acceso de ${member.name || member.email}? Perderá el acceso a la app.`,
      confirmLabel: "Eliminar acceso",
      destructive: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/members?membershipId=${member.membershipId}`, { method: "DELETE" });
      if (!res.ok) {
        toast(await errorOf(res, "No se pudo eliminar el acceso"), "error");
        return;
      }
      setMembers((prev) => prev.filter((m) => m.membershipId !== member.membershipId));
      toast("Acceso eliminado", "success");
    } catch {
      toast("Error de conexión", "error");
    }
  };

  const handleRevokeInvite = async (id: string) => {
    try {
      const res = await fetch(`/api/invitations?id=${id}`, { method: "DELETE" });
      if (!res.ok) { toast(await errorOf(res, "Error al revocar la invitación"), "error"); return; }
      setInvitations((prev) => prev.filter((inv) => inv.id !== id));
      toast("Invitación revocada", "success");
    } catch {
      toast("Error de conexión", "error");
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "ELIMINAR") { toast("Escribe ELIMINAR para confirmar", "error"); return; }
    setDeleting(true);
    try {
      const res = await fetch("/api/user", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "ELIMINAR" }),
      });
      if (res.ok) {
        toast("Cuenta eliminada", "success");
        signOut({ callbackUrl: "/" });
      } else {
        toast(await errorOf(res, "Error al eliminar"), "error");
      }
    } catch {
      toast("Error de conexión", "error");
    }
    setDeleting(false);
  };

  const themeOptions = [
    { value: "light" as const, label: "Claro", icon: Sun },
    { value: "dark" as const, label: "Oscuro", icon: Moon },
    { value: "system" as const, label: "Sistema", icon: Monitor },
  ];

  const header = (
    <PageHeader icon={Settings} title="Configuración" description="Tu perfil, preferencias y la administración de tu empresa." />
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {header}
        <div className="flex gap-2 overflow-hidden" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-24 shrink-0 rounded-lg" />)}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="space-y-4 p-4 sm:p-6" aria-busy="true" aria-label="Cargando">
            <Skeleton className="h-5 w-40" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
            <Skeleton className="h-10 w-36" />
          </Card>
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        {header}
        <Card>
          <ErrorState message={loadError} onRetry={loadUser} />
        </Card>
      </div>
    );
  }

  const sections: { id: string; label: string; show: boolean }[] = [
    { id: "perfil", label: "Perfil", show: true },
    { id: "empresa", label: "Empresa", show: isAdmin },
    { id: "contrasena", label: "Contraseña", show: true },
    { id: "tema", label: "Tema", show: true },
    { id: "google", label: "Mi Google", show: true },
    { id: "reportes", label: "Cómo recibir reportes", show: true },
    { id: "alertas", label: "Alertas", show: true },
    { id: "miembros", label: "Miembros", show: isAdmin },
    { id: "invitar", label: "Invitar", show: isAdmin },
    { id: "api-keys", label: "API Keys", show: isAdmin },
    { id: "datos", label: "Datos", show: true },
    { id: "peligro", label: "Zona de peligro", show: true },
  ];

  const pwNewValid = passwords.new.length >= 8;
  const pwConfirmValid = passwords.confirm.length > 0 && passwords.confirm === passwords.new;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {header}

      {/* ── Navegación de secciones ── */}
      <nav aria-label="Secciones de configuración" className="-mx-4 px-4 sm:mx-0 sm:px-0">
        <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          {sections.filter((s) => s.show).map((s) => (
            <li key={s.id} className="shrink-0">
              <a
                href={`#${s.id}`}
                className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Perfil ── */}
      <SettingsSection id="perfil" icon={User} title="Perfil">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {avatar ? (
              <img src={avatar} alt="Foto de perfil" className="h-16 w-16 rounded-full object-cover border-2 border-border" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-border">
                <span className="text-xl font-bold text-primary">
                  {profile.name?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || session?.user?.email?.[0]?.toUpperCase() || "U"}
                </span>
              </div>
            )}
            <Button
              size="icon-sm"
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 rounded-full"
              aria-label="Cambiar foto de perfil"
            >
              <Camera />
            </Button>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Foto de perfil</p>
            <p className="text-xs text-muted-foreground">JPG, PNG o GIF · máx 2 MB</p>
            <div className="flex gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => avatarInputRef.current?.click()}>Cambiar</Button>
              {avatar && <Button variant="ghost" size="sm" onClick={() => setAvatar(null)}>Quitar</Button>}
            </div>
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre">
            <Input
              type="text"
              autoComplete="name"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </Field>
          <Field label="Correo electrónico">
            <Input type="email" value={profile.email} readOnly className="bg-secondary text-muted-foreground" />
          </Field>
        </div>
        {isAdmin && (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Building2 className="h-4 w-4 text-muted-foreground" /> Datos de la empresa
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Empresa">
                <Input
                  type="text"
                  value={org.name}
                  onChange={(e) => setOrg({ ...org, name: e.target.value })}
                />
              </Field>
              <Field label="Industria" optional>
                <Input
                  type="text"
                  value={org.industry}
                  onChange={(e) => setOrg({ ...org, industry: e.target.value })}
                  placeholder="Ej: Tecnología, Retail..."
                />
              </Field>
            </div>
          </div>
        )}
        <Button onClick={handleSaveProfile} loading={saving}>
          {!saving && <Save />}
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </SettingsSection>

      {/* ── Empresa: identidad visual (solo Dirección) ── */}
      {isAdmin && (
        <SettingsSection
          id="empresa"
          icon={Building2}
          title="Empresa: identidad visual"
          description="Tu logo y color de marca aparecerán en el sidebar y personalizarán la app para tu empresa."
        >
          {/* Logo */}
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              aria-label={orgLogo ? "Cambiar logo de empresa" : "Subir logo de empresa"}
              className="h-16 w-16 shrink-0 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden hover:border-primary/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {orgLogo ? (
                <img src={orgLogo} alt="" className="h-full w-full object-contain p-1" />
              ) : (
                <ImagePlus className="h-6 w-6 text-muted-foreground" />
              )}
            </button>
            <div className="min-w-0">
              <p className="text-sm font-medium">Logo de empresa</p>
              <p className="text-xs text-muted-foreground">PNG con fondo transparente recomendado · máx 2 MB</p>
              <div className="flex gap-2 mt-2">
                <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()}>
                  {orgLogo ? "Cambiar" : "Subir logo"}
                </Button>
                {orgLogo && <Button variant="ghost" size="sm" onClick={() => setOrgLogo(null)}>Quitar</Button>}
              </div>
            </div>
            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          </div>

          {/* Brand color */}
          <div className="flex items-end gap-4">
            <div className="relative h-16 w-16 shrink-0 rounded-xl border-2 border-border overflow-hidden cursor-pointer focus-within:ring-2 focus-within:ring-ring">
              <div className="h-full w-full" style={{ backgroundColor: brandColor }} />
              <input
                type="color"
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                aria-label="Elegir color de marca"
              />
            </div>
            <Field label="Color de marca" hint="Se aplica en acentos del sidebar y header" className="flex-1">
              <Input
                type="text"
                value={brandColor}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setBrandColor(v);
                }}
                className="max-w-[9rem] font-mono"
                placeholder="#224CA0"
              />
            </Field>
          </div>

          <Button onClick={handleSaveBranding} loading={savingBranding}>
            {!savingBranding && <Save />}
            {savingBranding ? "Guardando..." : "Guardar identidad visual"}
          </Button>
        </SettingsSection>
      )}

      {/* ── Contraseña ── */}
      <SettingsSection id="contrasena" icon={Lock} title="Contraseña">
        <div className="grid gap-4">
          <Field label="Contraseña actual">
            <Input
              type={showPasswords ? "text" : "password"}
              autoComplete="current-password"
              value={passwords.current}
              onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Nueva contraseña"
              hint="Mínimo 8 caracteres"
              error={passwords.new.length > 0 && !pwNewValid ? `Mínimo 8 caracteres (${passwords.new.length}/8)` : null}
            >
              <Input
                type={showPasswords ? "text" : "password"}
                autoComplete="new-password"
                value={passwords.new}
                onChange={(e) => setPasswords({ ...passwords, new: e.target.value })}
                className={pwNewValid ? "border-success/50" : undefined}
              />
            </Field>
            <Field
              label="Confirmar"
              error={passwords.confirm.length > 0 && !pwConfirmValid ? "Las contraseñas no coinciden" : null}
            >
              <Input
                type={showPasswords ? "text" : "password"}
                autoComplete="new-password"
                value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                className={pwConfirmValid ? "border-success/50" : undefined}
              />
            </Field>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={handleChangePassword}
            loading={savingPassword}
            disabled={!passwords.current || !passwords.new}
          >
            {!savingPassword && <Lock />}
            Cambiar contraseña
          </Button>
          <Button variant="ghost" onClick={() => setShowPasswords(!showPasswords)} aria-pressed={showPasswords}>
            {showPasswords ? <EyeOff /> : <Eye />}
            {showPasswords ? "Ocultar contraseñas" : "Mostrar contraseñas"}
          </Button>
        </div>
      </SettingsSection>

      {/* ── Tema ── */}
      <SettingsSection
        id="tema"
        icon={SunMoon}
        title="Tema"
        description="El tema se sincroniza con tu cuenta en todos los dispositivos."
      >
        <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Tema">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={theme === opt.value}
              onClick={() => handleThemeChange(opt.value)}
              className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${theme === opt.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary/60 hover:text-foreground"}`}
            >
              <opt.icon className="h-5 w-5" />
              <span className="text-sm font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </SettingsSection>

      {/* ── Google: correo y reuniones para los pendientes ── */}
      <GoogleConnectCard id="google" />

      {/* ── Cómo recibir reportes ── */}
      <SettingsSection
        id="reportes"
        icon={MessageCircle}
        title="Cómo recibir reportes"
        description="Elige cómo quieres recibir tus resúmenes, alertas y avisos. Puedes activar correo, WhatsApp o ambos."
      >
        <Field label="Número de WhatsApp" hint="Selecciona tu país (lada) y escribe tu número. Ej: 🇲🇽 +52 442 123 4567">
          <PhoneInput value={contact.phone} onChange={(phone) => setContact((c) => ({ ...c, phone }))} />
        </Field>

        {/* Canales */}
        <div className="divide-y divide-border rounded-lg border border-border">
          <div className="flex items-center justify-between gap-3 px-3 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Por correo</p>
                <p className="truncate text-xs text-muted-foreground">{profile.email}</p>
              </div>
            </div>
            <Toggle label="Notificaciones por correo" enabled={contact.notifyEmail} onChange={(v) => setContact((c) => ({ ...c, notifyEmail: v }))} />
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <MessageCircle className="h-4 w-4 shrink-0 text-success" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">Por WhatsApp</p>
                <p className="text-xs text-muted-foreground">
                  {contact.phone ? "Al número de arriba" : "Agrega tu número primero"}
                </p>
              </div>
            </div>
            <Toggle label="Notificaciones por WhatsApp" enabled={contact.notifyWhatsapp} onChange={(v) => setContact((c) => ({ ...c, notifyWhatsapp: v }))} />
          </div>
        </div>

        <Button onClick={handleSaveContact} loading={savingContact}>
          {!savingContact && <Save />}
          {savingContact ? "Guardando..." : "Guardar preferencias"}
        </Button>
      </SettingsSection>

      {/* ── Alertas ── */}
      <SettingsSection
        id="alertas"
        icon={BellRing}
        title="Alertas por correo"
        description="Define reglas para recibir un correo cuando una métrica supere un umbral específico."
      >
        {alertsApi.initialLoading ? (
          <div className="rounded-lg border border-border"><RowsSkeleton rows={2} /></div>
        ) : alertsApi.error && !alertsApi.data ? (
          <div className="rounded-lg border border-border">
            <ErrorState message={alertsApi.error} onRetry={alertsApi.reload} className="py-8" />
          </div>
        ) : alertRules.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border">
            <EmptyState icon={BellRing} title="Sin alertas" description="Crea tu primera regla con el formulario de abajo." className="py-8" />
          </div>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border">
            {alertRules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{rule.metricName}</p>
                  <p className="text-xs text-muted-foreground">
                    {CONDITION_LABELS[rule.condition] ?? rule.condition} {rule.threshold} · {CATEGORY_LABELS[rule.category] ?? rule.category}
                  </p>
                  {rule.lastTriggered && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Última activación: {new Date(rule.lastTriggered).toLocaleDateString("es-MX")}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => handleDeleteAlert(rule.id)}
                  className="hover:text-destructive"
                  aria-label={`Eliminar alerta ${rule.metricName}`}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-sm font-medium text-foreground">Nueva alerta</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre de la métrica">
              <Input
                type="text"
                value={newAlert.metricName}
                onChange={(e) => setNewAlert({ ...newAlert, metricName: e.target.value })}
                placeholder="Ej: Ventas del Mes"
              />
            </Field>
            <Field label="Categoría">
              <Select
                value={newAlert.category}
                onChange={(e) => setNewAlert({ ...newAlert, category: e.target.value as (typeof CATEGORY_OPTIONS)[number] })}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Condición">
              <Select
                value={newAlert.condition}
                onChange={(e) => setNewAlert({ ...newAlert, condition: e.target.value })}
              >
                {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Umbral">
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={newAlert.threshold}
                onChange={(e) => setNewAlert({ ...newAlert, threshold: e.target.value })}
                placeholder="Ej: 20 o 500000"
              />
            </Field>
          </div>
          <Button onClick={handleCreateAlert} loading={savingAlert}>
            {!savingAlert && <Plus />}
            Crear alerta
          </Button>
        </div>
      </SettingsSection>

      {/* ── Miembros y Puestos (solo Dirección) ── */}
      {isAdmin && (
        <SettingsSection
          id="miembros"
          icon={Users}
          title="Miembros y puestos"
          description={
            <>
              Asigna el puesto de cada persona. El puesto define qué puede ver y hacer en la app.
              Un miembro <span className="text-warning font-medium">sin puesto asignado</span> no tiene acceso a los módulos por rol.
            </>
          }
        >
          {membersApi.initialLoading ? (
            <div className="rounded-lg border border-border"><RowsSkeleton rows={3} /></div>
          ) : membersApi.error && !membersApi.data ? (
            <div className="rounded-lg border border-border">
              <ErrorState message={membersApi.error} onRetry={membersApi.reload} className="py-8" />
            </div>
          ) : members.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border">
              <EmptyState
                icon={Users}
                title="Sin miembros"
                description="Invita a tu equipo para asignarles un puesto."
                action={<Button variant="outline" size="sm" asChild><a href="#invitar"><UserPlus /> Invitar usuarios</a></Button>}
                className="py-8"
              />
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {members.map((m) => (
                <div key={m.membershipId} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{m.name || m.email}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {m.email} · {ROLE_LABELS[m.role] ?? m.role}
                      {!m.jobRole && <span className="ml-2 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">Sin puesto</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={m.jobRole ?? ""}
                      disabled={savingMemberId === m.membershipId}
                      aria-busy={savingMemberId === m.membershipId || undefined}
                      onChange={(e) => handleSetJobRole(m.membershipId, e.target.value)}
                      aria-label={`Puesto de ${m.name || m.email}`}
                      className="sm:w-48"
                    >
                      <option value="">Sin puesto</option>
                      {JOB_ROLES.map((jr) => (
                        <option key={jr} value={jr}>{JOB_ROLE_LABELS[jr]}</option>
                      ))}
                    </Select>
                    {m.userId !== membersCurrentUserId && m.userId !== membersOwnerId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteMember(m)}
                        className="shrink-0 hover:text-destructive"
                        aria-label={`Eliminar acceso de ${m.name || m.email}`}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SettingsSection>
      )}

      {/* ── Invitar Usuarios (solo Dirección) ── */}
      {isAdmin && (
        <SettingsSection
          id="invitar"
          icon={UserPlus}
          title="Invitar usuarios"
          description={
            <>
              Invita a miembros de tu equipo. Recibirán un correo con el enlace de acceso.{" "}
              <span className="text-warning">El correo puede llegar a spam — pídeles que lo revisen.</span>
            </>
          }
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Correo" className="sm:col-span-3">
              <Input type="email" autoComplete="off" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="correo@empresa.com" />
            </Field>
            <Field label="Rol" className="sm:col-span-1">
              <Select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "VIEWER" | "EDITOR" | "ADMIN")}>
                <option value="VIEWER">Visor</option>
                <option value="EDITOR">Editor</option>
                <option value="ADMIN">Administrador</option>
              </Select>
            </Field>
            <Field label="Puesto" optional className="sm:col-span-2">
              <Select value={inviteJobRole} onChange={(e) => setInviteJobRole(e.target.value as typeof inviteJobRole)}>
                <option value="">Sin asignar</option>
                <option value="DIRECCION">Dirección</option>
                <option value="OPERACIONES">Operaciones</option>
                <option value="COMERCIAL">Comercial</option>
                <option value="MARKETING">Marketing</option>
                <option value="ADMINISTRACION">Administración</option>
              </Select>
            </Field>
          </div>
          <fieldset>
            <legend className="text-sm font-medium text-foreground mb-2">
              Acceso a secciones <span className="text-xs font-normal text-muted-foreground">(deja vacío para acceso completo)</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "FINANCE", label: "Finanzas" },
                { key: "SALES", label: "Ventas" },
                { key: "OPERATIONS", label: "Operaciones" },
                { key: "HR", label: "RRHH" },
                { key: "MARKETING", label: "Marketing" },
              ].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  aria-pressed={inviteSections.includes(s.key)}
                  onClick={() => setInviteSections((prev) => prev.includes(s.key) ? prev.filter((x) => x !== s.key) : [...prev, s.key])}
                  className={`h-9 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${inviteSections.includes(s.key) ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:bg-secondary/60 hover:text-foreground"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </fieldset>
          <Button onClick={handleInvite} loading={inviting} disabled={!inviteEmail}>
            {!inviting && <Mail />}
            Invitar
          </Button>

          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">Invitaciones pendientes</p>
            {invitesApi.initialLoading ? (
              <div className="rounded-lg border border-border"><RowsSkeleton rows={2} /></div>
            ) : invitesApi.error && !invitesApi.data ? (
              <div className="rounded-lg border border-border">
                <ErrorState message={invitesApi.error} onRetry={invitesApi.reload} className="py-8" />
              </div>
            ) : invitations.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border">
                <EmptyState icon={Mail} title="Sin invitaciones pendientes" description="Las invitaciones que envíes aparecerán aquí hasta que se acepten." className="py-6" />
              </div>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {invitations.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{inv.email}</p>
                      <p className="text-xs text-muted-foreground">{ROLE_LABELS[inv.role] ?? inv.role} · Expira {new Date(inv.expiresAt).toLocaleDateString("es-MX")}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRevokeInvite(inv.id)}
                      className="hover:text-destructive"
                      aria-label={`Revocar invitación de ${inv.email}`}
                    >
                      <X />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SettingsSection>
      )}

      {/* ── API Keys (solo Dirección) ── */}
      {isAdmin && (
        <SettingsSection
          id="api-keys"
          icon={Key}
          title="API Keys"
          description="Crea API Keys para enviar métricas desde sistemas externos vía REST API."
        >
          {newKeyValue && (
            <div role="status" className="rounded-lg border border-success/30 bg-success/10 p-3 space-y-2">
              <p className="text-xs font-medium text-success">Copia tu API Key — no se mostrará de nuevo:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-background px-3 py-1.5 text-xs font-mono border border-border break-all">{newKeyValue}</code>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => { navigator.clipboard.writeText(newKeyValue); toast("Copiado", "success"); }}
                  aria-label="Copiar API Key"
                >
                  <Copy />
                </Button>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setNewKeyValue(null)}>Cerrar</Button>
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Nombre de la key" optional className="flex-1">
              <Input type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Ej: Mi CRM" />
            </Field>
            <Button onClick={handleCreateKey} loading={creatingKey}>
              {!creatingKey && <Plus />}
              Crear
            </Button>
          </div>
          {keysApi.initialLoading ? (
            <div className="rounded-lg border border-border"><RowsSkeleton rows={2} /></div>
          ) : keysApi.error && !keysApi.data ? (
            <div className="rounded-lg border border-border">
              <ErrorState message={keysApi.error} onRetry={keysApi.reload} className="py-8" />
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border">
              <EmptyState icon={Key} title="Sin API Keys" description="Crea una key para conectar tus sistemas externos." className="py-6" />
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {apiKeys.map((k) => (
                <div key={k.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{k.name}</p>
                    <p className="text-xs text-muted-foreground font-mono truncate">{k.key}</p>
                    {k.lastUsed && <p className="text-xs text-muted-foreground mt-0.5">Último uso: {new Date(k.lastUsed).toLocaleDateString("es-MX")}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDeleteKey(k.id)}
                    className="hover:text-destructive"
                    aria-label={`Eliminar key ${k.name}`}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="overflow-x-auto rounded-lg border border-border bg-secondary p-3 font-mono text-xs text-foreground">
            <p className="font-semibold text-primary">POST /api/v1/metrics</p>
            <p className="mt-1 text-muted-foreground">Authorization: Bearer mp_abc...xyz</p>
            <p className="mt-1 text-muted-foreground">Content-Type: application/json</p>
            <p className="mt-2">{"{"}</p>
            <p className="pl-4">&quot;category&quot;: &quot;FINANCE&quot;,</p>
            <p className="pl-4">&quot;name&quot;: &quot;Ingresos&quot;,</p>
            <p className="pl-4">&quot;value&quot;: 150000,</p>
            <p className="pl-4">&quot;unit&quot;: &quot;MXN&quot;</p>
            <p>{"}"}</p>
          </div>
        </SettingsSection>
      )}

      {/* ── Datos ── */}
      <SettingsSection id="datos" icon={Download} title="Datos">
        <div className="flex flex-col sm:flex-row gap-3">
          <Button variant="outline" onClick={handleExportCSV} loading={exportingCSV}>
            {!exportingCSV && <Download />}
            {exportingCSV ? "Exportando..." : "Exportar datos como CSV"}
          </Button>
          <Button
            variant="outline"
            onClick={handleClearData}
            loading={clearingData}
            className="border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            {!clearingData && <Trash2 />}
            {clearingData ? "Eliminando..." : "Limpiar datos de métricas"}
          </Button>
        </div>
      </SettingsSection>

      {/* ── Zona de peligro ── */}
      <SettingsSection
        id="peligro"
        icon={AlertTriangle}
        title="Zona de peligro"
        danger
        className="border-2"
        description="Eliminar tu cuenta borrará permanentemente tu organización y todos sus datos: métricas, reportes, integraciones y metas. También se eliminarán las cuentas de los miembros de tu equipo que solo pertenezcan a esta organización. Esta acción no se puede deshacer."
      >
        <Field label="Escribe ELIMINAR para confirmar">
          <Input
            type="text"
            autoComplete="off"
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value)}
            placeholder="ELIMINAR"
            className="border-destructive/30"
          />
        </Field>
        <Button variant="destructive" onClick={handleDeleteAccount} loading={deleting} disabled={deleteConfirm !== "ELIMINAR"}>
          {!deleting && <Trash2 />}
          Eliminar mi cuenta
        </Button>
      </SettingsSection>
    </div>
  );
}
