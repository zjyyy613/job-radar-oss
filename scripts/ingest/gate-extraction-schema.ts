import { degrees, majors, research } from "./gate-vocabulary";

const object = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const enumString = (values: string[]) => ({ type: "string", enum: values });
const oneOf = (items: object) => object({ kind: { const: "one_of" }, values: { type: "array", items, minItems: 1 } });
const values = {
  student_status: oneOf(enumString(["enrolled", "graduated"])),
  graduation_year: oneOf({ type: "integer", minimum: 1000, maximum: 9999 }),
  education: { anyOf: [oneOf(enumString(Object.keys(degrees))), object({ kind: { const: "education_minimum" }, value: enumString(Object.keys(degrees)) })] },
  major: oneOf(enumString(Object.keys(majors))), research_areas: oneOf(enumString(Object.keys(research))),
  days_per_week: object({ kind: { const: "minimum" }, value: { type: "integer", minimum: 1, maximum: 7 } }),
  duration_months: object({ kind: { const: "minimum" }, value: { type: "number", exclusiveMinimum: 0 } }),
};
const condition = { anyOf: Object.entries(values).map(([field, value]) => object({ field: { const: field }, value })) };
const evidence = object({ quote: { type: "string", minLength: 1 }, source: enumString(["title", "description", "requirements"]), context: { type: ["string", "null"] } });
const requirement = enumString(["required", "preferred", "ambiguous"]);
export const extractionSchema = object({
  gates: { type: "array", items: { anyOf: Object.entries(values).map(([field, value]) => object({
    id: { type: "string", minLength: 1 }, field: { const: field }, requirement, scope: enumString(["job", "program"]),
    value: { anyOf: [value, object({ kind: { const: "or" }, alternatives: { type: "array", items: condition, minItems: 2 } })] },
    evidence: { type: "array", items: evidence, minItems: 1 }, note: { type: ["string", "null"] },
  })) } },
  metadata: { type: "array", items: object({ kind: enumString(["unsupported", "compound_or", "experience"]), requirement, evidence,
    branches: { type: "array", items: { type: "string", minLength: 1 } } }) },
});
