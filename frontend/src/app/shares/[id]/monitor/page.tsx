import { ShareMonitorClient } from "./share-monitor-client";

export default async function ShareMonitorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ShareMonitorClient id={id} />;
}
