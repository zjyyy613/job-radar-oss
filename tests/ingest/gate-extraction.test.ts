import { describe, expect, it, vi } from "vitest";
import samples from "../fixtures/gates/spike-sample-6.json";
import modelRun from "../fixtures/gates/spike-model-run-2.json";
import outOfScope from "../fixtures/gates/out-of-scope-model-output.json";
import { parseGates } from "../../scripts/ingest/gate-parser";
import { validateExtraction } from "../../scripts/ingest/gate-extraction-validation";
import { extractJob, type ExtractionJob } from "../../scripts/ingest/extract-gates";

const jd = (requirements: string | null, title = "实习生") => ({ title, description: null, requirements });
describe("Spike six-job regression", () => {
  it("runs all six offline through independent validation, preserving unsupported OR branches", async () => {
    for (const sample of samples) {
      const result = await extractJob({ ...sample, id: sample.post_id, raw_content_hash: "fixture", gates: [], extraction_attempt_hash: null }, async (_job, clauses) => ({
        gates: [], metadata: clauses.map(c => ({ kind: c.quote.includes("长期科研意愿") ? "compound_or" : "unsupported", requirement: c.requirement,
          evidence: { quote: c.quote, source: c.source, context: null },
          branches: c.quote.includes("长期科研意愿") ? c.quote.split(/[，,]?\s*或/).map(b => b.trim()).filter(Boolean) : [] })),
      }));
      expect(result.status, sample.post_id).toBe("success");
      expect(() => validateExtraction(result, sample)).not.toThrow();
      if (sample.post_id === "7666032765686942006") expect(result.metadata.find(m => m.kind === "compound_or" && m.evidence.quote.includes("长期科研意愿"))?.branches).toEqual(["CV / ML / 机器人 / AI 相关方向博士", "具备长期科研意愿的硕士"]);
    }
  });
  it("retains run-2's known invalid result as a regression, rejecting unsupported research ml", () => {
    expect(modelRun.results.filter(r => !r.semantic_valid)).toHaveLength(1);
    const gate = { ...parseGates(samples[4]).gates[0], field: "research_areas", value: { kind: "one_of", values: ["ml"] },
      evidence: [{ quote: "机器学习", source: "requirements", context: null }] };
    expect(() => validateExtraction({ gates: [gate], metadata: [] }, samples[4])).toThrow();
  });
  it("rejects real out-of-scope output instead of silently accepting duplicate/full-JD extraction", () => {
    expect(() => validateExtraction(outOfScope.output, samples[4], parseGates(samples[4]).unresolved)).toThrow();
  });
  it("keeps required STEM and does not infer student status from internship labels", () => {
    const result = parseGates(samples[0]);
    expect(result.gates).toEqual(expect.arrayContaining([expect.objectContaining({ field: "major", requirement: "required", value: { kind: "one_of", values: ["stem"] } })]));
    expect(result.gates.some(g => g.field === "student_status")).toBe(false);
  });
  it("keeps Tencent major preference soft", () => {
    const result = parseGates(samples[1]);
    expect(result.gates.find(g => g.field === "major")?.requirement).toBe("preferred");
    expect(result.gates.some(g => g.field === "major" && g.requirement === "required")).toBe(false);
  });
  it("does not flatten Xiaomi compound OR", () => {
    const result = parseGates(samples[2]);
    expect(result.unresolved.some(c => c.quote.includes("长期科研意愿"))).toBe(true);
    expect(result.gates.some(g => g.field === "education")).toBe(false);
    expect(result.gates.find(g => g.field === "research_areas")?.value).toEqual({ kind: "one_of", values: ["vlm", "multimodal", "video_understanding", "3d_vision", "vln", "embodied_agent", "rl", "video_generation", "world_model"] });
  });
  it("extracts COE gates with original spacing and title ambiguity", () => {
    const result = parseGates(samples[3]);
    expect(result.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "graduation_year", requirement: "ambiguous", scope: "program" }),
      expect.objectContaining({ field: "education", value: { kind: "education_minimum", value: "bachelor" } }),
      expect.objectContaining({ field: "days_per_week", value: { kind: "minimum", value: 5 } }),
      expect.objectContaining({ field: "duration_months", value: { kind: "minimum", value: 6 } }),
      expect.objectContaining({ field: "major", requirement: "preferred" }),
      expect.objectContaining({ field: "student_status", requirement: "required" }),
    ]));
    expect(() => validateExtraction(result, samples[3])).not.toThrow();
  });
  it("keeps vivo doctorate required and related computer major required", () => {
    const result = parseGates(samples[4]);
    expect(result.gates).toEqual(expect.arrayContaining([
      expect.objectContaining({ field: "education", requirement: "required", value: { kind: "education_minimum", value: "doctorate" } }),
      expect.objectContaining({ field: "major", requirement: "required", value: { kind: "one_of", values: ["computer_science"] } }),
      expect.objectContaining({ field: "graduation_year", requirement: "ambiguous", scope: "program" }),
    ]));
  });
  it("keeps vivo quality education and major conditions", () => {
    const result = parseGates(samples[5]);
    expect(result.gates.find(g => g.field === "major")?.value).toEqual({ kind: "one_of", values: ["electronics", "mechanical", "optics", "semiconductor"] });
    expect(result.gates.find(g => g.field === "education")?.requirement).toBe("required");
  });
});

describe("independent validation and parser", () => {
  it("null means absent", () => expect(parseGates({ title: null, description: null, requirements: null }).gates).toEqual([]));
  it("experience preference is nonblocking metadata", () => {
    const result = parseGates(jd("有开发经验优先；有项目经验更佳"));
    expect(result.gates).toEqual([]);
    expect(result.metadata).toHaveLength(2);
    expect(result.metadata.every(m => m.requirement === "preferred")).toBe(true);
  });
  it("body explicit year is required; no duplicate soft title gate", () => {
    expect(parseGates(jd("仅限2027届毕业生", "27届实习")).gates.filter(g => g.field === "graduation_year").map(g => g.requirement)).toEqual(["required"]);
  });
  it("simple OR remains OR", () => {
    const gates = parseGates(jd("本科或硕士学历")).gates;
    expect(gates[0].value.kind).toBe("or");
  });
  it("cross-field OR stays one gate, never two independent required gates", () => {
    const input = jd("每周到岗3天或连续实习6个月");
    const parsed = parseGates(input);
    expect(parsed.gates).toHaveLength(1);
    expect(parsed.gates[0].value).toEqual({ kind: "or", alternatives: [
      { field: "days_per_week", value: { kind: "minimum", value: 3 } },
      { field: "duration_months", value: { kind: "minimum", value: 6 } },
    ] });
    expect(() => validateExtraction(parsed, input)).not.toThrow();
  });
  it.each(["无需在校生身份", "非在校生", "在校生除外", "学历不限", "每周最多3天", "连续实习3个月以内", "面向2026-2027届毕业生"])("does not invent hard gates for %s", text => {
    expect(parseGates(jd(text)).gates).toEqual([]);
  });
  it("unknown alternatives cannot narrow a required major list", () => {
    const result = parseGates(jd("计算机、材料科学、软件工程等相关专业"));
    expect(result.gates).toEqual([]);
    expect(result.unresolved).toHaveLength(0);
    expect(result.metadata[0]).toMatchObject({ kind: "unsupported", evidence: { quote: "计算机、材料科学、软件工程等相关专业" } });
  });
  it("a fabricated context is rejected even if quote itself is grounded", () => {
    const input = jd("本科及以上");
    const gate = parseGates(input).gates[0];
    gate.evidence[0].context = "伪造上下文：本科及以上";
    expect(() => validateExtraction({ gates: [gate], metadata: [] }, input)).toThrow();
  });
  it("model cannot use a short quote to hide preferred context", () => {
    const input = jd("计算机专业优先");
    const gate = parseGates(input).gates[0];
    gate.evidence[0].quote = "计算机专业";
    gate.requirement = "required";
    expect(() => validateExtraction({ gates: [gate], metadata: [] }, input)).toThrow();
  });
  it.each(["empty", "fabricated", "unsupported", "preferred-hard", "malformed"])("rejects %s output", kind => {
    const input = jd("计算机专业优先");
    const gate = structuredClone(parseGates(input).gates[0]);
    if (kind === "empty") gate.evidence[0].quote = "";
    if (kind === "fabricated") gate.evidence[0].quote = "计算机专业必须";
    if (kind === "unsupported") gate.value = { kind: "one_of", values: ["invented"] };
    if (kind === "preferred-hard") gate.requirement = "required";
    expect(() => validateExtraction({ gates: kind === "malformed" ? [null] : [gate], metadata: [] }, input)).toThrow();
  });
});

describe("hash and failure isolation", () => {
  const job = (): ExtractionJob => ({ ...jd("CV / ML / 机器人 / AI 相关方向博士，或具备长期科研意愿的硕士"), id: "job", raw_content_hash: "new", gates: [], extraction_attempt_hash: null });
  it("unchanged hash makes zero model calls", async () => {
    const model = vi.fn();
    expect((await extractJob({ ...job(), extraction_attempt_hash: "new" }, model)).status).toBe("skipped");
    expect(model).not.toHaveBeenCalled();
  });
  it("changed hash reextracts and malformed output preserves valid gates", async () => {
    const previous = parseGates(jd("本科及以上")).gates;
    const input = { ...job(), gates: previous, extraction_attempt_hash: "old" };
    const model = vi.fn().mockResolvedValue({ gates: [null], metadata: [] });
    const result = await extractJob(input, model);
    expect(model).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("failed");
    expect(result.gates).toEqual(previous);
  });
  it("simple JD never calls model", async () => {
    const model = vi.fn();
    expect((await extractJob({ ...job(), ...jd("在校生；本科及以上；每周到岗5天；连续实习6个月以上") }, model)).status).toBe("success");
    expect(model).not.toHaveBeenCalled();
  });
});
