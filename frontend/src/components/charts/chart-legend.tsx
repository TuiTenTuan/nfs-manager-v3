"use client";

import { Legend, type LegendProps } from "recharts";

export type ChartLegendItem = {
  label: string;
  color: string;
  dashed?: boolean;
  variant?: "line" | "bar";
};

type LegendEntry = {
  value?: string;
  color?: string;
  type?: string;
  strokeDasharray?: string | number[];
  payload?: { strokeDasharray?: string | number[] };
};

function LegendIcon({
  color,
  variant = "line",
  dashed,
}: {
  color: string;
  variant?: "line" | "bar";
  dashed?: boolean;
}) {
  if (variant === "bar") {
    return (
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-[2px]"
        style={{ backgroundColor: color }}
        aria-hidden
      />
    );
  }

  if (dashed) {
    return (
      <span
        className="inline-block w-3 shrink-0 border-t-2 border-dotted"
        style={{ borderColor: color }}
        aria-hidden
      />
    );
  }

  return (
    <span
      className="inline-block h-0.5 w-3 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

export function ChartLegendStrip({ items }: { items: ChartLegendItem[] }) {
  if (!items.length) return null;

  return (
    <ul className="flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 pt-1.5">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center gap-1.5 text-[11px] leading-none text-muted-foreground"
        >
          <LegendIcon color={item.color} variant={item.variant} dashed={item.dashed} />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function throughputLegendItems(
  colors: { read: string; write: string },
  variant: "line" | "bar" = "line"
): ChartLegendItem[] {
  return [
    { label: "Read", color: colors.read, variant },
    { label: "Write", color: colors.write, variant, dashed: variant === "line" },
  ];
}

function ChartLegendContent({ payload }: { payload?: LegendEntry[] }) {
  if (!payload?.length) return null;

  return (
    <ChartLegendStrip
      items={payload.map((entry) => ({
        label: entry.value ?? "",
        color: entry.color ?? "currentColor",
        variant: entry.type === "rect" ? "bar" : "line",
        dashed: Boolean(entry.strokeDasharray ?? entry.payload?.strokeDasharray),
      }))}
    />
  );
}

export function ChartLegend(props?: Partial<LegendProps>) {
  return (
    <Legend
      verticalAlign="bottom"
      align="center"
      iconSize={0}
      wrapperStyle={{ width: "100%", lineHeight: 1, bottom: 0 }}
      content={(legendProps) => (
        <ChartLegendContent payload={legendProps.payload as LegendEntry[] | undefined} />
      )}
      {...props}
    />
  );
}
