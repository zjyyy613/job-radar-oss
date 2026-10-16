import { describe, expect, it, vi } from "vitest";
import samples from "../fixtures/gates/spike-sample-6.json";
import outOfScope from "../fixtures/gates/out-of-scope-model-output.json";
import { parseGates } from "../../scripts/ingest/gate-parser";
import { validateExtraction } from "../../scripts/ingest/gate-extraction-validation";
import { extractJob, type ExtractionJob } from "../../scripts/ingest/extract-gates";
import { ExtractionValidationFailure, describeDiagnostic, normalizeDiagnostic, type ExtractionDiagnostic } from "../../scripts/ingest/extraction-diagnostics";

const jd = (requirements: string | null, title = "实习生") => ({ title, description: null, requirements });
/** Runs a validation that must reject, and returns the located diagnostic it raised. */
function diagnosticOf(run: () => unknown): ExtractionDiagnostic {
  try { run(); } catch (error) {
    if (error instanceof ExtractionValidationFailure) return error.diagnostic;
    throw error;
  }
  throw new Error("expected the validation to reject this input");
}
const clone = <T>(value: T): T => structuredClone(value);

describe("extraction failure diagnostics", () => {
  it("locates ungrounded evidence with scope, reason code and field path", () => {
    const input = jd("本科及以上");
    const gate = clone(parseGates(input).gates[0]);
    gate.evidence[0].quote = "硕士及以上";
    expect(diagnosticOf(() => validateExtraction({ gates: [gate], metadata: [] }, input)))
      .toMatchObject({ stage: "evidence", code: "evidence_not_verbatim", path: "gates[0].evidence[0]", index: 0 });
  });

  it("locates a fabricated evidence context", () => {
    const input = jd("本科及以上");
    const gate = clone(parseGates(input).gates[0]);
    gate.evidence[0].context = "伪造上下文：本科及以上";
    expect(diagnosticOf(() => validateExtraction({ gates: [gate], metadata: [] }, input)))
      .toMatchObject({ stage: "evidence", code: "evidence_context_not_verbatim", path: "gates[0].evidence[0]" });
  });

  it("locates a preferred condition smuggled in as required (real Phase 1B failure mode)", () => {
    const input = jd("计算机专业优先");
    const gate = clone(parseGates(input).gates[0]);
    gate.evidence[0].quote = "计算机专业";
    gate.requirement = "required";
    expect(diagnosticOf(() => validateExtraction({ gates: [gate], metadata: [] }, input)))
      .toMatchObject({ stage: "gate", code: "preferred_context_marked_mandatory" });
  });

  it("locates a value outside the audited vocabulary", () => {
    const input = jd("计算机专业优先");
    const gate = clone(parseGates(input).gates[0]);
    gate.value = { kind: "one_of", values: ["invented"] };
    expect(diagnosticOf(() => validateExtraction({ gates: [gate], metadata: [] }, input)))
      .toMatchObject({ stage: "value", code: "value_not_in_vocabulary", path: "gates[0].value" });
  });

  it("locates a compound OR that must stay unsupported", () => {
    const input = samples[2];
    const clause = parseGates(input).unresolved.find(c => c.quote.includes("长期科研意愿"));
    expect(clause).toBeDefined();
    const gate = { ...clone(parseGates(input).gates[0]), evidence: [{ quote: clause!.quote, source: clause!.source, context: null }] };
    expect(diagnosticOf(() => validateExtraction({ gates: [gate], metadata: [] }, input)))
      .toMatchObject({ stage: "gate", code: "compound_or_not_supported", index: 0 });
  });

  it("locates a required gate with no deterministic confirmation (31 parser×validator failures)", () => {
    const input = jd("计算机、材料科学、软件工程等相关专业");
    expect(parseGates(input).gates).toEqual([]);
    // Built from a parsed gate so the frozen contract shape (including `id`) stays valid.
    const base = clone(parseGates(jd("本科及以上")).gates[0]);
    const gate = { ...base, field: "major", requirement: "required", scope: "job",
      value: { kind: "one_of", values: ["computer_science"] },
      evidence: [{ quote: "计算机、材料科学、软件工程等相关专业", source: "requirements", context: null }] };
    expect(diagnosticOf(() => validateExtraction({ gates: [gate], metadata: [] }, input)))
      .toMatchObject({ stage: "gate", code: "required_without_deterministic_confirmation" });
  });

  it("captures the frozen contract's field path instead of a generic failure", () => {
    const input = jd("本科及以上");
    const diagnostic = diagnosticOf(() => validateExtraction({ gates: [null], metadata: [] }, input));
    expect(diagnostic.stage).toBe("gate");
    expect(diagnostic.code).toBe("gate_contract_rejected");
    expect(diagnostic.index).toBe(0);
    expect(typeof diagnostic.path).toBe("string");
    expect(diagnostic.path!.length).toBeGreaterThan(0);
  });

  it("locates malformed metadata", () => {
    expect(diagnosticOf(() => validateExtraction({ gates: [], metadata: [{ kind: "unsupported" }] }, jd("本科及以上"))))
      .toMatchObject({ stage: "metadata", code: "metadata_shape", path: "metadata[0]", index: 0 });
  });

  it("locates an unaddressed unresolved clause", () => {
    const input = samples[2];
    const unresolved = parseGates(input).unresolved;
    expect(diagnosticOf(() => validateExtraction({ gates: [], metadata: [] }, input, unresolved)))
      .toMatchObject({ stage: "unresolved", code: "unresolved_clause_unaddressed", index: 0 });
  });

  it("keeps real out-of-scope model output located but still rejected", () => {
    const input = samples[4];
    const diagnostic = diagnosticOf(() => validateExtraction(outOfScope.output, input, parseGates(input).unresolved));
    const rendered = describeDiagnostic(diagnostic);
    expect(rendered).toMatch(/^[a-z]+:[a-z0-9_]+(:[a-zA-Z0-9_.[\]#]+)*$/);
    expect(rendered).not.toMatch(/[\u4e00-\u9fff]/);
  });
});

describe("diagnostics stay outward-compatible and content-free", () => {
  it("preserves the invalid_extraction class while adding a location", async () => {
    const job = (): ExtractionJob => ({ ...jd("CV / ML / 机器人 / AI 相关方向博士，或具备长期科研意愿的硕士"),
      id: "job", raw_content_hash: "new", gates: [], extraction_attempt_hash: null });
    const result = await extractJob(job(), vi.fn().mockResolvedValue({ gates: [null], metadata: [] }));
    expect(result.status).toBe("failed");
    expect(result.error).toBe("invalid_extraction");
    expect(result.diagnostic).toMatchObject({ stage: "gate", code: "gate_contract_rejected" });
  });

  it("keeps missing content hash outward-compatible too", async () => {
    const result = await extractJob({ ...jd("本科及以上"), id: "job", raw_content_hash: null, gates: [], extraction_attempt_hash: null }, vi.fn());
    expect(result.error).toBe("missing_content_hash");
    expect(result.diagnostic).toMatchObject({ stage: "content", code: "missing_content_hash" });
  });

  it("drops anything that is not an allowlisted identifier shape", () => {
    expect(normalizeDiagnostic({ stage: "evidence", code: "本科及以上", path: "学历要求：本科" }))
      .toEqual({ stage: "evidence", code: "unspecified" });
    expect(normalizeDiagnostic({ stage: "not-a-stage" as never, code: "ok_code" }))
      .toEqual({ stage: "structure", code: "ok_code" });
  });

  it("never carries JD text, model output or credentials", () => {
    const input = jd("本科及以上");
    const gate = clone(parseGates(input).gates[0]);
    gate.evidence[0].quote = "需要博士学位以及五年以上相关经验";
    const diagnostic = diagnosticOf(() => validateExtraction({ gates: [gate], metadata: [] }, input));
    expect(JSON.stringify(diagnostic)).not.toMatch(/[\u4e00-\u9fff]/);
    expect(describeDiagnostic(diagnostic)).not.toMatch(/apikey|bearer|authorization|secret/i);
  });

  it("renders a stable single line", () => {
    expect(describeDiagnostic({ stage: "evidence", code: "evidence_not_verbatim", path: "gates[0].evidence[1]", index: 0 }))
      .toBe("evidence:evidence_not_verbatim:gates[0].evidence[1]:#0");
    expect(describeDiagnostic({ stage: "gate", code: "compound_or_not_supported" })).toBe("gate:compound_or_not_supported");
    expect(describeDiagnostic(undefined)).toBe("structure:unspecified");
  });
});
