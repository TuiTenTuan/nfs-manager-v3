"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { LiveThroughputLineChart } from "@/components/charts/live-throughput-line-chart";
import { useThroughputScale } from "@/components/charts/throughput-chart-parts";
import { api } from "@/lib/api";
import { useChartColors } from "@/lib/chart-theme";
import { PageHeader } from "@/components/layout/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { formatInteger, formatSpeed } from "@/lib/format";
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

type Metrics = {
  bytes_read_per_sec: number;
  bytes_write_per_sec: number;
  ops_per_sec: number;
  active_connections: number;
  clients: { ip: string; mount: string; duration?: string }[];
  timestamp: string;
};

const POLL_MS = 1500;

export function ShareMonitorClient({ id }: { id: string }) {
  const colors = useChartColors();
  const [current, setCurrent] = useState<Metrics | null>(null);
  const [history, setHistory] = useState<{ t: string; read: number; write: number; ops: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [throughputWindowSeconds, setThroughputWindowSeconds] = useState(DEFAULT_THROUGHPUT_WINDOW_SECONDS);
  const backoff = useRef(0);
  const maxStoredPoints = maxHistoryPoints(MAX_THROUGHPUT_WINDOW_SECONDS, POLL_MS);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const m = await api<Metrics>(`/monitor/shares/${id}`);
        if (!active) return;
        setCurrent(m);
        setLoading(false);
        setHistory((h) => [
          ...h.slice(-(maxStoredPoints - 1)),
          {
            t: new Date(m.timestamp).toLocaleTimeString(),
            read: Math.round(m.bytes_read_per_sec / 1024),
            write: Math.round(m.bytes_write_per_sec / 1024),
            ops: Math.round(m.ops_per_sec),
          },
        ]);
        backoff.current = 0;
      } catch {
        backoff.current = Math.min(backoff.current + 1, 5);
      }
      const delay = POLL_MS * Math.pow(2, backoff.current);
      timer = setTimeout(poll, delay);
    };

    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id, maxStoredPoints]);

  const visibleHistory = history.slice(
    -maxHistoryPoints(throughputWindowSeconds, POLL_MS)
  );
  const chartScale = useThroughputScale(visibleHistory);

  return (
    <div>
      <PageHeader
        title={`Monitor: Share ${id}`}
        description={`Live metrics, polling every ${formatInteger(POLL_MS)} ms`}
        action={
          <Link href={`/shares/${id}`} className="text-sm text-primary hover:underline">
            Back to share
          </Link>
        }
      />

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-4 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      ) : current && (
        <div className="grid gap-4 sm:grid-cols-4 mb-6">
          {[
            { label: "Read", value: formatSpeed(current.bytes_read_per_sec) },
            { label: "Write", value: formatSpeed(current.bytes_write_per_sec) },
            { label: "Ops/s", value: formatInteger(current.ops_per_sec) },
            { label: "Connections", value: formatInteger(current.active_connections) },
          ].map((m) => (
            <div key={m.label} className="rounded-lg border p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{m.label}</p>
              <p className="text-xl font-semibold font-mono mt-1">{m.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border mb-6">
        <div className="px-4 py-3 border-b flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Throughput</h2>
          <ThroughputWindowMenu
            value={throughputWindowSeconds}
            onChange={setThroughputWindowSeconds}
          />
        </div>
        <div className="flex h-64 flex-col p-4 pt-3">
          {visibleHistory.length === 0 ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <LiveThroughputLineChart
              data={visibleHistory}
              colors={colors}
              scale={chartScale}
              pollIntervalMs={POLL_MS}
            />
          )}
        </div>
      </div>

      <div className="rounded-lg border">
        <div className="px-4 py-3 border-b">
          <h2 className="text-sm font-semibold">Connected clients</h2>
        </div>
        <div className="p-4">
          {!current?.clients?.length ? (
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
                {current.clients.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{c.ip}</TableCell>
                    <TableCell className="font-mono text-xs">{c.mount}</TableCell>
                    <TableCell className="text-muted-foreground">{c.duration || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
