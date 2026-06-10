"use client";

import { useEffect, useMemo, useRef, useState, type ElementType } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChartLineUp,
  HardDrives,
  Lightning,
  Pulse,
  Users,
} from "@phosphor-icons/react";
import { toast } from "@/lib/toast";
import { api, getHealth, type Health } from "@/lib/api";
import { shareChartColor, useChartColors } from "@/lib/chart-theme";
import { buildShareVolumeChart } from "@/lib/chart-volume";
import { useTheme } from "@/lib/theme";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatInteger } from "@/lib/format";
import { formatThroughputPartsFromBytes } from "@/lib/chart-throughput";
import { LiveThroughputLineChart } from "@/components/charts/live-throughput-line-chart";
import { ReportVolumeLineChart } from "@/components/charts/report-volume-line-chart";
import { useThroughputScale } from "@/components/charts/throughput-chart-parts";
import { useVolumeScale } from "@/components/charts/volume-chart-parts";
import {
  DEFAULT_THROUGHPUT_WINDOW_SECONDS,
  MAX_THROUGHPUT_WINDOW_SECONDS,
  ThroughputWindowMenu,
  maxHistoryPoints,
} from "@/components/charts/throughput-window";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
type Share = { id: number; name: string; enabled: boolean };
type Audit = { id: number; action: string; username: string; created_at: string };

type Metrics = {
  bytes_read_per_sec: number;
  bytes_write_per_sec: number;
  ops_per_sec: number;
  active_connections: number;
  clients: { ip: string; mount: string; duration?: string }[];
  timestamp: string;
};

type TimeseriesPoint = {
  recorded_at: string;
  share_id: number;
  bytes_read_volume: number;
  bytes_write_volume: number;
  sample_count: number;
};

type HistoryPoint = { t: string; read: number; write: number; ops: number };

const POLL_MS = 1500;

function MetricCard({
  label,
  value,
  throughputBytesPerSec,
  sub,
  icon: Icon,
  loading,
  error,
}: {
  label: string;
  value?: string;
  throughputBytesPerSec?: number;
  sub?: string;
  icon: ElementType<{ className?: string; weight?: "fill" | "regular" | "bold" | "duotone" | "light" | "thin" }>;
  loading?: boolean;
  error?: string;
}) {
  const throughput =
    throughputBytesPerSec != null
      ? formatThroughputPartsFromBytes(throughputBytesPerSec)
      : null;

  return (
    <Card>
      <CardContent className="p-4">
        {loading ? (
          <>
            <Skeleton className="h-3 w-16 mb-2" />
            <Skeleton className="h-7 w-24 mb-1" />
            <Skeleton className="h-3 w-20" />
          </>
        ) : error ? (
          <>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
              <Icon className="h-3.5 w-3.5" weight="regular" />
              {label}
            </div>
            <p className="text-sm text-destructive mt-2">{error}</p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
              <Icon className="h-3.5 w-3.5" weight="regular" />
              {label}
            </div>
            {throughput ? (
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className="text-2xl font-semibold font-mono tabular-nums">{throughput.value}</span>
                <span className="text-base font-medium text-muted-foreground">{throughput.unit}</span>
              </p>
            ) : (
              <p className="text-2xl font-semibold font-mono mt-1">{value}</p>
            )}
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const colors = useChartColors();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [health, setHealth] = useState<Health | null>(null);
  const [shares, setShares] = useState<Share[] | null>(null);
  const [audit, setAudit] = useState<Audit[] | null>(null);
  const [timeseries, setTimeseries] = useState<TimeseriesPoint[] | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [healthError, setHealthError] = useState("");
  const [sharesError, setSharesError] = useState("");
  const [auditError, setAuditError] = useState("");
  const [volumeError, setVolumeError] = useState("");
  const [metricsError, setMetricsError] = useState("");
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [throughputWindowSeconds, setThroughputWindowSeconds] = useState(DEFAULT_THROUGHPUT_WINDOW_SECONDS);
  const pollFailures = useRef(0);
  const maxStoredPoints = maxHistoryPoints(MAX_THROUGHPUT_WINDOW_SECONDS, POLL_MS);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealthError("Could not reach API health endpoint"));

    api<Share[] | null>("/shares")
      .then((data) => setShares(Array.isArray(data) ? data : []))
      .catch((err) => {
        setSharesError(err instanceof Error ? err.message : "Failed to load shares");
        setShares([]);
      });

    api<Audit[] | null>("/audit")
      .then((a) => setAudit(Array.isArray(a) ? a.slice(0, 8) : []))
      .catch((err) => {
        setAuditError(err instanceof Error ? err.message : "Failed to load audit log");
        setAudit([]);
      });

    api<{ points: TimeseriesPoint[] }>("/reports/timeseries?period=day&breakdown=share")
      .then((r) => setTimeseries(r.points ?? []))
      .catch((err) => {
        setVolumeError(err instanceof Error ? err.message : "Failed to load volume data");
        setTimeseries([]);
      });
  }, []);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const m = await api<Metrics>("/monitor");
        if (!active) return;
        setMetrics(m);
        setMetricsLoading(false);
        setMetricsError("");
        pollFailures.current = 0;
        setHistory((h) => [
          ...h.slice(-(maxStoredPoints - 1)),
          {
            t: new Date(m.timestamp).toLocaleTimeString(),
            read: Math.round(m.bytes_read_per_sec / 1024),
            write: Math.round(m.bytes_write_per_sec / 1024),
            ops: Math.round(m.ops_per_sec),
          },
        ]);
      } catch (err) {
        pollFailures.current += 1;
        const msg = err instanceof Error ? err.message : "Failed to load live metrics";
        setMetricsError(msg);
        if (pollFailures.current === 3) {
          toast.error("Live metrics unavailable", { description: msg });
        }
      }
      const delay = POLL_MS * Math.min(Math.pow(2, pollFailures.current), 4);
      timer = setTimeout(poll, delay);
    };

    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [maxStoredPoints]);

  const visibleHistory = history.slice(
    -maxHistoryPoints(throughputWindowSeconds, POLL_MS)
  );

  const volumeChart = useMemo(() => {
    const shareNameById = new Map((shares ?? []).map((share) => [share.id, share.name]));
    return buildShareVolumeChart(
      timeseries ?? [],
      (shareId) => shareNameById.get(shareId) ?? `Share ${shareId}`,
      (index) => shareChartColor(index, isDark)
    );
  }, [timeseries, shares, isDark]);

  const volumeScale = useVolumeScale(volumeChart.data);
  const hasVolumeData = volumeChart.data.length > 0 && volumeChart.series.length > 0;

  const enabled = shares?.filter((s) => s.enabled).length ?? 0;
  const sharesLoading = shares === null;
  const clientCount = metrics?.clients?.length ?? 0;
  const historyScale = useThroughputScale(visibleHistory);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Live NFS throughput, connected clients, and system health"
        action={
          <Link
            href="/reports"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Full reports
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      {(healthError || sharesError) && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {[healthError, sharesError].filter(Boolean).join(" · ")}
        </div>
      )}

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mb-6">
        <MetricCard
          label="Read"
          throughputBytesPerSec={metrics?.bytes_read_per_sec ?? 0}
          icon={Lightning}
          loading={metricsLoading}
          error={metricsError && !metrics ? metricsError : undefined}
        />
        <MetricCard
          label="Write"
          throughputBytesPerSec={metrics?.bytes_write_per_sec ?? 0}
          icon={Lightning}
          loading={metricsLoading}
        />
        <MetricCard
          label="Ops/s"
          value={metrics ? formatInteger(metrics.ops_per_sec) : "—"}
          sub={metrics ? `${formatInteger(metrics.active_connections)} connections` : undefined}
          icon={Pulse}
          loading={metricsLoading}
        />
        <MetricCard
          label="Clients"
          value={formatInteger(clientCount)}
          sub={metrics ? `${formatInteger(metrics.active_connections)} active conn.` : undefined}
          icon={Users}
          loading={metricsLoading}
        />
        <MetricCard
          label="Shares"
          value={sharesLoading ? "—" : formatInteger(shares?.length ?? 0)}
          sub={sharesLoading ? undefined : `${formatInteger(enabled)} enabled`}
          icon={HardDrives}
          loading={sharesLoading}
          error={sharesError || undefined}
        />
        <Card>
          <CardContent className="p-4">
            {health === null && !healthError ? (
              <>
                <Skeleton className="h-3 w-16 mb-2" />
                <Skeleton className="h-7 w-20" />
              </>
            ) : healthError ? (
              <>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
                  <ChartLineUp className="h-3.5 w-3.5" weight="regular" />
                  Status
                </div>
                <p className="text-sm text-destructive mt-2">{healthError}</p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground uppercase tracking-wide">
                  <ChartLineUp className="h-3.5 w-3.5" weight="regular" />
                  Status
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge variant={health?.status === "ok" ? "success" : "destructive"}>
                    {health?.status ?? "unknown"}
                  </Badge>
                  <span className="text-xs text-muted-foreground capitalize font-mono">
                    {health?.provider ?? "—"}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-semibold">Live throughput</CardTitle>
              <ThroughputWindowMenu
                value={throughputWindowSeconds}
                onChange={setThroughputWindowSeconds}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex h-56 flex-col">
              {metricsLoading && visibleHistory.length === 0 ? (
                <Skeleton className="h-full w-full" />
              ) : metricsError && visibleHistory.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-destructive">
                  {metricsError}
                </div>
              ) : visibleHistory.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Waiting for metrics samples…
                </div>
              ) : (
                <LiveThroughputLineChart
                  data={visibleHistory}
                  colors={colors}
                  scale={historyScale}
                  pollIntervalMs={POLL_MS}
                />
              )}
            </div>
            {metricsError && visibleHistory.length > 0 && (
              <p className="text-xs text-destructive mt-2">Metrics stale: {metricsError}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Data volume by share today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-56 flex-col">
              {timeseries === null ? (
                <Skeleton className="h-full w-full" />
              ) : volumeError ? (
                <div className="flex h-full items-center justify-center text-sm text-destructive">
                  {volumeError}
                </div>
              ) : !hasVolumeData ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-center px-4">
                  <p className="text-sm text-muted-foreground">No volume samples for today yet.</p>
                  <p className="text-xs text-muted-foreground">
                    Metrics are collected when this dashboard or a share monitor page is open.
                  </p>
                </div>
              ) : (
                <ReportVolumeLineChart
                  data={volumeChart.data}
                  series={volumeChart.series}
                  colors={colors}
                  scale={volumeScale}
                  period="day"
                  className="flex h-full min-h-0 flex-col"
                  tickFontSize={10}
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">Connected clients</CardTitle>
              {metrics && (
                <span className="text-xs text-muted-foreground font-mono">
                  Updated {new Date(metrics.timestamp).toLocaleTimeString()}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {metricsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : metricsError && !metrics ? (
              <p className="text-sm text-destructive">{metricsError}</p>
            ) : !metrics?.clients?.length ? (
              <p className="text-sm text-muted-foreground">No clients connected</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP</TableHead>
                    <TableHead>Mount</TableHead>
                    <TableHead>Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.clients.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{c.ip}</TableCell>
                      <TableCell className="font-mono text-xs">{c.mount}</TableCell>
                      <TableCell className="text-muted-foreground">{c.duration || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {audit === null ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : auditError ? (
              <p className="text-sm text-destructive">{auditError}</p>
            ) : audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit events yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {audit.map((a) => (
                  <li key={a.id} className="flex justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0">
                    <span className="truncate">{a.action}</span>
                    <span className="text-muted-foreground font-mono text-xs shrink-0">
                      {a.username} · {new Date(a.created_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link href="/shares" className="text-primary hover:underline">
          Manage shares
        </Link>
        <Link href="/reports" className="text-primary hover:underline">
          View reports
        </Link>
        {shares?.slice(0, 3).map((s) => (
          <Link key={s.id} href={`/shares/${s.id}/monitor`} className="text-primary hover:underline">
            Monitor {s.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
