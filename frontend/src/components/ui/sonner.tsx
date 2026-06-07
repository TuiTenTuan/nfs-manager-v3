"use client";

import type { CSSProperties } from "react";
import { Toaster as Sonner } from "sonner";

import { useTheme } from "@/lib/theme";

const toasterStyle = {
  "--width": "28rem",
} as CSSProperties;

export function Toaster() {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      style={toasterStyle}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:w-[var(--width)] group-[.toaster]:max-w-[min(28rem,calc(100vw-2rem))]",
          title:
            "group-[.toast]:whitespace-pre-wrap group-[.toast]:break-words group-[.toast]:leading-snug",
          description:
            "group-[.toast]:text-muted-foreground group-[.toast]:whitespace-pre-wrap group-[.toast]:break-words group-[.toast]:leading-snug group-[.toast]:max-h-40 group-[.toast]:overflow-y-auto group-[.toast]:scrollbar-themed",
          actionButton:
            "group-[.toast]:!h-7 group-[.toast]:!w-7 group-[.toast]:!min-w-0 group-[.toast]:!p-0 group-[.toast]:inline-flex group-[.toast]:items-center group-[.toast]:justify-center group-[.toast]:shrink-0 group-[.toast]:rounded-md group-[.toast]:border group-[.toast]:transition-colors group-[.toast]:border-border/50 group-[.toast]:bg-card/60 group-[.toast]:text-foreground/75 hover:group-[.toast]:bg-muted/80 hover:group-[.toast]:text-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success:
            "group-[.toaster]:!border-emerald-500/40 group-[.toaster]:!bg-emerald-50 group-[.toaster]:!text-emerald-950 dark:group-[.toaster]:!bg-emerald-950/80 dark:group-[.toaster]:!text-emerald-50 [&_[data-description]]:!text-emerald-800/80 dark:[&_[data-description]]:!text-emerald-200/80 [&_[data-action]]:!border-emerald-600/30 [&_[data-action]]:!bg-emerald-100/80 [&_[data-action]]:!text-emerald-800 hover:[&_[data-action]]:!bg-emerald-200/90 dark:[&_[data-action]]:!border-emerald-400/30 dark:[&_[data-action]]:!bg-emerald-900/55 dark:[&_[data-action]]:!text-emerald-100 dark:hover:[&_[data-action]]:!bg-emerald-800/70",
          error:
            "group-[.toaster]:!border-destructive/50 group-[.toaster]:!bg-red-50 group-[.toaster]:!text-red-950 dark:group-[.toaster]:!bg-red-950/80 dark:group-[.toaster]:!text-red-50 [&_[data-description]]:!text-red-800/80 dark:[&_[data-description]]:!text-red-200/80 [&_[data-action]]:!border-red-600/30 [&_[data-action]]:!bg-red-100/80 [&_[data-action]]:!text-red-800 hover:[&_[data-action]]:!bg-red-200/90 dark:[&_[data-action]]:!border-red-400/30 dark:[&_[data-action]]:!bg-red-900/55 dark:[&_[data-action]]:!text-red-100 dark:hover:[&_[data-action]]:!bg-red-800/70",
          info:
            "group-[.toaster]:!border-primary/40 group-[.toaster]:!bg-primary/5 group-[.toaster]:!text-foreground [&_[data-description]]:!text-muted-foreground [&_[data-action]]:!border-primary/30 [&_[data-action]]:!bg-primary/10 [&_[data-action]]:!text-primary hover:[&_[data-action]]:!bg-primary/15 dark:[&_[data-action]]:!border-primary/35 dark:[&_[data-action]]:!bg-primary/15 dark:[&_[data-action]]:!text-primary-foreground dark:hover:[&_[data-action]]:!bg-primary/25",
          warning:
            "group-[.toaster]:!border-amber-500/40 group-[.toaster]:!bg-amber-50 group-[.toaster]:!text-amber-950 dark:group-[.toaster]:!bg-amber-950/80 dark:group-[.toaster]:!text-amber-50 [&_[data-description]]:!text-amber-800/80 dark:[&_[data-description]]:!text-amber-200/80 [&_[data-action]]:!border-amber-600/30 [&_[data-action]]:!bg-amber-100/80 [&_[data-action]]:!text-amber-900 hover:[&_[data-action]]:!bg-amber-200/90 dark:[&_[data-action]]:!border-amber-400/30 dark:[&_[data-action]]:!bg-amber-900/55 dark:[&_[data-action]]:!text-amber-100 dark:hover:[&_[data-action]]:!bg-amber-800/70",
        },
      }}
    />
  );
}
