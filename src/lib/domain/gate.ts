import { EDUCATION_LEVELS, STUDENT_STATUSES, type Education, type StudentStatus } from "./profile";

export type GateRequirement = "required" | "preferred" | "ambiguous";
export type GateScope = "job" | "program";

type OneOf<T> = { kind: "one_of"; values: T[] };
type Minimum = { kind: "minimum"; value: number };
type FieldValues = {
  student_status: OneOf<StudentStatus>;
  graduation_year: OneOf<number>;
  education: OneOf<Education> | { kind: "education_minimum"; value: Education };
  major: OneOf<string>;
  days_per_week: Minimum;
  duration_months: Minimum;
  research_areas: OneOf<string>;
};
export type GateField = keyof FieldValues;
export type GateCondition = {
  [Field in GateField]: { field: Field; value: FieldValues[Field] }
}[GateField];

// one_of means ANY allowed value, never ALL. OR alternatives retain their fields.
// Nested Boolean expressions are unsupported and must be rejected, not flattened.
export type GateValue = FieldValues[GateField] | { kind: "or"; alternatives: GateCondition[] };

export interface GateEvidence {
  quote: string;
  source: "title" | "description" | "requirements" | "other";
  context: string | null;
}

export interface Gate {
  id: string;
  // For OR, this is the primary display field; all alternatives form ONE condition.
  field: GateField;
  requirement: GateRequirement;
  scope: GateScope;
  value: GateValue;
  evidence: GateEvidence[];
  note: string | null;
}

const fields: readonly GateField[] = [
  "student_status", "graduation_year", "education", "major",
  "days_per_week", "duration_months", "research_areas",
];

function assert(condition: unknown, path: string): asserts condition {
  if (!condition) throw new TypeError(`Invalid gate: ${path}`);
}

function object(value: unknown, keys: string[], path: string): Record<string, unknown> {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), path);
  const record = value as Record<string, unknown>;
  assert(Object.keys(record).length === keys.length && keys.every((key) => Object.hasOwn(record, key)), `${path} keys`);
  return record;
}

function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function member<T extends string>(value: unknown, values: readonly T[]): value is T {
  return typeof value === "string" && values.includes(value as T);
}

function validateCondition(field: unknown, value: unknown): void {
  assert(member(field, fields), "field");
  assert(value !== null && typeof value === "object", "value");
  const kind = (value as Record<string, unknown>).kind;

  if (field === "days_per_week" || field === "duration_months") {
    const minimum = object(value, ["kind", "value"], "minimum");
    assert(kind === "minimum", "minimum.kind");
    assert(typeof minimum.value === "number" && Number.isFinite(minimum.value) && minimum.value > 0, "minimum.value");
    if (field === "days_per_week") {
      assert(Number.isInteger(minimum.value) && minimum.value <= 7, "days_per_week.value");
    }
    return;
  }

  if (field === "education" && kind === "education_minimum") {
    const minimum = object(value, ["kind", "value"], "education_minimum");
    assert(member(minimum.value, EDUCATION_LEVELS), "education_minimum.value");
    return;
  }

  const allowed = object(value, ["kind", "values"], "one_of");
  assert(kind === "one_of" && Array.isArray(allowed.values) && allowed.values.length > 0, "one_of.values");
  for (const item of allowed.values) {
    if (field === "graduation_year") {
      assert(typeof item === "number" && Number.isInteger(item) && item >= 1000 && item <= 9999, "graduation_year.value");
    } else if (field === "student_status") {
      assert(member(item, STUDENT_STATUSES), "student_status.value");
    } else if (field === "education") {
      assert(member(item, EDUCATION_LEVELS), "education.value");
    } else {
      assert(nonempty(item), `${field}.value`);
    }
  }
}

/** Validates structure, never qualification. Source-text grounding needs the JD
 * and must additionally be checked by the extraction pipeline before persistence. */
export function validateGate(value: unknown): Gate {
  const gate = object(value, ["id", "field", "requirement", "scope", "value", "evidence", "note"], "gate");
  assert(nonempty(gate.id), "id");
  assert(member(gate.field, fields), "field");
  assert(member(gate.requirement, ["required", "preferred", "ambiguous"]), "requirement");
  assert(member(gate.scope, ["job", "program"]), "scope");
  assert(gate.note === null || typeof gate.note === "string", "note");

  if (gate.value !== null && typeof gate.value === "object" && "kind" in gate.value && gate.value.kind === "or") {
    const or = object(gate.value, ["kind", "alternatives"], "or");
    assert(Array.isArray(or.alternatives) && or.alternatives.length >= 2, "or.alternatives");
    for (const item of or.alternatives) {
      const alternative = object(item, ["field", "value"], "or.alternative");
      validateCondition(alternative.field, alternative.value);
    }
    assert(or.alternatives.some((item) => item.field === gate.field), "or primary field");
  } else {
    validateCondition(gate.field, gate.value);
  }

  assert(Array.isArray(gate.evidence) && gate.evidence.length > 0, "evidence");
  for (const item of gate.evidence) {
    const evidence = object(item, ["quote", "source", "context"], "evidence item");
    assert(nonempty(evidence.quote), "evidence.quote");
    assert(member(evidence.source, ["title", "description", "requirements", "other"]), "evidence.source");
    assert(evidence.context === null || (typeof evidence.context === "string" && evidence.context.includes(evidence.quote)), "evidence.context");
  }

  // Every field is checked above. Return unchanged to preserve verbatim evidence.
  return value as Gate;
}
