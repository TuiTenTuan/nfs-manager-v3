"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "@/lib/toast";
import { api, isAdmin } from "@/lib/api";
import { useConfirm } from "@/lib/confirm";
import { groupSchema, type GroupForm } from "@/lib/schemas";
import { NAME_MAX_LENGTH } from "@/lib/validation";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/forms/form-field";
import { FormActions } from "@/components/forms/form-actions";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Group = { id: number; name: string; description: string; share_count: number };

function formatShareCount(count: number): string {
  return count === 1 ? "1 share" : `${count} shares`;
}

export default function GroupsPage() {
  const confirm = useConfirm();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const admin = isAdmin();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GroupForm>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: "", description: "" },
  });

  const load = () =>
    api<Group[] | null>("/groups")
      .then((data) => setGroups(Array.isArray(data) ? data : []))
      .catch(() => setGroups([]));

  useEffect(() => { load(); }, []);

  async function onCreate(data: GroupForm) {
    try {
      await api("/groups", { method: "POST", body: JSON.stringify(data) });
      reset();
      toast.success("Group created");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    }
  }

  return (
    <div>
      <PageHeader title="Share Groups" description="Organize shares and apply bulk enable/disable" />

      {admin && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>New group</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onCreate)} className="form-stack">
              <div className="form-row-2">
                <FormField label="Name" required error={errors.name?.message}>
                  <Input aria-invalid={!!errors.name} maxLength={NAME_MAX_LENGTH} {...register("name")} />
                </FormField>
                <FormField label="Description" error={errors.description?.message}>
                  <Input aria-invalid={!!errors.description} {...register("description")} />
                </FormField>
              </div>
              <FormActions>
                <Button type="submit" disabled={isSubmitting}>
                  Create
                </Button>
              </FormActions>
            </form>
          </CardContent>
        </Card>
      )}

      {groups === null ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState title="No groups" description="Create a group to organize related NFS shares." />
      ) : (
        <div className="divide-y divide-border rounded-lg border">
          {groups.map((g) => (
            <div key={g.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{g.name}</p>
                  <Badge variant="secondary">{formatShareCount(g.share_count ?? 0)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{g.description || "No description"}</p>
              </div>
              {admin && (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Enable all shares?",
                        description: `Enable every share in group "${g.name}"? Clients will regain access to these exports.`,
                        confirmLabel: "Enable all",
                      });
                      if (!ok) return;
                      api(`/groups/${g.id}/bulk-enable`, { method: "POST", body: "{}" })
                        .then(() => { toast.success("All shares enabled"); load(); })
                        .catch((e) => toast.error(e.message));
                    }}
                  >
                    Enable all
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Disable all shares?",
                        description: `Disable every share in group "${g.name}"? Clients will lose access to these exports.`,
                        confirmLabel: "Disable all",
                        variant: "destructive",
                      });
                      if (!ok) return;
                      api(`/groups/${g.id}/bulk-disable`, { method: "POST", body: "{}" })
                        .then(() => { toast.success("All shares disabled"); load(); })
                        .catch((e) => toast.error(e.message));
                    }}
                  >
                    Disable all
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
