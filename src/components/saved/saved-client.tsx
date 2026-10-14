"use client";
import Link from "next/link";
import { useQueryStates } from "nuqs";
import { savedJobs, useSavedJobs } from "@/lib/saved/use-saved";
import { useLocalProfile } from "@/lib/profile/use-local-profile";
import { emptyGuestProfile } from "@/lib/profile/local-profile";
import { evaluateQualification } from "@/lib/domain/qualification-engine";
import type { RadarData } from "@/lib/data/job-read-model";
import { radarParsers } from "@/lib/radar/url-state";
import { Button } from "@/components/ui/button";
import { JobRow } from "@/components/radar/job-row";
import { DetailPeek } from "@/components/radar/detail-peek";
import { JobDetail } from "@/components/job/job-detail";

export function SavedClient({ data }: { data: RadarData }) {
  const saved = useSavedJobs();
  const profile = useLocalProfile();
  const [state, setState] = useQueryStates(
    { job: radarParsers.job },
    { history: "push", shallow: true },
  );
  const byId = new Map(data.jobs.map((job) => [job.id, job]));
  const selected = byId.get(state.job);
  const list = !saved.loaded ? (
    <p role="status">正在读取本地收藏…</p>
  ) : !saved.entries.length ? (
    <div className="empty-state">
      <h2>{saved.error ? "收藏暂不可读取" : "还没有收藏岗位"}</h2>
      <p>在 Radar 或岗位详情点击星标，稍后可在此继续查看。</p>
      <Link href="/radar">浏览岗位 →</Link>
    </div>
  ) : (
    <div className="list-surface">
      <p className="result-line" role="status">
        {saved.entries.length} 个收藏 · 最近收藏优先
      </p>
      <ul className="job-list" aria-label="收藏岗位列表">
        {saved.entries.map((entry) => {
          const job = byId.get(entry.job_id);
          return job ? (
            <JobRow
              key={entry.job_id}
              job={job}
              selected={job.id === state.job}
              result={
                profile.loaded
                  ? evaluateQualification(
                      profile.data?.qualification ??
                        emptyGuestProfile().qualification,
                      job.gates,
                      job.application_status,
                      job,
                    )
                  : null
              }
              onSelect={() => void setState({ job: job.id })}
            />
          ) : (
            <li key={entry.job_id} className="saved-unavailable">
              <div>
                <h2>岗位暂不可用</h2>
                <p>当前未能找到此岗位，收藏仍保留。</p>
                <p className="meta">
                  {entry.job_id} · 收藏于{" "}
                  {new Date(entry.saved_at).toLocaleDateString("zh-CN")}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => savedJobs.setSaved(entry.job_id, false)}
                aria-label={`移除不可用收藏：${entry.job_id}`}
              >
                移除收藏
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
  return (
    <main className="radar-page">
      <header className="radar-heading">
        <div>
          <p className="eyebrow">本地收藏</p>
          <h1>Saved</h1>
        </div>
      </header>
      <p className="muted saved-note">
        仅保存在此浏览器。岗位信息和资格使用当前数据。
      </p>
      {(data.warnings.length > 0 ||
        data.sourceHealth.some((source) => source.status !== "success")) && (
        <p role="status" className="source-warning">
          部分来源更新受限，保留当前可读取的岗位；请核对原始来源。
        </p>
      )}
      {state.job && !selected && (
        <p role="status" className="source-warning">
          该岗位暂不可用。
          <Button variant="ghost" onClick={() => void setState({ job: "" })}>
            关闭详情
          </Button>
        </p>
      )}
      <DetailPeek
        selected={selected?.id ?? ""}
        title={selected?.title ?? ""}
        onClose={() => void setState({ job: "" })}
        list={list}
        detail={
          selected ? (
            <JobDetail
              job={selected}
              fullHref={`/jobs/${encodeURIComponent(selected.id)}?returnTo=${encodeURIComponent(`/saved?job=${encodeURIComponent(selected.id)}`)}`}
            />
          ) : null
        }
      />
    </main>
  );
}
