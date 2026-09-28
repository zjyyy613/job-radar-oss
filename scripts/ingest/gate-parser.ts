import { createHash } from "node:crypto";
import type { Gate, GateEvidence, GateField, GateRequirement, GateValue } from "../../src/lib/domain/gate";
import type { Education } from "../../src/lib/domain/profile";
import { completeMajorList, degrees, majors, research, tokens } from "./gate-vocabulary";

export interface JobText { title: string | null; description: string | null; requirements: string | null }
export interface Clause { quote: string; source: "description" | "requirements"; requirement: GateRequirement }
export interface ExtractionMetadata {
  kind: "unsupported" | "compound_or" | "experience";
  requirement: GateRequirement;
  evidence: GateEvidence;
  // Verbatim branches; never executable qualification conditions.
  branches: string[];
}
export interface Extraction { gates: Gate[]; metadata: ExtractionMetadata[] }
export const preferred = /优先|更佳|加分|优选/;
export const ambiguous = /原则上|建议|尽量|一般要求|视情况|最好|或同等|可协商|左右|大约/;
export function gateId(gate: Omit<Gate, "id">): string {
  return `gate_${createHash("sha256").update(JSON.stringify(gate)).digest("hex").slice(0, 20)}`;
}
function gate(field: GateField, value: GateValue, evidence: GateEvidence, requirement: GateRequirement, scope: "job" | "program" = "job"): Gate {
  const data = { field, value, requirement, scope, evidence: [evidence], note: null };
  return { id: gateId(data), ...data };
}
export function splitClauses(job: JobText): Clause[] {
  const output: Clause[] = [];
  for (const source of ["requirements", "description"] as const) {
    let softSection = false;
    for (const line of (job[source] ?? "").split(/\r?\n/)) {
      if (/优选条件|加分项|优先条件/.test(line)) softSection = true;
      else if (/^(?:岗位要求|任职要求|工作职责|基本要求)/.test(line.trim())) softSection = false;
      for (const sentence of line.split(/[；;。]/)) {
        const whole = sentence.trim().replace(/^\d+[、.．]\s*/, "");
        if (!whole) continue;
        // Keep compound alternatives and a preferred major clause together.
        const chunks = isCompoundOr(whole) || /专业[^，,]*优先/.test(whole) && !/本科|硕士|博士|在校生/.test(whole)
          ? [whole] : whole.split(/[，,]|、(?=可连续|连续实习)/);
        for (const chunk of chunks) {
          const quote = chunk.trim();
          if (!quote) continue;
          output.push({ quote, source, requirement: preferred.test(quote) || softSection ? "preferred" : ambiguous.test(quote) ? "ambiguous" : "required" });
        }
      }
    }
  }
  return output;
}
export function isCompoundOr(text: string): boolean {
  return /或/.test(text) && /博士|硕士|本科/.test(text) && /方向|意愿|且|同时|具备|经验/.test(text);
}
export function parseGates(job: JobText): Extraction & { unresolved: Clause[] } {
  const gates: Gate[] = [], metadata: ExtractionMetadata[] = [], unresolved: Clause[] = [];
  for (const clause of splitClauses(job)) {
    const { quote, source, requirement } = clause;
    const evidence: GateEvidence = { quote, source, context: null };
    const add = (field: GateField, value: GateValue) => gates.push(gate(field, value, evidence, requirement));
    if (/^[^，,；;]{1,12}[：:]$/.test(quote)) continue;
    if (/不限|无需|无须|不要求|不限制|不需要|不接受|不考虑|不招收|不是|非在校|除外|不超过|最多|至多|以内|以下|(?:20\d{2}|\d{2})\s*[-—至到]\s*(?:20\d{2}|\d{2})届/.test(quote)) {
      metadata.push({ kind: "unsupported", requirement: "ambiguous", evidence, branches: [] });
      continue;
    }
    if (isCompoundOr(quote)) { unresolved.push(clause); continue; }
    // Responsibilities are not eligibility. Description is used only for explicit constraints.
    if (source === "description" && !/要求|仅限|必须|每周|连续实习|在校生|学历|专业优先/.test(quote)) continue;
    if (/或/.test(quote) && !/或(?:其他)?相关专业/.test(quote)) {
      const branches = quote.split(/[，,]?\s*或/).map(b => b.trim());
      const parsed = branches.map(requirements => parseGates({ title: null, description: null, requirements }));
      if (parsed.every(p => p.gates.length === 1 && p.gates[0].value.kind !== "or" && !p.unresolved.length && !p.metadata.length)) {
        const alternatives = parsed.map(p => ({ field: p.gates[0].field, value: p.gates[0].value })) as Extract<GateValue, { kind: "or" }>["alternatives"];
        add(alternatives[0].field, { kind: "or", alternatives });
      } else {
        // Preserve unknown alternatives without turning them into independent requirements.
        metadata.push({ kind: "compound_or", requirement, evidence, branches });
      }
      continue;
    }
    if (requirement === "preferred" && /经验/.test(quote)) {
      metadata.push({ kind: "experience", requirement, evidence, branches: [] });
    }
    if (/在校生|在读学生|在读[本硕博]/.test(quote)) add("student_status", { kind: "one_of", values: ["enrolled"] });
    else if (/已毕业/.test(quote)) add("student_status", { kind: "one_of", values: ["graduated"] });
    const years = [...quote.matchAll(/(20\d{2}|\d{2})届/g)].map(m => m[1].length === 2 ? 2000 + Number(m[1]) : Number(m[1]));
    if (years.length && /仅限|面向|要求|必须|毕业生|获得.*学历/.test(quote)) add("graduation_year", { kind: "one_of", values: [...new Set(years)] });
    const levels = tokens(quote, degrees) as Education[];
    if (levels.length === 1 && !/博士后/.test(quote) && /学历|毕业生|在读|及以上|以上|^(本科|硕士|博士)$/.test(quote)) {
      add("education", /及以上|以上/.test(quote) ? { kind: "education_minimum", value: levels[0] } : { kind: "one_of", values: levels });
    } else if (levels.length > 1) {
      if (/^(本科|硕士|博士)(或(本科|硕士|博士))+(学历)?$/.test(quote)) {
        add("education", { kind: "or", alternatives: levels.map(value => ({ field: "education", value: { kind: "one_of", values: [value] } })) });
      } else unresolved.push(clause);
    }
    if (/专业/.test(quote) && !/专业知识|专业基础|与专业相关/.test(quote)) {
      const prefix = quote.slice(0, quote.indexOf("专业"));
      const values = tokens(prefix, majors);
      if (values.length && completeMajorList(prefix)) add("major", { kind: "one_of", values });
      // A vocabulary gap is already known, not an invitation for model invention.
      // Preserve the complete list: dropping one alternative would narrow a hard gate.
      else metadata.push({ kind: "unsupported", requirement, evidence, branches: [] });
    }
    const days = quote.match(/每周(?:至少|到岗|实习|工作|出勤|不少于|保证|可|能|\s)*([1-7])\s*天/);
    if (days) add("days_per_week", { kind: "minimum", value: Number(days[1]) });
    const months = quote.match(/(?:实习|持续|连续)(?:时间|期|时长|至少|不少于|可|为|\s)*([0-9]+(?:\.[0-9]+)?)\s*个月(?:以上|及以上|起)?/);
    if (months && Number(months[1]) > 0) add("duration_months", { kind: "minimum", value: Number(months[1]) });
    if (/研究基础|相关知识/.test(quote)) {
      // ML was a known invalid research token in Spike run 2. Do not silently narrow its OR list.
      if (/机器学习|\bML\b/i.test(quote)) unresolved.push(clause);
      else {
        const values = tokens(quote, research);
        if (values.length) add("research_areas", { kind: "one_of", values });
        else unresolved.push(clause);
      }
    }
    if ((/每周/.test(quote) && !days) || (/实习.*(?:个月|半年)/.test(quote) && !months)) unresolved.push(clause);
  }
  const titleYear = job.title?.match(/(20\d{2}|\d{2})届/);
  if (titleYear && !gates.some(g => g.field === "graduation_year")) {
    gates.push(gate("graduation_year", { kind: "one_of", values: [titleYear[1].length === 2 ? 2000 + Number(titleYear[1]) : Number(titleYear[1])] },
      { quote: titleYear[0], source: "title", context: job.title }, "ambiguous", "program"));
  }
  return { gates: [...new Map(gates.map(g => [g.id, g])).values()], metadata,
    unresolved: [...new Map(unresolved.map(c => [`${c.source}:${c.quote}`, c])).values()] };
}
