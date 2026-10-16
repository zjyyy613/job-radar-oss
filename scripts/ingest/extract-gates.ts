import type { Gate } from "../../src/lib/domain/gate";
import type { CanonicalJob } from "../../src/lib/domain/canonical-job";
import { parseGates, type ExtractionMetadata, type JobText } from "./gate-parser";
import { validateExtraction } from "./gate-extraction-validation";
import { createDeepSeekModel, deepseekConfig, type ExtractionModel } from "./deepseek-responses";
import { diagnosticFrom, type ExtractionDiagnostic } from "./extraction-diagnostics";

export const EXTRACTION_VERSION = "spike-v2-m0-v1";
export interface ExtractionJob extends JobText {
  id: string; raw_content_hash: string | null; gates: Gate[];
  extraction_attempt_hash: string | null;
}
export interface ExtractionResult {
  status: "skipped" | "success" | "failed";
  gates: Gate[]; metadata: ExtractionMetadata[]; model_calls: number;
  extraction_version: string; extractor_type: "deterministic" | "deterministic+deepseek";
  extracted_at: string; error: string | null;
  /** Internal, content-free failure location (stage/reason code/path/index).
   * Additive only: `error` keeps its original outward value. */
  diagnostic?: ExtractionDiagnostic | null;
}
export async function extractJob(job: ExtractionJob, model: ExtractionModel): Promise<ExtractionResult> {
  const base: ExtractionResult = { status: "skipped", gates: job.gates, metadata: [], model_calls: 0,
    extraction_version: EXTRACTION_VERSION, extractor_type: "deterministic", extracted_at: new Date().toISOString(), error: null };
  if (job.raw_content_hash && job.raw_content_hash === job.extraction_attempt_hash) return base;
  if (!job.raw_content_hash) return { ...base, status: "failed", error: "missing_content_hash", diagnostic: { stage: "content", code: "missing_content_hash" } };
  try {
    const parsed = parseGates(job);
    const deterministic = validateExtraction(parsed, job);
    if (parsed.unresolved.length) {
      base.model_calls = 1;
      base.extractor_type = "deterministic+deepseek";
      const text: JobText = { title: job.title, description: job.description, requirements: job.requirements };
      const fallback = validateExtraction(await model(text, parsed.unresolved), text, parsed.unresolved);
      deterministic.gates.push(...fallback.gates);
      deterministic.metadata.push(...fallback.metadata);
    }
    return { ...base, status: "success", gates: [...new Map(deterministic.gates.map(g => [g.id, g])).values()], metadata: deterministic.metadata };
  } catch (error) {
    const code = error instanceof Error && /^(model_transport_failed|model_http_\d{3}|model_output_invalid|invalid_extraction)$/.test(error.message) ? error.message : "invalid_extraction";
    // Outward class stays `invalid_extraction`; the location is internal and content-free.
    const stage = code.startsWith("model_") ? "model" : code === "invalid_extraction" ? "structure" : "content";
    return { ...base, status: "failed", error: code, diagnostic: diagnosticFrom(error, stage, code) };
  }
}

/** Plan interface for an unpersisted job. The runner adds persisted hash skipping. */
export async function extractGates(job: CanonicalJob): Promise<Gate[]> {
  const result = await extractJob({ ...job, extraction_attempt_hash: null }, (input, clauses) => createDeepSeekModel(deepseekConfig(process.env))(input, clauses));
  if (result.status === "failed") throw new Error("extraction_failed");
  return result.gates;
}
