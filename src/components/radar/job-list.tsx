import type { selectJobs } from "@/lib/radar/presentation";
import { JobRow } from "./job-row";
export function JobList({
  rows,
  selected,
  loaded,
  onSelect,
}: {
  rows: ReturnType<typeof selectJobs>;
  selected: string;
  loaded: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="job-list" aria-label="岗位列表">
      {rows.map(({ job, result }) => (
        <JobRow
          key={job.id}
          job={job}
          result={loaded ? result : null}
          selected={selected === job.id}
          onSelect={() => onSelect(job.id)}
        />
      ))}
    </ul>
  );
}
