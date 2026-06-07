"use client";

import { useEffect, useState } from "react";
import { Clipboard } from "@phosphor-icons/react";
import { toast } from "@/lib/toast";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Template = {
  id: number;
  name: string;
  description: string;
  category: string;
  raw_export?: string;
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[] | null>(null);

  useEffect(() => {
    api<Template[] | null>("/templates")
      .then((data) => setTemplates(Array.isArray(data) ? data : []))
      .catch(() => setTemplates([]));
  }, []);

  return (
    <div>
      <PageHeader
        title="Export Templates"
        description="Pre-built export lines to apply when creating or editing shares"
      />

      {templates === null ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState title="No templates" description="Templates will appear here once configured on the server." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className="rounded-lg border p-4 flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-medium">{t.name}</p>
                <Badge variant="secondary">{t.category}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3 flex-1">{t.description}</p>
              {t.raw_export && (
                <pre className="text-xs font-mono bg-muted/50 p-2 rounded-md overflow-x-auto mb-3">{t.raw_export}</pre>
              )}
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                onClick={() => {
                  navigator.clipboard.writeText(t.raw_export || "");
                  toast.success("Copied to clipboard");
                }}
              >
                <Clipboard className="h-4 w-4" />
                Copy raw line
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
