"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { Info } from "@phosphor-icons/react";
import { Label } from "@/components/ui/label";
import type { ShareFieldInfo } from "@/lib/share-form";
import { cn } from "@/lib/utils";

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  helper?: string;
  info?: ShareFieldInfo;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
};

function FieldInfo({ info }: { info: ShareFieldInfo }) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({ visibility: "hidden" });
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLSpanElement>(null);
  const visible = open;

  useLayoutEffect(() => {
    if (!visible || !btnRef.current || !tipRef.current) return;
    const btn = btnRef.current.getBoundingClientRect();
    const tip = tipRef.current.getBoundingClientRect();
    const margin = 8;
    let left = btn.right + margin;
    let top = btn.top;
    if (left + tip.width > window.innerWidth - margin) {
      left = btn.left - tip.width - margin;
    }
    if (left < margin) left = margin;
    if (top + tip.height > window.innerHeight - margin) {
      top = window.innerHeight - tip.height - margin;
    }
    if (top < margin) top = margin;
    setStyle({ position: "fixed", left, top, visibility: "visible" });
  }, [visible, info]);

  return (
    <span className="group/info relative inline-flex">
      <button
        ref={btnRef}
        type="button"
        className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Field help"
        onClick={() => setOpen((v) => !v)}
        onBlur={(e) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node | null)) {
            setOpen(false);
          }
        }}
      >
        <Info className="h-3.5 w-3.5" weight="bold" />
      </button>
      <span
        ref={tipRef}
        role="tooltip"
        style={style}
        className={cn(
          "pointer-events-none z-[100] w-80 max-w-[min(20rem,calc(100vw-1rem))] rounded-md border bg-popover px-3 py-2 text-xs font-normal leading-relaxed text-popover-foreground shadow-md",
          "max-h-64 overflow-y-auto",
          !visible && "hidden"
        )}
      >
        <span className="block">{info.description}</span>
        {info.options && info.options.length > 0 && (
          <span className="mt-2 block">
            <span className="mb-1 block font-semibold">Options</span>
            <ul className="list-none space-y-1.5">
              {info.options.map((option) => (
                <li key={option.label}>
                  <span className="font-medium">{option.label}</span>
                  <span> — {option.description}</span>
                </li>
              ))}
            </ul>
          </span>
        )}
      </span>
    </span>
  );
}

export function FormField({
  label,
  htmlFor,
  helper,
  info,
  error,
  required = false,
  children,
  className,
}: FormFieldProps) {
  const hasError = !!error;
  const message = hasError ? error : helper;

  return (
    <div className={cn("form-field", className)}>
      <div className="flex items-center gap-1.5">
        <Label htmlFor={htmlFor} className="form-field__label">
          {label}
          {required && (
            <span className="text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </Label>
        {info && <FieldInfo info={info} />}
      </div>
      <div data-invalid={hasError || undefined} className="form-field__control">
        {children}
      </div>
      {message && (
        <div className="form-field__message" aria-live="polite">
          <p className={cn("form-field__message-text", hasError && "text-destructive")}>{message}</p>
        </div>
      )}
    </div>
  );
}
