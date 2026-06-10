"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import { ChartLegendStrip, throughputLegendItems } from "@/components/charts/chart-legend";
import {
  VolumeTooltipContent,
  VolumeYAxis,
} from "@/components/charts/volume-chart-parts";
import {
  formatReportTimeseriesLabel,
  formatReportTimeseriesTooltip,
  type ReportPeriod,
  type VolumeScale,
} from "@/lib/chart-volume";
import { CHART_WRITE_LINE_DASH } from "@/lib/chart-theme";

export type ReportVolumePoint = {
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

export function ReportVolumeLineChart({
  data,
  colors,
  scale,
  period,
}: {
  data: ReportVolumePoint[];
  colors: ChartColors;
  scale: VolumeScale;
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
            <VolumeYAxis scale={scale} colors={colors} fontSize={11} />
            <Tooltip
              labelFormatter={(value) => formatReportTimeseriesTooltip(String(value))}
              content={
                <VolumeTooltipContent
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
