import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { detailAdmission, mapJobProRecord } from "../../scripts/ingest/job-pro-adapter";

const fixture = (name: string) => JSON.parse(readFileSync(`tests/fixtures/job-pro/${name}.json`, "utf8"));
const fetchedAt = "2026-09-27T16:50:02.000Z";

describe("job-pro 1.2.1 adapter against real CLI fixtures", () => {
  it.each([
    ["tencent", "1282707398326592512", "腾讯", ["深圳总部", "北京", "上海", "广州", "成都", "杭州"]],
    ["xiaomi", "7689291997559884086", "小米", ["巴黎"]],
    ["vivo", "561286383", "vivo", ["广东省·深圳市", "浙江省·杭州市"]],
    ["xpeng", "7698647256014489898", "小鹏汽车", ["北京"]],
  ] as const)("maps %s provenance, identity and verbatim detail", (source, id, company, location) => {
    const raw = fixture(`${source}-detail`);
    const result = mapJobProRecord(raw, source, fetchedAt);
    expect(result).toMatchObject({
      source: `job-pro:${source}`, source_family: "company_ats", source_tier: "authoritative",
      source_job_id: id, source_url: raw.apply_url, apply_url: raw.apply_url,
      company, title: raw.title, location,
      description: raw.description, requirements: raw.requirements,
      fetched_at: fetchedAt, last_seen_at: fetchedAt, raw_payload: raw,
    });
    expect(result.raw_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(mapJobProRecord(raw, source, "2026-09-28T00:00:00.000Z").source_job_id).toBe(id);
  });

  it.each(["tencent", "xiaomi", "vivo"] as const)("keeps missing %s fields null/empty without guessing", (source) => {
    const raw = fixture(`${source}-search`).positions[0];
    expect(mapJobProRecord(raw, source, fetchedAt)).toMatchObject({
      salary: null, deadline: null, description: null, requirements: null,
      internship_type: null, recruitment_batch: null, industry: null,
      company_nature: null, company_size: null, published_at: null, welfare: [],
      raw_payload: raw,
    });
  });

  it("preserves vivo salary and raw date without inventing a timezone/batch/type", () => {
    const raw = fixture("vivo-detail");
    expect(mapJobProRecord(raw, "vivo", fetchedAt)).toMatchObject({
      salary: "面议", published_at: null, deadline: null,
      internship_type: null, recruitment_batch: null, raw_payload: raw,
    });
  });

  it("splits only source-specific list delimiters and preserves location wording", () => {
    const raw = fixture("xiaomi-search").positions[1];
    expect(mapJobProRecord(raw, "xiaomi", fetchedAt).location).toEqual(["北京", "南京", "上海"]);
  });

  it("does not mutate the upstream payload and hashes content independent of key order/time", () => {
    const raw = fixture("xiaomi-detail");
    const original = structuredClone(raw);
    const reordered = Object.fromEntries(Object.entries(raw).reverse());
    const a = mapJobProRecord(raw, "xiaomi", fetchedAt);
    expect(raw).toEqual(original);
    expect(a.raw_payload).toEqual(original);
    expect(mapJobProRecord(reordered, "xiaomi").raw_hash).toBe(a.raw_hash);
    expect(mapJobProRecord({ ...raw, title: "changed" }, "xiaomi").raw_hash).not.toBe(a.raw_hash);
  });

  it("retains upstream fields not understood by this adapter inside raw_payload", () => {
    const raw = { ...fixture("tencent-detail"), future: { values: [1, null, "原文"] } };
    expect(mapJobProRecord(raw, "tencent").raw_payload).toEqual(raw);
    expect(mapJobProRecord(raw, "tencent")).not.toHaveProperty("future");
  });

  it("leaves truly absent optional fields empty, including URLs and location", () => {
    const result = mapJobProRecord({ post_id: "123", title: "岗位" }, "tencent", fetchedAt);
    expect(result).toMatchObject({ source_url: null, apply_url: null, location: [], welfare: [], salary: null });
  });

  it.each([
    null, [], {}, { post_id: "123" }, { post_id: "123", title: " " },
    { post_id: 1282707398326592512, title: "岗位" },
    { post_id: "", title: "岗位" },
    { post_id: "--help", title: "岗位" },
    { post_id: "123", title: "岗位", ok: false },
    { post_id: "123", title: "岗位", source: "unrelated.example" },
    { post_id: "123", title: "岗位", requirements: { unsupported: true } },
    { post_id: "123", title: "岗位", work_cities: [42] },
    { post_id: "123", title: "岗位", apply_url: "javascript:alert(1)" },
  ])("rejects malformed/drifted records instead of inventing identity %#", (raw) => {
    expect(() => mapJobProRecord(raw, "tencent", fetchedAt)).toThrow();
  });

  it("rejects a source outside the allowlist at runtime", () => {
    expect(() => mapJobProRecord(fixture("tencent-detail"), "not-allowed" as "tencent")).toThrow();
  });

  it("accepts both Feishu city shapes for xpeng, so one whitelist line is not assumed enough", () => {
    // Search returns a plain string, the detail endpoint returns city objects.
    expect(mapJobProRecord(fixture("xpeng-search").positions[0], "xpeng", fetchedAt).location).toEqual(["北京"]);
    expect(mapJobProRecord(fixture("xpeng-detail"), "xpeng", fetchedAt).location).toEqual(["北京"]);
    const multi = { ...fixture("xpeng-detail"), work_cities: [{ name: "广州" }, { name: "上海" }, { name: "深圳" }] };
    expect(mapJobProRecord(multi, "xpeng", fetchedAt).location).toEqual(["广州", "上海", "深圳"]);
    // An unnamed city object is still rejected rather than silently dropped.
    expect(() => mapJobProRecord({ ...fixture("xpeng-detail"), work_cities: [{ code: "CT_1" }] }, "xpeng", fetchedAt)).toThrow();
  });

  it("admits the real xpeng intern detail with its official campus locator", () => {
    const record = mapJobProRecord(fixture("xpeng-detail"), "xpeng", fetchedAt);
    expect(record).toMatchObject({ source: "job-pro:xpeng", company: "小鹏汽车", source_tier: "authoritative" });
    expect(new URL(record.source_url!).hostname).toBe("xiaopeng.jobs.feishu.cn");
    expect(decodeURIComponent(record.source_url!)).toContain(record.source_job_id);
    expect(record.location.length).toBeGreaterThan(0);
    // The intern listing is a 校招/实习 posting, so recruit labels must not claim 正式.
    expect(String(fixture("xpeng-detail").recruit_label)).toContain("实习");
    expect(detailAdmission(record, "xpeng")).toBeNull();
  });
});
