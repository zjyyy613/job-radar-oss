import { validateGate, type Gate, type GateCondition } from "../../src/lib/domain/gate";
import { ambiguous, gateId, isCompoundOr, parseGates, preferred, splitClauses, type Clause, type Extraction, type ExtractionMetadata, type JobText } from "./gate-parser";
import { degrees, majors, research } from "./gate-vocabulary";

function ensure(value: unknown): asserts value { if (!value) throw new Error("invalid_extraction"); }
function record(value: unknown): Record<string, unknown> {
  ensure(value && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}
function grounded(evidence: Gate["evidence"][number], job: JobText) {
  ensure(evidence && typeof evidence.quote === "string" && evidence.quote.trim());
  ensure(["title", "description", "requirements"].includes(evidence.source));
  const text = job[evidence.source as keyof JobText];
  ensure(typeof text === "string" && text.includes(evidence.quote));
  ensure(evidence.context === null || typeof evidence.context === "string" && text.includes(evidence.context) && evidence.context.includes(evidence.quote));
}
function validateValue(condition: GateCondition, quote: string) {
  const { field, value } = condition;
  if (value.kind === "one_of") for (const item of value.values) {
    if (field === "major" || field === "research_areas" || field === "education") {
      const vocabulary = field === "major" ? majors : field === "research_areas" ? research : degrees;
      ensure(typeof item === "string" && Object.hasOwn(vocabulary, item) && vocabulary[item].test(quote));
    } else if (field === "graduation_year") {
      ensure([...quote.matchAll(/(20\d{2}|\d{2})届/g)].some(m => Number(m[1].length === 2 ? `20${m[1]}` : m[1]) === item));
    } else if (field === "student_status") {
      ensure(item === "enrolled" ? /在校生|在读学生|在读[本硕博]/.test(quote) : /已毕业/.test(quote));
    }
  }
  if (value.kind === "education_minimum") ensure(degrees[value.value].test(quote) && /及以上|以上/.test(quote));
  if (value.kind === "minimum") ensure(new RegExp(`${value.value}\\s*${field === "days_per_week" ? "天" : "个月"}`).test(quote));
}

/** Independent of the provider: exact evidence, frozen structure, audited values,
 * and conservative semantics are all required before any persistence. */
export function validateExtraction(value: unknown, job: JobText, unresolved?: Clause[]): Extraction {
  const output = record(value);
  ensure(Array.isArray(output.gates) && Array.isArray(output.metadata));
  if (unresolved) ensure(Object.keys(output).length === 2);
  const clauses = splitClauses(job);
  const deterministic = parseGates(job).gates;
  const gates = output.gates.map(item => {
    const gate = validateGate(item);
    gate.evidence.forEach(e => grounded(e, job));
    const quote = gate.evidence.map(e => e.quote).join("\n");
    if (unresolved) ensure(gate.evidence.every(e => unresolved.some(c => c.source === e.source && c.quote.includes(e.quote))));
    const contexts = gate.evidence.flatMap(e => clauses.filter(c => c.source === e.source && c.quote.includes(e.quote)));
    ensure(!isCompoundOr(quote) && !contexts.some(c => isCompoundOr(c.quote)));
    if (preferred.test(quote) || contexts.some(c => c.requirement === "preferred")) ensure(gate.requirement === "preferred");
    if (ambiguous.test(quote) || contexts.some(c => c.requirement === "ambiguous")) ensure(gate.requirement !== "required");
    if (gate.evidence.every(e => e.source === "title")) ensure(gate.field === "graduation_year" && gate.requirement === "ambiguous" && gate.scope === "program");
    if (gate.value.kind === "or") {
      ensure(/或/.test(quote));
      gate.value.alternatives.forEach(condition => validateValue(condition, quote));
    } else validateValue({ field: gate.field, value: gate.value } as GateCondition, quote);
    // A hard gate needs deterministic semantic confirmation, not merely a matching
    // word in its quote. Unknown compound/conditional requirements remain metadata.
    if (gate.requirement === "required") ensure(deterministic.some(g => g.field === gate.field && g.requirement === "required" && JSON.stringify(g.value) === JSON.stringify(gate.value)
      && g.evidence.some(e => gate.evidence.some(other => other.source === e.source && (e.quote.includes(other.quote) || other.quote.includes(e.quote))))));
    const { id: _id, ...data } = gate;
    void _id;
    return { ...data, id: gateId(data) };
  });
  const metadata = output.metadata.map(item => {
    const entry = record(item);
    ensure(Object.keys(entry).length === 4 && ["kind", "requirement", "evidence", "branches"].every(k => Object.hasOwn(entry, k)));
    ensure(["unsupported", "compound_or", "experience"].includes(String(entry.kind)) && ["required", "preferred", "ambiguous"].includes(String(entry.requirement)));
    const evidence = record(entry.evidence);
    ensure(Object.keys(evidence).length === 3 && Object.hasOwn(evidence, "context"));
    grounded(evidence as unknown as Gate["evidence"][number], job);
    ensure(Array.isArray(entry.branches) && entry.branches.every(b => typeof b === "string" && b.trim() && String(evidence.quote).includes(b)));
    if (entry.kind === "compound_or") {
      const branches = String(evidence.quote).split(/[，,]?\s*或/).map(b => b.trim()).filter(Boolean);
      ensure(branches.length >= 2 && JSON.stringify(entry.branches) === JSON.stringify(branches));
    } else ensure(entry.branches.length === 0 && !isCompoundOr(String(evidence.quote)));
    if (preferred.test(String(evidence.quote))) ensure(entry.requirement === "preferred");
    if (unresolved) ensure(unresolved.some(c => c.source === evidence.source && c.quote === evidence.quote));
    return entry as unknown as ExtractionMetadata;
  });
  if (unresolved) for (const clause of unresolved) {
    ensure(gates.some(g => g.evidence.some(e => e.source === clause.source && e.quote === clause.quote)) || metadata.some(m => m.evidence.source === clause.source && m.evidence.quote === clause.quote));
  }
  return { gates, metadata };
}
