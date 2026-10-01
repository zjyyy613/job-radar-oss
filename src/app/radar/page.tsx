import { Suspense } from "react";
import { getRadarData } from "@/lib/data/job-queries";
import { RadarClient } from "@/components/radar/radar-client";
export const dynamic = "force-dynamic";
export default async function RadarPage() {
  const data = await getRadarData();
  return (
    <Suspense fallback={<p role="status">正在恢复浏览状态…</p>}>
      <RadarClient data={data} />
    </Suspense>
  );
}
