import { CompanyMark } from "@/components/company-mark";
import { Button } from "@/components/ui/button";
import type { JobReadModel } from "@/lib/data/job-read-model";
import type { QualificationResult } from "@/lib/domain/qualification-engine";
import {
  dateLabel,
  freshness,
  secondarySignal,
} from "@/lib/radar/presentation";
export function JobRow({
  job,
  result,
  selected,
  onSelect,
}: {
  job: JobReadModel;
  result: QualificationResult | null;
  selected: boolean;
  onSelect: () => void;
}) {
  const signal = result ? secondarySignal(result) : null;
  return (
    <li>
      <Button
        variant="ghost"
        className="job-row"
        id={`job-${job.id}`}
        aria-pressed={selected}
        aria-label={`${job.title}，${job.company}`}
        onClick={onSelect}
      >
        <span className="row-content">
          <span className="row-identity">
            <span className="row-title">{job.title}</span>
            <span className="row-company">
              <CompanyMark company={job.company} />
              {job.company}
            </span>
          </span>
          <span className="row-meta">
            <span>{job.location.join(" / ") || "地点未提供"}</span>
            <span className="row-date">收录 {dateLabel(freshness(job))}</span>
          </span>
          {signal && (
            <span
              className={`row-signal ${result?.status === "Blocked" ? "tone-blocked" : result?.status === "Check" ? "tone-check" : ""}`}
            >
              {signal}
            </span>
          )}
        </span>
        <span className="row-arrow" aria-hidden="true">
          →
        </span>
      </Button>
    </li>
  );
}
