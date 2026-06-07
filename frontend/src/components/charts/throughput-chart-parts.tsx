"use client";

import { useMemo } from "react";
import { YAxis } from "recharts";
import type { ThroughputScale } from "@/lib/chart-throughput";
import {
  formatThroughputAxisTick,
  formatThroughputValue,
  maxThroughputKb,
  pickThroughputScale,
  throughputAxisMax,
} from "@/lib/chart-throughput";

export function useThroughputScale(data: Array<{ read?: number; write?: number }>): ThroughputScale {
  const maxKb = maxThroughputKb(data);
  return useMemo(() => pickThroughputScale(maxKb), [maxKb]);
}

export function throughputYAxisWidth(scale: ThroughputScale): number {
  if (scale.unit === "GB/s") return 44;
  if (scale.unit === "MB/s") return 52;
  return 58;
}

export function ThroughputYAxis({
  scale,
  colors,
  fontSize = 10,
}: {
  scale: ThroughputScale;
  colors: { text: string };
  fontSize?: number;
}) {
  const yMax = throughputAxisMax(scale.maxKb);
  const yTicks = throughputYTicks(scale.maxKb);
  const axisStroke = { stroke: colors.text, strokeOpacity: 0.45 };
  const width = throughputYAxisWidth(scale);

  return (
    <YAxis
      domain={[0, yMax]}
      ticks={yTicks}
      width={width}
      tickMargin={6}
      axisLine={axisStroke}
      tickLine={axisStroke}
      tick={{ fontSize, fill: colors.text }}
      tickFormatter={(value) => formatThroughputAxisTick(Number(value), scale)}
      label={{
        value: scale.unit,
        angle: -90,
        position: "insideLeft",
        offset: 12,
        style: { fontSize: 9, fill: colors.text, textAnchor: "middle" },
      }}
    />
  );
}

export function ThroughputTooltipContent({
  active,
  payload,
  label,
  colors,
  scale,
  nameMap,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[];
  label?: string;
  colors: { tooltipBg: string; tooltipBorder: string };
  scale: ThroughputScale;
  nameMap?: Record<string, string>;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-md border px-3 py-2 text-xs shadow-sm"
      style={{
        backgroundColor: colors.tooltipBg,
        borderColor: colors.tooltipBorder,
      }}
    >
      <p className="mb-1.5 font-medium text-foreground">{label}</p>
      {payload.map((entry) => {
        const key = entry.dataKey ?? entry.name ?? "";
        const displayName = nameMap?.[key] ?? entry.name ?? key;
        return (
          <p key={key} className="font-mono text-muted-foreground" style={{ color: entry.color }}>
            {displayName}: {formatThroughputValue(entry.value ?? 0, scale)}
          </p>
        );
      })}
    </div>
  );
}
