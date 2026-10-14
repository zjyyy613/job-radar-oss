import { Suspense } from "react";
import { getRadarData } from "@/lib/data/job-queries";
import { SavedClient } from "@/components/saved/saved-client";
export const dynamic = "force-dynamic";
export default async function SavedPage() {
  const data = await getRadarData();
  return (
    <Suspense fallback={<p role="status">正在恢复收藏…</p>}>
      <SavedClient data={data} />
    </Suspense>
  );
}
