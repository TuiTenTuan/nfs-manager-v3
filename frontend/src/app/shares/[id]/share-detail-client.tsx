"use client";

import { ShareEditor } from "@/components/shares/share-editor";
import { PageHeader } from "@/components/layout/page-header";

export function ShareDetailClient({ id }: { id: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ShareEditor
        shareId={id}
        header={
          <PageHeader
            className="mb-0"
            title={id === "new" ? "New share" : `Share #${id}`}
            description={id === "new" ? "Define a new NFS export" : "Edit export configuration"}
          />
        }
      />
    </div>
  );
}
