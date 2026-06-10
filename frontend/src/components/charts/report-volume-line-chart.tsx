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
import { ChartLegendStrip, type ChartLegendItem } from "@/components/charts/chart-legend";
import {
  VolumeTooltipContent,
  getVolumeYAxisProps,
  volumeChartMargin,
} from "@/components/charts/volume-chart-parts";
import {
  formatReportTimeseriesLabel,
  formatReportTimeseriesTooltip,
  type ReportPeriod,
  type VolumeChartSeries,
  type VolumeScale,
} from "@/lib/chart-volume";
import { CHART_WRITE_LINE_DASH } from "@/lib/chart-theme";

export type ReportVolumePoint = Record<string, string | number>;

type ChartColors = {
  grid: string;
  text: string;
  tooltipBg: string;
  tooltipBorder: string;
};

function volumeLegendItems(series: VolumeChartSeries[]): ChartLegendItem[] {
  return series.map((item) => ({
    label: item.name,
    color: item.color,
    variant: "line" as const,
    dashed: item.dashed,
  }));
}

export function ReportVolumeLineChart({
  data,
  series,
  colors,
  scale,
  period,
  className = "flex h-72 flex-col p-4 pt-3",
  tickFontSize = 11,
}: {
  data: ReportVolumePoint[];
  series: VolumeChartSeries[];
  colors: ChartColors;
  scale: VolumeScale;
  period: ReportPeriod;
  className?: string;
  tickFontSize?: number;
}) {
  return (
    <div className={className}>
      <div className="min-h-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={volumeChartMargin(scale)}>
            <YAxis {...getVolumeYAxisProps(scale, colors, tickFontSize)} />
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="recorded_at"
              tick={{ fontSize: tickFontSize, fill: colors.text }}
              tickFormatter={(value) => formatReportTimeseriesLabel(String(value), period)}
              minTickGap={24}
              interval="preserveStartEnd"
            />
            <Tooltip
              labelFormatter={(value) => formatReportTimeseriesTooltip(String(value))}
              content={
                <VolumeTooltipContent
                  colors={colors}
                  scale={scale}
                />
              }
            />
            {series.map((item) => (
              <Line
                key={item.dataKey}
                type="monotone"
                dataKey={item.dataKey}
                name={item.name}
                stroke={item.color}
                strokeWidth={2}
                strokeDasharray={item.dashed ? CHART_WRITE_LINE_DASH : undefined}
                dot={false}
                activeDot={{ r: 3, strokeWidth: 0 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <ChartLegendStrip items={volumeLegendItems(series)} />
    </div>
  );
}
