"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Small "install app" button for the header. Appears only when the browser
 * supports installing the PWA (Android/Chrome/desktop) and the app isn't
 * already installed. Shows the app's own icon when installed.
 */
export function InstallButton({ withLabel = false }: { withLabel?: boolean }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Already running as an installed app → nothing to offer.
    const installed =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (installed) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", () => setDeferred(null));
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!deferred) return null;

  const install = async () => {
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <button
      onClick={install}
      aria-label="Instalar aplicación"
      title="Instalar aplicación"
      className="flex items-center gap-1.5 rounded-lg border border-border bg-card/50 px-2 py-2 text-muted-foreground transition-colors hover:text-foreground"
    >
      <Download className="h-4 w-4" />
      {withLabel && <span className="text-sm">Instalar app</span>}
    </button>
  );
}
