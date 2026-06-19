"use client";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { useTheme } from "@/components/theme-provider";
import { useToast } from "@/components/toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  Sun, Moon, Monitor, Bell, User, Building2, Download, Trash2,
  AlertTriangle, Key, Plus, Copy, Eye, EyeOff, Loader2, Save, Lock, Users, Mail, X,
  Palette, Camera, ImagePlus, BellRing, MessageCircle, Phone,
} from "lucide-react";
import { PhoneInput } from "@/components/settings/phone-input";

const NOTIF_STORAGE_KEY = "metrixpro-notifications-prefs";

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
    >
      <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${enabled ? "translate-x-5" : "translate-x-0"}`} />
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

const CONDITION_LABELS: Record<string, string> = {
  below: "Cae por debajo de",
  above: "Sube por encima de",
  change_pct_down: "Baja más de (%) vs mes anterior",
  change_pct_up: "Sube más de (%) vs mes anterior",
};

const CATEGORY_OPTIONS = ["FINANCE", "SALES", "OPERATIONS", "HR", "MARKETING"] as const;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SettingsPage() {
  const { data: session, update: updateSession } = useSession();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();

  const [profile, setProfile] = useState({ name: "", email: "" });
  const [org, setOrg] = useState({ name: "", industry: "" });
  const [avatar, setAvatar] = useState<string | null>(null);
  const [orgLogo, setOrgLogo] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState("#6366f1");
  const [savingBranding, setSavingBranding] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [passwords, setPasswords] = useState({ current: "", new: "", confirm: "" });
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [loading, setLoading] = useState(true);

  const [notifications, setNotifications] = useState({ metrics: false, reports: false, goals: false });

  const [contact, setContact] = useState({ phone: "", notifyEmail: true, notifyWhatsapp: false });
  const [savingContact, setSavingContact] = useState(false);

  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [creatingKey, setCreatingKey] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmDeleteKeyId, setConfirmDeleteKeyId] = useState<string | null>(null);
  const [confirmClearData, setConfirmClearData] = useState(false);

  type Invitation = { id: string; email: string; role: string; expiresAt: string; invitedBy: { name: string | null; email: string } };
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"VIEWER" | "EDITOR" | "ADMIN">("VIEWER");
  const [inviteSections, setInviteSections] = useState<string[]>([]);
  const [inviting, setInviting] = useState(false);

  const [alertRules, setAlertRules] = useState<AlertRuleItem[]>([]);
  const [newAlert, setNewAlert] = useState({
    metricName: "",
    category: "FINANCE" as (typeof CATEGORY_OPTIONS)[number],
    condition: "below" as string,
    threshold: "",
  });
  const [savingAlert, setSavingAlert] = useState(false);

  useEffect(() => {
    fetch("/api/user")
      .then((r) => { if (!r.ok) throw new Error("fetch failed"); return r.json(); })
      .then((data) => {
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
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch("/api/user/api-keys")
      .then((r) => { if (!r.ok) throw new Error("fetch failed"); return r.json(); })
      .then((data) => setApiKeys(Array.isArray(data.keys) ? data.keys : []))
      .catch(() => {});

    try {
      const saved = localStorage.getItem(NOTIF_STORAGE_KEY);
      if (saved) setNotifications(JSON.parse(saved));
    } catch {}

    fetch("/api/invitations")
      .then((r) => r.json())
      .then((d) => setInvitations(Array.isArray(d.invitations) ? d.invitations : []))
      .catch(() => {});

    fetch("/api/alerts")
      .then((r) => r.json())
      .then((d) => setAlertRules(Array.isArray(d.rules) ? d.rules : []))
      .catch(() => {});
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
      await fetch("/api/user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: newTheme }),
      });
    } catch {}
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

  const handleNotificationToggle = async (key: keyof typeof notifications, value: boolean) => {
    if (value && typeof Notification !== "undefined" && Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
    }
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(updated));
  };

  const handleCreateKey = async () => {
    setCreatingKey(true);
    try {
      const res = await fetch("/api/user/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName || "API Key" }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewKeyValue(data.key);
        setNewKeyName("");
        const keysRes = await fetch("/api/user/api-keys");
        const keysData = await keysRes.json();
        setApiKeys(keysData.keys || []);
        toast("API Key creada", "success");
      }
    } catch {
      toast("Error al crear API Key", "error");
    }
    setCreatingKey(false);
  };

  const handleDeleteKey = async (id: string) => {
    await fetch("/api/user/api-keys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setApiKeys((prev) => prev.filter((k) => k.id !== id));
    setConfirmDeleteKeyId(null);
    toast("API Key eliminada", "success");
  };

  const handleExportCSV = async () => {
    try {
      const res = await fetch("/api/metrics/export?format=csv");
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `metrixpro-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Datos exportados", "success");
    } catch {
      toast("No se pudo exportar", "error");
    }
  };

  const handleClearData = async () => {
    const res = await fetch("/api/metrics", { method: "DELETE" });
    if (res.ok) toast("Datos eliminados", "success");
    else toast("Error al eliminar", "error");
    setConfirmClearData(false);
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
    await fetch(`/api/alerts?id=${id}`, { method: "DELETE" });
    setAlertRules((prev) => prev.filter((r) => r.id !== id));
    toast("Alerta eliminada", "success");
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole, allowedSections: inviteSections }),
      });
      const data = await res.json();
      if (res.ok) {
        toast("Invitación enviada a " + inviteEmail, "success");
        setInviteEmail("");
        const updated = await fetch("/api/invitations").then((r) => r.json());
        setInvitations(Array.isArray(updated.invitations) ? updated.invitations : []);
      } else {
        toast(data.error || "Error al invitar", "error");
      }
    } catch {
      toast("Error de conexión", "error");
    }
    setInviting(false);
  };

  const handleRevokeInvite = async (id: string) => {
    await fetch(`/api/invitations?id=${id}`, { method: "DELETE" });
    setInvitations((prev) => prev.filter((inv) => inv.id !== id));
    toast("Invitación revocada", "success");
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
        const data = await res.json();
        toast(data.error || "Error al eliminar", "error");
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

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold text-foreground">Configuración</h1>

      {/* ── Perfil ── */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Perfil</h2>
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative">
            {avatar ? (
              <img src={avatar} alt="Foto de perfil" className="h-16 w-16 rounded-full object-cover border-2 border-border" />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center border-2 border-border">
                <span className="text-xl font-bold text-primary">
                  {profile.name?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase() || session?.user?.email?.[0]?.toUpperCase() || "U"}
                </span>
              </div>
            )}
            <button
              onClick={() => avatarInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full gradient-bg flex items-center justify-center shadow"
              aria-label="Cambiar foto de perfil"
            >
              <Camera className="h-3 w-3 text-white" />
            </button>
          </div>
          <div>
            <p className="text-sm font-medium">Foto de perfil</p>
            <p className="text-xs text-muted-foreground">JPG, PNG o GIF · máx 2 MB</p>
            <div className="flex gap-2 mt-1">
              <button onClick={() => avatarInputRef.current?.click()} className="text-xs text-primary hover:underline">Cambiar</button>
              {avatar && <button onClick={() => setAvatar(null)} className="text-xs text-muted-foreground hover:underline">Quitar</button>}
            </div>
          </div>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="settings-name" className="text-xs text-muted-foreground">Nombre</label>
            <input
              id="settings-name"
              type="text"
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Correo electrónico</label>
            <p className="mt-1 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm text-muted-foreground">{profile.email}</p>
          </div>
        </div>
        <div className="flex items-start gap-2 pt-1">
          <Building2 className="h-4 w-4 text-muted-foreground mt-6" />
          <div className="flex-1 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="settings-org" className="text-xs text-muted-foreground">Empresa</label>
              <input
                id="settings-org"
                type="text"
                value={org.name}
                onChange={(e) => setOrg({ ...org, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <div>
              <label htmlFor="settings-industry" className="text-xs text-muted-foreground">Industria</label>
              <input
                id="settings-industry"
                type="text"
                value={org.industry}
                onChange={(e) => setOrg({ ...org, industry: e.target.value })}
                placeholder="Ej: Tecnología, Retail..."
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>
        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {saving ? "Guardando..." : "Guardar Cambios"}
        </button>
      </div>

      {/* ── Identidad Visual ── */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Palette className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Identidad Visual</h2>
        </div>
        <p className="text-xs text-muted-foreground">Tu logo y color de marca aparecerán en el sidebar y personalizarán la app para tu empresa.</p>

        {/* Logo */}
        <div className="flex items-center gap-4">
          <div
            className="h-16 w-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => logoInputRef.current?.click()}
          >
            {orgLogo ? (
              <img src={orgLogo} alt="Logo empresa" className="h-full w-full object-contain p-1" />
            ) : (
              <ImagePlus className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium">Logo de empresa</p>
            <p className="text-xs text-muted-foreground">PNG con fondo transparente recomendado · máx 2 MB</p>
            <div className="flex gap-2 mt-1">
              <button onClick={() => logoInputRef.current?.click()} className="text-xs text-primary hover:underline">
                {orgLogo ? "Cambiar" : "Subir logo"}
              </button>
              {orgLogo && <button onClick={() => setOrgLogo(null)} className="text-xs text-muted-foreground hover:underline">Quitar</button>}
            </div>
          </div>
          <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
        </div>

        {/* Brand color */}
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 rounded-xl border-2 border-border overflow-hidden cursor-pointer">
            <div className="h-full w-full" style={{ backgroundColor: brandColor }} />
            <input
              type="color"
              value={brandColor}
              onChange={(e) => setBrandColor(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              aria-label="Color de marca"
            />
          </div>
          <div>
            <p className="text-sm font-medium">Color de marca</p>
            <p className="text-xs text-muted-foreground">Se aplica en acentos del sidebar y header</p>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="text"
                value={brandColor}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setBrandColor(v);
                }}
                className="w-28 rounded-lg border border-border bg-background px-2 py-1 text-xs font-mono focus:border-primary/50 focus:outline-none"
                placeholder="#6366f1"
              />
              <div className="h-5 w-5 rounded-full border border-border" style={{ backgroundColor: brandColor }} />
            </div>
          </div>
        </div>

        <button
          onClick={handleSaveBranding}
          disabled={savingBranding}
          className="flex items-center gap-2 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {savingBranding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {savingBranding ? "Guardando..." : "Guardar Identidad Visual"}
        </button>
      </div>

      {/* ── Contraseña ── */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Lock className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Contraseña</h2>
        </div>
        <div className="grid gap-3">
          <div>
            <label htmlFor="current-pw" className="text-xs text-muted-foreground">Contraseña actual</label>
            <div className="relative mt-1">
              <input
                id="current-pw"
                type={showPasswords ? "text" : "password"}
                value={passwords.current}
                onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <button onClick={() => setShowPasswords(!showPasswords)} className="absolute right-2.5 top-2 text-muted-foreground hover:text-foreground" aria-label={showPasswords ? "Ocultar" : "Mostrar"}>
                {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="new-pw" className="text-xs text-muted-foreground">Nueva contraseña</label>
              <input id="new-pw" type={showPasswords ? "text" : "password"} value={passwords.new} onChange={(e) => setPasswords({ ...passwords, new: e.target.value })} placeholder="Mínimo 8 caracteres" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30" />
            </div>
            <div>
              <label htmlFor="confirm-pw" className="text-xs text-muted-foreground">Confirmar</label>
              <input id="confirm-pw" type={showPasswords ? "text" : "password"} value={passwords.confirm} onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30" />
            </div>
          </div>
        </div>
        <button
          onClick={handleChangePassword}
          disabled={savingPassword || !passwords.current || !passwords.new}
          className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50"
        >
          {savingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
          Cambiar Contraseña
        </button>
      </div>

      {/* ── Tema ── */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Tema</h2>
        <div className="grid grid-cols-3 gap-3">
          {themeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleThemeChange(opt.value)}
              className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-all ${theme === opt.value ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground"}`}
            >
              <opt.icon className="h-5 w-5" />
              <span className="text-sm font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">El tema se sincroniza con tu cuenta en todos los dispositivos.</p>
      </div>

      {/* ── Notificaciones ── */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Notificaciones</h2>
        </div>
        <div className="space-y-4">
          {[
            { key: "metrics" as const, title: "Actualización de métricas", desc: "Alertas cuando tus métricas cambien significativamente" },
            { key: "reports" as const, title: "Reporte listo", desc: "Notificación cuando un reporte IA esté generado" },
            { key: "goals" as const, title: "Meta alcanzada", desc: "Aviso cuando se cumpla un objetivo configurado" },
          ].map((item) => (
            <div key={item.key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <Toggle enabled={notifications[item.key]} onChange={(v) => handleNotificationToggle(item.key, v)} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Cómo recibir reportes ── */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <MessageCircle className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Cómo recibir reportes</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Elige cómo quieres recibir tus resúmenes, alertas y avisos. Puedes activar correo, WhatsApp o ambos.
        </p>

        {/* Teléfono */}
        <div>
          <label className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Phone className="h-3 w-3" /> Número de WhatsApp
          </label>
          <div className="mt-1">
            <PhoneInput value={contact.phone} onChange={(phone) => setContact((c) => ({ ...c, phone }))} />
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Selecciona tu país (lada) y escribe tu número. Ej: 🇲🇽 +52 442 123 4567
          </p>
        </div>

        {/* Canales */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Por correo</p>
                <p className="text-xs text-muted-foreground">{profile.email}</p>
              </div>
            </div>
            <Toggle enabled={contact.notifyEmail} onChange={(v) => setContact((c) => ({ ...c, notifyEmail: v }))} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-foreground">Por WhatsApp</p>
                <p className="text-xs text-muted-foreground">
                  {contact.phone ? "Al número de arriba" : "Agrega tu número primero"}
                </p>
              </div>
            </div>
            <Toggle enabled={contact.notifyWhatsapp} onChange={(v) => setContact((c) => ({ ...c, notifyWhatsapp: v }))} />
          </div>
        </div>

        <button
          onClick={handleSaveContact}
          disabled={savingContact}
          className="flex items-center gap-2 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {savingContact ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          {savingContact ? "Guardando..." : "Guardar preferencias"}
        </button>
      </div>

      {/* ── Alertas ── */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <BellRing className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Alertas por Correo</h2>
        </div>
        <p className="text-xs text-muted-foreground">Define reglas para recibir un correo cuando una métrica supere un umbral específico.</p>

        {alertRules.length > 0 && (
          <div className="divide-y divide-border rounded-lg border border-border">
            {alertRules.map((rule) => (
              <div key={rule.id} className="flex items-center justify-between px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{rule.metricName}</p>
                  <p className="text-xs text-muted-foreground">
                    {CONDITION_LABELS[rule.condition] ?? rule.condition} {rule.threshold} · {rule.category}
                  </p>
                  {rule.lastTriggered && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Última activación: {new Date(rule.lastTriggered).toLocaleDateString("es-MX")}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteAlert(rule.id)}
                  className="text-muted-foreground hover:text-red-500 transition-colors"
                  aria-label="Eliminar alerta"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3 pt-1">
          <p className="text-xs font-medium text-muted-foreground">Nueva alerta</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-xs text-muted-foreground">Nombre de la métrica</label>
              <input
                type="text"
                value={newAlert.metricName}
                onChange={(e) => setNewAlert({ ...newAlert, metricName: e.target.value })}
                placeholder="Ej: Ventas del Mes"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Categoría</label>
              <select
                value={newAlert.category}
                onChange={(e) => setNewAlert({ ...newAlert, category: e.target.value as (typeof CATEGORY_OPTIONS)[number] })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Condición</label>
              <select
                value={newAlert.condition}
                onChange={(e) => setNewAlert({ ...newAlert, condition: e.target.value })}
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none"
              >
                {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Umbral</label>
              <input
                type="number"
                min="0"
                step="any"
                value={newAlert.threshold}
                onChange={(e) => setNewAlert({ ...newAlert, threshold: e.target.value })}
                placeholder="Ej: 20 o 500000"
                className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </div>
          <button
            onClick={handleCreateAlert}
            disabled={savingAlert}
            className="flex items-center gap-1.5 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {savingAlert ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Crear Alerta
          </button>
        </div>
      </div>

      {/* ── Invitar Usuarios ── */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Invitar Usuarios</h2>
        </div>
        <p className="text-xs text-muted-foreground">Invita a miembros de tu equipo. Recibirán un correo con el enlace de acceso. <span className="text-amber-500">El correo puede llegar a spam — pídeles que lo revisen.</span></p>
        <div className="flex flex-col sm:flex-row gap-2">
          <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="correo@empresa.com" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30" />
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "VIEWER" | "EDITOR" | "ADMIN")} className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none">
            <option value="VIEWER">Viewer</option>
            <option value="EDITOR">Editor</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button onClick={handleInvite} disabled={inviting || !inviteEmail} className="flex items-center gap-1.5 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
            {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
            Invitar
          </button>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Acceso a secciones <span className="font-normal">(deja vacío para acceso completo)</span></p>
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
                onClick={() => setInviteSections((prev) => prev.includes(s.key) ? prev.filter((x) => x !== s.key) : [...prev, s.key])}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${inviteSections.includes(s.key) ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:border-primary/50"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        {invitations.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Invitaciones pendientes</p>
            <div className="divide-y divide-border rounded-lg border border-border">
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">{inv.role} · Expira {new Date(inv.expiresAt).toLocaleDateString("es-MX")}</p>
                  </div>
                  <button onClick={() => handleRevokeInvite(inv.id)} className="text-muted-foreground hover:text-red-500" aria-label="Revocar invitación">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── API Keys ── */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Key className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">API Keys</h2>
        </div>
        <p className="text-xs text-muted-foreground">Crea API Keys para enviar métricas desde sistemas externos vía REST API.</p>
        {newKeyValue && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 p-3 space-y-2">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Copia tu API Key — no se mostrará de nuevo:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded bg-white dark:bg-background px-3 py-1.5 text-xs font-mono border border-border break-all">{newKeyValue}</code>
              <button onClick={() => { navigator.clipboard.writeText(newKeyValue); toast("Copiado", "success"); }} className="rounded-lg border border-border p-2 hover:bg-secondary" aria-label="Copiar API Key">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
            <button onClick={() => setNewKeyValue(null)} className="text-xs text-emerald-600 hover:underline">Cerrar</button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <input type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Nombre de la key (ej: Mi CRM)" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30" />
          <button onClick={handleCreateKey} disabled={creatingKey} className="flex items-center gap-1.5 rounded-lg gradient-bg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
            {creatingKey ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Crear
          </button>
        </div>
        {apiKeys.length > 0 && (
          <div className="divide-y divide-border rounded-lg border border-border">
            {apiKeys.map((k) => (
              <div key={k.id} className="flex items-center justify-between p-3">
                <div>
                  <p className="text-sm font-medium">{k.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{k.key}</p>
                  {k.lastUsed && <p className="text-[10px] text-muted-foreground mt-0.5">Último uso: {new Date(k.lastUsed).toLocaleDateString("es-MX")}</p>}
                </div>
                <button onClick={() => setConfirmDeleteKeyId(k.id)} className="text-muted-foreground hover:text-red-500" aria-label="Eliminar key">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="rounded-lg border border-border bg-slate-900 p-3 font-mono text-xs text-slate-300">
          <p className="text-blue-400">POST /api/v1/metrics</p>
          <p className="mt-1 text-slate-400">Authorization: Bearer mp_abc...xyz</p>
          <p className="mt-1 text-slate-400">Content-Type: application/json</p>
          <p className="mt-2 text-emerald-400">{"{"}</p>
          <p className="text-emerald-400 pl-4">&quot;category&quot;: &quot;FINANCE&quot;,</p>
          <p className="text-emerald-400 pl-4">&quot;name&quot;: &quot;Ingresos&quot;,</p>
          <p className="text-emerald-400 pl-4">&quot;value&quot;: 150000,</p>
          <p className="text-emerald-400 pl-4">&quot;unit&quot;: &quot;MXN&quot;</p>
          <p className="text-emerald-400">{"}"}</p>
        </div>
      </div>

      {/* ── Datos ── */}
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Download className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Datos</h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={handleExportCSV} className="flex items-center justify-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
            <Download className="h-4 w-4" />
            Exportar datos como CSV
          </button>
          <button onClick={() => setConfirmClearData(true)} className="flex items-center justify-center gap-2 rounded-lg border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="h-4 w-4" />
            Limpiar datos de métricas
          </button>
        </div>
      </div>

      {/* ── Zona de peligro ── */}
      <div className="rounded-xl border-2 border-destructive/50 bg-card p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h2 className="text-lg font-semibold text-destructive">Zona de peligro</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Eliminar tu cuenta borrará permanentemente todos tus datos, métricas, reportes e integraciones. Esta acción no se puede deshacer.
        </p>
        <div className="space-y-3">
          <div>
            <label htmlFor="delete-confirm" className="text-xs font-medium text-destructive">Escribe ELIMINAR para confirmar</label>
            <input id="delete-confirm" type="text" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="ELIMINAR" className="mt-1 w-full rounded-lg border border-destructive/30 bg-background px-3 py-2 text-sm focus:border-destructive focus:outline-none focus:ring-1 focus:ring-destructive/30" />
          </div>
          <button
            onClick={handleDeleteAccount}
            disabled={deleteConfirm !== "ELIMINAR" || deleting}
            className="flex items-center gap-2 rounded-lg border border-destructive bg-destructive/10 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Eliminar mi cuenta
          </button>
        </div>
      </div>
      <ConfirmDialog
        open={confirmDeleteKeyId !== null}
        title="Eliminar API Key"
        description="¿Eliminar esta API Key? Cualquier integración que la use dejará de funcionar."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => confirmDeleteKeyId && handleDeleteKey(confirmDeleteKeyId)}
        onCancel={() => setConfirmDeleteKeyId(null)}
      />
      <ConfirmDialog
        open={confirmClearData}
        title="Eliminar todos los datos"
        description="¿Eliminar todos los datos de métricas? Esta acción no se puede deshacer y perderás toda tu información."
        confirmLabel="Eliminar todo"
        destructive
        onConfirm={handleClearData}
        onCancel={() => setConfirmClearData(false)}
      />
    </div>
  );
}
