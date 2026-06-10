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

export function maxVolumeBytes(data: Array<Record<string, unknown>>): number {
  let max = 0;
  for (const row of data) {
    for (const [key, value] of Object.entries(row)) {
      if (key === "recorded_at" || typeof value !== "number") continue;
      max = Math.max(max, value);
    }
  }
  return max;
}

export type ShareVolumeTimeseriesPoint = {
  recorded_at: string;
  share_id: number;
  bytes_read_volume: number;
  bytes_write_volume: number;
  sample_count: number;
};

export type VolumeChartSeries = {
  dataKey: string;
  name: string;
  color: string;
  dashed?: boolean;
};

export function buildShareVolumeChart(
  points: ShareVolumeTimeseriesPoint[],
  shareLabel: (shareId: number) => string,
  shareColor: (index: number) => string
): { data: Array<Record<string, string | number>>; series: VolumeChartSeries[] } {
  const shareIds = [...new Set(points.map((p) => p.share_id))].sort((a, b) => a - b);
  const buckets = new Map<string, Record<string, string | number>>();

  for (const point of points) {
    if (point.sample_count <= 0) continue;
    const bucketKey = point.recorded_at;
    if (!buckets.has(bucketKey)) {
      buckets.set(bucketKey, { recorded_at: bucketKey });
    }
    const row = buckets.get(bucketKey)!;
    row[`share_${point.share_id}_read`] = point.bytes_read_volume;
    row[`share_${point.share_id}_write`] = point.bytes_write_volume;
  }

  const data = [...buckets.values()].sort((a, b) =>
    String(a.recorded_at).localeCompare(String(b.recorded_at))
  );

  const series = shareIds.flatMap((shareId, index) => {
    const label = shareLabel(shareId);
    const color = shareColor(index);
    return [
      {
        dataKey: `share_${shareId}_read`,
        name: `${label} read`,
        color,
        dashed: false,
      },
      {
        dataKey: `share_${shareId}_write`,
        name: `${label} write`,
        color,
        dashed: true,
      },
    ];
  });

  return { data, series };
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
