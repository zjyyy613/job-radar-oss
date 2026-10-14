import Link from "next/link";
import { notFound } from "next/navigation";
import { getJob } from "@/lib/data/job-queries";
import { JobDetail } from "@/components/job/job-detail";
import { safeJobReturn } from "@/lib/radar/url-state";
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
  const returnTo = safeJobReturn(query.returnTo);
  return (
    <main className="full-job-page">
      <Link className="back-link" href={returnTo}>
        ← 返回 {returnTo.startsWith("/saved") ? "Saved" : "Radar"}
      </Link>
      <JobDetail job={job} full />
    </main>
  );
}
