"use client";
import Link from "next/link";
import { CompanyMark } from "@/components/company-mark";
import type { JobReadModel } from "@/lib/data/job-read-model";
import { safeExternalUrl } from "@/lib/data/job-read-model";
import { useLocalProfile } from "@/lib/profile/use-local-profile";
import { emptyGuestProfile } from "@/lib/profile/local-profile";
import {
  evaluateQualification,
  extractionIsReady,
} from "@/lib/domain/qualification-engine";
import {
  verdict,
  displayGatesAreValid,
  checkReason,
  APPLICATION_LABELS,
  APPLICATION_NOTES,
} from "@/lib/radar/presentation";
import { Button } from "@/components/ui/button";
import { GateRow } from "./gate-row";
import { CheckReason } from "./check-reason";
import { SourceMeta } from "./source-meta";
import { SaveButton, SavedStorageNotice } from "@/components/saved/save-button";
export function JobDetail({
  job,
  full = false,
  fullHref,
}: {
  job: JobReadModel;
  full?: boolean;
  fullHref?: string;
}) {
  const snapshot = useLocalProfile();
  const profile =
    snapshot.data?.qualification ?? emptyGuestProfile().qualification;
  const result = evaluateQualification(
    profile,
    job.gates,
    job.application_status,
    job,
  );
  const ready =
    extractionIsReady(job) &&
    displayGatesAreValid(job.gates) &&
    !result.reasons.some((r) => r.code === "qualification_data_unavailable");
  const url = safeExternalUrl(job.apply_url);
  return (
    <article className={`job-detail ${full ? "full-detail" : ""}`}>
      <SavedStorageNotice />
      <header className="job-heading">
        <p className="eyebrow company-heading">
          <CompanyMark company={job.company} />
          {job.company}
        </p>
        <h1>{job.title}</h1>
        <p className="muted">
          {job.location.join(" / ") || "地点未提供"}
          {job.salary ? ` · ${job.salary}` : ""}
        </p>
        {job.recruitment_batch && (
          <p className="meta">{job.recruitment_batch}</p>
        )}
        <p className="meta">招聘状态：{APPLICATION_LABELS[job.application_status]}。{APPLICATION_NOTES[job.application_status]}</p>
        <div className="detail-actions">
          {job.application_status === "closed" ? (
            <p className="muted">岗位已关闭，当前不可申请。{url && <a href={url} target="_blank" rel="noopener noreferrer">查看原始岗位 ↗</a>}</p>
          ) : url ? (
            <Button asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                官网投递 ↗
              </a>
            </Button>
          ) : (
            <p className="muted">申请链接未提供，请查看原始来源。</p>
          )}
          <SaveButton id={job.id} title={job.title} />
          {!full && fullHref && (
            <Link className="text-link" href={fullHref}>
              查看完整岗位详情 →
            </Link>
          )}
        </div>
      </header>
      <section className="qualification-section">
        <p className="eyebrow">资格核对</p>
        {!snapshot.loaded ? (
          <p role="status">正在读取本地资格…</p>
        ) : (
          <>
            <h2
              className={
                result.status === "Blocked"
                  ? "tone-blocked"
                  : result.status === "Check"
                    ? "tone-check"
                    : ""
              }
            >
              {verdict(result)}
            </h2>
            <CheckReason result={result} profile={profile} />
            {result.status === "Eligible" && (
              <p className="muted">
                仅核对已识别的资格条件，不代表岗位当前可投递；最终要求以招聘方原文为准。
              </p>
            )}
          </>
        )}
      </section>
      {ready &&
        (["required", "ambiguous", "preferred"] as const).map((requirement) => {
          const gates = job.gates.filter((g) => g.requirement === requirement);
          return (
            gates.length > 0 && (
              <section key={requirement}>
                <h2>
                  {
                    {
                      required: "明确要求",
                      ambiguous: "待确认条件",
                      preferred: "优先条件 · 不影响阻断",
                    }[requirement]
                  }
                </h2>
                <ul className="gate-list">
                  {gates.map((gate) => (
                    <GateRow
                      key={gate.id}
                      gate={gate}
                      job={job}
                      reason={
                        snapshot.loaded
                          ? result.reasons
                              .filter((r) => r.gate?.id === gate.id)
                              .map((r) => checkReason(r, profile))
                              .join("；") || undefined
                          : undefined
                      }
                    />
                  ))}
                </ul>
              </section>
            )
          );
        })}
      {ready && job.gates.length === 0 && (
        <p className="muted">
          原文未提取出可核对的 M0 资格条件，请继续阅读完整岗位描述。
        </p>
      )}
      {full ? (
        <>
          <section>
            <h2>岗位职责</h2>
            <p className="raw-text">
              {job.description || "来源未提供岗位职责。"}
            </p>
          </section>
          <section>
            <h2>岗位要求</h2>
            <p className="raw-text">
              {job.requirements || "来源未提供岗位要求。"}
            </p>
          </section>
          <section>
            <h2>完整 JD · 收录原文</h2>
            <p className="meta">
              以下按来源收录字段逐字展示；缺失内容不会补写。
            </p>
            <div className="raw-text">
              {[job.title, job.description, job.requirements]
                .filter(Boolean)
                .join("\n\n")}
            </div>
          </section>
        </>
      ) : (
        <section>
          <h2>继续阅读原文</h2>
          <p className="muted">职责、完整要求和来源信息保留在完整岗位详情。</p>
          {fullHref && (
            <Link className="text-link" href={fullHref}>
              查看完整岗位详情 →
            </Link>
          )}
        </section>
      )}
      <SourceMeta job={job} />
    </article>
  );
}
