import { ShareDetailClient } from "./share-detail-client";

export default async function ShareDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ShareDetailClient id={id} />;
}
