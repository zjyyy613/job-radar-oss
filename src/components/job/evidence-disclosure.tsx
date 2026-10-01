import type { JobReadModel } from "@/lib/data/job-read-model";
import type { GateEvidence } from "@/lib/domain/gate";
import { groundedEvidence } from "@/lib/radar/presentation";
export function EvidenceDisclosure({
  job,
  evidence,
}: {
  job: JobReadModel;
  evidence: GateEvidence;
}) {
  const data = groundedEvidence(job, evidence);
  if (!data)
    return <p className="muted">原文证据暂不可核对，请查看完整 JD。</p>;
  return (
    <details className="evidence">
      <summary>查看原文证据</summary>
      <blockquote>{data.quote}</blockquote>
      <details className="context">
        <summary>查看上下文</summary>
        <p className="raw-text">{data.context}</p>
      </details>
    </details>
  );
}
