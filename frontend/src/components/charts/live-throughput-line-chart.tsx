"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ChartLegendStrip, throughputLegendItems } from "@/components/charts/chart-legend";
import type { ThroughputScale } from "@/lib/chart-throughput";
import {
  formatThroughputAxisTick,
  formatThroughputValue,
  throughputAxisMax,
  throughputYTicks,
} from "@/lib/chart-throughput";

const DEFAULT_POLL_MS = 1500;
const Y_AXIS_WIDTH = 52;
const PADDING = { top: 8, right: 12, bottom: 8, left: Y_AXIS_WIDTH };

export type ThroughputHistoryPoint = {
  t: string;
  read: number;
  write: number;
};

type ChartColors = {
  read: string;
  write: string;
  grid: string;
  text: string;
  tooltipBg: string;
  tooltipBorder: string;
};

type PlotPoint = { x: number; y: number };
type HoverState = { index: number; x: number; y: number } | null;

function smoothValues(values: number[], windowSize = 3): number[] {
  if (values.length <= 2) return values;
  const half = Math.floor(windowSize / 2);
  return values.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (let j = i - half; j <= i + half; j++) {
      if (j >= 0 && j < values.length) {
        sum += values[j];
        count++;
      }
    }
    return sum / count;
  });
}

function seriesPoints(
  values: number[],
  xForIndex: (index: number) => number,
  yForValue: (value: number) => number
): PlotPoint[] {
  return values.map((value, index) => ({
    x: xForIndex(index),
    y: yForValue(value),
  }));
}

function linePath(points: PlotPoint[]): string {
  if (!points.length) return "";
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function areaPath(points: PlotPoint[], baseline: number): string {
  if (!points.length) return "";
  const start = points[0]!;
  const end = points[points.length - 1]!;
  return `${linePath(points)} L ${end.x} ${baseline} L ${start.x} ${baseline} Z`;
}

function useContainerWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      setWidth(Math.max(0, Math.floor(next)));
    });

    observer.observe(node);
    setWidth(Math.floor(node.getBoundingClientRect().width));
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

function useInfinitePaperScroll(
  data: ThroughputHistoryPoint[],
  slotWidth: number,
  pollIntervalMs: number,
  enabled: boolean
) {
  const [paperOffset, setPaperOffset] = useState(0);
  const sampleKeyRef = useRef("");

  useEffect(() => {
    const key = `${data.length}:${data[data.length - 1]?.t ?? ""}`;
    if (key !== sampleKeyRef.current) {
      sampleKeyRef.current = key;
      setPaperOffset(0);
    }
  }, [data]);

  useEffect(() => {
    if (!enabled || slotWidth <= 0) {
      setPaperOffset(0);
      return;
    }

    let frame = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = now - lastTime;
      lastTime = now;
      setPaperOffset((prev) => {
        const next = prev + (slotWidth / pollIntervalMs) * dt;
        return Math.min(next, slotWidth);
      });
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled, pollIntervalMs, slotWidth]);

  return paperOffset;
}

function ThroughputSeries({
  color,
  values,
  points,
  baseline,
  dashed,
  gradientId,
}: {
  color: string;
  values: number[];
  points: PlotPoint[];
  baseline: number;
  dashed?: boolean;
  gradientId: string;
}) {
  if (!values.length) return null;

  return (
    <g>
      <path d={areaPath(points, baseline)} fill={`url(#${gradientId})`} />
      <path
        d={linePath(points)}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashed ? "0 5" : undefined}
      />
    </g>
  );
}

export function LiveThroughputLineChart({
  data,
  colors,
  scale,
  pollIntervalMs = DEFAULT_POLL_MS,
}: {
  data: ThroughputHistoryPoint[];
  colors: ChartColors;
  scale: ThroughputScale;
  pollIntervalMs?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const readGradientId = `read-fill-${uid}`;
  const writeGradientId = `write-fill-${uid}`;
  const plotClipId = `plot-clip-${uid}`;
  const { ref, width } = useContainerWidth();
  const [hover, setHover] = useState<HoverState>(null);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const smoothed = useMemo(
    () => ({
      read: smoothValues(data.map((point) => point.read)),
      write: smoothValues(data.map((point) => point.write)),
    }),
    [data]
  );

  const latest = data[data.length - 1];
  const height = 196;
  const plotWidth = Math.max(0, width - PADDING.left - PADDING.right);
  const plotTop = PADDING.top;
  const plotHeight = Math.max(0, height - PADDING.top - PADDING.bottom);
  const plotLeft = PADDING.left;
  const plotRight = plotLeft + plotWidth;
  const baseline = plotTop + plotHeight;
  const yMax = throughputAxisMax(scale.maxKb);
  const yTicks = throughputYTicks(scale.maxKb);
  const pointCount = smoothed.read.length;
  const slotWidth =
    pointCount <= 1 ? plotWidth : plotWidth / (pointCount - 1);

  const paperOffset = useInfinitePaperScroll(
    data,
    slotWidth,
    pollIntervalMs,
    !reducedMotion && pointCount > 1
  );

  const xForIndex = useCallback(
    (index: number) => {
      if (pointCount <= 1) return plotLeft + plotWidth / 2;
      return plotLeft + index * slotWidth - paperOffset;
    },
    [paperOffset, plotLeft, plotWidth, pointCount, slotWidth]
  );

  const yForValue = useCallback(
    (value: number) =>
      plotTop + plotHeight - (Math.min(value, yMax) / yMax) * plotHeight,
    [plotTop, plotHeight, yMax]
  );

  const readPoints = useMemo(
    () => seriesPoints(smoothed.read, xForIndex, yForValue),
    [smoothed.read, xForIndex, yForValue]
  );
  const writePoints = useMemo(
    () => seriesPoints(smoothed.write, xForIndex, yForValue),
    [smoothed.write, xForIndex, yForValue]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (!plotWidth || data.length === 0) return;
      const rect = event.currentTarget.getBoundingClientRect();
      const x = event.clientX - rect.left;
      if (x < plotLeft || x > plotRight) {
        setHover(null);
        return;
      }
      const index =
        data.length <= 1
          ? 0
          : Math.max(
              0,
              Math.min(
                data.length - 1,
                Math.round((x - plotLeft + paperOffset) / slotWidth)
              )
            );
      setHover({ index, x, y: event.clientY - rect.top });
    },
    [data.length, paperOffset, plotLeft, plotRight, plotWidth, slotWidth]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex items-center justify-between gap-3 px-0.5">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Read
          </span>
          <span className="truncate font-mono text-sm font-semibold tabular-nums text-foreground">
            {latest ? formatThroughputValue(latest.read, scale) : "—"}
          </span>
        </div>
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Write
          </span>
          <span className="truncate font-mono text-sm font-semibold tabular-nums text-foreground">
            {latest ? formatThroughputValue(latest.write, scale) : "—"}
          </span>
        </div>
      </div>

      <div ref={ref} className="live-throughput-chart relative min-h-0 flex-1 overflow-hidden">
        {width > 0 && (
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="block h-full w-full select-none"
            role="img"
            aria-label="Live throughput chart showing read and write rates over time"
            onPointerMove={handlePointerMove}
            onPointerLeave={() => setHover(null)}
          >
            <defs>
              <linearGradient id={readGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.read} stopOpacity={0.22} />
                <stop offset="100%" stopColor={colors.read} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id={writeGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.write} stopOpacity={0.16} />
                <stop offset="100%" stopColor={colors.write} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id={`fade-${uid}`} x1="1" y1="0" x2="0" y2="0">
                <stop offset="0%" stopColor="hsl(var(--card))" stopOpacity={0.9} />
                <stop offset="18%" stopColor="hsl(var(--card))" stopOpacity={0} />
              </linearGradient>
              <clipPath id={plotClipId}>
                <rect x={plotLeft} y={plotTop} width={plotWidth} height={plotHeight} />
              </clipPath>
            </defs>

            <g>
              {yTicks.map((tick) => (
                <g key={tick}>
                  <text
                    x={4}
                    y={yForValue(tick) + 3}
                    className="fill-muted-foreground font-mono text-[9px] tabular-nums"
                  >
                    {formatThroughputAxisTick(tick, scale)}
                  </text>
                  {tick > 0 && (
                    <line
                      x1={plotLeft}
                      x2={plotRight}
                      y1={yForValue(tick)}
                      y2={yForValue(tick)}
                      className="stroke-border/35"
                      strokeDasharray="3 4"
                      strokeWidth={1}
                    />
                  )}
                </g>
              ))}

              <line
                x1={plotLeft}
                x2={plotRight}
                y1={baseline}
                y2={baseline}
                className="stroke-border/70"
                strokeWidth={1}
              />

              <text
                x={4}
                y={baseline - 2}
                className="fill-muted-foreground text-[8px] font-medium uppercase tracking-wide"
              >
                {scale.unit}
              </text>
            </g>

            <g clipPath={`url(#${plotClipId})`}>
              <ThroughputSeries
                color={colors.write}
                values={smoothed.write}
                points={writePoints}
                baseline={baseline}
                dashed
                gradientId={writeGradientId}
              />
              <ThroughputSeries
                color={colors.read}
                values={smoothed.read}
                points={readPoints}
                baseline={baseline}
                gradientId={readGradientId}
              />

              {hover && data[hover.index] && (
                <>
                  <line
                    x1={hover.x}
                    x2={hover.x}
                    y1={plotTop}
                    y2={baseline}
                    className="stroke-border"
                    strokeWidth={1}
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={hover.x}
                    cy={yForValue(smoothed.read[hover.index] ?? 0)}
                    r={3}
                    fill={colors.read}
                  />
                  <circle
                    cx={hover.x}
                    cy={yForValue(smoothed.write[hover.index] ?? 0)}
                    r={3}
                    fill={colors.write}
                  />
                </>
              )}
            </g>

            <rect
              x={plotLeft + plotWidth * 0.82}
              y={plotTop}
              width={plotWidth * 0.18}
              height={plotHeight}
              fill={`url(#fade-${uid})`}
              pointerEvents="none"
            />
          </svg>
        )}

        {hover && data[hover.index] && (
          <div
            className="pointer-events-none absolute z-10 rounded-md border px-2.5 py-1.5 text-[11px] shadow-sm"
            style={{
              left: Math.min(Math.max(hover.x - 56, 8), width - 128),
              top: 8,
              backgroundColor: colors.tooltipBg,
              borderColor: colors.tooltipBorder,
            }}
          >
            <p className="mb-1 font-medium text-foreground">{data[hover.index]?.t}</p>
            <p className="font-mono" style={{ color: colors.read }}>
              Read: {formatThroughputValue(data[hover.index]!.read, scale)}
            </p>
            <p className="font-mono" style={{ color: colors.write }}>
              Write: {formatThroughputValue(data[hover.index]!.write, scale)}
            </p>
          </div>
        )}
      </div>

      <ChartLegendStrip items={throughputLegendItems(colors, "line")} />
    </div>
  );
}
