"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "@/lib/toast";
import { ArrowRight, Clipboard, ClipboardText } from "@phosphor-icons/react";
import { api, getHealth, isAdmin } from "@/lib/api";
import { useConfirm } from "@/lib/confirm";
import { shareAdvancedSchema, shareBasicSchema } from "@/lib/schemas";
import { NAME_MAX_LENGTH, SHARE_PATH_MAX_LENGTH } from "@/lib/validation";
import {
  defaultAdvanced,
  defaultBasic,
  getPortSecurity,
  getSquashMode,
  getSubtreeMode,
  getSyncMode,
  getWriteDelay,
  getXprtsec,
  setPortSecurity,
  setSquashMode,
  setSubtreeMode,
  setSyncMode,
  setWriteDelay,
  mountFieldInfo,
  shareFieldInfo,
} from "@/lib/share-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormField } from "@/components/forms/form-field";

export type ShareData = {
  id?: number;
  name: string;
  path: string;
  group_id?: number | null;
  config_mode: "form" | "raw";
  basic_json: Record<string, unknown>;
  advanced_json: Record<string, unknown>;
  raw_export?: string | null;
  enabled: boolean;
  preview_line?: string;
};

type Group = { id: number; name: string };

const emptyShare = (): ShareData => ({
  name: "",
  path: "/srv/nfs/data",
  config_mode: "form",
  basic_json: { ...defaultBasic },
  advanced_json: { ...defaultAdvanced },
  enabled: true,
});

export function ShareEditor({
  shareId,
  header,
}: {
  shareId?: string;
  header?: React.ReactNode;
}) {
  const confirm = useConfirm();
  const [tab, setTab] = useState("basic");
  const [data, setData] = useState<ShareData | null>(() =>
    !shareId || shareId === "new" ? emptyShare() : null
  );
  const [groups, setGroups] = useState<Group[]>([]);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<{ line?: number; message: string }[]>([]);
  const [preview, setPreview] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const admin = isAdmin();

  const load = useCallback(async () => {
    if (!shareId || shareId === "new") {
      setData(emptyShare());
      return;
    }
    const s = await api<ShareData>(`/shares/${shareId}`);
    setData({
      ...s,
      basic_json: { ...defaultBasic, ...(s.basic_json || {}) },
      advanced_json: { ...defaultAdvanced, ...(s.advanced_json || {}) },
    });
    setPreview(s.preview_line || "");
  }, [shareId]);

  useEffect(() => {
    api<Group[] | null>("/groups")
      .then((g) => setGroups(Array.isArray(g) ? g : []))
      .catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    if (!shareId || shareId === "new") return;
    let active = true;
    api<ShareData>(`/shares/${shareId}`)
      .then((s) => {
        if (!active) return;
        setData({
          ...s,
          basic_json: { ...defaultBasic, ...(s.basic_json || {}) },
          advanced_json: { ...defaultAdvanced, ...(s.advanced_json || {}) },
        });
        setPreview(s.preview_line || "");
      })
      .catch(() => {
        if (active) toast.error("Failed to load share");
      });
    return () => {
      active = false;
    };
  }, [shareId]);

  if (!data) {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <Skeleton className="h-10 w-full shrink-0" />
        <Skeleton className="min-h-0 flex-1 w-full" />
      </div>
    );
  }

  const setBasic = (patch: Partial<typeof defaultBasic>) => {
    setDirty(true);
    setData({ ...data, basic_json: { ...data.basic_json, ...patch } });
  };

  const setAdvanced = (patch: Partial<typeof defaultAdvanced>) => {
    setDirty(true);
    setData({ ...data, advanced_json: { ...data.advanced_json, ...patch } });
  };

  function validateClientFields(): boolean {
    if (!data) return false;

    const clientsStr = Array.isArray(data.basic_json.clients)
      ? (data.basic_json.clients as string[]).join(", ")
      : "*";

    const basicResult = shareBasicSchema.safeParse({
      name: data.name,
      path: data.path,
      enabled: data.enabled,
      group_id: data.group_id ?? null,
      clients: clientsStr,
      read_only: !!data.basic_json.read_only,
      root_squash: !!data.basic_json.root_squash,
      sync: !!data.basic_json.sync,
      security: String(data.basic_json.security || "sys"),
    });

    const advResult = shareAdvancedSchema.safeParse({
      subtree_check: !!data.advanced_json.subtree_check,
      no_subtree_check: !!data.advanced_json.no_subtree_check,
      secure_ports: !!data.advanced_json.secure_ports,
      insecure: !!data.advanced_json.insecure,
      wdelay: !!data.advanced_json.wdelay,
      no_wdelay: !!data.advanced_json.no_wdelay,
      anon_uid: Number(data.advanced_json.anon_uid) || 0,
      anon_gid: Number(data.advanced_json.anon_gid) || 0,
      crossmnt: !!data.advanced_json.crossmnt,
      nohide: !!data.advanced_json.nohide,
      mountpoint: !!data.advanced_json.mountpoint,
      mountpoint_path: String(data.advanced_json.mountpoint_path || ""),
      all_squash: !!data.advanced_json.all_squash,
      fsid: String(data.advanced_json.fsid || ""),
      refer: String(data.advanced_json.refer || ""),
      replicas: String(data.advanced_json.replicas || ""),
      insecure_locks: !!data.advanced_json.insecure_locks,
      no_auth_nlm: !!data.advanced_json.no_auth_nlm,
      public: !!data.advanced_json.public,
      webnfs: !!data.advanced_json.webnfs,
      xprtsec: getXprtsec(data.advanced_json),
      extra_options: String(data.advanced_json.extra_options || ""),
    });

    if (!basicResult.success || !advResult.success) {
      const errs: Record<string, string> = {};
      basicResult.error?.issues.forEach((i) => {
        errs[i.path[0] as string] = i.message;
      });
      advResult.error?.issues.forEach((i) => {
        errs[i.path[0] as string] = i.message;
      });
      setFieldErrors(errs);
      return false;
    }

    setFieldErrors({});
    return true;
  }

  async function save() {
    if (!validateClientFields()) {
      toast.error("Fix validation errors before saving");
      return;
    }
    try {
      const payload = { ...data, config_mode: tab === "raw" ? "raw" : ("form" as const) };
      if (shareId && shareId !== "new") {
        await api(`/shares/${shareId}`, { method: "PUT", body: JSON.stringify(payload) });
      } else {
        const created = await api<ShareData>("/shares", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Share created");
        window.location.href = `/shares/${created.id}`;
        return;
      }
      setDirty(false);
      toast.success("Saved");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function validate() {
    if (!shareId || shareId === "new") return;
    try {
      const res = await api<{ valid: boolean; errors: { line?: number; message: string }[] }>(
        `/shares/${shareId}/validate`,
        { method: "POST", body: "{}" }
      );
      setErrors(res.errors || []);
      if (res.valid) toast.success("Validation passed");
      else toast.error("Validation failed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Validation failed");
    }
  }

  async function apply() {
    if (!shareId || shareId === "new") return;
    const ok = await confirm({
      title: "Apply share to NFS exports?",
      description: "Write this share to the live exports file and reload NFS. Clients may lose or regain access immediately.",
      confirmLabel: "Apply",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await validate();
      await api(`/shares/${shareId}/apply`, { method: "POST", body: "{}" });
      toast.success("Applied to NFS exports");
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apply failed");
    }
  }

  async function fetchPreview() {
    if (!shareId || shareId === "new") return;
    try {
      const res = await api<{ preview: string }>(`/shares/${shareId}/preview`, { method: "POST", body: "{}" });
      setPreview(res.preview);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Preview failed");
    }
  }

  async function generateRaw() {
    if (!shareId || shareId === "new" || !data) return;
    try {
      const res = await api<{ raw_export: string }>(`/shares/${shareId}/generate-raw`, { method: "POST", body: "{}" });
      setData({ ...data, raw_export: res.raw_export, config_mode: "raw" });
      setTab("raw");
      setDirty(true);
      toast.success("Generated from form");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generate failed");
    }
  }

  const clientsStr = Array.isArray(data.basic_json.clients)
    ? (data.basic_json.clients as string[]).join(", ")
    : "*";

  const mountpointEnabled = !!data.advanced_json.mountpoint;

  const actionBar = admin ? (
    <div className="flex flex-wrap gap-2">
      <Button onClick={save}>{shareId === "new" ? "Create" : "Save"}</Button>
      <Button variant="outline" onClick={validate} disabled={!shareId || shareId === "new"}>
        Validate
      </Button>
      <Button variant="outline" onClick={apply} disabled={!shareId || shareId === "new"}>
        Apply
      </Button>
      {shareId && shareId !== "new" && (
        <Button variant="secondary" asChild>
          <Link href={`/shares/${shareId}/monitor`}>
            Monitor
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      )}
    </div>
  ) : (
    <Badge variant="secondary">Read-only (viewer role)</Badge>
  );

  const pageToolbar = (
    <div className="sticky top-0 z-10 space-y-3 border-b border-border/60 bg-background pb-2">
      {header}
      {actionBar}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col min-w-0 overflow-hidden">
      {dirty && (
        <div className="mb-3 shrink-0 rounded-md border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-900 dark:text-amber-100">
          Unsaved changes. Save before leaving or applying.
        </div>
      )}

      <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto">
        {pageToolbar}

        <div className="space-y-4 pt-4">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="basic">Basic config</TabsTrigger>
          <TabsTrigger value="advanced">Advanced config</TabsTrigger>
          <TabsTrigger value="raw">Raw</TabsTrigger>
        </TabsList>

        <TabsContent value="basic">
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Name" required info={shareFieldInfo.name} error={fieldErrors.name}>
                  <Input
                    value={data.name}
                    onChange={(e) => {
                      setDirty(true);
                      setData({ ...data, name: e.target.value });
                    }}
                    disabled={!admin}
                    maxLength={NAME_MAX_LENGTH}
                    aria-invalid={!!fieldErrors.name}
                  />
                </FormField>

                <FormField label="Path" required info={shareFieldInfo.path} error={fieldErrors.path}>
                  <Input
                    value={data.path}
                    onChange={(e) => {
                      setDirty(true);
                      setData({ ...data, path: e.target.value });
                      setBasic({ path: e.target.value });
                    }}
                    disabled={!admin}
                    className="font-mono"
                    maxLength={SHARE_PATH_MAX_LENGTH}
                    aria-invalid={!!fieldErrors.path}
                  />
                </FormField>

                <FormField label="Enabled" info={shareFieldInfo.enabled}>
                  <Switch
                    checked={data.enabled}
                    onCheckedChange={async (checked) => {
                      if (!checked && data.enabled) {
                        const ok = await confirm({
                          title: "Disable this share?",
                          description: `Disable "${data.name || "this share"}"? Save and apply for the change to take effect on the NFS server.`,
                          confirmLabel: "Disable",
                          variant: "destructive",
                        });
                        if (!ok) return;
                      }
                      setDirty(true);
                      setData({ ...data, enabled: checked });
                    }}
                    disabled={!admin}
                  />
                </FormField>

                <FormField label="Group" info={shareFieldInfo.group_id} error={fieldErrors.group_id}>
                  <Select
                    value={data.group_id != null ? String(data.group_id) : "none"}
                    onValueChange={(v) => {
                      setDirty(true);
                      setData({ ...data, group_id: v === "none" ? null : Number(v) });
                    }}
                    disabled={!admin}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>

              <FormField label="Clients" required info={shareFieldInfo.clients} error={fieldErrors.clients}>
                <Input
                  value={clientsStr}
                  onChange={(e) => setBasic({ clients: e.target.value.split(",").map((s) => s.trim()) })}
                  disabled={!admin}
                  aria-invalid={!!fieldErrors.clients}
                />
              </FormField>

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Access mode" info={shareFieldInfo.read_only} error={fieldErrors.read_only}>
                  <Select
                    value={data.basic_json.read_only ? "ro" : "rw"}
                    onValueChange={(v) => setBasic({ read_only: v === "ro" })}
                    disabled={!admin}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rw">Read-write</SelectItem>
                      <SelectItem value="ro">Read-only</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Squash mode" info={shareFieldInfo.squash_mode}>
                  <Select
                    value={getSquashMode(data.basic_json, data.advanced_json)}
                    onValueChange={(v) => {
                      const parsed = setSquashMode(v as ReturnType<typeof getSquashMode>);
                      setBasic(parsed.basic);
                      setAdvanced(parsed.advanced);
                    }}
                    disabled={!admin}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="root_squash">Root squash</SelectItem>
                      <SelectItem value="no_root_squash">No root squash</SelectItem>
                      <SelectItem value="all_squash">All squash</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Sync mode" info={shareFieldInfo.sync_mode}>
                  <Select
                    value={getSyncMode(data.basic_json)}
                    onValueChange={(v) => setBasic(setSyncMode(v as ReturnType<typeof getSyncMode>))}
                    disabled={!admin}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sync">Sync</SelectItem>
                      <SelectItem value="async">Async</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Security" info={shareFieldInfo.security} error={fieldErrors.security}>
                  <Select
                    value={String(data.basic_json.security || "sys")}
                    onValueChange={(v) => setBasic({ security: v })}
                    disabled={!admin}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sys">sys</SelectItem>
                      <SelectItem value="krb5">krb5</SelectItem>
                      <SelectItem value="krb5i">krb5i</SelectItem>
                      <SelectItem value="krb5p">krb5p</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced">
          <Card>
            <CardContent className="pt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Subtree mode" info={shareFieldInfo.subtree_mode}>
                  <Select
                    value={getSubtreeMode(data.advanced_json)}
                    onValueChange={(v) => setAdvanced(setSubtreeMode(v as ReturnType<typeof getSubtreeMode>))}
                    disabled={!admin}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default (omit)</SelectItem>
                      <SelectItem value="subtree_check">Subtree check</SelectItem>
                      <SelectItem value="no_subtree_check">No subtree check</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Port security" info={shareFieldInfo.port_security}>
                  <Select
                    value={getPortSecurity(data.advanced_json)}
                    onValueChange={(v) => setAdvanced(setPortSecurity(v as ReturnType<typeof getPortSecurity>))}
                    disabled={!admin}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="secure">Secure</SelectItem>
                      <SelectItem value="insecure">Insecure</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Write delay" info={shareFieldInfo.write_delay}>
                  <Select
                    value={getWriteDelay(data.advanced_json)}
                    onValueChange={(v) => setAdvanced(setWriteDelay(v as ReturnType<typeof getWriteDelay>))}
                    disabled={!admin}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default (omit)</SelectItem>
                      <SelectItem value="wdelay">wdelay</SelectItem>
                      <SelectItem value="no_wdelay">no_wdelay</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Cross mount" info={shareFieldInfo.crossmnt}>
                  <Switch
                    checked={!!data.advanced_json.crossmnt}
                    onCheckedChange={(checked) => setAdvanced({ crossmnt: checked })}
                    disabled={!admin}
                  />
                </FormField>

                <FormField label="No hide" info={shareFieldInfo.nohide}>
                  <Switch
                    checked={!!data.advanced_json.nohide}
                    onCheckedChange={(checked) => setAdvanced({ nohide: checked })}
                    disabled={!admin}
                  />
                </FormField>

                <FormField label="Mountpoint" info={shareFieldInfo.mountpoint}>
                  <Switch
                    checked={mountpointEnabled}
                    onCheckedChange={(checked) =>
                      setAdvanced({
                        mountpoint: checked,
                        mountpoint_path: checked ? String(data.advanced_json.mountpoint_path || "") : "",
                      })
                    }
                    disabled={!admin}
                  />
                </FormField>

                {mountpointEnabled && (
                  <FormField label="Mountpoint path" info={shareFieldInfo.mountpoint_path} error={fieldErrors.mountpoint_path}>
                    <Input
                      value={String(data.advanced_json.mountpoint_path || "")}
                      onChange={(e) => setAdvanced({ mountpoint_path: e.target.value })}
                      disabled={!admin}
                      className="font-mono"
                    />
                  </FormField>
                )}

                <FormField label="Anon UID" info={shareFieldInfo.anon_uid} error={fieldErrors.anon_uid}>
                  <Input
                    type="number"
                    min={0}
                    value={String(Number(data.advanced_json.anon_uid) || 0)}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      setAdvanced({ anon_uid: raw === "" ? 0 : Number.parseInt(raw, 10) || 0 });
                    }}
                    disabled={!admin}
                  />
                </FormField>

                <FormField label="Anon GID" info={shareFieldInfo.anon_gid} error={fieldErrors.anon_gid}>
                  <Input
                    type="number"
                    min={0}
                    value={String(Number(data.advanced_json.anon_gid) || 0)}
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      setAdvanced({ anon_gid: raw === "" ? 0 : Number.parseInt(raw, 10) || 0 });
                    }}
                    disabled={!admin}
                  />
                </FormField>

                <FormField label="FSID" info={shareFieldInfo.fsid} error={fieldErrors.fsid}>
                  <Input
                    value={String(data.advanced_json.fsid || "")}
                    onChange={(e) => setAdvanced({ fsid: e.target.value })}
                    disabled={!admin}
                    className="font-mono"
                  />
                </FormField>

                <FormField label="Refer" info={shareFieldInfo.refer} error={fieldErrors.refer}>
                  <Input
                    value={String(data.advanced_json.refer || "")}
                    onChange={(e) => setAdvanced({ refer: e.target.value })}
                    disabled={!admin}
                    className="font-mono"
                  />
                </FormField>

                <FormField label="Replicas" info={shareFieldInfo.replicas} error={fieldErrors.replicas}>
                  <Input
                    value={String(data.advanced_json.replicas || "")}
                    onChange={(e) => setAdvanced({ replicas: e.target.value })}
                    disabled={!admin}
                    className="font-mono"
                  />
                </FormField>

                <FormField label="Insecure locks" info={shareFieldInfo.insecure_locks}>
                  <Switch
                    checked={!!data.advanced_json.insecure_locks}
                    onCheckedChange={(checked) => setAdvanced({ insecure_locks: checked })}
                    disabled={!admin}
                  />
                </FormField>

                <FormField label="No auth NLM" info={shareFieldInfo.no_auth_nlm}>
                  <Switch
                    checked={!!data.advanced_json.no_auth_nlm}
                    onCheckedChange={(checked) => setAdvanced({ no_auth_nlm: checked })}
                    disabled={!admin}
                  />
                </FormField>

                <FormField label="Public" info={shareFieldInfo.public}>
                  <Switch
                    checked={!!data.advanced_json.public}
                    onCheckedChange={(checked) => setAdvanced({ public: checked })}
                    disabled={!admin}
                  />
                </FormField>

                <FormField label="WebNFS" info={shareFieldInfo.webnfs}>
                  <Switch
                    checked={!!data.advanced_json.webnfs}
                    onCheckedChange={(checked) => setAdvanced({ webnfs: checked })}
                    disabled={!admin}
                  />
                </FormField>

                <FormField label="Transport security" info={shareFieldInfo.xprtsec} error={fieldErrors.xprtsec}>
                  <Select
                    value={getXprtsec(data.advanced_json) || "none"}
                    onValueChange={(v) => setAdvanced({ xprtsec: v === "none" ? "" : v })}
                    disabled={!admin}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (omit)</SelectItem>
                      <SelectItem value="tls">tls</SelectItem>
                      <SelectItem value="mtls">mtls</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              </div>

              <FormField label="Extra options" info={shareFieldInfo.extra_options} error={fieldErrors.extra_options}>
                <Textarea
                  value={String(data.advanced_json.extra_options || "")}
                  onChange={(e) => setAdvanced({ extra_options: e.target.value })}
                  disabled={!admin}
                  className="font-mono min-h-[80px]"
                  spellCheck={false}
                />
              </FormField>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="raw">
          <Card>
            <CardContent className="pt-5 space-y-3">
              {admin && (
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={generateRaw}>
                    From form
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(data.raw_export || "");
                      toast.success("Copied");
                    }}
                  >
                    <Clipboard className="h-4 w-4" />
                    Copy
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const t = await navigator.clipboard.readText();
                      setData({ ...data, raw_export: t, config_mode: "raw" });
                      setDirty(true);
                    }}
                  >
                    <ClipboardText className="h-4 w-4" />
                    Paste
                  </Button>
                </div>
              )}
              <Textarea
                className="min-h-[200px]"
                value={data.raw_export || ""}
                onChange={(e) => {
                  setDirty(true);
                  setData({ ...data, raw_export: e.target.value, config_mode: "raw" });
                }}
                disabled={!admin}
                spellCheck={false}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Preview line</CardTitle>
          <Button variant="outline" size="sm" onClick={fetchPreview}>
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <pre className="font-mono text-sm bg-muted/50 p-3 rounded-md overflow-x-auto">
            {preview || <span className="text-muted-foreground">No preview yet</span>}
          </pre>
        </CardContent>
      </Card>

      {shareId && shareId !== "new" && (
        <MountConfigGenerator shareId={shareId} exportPath={data?.path || ""} />
      )}

      {errors.length > 0 && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">Validation errors</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-destructive space-y-1">
              {errors.map((e, i) => (
                <li key={i}>
                  {e.line ? `Line ${e.line}: ` : ""}
                  {e.message}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

        </div>
      </div>
    </div>
  );
}

type MountConfigResult = {
  mount_command: string;
  fstab_line: string;
  options_string: string;
};

const NFS_MOUNT_VERSIONS = ["3", "4", "4.0", "4.1", "4.2"] as const;
const DEFAULT_NFS_VERSION = NFS_MOUNT_VERSIONS[NFS_MOUNT_VERSIONS.length - 1];
const DEFAULT_MOUNT_RW_SIZE = 1048576;

function parseMountSize(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : DEFAULT_MOUNT_RW_SIZE;
}

function MountConfigGenerator({ shareId, exportPath }: { shareId: string; exportPath: string }) {
  const [server, setServer] = useState("");
  const [serverLoading, setServerLoading] = useState(true);
  const [serverError, setServerError] = useState("");
  const [mountPoint, setMountPoint] = useState("/mnt/nfs/data");
  const [version, setVersion] = useState(DEFAULT_NFS_VERSION);
  const [rsize, setRsize] = useState(String(DEFAULT_MOUNT_RW_SIZE));
  const [wsize, setWsize] = useState(String(DEFAULT_MOUNT_RW_SIZE));
  const [timeo, setTimeo] = useState("600");
  const [retrans, setRetrans] = useState("2");
  const [hard, setHard] = useState(true);
  const [intr, setIntr] = useState(false);
  const [nconnect, setNconnect] = useState("4");
  const [noatime, setNoatime] = useState(true);
  const [extraOptions, setExtraOptions] = useState("");
  const [result, setResult] = useState<MountConfigResult | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    let active = true;
    getHealth()
      .then((health) => {
        if (!active) return;
        const host = health.nfs_server?.trim() ?? "";
        setServer(host);
        if (!host) {
          setServerError(
            "NFS server host is not configured. Set NFS_SERVER_HOST in the API server .env and restart."
          );
        }
      })
      .catch(() => {
        if (!active) return;
        setServer("");
        setServerError("Could not load NFS server host from the API server.");
      })
      .finally(() => {
        if (active) setServerLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const generate = async () => {
    if (!server.trim()) {
      toast.error(serverError || "NFS server host is not configured.");
      return;
    }
    setGenerating(true);
    try {
      const body: Record<string, unknown> = {
        server,
        mount_point: mountPoint,
        version,
        rsize: parseMountSize(rsize),
        wsize: parseMountSize(wsize),
        timeo: Number(timeo) || 0,
        retrans: Number(retrans) || 0,
        hard,
        intr,
        nconnect: Number(nconnect) || 0,
        noatime,
        nfsvers: version,
        extra_options: extraOptions,
      };
      const res = await api<MountConfigResult>(`/shares/${shareId}/generate-mount`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setResult(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to generate mount config");
    } finally {
      setGenerating(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate mount config</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="NFS server" required info={mountFieldInfo.server} error={serverError}>
            {serverLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Input value={server} disabled readOnly aria-readonly className="font-mono" />
            )}
          </FormField>
          <FormField label="Local mount point" required info={mountFieldInfo.mount_point}>
            <Input value={mountPoint} onChange={(e) => setMountPoint(e.target.value)} placeholder="/mnt/nfs/data" />
          </FormField>
          <FormField label="NFS version" info={mountFieldInfo.version}>
            <Select value={version} onValueChange={setVersion}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NFS_MOUNT_VERSIONS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="rsize" info={mountFieldInfo.rsize}>
            <Input type="number" min={0} value={rsize} onChange={(e) => setRsize(e.target.value)} />
          </FormField>
          <FormField label="wsize" info={mountFieldInfo.wsize}>
            <Input type="number" min={0} value={wsize} onChange={(e) => setWsize(e.target.value)} />
          </FormField>
          <FormField label="timeo" info={mountFieldInfo.timeo}>
            <Input type="number" value={timeo} onChange={(e) => setTimeo(e.target.value)} />
          </FormField>
          <FormField label="retrans" info={mountFieldInfo.retrans}>
            <Input type="number" value={retrans} onChange={(e) => setRetrans(e.target.value)} />
          </FormField>
          <FormField label="nconnect" info={mountFieldInfo.nconnect}>
            <Input type="number" value={nconnect} onChange={(e) => setNconnect(e.target.value)} />
          </FormField>
          <FormField label="Hard mount" info={mountFieldInfo.hard}>
            <Switch checked={hard} onCheckedChange={setHard} />
          </FormField>
          <FormField label="Allow interrupt (intr)" info={mountFieldInfo.intr}>
            <Switch checked={intr} onCheckedChange={setIntr} />
          </FormField>
          <FormField label="noatime" info={mountFieldInfo.noatime}>
            <Switch checked={noatime} onCheckedChange={setNoatime} />
          </FormField>
        </div>
        <FormField label="Extra options" info={mountFieldInfo.extra_options}>
          <Input
            value={extraOptions}
            onChange={(e) => setExtraOptions(e.target.value)}
            placeholder="comma-separated mount options"
            className="font-mono"
          />
        </FormField>
        <p className="text-xs text-muted-foreground font-mono">Remote export: {exportPath || "—"}</p>
        <Button onClick={generate} disabled={generating || serverLoading || !server.trim()}>
          Generate
        </Button>
        {result && (
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Mount command</span>
                <Button variant="outline" size="sm" onClick={() => copy(result.mount_command)}>
                  <Clipboard className="h-4 w-4" />
                  Copy
                </Button>
              </div>
              <pre className="font-mono text-xs bg-muted/50 p-3 rounded-md overflow-x-auto">{result.mount_command}</pre>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">fstab line</span>
                <Button variant="outline" size="sm" onClick={() => copy(result.fstab_line)}>
                  <Clipboard className="h-4 w-4" />
                  Copy
                </Button>
              </div>
              <pre className="font-mono text-xs bg-muted/50 p-3 rounded-md overflow-x-auto">{result.fstab_line}</pre>
            </div>
            <div className="space-y-1">
              <span className="text-sm font-medium">Options</span>
              <pre className="font-mono text-xs bg-muted/50 p-3 rounded-md overflow-x-auto">{result.options_string}</pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
