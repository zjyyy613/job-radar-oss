import { describe, expect, it } from "vitest";
import { evaluateAudit, renderMarkdown, type AuditInput, type AuditMetrics } from "../../scripts/ingest/candidate-audit";

const record = (over: Partial<AuditInput["records"][number]> = {}) => ({
  source: "job-pro:xpeng", source_job_id: "7698647256014489898", company: "小鹏汽车",
  title: "算法实习生", location: ["北京"], source_url: "https://xiaopeng.jobs.feishu.cn/campus/position/7698647256014489898/detail",
  description: "岗位职责".repeat(20), requirements: "任职要求".repeat(20), ...over,
}) as AuditInput["records"][number];

const metrics = (over: Partial<AuditMetrics> = {}): AuditMetrics => ({
  pages_fetched: 1, listed: 1, duplicate_ids: 0, detail_attempted: 1, detail_success: 1,
  admission_passed: 1, admission_rejected: 0, failure_reasons: {}, stop_reason: "max_jobs",
  search_ms: 1000, detail_ms: 2000, upsert_ms: 0, duration_ms: 3000, rejections: [], ...over,
});

const input = (over: Partial<AuditInput> = {}): AuditInput => ({
  sources: ["xpeng"], scope: "intern",
  window: { startPage: 1, pageSize: 25, maxPages: 1, maxJobs: 25, globalMaxJobs: 25 },
  records: [record()], runs: [{ source: "job-pro:xpeng", status: "success", records_seen: 1 }],
  metrics: [metrics()], dedupVerified: true,
  upstream: { xpeng: "xiaopeng.jobs.feishu.cn" }, ...over,
});

describe("candidate audit verdicts", () => {
  it("PASSes only when every automated check passes and de-duplication was verified", () => {
    const report = evaluateAudit(input());
    expect(report.verdict).toBe("PASS");
    expect(report.reasons).toEqual([]);
    expect(report.mode).toBe("read-only");
  });

  it("never reaches PASS without production de-duplication, and never claims net new", () => {
    const report = evaluateAudit(input({ dedupVerified: false }));
    expect(report.verdict).toBe("REVIEW");
    expect(report.reasons.map((r) => r.code)).toContain("production_dedup_unverified");
    // Candidate count is not a net gain claim.
    expect(report.counts.candidates).toBe(1);
    expect(report.net_new.confirmed).toBe(false);
    expect(report.caveats.join()).toMatch(/净新增未确认/);
  });

  it("raises REVIEW when the classifier cannot place enough candidates", () => {
    const titles = ["新零售实习生（北京大区）", "交付实习生（广州大区）", "售后实习生（宁波）", "算法实习生"];
    const report = evaluateAudit(input({ records: titles.map((title, index) => record({ title, source_job_id: String(index) })) }));
    expect(report.verdict).toBe("REVIEW");
    expect(report.reasons.map((r) => r.code)).toContain("unclassified_heavy");
    expect(report.categories.unclassified_ratio).toBeGreaterThanOrEqual(0.3);
  });

  it.each([
    ["access_denied", "fatal_source_failure"],
    ["rate_limited", "fatal_source_failure"],
    ["source_timeout", "fatal_source_failure"],
    ["challenge_page", "fatal_source_failure"],
  ])("STOPs on a %s source failure", (reason, code) => {
    const report = evaluateAudit(input({ metrics: [metrics({ failure_reasons: { [reason]: 1 } })] }));
    expect(report.verdict).toBe("STOP");
    expect(report.reasons.map((r) => r.code)).toContain(code);
  });

  it("STOPs when nothing is admitted or the window is out of range", () => {
    const none = evaluateAudit(input({ records: [], metrics: [metrics({ admission_passed: 0 })] }));
    expect(none.verdict).toBe("STOP");
    expect(none.reasons.map((r) => r.code)).toContain("no_admitted_candidates");

    const outOfRange = evaluateAudit(input({ window: { startPage: 15, pageSize: 25, maxPages: 10, maxJobs: 25, globalMaxJobs: 25 } }));
    expect(outOfRange.verdict).toBe("STOP");
    expect(outOfRange.reasons.map((r) => r.code)).toContain("window_out_of_range");
  });

  it("STOPs when the measured speed would exceed the per-source budget", () => {
    const report = evaluateAudit(input({ metrics: [metrics({ duration_ms: 60_000, admission_passed: 1 })] }));
    expect(report.verdict).toBe("STOP");
    expect(report.reasons.map((r) => r.code)).toContain("projected_timeout");
    expect(report.timing.projected_ratio).toBeGreaterThan(1);
  });

  it("reports rejected candidates, mixed recruit signals, thin JD and budget mismatches as REVIEW", () => {
    const report = evaluateAudit(input({
      records: [record(), record({ source_job_id: "2", title: "【27届校招】正式工程师", description: "--", requirements: null })],
      metrics: [metrics({ detail_attempted: 2, admission_passed: 1, admission_rejected: 1, rejections: [{ source_job_id: "2", reason: "insufficient_detail" }] })],
      window: { startPage: 1, pageSize: 20, maxPages: 1, maxJobs: 40, globalMaxJobs: 40 },
    }));
    const codes = report.reasons.map((r) => r.code);
    expect(report.verdict).toBe("REVIEW");
    expect(codes).toEqual(expect.arrayContaining(["rejected_candidates", "mixed_recruit_signals", "thin_jd", "window_under_budget"]));
    expect(report.failures).toEqual([{ source_job_id: "2", reason: "insufficient_detail" }]);
  });

  it("flags candidates whose locator is not the official host or misses its id", () => {
    const report = evaluateAudit(input({ records: [record({ source_url: "https://example.com/job/1" })] }));
    expect(report.counts.unofficial_urls).toBe(1);
    expect(report.reasons.map((r) => r.code)).toContain("unofficial_locator");
    expect(report.verdict).toBe("REVIEW");
  });

  it("renders a markdown report that states the verdict and refuses to claim net new", () => {
    const markdown = renderMarkdown(evaluateAudit(input({ dedupVerified: false })));
    expect(markdown).toContain("**REVIEW**");
    expect(markdown).toContain("净新增状态");
    expect(markdown).toContain("**未确认**");
    expect(markdown).toContain("不代表获得生产写入授权");
    expect(markdown).toContain("7698647256014489898");
  });
});
