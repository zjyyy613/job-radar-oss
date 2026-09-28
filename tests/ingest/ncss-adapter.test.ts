import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { SourceRecord } from "../../src/lib/domain/source-record";

const python = process.env.NCSS_PYTHON || (process.platform === "win32" ? "py" : "python3");
const prefix = !process.env.NCSS_PYTHON && process.platform === "win32" ? ["-3"] : [];

describe("NCSS Python boundary (offline)", () => {
  it("passes adapter, failure isolation and store unit tests without Playwright or network", () => {
    const result = spawnSync(python, [...prefix, "-m", "unittest", "discover", "-s", "tests/ingest", "-p", "test_ncss.py"], { encoding: "utf8", timeout: 30_000 });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });

  it("emits exactly the frozen SourceRecord keys across the Python boundary", () => {
    const result = spawnSync(python, [...prefix, "-c", `import json,runpy; from pathlib import Path; a=runpy.run_path('scripts/ingest/ncss-adapter.py'); raw=json.loads(Path('tests/fixtures/ncss/list-live.json').read_text(encoding='utf-8-sig'))['data']['list'][0]; print(json.dumps(a['map_record'](raw,'2026-09-28T03:00:00.000Z')))`], {
      cwd: resolve("."), encoding: "utf8", timeout: 30_000,
    });
    expect(result.status, result.stderr).toBe(0);
    const record: unknown = JSON.parse(result.stdout);
    const contract = {
      source: "ncss", source_family: "public_employment", source_tier: "trusted_aggregator",
      source_job_id: "", source_url: "", company: "", title: "", location: [],
      internship_type: null, recruitment_batch: null, salary: null, industry: null,
      company_nature: null, company_size: null, welfare: [], published_at: null,
      deadline: null, description: null, requirements: null, apply_url: null,
      fetched_at: "", last_seen_at: "", raw_hash: "", raw_payload: {},
    } satisfies SourceRecord;
    expect(Object.keys(record as object).sort()).toEqual(Object.keys(contract).sort());
    expect(record).toMatchObject({ source: "ncss", source_family: "public_employment", location: ["北京"], raw_hash: expect.stringMatching(/^[a-f0-9]{64}$/) });
  });
});
