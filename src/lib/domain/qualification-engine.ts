import { validateGate, type Gate, type GateCondition } from "./gate";
import { EDUCATION_LEVELS, STUDENT_STATUSES, type QualificationProfile } from "./profile";
import type { ApplicationStatus } from "./canonical-job";
import { MAJOR_OPTIONS, RESEARCH_OPTIONS, normalizeMajor, normalizeResearch } from "./profile-values";

/** Projection of Task 5 columns; no second extraction state system. */
export interface ExtractionReadiness {
  extraction_status: "success" | "failed" | null;
  raw_content_hash: string | null;
  extraction_input_hash: string | null;
  extraction_attempt_hash: string | null;
  extraction_error: string | null;
}
export interface QualificationResult {
  status: "Excluded" | "Blocked" | "Check" | "Eligible";
  reasons: { code: "job_closed" | "qualification_data_unavailable" | "required_contradiction" | "required_unknown" | "ambiguous_condition"; message: string; gate: Gate | null }[];
}
type Outcome = "pass" | "fail" | "unknown";
export function extractionIsReady(state?: Partial<ExtractionReadiness> | null): boolean {
  return !!state && state.extraction_status === "success" && typeof state.raw_content_hash === "string" && state.raw_content_hash.trim().length > 0
    && state.extraction_input_hash === state.raw_content_hash && state.extraction_attempt_hash === state.raw_content_hash && state.extraction_error === null;
}
function primitive(profile: QualificationProfile, condition: GateCondition): Outcome {
  const actual = profile[condition.field], value = condition.value;
  if (actual === undefined || actual === null || actual === "") return "unknown";
  if (value.kind === "minimum") {
    if (typeof actual !== "number" || !Number.isFinite(actual) || actual < 0 || condition.field === "days_per_week" && (!Number.isInteger(actual) || actual > 7)) return "unknown";
    return actual >= value.value ? "pass" : "fail";
  }
  if (value.kind === "education_minimum") {
    const index = EDUCATION_LEVELS.indexOf(actual as typeof EDUCATION_LEVELS[number]);
    return index < 0 ? "unknown" : index >= EDUCATION_LEVELS.indexOf(value.value) ? "pass" : "fail";
  }
  if (condition.field === "major") {
    if (typeof actual !== "string") return "unknown";
    const token = normalizeMajor(actual), allowed = value.values.map(v => normalizeMajor(String(v)));
    if (allowed.includes(token)) return "pass";
    const major = MAJOR_OPTIONS.find(([key]) => key === token);
    if (!major) return "unknown";
    if (allowed.includes(major[2])) return "pass";
    if (allowed.some(v => !MAJOR_OPTIONS.some(([key]) => key === v))) return "unknown";
    if (["stem", "business"].includes(token) && allowed.some(v => MAJOR_OPTIONS.find(([key]) => key === v)?.[2] === token)) return "unknown";
    return "fail";
  }
  if (condition.field === "research_areas") {
    if (!Array.isArray(actual) || actual.some(v => typeof v !== "string" || !v.trim())) return "unknown";
    const known = new Set<string>(RESEARCH_OPTIONS.map(([key]) => key));
    const areas = actual.map(normalizeResearch), allowed = value.values.map(v => normalizeResearch(String(v)));
    if (areas.some(v => allowed.includes(v))) return "pass";
    if (allowed.some(v => !known.has(v)) || areas.some(v => !known.has(v))) return "unknown";
    return "fail"; // [] is explicitly none; null/undefined is not supplied.
  }
  if (condition.field === "student_status" && !STUDENT_STATUSES.includes(actual as "enrolled" | "graduated")) return "unknown";
  if (condition.field === "education" && !EDUCATION_LEVELS.includes(actual as typeof EDUCATION_LEVELS[number])) return "unknown";
  if (condition.field === "graduation_year" && (typeof actual !== "number" || !Number.isInteger(actual) || actual < 1000 || actual > 9999)) return "unknown";
  return (value.values as unknown[]).includes(actual) ? "pass" : "fail";
}
function outcome(profile: QualificationProfile, gate: Gate): Outcome {
  const compare = (condition: GateCondition) => {
    const result = primitive(profile, condition);
    // "Related major" is open-ended: a different known major is not proof of exclusion.
    return condition.field === "major" && result === "fail" && gate.evidence.some(e => /相关专业|相关方向/.test(e.quote)) ? "unknown" : result;
  };
  if (gate.value.kind !== "or") return compare({ field: gate.field, value: gate.value } as GateCondition);
  const alternatives = gate.value.alternatives.map(compare);
  return alternatives.includes("pass") ? "pass" : alternatives.includes("unknown") ? "unknown" : "fail";
}
/** Pure, synchronous: no preferences, storage, extraction or network calls. */
export function evaluateQualification(profile: QualificationProfile, gates: readonly Gate[], applicationStatus: ApplicationStatus,
  extraction?: Partial<ExtractionReadiness> | null): QualificationResult {
  if (applicationStatus === "closed") return { status: "Excluded", reasons: [{ code: "job_closed", message: "已关闭", gate: null }] };
  const unavailable: QualificationResult = { status: "Check", reasons: [{ code: "qualification_data_unavailable", message: "资格信息待确认", gate: null }] };
  if (!extractionIsReady(extraction)) return unavailable;
  try { if (!Array.isArray(gates)) return unavailable; gates.forEach(validateGate); } catch { return unavailable; }
  const blocked: QualificationResult["reasons"] = [], missing: QualificationResult["reasons"] = [], ambiguous: QualificationResult["reasons"] = [];
  for (const gate of gates) {
    if (gate.requirement === "preferred") continue;
    const result = outcome(profile, gate);
    if (gate.requirement === "required" && result === "fail") blocked.push({ code: "required_contradiction", message: "不符合明确资格条件", gate });
    else if (gate.requirement === "required" && result === "unknown") missing.push({ code: "required_unknown", message: "资料缺失或条件暂无法确认", gate });
    else if (gate.requirement === "ambiguous" && result !== "pass") ambiguous.push({ code: "ambiguous_condition", message: "该条件的范围或含义需确认", gate });
  }
  if (blocked.length) return { status: "Blocked", reasons: blocked };
  if (missing.length) return { status: "Check", reasons: missing };
  if (ambiguous.length) return { status: "Check", reasons: ambiguous };
  return { status: "Eligible", reasons: [] };
}
