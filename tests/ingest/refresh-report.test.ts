import { describe, expect, it } from "vitest";
import { buildRefreshReport, refreshStatus } from "../../scripts/ingest/refresh-report";

/** A healthy baseline run: 8 sources, 5 new jobs, all extracted. */
const base = {
  sources_attempted: 8, success: 8, partial: 0, failed: 0,
  listed: 16, detail_success: 16, admitted: 16, inserted: 5, updated: 0, unchanged: 14,
  canonical_new: 5, canonical_changed: 0, source_records: 429, canonical_jobs_total: 429,
  extraction_pending: 5, parser_only: 5, model_calls: 0,
  extraction_success: 5, extraction_failure: 0, extraction_deferred: 0,
  ready_jobs: 366, evidence_quotes_verified: 400, duration_ms: 84_600,
};

describe("refresh status mapping", () => {
  it("passes the three real terminal states through", () => {
    expect(refreshStatus({ status: "success" })).toBe("success");
    expect(refreshStatus({ status: "partial" })).toBe("partial");
    expect(refreshStatus({ status: "failed" })).toBe("failed");
  });

  it("never lets an unknown or missing state look green", () => {
    expect(refreshStatus({})).toBe("failed");
    expect(refreshStatus({ status: "weird" })).toBe("failed");
  });
});

describe("refresh report visibility", () => {
  it("success stays quiet, states SUCCESS and exits 0", () => {
    const report = buildRefreshReport({ ...base, status: "success" });
    expect(report.status).toBe("success");
    expect(report.title).toContain("SUCCESS");
    expect(report.markdown).toContain("SUCCESS");
    expect(report.annotation).toBeNull();
    expect(report.exitCode).toBe(0);
  });

  it("partial is unmistakable in the summary but still exits 0", () => {
    const report = buildRefreshReport({ ...base, status: "partial", success: 7, partial: 1,
      extraction_success: 2, extraction_failure: 3, extraction_deferred: 1 });
    expect(report.status).toBe("partial");
    expect(report.title).toContain("PARTIAL");
    expect(report.markdown).toContain("PARTIAL");
    expect(report.markdown).toContain("退出码仍为 0");
    expect(report.markdown).toContain("| **提取 成功 / 失败 / 延后** | **2 / 3 / 1** |");
    expect(report.markdown).toContain("| 来源 成功 / 部分 / 失败 | 7 / 1 / 0 |");
    expect(report.annotation?.startsWith("::warning::")).toBe(true);
    expect(report.annotation).toContain("extraction_failure=3");
    expect(report.annotation).toContain("source_partial=1");
    expect(report.exitCode).toBe(0);
  });

  it("failed raises an error annotation and exits 1", () => {
    const report = buildRefreshReport({ status: "failed", error: "refresh_unconfirmed" });
    expect(report.title).toContain("FAILED");
    expect(report.markdown).toContain("FAILED");
    expect(report.annotation?.startsWith("::error::")).toBe(true);
    expect(report.annotation).toContain("refresh_unconfirmed");
    expect(report.exitCode).toBe(1);
  });

  it("summarizes failures by their located diagnostic", () => {
    const report = buildRefreshReport({ ...base, status: "failed", extraction_failure: 3, extracted: [
      { id: "a", status: "failed", error: "invalid_extraction", diagnostic: "gate:gate_contract_rejected:evidence.context" },
      { id: "b", status: "failed", error: "invalid_extraction", diagnostic: "gate:gate_contract_rejected:evidence.context" },
      { id: "c", status: "failed", error: "invalid_extraction", diagnostic: "gate:required_without_deterministic_confirmation" },
      { id: "d", status: "success" },
      { id: "e", status: "skipped" },
    ] });
    expect(report.markdown).toContain("失败诊断分布");
    expect(report.markdown).toContain("| `gate:gate_contract_rejected:evidence.context` | 2 |");
    expect(report.markdown).toContain("| `gate:required_without_deterministic_confirmation` | 1 |");
  });

  it("keeps the raw run detail available without echoing unvetted text", () => {
    const report = buildRefreshReport({ ...base, status: "failed", error: "本科及以上; apikey=secret" });
    expect(report.status).toBe("failed");
    expect(report.exitCode).toBe(1);
    expect(report.markdown).not.toContain("apikey");
    expect(report.markdown).not.toContain("本科");
    expect(report.markdown).toContain("unspecified");
    expect(report.markdown).toContain("canonical_jobs_total");
  });

  it("handles a run with no extraction counters at all", () => {
    const report = buildRefreshReport({ status: "partial" });
    expect(report.markdown).toContain("| **提取 成功 / 失败 / 延后** | **0 / 0 / 0** |");
    expect(report.exitCode).toBe(0);
  });
});
