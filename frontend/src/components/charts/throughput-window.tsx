"use client";

import { Check, Gear } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const THROUGHPUT_WINDOWS = [
  { label: "30 seconds", shortLabel: "30s", seconds: 30 },
  { label: "1 minute", shortLabel: "1m", seconds: 60 },
  { label: "2 minutes", shortLabel: "2m", seconds: 120 },
  { label: "5 minutes", shortLabel: "5m", seconds: 300 },
  { label: "10 minutes", shortLabel: "10m", seconds: 600 },
] as const;

export const DEFAULT_THROUGHPUT_WINDOW_SECONDS = 60;

export const MAX_THROUGHPUT_WINDOW_SECONDS = 600;

export function maxHistoryPoints(windowSeconds: number, pollMs: number): number {
  return Math.max(1, Math.ceil(windowSeconds / (pollMs / 1000)));
}

function getWindowLabel(seconds: number): string {
  return THROUGHPUT_WINDOWS.find((window) => window.seconds === seconds)?.shortLabel ?? "1m";
}

type ThroughputWindowMenuProps = {
  value: number;
  onChange: (seconds: number) => void;
};

export function ThroughputWindowMenu({ value, onChange }: ThroughputWindowMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          aria-label={`Chart time range: ${getWindowLabel(value)}. Open options.`}
        >
          <Gear className="h-4 w-4" weight="regular" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Time range
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THROUGHPUT_WINDOWS.map((window) => (
          <DropdownMenuItem
            key={window.seconds}
            onSelect={() => onChange(window.seconds)}
            className={cn(value === window.seconds && "bg-muted")}
          >
            <span>{window.label}</span>
            {value === window.seconds && (
              <Check className="ml-auto h-4 w-4 text-primary" weight="bold" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** @deprecated Use ThroughputWindowMenu */
export const ThroughputWindowSelector = ThroughputWindowMenu;
