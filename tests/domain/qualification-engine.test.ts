import { describe, expect, it } from "vitest";
import table from "../fixtures/qualification/spike-truth-table.json";
import { evaluateQualification, type ExtractionReadiness } from "../../src/lib/domain/qualification-engine";
import type { Gate, GateCondition } from "../../src/lib/domain/gate";
import type { Education, QualificationProfile } from "../../src/lib/domain/profile";

const ready: ExtractionReadiness = { extraction_status: "success", raw_content_hash: "current", extraction_input_hash: "current", extraction_attempt_hash: "current", extraction_error: null };
const profile: QualificationProfile = { student_status: "enrolled", graduation_year: 2027, education: "bachelor", major: "mechanical", days_per_week: 3, duration_months: 2, research_areas: null };
function gate(field: Gate["field"], value: Gate["value"], requirement: Gate["requirement"] = "required"): Gate {
  return { id: field, field, value, requirement, scope: "job", evidence: [{ quote: "原始资格条件", source: "requirements", context: null }], note: null };
}
type LegacyCondition = { field?: string; op?: string; value?: unknown; any?: unknown[]; all?: unknown[] };
// Test-only representation mapping. Unsupported Spike AND/intent is not a new M0 gate.
function convert(condition: LegacyCondition): GateCondition | null {
  if (condition.any || condition.all || condition.field === "long_term_research" || condition.field === "paper_or_oss") return null;
  const field = ["major_domains", "major_tags"].includes(condition.field ?? "") ? "major" : condition.field;
  const value = condition.value === "phd" ? "doctorate" : condition.value;
  if (condition.op === "education_at_least") return { field: "education", value: { kind: "education_minimum", value: value as Education } };
  if (condition.op === "gte") return { field: field as "days_per_week" | "duration_months", value: { kind: "minimum", value: Number(value) } };
  return { field, value: { kind: "one_of", values: Array.isArray(value) ? value : [value] } } as GateCondition;
}
describe("original Spike 24-case truth table", () => {
  for (const job of table.jobs) for (const person of table.profiles) {
    it(`${job.id} × ${person.id}: ${table.expected[job.id as keyof typeof table.expected][person.id as "P1"]}`, () => {
      const gates: Gate[] = job.gates.flatMap((g, index) => {
        const c = convert(g.condition as LegacyCondition);
        return c ? [{ ...gate(c.field, c.value, g.level as Gate["requirement"]), id: `${job.id}-${index}`, scope: g.scope as Gate["scope"], evidence: [{ quote: g.evidence, source: g.evidence_source as "title" | "requirements", context: null }] }] : [];
      });
      const p: QualificationProfile = { student_status: person.student_status as "enrolled", graduation_year: person.graduation_year,
        education: (person.education === "phd" ? "doctorate" : person.education) as Education,
        major: person.major_tags[0], days_per_week: person.days_per_week, duration_months: person.duration_months, research_areas: person.research_areas };
      expect(evaluateQualification(p, gates, "open", ready).status).toBe(table.expected[job.id as keyof typeof table.expected][person.id as "P1"]);
    });
  }
});
describe("readiness and frozen precedence", () => {
  const days = gate("days_per_week", { kind: "minimum", value: 5 });
  it("closed precedes unavailable extraction and all gates", () => expect(evaluateQualification(profile, [days], "closed").status).toBe("Excluded"));
  it.each([
    undefined, { ...ready, extraction_status: null }, { ...ready, extraction_status: "failed" },
    { ...ready, extraction_input_hash: "old" }, { ...ready, raw_content_hash: null },
    { ...ready, extraction_attempt_hash: "old" }, { ...ready, extraction_error: "extraction_failed" },
  ])("unready extraction cannot yield Eligible or Blocked %#", state => {
    for (const gates of [[], [days]]) expect(evaluateQualification(profile, gates, "open", state as ExtractionReadiness)).toMatchObject({ status: "Check", reasons: [{ code: "qualification_data_unavailable" }] });
  });
  it("ready with genuinely no gates is Eligible", () => expect(evaluateQualification(profile, [], "open", ready).status).toBe("Eligible"));
  it("required fail outranks missing and ambiguous", () => expect(evaluateQualification({ ...profile, education: null }, [gate("education", { kind: "education_minimum", value: "master" }), days], "open", ready).status).toBe("Blocked"));
  it("optional days missing is Check when a job requires it", () => expect(evaluateQualification({ ...profile, days_per_week: null }, [days], "open", ready).status).toBe("Check"));
  it("ambiguous non-pass is Check", () => expect(evaluateQualification(profile, [{ ...days, requirement: "ambiguous" }], "open", ready).status).toBe("Check"));
  it("preferred mismatch and missing never block or cause Check", () => expect(evaluateQualification(profile, [{ ...days, requirement: "preferred" }], "open", ready).status).toBe("Eligible"));
  it.each(["preferred_cities", "preferred_roles", "preferred_companies"])("%s is completely isolated", field => {
    const input = { ...profile, [field]: ["mismatch"] };
    expect(evaluateQualification(input, [days], "open", ready)).toEqual(evaluateQualification(profile, [days], "open", ready));
  });
  it("OR passes if any branch passes, unknown if one unknown, fails only when all fail", () => {
    const or = gate("days_per_week", { kind: "or", alternatives: [
      { field: "days_per_week", value: { kind: "minimum", value: 5 } },
      { field: "education", value: { kind: "education_minimum", value: "master" } },
    ] });
    expect(evaluateQualification({ ...profile, education: "master" }, [or], "open", ready).status).toBe("Eligible");
    expect(evaluateQualification({ ...profile, education: null }, [or], "open", ready).status).toBe("Check");
    expect(evaluateQualification(profile, [or], "open", ready).status).toBe("Blocked");
  });
  it("unknown major and malformed values are not clear contradictions", () => {
    expect(evaluateQualification({ ...profile, major: "新兴交叉学科" }, [gate("major", { kind: "one_of", values: ["computer_science"] })], "open", ready).status).toBe("Check");
    expect(evaluateQualification(profile, [{ ...days, value: null } as unknown as Gate], "open", ready).status).toBe("Check");
  });
  it("related-major mismatch is uncertain, never a clear contradiction", () => {
    const related = gate("major", { kind: "one_of", values: ["computer_science"] });
    related.evidence[0].quote = "计算机或相关专业";
    expect(evaluateQualification(profile, [related], "open", ready).status).toBe("Check");
  });
});
