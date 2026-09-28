import { describe, expect, expectTypeOf, it } from "vitest";
import { validateGate, type Gate, type GateRequirement } from "../../src/lib/domain/gate";
import type { PreferenceProfile, QualificationProfile } from "../../src/lib/domain/profile";

const gate = {
  id: "days-1",
  field: "days_per_week",
  requirement: "required",
  scope: "job",
  value: { kind: "minimum", value: 3 },
  evidence: [{ quote: "每周至少实习3天", source: "requirements", context: null }],
  note: null,
} satisfies Gate;

describe("frozen profile contracts", () => {
  it("keeps all preference keys out of QualificationProfile", () => {
    expectTypeOf<Extract<keyof QualificationProfile, keyof PreferenceProfile>>().toEqualTypeOf<never>();
    expectTypeOf<keyof QualificationProfile>().toEqualTypeOf<
      "student_status" | "graduation_year" | "education" | "major" |
      "days_per_week" | "duration_months" | "research_areas"
    >();
    expectTypeOf<keyof PreferenceProfile>().toEqualTypeOf<
      "preferred_cities" | "preferred_roles" | "preferred_companies"
    >();
  });
});

describe("validateGate", () => {
  it.each<GateRequirement>(["required", "preferred", "ambiguous"])("accepts %s without changing semantics", (requirement) => {
    const input = { ...gate, requirement };
    expect(validateGate(input)).toEqual(input);
  });

  it.each([
    ["student_status", { kind: "one_of", values: ["enrolled"] }],
    ["graduation_year", { kind: "one_of", values: [2026, 2027] }],
    ["education", { kind: "education_minimum", value: "bachelor" }],
    ["education", { kind: "one_of", values: ["master", "doctorate"] }],
    ["major", { kind: "one_of", values: ["计算机科学", "数学"] }],
    ["days_per_week", { kind: "minimum", value: 3 }],
    ["duration_months", { kind: "minimum", value: 3.5 }],
    ["research_areas", { kind: "one_of", values: ["机器学习"] }],
  ])("accepts a supported %s value", (field, value) => {
    const input = { ...gate, field, value };
    expect(validateGate(input)).toEqual(input);
  });

  it("preserves cross-field OR as a single gate instead of independent required gates", () => {
    const input = {
      ...gate,
      field: "major",
      value: { kind: "or", alternatives: [
        { field: "major", value: { kind: "one_of", values: ["计算机科学"] } },
        { field: "research_areas", value: { kind: "one_of", values: ["机器学习"] } },
      ] },
      evidence: [{ quote: "计算机专业或研究方向为机器学习", source: "requirements", context: null }],
    };
    expect(validateGate(input)).toEqual(input);
  });

  it("does not expand M0 to nested AND/OR or research-intent fields", () => {
    expect(() => validateGate({ ...gate, value: { kind: "or", alternatives: [
      { field: "education", value: { kind: "and", conditions: [] } },
      { field: "long_term_research", value: { kind: "one_of", values: [true] } },
    ] } })).toThrow();
  });

  it("preserves verbatim whitespace, context, scope, and note", () => {
    const input = { ...gate, scope: "program", note: "标题范围待确认", evidence: [
      { quote: "  每周至少实习3天\n", source: "title", context: "实习要求：  每周至少实习3天\n。" },
    ] };
    expect(validateGate(input)).toEqual(input);
  });

  it.each([
    null, [], "gate", {},
    { ...gate, id: " " },
    { ...gate, requirement: "optional" },
    { ...gate, requirement: "Blocked" },
    { ...gate, field: "preferred_cities" },
    { ...gate, scope: "company" },
    { ...gate, evidence: [] },
    { ...gate, evidence: [{ quote: "", source: "title", context: null }] },
    { ...gate, evidence: [{ quote: " \n", source: "title", context: null }] },
    { ...gate, evidence: [{ quote: 3, source: "title", context: null }] },
    { ...gate, evidence: [{ quote: "要求", source: "model", context: null }] },
    { ...gate, evidence: [{ quote: "要求", source: "title", context: 42 }] },
    { ...gate, evidence: [{ quote: "要求", source: "title", context: "不含引文" }] },
    { ...gate, note: 7 },
    { ...gate, value: null },
    { ...gate, value: "3天" },
    { ...gate, value: { kind: "unknown", value: 3 } },
    { ...gate, value: { kind: "minimum", value: "3" } },
    { ...gate, value: { kind: "minimum", value: -1 } },
    { ...gate, value: { kind: "minimum", value: 0 } },
    { ...gate, value: { kind: "minimum", value: 8 } },
    { ...gate, value: { kind: "minimum", value: 2.5 } },
    { ...gate, value: { kind: "minimum", value: Infinity } },
    { ...gate, value: { kind: "minimum", value: NaN } },
    { ...gate, field: "major", value: { kind: "one_of", values: [] } },
    { ...gate, field: "major", value: { kind: "one_of", values: [" "] } },
    { ...gate, field: "major", value: { kind: "minimum", value: 3 } },
    { ...gate, field: "graduation_year", value: { kind: "one_of", values: ["2027"] } },
    { ...gate, field: "graduation_year", value: { kind: "one_of", values: [2027.5] } },
    { ...gate, field: "education", value: { kind: "education_minimum", value: "unknown" } },
    { ...gate, field: "student_status", value: { kind: "one_of", values: ["unknown"] } },
    { ...gate, value: { kind: "or", alternatives: [] } },
    { ...gate, value: { kind: "or", alternatives: [{ field: "days_per_week", value: { kind: "minimum", value: 3 } }] } },
    { ...gate, value: { kind: "or", alternatives: [
      { field: "days_per_week", value: { kind: "minimum", value: 3 } },
      { field: "preferred_roles", value: { kind: "one_of", values: ["开发"] } },
    ] } },
    // Unknown semantics must be rejected rather than silently discarded.
    { ...gate, value: { kind: "minimum", value: 3, operator: "less_than" } },
    { ...gate, status: "Blocked" },
  ])("rejects malformed/unsupported input %#", (input) => {
    expect(() => validateGate(input)).toThrow();
  });
});
