import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { detailAdmission, htmlText, mapJobProRecord } from "../../scripts/ingest/job-pro-adapter";
import { JobProFailure, readWithRetry } from "../../scripts/ingest/job-pro-cli";
import { parseOptions, runIngestion } from "../../scripts/ingest/run-job-pro";
import { canonicalize } from "../../src/lib/domain/canonicalize";
import { deriveReliability } from "../../src/lib/domain/source-reliability";
import type { SourceRecord } from "../../scripts/ingest/contracts";
const batch = ["alibaba", "meituan", "jd", "netease", "kuaishou", "oppo", "liauto", "antgroup"] as const;
const fixture = (key: string) => JSON.parse(readFileSync(`tests/fixtures/job-pro/${key}.json`, "utf8"));
const options = { sources: ["meituan"] as const, scope: "intern" as const, limit: 2, maxPages: 3, maxJobs: 6, globalMaxJobs: 10 };
const paged = async (args: readonly string[]) => {
  const page = Number(args[args.indexOf("--page") + 1]);
  return args[1] === "search" ? { ...fixture(`${args[0]}-search`), total: 100,
    positions: [0, 1].map(i => ({ ...fixture(`${args[0]}-search`).positions[0], post_id: String(page * 10 + i) })) }
    : { ...fixture(`${args[0]}-detail`), post_id: args[2], apply_url: fixture(`${args[0]}-detail`).apply_url.replace(fixture(`${args[0]}-detail`).post_id, args[2]) };
};

describe("Phase 1A admission and bounded expansion", () => {
  it.each(batch)("admits real %s detail without losing raw payload", source => {
    const raw = fixture(`${source}-detail`), record = mapJobProRecord(raw, source);
    expect(detailAdmission(record, source)).toBeNull();
    expect(record.raw_payload).toEqual(raw);
    expect(record.location.length).toBeGreaterThan(0);
    expect(record.source_tier).toBe("authoritative");
  });
  it("keeps Li Auto HTML verbatim in raw while decoding readable paragraphs", () => {
    const raw = fixture("liauto-detail"), record = mapJobProRecord(raw, "liauto");
    expect(record.description).toContain("1.参与高速业务");
    expect(record.description).not.toContain("<p>");
    expect(record.raw_payload).toEqual(raw);
    expect(htmlText("<p>A &amp; B</p><p>&#x4e2d;&#25991;</p>")).toBe("A & B\n中文");
  });
  it.each([
    ["source_url", null, "missing_authoritative_locator"],
    ["source_url", "https://evil.example/job/1", "untrusted_locator"],
    ["location", [], "missing_location"],
    ["location", ["未知"], "missing_location"],
  ])("rejects missing/drifted %s", (key, value, reason) => {
    const record = mapJobProRecord(fixture("meituan-detail"), "meituan");
    expect(detailAdmission({ ...record, [key as string]: value }, "meituan")).toBe(reason);
  });
  it("rejects empty, title-only, repetitive and unreadable JDs", () => {
    const record = mapJobProRecord(fixture("meituan-detail"), "meituan");
    for (const description of [null, record.title, "职责".repeat(100)])
      expect(detailAdmission({ ...record, description, requirements: null }, "meituan")).toBe("insufficient_detail");
    expect(detailAdmission({ ...record, description: record.description + "\ue123" }, "meituan")).toBe("unreadable_detail");
  });
  it("applies all eight sources through the existing runner", async () => {
    const result = await runIngestion({ ...options, sources: batch, limit: 1, maxPages: 1 }, { cli: async args => fixture(`${args[0]}-${args[1]}`) });
    expect(result.sources.map(s => s.metrics.admission_passed)).toEqual(Array(8).fill(1));
  });
  it("enforces maxPages, maxJobs, global cap and keeps caps successful/non-full-list", async () => {
    const byPage = await runIngestion({ ...options, maxPages: 2 }, { cli: paged });
    expect(byPage.globally_listed).toBe(4);
    const byJobs = await runIngestion({ ...options, maxJobs: 3 }, { cli: paged });
    expect(byJobs.globally_listed).toBe(2); // Whole stable-size pages only, never exceed the budget.
    const global = await runIngestion({ ...options, sources: ["meituan", "alibaba"], maxJobs: 4, globalMaxJobs: 5 }, { cli: paged });
    expect(global.globally_listed).toBeLessThanOrEqual(5);
    expect(global.status).toBe("success");
    expect(global.sources.every(s => s.run.full_list === false)).toBe(true);
    expect(byJobs.sources[0].metrics.stop_reason).toBe("max_jobs");
  });
  it("reruns update stable identities without duplicates", async () => {
    const records = new Map<string, SourceRecord>();
    const store = { async upsertRecord(r: SourceRecord): Promise<"new" | "updated"> {
      const k = r.source + r.source_job_id, existing = records.has(k); records.set(k, r); return existing ? "updated" : "new";
    }, writeRun: vi.fn().mockResolvedValue(undefined) };
    const first = await runIngestion(options, { cli: paged, store });
    const second = await runIngestion(options, { cli: paged, store });
    expect(records.size).toBe(6); expect(first.sources[0].run.records_new).toBe(6);
    expect(second.sources[0].run.records_new).toBe(0); expect(second.sources[0].run.records_updated).toBe(6);
  });
  it("isolates malformed/failed detail and records partial plus exact rejection reasons", async () => {
    const result = await runIngestion(options, { cli: async args => {
      if (args[1] === "detail" && args[2] === "10") return { ...await paged(args), description: "", requirements: "" };
      if (args[1] === "detail" && args[2] === "11") throw new JobProFailure("network_failed");
      return paged(args);
    } });
    expect(result.status).toBe("partial");
    expect(result.sources[0].metrics).toMatchObject({ detail_attempted: 6, detail_success: 5, admission_passed: 4, admission_rejected: 2 });
    expect(result.sources[0].metrics.failure_reasons).toEqual({ insufficient_detail: 1, network_failed: 1 });
  });
  it("does not repeatedly fetch a repeating page", async () => {
    const result = await runIngestion(options, { cli: async args => args[1] === "search" ? { ...fixture("meituan-search"), positions: [fixture("meituan-search").positions[0]] } : fixture("meituan-detail") });
    expect(result.sources[0].metrics.stop_reason).toBe("repeated_page");
    expect(result.sources[0].metrics.detail_attempted).toBe(1);
  });
  it("stops a rate-limited source but continues other selected companies", async () => {
    const result = await runIngestion({ ...options, sources: ["meituan", "alibaba"] }, { cli: async args => {
      if (args[0] === "meituan") throw new JobProFailure("rate_limited"); return paged(args);
    } });
    expect(result.sources.map(s => s.run.status)).toEqual(["failed", "success"]);
  });
  it("uses safe defaults and rejects oversized/global budgets", () => {
    expect(parseOptions(["--dry-run"])).toMatchObject({ sources: ["tencent", "xiaomi", "vivo"], limit: 5, maxPages: 1, maxJobs: 5, globalMaxJobs: 15 });
    for (const [flag, value] of [["--max-pages", "21"], ["--max-jobs", "501"], ["--global-max-jobs", "501"], ["--max-jobs", "0"]])
      expect(() => parseOptions(["--dry-run", flag, value])).toThrow();
  });
});
describe("bounded read retries", () => {
  it("retries transport failures once with backoff", async () => {
    const op = vi.fn().mockRejectedValueOnce(new Error("private secret")).mockResolvedValue({ ok: true });
    const pause = vi.fn().mockResolvedValue(undefined);
    await expect(readWithRetry(op, pause)).resolves.toEqual({ ok: true });
    expect(op).toHaveBeenCalledTimes(2); expect(pause.mock.calls).toEqual([[350], [1500]]);
  });
  it("bounds persistent failures and never leaks upstream diagnostics", async () => {
    const op = vi.fn().mockRejectedValue(new Error("private secret"));
    await expect(readWithRetry(op, async () => {})).rejects.toThrow("network_failed");
    expect(op).toHaveBeenCalledTimes(2);
  });
  it("does not retry a nonzero CLI access-control exit", async () => {
    const op = vi.fn().mockRejectedValue(Object.assign(new Error("command failed"), { stderr: "HTTP 403 private diagnostic" }));
    await expect(readWithRetry(op, async () => {})).rejects.toThrow("access_denied");
    expect(op).toHaveBeenCalledTimes(1);
  });
  it.each(["HTTP 429", "HTTP 403"])("does not retry %s", async message => {
    const op = vi.fn().mockResolvedValue({ ok: false, message });
    await expect(readWithRetry(op, async () => {})).rejects.toThrow(); expect(op).toHaveBeenCalledTimes(1);
  });
});


describe("expanded data retains frozen canonical/reliability semantics", () => {
  it("keeps 400 distinct official IDs separate with stable canonical identities", () => {
    const base = mapJobProRecord(fixture("meituan-detail"), "meituan", "2026-10-02T00:00:00Z");
    const records = Array.from({ length: 400 }, (_, i) => ({ ...base, source_job_id: String(i + 1) }));
    const first = canonicalize(records);
    expect(first.jobs).toHaveLength(400);
    const rerun = canonicalize(records, [], first.jobs);
    expect(rerun.jobs.map(j => j.id)).toEqual(first.jobs.map(j => j.id));
    expect(rerun.decisions.some(d => d.merge)).toBe(false);
  });
  it("a failed expanded source never closes existing records or increments missing", async () => {
    const result = await runIngestion(options, { cli: async () => { throw new JobProFailure("network_failed"); }, now: () => "2026-10-02T01:00:00Z" });
    const record = { ...mapJobProRecord(fixture("meituan-detail"), "meituan", "2026-10-01T00:00:00Z"), id: "prior" };
    expect(deriveReliability([record], [result.sources[0].run])).toMatchObject({ application_status: "unknown", consecutive_missing_count: 0 });
  });
});
