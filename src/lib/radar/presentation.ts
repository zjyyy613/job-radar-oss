import { validateGate } from "../domain/gate";
import type { JobReadModel } from "../data/job-read-model";
import type { QualificationProfile } from "../domain/profile";
import {
  evaluateQualification,
  type QualificationResult,
} from "../domain/qualification-engine";
import type { Gate, GateField } from "../domain/gate";
import {
  EDUCATION_LABELS,
  majorLabel,
  RESEARCH_OPTIONS,
} from "../domain/profile-values";
import type { RadarState } from "./url-state";
export const FIELD_LABELS: Record<GateField, string> = {
  student_status: "学生状态",
  graduation_year: "毕业年份",
  education: "学历要求",
  major: "专业要求",
  days_per_week: "每周天数",
  duration_months: "实习时长",
  research_areas: "研究方向",
};
export const VERDICTS = {
  Eligible: "当前条件无明显冲突",
  Check: "需要确认",
  Blocked: "存在明确不符合项",
  Excluded: "已关闭",
};
export function verdict(result: QualificationResult) {
  return result.reasons.some((r) => r.code === "qualification_data_unavailable")
    ? "资格信息待确认"
    : VERDICTS[result.status];
}
export function freshness(job: JobReadModel) {
  return (
    job.sources
      .map((s) => s.fetched_at)
      .sort()
      .at(-1) ?? job.published_at
  );
}
export function dateLabel(value: string | null) {
  return value && !Number.isNaN(Date.parse(value))
    ? new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(value))
    : "未提供";
}
export function selectJobs(
  jobs: JobReadModel[],
  profile: QualificationProfile,
  state: RadarState,
) {
  const rank = { Eligible: 0, Check: 1, Blocked: 2, Excluded: 3 };
  return jobs
    .map((job) => ({
      job,
      result: evaluateQualification(
        profile,
        job.gates,
        job.application_status,
        job,
      ),
    }))
    .filter(
      ({ job, result }) =>
        (state.status === "all" || result.status === state.status) &&
        (!state.city || job.location.includes(state.city)) &&
        (!state.q ||
          [job.title, job.company, ...job.location]
            .join(" ")
            .toLocaleLowerCase()
            .includes(state.q.trim().toLocaleLowerCase())),
    )
    .sort(
      (a, b) =>
        (state.sort === "qualification"
          ? rank[a.result.status] - rank[b.result.status]
          : 0) ||
        (Date.parse(freshness(b.job) ?? "") || 0) -
          (Date.parse(freshness(a.job) ?? "") || 0) ||
        a.job.id.localeCompare(b.job.id),
    );
}
export function secondarySignal(result: QualificationResult) {
  const reason = result.reasons[0];
  if (!reason) return null;
  if (!reason.gate) return reason.message;
  return `${FIELD_LABELS[reason.gate.field]} · ${result.status === "Blocked" ? "不符合" : "待确认"}`;
}
export function checkReason(
  reason: QualificationResult["reasons"][number],
  profile: QualificationProfile,
) {
  if (reason.code === "qualification_data_unavailable")
    return "资格数据未就绪 · 提取未完成、失败或内容已更新，暂不判断资格。";
  if (reason.code === "ambiguous_condition")
    return "JD 条件含糊 · 条件范围或含义需要向招聘方确认。";
  if (reason.code === "required_unknown" && reason.gate) {
    const fields =
      reason.gate.value.kind === "or"
        ? reason.gate.value.alternatives.map((a) => a.field)
        : [reason.gate.field];
    if (fields.some((f) => profile[f] == null || profile[f] === ""))
      return "资料缺失 · 补充相关资格资料后可重新核对。";
    return "边界不明确 · 当前资料与条件无法确定性比较，请向招聘方确认。";
  }
  return reason.message;
}
export function gateLabel(gate: Pick<Gate, "field" | "value">): string {
  const value = gate.value;
  if (value.kind === "or")
    return value.alternatives.map((a) => gateLabel(a)).join("，或 ");
  if (value.kind === "education_minimum")
    return `${EDUCATION_LABELS[value.value]}及以上`;
  if (value.kind === "minimum")
    return `${FIELD_LABELS[gate.field]}至少 ${value.value}${gate.field === "days_per_week" ? " 天" : " 个月"}`;
  return `${FIELD_LABELS[gate.field]}：${value.values.map((v) => (gate.field === "education" ? EDUCATION_LABELS[v as keyof typeof EDUCATION_LABELS] : gate.field === "major" ? majorLabel(String(v)) : gate.field === "research_areas" ? (RESEARCH_OPTIONS.find(([key]) => key === v)?.[1] ?? v) : v === "enrolled" ? "在校" : v === "graduated" ? "已毕业" : v)).join(" / ")}`;
}
export function evidenceText(job: JobReadModel, source: string) {
  return source === "title"
    ? job.title
    : source === "description"
      ? job.description
      : source === "requirements"
        ? job.requirements
        : null;
}

export function groundedEvidence(
  job: JobReadModel,
  evidence: import("../domain/gate").GateEvidence,
) {
  const text = evidenceText(job, evidence.source);
  if (!text || !evidence.quote.trim() || !text.includes(evidence.quote))
    return null;
  const start = text.indexOf(evidence.quote);
  const context =
    evidence.context &&
    text.includes(evidence.context) &&
    evidence.context.includes(evidence.quote)
      ? evidence.context
      : text.slice(
          Math.max(0, start - 160),
          Math.min(text.length, start + evidence.quote.length + 240),
        );
  return { quote: evidence.quote, context };
}

/** Also guards archived/closed details, whose verdict short-circuits before gate validation. */
export function displayGatesAreValid(gates: unknown): gates is Gate[] {
  try {
    if (!Array.isArray(gates)) return false;
    gates.forEach(validateGate);
    return true;
  } catch {
    return false;
  }
}
