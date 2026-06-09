"use client";

import { ShareEditor } from "@/components/shares/share-editor";

export function ShareDetailClient({ id }: { id: string }) {
  return <ShareEditor shareId={id} />;
}
