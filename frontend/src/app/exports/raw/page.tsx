"use client";

import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { Clipboard, ClipboardText } from "@phosphor-icons/react";
import { api } from "@/lib/api";
import { useConfirm } from "@/lib/confirm";
import { rawExportSchema } from "@/lib/schemas";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function RawExportsPage() {
  const confirm = useConfirm();
  const [content, setContent] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<{ line?: number; message: string }[]>([]);

  useEffect(() => {
    api<{ content: string }>("/exports/raw")
      .then((r) => setContent(r.content))
      .catch(() => {
        setContent("");
        toast.error("Failed to load exports");
      });
  }, []);

  async function save() {
    if (content === null) return;
    const check = rawExportSchema.safeParse({ content });
    if (!check.success) {
      toast.error(check.error.issues[0]?.message || "Invalid content");
      return;
    }
    try {
      await api("/exports/raw", { method: "PUT", body: JSON.stringify({ content }) });
      setDirty(false);
      toast.success("Saved (not applied)");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function validate() {
    if (content === null) return;
    try {
      const res = await api<{ valid: boolean; errors: { line?: number; message: string }[] }>(
        "/exports/validate",
        { method: "POST", body: JSON.stringify({ content }) }
      );
      setErrors(res.errors || []);
      if (res.valid) toast.success("Valid");
      else toast.error("Invalid exports file");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Validation failed");
    }
  }

  async function apply() {
    const ok = await confirm({
      title: "Apply exports to NFS server?",
      description: "Write the exports file and reload NFS. This affects live client access immediately.",
      confirmLabel: "Apply",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await validate();
      await api("/exports/apply", { method: "POST", body: "{}" });
      toast.success("Applied and reloaded");
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apply failed");
    }
  }

  async function syncOS() {
    try {
      const res = await api<{ content: string }>("/exports/sync-os", { method: "POST", body: "{}" });
      const ok = await confirm({
        title: "Replace editor content?",
        description: "Discard unsaved changes and load the current exports file from the NFS server.",
        confirmLabel: "Replace",
        variant: "destructive",
      });
      if (ok) {
        setContent(res.content);
        setDirty(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    }
  }

  return (
    <div>
      <PageHeader
        title="Global Raw Exports"
        description="Edit /etc/exports directly. Validate before applying."
      />

      {dirty && (
        <div className="rounded-md bg-amber-500/15 border border-amber-500/40 px-4 py-2 text-sm text-amber-900 dark:text-amber-100 mb-4">
          Unsaved changes
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(content || ""); toast.success("Copied"); }}>
          <Clipboard className="h-4 w-4" /> Copy
        </Button>
        <Button variant="outline" size="sm" onClick={async () => {
          const t = await navigator.clipboard.readText();
          setContent(t);
          setDirty(true);
        }}>
          <ClipboardText className="h-4 w-4" /> Paste
        </Button>
        <Button variant="outline" size="sm" onClick={syncOS}>Sync from OS</Button>
        <Button variant="outline" size="sm" onClick={validate}>Validate</Button>
        <Button variant="outline" size="sm" onClick={save}>Save</Button>
        <Button size="sm" onClick={apply}>Apply</Button>
      </div>

      {content === null ? (
        <Skeleton className="h-[400px] w-full rounded-lg" />
      ) : (
        <Textarea
          className="min-h-[400px] text-sm"
          value={content}
          onChange={(e) => { setContent(e.target.value); setDirty(true); }}
          spellCheck={false}
        />
      )}

      {errors.length > 0 && (
        <Card className="mt-4 border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive text-sm">Validation errors</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-destructive space-y-1">
              {errors.map((e, i) => (
                <li key={i}>{e.line ? `L${e.line}: ` : ""}{e.message}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
