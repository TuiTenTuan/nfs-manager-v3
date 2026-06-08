"use client";

import { useRef, useState } from "react";
import { DownloadSimple, UploadSimple } from "@phosphor-icons/react";
import { toast } from "@/lib/toast";
import { api, isAdmin } from "@/lib/api";
import { getApiBase } from "@/lib/runtime-config";
import { useConfirm } from "@/lib/confirm";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type ItemSummary = { total: number; create: number; update: number; unchanged: number };

type ImportSummary = {
  valid: boolean;
  groups: ItemSummary;
  shares: ItemSummary;
  templates: ItemSummary;
  warnings?: string[];
  errors?: string[];
};

export default function ExportImportPage() {
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [payload, setPayload] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const admin = isAdmin();

  async function exportConfig() {
    setBusy(true);
    try {
      const token = localStorage.getItem("access_token");
      const res = await fetch(`${getApiBase()}/configuration/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nfs-manager-config-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Configuration exported");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function onFileSelected(file: File) {
    setBusy(true);
    setSummary(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text) as Record<string, unknown>;
      setPayload(data);
      const res = await api<ImportSummary>("/configuration/import/validate", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setSummary(res);
      if (!res.valid) toast.error("Import file has validation errors");
      else toast.success("Import file validated — review summary below");
    } catch (err) {
      setPayload(null);
      toast.error(err instanceof Error ? err.message : "Invalid configuration file");
    } finally {
      setBusy(false);
    }
  }

  async function applyImport() {
    if (!payload || !summary?.valid) return;
    const ok = await confirm({
      title: "Import configuration?",
      description: "This will create or update groups, shares, and templates, then rebuild NFS exports.",
      confirmLabel: "Import",
      variant: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api("/configuration/import", { method: "POST", body: JSON.stringify(payload) });
      toast.success("Configuration imported");
      setSummary(null);
      setPayload(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  if (!admin) {
    return (
      <div>
        <PageHeader title="Export / Import Configuration" description="Admin only" />
        <p className="text-sm text-muted-foreground">You need admin role to export or import configuration.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Export / Import Configuration"
        description="Backup or migrate share groups, shares, templates, and export settings between instances."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Download a JSON snapshot of groups, shares, templates, and export options.
            </p>
            <Button onClick={exportConfig} disabled={busy}>
              <DownloadSimple className="h-4 w-4" />
              Download configuration
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Upload a configuration JSON from another instance. Review the summary before confirming.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onFileSelected(file);
              }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
              <UploadSimple className="h-4 w-4" />
              Choose file
            </Button>
          </CardContent>
        </Card>
      </div>

      {summary && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Import preview</CardTitle>
            <Badge variant={summary.valid ? "secondary" : "destructive"}>
              {summary.valid ? "Ready" : "Invalid"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3 text-sm">
              {(["groups", "shares", "templates"] as const).map((key) => (
                <div key={key} className="rounded border p-3">
                  <p className="font-medium capitalize">{key}</p>
                  <p className="text-muted-foreground">
                    {summary[key].create} create · {summary[key].update} update · {summary[key].unchanged} unchanged
                  </p>
                </div>
              ))}
            </div>
            {summary.warnings && summary.warnings.length > 0 && (
              <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                {summary.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            {summary.errors && summary.errors.length > 0 && (
              <ul className="text-sm text-destructive space-y-1">
                {summary.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <Button onClick={applyImport} disabled={!summary.valid || busy}>
              Confirm import
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
