import {
  formatDecimal,
  formatInteger,
  formatDataVolumeParts,
  type DataVolumeUnit,
} from "@/lib/format";

export type VolumeScale = {
  unit: DataVolumeUnit;
  divisor: number;
  maxBytes: number;
};

export function maxVolumeBytes(data: Array<{ read?: number; write?: number }>): number {
  let max = 0;
  for (const row of data) {
    max = Math.max(max, row.read ?? 0, row.write ?? 0);
  }
  return max;
}

export function pickVolumeScale(maxBytes: number): VolumeScale {
  const max = Math.max(maxBytes, 0);
  const { unit } = formatDataVolumeParts(max || 1);
  const divisors: Record<DataVolumeUnit, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 ** 2,
    GB: 1024 ** 3,
    TB: 1024 ** 4,
  };
  return { unit, divisor: divisors[unit], maxBytes: max };
}

export function volumeAxisMax(maxBytes: number): number {
  return Math.max(maxBytes, 1);
}

export function volumeYTicks(maxBytes: number): number[] {
  const peak = volumeAxisMax(maxBytes);
  return [0, peak / 2, peak];
}

export function formatVolumeAxisTick(bytes: number, scale: VolumeScale): string {
  const value = bytes / scale.divisor;
  if (scale.unit === "TB" || scale.unit === "GB") {
    return formatDecimal(value, value >= 10 ? 0 : 1);
  }
  if (scale.unit === "MB" || scale.unit === "KB") {
    return formatDecimal(value, value >= 100 ? 0 : 1);
  }
  return formatInteger(value);
}

export function formatVolumeValue(bytes: number, scale: VolumeScale): string {
  return `${formatVolumeAxisTick(bytes, scale)} ${scale.unit}`;
}

export {
  formatReportTimeseriesLabel,
  formatReportTimeseriesTooltip,
  type ReportPeriod,
} from "@/lib/chart-throughput";
