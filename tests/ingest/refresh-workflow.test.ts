import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseOptions, runIngestion } from "../../scripts/ingest/run-job-pro";
import { sameWindowOptions } from "../../scripts/ingest/run-refresh";

/**
 * ENGINEERING-03.1: the refresh workflow may accept an optional `page_size`, but
 * the daily schedule must keep its existing page size of 2, and the pagination
 * window must stay honest (a page size that does not divide max_jobs stops short
 * instead of silently claiming a full batch).
 */
const workflow = readFileSync("docs/production/workflows/refresh.yml", "utf8");
const refreshScript = readFileSync("scripts/ingest/run-refresh.ts", "utf8");

/** Reads one `workflow_dispatch.inputs` entry without a YAML dependency. */
function inputBlock(name: string): string | null {
  const dispatch = workflow.slice(workflow.indexOf("workflow_dispatch:"));
  const start = dispatch.indexOf(`      ${name}:`);
  if (start < 0) return null;
  const rest = dispatch.slice(start + name.length + 7);
  const end = rest.search(/\n      \S/);
  return end < 0 ? rest : rest.slice(0, end);
}
const inputDefault = (name: string) => inputBlock(name)?.match(/default:\s*(.+)/)?.[1].trim() ?? null;
const envLine = (name: string) => workflow.match(new RegExp(`^\\s*${name}: (.+)$`, "m"))?.[1].trim() ?? null;

describe("refresh workflow page_size input", () => {
  it("exposes page_size as an optional number that defaults to the daily value", () => {
    expect(inputBlock("page_size")).not.toBeNull();
    expect(inputBlock("page_size")).toMatch(/type:\s*number/);
    expect(inputDefault("page_size")).toBe("2");
    // The other inputs keep their existing defaults.
    expect(inputDefault("max_jobs")).toBe("2");
    expect(inputDefault("max_pages")).toBe("1");
    expect(inputDefault("global_cap")).toBe("16");
    expect(inputDefault("model_cap")).toBe("8");
  });

  it("passes page_size through to the existing REFRESH_PAGE_SIZE with a 2 fallback", () => {
    expect(envLine("REFRESH_PAGE_SIZE")).toBe("${{ inputs.page_size || '2' }}");
    // A run without inputs falls back to 2 — and the script itself also defaults to 2.
    expect(workflow).not.toMatch(/^\s*schedule:/m);
    expect(refreshScript).toContain("process.env.REFRESH_PAGE_SIZE??'2'");
    expect(refreshScript).toContain("process.env.REFRESH_MAX_JOBS??'2'");
    expect(refreshScript).toContain("process.env.REFRESH_GLOBAL_MAX_JOBS??'16'");
  });

  it("exposes start_page as an optional number that defaults to page 1", () => {
    expect(inputBlock("start_page")).not.toBeNull();
    expect(inputBlock("start_page")).toMatch(/type:\s*number/);
    expect(inputDefault("start_page")).toBe("1");
    expect(envLine("REFRESH_START_PAGE")).toBe("${{ inputs.start_page || '1' }}");
    // Scheduled runs (no inputs) pass page 1, and the script defaults to page 1.
    expect(refreshScript).toContain("process.env.REFRESH_START_PAGE??'1'");
    expect(refreshScript).toContain("'--start-page'");
  });

  it("keeps the allowlist, model budget, permissions and timeout unchanged", () => {
    // Public release contract: manual only, so no automatic production writes.
    expect(workflow).not.toMatch(/^\s*schedule:/m);
    expect(workflow).toContain("workflow_dispatch:");
    expect(inputDefault("sources")).toBe("alibaba,meituan,jd,netease,kuaishou,oppo,liauto,antgroup");
    expect(envLine("REFRESH_SOURCES")).toBe("${{ inputs.sources || 'alibaba,meituan,jd,netease,kuaishou,oppo,liauto,antgroup' }}");
    expect(envLine("REFRESH_MODEL_CAP")).toContain("inputs.model_cap");
    expect(envLine("REFRESH_MODEL_CAP")).toContain("'8'");
    expect(workflow).toMatch(/permissions:\s*\n\s*contents: read\s*\n\s*actions: read/);
    expect(workflow).toContain("timeout-minutes: 45");
    expect(workflow).toContain("group: job-radar-production-writer");
    // No new writable surface: one install step and exactly one refresh entrypoint.
    expect(workflow).toContain("- run: npm ci");
    expect(workflow.match(/run: node --import tsx scripts\/ingest\/run-refresh\.ts/g) ?? []).toHaveLength(1);
    expect(workflow).not.toMatch(/permissions:\s*write/);
    expect(workflow).not.toContain("--sources all");
  });

  it("cannot bypass the existing budgets: the runner validates every bound", () => {
    // A manual page_size cannot widen the run beyond the frozen bounds.
    expect(() => parseOptions(["--write", "--limit", "51"])).toThrow();
    expect(() => parseOptions(["--write", "--max-pages", "21"])).toThrow();
    expect(() => parseOptions(["--write", "--max-jobs", "501"])).toThrow();
    expect(() => parseOptions(["--write", "--global-max-jobs", "501"])).toThrow();
    expect(() => parseOptions(["--write", "--sources", "all"])).toThrow();
    // The intended 40-record pilot is accepted verbatim (source stays allowlisted).
    expect(parseOptions(["--write", "--sources", "xiaomi", "--scope", "intern", "--limit", "20", "--max-pages", "2", "--max-jobs", "40", "--global-max-jobs", "40"]))
      .toEqual({ sources: ["xiaomi"], scope: "intern", limit: 20, maxPages: 2, maxJobs: 40, globalMaxJobs: 40, startPage: 1, dryRun: false });
  });
});

describe("pagination window arithmetic", () => {
  const fixture = (name: string) => JSON.parse(readFileSync(`tests/fixtures/job-pro/${name}.json`, "utf8"));
  /** Search returns exactly `pageSize` distinct ids per page; detail maps 1:1. */
  const paged = (pageSize: number) => async (args: readonly string[]) => {
    if (args[1] === "search") {
      const page = Number(args[args.indexOf("--page") + 1]);
      const base = fixture("xiaomi-search").positions[0];
      return {
        ...fixture("xiaomi-search"),
        total: 100,
        positions: Array.from({ length: pageSize }, (_, index) => ({ ...base, post_id: String(page * 1000 + index) })),
      };
    }
    return { ...fixture("xiaomi-detail"), post_id: args[2], apply_url: `https://xiaomi.jobs.f.mioffice.cn/campus/position/${args[2]}/detail` };
  };

  it("page_size 20 × 2 pages reaches the 40-job cap", async () => {
    const result = await runIngestion({ sources: ["xiaomi"], scope: "intern", limit: 20, maxPages: 2, maxJobs: 40, globalMaxJobs: 40 }, { cli: paged(20) });
    const metrics = result.sources[0].metrics;
    expect(metrics.pages_fetched).toBe(2);
    expect(metrics.listed).toBe(40);
    expect(metrics.detail_attempted).toBe(40);
    expect(metrics.stop_reason).toBe("max_jobs");
    expect(result.globally_listed).toBe(40);
  });

  it("page_size 25 with max_jobs 40 stops at 25 and never claims 40", async () => {
    const result = await runIngestion({ sources: ["xiaomi"], scope: "intern", limit: 25, maxPages: 2, maxJobs: 40, globalMaxJobs: 40 }, { cli: paged(25) });
    const metrics = result.sources[0].metrics;
    expect(metrics.pages_fetched).toBe(1);
    expect(metrics.listed).toBe(25);
    expect(metrics.stop_reason).toBe("max_jobs");
    // The reported counts stay truthful: no rounding up to the requested cap.
    expect(result.globally_listed).toBe(25);
    expect(result.sources[0].run.records_seen).toBe(25);
  });

  it("page_size 2 keeps the daily window unchanged", async () => {
    const result = await runIngestion({ sources: ["xiaomi"], scope: "intern", limit: 2, maxPages: 1, maxJobs: 2, globalMaxJobs: 16 }, { cli: paged(2) });
    expect(result.sources[0].metrics.listed).toBe(2);
    expect(result.sources[0].metrics.pages_fetched).toBe(1);
  });
});

describe("start_page window", () => {
  const fixture = (name: string) => JSON.parse(readFileSync(`tests/fixtures/job-pro/${name}.json`, "utf8"));
  /** Records every requested page and returns `pageSize` distinct ids per page. */
  const recording = (pageSize: number, total = 100) => {
    const pages: number[] = [];
    const cli = async (args: readonly string[]) => {
      if (args[1] === "search") {
        const page = Number(args[args.indexOf("--page") + 1]);
        pages.push(page);
        const base = fixture("xiaomi-search").positions[0];
        const offset = (page - 1) * pageSize;
        const remaining = Math.max(0, total - offset);
        return {
          ...fixture("xiaomi-search"), total,
          positions: Array.from({ length: Math.min(pageSize, remaining) }, (_, index) => ({ ...base, post_id: String(page * 1000 + index) })),
        };
      }
      return { ...fixture("xiaomi-detail"), post_id: args[2], apply_url: `https://xiaomi.jobs.f.mioffice.cn/campus/position/${args[2]}/detail` };
    };
    return { cli, pages };
  };

  it("fetches only the requested page and never re-reads earlier pages", async () => {
    const { cli, pages } = recording(25);
    const result = await runIngestion({ sources: ["xiaomi"], scope: "intern", limit: 25, maxPages: 1, maxJobs: 25, globalMaxJobs: 25, startPage: 3 }, { cli });
    const source = result.sources[0];
    expect(pages).toEqual([3]);
    expect(source.metrics.pages_fetched).toBe(1);
    expect(source.metrics.listed).toBe(25);
    expect(source.metrics.detail_attempted).toBe(25);
    expect(source.metrics.admission_passed).toBe(25);
    // max_jobs equals page_size, so the job budget is what stops the run.
    expect(source.metrics.stop_reason).toBe("max_jobs");
    // records_seen counts processed records, not the positions skipped before page 3.
    expect(source.run.records_seen).toBe(25);
    expect(result.globally_listed).toBe(25);
    expect(result.limits.startPage).toBe(3);
    // With headroom left, the single-page budget is what ends the run.
    const roomy = await runIngestion({ sources: ["xiaomi"], scope: "intern", limit: 25, maxPages: 1, maxJobs: 50, globalMaxJobs: 50, startPage: 3 }, { cli: recording(25).cli });
    expect(roomy.sources[0].metrics.stop_reason).toBe("max_pages");
    expect(roomy.sources[0].metrics.listed).toBe(25);
  });

  it("keeps the default daily window exactly as before", async () => {
    const { cli, pages } = recording(2);
    const result = await runIngestion({ sources: ["xiaomi"], scope: "intern", limit: 2, maxPages: 1, maxJobs: 2, globalMaxJobs: 16 }, { cli });
    expect(pages).toEqual([1]);
    expect(result.limits.startPage).toBe(1);
    expect(result.sources[0].run.records_seen).toBe(2);
  });

  it("reports query_exhausted when the start page is past the last record", async () => {
    const { cli } = recording(25, 60);
    const result = await runIngestion({ sources: ["xiaomi"], scope: "intern", limit: 25, maxPages: 2, maxJobs: 50, globalMaxJobs: 50, startPage: 3 }, { cli });
    expect(result.sources[0].metrics.listed).toBe(10);
    expect(result.sources[0].metrics.stop_reason).toBe("query_exhausted");
    expect(result.sources[0].run.records_seen).toBe(10);
  });

  it("still detects a repeated page and the job budget from a later start", async () => {
    const base = fixture("xiaomi-search").positions[0];
    const same = { ...fixture("xiaomi-search"), total: 100, positions: [base, base].map((item, index) => ({ ...item, post_id: String(index) })) };
    const repeated = await runIngestion({ sources: ["xiaomi"], scope: "intern", limit: 2, maxPages: 3, maxJobs: 6, globalMaxJobs: 6, startPage: 2 }, {
      cli: async (args: readonly string[]) => args[1] === "search" ? same : fixture("xiaomi-detail"),
    });
    expect(repeated.sources[0].metrics.stop_reason).toBe("repeated_page");

    const { cli } = recording(25);
    const capped = await runIngestion({ sources: ["xiaomi"], scope: "intern", limit: 25, maxPages: 2, maxJobs: 40, globalMaxJobs: 40, startPage: 3 }, { cli });
    // 25 records fit; the next page would exceed the 40-job budget, so it stops short.
    expect(capped.sources[0].metrics.listed).toBe(25);
    expect(capped.sources[0].metrics.stop_reason).toBe("max_jobs");
  });

  it("rejects a start page outside the controlled range", async () => {
    const { cli } = recording(2);
    for (const startPage of [0, 21]) {
      await expect(runIngestion({ sources: ["xiaomi"], scope: "intern", limit: 2, maxJobs: 2, startPage }, { cli })).rejects.toThrow(/start page/i);
    }
    // start_page + max_pages − 1 must stay within the 20-page range.
    await expect(runIngestion({ sources: ["xiaomi"], scope: "intern", limit: 2, maxPages: 10, maxJobs: 2, startPage: 15 }, { cli })).rejects.toThrow(/page range/i);
    expect(() => parseOptions(["--write", "--start-page", "0"])).toThrow();
    expect(() => parseOptions(["--write", "--start-page", "21"])).toThrow();
    expect(parseOptions(["--write", "--start-page", "20"]).startPage).toBe(20);
    expect(parseOptions(["--write"]).startPage).toBe(1);
  });

  it("refuses to resume a checkpoint whose window changed", () => {
    const daily = parseOptions(["--write", "--sources", "xiaomi", "--scope", "intern", "--limit", "2", "--max-pages", "1", "--max-jobs", "2", "--global-max-jobs", "16"]);
    // A checkpoint written before start_page existed resumes as page 1.
    expect(sameWindowOptions({ ...daily, startPage: undefined }, daily)).toBe(true);
    expect(sameWindowOptions({ ...daily }, daily)).toBe(true);
    // Changing the start page, page size or caps must be rejected.
    expect(sameWindowOptions({ ...daily, startPage: 3 }, daily)).toBe(false);
    expect(sameWindowOptions({ ...daily, limit: 25 }, daily)).toBe(false);
    expect(sameWindowOptions({ ...daily, maxJobs: 40 }, daily)).toBe(false);
  });
});
