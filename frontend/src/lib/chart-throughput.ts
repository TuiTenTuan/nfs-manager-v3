import {
  formatDecimal,
  formatInteger,
  formatSpeedParts,
  type SpeedUnit,
} from "@/lib/format";

export type ThroughputUnit = SpeedUnit;

export type ThroughputScale = {
  unit: ThroughputUnit;
  /** Divide stored KB/s values by this for axis display. */
  divisor: number;
  /** Highest read/write value in the current dataset (KB/s). */
  maxKb: number;
};

export function maxThroughputKb(data: Array<{ read?: number; write?: number }>): number {
  let max = 0;
  for (const row of data) {
    max = Math.max(max, row.read ?? 0, row.write ?? 0);
  }
  return max;
}

export function pickThroughputScale(maxKbPerSec: number): ThroughputScale {
  const maxKb = Math.max(maxKbPerSec, 0);
  if (maxKbPerSec >= 1024 * 1024) {
    return { unit: "GB/s", divisor: 1024 * 1024, maxKb };
  }
  if (maxKbPerSec >= 1024) {
    return { unit: "MB/s", divisor: 1024, maxKb };
  }
  return { unit: "KB/s", divisor: 1, maxKb };
}

/** Upper Y-axis bound (KB/s) with a non-zero floor for empty charts. */
export function throughputAxisMax(maxKb: number): number {
  return Math.max(maxKb, 1);
}

/** Y-axis ticks: zero, midpoint, and peak throughput (KB/s). */
export function throughputYTicks(maxKb: number): number[] {
  const peak = throughputAxisMax(maxKb);
  return [0, peak / 2, peak];
}

export function formatThroughputAxisTick(kbPerSec: number, scale: ThroughputScale): string {
  const value = kbPerSec / scale.divisor;
  if (scale.unit === "GB/s") {
    return formatDecimal(value, value >= 10 ? 0 : 1);
  }
  if (scale.unit === "MB/s") {
    return formatDecimal(value, value >= 100 ? 0 : 1);
  }
  return formatInteger(value);
}

export function formatThroughputValue(kbPerSec: number, scale: ThroughputScale): string {
  return `${formatThroughputAxisTick(kbPerSec, scale)} ${scale.unit}`;
}

export function formatThroughputPartsFromBytes(
  bytesPerSec: number,
  fractionDigits?: number
): { value: string; unit: ThroughputUnit } {
  return formatSpeedParts(bytesPerSec, fractionDigits);
}

export type ReportPeriod = "day" | "week" | "month" | "year";

export function formatReportTimeseriesLabel(
  iso: string,
  period: ReportPeriod
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (period === "day") {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  if (period === "week") {
    return d.toLocaleString(undefined, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (period === "month") {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatReportTimeseriesTooltip(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
