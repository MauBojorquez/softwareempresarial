"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

const ConfirmContext = createContext<(opts: ConfirmOptions) => Promise<boolean>>(async () => false);

/** `const confirm = useConfirm(); if (!(await confirm({...}))) return;` — replaces window.confirm(). */
export const useConfirm = () => useContext(ConfirmContext);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(v: boolean) => void>();

  const confirm = useCallback((o: ConfirmOptions) => {
    setOpts(o);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (value: boolean) => {
    resolver.current?.(value);
    resolver.current = undefined;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!opts} onOpenChange={(o) => !o && close(false)}>
        {opts && (
          <DialogContent
            size="sm"
            title={opts.title}
            description={opts.description}
            footer={
              <>
                <Button variant="outline" onClick={() => close(false)} autoFocus>
                  {opts.cancelLabel ?? "Cancelar"}
                </Button>
                <Button variant={opts.destructive ? "destructive" : "default"} onClick={() => close(true)}>
                  {opts.confirmLabel ?? "Confirmar"}
                </Button>
              </>
            }
          />
        )}
      </Dialog>
    </ConfirmContext.Provider>
  );
}
