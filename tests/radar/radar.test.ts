import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  queryRadar,
  JOB_COLUMNS,
  SOURCE_COLUMNS,
  safeExternalUrl,
  type JobReadModel,
  type ReadRows,
} from "../../src/lib/data/job-read-model";
import {
  loadRadarState,
  radarUrl,
  fullDetailUrl,
  safeRadarReturn,
} from "../../src/lib/radar/url-state";
import {
  selectJobs,
  checkReason,
  secondarySignal,
} from "../../src/lib/radar/presentation";
import { emptyGuestProfile } from "../../src/lib/profile/local-profile";
import { evaluateQualification } from "../../src/lib/domain/qualification-engine";
import { record } from "../fixtures/canonical";
import type { Gate } from "../../src/lib/domain/gate";
const profile = emptyGuestProfile().qualification;
const gate: Gate = {
  id: "education",
  field: "education",
  requirement: "required",
  scope: "job",
  value: { kind: "education_minimum", value: "master" },
  evidence: [{ source: "requirements", quote: "硕士及以上", context: null }],
  note: null,
};
function job(id = "1", overrides: Partial<JobReadModel> = {}): JobReadModel {
  const source = record(id);
  return {
    ...source,
    id,
    application_status: "open",
    source_record_ids: [source.id],
    gates: [],
    raw_content_hash: "current",
    extraction_version: "test",
    extracted_at: null,
    extractor_type: "deterministic",
    consecutive_missing_count: 0,
    extraction_status: "success",
    extraction_input_hash: "current",
    extraction_attempt_hash: "current",
    extraction_error: null,
    sources: [source],
    ...overrides,
  };
}
it("city facets preserve jobs, qualification/search/sort and do not duplicate multi-city rows", async () => {
  const jobs = [
    job("1", { location: ["北京市,上海市", "北京顺义区"] }),
    job("2", { location: ["广东省-深圳市"] }),
  ];
  const before = JSON.stringify(jobs);
  const state = await loadRadarState({
    city: "北京市",
    q: jobs[0].title,
    sort: "freshness",
  });
  const selected = selectJobs(jobs, profile, state);
  expect(selected.map((row) => row.job.id)).toEqual(["1"]);
  expect(selected[0].result).toEqual(
    evaluateQualification(
      profile,
      jobs[0].gates,
      jobs[0].application_status,
      jobs[0],
    ),
  );
  expect(JSON.stringify(jobs)).toBe(before);
});
describe("Task 7 read boundary", () => {
  it("requests all readiness fields, canonical content and provenance without raw payload", async () => {
    const calls: { table: string; params: Record<string, string> }[] = [];
    const read: ReadRows = async <T>(
      table: string,
      params: Record<string, string>,
    ) => {
      calls.push({ table, params });
      return (
        table === "jobs"
          ? [job()]
          : table === "source_records"
            ? [record()]
            : []
      ) as T[];
    };
    const data = await queryRadar(read);
    for (const key of [
      "raw_content_hash",
      "extraction_input_hash",
      "extraction_attempt_hash",
      "extraction_status",
      "extraction_error",
      "gates",
      "application_status",
      "description",
      "requirements",
      "apply_url",
    ])
      expect(JOB_COLUMNS.split(",")).toContain(key);
    expect(calls.find((c) => c.table === "source_records")?.params.select).toBe(
      SOURCE_COLUMNS,
    );
    expect(SOURCE_COLUMNS).not.toContain("raw_payload");
    expect(data.jobs[0].extraction_status).toBe("success");
    expect(data.jobs[0].sources).toHaveLength(1);
  });
  it("isolates partial source failure and picks latest run per source", async () => {
    const runs = [
      { source: "bad", status: "failed", finished_at: "2026-09-29" },
      { source: "good", status: "success", finished_at: "2026-09-28" },
      { source: "bad", status: "success", finished_at: "2026-09-27" },
    ];
    const read: ReadRows = async <T>(table: string) =>
      (table === "jobs"
        ? [job()]
        : table === "source_runs"
          ? runs
          : [record()]) as T[];
    const data = await queryRadar(read);
    expect(data.jobs).toHaveLength(1);
    expect(data.sourceHealth).toHaveLength(2);
    expect(data.sourceHealth[0].status).toBe("failed");
    expect(data.jobs[0].application_status).toBe("open");
  });
  it("metadata transport failure preserves jobs with warning", async () => {
    const read: ReadRows = async <T>(table: string) => {
      if (table !== "jobs") throw Error("offline");
      return [job()] as T[];
    };
    const data = await queryRadar(read);
    expect(data.jobs).toHaveLength(1);
    expect(data.warnings).toHaveLength(2);
  });
  it("job fetch error is not converted to empty success", async () => {
    await expect(
      queryRadar(async () => {
        throw Error("offline");
      }),
    ).rejects.toThrow("offline");
  });
  it("empty database stays empty", async () => {
    expect((await queryRadar(async () => [])).jobs).toEqual([]);
  });
  it("credentials only imported in server-only module; no ingestion imports in UI", () => {
    expect(readFileSync("src/lib/data/supabase-server.ts", "utf8")).toMatch(
      /import\s+["']server-only["']/,
    );
    expect(readFileSync("src/lib/data/job-queries.ts", "utf8")).toMatch(
      /import\s+["']server-only["']/,
    );
  });
  it("unsafe upstream and return URLs are not navigable", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:text/html,bad",
      "https://user:pass@example.com",
    ])
      expect(safeExternalUrl(url)).toBeNull();
    expect(safeExternalUrl("https://example.com/job")).toBe(
      "https://example.com/job",
    );
    expect(safeRadarReturn("//evil.test/radar")).toBe("/radar");
    expect(safeRadarReturn("/profile")).toBe("/radar");
  });
});
describe("Radar deterministic browsing", () => {
  const state = loadRadarState("");
  it("orders Eligible then Check then Blocked, keeping Blocked visible", () => {
    const rows = selectJobs(
      [
        job("blocked", { gates: [gate] }),
        job("check", { extraction_status: null }),
        job("eligible"),
      ],
      { ...profile, education: "bachelor" },
      state,
    );
    expect(rows.map((r) => r.result.status)).toEqual([
      "Eligible",
      "Check",
      "Blocked",
    ]);
  });
  it("orders freshness within qualification groups", () => {
    const rows = selectJobs(
      [
        job("old", { sources: [], published_at: "2025-01-01" }),
        job("new", { sources: [], published_at: "2026-01-01" }),
      ],
      profile,
      state,
    );
    expect(rows[0].job.id).toBe("new");
  });
  it.each([
    { extraction_status: null },
    { extraction_status: "failed" },
    { extraction_input_hash: "old" },
    { extraction_attempt_hash: "old" },
  ] as const)("unavailable extraction never Eligible: %j", (change) => {
    expect(
      selectJobs([job("1", change)], profile, state)[0].result.status,
    ).toBe("Check");
  });
  it("ready empty gates is Eligible", () => {
    expect(selectJobs([job()], profile, state)[0].result.status).toBe(
      "Eligible",
    );
  });
  it("keyword/city/status filters and empty result", () => {
    expect(
      selectJobs([job()], profile, { ...state, q: "does not exist" }),
    ).toHaveLength(0);
    expect(
      selectJobs([job()], profile, { ...state, city: "上海" }),
    ).toHaveLength(0);
    expect(
      selectJobs([job()], profile, { ...state, status: "Blocked" }),
    ).toHaveLength(0);
  });
  it("URL filter/sort/selected round-trip including unicode", () => {
    const input = {
      ...state,
      q: "算法 & agent",
      city: "北京",
      status: "Blocked" as const,
      sort: "freshness" as const,
      job: "abc",
    };
    const url = radarUrl("/radar", input);
    expect(
      loadRadarState(new URL(url, "https://radar.local").searchParams),
    ).toEqual(input);
  });
  it("invalid filter/sort recovers to defaults without auto-selecting", () => {
    expect(loadRadarState("?sort=bad&status=bad")).toEqual(state);
  });
  it("full detail route preserves return state for mobile and desktop", () => {
    const input = { ...state, q: "工程师", job: "job-id" };
    const url = new URL(fullDetailUrl("job-id", input), "https://radar.local");
    expect(url.pathname).toBe("/jobs/job-id");
    expect(
      loadRadarState(
        new URL(
          safeRadarReturn(url.searchParams.get("returnTo")!),
          "https://radar.local",
        ).searchParams,
      ),
    ).toEqual(input);
  });
  it("preferences never enter qualification selection", () => {
    const guest = emptyGuestProfile();
    const before = selectJobs(
      [job("1", { gates: [gate] })],
      guest.qualification,
      state,
    );
    guest.preferences = {
      preferred_cities: ["Mars"],
      preferred_roles: ["other"],
      preferred_companies: ["other"],
    };
    expect(
      selectJobs([job("1", { gates: [gate] })], guest.qualification, state),
    ).toEqual(before);
  });
  it("distinguishes missing profile from unclear boundary and ambiguous JD", () => {
    const result = evaluateQualification(profile, [gate], "open", job());
    expect(checkReason(result.reasons[0], profile)).toContain("资料缺失");
    expect(
      checkReason(result.reasons[0], { ...profile, education: "bachelor" }),
    ).toContain("边界不明确");
    expect(
      checkReason({ code: "ambiguous_condition", message: "", gate }, profile),
    ).toContain("JD 条件含糊");
    expect(secondarySignal(result)).toBe("学历要求 · 待确认");
  });
});

it("Evidence and context remain verbatim; invented quotes are rejected", async () => {
  const { groundedEvidence } = await import("../../src/lib/radar/presentation");
  const original = "岗位要求：硕士及以上。欢迎申请。";
  const row = job("1", { requirements: original });
  expect(
    groundedEvidence(row, {
      quote: "硕士及以上",
      source: "requirements",
      context: "模型改写",
    }),
  ).toEqual({ quote: "硕士及以上", context: original });
  expect(
    groundedEvidence(row, {
      quote: "博士限定",
      source: "requirements",
      context: null,
    }),
  ).toBeNull();
  expect(
    groundedEvidence(row, { quote: "", source: "requirements", context: null }),
  ).toBeNull();
});

it("closed detail cannot render malformed gates even though Excluded short-circuits evaluation", async () => {
  const { displayGatesAreValid } =
    await import("../../src/lib/radar/presentation");
  expect(displayGatesAreValid([{}])).toBe(false);
  expect(displayGatesAreValid([gate])).toBe(true);
  expect(displayGatesAreValid([])).toBe(true);
});

describe("browse filters and explicit preferences", () => {
  it("combines keyword, normalized city, exact company, title keyword, qualification and sort", () => {
    const jobs = [
      job("a", {
        company: "腾讯",
        title: "产品实习生",
        location: ["北京市,上海市"],
      }),
      job("b", { company: "腾讯", title: "产品实习生", location: ["深圳"] }),
      job("c", {
        company: "腾讯文档",
        title: "产品实习生",
        location: ["北京"],
      }),
      job("d", { company: "腾讯", title: "工程实习生", location: ["北京"] }),
      job("e", {
        company: "腾讯",
        title: "产品实习生",
        location: ["北京"],
        extraction_status: "failed",
      }),
    ];
    const original = JSON.stringify(jobs);
    const state = loadRadarState({
      q: "实习",
      city: "北京市",
      company: "腾讯",
      role: "产品",
      status: "Eligible",
      sort: "freshness",
    });
    const rows = selectJobs(jobs, profile, state);
    expect(rows.map((row) => row.job.id)).toEqual(["a"]);
    expect(rows[0].result).toEqual(
      evaluateQualification(
        profile,
        jobs[0].gates,
        jobs[0].application_status,
        jobs[0],
      ),
    );
    expect(JSON.stringify(jobs)).toBe(original);
    for (const field of ["q", "city", "company", "role", "status"] as const) {
      const noMatch = {
        ...state,
        [field]: field === "status" ? ("Excluded" as const) : "未匹配",
      };
      expect(selectJobs(jobs, profile, noMatch)).toEqual([]);
    }
  });
  it("title keyword ignores case but does not guess role meaning or search the JD", () => {
    const jobs = [job("a", { title: "AI Intern", description: "产品运营" })];
    expect(
      selectJobs(jobs, profile, loadRadarState({ role: "ai" })),
    ).toHaveLength(1);
    expect(
      selectJobs(jobs, profile, loadRadarState({ role: "人工智能" })),
    ).toHaveLength(0);
    expect(
      selectJobs(jobs, profile, loadRadarState({ role: "产品" })),
    ).toHaveLength(0);
  });
  it("URL preserves all filters and detail return context including unknown company", () => {
    const state = loadRadarState({
      q: "研发",
      city: "北京市",
      company: "未知公司",
      role: "C++",
      status: "Check",
      sort: "freshness",
      job: "42",
    });
    const encoded = radarUrl("/radar", state);
    expect(
      loadRadarState(new URL(encoded, "https://radar.local").searchParams),
    ).toEqual(state);
    const full = new URL(fullDetailUrl("42", state), "https://radar.local");
    expect(
      loadRadarState(
        new URL(
          safeRadarReturn(full.searchParams.get("returnTo")!),
          "https://radar.local",
        ).searchParams,
      ),
    ).toEqual(state);
  });
});
