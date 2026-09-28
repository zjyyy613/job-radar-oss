import { describe, expect, it } from "vitest";
import { canonicalize } from "../../src/lib/domain/canonicalize";
import { record } from "../fixtures/canonical";

describe("conservative canonicalization", () => {
  it("deduplicates identical source identity and keeps the newest observation", () => {
    const result = canonicalize([record(), record("2", { source_job_id: "1", title: "Updated", fetched_at: "2026-09-28T02:00:00Z" })]);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].title).toBe("Updated");
    expect(result.decisions[0].reason).toBe("same_source_identity");
  });
  it("merges exact normalized cross-source signals with an auditable trace", () => {
    const result = canonicalize([record(), record("2", { source: "ncss", source_tier: "trusted_aggregator", company: " ＡＣＭＥ ", title: "software   engineer" })]);
    expect(result.jobs).toHaveLength(1);
    expect(result.jobs[0].source_record_ids).toHaveLength(2);
    expect(result.jobs[0].company).toBe("Acme");
    expect(result.decisions).toContainEqual(expect.objectContaining({ merge: true, reason: "exact_company_title_location_program" }));
    expect(result.jobs[0].canonicalization_trace.merges).not.toHaveLength(0);
    expect(result.jobs[0].gates).toEqual([]);
  });
  it.each([
    { recruitment_batch: "2026 campus" }, { recruitment_batch: null },
    { title: "Software Engineering" }, { company: "Acme subsidiary" },
    { location: ["上海"] }, { location: [] }, { internship_type: "summer" },
  ])("does not merge conflicting or uncertain signals: %j", (change) => {
    expect(canonicalize([record(), record("2", { source: "other", ...change })]).jobs).toHaveLength(2);
  });
  it("does not merge different postings from the same source", () => {
    expect(canonicalize([record(), record("2")]).jobs).toHaveLength(2);
  });
  it("does not transitively bridge incompatible locations", () => {
    const rows = [record("1", { source: "a", location: ["北京"] }), record("2", { source: "b", location: ["北京", "上海"] }), record("3", { source: "c", location: ["上海"] })];
    const result = canonicalize(rows);
    expect(result.jobs).toHaveLength(2);
    expect(canonicalize([...rows].reverse())).toEqual(result);
  });
  it("keeps stable IDs on rerun and when adding a newly matched source", () => {
    const previous = canonicalize([record()]).jobs;
    const next = canonicalize([record(), record("2", { source: "aaa" })], [], previous).jobs;
    expect(next[0].id).toBe(previous[0].id);
    expect(canonicalize([record()], [], previous).jobs[0].id).toBe(previous[0].id);
  });
  it("content hash excludes fetch metadata and changes on JD changes", () => {
    const hash = canonicalize([record()]).jobs[0].raw_content_hash;
    expect(canonicalize([record("1", { fetched_at: "2026-09-29T01:00:00Z", raw_hash: "new" })]).jobs[0].raw_content_hash).toBe(hash);
    expect(canonicalize([record("1", { requirements: "New requirement" })]).jobs[0].raw_content_hash).not.toBe(hash);
  });
  it("does not arbitrarily choose among two same-source duplicate candidates", () => {
    const rows = [record("3", { source: "aaa" }), record("1", { source: "zzz" }), record("2", { source: "zzz" })];
    expect(canonicalize(rows).jobs).toHaveLength(3);
  });
  it("splitting a previous group cannot allocate the same job ID twice", () => {
    const a = record("2", { source: "aaa" });
    const b = record("1", { source: "zzz" });
    const old = canonicalize([a, b]).jobs;
    const split = canonicalize([a, { ...b, recruitment_batch: "2026 campus" }], [], old).jobs;
    expect(new Set(split.map(j => j.id)).size).toBe(2);
  });
  it("blank program labels are unknown, not high-confidence equality", () => {
    expect(canonicalize([record("1", { recruitment_batch: " " }), record("2", { source: "other", recruitment_batch: " " })]).jobs).toHaveLength(2);
  });
});
