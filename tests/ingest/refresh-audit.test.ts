import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderRefreshMarkdown, summarizeRefresh, type RefreshSummary } from "../../scripts/ingest/refresh-audit";

const history = () => JSON.parse(readFileSync("tests/fixtures/refresh/xiaomi-04b-partial.json", "utf8")) as RefreshSummary;
const base = (over: Partial<RefreshSummary> = {}): RefreshSummary => ({
  status: "success", success: 1, partial: 0, failed: 0, sources_attempted: 1,
  listed: 25, detail_success: 25, admitted: 25, inserted: 25, updated: 0, unchanged: 0,
  canonical_new: 25, canonical_changed: 0, extraction_pending: 25, parser_only: 4, model_calls: 4,
  extraction_success: 22, extraction_failure: 0, extraction_deferred: 0, ready_jobs: 22,
  evidence_quotes_verified: 22, duration_ms: 78_000,
  source_runs: [{
    source: "job-pro:xpeng", status: "success", records_seen: 25, pages_fetched: 1, stop_reason: "max_jobs",
    failure_reasons: {}, duration_ms: 78_000, search_ms: 6_000, detail_ms: 71_000, upsert_ms: 1_000,
  }],
  ...over,
});

describe("post-run audit", () => {
  it("surfaces PARTIAL and never treats the green Actions result as success", () => {
    const audit = summarizeRefresh(history(), { batch: { max_calls: 20 } });
    expect(audit.internal_status).toBe("partial");
    expect(audit.verdict).toBe("REVIEW");
    // The pipeline exits 0 on partial, which is exactly why the report must say so.
    expect(audit.exit_code).toBe(0);
    expect(audit.human_actions.join()).toMatch(/PARTIAL/);
    expect(audit.human_actions.join()).toMatch(/不要仅凭 Actions 绿色判定成功/);
  });

  it("reports the real net new from inserts, not from the candidate count", () => {
    const audit = summarizeRefresh(history());
    expect(audit.writes.inserted).toBe(38);
    expect(audit.baseline.jobs).toBe(472);
    expect(audit.caveats.join()).toMatch(/候选数不能替代/);
  });

  it("lists extraction failures with diagnostics and forbids unauthorised retries", () => {
    const audit = summarizeRefresh(history());
    expect(audit.extraction.failure).toBe(10);
    expect(audit.extraction.success).toBe(28);
    const failed = audit.extractions.filter((row) => row.status === "failed");
    expect(failed).toHaveLength(10);
    expect(new Set(failed.map((row) => row.diagnostic))).toEqual(new Set([
      "required_without_deterministic_confirmation", "minimum_not_confirmed_by_quote",
      "student_status_not_confirmed_by_quote", "preferred_context_marked_mandatory",
      "metadata_branches_ungrounded", "unsupported_branches_present",
    ]));
    expect(audit.human_actions.join()).toMatch(/不得无授权重试模型/);
  });

  it("attributes the timeout from the per-source stage timings", () => {
    const audit = summarizeRefresh(history());
    const [source] = audit.timing.per_source;
    expect(source.stop_reason).toBe("source_timeout");
    expect(source.duration_ms).toBe(303_114);
    expect(source.detail_ms).toBeGreaterThan(source.search_ms);
    expect(audit.failures).toEqual([{ source: "job-pro:xiaomi", reason: "source_timeout", count: 1 }]);
    expect(audit.human_actions.join()).toMatch(/source_timeout/);
  });

  it("reports the model budget against the checkpoint cap", () => {
    const audit = summarizeRefresh(history(), { batch: { max_calls: 20 } });
    expect(audit.model.calls).toBe(10);
    expect(audit.model.cap).toBe(20);
    expect(audit.model.budget_used_ratio).toBe(0.5);
  });

  it("PASSes a clean run and STOPs a failed one", () => {
    const clean = summarizeRefresh(base());
    expect(clean.verdict).toBe("PASS");
    expect(clean.human_actions).toEqual([]);

    const failedRun = summarizeRefresh(base({ status: "failed", error: "writer lock" }));
    expect(failedRun.verdict).toBe("STOP");
    expect(failedRun.exit_code).toBe(1);
    expect(failedRun.human_actions.join()).toMatch(/FAILED/);
  });

  it("flags deferred extraction without retrying it", () => {
    const audit = summarizeRefresh(base({ extraction_deferred: 3 }));
    expect(audit.verdict).toBe("PASS");
    expect(audit.human_actions.join()).toMatch(/延后/);
    expect(audit.human_actions.join()).toMatch(/不要自动重试/);
  });

  it("renders a report that reuses the existing step summary and shows the verdict", () => {
    const summary = history();
    const markdown = renderRefreshMarkdown(summarizeRefresh(summary, { batch: { max_calls: 20 } }), summary);
    expect(markdown).toContain("**PARTIAL**");
    expect(markdown).toContain("**REVIEW**");
    expect(markdown).toContain("附：既有 refresh Step Summary");
    expect(markdown).toContain("新增（inserted）");
  });
});
