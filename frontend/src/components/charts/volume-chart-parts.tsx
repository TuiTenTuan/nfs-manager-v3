"use client";

import { useMemo } from "react";
import { YAxis } from "recharts";
import type { VolumeScale } from "@/lib/chart-volume";
import {
  formatVolumeAxisTick,
  formatVolumeValue,
  maxVolumeBytes,
  pickVolumeScale,
  volumeAxisMax,
  volumeYTicks,
} from "@/lib/chart-volume";

export function useVolumeScale(data: Array<{ read?: number; write?: number }>): VolumeScale {
  const maxBytes = maxVolumeBytes(data);
  return useMemo(() => pickVolumeScale(maxBytes), [maxBytes]);
}

export function volumeYAxisWidth(scale: VolumeScale): number {
  if (scale.unit === "TB" || scale.unit === "GB") return 36;
  if (scale.unit === "MB") return 44;
  if (scale.unit === "KB") return 50;
  return 56;
}

export function volumeChartMargin(_scale: VolumeScale) {
  return { top: 4, right: 8, left: 0, bottom: 0 };
}

export function getVolumeYAxisProps(
  scale: VolumeScale,
  colors: { text: string },
  fontSize = 10
) {
  const yMax = volumeAxisMax(scale.maxBytes);
  const yTicks = volumeYTicks(scale.maxBytes);
  const axisStroke = { stroke: colors.text, strokeOpacity: 0.45 };
  const width = volumeYAxisWidth(scale);

  return {
    domain: [0, yMax] as [number, number],
    ticks: yTicks,
    width,
    orientation: "left" as const,
    tickMargin: 6,
    axisLine: axisStroke,
    tickLine: axisStroke,
    tick: { fontSize, fill: colors.text },
    tickFormatter: (value: number) => formatVolumeAxisTick(Number(value), scale),
    label: {
      value: scale.unit,
      angle: -90,
      position: "insideLeft" as const,
      offset: 6,
      style: { fontSize: 9, fill: colors.text, textAnchor: "middle" as const },
    },
  };
}

export function VolumeYAxis({
  scale,
  colors,
  fontSize = 10,
}: {
  scale: VolumeScale;
  colors: { text: string };
  fontSize?: number;
}) {
  return <YAxis {...getVolumeYAxisProps(scale, colors, fontSize)} />;
}

export function VolumeTooltipContent({
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
  scale: VolumeScale;
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
            {displayName}: {formatVolumeValue(entry.value ?? 0, scale)}
          </p>
        );
      })}
    </div>
  );
}
