import type { JobReadModel } from "@/lib/data/job-read-model";
import { safeExternalUrl } from "@/lib/data/job-read-model";
import { dateLabel } from "@/lib/radar/presentation";
export function SourceMeta({ job }: { job: JobReadModel }) {
  return (
    <footer className="source-meta">
      <h2>来源与更新</h2>
      <p>
        招聘状态：
        {
          { open: "开放申请", closed: "已关闭", unknown: "状态未明" }[
            job.application_status
          ]
        }
      </p>
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
              最后获取 {dateLabel(source.fetched_at)} · 最后确认收录{" "}
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
      <p>收录时间不代表岗位仍在招聘；申请前请核对原始来源。</p>
    </footer>
  );
}
