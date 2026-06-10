"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ChartLegendStrip, throughputLegendItems } from "@/components/charts/chart-legend";
import { ReportThroughputLineChart } from "@/components/charts/report-throughput-line-chart";
import { ReportVolumeLineChart } from "@/components/charts/report-volume-line-chart";
import {
  ThroughputTooltipContent,
  ThroughputYAxis,
  useThroughputScale,
} from "@/components/charts/throughput-chart-parts";
import {
  VolumeTooltipContent,
  VolumeYAxis,
  useVolumeScale,
} from "@/components/charts/volume-chart-parts";
import { api } from "@/lib/api";
import {
  formatDataVolume,
  formatDataVolumeParts,
  formatDecimal,
  formatInteger,
  formatOpsPerSec,
  formatSpeed,
} from "@/lib/format";
import { formatThroughputPartsFromBytes } from "@/lib/chart-throughput";
import { shareChartColor, useChartColors } from "@/lib/chart-theme";
import { buildShareVolumeChart } from "@/lib/chart-volume";
import { useTheme } from "@/lib/theme";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Point = {
  share_id?: number;
  avg_bytes_read_per_sec: number;
  avg_bytes_write_per_sec: number;
  total_bytes_read: number;
  total_bytes_write: number;
  avg_ops_per_sec: number;
  max_active_connections: number;
  sample_count: number;
};

type GlobalTimeseriesPoint = {
  recorded_at: string;
  avg_bytes_read_per_sec: number;
  avg_bytes_write_per_sec: number;
  sample_count: number;
};

type ShareVolumeTimeseriesPoint = {
  recorded_at: string;
  share_id: number;
  bytes_read_volume: number;
  bytes_write_volume: number;
  sample_count: number;
};

type Share = { id: number; name: string };

const periods = ["day", "week", "month", "year"] as const;

export default function ReportsPage() {
  const colors = useChartColors();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [period, setPeriod] = useState<(typeof periods)[number]>("day");
  const [points, setPoints] = useState<Point[] | null>(null);
  const [timeseries, setTimeseries] = useState<GlobalTimeseriesPoint[] | null>(null);
  const [volumeTimeseries, setVolumeTimeseries] = useState<ShareVolumeTimeseriesPoint[] | null>(null);
  const [shares, setShares] = useState<Share[]>([]);

  useEffect(() => {
    let active = true;
    setPoints(null);
    setTimeseries(null);
    setVolumeTimeseries(null);
    Promise.all([
      api<{ points: Point[] }>(`/reports?period=${period}`),
      api<{ points: GlobalTimeseriesPoint[] }>(`/reports/timeseries?period=${period}`),
      api<{ points: ShareVolumeTimeseriesPoint[] }>(
        `/reports/timeseries?period=${period}&breakdown=share`
      ),
      api<Share[] | null>("/shares"),
    ])
      .then(([summary, series, volumeSeries, shareList]) => {
        if (!active) return;
        setPoints(summary.points);
        setTimeseries(series.points);
        setVolumeTimeseries(volumeSeries.points);
        setShares(Array.isArray(shareList) ? shareList : []);
      })
      .catch(() => {
        if (active) {
          setPoints([]);
          setTimeseries([]);
          setVolumeTimeseries([]);
        }
      });
    return () => {
      active = false;
    };
  }, [period]);

  const hasData = points && points.length > 0 && points.some((p) => p.sample_count > 0);

  const chartData = (points ?? [])
    .filter((p) => p.sample_count > 0)
    .map((p) => ({
      name: p.share_id != null ? `Share ${p.share_id}` : "Global",
      read: Math.round(p.avg_bytes_read_per_sec / 1024),
      write: Math.round(p.avg_bytes_write_per_sec / 1024),
      ops: Math.round(p.avg_ops_per_sec),
    }));

  const volumeBarData = (points ?? [])
    .filter((p) => p.sample_count > 0)
    .map((p) => ({
      name: p.share_id != null ? `Share ${p.share_id}` : "Global",
      read: p.total_bytes_read,
      write: p.total_bytes_write,
    }));

  const chartScale = useThroughputScale(chartData);
  const volumeBarScale = useVolumeScale(volumeBarData);

  const timeseriesChartData = (timeseries ?? [])
    .filter((p) => p.sample_count > 0)
    .map((p) => ({
      recorded_at: p.recorded_at,
      read: Math.round(p.avg_bytes_read_per_sec / 1024),
      write: Math.round(p.avg_bytes_write_per_sec / 1024),
    }));

  const volumeTimeseriesChart = useMemo(() => {
    const shareNameById = new Map(shares.map((share) => [share.id, share.name]));
    return buildShareVolumeChart(
      volumeTimeseries ?? [],
      (shareId) => shareNameById.get(shareId) ?? `Share ${shareId}`,
      (index) => shareChartColor(index, isDark)
    );
  }, [volumeTimeseries, shares, isDark]);

  const timeseriesScale = useThroughputScale(timeseriesChartData);
  const volumeTimeseriesScale = useVolumeScale(volumeTimeseriesChart.data);
  const hasTimeseries = timeseriesChartData.length > 0;
  const hasVolumeTimeseries =
    volumeTimeseriesChart.data.length > 0 && volumeTimeseriesChart.series.length > 0;

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Aggregated throughput and data volume metrics by period"
      />

      <Tabs
        value={period}
        onValueChange={(v) => {
          setPeriod(v as typeof period);
          setPoints(null);
        }}
        className="mb-6"
      >
        <TabsList>
          {periods.map((p) => (
            <TabsTrigger key={p} value={p} className="capitalize">{p}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {points === null ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      ) : !hasData ? (
        <EmptyState
          title="No sample data"
          description="The background metrics collector stores samples automatically. Data appears here after the collector has run for a while."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6 mb-6">
            {(() => {
              const totals = points.reduce(
                (acc, p) => ({
                  read: acc.read + p.avg_bytes_read_per_sec,
                  write: acc.write + p.avg_bytes_write_per_sec,
                  readVol: acc.readVol + p.total_bytes_read,
                  writeVol: acc.writeVol + p.total_bytes_write,
                  ops: acc.ops + p.avg_ops_per_sec,
                  conn: Math.max(acc.conn, p.max_active_connections),
                }),
                { read: 0, write: 0, readVol: 0, writeVol: 0, ops: 0, conn: 0 }
              );
              const count = points.length;
              return [
                {
                  label: "Avg read",
                  throughput: formatThroughputPartsFromBytes(totals.read / count, 2),
                },
                {
                  label: "Avg write",
                  throughput: formatThroughputPartsFromBytes(totals.write / count, 2),
                },
                {
                  label: "Total read volume",
                  volume: formatDataVolumeParts(totals.readVol),
                },
                {
                  label: "Total write volume",
                  volume: formatDataVolumeParts(totals.writeVol),
                },
                { label: "Avg ops", value: formatOpsPerSec(totals.ops / count) },
                { label: "Max connections", value: formatInteger(totals.conn) },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
                  {"throughput" in s && s.throughput ? (
                    <p className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-xl font-semibold font-mono tabular-nums">{s.throughput.value}</span>
                      <span className="text-base font-medium text-muted-foreground">{s.throughput.unit}</span>
                    </p>
                  ) : "volume" in s && s.volume ? (
                    <p className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-xl font-semibold font-mono tabular-nums">{s.volume.value}</span>
                      <span className="text-base font-medium text-muted-foreground">{s.volume.unit}</span>
                    </p>
                  ) : (
                    <p className="text-xl font-semibold font-mono mt-1">{s.value}</p>
                  )}
                </div>
              ));
            })()}
          </div>

          <div className="rounded-lg border mb-6">
            <div className="px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">Throughput over time</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Global read and write rates for the selected period</p>
            </div>
            {hasTimeseries ? (
              <ReportThroughputLineChart
                data={timeseriesChartData}
                colors={colors}
                scale={timeseriesScale}
                period={period}
              />
            ) : (
              <p className="px-4 py-8 text-sm text-muted-foreground">No time-bucketed samples for this period.</p>
            )}
          </div>

          <div className="rounded-lg border mb-6">
            <div className="px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">Data volume over time</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Read and write volume per share for each time bucket</p>
            </div>
            {hasVolumeTimeseries ? (
              <ReportVolumeLineChart
                data={volumeTimeseriesChart.data}
                series={volumeTimeseriesChart.series}
                colors={colors}
                scale={volumeTimeseriesScale}
                period={period}
              />
            ) : (
              <p className="px-4 py-8 text-sm text-muted-foreground">No time-bucketed volume samples for this period.</p>
            )}
          </div>

          <div className="rounded-lg border mb-6">
            <div className="px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">Throughput by share</h2>
            </div>
            <div className="flex h-72 flex-col p-4 pt-3">
              <div className="min-h-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={4} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: colors.text }} />
                  <ThroughputYAxis scale={chartScale} colors={colors} fontSize={11} />
                  <Tooltip
                    content={
                      <ThroughputTooltipContent
                        colors={colors}
                        scale={chartScale}
                        nameMap={{ read: "Read", write: "Write" }}
                      />
                    }
                  />
                  <Bar dataKey="read" fill={colors.read} name="Read" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="write" fill={colors.write} name="Write" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ChartLegendStrip items={throughputLegendItems(colors, "bar")} />
            </div>
          </div>

          <div className="rounded-lg border mb-6">
            <div className="px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">Volume by share</h2>
            </div>
            <div className="flex h-72 flex-col p-4 pt-3">
              <div className="min-h-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeBarData} barGap={4} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: colors.text }} />
                  <VolumeYAxis scale={volumeBarScale} colors={colors} fontSize={11} />
                  <Tooltip
                    content={
                      <VolumeTooltipContent
                        colors={colors}
                        scale={volumeBarScale}
                        nameMap={{ read: "Read", write: "Write" }}
                      />
                    }
                  />
                  <Bar dataKey="read" fill={colors.read} name="Read" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="write" fill={colors.write} name="Write" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ChartLegendStrip items={throughputLegendItems(colors, "bar")} />
            </div>
          </div>

          <div className="rounded-lg border">
            <div className="px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">Detail table ({period})</h2>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Share</TableHead>
                  <TableHead>Avg read</TableHead>
                  <TableHead>Avg write</TableHead>
                  <TableHead>Read volume</TableHead>
                  <TableHead>Write volume</TableHead>
                  <TableHead>Avg ops</TableHead>
                  <TableHead>Max conn</TableHead>
                  <TableHead>Samples</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {points.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell>{p.share_id != null ? formatInteger(p.share_id) : "Global"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatSpeed(p.avg_bytes_read_per_sec)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatSpeed(p.avg_bytes_write_per_sec)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatDataVolume(p.total_bytes_read)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatDataVolume(p.total_bytes_write)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{formatDecimal(p.avg_ops_per_sec, 1)}</TableCell>
                    <TableCell className="font-mono text-xs">{formatInteger(p.max_active_connections)}</TableCell>
                    <TableCell className="font-mono text-xs">{formatInteger(p.sample_count)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
