"use client";

import { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { ChartLegendStrip, throughputLegendItems } from "@/components/charts/chart-legend";
import {
  ThroughputTooltipContent,
  ThroughputYAxis,
  useThroughputScale,
} from "@/components/charts/throughput-chart-parts";
import { api } from "@/lib/api";
import { formatDecimal, formatInteger, formatOpsPerSec } from "@/lib/format";
import { formatThroughputPartsFromBytes } from "@/lib/chart-throughput";
import { useChartColors } from "@/lib/chart-theme";
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
  avg_ops_per_sec: number;
  max_active_connections: number;
  sample_count: number;
};

const periods = ["day", "week", "month", "year"] as const;

export default function ReportsPage() {
  const colors = useChartColors();
  const [period, setPeriod] = useState<(typeof periods)[number]>("day");
  const [points, setPoints] = useState<Point[] | null>(null);

  useEffect(() => {
    let active = true;
    api<{ points: Point[] }>(`/reports?period=${period}`)
      .then((r) => {
        if (active) setPoints(r.points);
      })
      .catch(() => {
        if (active) setPoints([]);
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

  const chartScale = useThroughputScale(chartData);

  return (
    <div>
      <PageHeader title="Reports" description="Aggregated throughput metrics by period" />

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
          description="Open a share monitor page to collect metrics. Reports aggregate data from live polling."
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4 mb-6">
            {(() => {
              const totals = points.reduce(
                (acc, p) => ({
                  read: acc.read + p.avg_bytes_read_per_sec,
                  write: acc.write + p.avg_bytes_write_per_sec,
                  ops: acc.ops + p.avg_ops_per_sec,
                  conn: Math.max(acc.conn, p.max_active_connections),
                }),
                { read: 0, write: 0, ops: 0, conn: 0 }
              );
              return [
                {
                  label: "Avg read",
                  throughput: formatThroughputPartsFromBytes(totals.read / points.length, 2),
                },
                {
                  label: "Avg write",
                  throughput: formatThroughputPartsFromBytes(totals.write / points.length, 2),
                },
                { label: "Avg ops", value: formatOpsPerSec(totals.ops / points.length) },
                { label: "Max connections", value: formatInteger(totals.conn) },
              ].map((s) => (
                <div key={s.label} className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{s.label}</p>
                  {"throughput" in s ? (
                    <p className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-xl font-semibold font-mono tabular-nums">{s.throughput.value}</span>
                      <span className="text-base font-medium text-muted-foreground">{s.throughput.unit}</span>
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
                      {formatInteger(p.avg_bytes_read_per_sec / 1024)} KB
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatInteger(p.avg_bytes_write_per_sec / 1024)} KB
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
