"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ArrowsClockwise } from "@phosphor-icons/react";
import { toast } from "@/lib/toast";
import { api, isAdmin } from "@/lib/api";
import { useConfirm } from "@/lib/confirm";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Share = { id: number; name: string; path: string; enabled: boolean; config_mode: string; preview_line?: string };

type SyncResult = { added: number; updated: number; deleted: number; skipped: number; unchanged: number };

export default function SharesPage() {
  const confirm = useConfirm();
  const [shares, setShares] = useState<Share[] | null>(null);
  const [syncing, setSyncing] = useState(false);

  const loadShares = () => {
    api<Share[] | null>("/shares")
      .then((data) => setShares(Array.isArray(data) ? data : []))
      .catch(() => setShares([]));
  };

  useEffect(() => {
    loadShares();
  }, []);

  const syncFromOS = async () => {
    const ok = await confirm({
      title: "Sync shares from NFS server?",
      description:
        "Import and update shares from OS exports. Shares in the database that are not present in OS exports will be permanently deleted.",
      confirmLabel: "Sync",
      variant: "destructive",
    });
    if (!ok) return;
    setSyncing(true);
    try {
      const result = await api<SyncResult>("/shares/sync-from-os", { method: "POST" });
      toast.success(
        `Sync complete: ${result.added} added, ${result.updated} updated, ${result.deleted} deleted`
      );
      loadShares();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="NFS Shares"
        description="Manage export definitions and monitor throughput"
        action={
          isAdmin() ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={syncFromOS} disabled={syncing}>
                <ArrowsClockwise className="h-4 w-4" />
                Sync from NFS
              </Button>
              <Button asChild>
                <Link href="/shares/new">
                  <Plus className="h-4 w-4" />
                  New share
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      />

      {shares === null ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : shares.length === 0 ? (
        <EmptyState
          title="No shares configured"
          description="Create an NFS share to define export paths, client access, and options."
          action={
            isAdmin() ? (
              <Button asChild>
                <Link href="/shares/new">Create first share</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shares.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link href={`/shares/${s.id}`} className="font-medium hover:text-primary">
                      {s.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{s.path}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{s.config_mode}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.enabled ? "success" : "outline"}>
                      {s.enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/shares/${s.id}/monitor`} className="text-sm text-primary hover:underline">
                      Monitor
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
