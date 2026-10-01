import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob } from "@/lib/data/job-queries";
import { JobDetail } from "@/components/job/job-detail";
import { safeRadarReturn } from "@/lib/radar/url-state";
export const dynamic = "force-dynamic";
export default async function FullJobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const job = await getJob(id);
  if (!job) notFound();
  const query = await searchParams;
  return (
    <main className="full-job-page">
      <Link className="back-link" href={safeRadarReturn(query.returnTo)}>
        ← 返回 Radar
      </Link>
      <JobDetail job={job} full />
    </main>
  );
}
