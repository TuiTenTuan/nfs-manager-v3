const integerFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

export function formatInteger(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return integerFormatter.format(Math.round(value));
}

export function formatDecimal(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

/** Alias for display of any numeric count or metric. */
export function formatNumber(value: number, fractionDigits = 0): string {
  if (fractionDigits === 0) return formatInteger(value);
  return formatDecimal(value, fractionDigits);
}

export type SpeedUnit = "KB/s" | "MB/s" | "GB/s";

function pickSpeedUnit(kbPerSec: number): { unit: SpeedUnit; divisor: number } {
  if (kbPerSec >= 1024 * 1024) {
    return { unit: "GB/s", divisor: 1024 * 1024 };
  }
  if (kbPerSec >= 1024) {
    return { unit: "MB/s", divisor: 1024 };
  }
  return { unit: "KB/s", divisor: 1 };
}

function formatSpeedScaledValue(
  kbPerSec: number,
  unit: SpeedUnit,
  divisor: number,
  fractionDigits?: number
): string {
  const value = kbPerSec / divisor;
  if (fractionDigits != null) {
    return formatDecimalFixed(value, fractionDigits);
  }
  if (unit === "GB/s") {
    return formatDecimal(value, value >= 10 ? 0 : 1);
  }
  if (unit === "MB/s") {
    return formatDecimal(value, value >= 100 ? 0 : 1);
  }
  return formatInteger(value);
}

function formatDecimalFixed(value: number, fractionDigits: number): string {
  if (!Number.isFinite(value)) value = 0;
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatSpeedParts(
  bytesPerSec: number,
  fractionDigits?: number
): { value: string; unit: SpeedUnit } {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) {
    return {
      value: fractionDigits != null ? formatDecimalFixed(0, fractionDigits) : "0",
      unit: "KB/s",
    };
  }
  const kbPerSec = bytesPerSec / 1024;
  const { unit, divisor } = pickSpeedUnit(kbPerSec);
  return {
    value: formatSpeedScaledValue(kbPerSec, unit, divisor, fractionDigits),
    unit,
  };
}

export function formatSpeed(bytesPerSec: number): string {
  const { value, unit } = formatSpeedParts(bytesPerSec);
  return `${value} ${unit}`;
}

export function formatKilobytesPerSec(bytesPerSec: number): string {
  return `${formatInteger(bytesPerSec / 1024)} KB/s`;
}

export function formatOpsPerSec(ops: number): string {
  return `${formatInteger(ops)}/s`;
}

export type DataVolumeUnit = "B" | "KB" | "MB" | "GB" | "TB";

function pickDataVolumeUnit(bytes: number): { unit: DataVolumeUnit; divisor: number } {
  if (bytes >= 1024 ** 4) {
    return { unit: "TB", divisor: 1024 ** 4 };
  }
  if (bytes >= 1024 ** 3) {
    return { unit: "GB", divisor: 1024 ** 3 };
  }
  if (bytes >= 1024 ** 2) {
    return { unit: "MB", divisor: 1024 ** 2 };
  }
  if (bytes >= 1024) {
    return { unit: "KB", divisor: 1024 };
  }
  return { unit: "B", divisor: 1 };
}

function formatDataVolumeScaledValue(
  bytes: number,
  unit: DataVolumeUnit,
  divisor: number,
  fractionDigits?: number
): string {
  const value = bytes / divisor;
  if (fractionDigits != null) {
    return formatDecimalFixed(value, fractionDigits);
  }
  if (unit === "TB" || unit === "GB") {
    return formatDecimal(value, value >= 10 ? 0 : 1);
  }
  if (unit === "MB") {
    return formatDecimal(value, value >= 100 ? 0 : 1);
  }
  if (unit === "KB") {
    return formatDecimal(value, value >= 100 ? 0 : 1);
  }
  return formatInteger(value);
}

export function formatDataVolumeParts(
  bytes: number,
  fractionDigits?: number
): { value: string; unit: DataVolumeUnit } {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return {
      value: fractionDigits != null ? formatDecimalFixed(0, fractionDigits) : "0",
      unit: "B",
    };
  }
  const { unit, divisor } = pickDataVolumeUnit(bytes);
  return {
    value: formatDataVolumeScaledValue(bytes, unit, divisor, fractionDigits),
    unit,
  };
}

export function formatDataVolume(bytes: number): string {
  const { value, unit } = formatDataVolumeParts(bytes);
  return `${value} ${unit}`;
}
