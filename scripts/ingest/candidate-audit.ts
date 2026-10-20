/**
 * AUTOMATION-01 A: pre-expansion candidate audit.
 *
 * Runs the existing bounded ingestion in read-only mode (a collector store replaces
 * the database store, so nothing is written anywhere), then applies deterministic
 * rules to produce PASS / REVIEW / STOP. No model is called and no rule below is
 * decided by an LLM.
 *
 * The audit can never claim a confirmed net gain: production de-duplication needs
 * read-only access to `source_records`, which this workflow deliberately does not
 * have. Without it the best possible verdict is REVIEW.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { categorizeTitle, categoryLabel, level1Label, CATEGORY_L1, CATEGORY_L2 } from "../../src/lib/radar/job-category";
import type { SourceRecord } from "./contracts";
import { invokeJobPro } from "./job-pro-cli";
import { JOB_PRO_SOURCES, isJobProSource } from "./job-pro-sources";
import { parseOptions, runIngestion, type RunOptions } from "./run-job-pro";

export type AuditVerdict = "PASS" | "REVIEW" | "STOP";
export type Severity = "stop" | "review" | "info";

export interface AuditReason {
  code: string;
  severity: Severity;
  message: string;
}

export interface AuditWindow {
  startPage: number; pageSize: number; maxPages: number; maxJobs: number; globalMaxJobs: number;
}

export interface AuditMetrics {
  pages_fetched: number; listed: number; duplicate_ids: number;
  detail_attempted: number; detail_success: number; admission_passed: number; admission_rejected: number;
  failure_reasons: Record<string, number>; stop_reason: string;
  search_ms: number; detail_ms: number; upsert_ms: number; duration_ms: number;
  rejections: { source_job_id: string | null; reason: string }[];
}

export interface AuditInput {
  sources: readonly string[];
  scope: "campus" | "intern";
  window: AuditWindow;
  records: readonly SourceRecord[];
  runs: readonly { source: string; status: string; records_seen: number }[];
  metrics: readonly AuditMetrics[];
  /** Read-only production de-duplication was actually performed. */
  dedupVerified: boolean;
  /** Per-source upstream host, used to verify official locators independently. */
  upstream: Record<string, string>;
}

export interface AuditCandidate {
  source_job_id: string;
  company: string;
  title: string;
  location: string[];
  apply_url: string | null;
  url_is_official: boolean;
  url_carries_id: boolean;
  jd_chars: number;
  l1: string;
  l2: string;
  l1_label: string;
  l2_label: string;
}

export interface AuditReport {
  generated_at: string;
  mode: "read-only";
  sources: string[];
  scope: string;
  window: AuditWindow & { effective_window: number; window_under_budget: boolean };
  counts: {
    candidates: number; unique_ids: number; duplicate_ids: number;
    detail_attempted: number; detail_success: number; admission_passed: number; admission_rejected: number;
    admission_rate: number; empty_location: number; unofficial_urls: number; thin_jd: number;
    mixed_recruit_signals: number;
  };
  categories: {
    level1: { id: string; label: string; count: number }[];
    level2: { id: string; label: string; count: number }[];
    unclassified: number; unclassified_ratio: number;
  };
  timing: {
    total_ms: number; search_ms: number; detail_ms: number; upsert_ms: number;
    per_record_ms: number; projected_ms: number; budget_ms: number; projected_ratio: number;
  };
  duplicates: string[];
  failures: { source_job_id: string | null; reason: string }[];
  verdict: AuditVerdict;
  reasons: AuditReason[];
  caveats: string[];
  candidates: AuditCandidate[];
  net_new: { confirmed: false; note: string };
}

/** Thresholds are fixed so the verdict is reproducible and testable. */
export const AUDIT_THRESHOLDS = {
  unclassifiedReviewRatio: 0.3,
  timeoutReviewRatio: 0.8,
  perSourceBudgetMs: 300_000,
  maxPages: 20,
  maxPageSize: 50,
  thinJdChars: 80,
} as const;

const FATAL_REASONS = ["access_denied", "rate_limited", "source_timeout", "challenge_page", "unreadable_detail",
  "untrusted_locator", "missing_authoritative_locator", "missing_location", "search_failed", "repeated_page"] as const;

const RECRUIT_MIX = /正式|社招/;

/** Pure evaluation: same input always yields the same verdict. */
export function evaluateAudit(input: AuditInput): AuditReport {
  const reasons: AuditReason[] = [];
  const caveats: string[] = [];
  const { window } = input;
  const metrics = input.metrics;
  const sum = (pick: (m: AuditMetrics) => number) => metrics.reduce((total, m) => total + pick(m), 0);

  const records = input.records;
  const uniqueIds = [...new Set(records.map((r) => `${r.source}:${r.source_job_id}`))];
  const duplicates = (() => {
    const seen = new Set<string>();
    const dup: string[] = [];
    for (const r of records) {
      const key = `${r.source}:${r.source_job_id}`;
      if (seen.has(key)) dup.push(r.source_job_id); else seen.add(key);
    }
    return dup;
  })();
  const duplicateIds = sum((m) => m.duplicate_ids);

  const candidates: AuditCandidate[] = records.map((record) => {
    const category = categorizeTitle(record.title);
    const host = record.source_url ? (() => { try { return new URL(record.source_url).hostname; } catch { return ""; } })() : "";
    const expected = input.upstream[record.source.replace("job-pro:", "")] ?? "";
    return {
      source_job_id: record.source_job_id,
      company: record.company,
      title: record.title,
      location: record.location,
      apply_url: record.source_url,
      url_is_official: Boolean(record.source_url) && host === expected,
      url_carries_id: Boolean(record.source_url) && decodeURIComponent(record.source_url!).includes(record.source_job_id),
      jd_chars: `${record.description ?? ""}${record.requirements ?? ""}`.length,
      l1: category.l1, l2: category.l2,
      l1_label: level1Label(category.l1), l2_label: categoryLabel(category.l2),
    };
  });

  const level1 = CATEGORY_L1.map(({ id, label }) => ({ id, label, count: candidates.filter((c) => c.l1 === id).length }))
    .filter((row) => row.count > 0);
  const level2 = CATEGORY_L2.map(({ id, label }) => ({ id, label, count: candidates.filter((c) => c.l2 === id).length }))
    .filter((row) => row.count > 0);
  const unclassified = candidates.filter((c) => c.l1 === "other").length;
  const unclassifiedRatio = candidates.length ? unclassified / candidates.length : 0;

  const detailAttempted = sum((m) => m.detail_attempted);
  const admitted = sum((m) => m.admission_passed);
  const rejected = sum((m) => m.admission_rejected);
  const rejections = metrics.flatMap((m) => m.rejections);
  const totalMs = sum((m) => m.duration_ms);
  const perRecordMs = admitted ? Math.round(totalMs / admitted) : 0;
  const projectedMs = perRecordMs * Math.max(1, window.maxJobs);
  const projectedRatio = projectedMs / AUDIT_THRESHOLDS.perSourceBudgetMs;
  const effectiveWindow = Math.min(window.pageSize * window.maxPages, window.maxJobs, window.globalMaxJobs);

  // --- STOP rules -----------------------------------------------------------
  if (!input.sources.length || input.sources.some((s) => !isJobProSource(s))) {
    reasons.push({ code: "invalid_sources", severity: "stop", message: "来源不在已核实的白名单内" });
  }
  if (!Number.isInteger(window.pageSize) || window.pageSize < 1 || window.pageSize > AUDIT_THRESHOLDS.maxPageSize
    || !Number.isInteger(window.maxPages) || window.maxPages < 1 || window.maxPages > AUDIT_THRESHOLDS.maxPages
    || !Number.isInteger(window.startPage) || window.startPage < 1
    || window.startPage + window.maxPages - 1 > AUDIT_THRESHOLDS.maxPages) {
    reasons.push({ code: "window_out_of_range", severity: "stop", message: `分页窗口越界：start_page=${window.startPage} + max_pages=${window.maxPages} − 1 超过 ${AUDIT_THRESHOLDS.maxPages}` });
  }
  const failureReasons: Record<string, number> = {};
  for (const m of metrics) for (const [reason, count] of Object.entries(m.failure_reasons)) {
    failureReasons[reason] = (failureReasons[reason] ?? 0) + count;
  }
  const fatal = Object.keys(failureReasons).filter((reason) => (FATAL_REASONS as readonly string[]).includes(reason));
  if (fatal.length) {
    reasons.push({ code: "fatal_source_failure", severity: "stop", message: `来源级失败：${fatal.join("、")}（不得绕过访问限制或超时）` });
  }
  if (admitted === 0) {
    reasons.push({ code: "no_admitted_candidates", severity: "stop", message: "没有任何候选通过准入" });
  }
  if (projectedRatio > 1) {
    reasons.push({ code: "projected_timeout", severity: "stop", message: `按实测速度预计 ${Math.round(projectedMs / 1000)}s 超过单来源 ${AUDIT_THRESHOLDS.perSourceBudgetMs / 1000}s 预算` });
  }

  // --- REVIEW rules ---------------------------------------------------------
  if (!input.dedupVerified) {
    reasons.push({ code: "production_dedup_unverified", severity: "review", message: "未与生产 source_records 比对（本工作流无只读库凭据），不能确认净新增" });
    caveats.push("净新增未确认：候选数不等于新增数，需在具备只读凭据的环境核对 ID 差集");
  }
  if (unclassifiedRatio >= AUDIT_THRESHOLDS.unclassifiedReviewRatio) {
    reasons.push({ code: "unclassified_heavy", severity: "review", message: `未分类 ${unclassified}/${candidates.length}（${(unclassifiedRatio * 100).toFixed(1)}%）≥ ${AUDIT_THRESHOLDS.unclassifiedReviewRatio * 100}%，需人工判断这些岗位是否值得收录` });
  }
  if (rejected > 0) {
    reasons.push({ code: "rejected_candidates", severity: "review", message: `${rejected} 条候选未通过准入：${[...new Set(rejections.map((r) => r.reason))].join("、")}` });
  }
  if (duplicateIds > 0 || duplicates.length > 0) {
    reasons.push({ code: "duplicate_ids", severity: "review", message: `运行内重复 ID：${duplicateIds + duplicates.length}` });
  }
  const mixed = candidates.filter((c) => RECRUIT_MIX.test(c.title)).length;
  if (mixed > 0) {
    reasons.push({ code: "mixed_recruit_signals", severity: "review", message: `${mixed} 条标题含「正式/社招」字样，招聘类型需人工确认` });
  }
  const unofficial = candidates.filter((c) => !c.url_is_official || !c.url_carries_id).length;
  if (unofficial > 0) {
    reasons.push({ code: "unofficial_locator", severity: "review", message: `${unofficial} 条候选的申请链接不是预期官方域名或未携带自身 ID` });
  }
  const thin = candidates.filter((c) => c.jd_chars < AUDIT_THRESHOLDS.thinJdChars).length;
  if (thin > 0) {
    reasons.push({ code: "thin_jd", severity: "review", message: `${thin} 条候选 JD 少于 ${AUDIT_THRESHOLDS.thinJdChars} 字符` });
  }
  const windowUnderBudget = window.pageSize * window.maxPages < window.maxJobs;
  if (windowUnderBudget) {
    reasons.push({ code: "window_under_budget", severity: "review", message: `page_size × max_pages = ${window.pageSize * window.maxPages} < max_jobs ${window.maxJobs}，无法达到目标条数` });
  }
  if (projectedRatio >= AUDIT_THRESHOLDS.timeoutReviewRatio && projectedRatio <= 1) {
    reasons.push({ code: "timeout_risk", severity: "review", message: `预计耗时占单来源预算 ${(projectedRatio * 100).toFixed(0)}%，建议缩小本批条数` });
  }
  for (const m of metrics) {
    if (!["max_jobs", "query_exhausted", "max_pages"].includes(m.stop_reason)) {
      reasons.push({ code: "unexpected_stop_reason", severity: "review", message: `停止原因 ${m.stop_reason} 需要人工确认` });
    }
  }
  if (effectiveWindow < window.maxJobs) {
    caveats.push(`实际窗口上限为 ${effectiveWindow} 条（受 global_max_jobs 或 page_size × max_pages 限制）`);
  }

  const verdict: AuditVerdict = reasons.some((r) => r.severity === "stop") ? "STOP" : reasons.some((r) => r.severity === "review") ? "REVIEW" : "PASS";

  return {
    generated_at: new Date().toISOString(),
    mode: "read-only",
    sources: [...input.sources],
    scope: input.scope,
    window: { ...window, effective_window: effectiveWindow, window_under_budget: windowUnderBudget },
    counts: {
      candidates: candidates.length, unique_ids: uniqueIds.length, duplicate_ids: duplicateIds,
      detail_attempted: detailAttempted, detail_success: sum((m) => m.detail_success), admission_passed: admitted,
      admission_rejected: rejected, admission_rate: detailAttempted ? Number((admitted / detailAttempted).toFixed(4)) : 0,
      empty_location: candidates.filter((c) => c.location.length === 0).length,
      unofficial_urls: unofficial, thin_jd: thin, mixed_recruit_signals: mixed,
    },
    categories: { level1, level2, unclassified, unclassified_ratio: Number(unclassifiedRatio.toFixed(4)) },
    timing: {
      total_ms: totalMs, search_ms: sum((m) => m.search_ms), detail_ms: sum((m) => m.detail_ms), upsert_ms: sum((m) => m.upsert_ms),
      per_record_ms: perRecordMs, projected_ms: projectedMs, budget_ms: AUDIT_THRESHOLDS.perSourceBudgetMs,
      projected_ratio: Number(projectedRatio.toFixed(3)),
    },
    duplicates, failures: rejections,
    verdict, reasons, caveats, candidates,
    net_new: { confirmed: false, note: "候选 ≠ 净新增；需只读比对生产 source_records 的 ID 差集后才能声明新增" },
  };
}

export function renderMarkdown(report: AuditReport): string {
  const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
  const lines: string[] = [];
  lines.push(`# 候选审查报告（${report.sources.join(", ")} / ${report.scope}）`, "");
  lines.push(`> 结果：**${report.verdict}** ｜ 模式：**read-only**（无数据库写入、无模型调用）`, "");
  lines.push(`- 窗口：start_page=${report.window.startPage} · page_size=${report.window.pageSize} · max_pages=${report.window.maxPages} · max_jobs=${report.window.maxJobs} · global=${report.window.globalMaxJobs}（有效上限 ${report.window.effective_window}）`);
  lines.push(`- 候选：**${report.counts.candidates}** 条 / 唯一 ID **${report.counts.unique_ids}** / 重复 ${report.counts.duplicate_ids}`);
  lines.push(`- 详情：尝试 ${report.counts.detail_attempted} · 成功 ${report.counts.detail_success} · 准入 **${report.counts.admission_passed}**（${pct(report.counts.admission_rate)}）· 拒绝 ${report.counts.admission_rejected}`);
  lines.push(`- 「其他/未分类」：**${report.categories.unclassified}**（${pct(report.categories.unclassified_ratio)}）`);
  lines.push(`- 耗时：总计 ${(report.timing.total_ms / 1000).toFixed(1)}s（search ${(report.timing.search_ms / 1000).toFixed(1)}s / detail ${(report.timing.detail_ms / 1000).toFixed(1)}s）· 每条 ${report.timing.per_record_ms}ms · 预计满额 ${(report.timing.projected_ms / 1000).toFixed(0)}s / 预算 ${report.timing.budget_ms / 1000}s（${pct(report.timing.projected_ratio)}）`);
  lines.push("");
  lines.push("## 判定依据", "");
  if (!report.reasons.length) lines.push("- 无异常：全部自动检查通过");
  for (const reason of report.reasons) lines.push(`- [${reason.severity.toUpperCase()}] \`${reason.code}\` — ${reason.message}`);
  if (report.caveats.length) {
    lines.push("", "## 必须人工知悉", "");
    for (const caveat of report.caveats) lines.push(`- ${caveat}`);
  }
  lines.push("", "## 净新增状态", "", `**未确认** — ${report.net_new.note}`, "");
  lines.push("## 一级类别分布", "", "| 一级 | 数量 |", "| --- | --- |");
  for (const row of report.categories.level1) lines.push(`| ${row.label} | ${row.count} |`);
  lines.push("", "## 二级类别分布", "", "| 一级 > 二级 | 数量 |", "| --- | --- |");
  for (const row of report.categories.level2) lines.push(`| ${level1Label(row.id.split(".")[0])} > ${row.label} | ${row.count} |`);
  if (report.failures.length) {
    lines.push("", "## 未通过准入的候选", "", "| source_job_id | 原因 |", "| --- | --- |");
    for (const failure of report.failures) lines.push(`| ${failure.source_job_id ?? "(unknown)"} | ${failure.reason} |`);
  }
  lines.push("", "## 候选 source_job_id 清单", "", "| # | source_job_id | 公司 | 标题 | 地点 | 类别 | 申请链接 |", "| --- | --- | --- | --- | --- | --- | --- |");
  report.candidates.forEach((candidate, index) => {
    lines.push(`| ${index + 1} | ${candidate.source_job_id} | ${candidate.company} | ${candidate.title} | ${candidate.location.join(" / ") || "—"} | ${candidate.l1_label} > ${candidate.l2_label} | ${candidate.apply_url ?? "—"} |`);
  });
  lines.push("", "---", `生成时间：${report.generated_at}`, "");
  lines.push("PASS 仅代表通过本报告的自动检查，不代表获得生产写入授权；STOP 表示来源不可信、关键检查失败或预算风险。");
  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const out = resolve(outIndex >= 0 ? args[outIndex + 1] : ".verification/audit");
  // `--page-size` is the audit-facing name for the runner's `--limit`.
  const normalized = args
    .filter((_, index) => index !== outIndex && index !== outIndex + 1)
    .map((arg) => (arg === "--page-size" ? "--limit" : arg));
  const options = parseOptions(["--dry-run", ...normalized]);
  const window: AuditWindow = {
    startPage: options.startPage ?? 1, pageSize: options.limit,
    maxPages: options.maxPages ?? 1, maxJobs: options.maxJobs ?? options.limit, globalMaxJobs: options.globalMaxJobs ?? 15,
  };
  // Collector store: the ingestion code path is unchanged, but nothing is persisted.
  const records: SourceRecord[] = [];
  const runs: { source: string; status: string; records_seen: number }[] = [];
  const store = {
    async upsertRecord(record: SourceRecord) { records.push(record); return "new" as const; },
    async writeRun(run: { source: string; status: string; records_seen: number }) { runs.push({ source: run.source, status: run.status, records_seen: run.records_seen }); },
  };
  const result = await runIngestion(options as RunOptions, { cli: invokeJobPro, store });
  const report = evaluateAudit({
    sources: options.sources, scope: options.scope, window, records, runs,
    metrics: result.sources.map((source) => ({ ...source.metrics, rejections: source.rejections })),
    // No database credential is available to this workflow, so de-duplication is never claimed.
    dedupVerified: false,
    upstream: Object.fromEntries(Object.entries(JOB_PRO_SOURCES).map(([key, value]) => [key, value.upstream])),
  });
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, "audit.json"), JSON.stringify(report, null, 2), "utf8");
  writeFileSync(resolve(out, "audit.md"), renderMarkdown(report), "utf8");
  console.log(JSON.stringify({ verdict: report.verdict, candidates: report.counts.candidates, admitted: report.counts.admission_passed, unclassified: report.categories.unclassified, out }));
  if (report.verdict === "STOP") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(`candidate audit failed: ${error instanceof Error ? error.message : "unknown"}`);
    process.exitCode = 1;
  });
}
