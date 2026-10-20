import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseOptions, runIngestion } from "../../scripts/ingest/run-job-pro";

/**
 * ENGINEERING-03.1: the refresh workflow may accept an optional `page_size`, but
 * the daily schedule must keep its existing page size of 2, and the pagination
 * window must stay honest (a page size that does not divide max_jobs stops short
 * instead of silently claiming a full batch).
 */
const workflow = readFileSync(".github/workflows/refresh.yml", "utf8");
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
    // A scheduled run supplies no inputs, so the shell falls back to 2 — and the
    // script itself also defaults to 2 if the variable is ever absent.
    expect(workflow).toMatch(/schedule:\s*\n\s*- cron: '17 23 \* \* \*'/);
    expect(refreshScript).toContain("process.env.REFRESH_PAGE_SIZE??'2'");
    expect(refreshScript).toContain("process.env.REFRESH_MAX_JOBS??'2'");
    expect(refreshScript).toContain("process.env.REFRESH_GLOBAL_MAX_JOBS??'16'");
  });

  it("keeps the schedule, allowlist, model budget, permissions and timeout unchanged", () => {
    expect(workflow).toContain("cron: '17 23 * * *'");
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
      .toEqual({ sources: ["xiaomi"], scope: "intern", limit: 20, maxPages: 2, maxJobs: 40, globalMaxJobs: 40, dryRun: false });
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
