import { validateGate, type Gate, type GateCondition } from "../../src/lib/domain/gate";
import { ambiguous, gateId, isCompoundOr, parseGates, preferred, splitClauses, type Clause, type Extraction, type ExtractionMetadata, type JobText } from "./gate-parser";
import { degrees, majors, research } from "./gate-vocabulary";
import { fail, failFrom, type DiagnosticStage } from "./extraction-diagnostics";

/** Location carried by every rejection: which stage, which field path, which index. */
interface At { stage: DiagnosticStage; path?: string; index?: number }
const at = (stage: DiagnosticStage, path?: string, index?: number): At => ({ stage, path, index });

function ensure(value: unknown, code: string, where: At): asserts value {
  if (!value) fail(where.stage, code, { path: where.path, index: where.index });
}
function record(value: unknown, where: At): Record<string, unknown> {
  ensure(value && typeof value === "object" && !Array.isArray(value), "not_a_json_object", where);
  return value as Record<string, unknown>;
}
function grounded(evidence: Gate["evidence"][number], job: JobText, where: At) {
  ensure(evidence && typeof evidence.quote === "string" && evidence.quote.trim(), "evidence_quote_missing", where);
  ensure(["title", "description", "requirements"].includes(evidence.source), "evidence_source_out_of_scope", where);
  const text = job[evidence.source as keyof JobText];
  ensure(typeof text === "string" && text.includes(evidence.quote), "evidence_not_verbatim", where);
  ensure(evidence.context === null || typeof evidence.context === "string" && text.includes(evidence.context) && evidence.context.includes(evidence.quote), "evidence_context_not_verbatim", where);
}
function validateValue(condition: GateCondition, quote: string, where: At) {
  const { field, value } = condition;
  if (value.kind === "one_of") for (const item of value.values) {
    if (field === "major" || field === "research_areas" || field === "education") {
      const vocabulary = field === "major" ? majors : field === "research_areas" ? research : degrees;
      ensure(typeof item === "string" && Object.hasOwn(vocabulary, item) && vocabulary[item].test(quote), "value_not_in_vocabulary", where);
    } else if (field === "graduation_year") {
      ensure([...quote.matchAll(/(20\d{2}|\d{2})届/g)].some(m => Number(m[1].length === 2 ? `20${m[1]}` : m[1]) === item), "graduation_year_not_confirmed_by_quote", where);
    } else if (field === "student_status") {
      ensure(item === "enrolled" ? /在校生|在读学生|在读[本硕博]/.test(quote) : /已毕业/.test(quote), "student_status_not_confirmed_by_quote", where);
    }
  }
  if (value.kind === "education_minimum") ensure(degrees[value.value].test(quote) && /及以上|以上/.test(quote), "education_minimum_not_confirmed_by_quote", where);
  if (value.kind === "minimum") ensure(new RegExp(`${value.value}\\s*${field === "days_per_week" ? "天" : "个月"}`).test(quote), "minimum_not_confirmed_by_quote", where);
}

/** Independent of the provider: exact evidence, frozen structure, audited values,
 * and conservative semantics are all required before any persistence.
 * Every rejection carries a stage/reason code (and field path/index where known)
 * while the outward failure class stays `invalid_extraction`. */
export function validateExtraction(value: unknown, job: JobText, unresolved?: Clause[]): Extraction {
  const output = record(value, at("structure", "output"));
  ensure(Array.isArray(output.gates) && Array.isArray(output.metadata), "missing_gates_or_metadata", at("structure", "output"));
  if (unresolved) ensure(Object.keys(output).length === 2, "unexpected_model_fields", at("structure", "output"));
  const clauses = splitClauses(job);
  const deterministic = parseGates(job).gates;
  const gates = output.gates.map((item, i) => {
    const gateAt = at("gate", `gates[${i}]`, i);
    let gate: Gate;
    // The frozen contract in src/lib/domain/gate.ts stays untouched; its field
    // path is captured here instead of being flattened to a generic failure.
    try { gate = validateGate(item); }
    catch (error) { failFrom(error, "gate", "gate_contract_rejected", { index: i }); }
    gate.evidence.forEach((e, j) => grounded(e, job, at("evidence", `gates[${i}].evidence[${j}]`, i)));
    const quote = gate.evidence.map(e => e.quote).join("\n");
    if (unresolved) ensure(gate.evidence.every(e => unresolved.some(c => c.source === e.source && c.quote.includes(e.quote))), "evidence_outside_unresolved_clause", gateAt);
    const contexts = gate.evidence.flatMap(e => clauses.filter(c => c.source === e.source && c.quote.includes(e.quote)));
    ensure(!isCompoundOr(quote) && !contexts.some(c => isCompoundOr(c.quote)), "compound_or_not_supported", gateAt);
    if (preferred.test(quote) || contexts.some(c => c.requirement === "preferred")) ensure(gate.requirement === "preferred", "preferred_context_marked_mandatory", gateAt);
    if (ambiguous.test(quote) || contexts.some(c => c.requirement === "ambiguous")) ensure(gate.requirement !== "required", "ambiguous_context_marked_required", gateAt);
    if (gate.evidence.every(e => e.source === "title")) ensure(gate.field === "graduation_year" && gate.requirement === "ambiguous" && gate.scope === "program", "title_only_gate_shape", gateAt);
    if (gate.value.kind === "or") {
      ensure(/或/.test(quote), "or_value_without_connector", gateAt);
      gate.value.alternatives.forEach((condition, k) => validateValue(condition, quote, at("value", `gates[${i}].value.alternatives[${k}]`, i)));
    } else validateValue({ field: gate.field, value: gate.value } as GateCondition, quote, at("value", `gates[${i}].value`, i));
    // A hard gate needs deterministic semantic confirmation, not merely a matching
    // word in its quote. Unknown compound/conditional requirements remain metadata.
    if (gate.requirement === "required") ensure(deterministic.some(g => g.field === gate.field && g.requirement === "required" && JSON.stringify(g.value) === JSON.stringify(gate.value)
      && g.evidence.some(e => gate.evidence.some(other => other.source === e.source && (e.quote.includes(other.quote) || other.quote.includes(e.quote))))), "required_without_deterministic_confirmation", gateAt);
    const { id: _id, ...data } = gate;
    void _id;
    return { ...data, id: gateId(data) };
  });
  const metadata = output.metadata.map((item, i) => {
    const metaAt = at("metadata", `metadata[${i}]`, i);
    const entry = record(item, metaAt);
    ensure(Object.keys(entry).length === 4 && ["kind", "requirement", "evidence", "branches"].every(k => Object.hasOwn(entry, k)), "metadata_shape", metaAt);
    ensure(["unsupported", "compound_or", "experience"].includes(String(entry.kind)) && ["required", "preferred", "ambiguous"].includes(String(entry.requirement)), "metadata_kind_or_requirement_out_of_scope", metaAt);
    const evidenceAt = at("metadata", `metadata[${i}].evidence`, i);
    const evidence = record(entry.evidence, evidenceAt);
    ensure(Object.keys(evidence).length === 3 && Object.hasOwn(evidence, "context"), "metadata_evidence_shape", evidenceAt);
    grounded(evidence as unknown as Gate["evidence"][number], job, at("evidence", `metadata[${i}].evidence`, i));
    const branchesAt = at("metadata", `metadata[${i}].branches`, i);
    ensure(Array.isArray(entry.branches) && entry.branches.every(b => typeof b === "string" && b.trim() && String(evidence.quote).includes(b)), "metadata_branches_ungrounded", branchesAt);
    if (entry.kind === "compound_or") {
      const branches = String(evidence.quote).split(/[，,]?\s*或/).map(b => b.trim()).filter(Boolean);
      ensure(branches.length >= 2 && JSON.stringify(entry.branches) === JSON.stringify(branches), "compound_or_branches_mismatch", branchesAt);
    } else ensure(entry.branches.length === 0 && !isCompoundOr(String(evidence.quote)), "unsupported_branches_present", branchesAt);
    if (preferred.test(String(evidence.quote))) ensure(entry.requirement === "preferred", "preferred_context_marked_mandatory", metaAt);
    if (unresolved) ensure(unresolved.some(c => c.source === evidence.source && c.quote === evidence.quote), "metadata_outside_unresolved_clause", metaAt);
    return entry as unknown as ExtractionMetadata;
  });
  if (unresolved) for (const [i, clause] of unresolved.entries()) {
    ensure(gates.some(g => g.evidence.some(e => e.source === clause.source && e.quote === clause.quote)) || metadata.some(m => m.evidence.source === clause.source && m.evidence.quote === clause.quote), "unresolved_clause_unaddressed", at("unresolved", `unresolved[${i}]`, i));
  }
  return { gates, metadata };
}
