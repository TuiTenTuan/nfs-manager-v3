"use client";

import { ThemeProvider } from "@/lib/theme";
import { ConfirmProvider } from "@/lib/confirm";
import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";

export function ClientRoot({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ConfirmProvider>
        <AppShell>{children}</AppShell>
        <Toaster />
      </ConfirmProvider>
    </ThemeProvider>
  );
}
