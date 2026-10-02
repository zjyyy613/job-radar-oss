import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { runIngestion, parseOptions } from "../../scripts/ingest/run-job-pro";
import type { IngestionStore } from "../../scripts/ingest/source-store";

const fixture = (name: string) => JSON.parse(readFileSync(`tests/fixtures/job-pro/${name}.json`, "utf8"));
const options = { sources: ["tencent", "xiaomi", "vivo"] as const, scope: "campus" as const, limit: 1 };
const clock = () => "2026-09-27T17:00:00.000Z";
const fixtureCli = async (args: readonly string[]) => fixture(`${args[0]}-${args[1]}`);
const store = () => ({ upsertRecord: vi.fn<IngestionStore["upsertRecord"]>().mockResolvedValue("new"), writeRun: vi.fn<IngestionStore["writeRun"]>().mockResolvedValue(undefined) });

describe("bounded job-pro runner (offline)", () => {
  it("routes three real fixtures through the frozen SourceRecord and audits each company", async () => {
    const persistence = store();
    const cli = vi.fn(fixtureCli);
    const result = await runIngestion(options, { cli, store: persistence, now: clock });
    expect(result.status).toBe("success");
    expect(persistence.upsertRecord).toHaveBeenCalledTimes(3);
    expect(persistence.writeRun).toHaveBeenCalledTimes(3);
    expect(persistence.upsertRecord.mock.calls.map(([record]) => record.source)).toEqual(["job-pro:tencent", "job-pro:xiaomi", "job-pro:vivo"]);
    expect(cli.mock.calls.filter(([args]) => args[1] === "search").map(([args]) => args)).toEqual(
      options.sources.map((source) => [source, "search", "", "--scope", "campus", "--page-size", "1", "--page", "1", "--compact"]),
    );
    for (const [run] of persistence.writeRun.mock.calls) {
      expect(run).toMatchObject({ full_list: false, status: "success", records_seen: 1, records_new: 1, records_updated: 0, adapter_version: "job-pro-1.2.1/adapter-2" });
    }
  });

  it("continues after a source search failure and reports a partial overall run", async () => {
    const persistence = store();
    const cli = async (args: readonly string[]) => args[0] === "xiaomi" ? { ok: false, error: "403" } : fixtureCli(args);
    const result = await runIngestion(options, { cli, store: persistence, now: clock });
    expect(result.status).toBe("partial");
    expect(persistence.upsertRecord).toHaveBeenCalledTimes(2);
    expect(persistence.writeRun.mock.calls.map(([run]) => run.status)).toEqual(["success", "failed", "success"]);
    expect(persistence.writeRun.mock.calls[1][0]).toMatchObject({ error_type: "search_failed", records_seen: 0, full_list: false });
  });

  it("skips failed detail without downgrading a prior rich record to sparse search data", async () => {
    const persistence = store();
    const cli = async (args: readonly string[]) => {
      if (args[1] === "search") return fixture("tencent-search");
      if (args[2] !== fixture("tencent-detail").post_id) throw new Error("private upstream error");
      return fixture("tencent-detail");
    };
    const result = await runIngestion({ ...options, sources: ["tencent"], limit: 2 }, { cli, store: persistence, now: clock });
    expect(result.status).toBe("partial");
    expect(persistence.upsertRecord).toHaveBeenCalledTimes(1);
    expect(persistence.writeRun.mock.calls[0][0]).toMatchObject({ status: "partial", records_seen: 2, records_new: 1, error_type: "detail_failed" });
    expect(JSON.stringify(result)).not.toContain("private upstream error");
  });

  it("rejects detail identity mismatches rather than writing the wrong posting", async () => {
    const persistence = store();
    const cli = async (args: readonly string[]) => args[1] === "search" ? fixture("tencent-search") : { ...fixture("tencent-detail"), post_id: "999" };
    const result = await runIngestion({ ...options, sources: ["tencent"] }, { cli, store: persistence, now: clock });
    expect(result.status).toBe("failed");
    expect(persistence.upsertRecord).not.toHaveBeenCalled();
    expect(persistence.writeRun.mock.calls[0][0].error_type).toBe("invalid_record");
  });

  it("isolates database record failure, persists failed audit, and continues other companies", async () => {
    const persistence = store();
    persistence.upsertRecord.mockRejectedValueOnce(new Error("write failed"));
    const result = await runIngestion(options, { cli: fixtureCli, store: persistence, now: clock });
    expect(result.status).toBe("partial");
    expect(persistence.writeRun.mock.calls.map(([run]) => run.status)).toEqual(["failed", "success", "success"]);
    expect(result.sources[0].records_written).toBe(0);
  });

  it("surfaces audit persistence failure and does not pretend the run was recorded", async () => {
    const persistence = store();
    persistence.writeRun.mockRejectedValueOnce(new Error("credential must not appear"));
    const result = await runIngestion(options, { cli: fixtureCli, store: persistence, now: clock });
    expect(result.status).toBe("partial");
    expect(result.sources[0].audit_written).toBe(false);
    expect(result.sources[0].audit_error).toBe("source_runs write failed");
    expect(persistence.upsertRecord).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(result)).not.toContain("credential");
  });

  it("dry-run maps real data but reports zero database writes", async () => {
    const result = await runIngestion(options, { cli: fixtureCli, now: clock });
    expect(result.dry_run).toBe(true);
    expect(result.sources.map((source) => source.records_mapped)).toEqual([1, 1, 1]);
    expect(result.sources.every((source) => source.records_written === 0 && !source.audit_written)).toBe(true);
  });

  it("zero results are a bounded successful query, never a full-list closure signal", async () => {
    const persistence = store();
    const result = await runIngestion({ ...options, sources: ["tencent"] }, { cli: async () => ({ ...fixture("tencent-search"), positions: [], total: 0 }), store: persistence, now: clock });
    expect(result.sources[0].run).toMatchObject({ status: "success", records_seen: 0, full_list: false });
    expect(persistence.upsertRecord).not.toHaveBeenCalled();
  });

  it("does not mark an inconsistent nonempty-total/empty-page response as success", async () => {
    const persistence = store();
    const result = await runIngestion({ ...options, sources: ["tencent"] }, {
      cli: async () => ({ ...fixture("tencent-search"), positions: [], total: 404 }), store: persistence, now: clock,
    });
    expect(result.status).toBe("failed");
    expect(result.sources[0].run).toMatchObject({ status: "failed", error_type: "search_failed", full_list: false });
    expect(persistence.upsertRecord).not.toHaveBeenCalled();
  });

  it("bounds a slow company so later companies still run within the workflow time budget", async () => {
    let elapsed = 0;
    const timer = vi.spyOn(performance, "now").mockImplementation(() => elapsed);
    const persistence = store();
    try {
      const cli = async (args: readonly string[]) => {
        if (args[0] === "tencent") elapsed = 300_001;
        return fixtureCli(args);
      };
      const result = await runIngestion(options, { cli, store: persistence, now: clock });
      expect(result.sources[0].run).toMatchObject({ status: "failed", error_type: "source_timeout" });
      expect(result.sources.slice(1).map((source) => source.run.status)).toEqual(["success", "success"]);
      expect(persistence.upsertRecord).toHaveBeenCalledTimes(2);
    } finally { timer.mockRestore(); }
  });

  it.each([[], ["--dry-run", "--sources", "all"], ["--dry-run", "--limit", "0"], ["--dry-run", "--limit", "51"], ["--dry-run", "--scope", "social"], ["--unknown"], ["--dry-run", "--sources", "tencent,tencent"]].map((args) => ({ args })))("rejects unsafe/missing execution options %#", ({ args }) => {
    expect(() => parseOptions(args)).toThrow();
  });

  it("requires explicit dry-run or write mode and supports a bounded manual subset", () => {
    expect(parseOptions(["--dry-run", "--sources", "tencent,vivo", "--limit", "2"])).toEqual({ sources: ["tencent", "vivo"], scope: "campus", limit: 2, maxPages: 1, maxJobs: 5, globalMaxJobs: 15, dryRun: true });
    expect(parseOptions(["--write"]).dryRun).toBe(false);
    expect(() => parseOptions(["--write", "--dry-run"])).toThrow();
  });
});
