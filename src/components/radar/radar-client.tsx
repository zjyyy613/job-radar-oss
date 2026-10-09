"use client";
import Link from "next/link";
import { useQueryStates } from "nuqs";
import type { RadarData } from "@/lib/data/job-read-model";
import { radarParsers, fullDetailUrl } from "@/lib/radar/url-state";
import { selectJobs } from "@/lib/radar/presentation";
import { locationOptions, resolveCityFilter } from "@/lib/radar/location";
import { useLocalProfile } from "@/lib/profile/use-local-profile";
import { emptyGuestProfile } from "@/lib/profile/local-profile";
import { Button } from "@/components/ui/button";
import { JobDetail } from "@/components/job/job-detail";
import { FilterBar } from "./filter-bar";
import { JobList } from "./job-list";
import { DetailPeek } from "./detail-peek";
export function RadarClient({ data }: { data: RadarData }) {
  const [state, setState] = useQueryStates(radarParsers, {
    history: "push",
    shallow: true,
  });
  const snapshot = useLocalProfile();
  const profile =
    snapshot.data?.qualification ?? emptyGuestProfile().qualification;
  const rows = selectJobs(data.jobs, profile, state);
  const selected = data.jobs.find((job) => job.id === state.job);
  const cities = locationOptions(data.jobs, state.city);
  const incomplete =
    !profile.student_status ||
    !profile.graduation_year ||
    !profile.education ||
    !profile.major;
  const unavailable = data.sourceHealth.filter(
    (source) => source.status !== "success",
  );
  const list = (
    <div className="list-surface">
      <div className="result-line" role="status">
        <span>{rows.length} 个岗位</span>
        <span>
          {state.sort === "qualification"
            ? "资格优先 · 最近收录"
            : "按收录时间"}{" "}
        </span>
      </div>
      {rows.length ? (
        <JobList
          rows={rows}
          loaded={snapshot.loaded}
          selected={state.job}
          onSelect={(id) => void setState({ job: id })}
        />
      ) : (
        <div className="empty-state">
          <h2>
            {data.jobs.length ? "没有符合筛选条件的岗位" : "暂时没有收录岗位"}
          </h2>
          <p>
            {data.jobs.length
              ? "试试其他关键词，或清除筛选。"
              : "稍后刷新查看来源更新。"}
          </p>
          {data.jobs.length > 0 && (
            <Button
              variant="outline"
              onClick={() => void setState({ q: "", city: "", status: "all" })}
            >
              清除筛选
            </Button>
          )}
        </div>
      )}
    </div>
  );
  return (
    <main className="radar-page">
      <header className="radar-heading">
        <div>
          <p className="eyebrow">岗位浏览</p>
          <h1>Radar</h1>
        </div>
      </header>
      {snapshot.loaded && incomplete && (
        <div className="profile-prompt">
          补充基本资格，让岗位条件有据可查。
          <Link href={snapshot.data ? "/profile" : "/onboarding"}>
            填写资格资料 →
          </Link>
        </div>
      )}
      {snapshot.error && (
        <p role="alert" className="source-warning">
          本地资料暂不可用。<Link href="/profile">前往资料页处理</Link>
        </p>
      )}
      {(unavailable.length > 0 || data.warnings.length > 0) && (
        <div className="source-warning" role="status">
          {unavailable.length > 0 && (
            <p>
              部分来源更新受限：
              {unavailable
                .map(
                  (s) =>
                    `${s.source}（${s.status === "failed" ? "获取失败" : "部分完成"}）`,
                )
                .join("、")}
              。保留已收录岗位，请核对原始来源。
            </p>
          )}
          {data.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
        </div>
      )}
      <FilterBar
        state={{ ...state, city: resolveCityFilter(state.city) }}
        cities={cities}
        onChange={(value) => void setState(value)}
      />
      {state.job && !selected && (
        <div className="source-warning" role="status">
          该岗位不存在或已不可读取。
          <Button variant="ghost" onClick={() => void setState({ job: "" })}>
            返回岗位列表
          </Button>
        </div>
      )}
      {selected && !rows.some((row) => row.job.id === selected.id) && (
        <p className="selection-note">
          当前预览岗位不在本次筛选结果中；关闭详情可继续浏览。
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
              key={selected.id}
              job={selected}
              fullHref={fullDetailUrl(selected.id, state)}
            />
          ) : null
        }
      />
    </main>
  );
}
