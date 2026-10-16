/**
 * GitHub-facing report for a refresh run.
 *
 * Visibility only: a `partial` run used to look green because only `failed`
 * set a non-zero exit code. The exit-code policy is unchanged — `partial`
 * still exits 0 — but the run now states PARTIAL unmistakably in the
 * Step Summary and raises an Actions warning for the maintainer.
 *
 * Builds plain text from bounded numbers and allowlisted reason codes only;
 * no JD text, model output, credentials or request headers are ever included.
 */
export type RefreshStatus = "success" | "partial" | "failed";

export interface RefreshOutcomeLike {
  status?: string;
  error?: string;
  action?: string;
  success?: number; partial?: number; failed?: number;
  sources_attempted?: number;
  listed?: number; detail_success?: number; admitted?: number;
  inserted?: number; updated?: number; unchanged?: number;
  canonical_new?: number; canonical_changed?: number;
  source_records?: number; canonical_jobs_total?: number;
  extraction_pending?: number; parser_only?: number; model_calls?: number;
  extraction_success?: number; extraction_failure?: number; extraction_deferred?: number;
  ready_jobs?: number; evidence_quotes_verified?: number;
  duration_ms?: number;
  extracted?: { id: string; status: string; error?: string | null; diagnostic?: string }[];
}

export interface RefreshReport {
  status: RefreshStatus;
  title: string;
  markdown: string;
  annotation: string | null;
  exitCode: number;
}

const LABEL: Record<RefreshStatus, string> = { success: "SUCCESS", partial: "PARTIAL", failed: "FAILED" };
const SAFE_CODE = /^[a-z][a-z0-9_]{0,63}$/;
/** Rendered diagnostics are `stage:code:path#index`, so separators are allowed here. */
const SAFE_DIAGNOSTIC = /^[a-z][a-z0-9_:.[\]#]{0,159}$/;
const MAX_DIAGNOSTICS = 10;

/** Any unrecognized or missing status is reported as failed: a run must never look green by accident. */
export function refreshStatus(result: RefreshOutcomeLike): RefreshStatus {
  return result.status === "success" || result.status === "partial" || result.status === "failed" ? result.status : "failed";
}

/** Reason codes are bounded identifiers; anything else is replaced, never echoed. */
function safeCode(value: unknown, fallback = "unspecified"): string {
  return typeof value === "string" && SAFE_CODE.test(value) ? value : fallback;
}

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}

function diagnosticTally(result: RefreshOutcomeLike): [string, number][] {
  const tally = new Map<string, number>();
  for (const row of result.extracted ?? []) {
    if (row?.status !== "failed" || !row.diagnostic) continue;
    const code = typeof row.diagnostic === "string" && SAFE_DIAGNOSTIC.test(row.diagnostic) ? row.diagnostic : "unspecified";
    tally.set(code, (tally.get(code) ?? 0) + 1);
  }
  return [...tally.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
}

export function buildRefreshReport(result: RefreshOutcomeLike): RefreshReport {
  const status = refreshStatus(result);
  const lines: string[] = [`## Job Radar refresh — ${LABEL[status]}`, ""];

  if (status === "partial") {
    lines.push("> **PARTIAL** — 部分来源或部分岗位提取失败。**退出码仍为 0**（策略未变），请维护者按下方统计核查。", "");
  } else if (status === "failed") {
    lines.push("> **FAILED** — 运行未完成或写入未确认。请先检查 checkpoint 与数据库，再决定是否重试。", "");
  } else {
    lines.push("> **SUCCESS** — 全部来源与提取均正常完成。", "");
  }
  if (result.error) lines.push(`- 错误类别：\`${safeCode(result.error)}\``);
  if (status === "partial" || status === "failed") {
    lines.push(`- 提取：成功 ${count(result.extraction_success)} · 失败 ${count(result.extraction_failure)} · 延后 ${count(result.extraction_deferred)}`);
    lines.push(`- 来源：成功 ${count(result.success)} · 部分 ${count(result.partial)} · 失败 ${count(result.failed)}（共 ${count(result.sources_attempted)}）`);
  }

  lines.push("", "| 指标 | 值 |", "| --- | ---: |");
  const table: [string, string][] = [
    ["来源 成功 / 部分 / 失败", `${count(result.success)} / ${count(result.partial)} / ${count(result.failed)}`],
    ["列表读取 / 详情成功 / 准入通过", `${count(result.listed)} / ${count(result.detail_success)} / ${count(result.admitted)}`],
    ["新增来源记录 / 更新 / 未变化", `${count(result.inserted)} / ${count(result.updated)} / ${count(result.unchanged)}`],
    ["岗位 新增 / 变化 / 总计", `${count(result.canonical_new)} / ${count(result.canonical_changed)} / ${count(result.canonical_jobs_total)}`],
    ["来源记录总数", `${count(result.source_records)}`],
    ["提取 待处理 / parser-only / 模型调用", `${count(result.extraction_pending)} / ${count(result.parser_only)} / ${count(result.model_calls)}`],
    ["**提取 成功 / 失败 / 延后**", `**${count(result.extraction_success)} / ${count(result.extraction_failure)} / ${count(result.extraction_deferred)}**`],
    ["就绪岗位 / 已核验 evidence", `${count(result.ready_jobs)} / ${count(result.evidence_quotes_verified)}`],
    ["耗时 (ms)", `${count(result.duration_ms)}`],
  ];
  for (const [label, value] of table) lines.push(`| ${label} | ${value} |`);

  const tally = diagnosticTally(result);
  if (tally.length) {
    lines.push("", "### 失败诊断分布", "", "| 诊断（stage:code:path#index） | 数量 |", "| --- | ---: |");
    for (const [code, n] of tally.slice(0, MAX_DIAGNOSTICS)) lines.push(`| \`${code}\` | ${n} |`);
    if (tally.length > MAX_DIAGNOSTICS) lines.push(`| 其他 ${tally.length - MAX_DIAGNOSTICS} 类 | — |`);
  }

  // The raw result is kept for diagnosis, but the free-text error channel is
  // reduced to an allowlisted code so nothing unvetted reaches the Step Summary.
  const detail = result.error ? { ...result, error: safeCode(result.error) } : result;
  lines.push("", "<details><summary>完整结果 JSON</summary>", "", "```json", JSON.stringify(detail, null, 2), "```", "</details>", "");

  const annotation = status === "failed"
    ? `::error::Job Radar refresh FAILED (${safeCode(result.error, "refresh_unconfirmed")}). Inspect checkpoint and database before retry.`
    : status === "partial"
      ? `::warning::Job Radar refresh PARTIAL: extraction_failure=${count(result.extraction_failure)}, deferred=${count(result.extraction_deferred)}, source_failed=${count(result.failed)}, source_partial=${count(result.partial)}. See the run Step Summary.`
      : null;

  return { status, title: `Job Radar refresh — ${LABEL[status]}`, markdown: lines.join("\n"), annotation, exitCode: status === "failed" ? 1 : 0 };
}
