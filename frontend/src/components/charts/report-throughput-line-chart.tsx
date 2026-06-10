"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
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
  return (
    <div className="flex h-72 flex-col p-4 pt-3">
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="recorded_at"
              tick={{ fontSize: 11, fill: colors.text }}
              tickFormatter={(value) => formatReportTimeseriesLabel(String(value), period)}
              minTickGap={24}
              interval="preserveStartEnd"
            />
            <YAxis {...getThroughputYAxisProps(scale, colors, 11)} />
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
            <Line
              type="monotone"
              dataKey="read"
              name="Read"
              stroke={colors.read}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
            <Line
              type="monotone"
              dataKey="write"
              name="Write"
              stroke={colors.write}
              strokeWidth={2}
              strokeDasharray={CHART_WRITE_LINE_DASH}
              dot={false}
              activeDot={{ r: 3, strokeWidth: 0 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ChartLegendStrip items={throughputLegendItems(colors, "line")} />
    </div>
  );
}
