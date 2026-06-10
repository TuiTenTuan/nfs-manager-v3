"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartLegendStrip, throughputLegendItems } from "@/components/charts/chart-legend";
import {
  ThroughputTooltipContent,
  getThroughputYAxisProps,
} from "@/components/charts/throughput-chart-parts";
import {
  formatReportTimeseriesLabel,
  formatReportTimeseriesTooltip,
  type ReportPeriod,
  type ThroughputScale,
} from "@/lib/chart-throughput";
import { CHART_WRITE_LINE_DASH } from "@/lib/chart-theme";

export type ReportThroughputPoint = {
  recorded_at: string;
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

export function ReportThroughputLineChart({
  data,
  colors,
  scale,
  period,
}: {
  data: ReportThroughputPoint[];
  colors: ChartColors;
  scale: ThroughputScale;
  period: ReportPeriod;
}) {
  const uid = useId().replace(/:/g, "");
  const readGradientId = `throughput-read-${uid}`;
  const writeGradientId = `throughput-write-${uid}`;

  return (
    <div className="flex h-72 flex-col p-4 pt-3">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={readGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.read} stopOpacity={0.22} />
                <stop offset="100%" stopColor={colors.read} stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id={writeGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.write} stopOpacity={0.16} />
                <stop offset="100%" stopColor={colors.write} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <YAxis {...getThroughputYAxisProps(scale, colors, 11)} />
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="recorded_at"
              tick={{ fontSize: 11, fill: colors.text }}
              tickFormatter={(value) => formatReportTimeseriesLabel(String(value), period)}
              minTickGap={24}
              interval="preserveStartEnd"
            />
            <Tooltip
              labelFormatter={(value) => formatReportTimeseriesTooltip(String(value))}
              content={
                <ThroughputTooltipContent
                  colors={colors}
                  scale={scale}
                  nameMap={{ read: "Read", write: "Write" }}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="write"
              name="Write"
              stroke={colors.write}
              strokeWidth={2}
              strokeDasharray={CHART_WRITE_LINE_DASH}
              fill={`url(#${writeGradientId})`}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
            <Area
              type="monotone"
              dataKey="read"
              name="Read"
              stroke={colors.read}
              strokeWidth={2}
              fill={`url(#${readGradientId})`}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ChartLegendStrip items={throughputLegendItems(colors, "line")} />
    </div>
  );
}
