"use client";

import { ShareEditor } from "@/components/shares/share-editor";

export function ShareDetailClient({ id }: { id: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <ShareEditor shareId={id} />
    </div>
  );
}
