"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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

type GroupShare = {
  id: number;
  name: string;
  path: string;
  enabled: boolean;
  config_mode: string;
  preview_line?: string;
};

type GroupDetail = {
  id: number;
  name: string;
  description: string;
  share_count: number;
  shares: GroupShare[];
};

function formatShareCount(count: number): string {
  return count === 1 ? "1 share" : `${count} shares`;
}

export default function GroupDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const confirm = useConfirm();
  const admin = isAdmin();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    api<GroupDetail>(`/groups/${params.id}`)
      .then((data) => {
        setGroup(data);
        setError("");
      })
      .catch((err) => {
        setGroup(null);
        setError(err instanceof Error ? err.message : "Failed to load group");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [params.id]);

  async function deleteGroup() {
    if (!group) return;
    const ok = await confirm({
      title: "Delete group?",
      description: `Delete group "${group.name}"? Shares in this group will be ungrouped, not deleted.`,
      confirmLabel: "Delete",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await api(`/groups/${group.id}`, { method: "DELETE" });
      toast.success("Group deleted");
      router.push("/groups");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div>
        <PageHeader title="Group not found" description={error || "This group does not exist."} />
        <Button asChild variant="outline">
          <Link href="/groups">Back to groups</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={group.name}
        description={group.description || "No description"}
        action={
          admin ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href="/groups">Back</Link>
              </Button>
              <Button variant="destructive" onClick={deleteGroup}>
                Delete group
              </Button>
            </div>
          ) : (
            <Button variant="outline" asChild>
              <Link href="/groups">Back</Link>
            </Button>
          )
        }
      />

      <div className="mb-6">
        <Badge variant="secondary">{formatShareCount(group.share_count ?? group.shares.length)}</Badge>
      </div>

      {group.shares.length === 0 ? (
        <EmptyState
          title="No shares in this group"
          description="Assign shares to this group from the share editor."
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.shares.map((share) => (
                <TableRow key={share.id}>
                  <TableCell>
                    <Link href={`/shares/${share.id}`} className="font-medium hover:text-primary">
                      {share.name}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{share.path}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{share.config_mode}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={share.enabled ? "success" : "outline"}>
                      {share.enabled ? "Enabled" : "Disabled"}
                    </Badge>
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
