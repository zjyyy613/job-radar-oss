import { describe, expect, it } from "vitest";
import { deriveReliability, deriveApplicationStatus } from "../../src/lib/domain/source-reliability";
import { canonicalize } from "../../src/lib/domain/canonicalize";
import { record, run } from "../fixtures/canonical";

describe("source reliability", () => {
  it.each(["timeout", "403", "5xx", "crawler_failure"])("%s yields Unknown, never Closed or a new missing count", (error) => {
    expect(deriveReliability([record()], [run(1, { status: "failed", error_type: error })])).toMatchObject({ application_status: "unknown", consecutive_missing_count: 0 });
  });
  it("counts one authoritative full-list absence", () => {
    expect(deriveReliability([record()], [run(2)])).toMatchObject({ application_status: "unknown", consecutive_missing_count: 1 });
  });
  it("closes only after two consecutive successful full-list absences", () => {
    expect(deriveReliability([record()], [run(2), run(3)])).toMatchObject({ application_status: "closed", consecutive_missing_count: 2 });
  });
  it("replay is idempotent; duplicate run IDs cannot count twice", () => {
    expect(deriveReliability([record()], [run(2), run(2)]).consecutive_missing_count).toBe(1);
  });
  it("failure interrupts the absence streak without incrementing the counter", () => {
    const runs = [run(2), run(3, { status: "failed" })];
    expect(deriveReliability([record()], runs)).toMatchObject({ application_status: "unknown", consecutive_missing_count: 1 });
    expect(deriveReliability([record()], [...runs, run(4)])).toMatchObject({ application_status: "unknown", consecutive_missing_count: 1 });
  });
  it("explicit upstream Closed closes immediately", () => {
    expect(deriveApplicationStatus([record()], [run(2, { full_list: false, record_observations: { present: [], closed: ["1"] } })])).toBe("closed");
  });
  it("NCSS missing never closes or increments authoritative counters", () => {
    const r = record("1", { source: "ncss", source_tier: "trusted_aggregator" });
    expect(deriveReliability([r], [run(2, { source: "ncss", source_tier: "trusted_aggregator" }), run(3, { source: "ncss", source_tier: "trusted_aggregator" })])).toMatchObject({ application_status: "unknown", consecutive_missing_count: 0 });
  });
  it("partial/bounded/unobserved runs cannot prove absence", () => {
    for (const change of [{ status: "partial" as const }, { full_list: false }, { record_observations: null }]) {
      expect(deriveReliability([record()], [run(2, change), run(3, change)]).application_status).toBe("unknown");
      expect(deriveReliability([record()], [run(2, change), run(3, change)]).consecutive_missing_count).toBe(0);
    }
  });
  it("current observed presence is Open only for authoritative sources", () => {
    expect(deriveApplicationStatus([record()], [run(1, { full_list: false, record_observations: null })])).toBe("open");
    expect(deriveApplicationStatus([record()], [run(2, { record_observations: { present: ["1"], closed: [] } })])).toBe("open");
  });
  it("a failed source does not affect another company's verified jobs", () => {
    const rows = [record(), record("2", { source: "other", company: "Other" })];
    const result = canonicalize(rows, [run(1, { status: "failed" }), run(1, { id: "other-run", source: "other", record_observations: { present: ["2"], closed: [] } })]);
    expect(result.jobs.find(j => j.company === "Acme")?.application_status).toBe("unknown");
    expect(result.jobs.find(j => j.company === "Other")?.application_status).toBe("open");
  });
  it("aggregator closure cannot override authoritative Open", () => {
    expect(deriveApplicationStatus([record(), record("2", { source: "ncss", source_tier: "trusted_aggregator" })], [run(1, { record_observations: { present: ["1"], closed: [] } }), run(2, { source: "ncss", source_tier: "trusted_aggregator", record_observations: { present: [], closed: ["2"] } })])).toBe("open");
  });
  it("a subsequent confirmed presence reopens and resets missing count", () => {
    expect(deriveReliability([record()], [run(2), run(3), run(4, { record_observations: { present: ["1"], closed: [] } })])).toMatchObject({ application_status: "open", consecutive_missing_count: 0 });
  });
  it("contradictory snapshot/last-seen evidence cannot establish absence", () => {
    const current = record("1", { last_seen_at: "2026-09-28T02:00:30Z" });
    expect(deriveReliability([current], [run(2), run(3)])).toMatchObject({ application_status: "unknown", consecutive_missing_count: 1 });
  });
});
