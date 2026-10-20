/**
 * AUTOMATION-01 B: post-expansion result audit.
 *
 * Reads the refresh `summary.json` (and the checkpoint when present) that the
 * existing pipeline already produces and turns it into a readable report plus
 * machine-readable facts. It never re-runs collection, never retries extraction
 * and never treats the GitHub Actions step result as the internal status.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildRefreshReport, type RefreshOutcomeLike } from "./refresh-report";

export type RefreshVerdict = "PASS" | "REVIEW" | "STOP";

/** The refresh summary carries two extra blocks beyond the Step-Summary shape. */
export interface RefreshSummary extends RefreshOutcomeLike {
  baseline?: { records?: number; jobs?: number; ready?: number };
  source_runs?: {
    source?: string; status?: string; records_seen?: number; pages_fetched?: number; duration_ms?: number;
    search_ms?: number; detail_ms?: number;
    upsert_ms?: number; stop_reason?: string; failure_reasons?: Record<string, number>;
  }[];
}

export interface RefreshAudit {
  internal_status: string;
  exit_code: number;
  verdict: RefreshVerdict;
  baseline: { records: number | null; jobs: number | null; ready: number | null };
  writes: { inserted: number; updated: number; unchanged: number; canonical_new: number; canonical_changed: number };
  extraction: { pending: number; parser_only: number; success: number; failure: number; deferred: number; ready_jobs: number; evidence_quotes_verified: number };
  model: { calls: number; cap: number | null; budget_used_ratio: number | null };
  timing: { total_ms: number; per_source: { source: string; status: string; duration_ms: number; search_ms: number; detail_ms: number; upsert_ms: number; stop_reason: string }[] };
  failures: { source: string; reason: string; count: number }[];
  extractions: { id: string; status: string; diagnostic: string | null }[];
  human_actions: string[];
  caveats: string[];
}

const num = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const maybeNum = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** Pure summarisation so the rules are testable without any IO. */
export function summarizeRefresh(summary: RefreshSummary, checkpoint?: { batch?: { max_calls?: number } } | null): RefreshAudit {
  const internal = typeof summary.status === "string" ? summary.status : "unknown";
  const exitCode = internal === "failed" ? 1 : 0; // the pipeline's own policy: partial still exits 0
  const sources = Array.isArray(summary.source_runs) ? summary.source_runs : [];
  const failures: { source: string; reason: string; count: number }[] = [];
  const perSource = sources.map((row) => {
    const reasons = row.failure_reasons ?? {};
    for (const [reason, count] of Object.entries(reasons)) {
      failures.push({ source: String(row.source ?? "?"), reason, count: num(count) });
    }
    return {
      source: String(row.source ?? "?"), status: String(row.status ?? "?"),
      duration_ms: num(row.duration_ms), search_ms: num(row.search_ms), detail_ms: num(row.detail_ms),
      upsert_ms: num(row.upsert_ms), stop_reason: String(row.stop_reason ?? "?"),
    };
  });
  const cap = maybeNum(checkpoint?.batch?.max_calls);
  const calls = num(summary.model_calls);
  const extractions = (Array.isArray(summary.extracted) ? summary.extracted : []).map((row) => ({
    id: String(row.id), status: String(row.status), diagnostic: row.diagnostic ? String(row.diagnostic) : null,
  }));
  const deferred = num(summary.extraction_deferred);
  const failedExtraction = num(summary.extraction_failure);

  const human: string[] = [];
  if (internal === "partial") {
    human.push("内部状态为 PARTIAL，但流水线退出码仍为 0：**不要仅凭 Actions 绿色判定成功**，以本报告与 summary.json 为准");
  }
  if (internal === "failed") human.push("内部状态 FAILED：先只读核对数据库，再决定是否重跑；不要自动重试");
  if (failedExtraction > 0) human.push(`${failedExtraction} 条资格提取失败：已被 attempt hash 记录，**不得无授权重试模型**，需人工复核诊断后另行授权`);
  if (deferred > 0) human.push(`${deferred} 条提取被预算延后：调大 model_cap 后可续跑，不要自动重试`);
  for (const failure of failures) {
    if (failure.reason === "source_timeout") human.push(`来源 ${failure.source} 触发 source_timeout：本批少采集，需评估分页/预算后另开新批次`);
    else if (["access_denied", "rate_limited"].includes(failure.reason)) human.push(`来源 ${failure.source} 被拒绝访问（${failure.reason}）：不要绕过，停止该来源并复核`);
    else if (["insufficient_detail", "untrusted_locator", "missing_location", "unreadable_detail", "challenge_page"].includes(failure.reason)) human.push(`来源 ${failure.source} 有 ${failure.count} 条未通过准入（${failure.reason}）：属正常拒绝，记录即可`);
  }
  if (!sources.length) human.push("summary 中缺少 source_runs：无法核对分阶段耗时与停止原因，请保留 summary.json");

  const caveats: string[] = [];
  const verdict: RefreshVerdict = internal === "failed" ? "STOP" : internal === "partial" ? "REVIEW" : "PASS";
  if (verdict === "PASS" && failedExtraction === 0 && deferred === 0) {
    caveats.push("PASS 代表本次运行内部状态为 success；仍需核对 /radar 的岗位与类别计数后发布");
  }
  caveats.push("净新增以数据库 upsert 判定的 inserted 为准，候选数不能替代");

  return {
    internal_status: internal,
    exit_code: exitCode,
    verdict,
    baseline: {
      records: maybeNum(summary.baseline?.records ?? null) ?? null,
      jobs: maybeNum(summary.baseline?.jobs ?? null) ?? null,
      ready: maybeNum(summary.baseline?.ready ?? null) ?? null,
    },
    writes: {
      inserted: num(summary.inserted), updated: num(summary.updated), unchanged: num(summary.unchanged),
      canonical_new: num(summary.canonical_new), canonical_changed: num(summary.canonical_changed),
    },
    extraction: {
      pending: num(summary.extraction_pending), parser_only: num(summary.parser_only),
      success: num(summary.extraction_success), failure: failedExtraction, deferred, ready_jobs: num(summary.ready_jobs),
      evidence_quotes_verified: num(summary.evidence_quotes_verified),
    },
    model: {
      calls, cap,
      budget_used_ratio: cap && cap > 0 ? Number((calls / cap).toFixed(3)) : null,
    },
    timing: { total_ms: num(summary.duration_ms), per_source: perSource },
    failures, extractions, human_actions: human, caveats,
  };
}

export function renderRefreshMarkdown(audit: RefreshAudit, summary: RefreshOutcomeLike): string {
  const reused = buildRefreshReport(summary);
  const lines: string[] = [];
  lines.push(`# 扩容结果核验报告`, "");
  lines.push(`> 内部状态：**${audit.internal_status.toUpperCase()}** ｜ 审查结论：**${audit.verdict}** ｜ 流水线退出码：${audit.exit_code}`, "");
  lines.push("## 基线 → 结果", "", "| 项 | 值 |", "| --- | --- |");
  lines.push(`| 运行前 source_records / jobs / ready | ${audit.baseline.records ?? "—"} / ${audit.baseline.jobs ?? "—"} / ${audit.baseline.ready ?? "—"} |`);
  lines.push(`| 新增（inserted） | **${audit.writes.inserted}** |`);
  lines.push(`| 更新（updated） | ${audit.writes.updated} |`);
  lines.push(`| 未变化（unchanged） | ${audit.writes.unchanged} |`);
  lines.push(`| canonical 新增 / 变化 | ${audit.writes.canonical_new} / ${audit.writes.canonical_changed} |`);
  lines.push("", "## 资格提取", "", "| 项 | 值 |", "| --- | --- |");
  lines.push(`| 待提取 / 解析器可处理 | ${audit.extraction.pending} / ${audit.extraction.parser_only} |`);
  lines.push(`| 成功 / 失败 / 延后 | **${audit.extraction.success} / ${audit.extraction.failure} / ${audit.extraction.deferred}** |`);
  lines.push(`| ready jobs | ${audit.extraction.ready_jobs} |`);
  lines.push(`| 证据引文校验 | ${audit.extraction.evidence_quotes_verified} |`);
  lines.push(`| DeepSeek 调用 / 上限 | **${audit.model.calls} / ${audit.model.cap ?? "—"}**${audit.model.budget_used_ratio !== null ? `（${(audit.model.budget_used_ratio * 100).toFixed(0)}%）` : ""} |`);
  lines.push("", "## 分来源耗时与停止原因", "", "| 来源 | 状态 | 停止原因 | 总耗时 | search | detail | upsert |", "| --- | --- | --- | --- | --- | --- | --- |");
  for (const row of audit.timing.per_source) {
    lines.push(`| ${row.source} | ${row.status} | ${row.stop_reason} | ${(row.duration_ms / 1000).toFixed(1)}s | ${(row.search_ms / 1000).toFixed(1)}s | ${(row.detail_ms / 1000).toFixed(1)}s | ${(row.upsert_ms / 1000).toFixed(1)}s |`);
  }
  if (audit.failures.length) {
    lines.push("", "## 失败原因汇总", "", "| 来源 | 原因 | 次数 |", "| --- | --- | --- |");
    for (const failure of audit.failures) lines.push(`| ${failure.source} | ${failure.reason} | ${failure.count} |`);
  }
  if (audit.extractions.length) {
    lines.push("", "## 提取明细（失败优先）", "", "| job id | 状态 | 诊断 |", "| --- | --- | --- |");
    const ordered = [...audit.extractions].sort((a, b) => (a.status === "failed" ? -1 : 0) - (b.status === "failed" ? -1 : 0));
    for (const row of ordered.slice(0, 40)) lines.push(`| ${row.id} | ${row.status} | ${row.diagnostic ?? "—"} |`);
  }
  lines.push("", "## 必须人工处理", "");
  if (!audit.human_actions.length) lines.push("- 无");
  for (const action of audit.human_actions) lines.push(`- ${action}`);
  lines.push("", "## 说明", "");
  for (const caveat of audit.caveats) lines.push(`- ${caveat}`);
  lines.push("", "## 附：既有 refresh Step Summary（原文复用）", "", reused.markdown);
  return lines.join("\n");
}

function main() {
  const args = process.argv.slice(2);
  const summaryIndex = args.indexOf("--summary");
  const summaryPath = resolve(summaryIndex >= 0 ? args[summaryIndex + 1] : ".verification/refresh/summary.json");
  const outIndex = args.indexOf("--out");
  const out = resolve(outIndex >= 0 ? args[outIndex + 1] : ".verification/refresh");
  if (!existsSync(summaryPath)) {
    console.error("refresh-audit: summary.json not found; keep the artifact and re-run with --summary <path>");
    process.exitCode = 1;
    return;
  }
  const summary = JSON.parse(readFileSync(summaryPath, "utf8")) as RefreshOutcomeLike;
  const checkpointIndex = args.indexOf("--checkpoint");
  const checkpointPath = resolve(checkpointIndex >= 0 ? args[checkpointIndex + 1] : ".verification/refresh/checkpoint.json");
  const checkpoint = existsSync(checkpointPath) ? (JSON.parse(readFileSync(checkpointPath, "utf8")) as { batch?: { max_calls?: number } }) : null;
  const audit = summarizeRefresh(summary, checkpoint);
  mkdirSync(out, { recursive: true });
  writeFileSync(resolve(out, "refresh-audit.json"), JSON.stringify(audit, null, 2), "utf8");
  writeFileSync(resolve(out, "refresh-audit.md"), renderRefreshMarkdown(audit, summary), "utf8");
  console.log(JSON.stringify({ status: audit.internal_status, verdict: audit.verdict, inserted: audit.writes.inserted, extraction_failure: audit.extraction.failure, model_calls: audit.model.calls }));
  if (audit.verdict === "STOP") process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
