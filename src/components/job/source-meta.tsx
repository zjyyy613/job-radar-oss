import type { JobReadModel } from "@/lib/data/job-read-model";
import { safeExternalUrl } from "@/lib/data/job-read-model";
import { dateLabel, APPLICATION_LABELS } from "@/lib/radar/presentation";
export function SourceMeta({ job }: { job: JobReadModel }) {
  return (
    <footer className="source-meta">
      <h2>来源与更新</h2>
      <p>
        招聘状态：
        {APPLICATION_LABELS[job.application_status]}
      </p>
      <p>来源标注发布：{dateLabel(job.published_at)}</p>
      {job.sources.length ? (
        job.sources.map((source) => (
          <div key={source.id}>
            <p>
              {source.source} ·{" "}
              {source.source_tier === "authoritative"
                ? "官方来源"
                : source.source_tier === "trusted_aggregator"
                  ? "可信聚合来源"
                  : "发现来源"}
            </p>
            <p>
              最近获取 {dateLabel(source.fetched_at)} · 最近观察到{" "}
              {dateLabel(source.last_seen_at)}
            </p>
            {safeExternalUrl(source.source_url) && (
              <a
                href={safeExternalUrl(source.source_url)!}
                target="_blank"
                rel="noopener noreferrer"
              >
                查看原始来源 ↗
              </a>
            )}
          </div>
        ))
      ) : (
        <p>来源详情暂不可用。</p>
      )}
      <p>获取与观察时间不是发布时间，也不代表已核实当前开放；申请前请核对原始来源。</p>
    </footer>
  );
}
