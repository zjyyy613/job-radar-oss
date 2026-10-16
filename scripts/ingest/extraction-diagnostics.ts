/**
 * Safe, stable diagnostics for extraction failures.
 *
 * The outward failure class is unchanged (`invalid_extraction`): the database
 * contract and every consumer of `extraction_error` keep seeing exactly what
 * they saw before. This module only adds *internal* location information —
 * validation stage, frozen reason code, field path and index — so a failure can
 * be located without ever carrying JD text, model output, credentials, request
 * headers or upstream error bodies.
 *
 * Safety is structural, not conventional: every field is matched against an
 * allowlist of identifier shapes, so a caller that accidentally passes a JD
 * fragment simply loses it instead of logging it.
 */
export type DiagnosticStage =
  | "structure"
  | "gate"
  | "evidence"
  | "value"
  | "semantics"
  | "metadata"
  | "unresolved"
  | "content"
  | "model";

export interface ExtractionDiagnostic {
  stage: DiagnosticStage;
  code: string;
  path?: string;
  index?: number;
}

const STAGES: readonly DiagnosticStage[] = [
  "structure", "gate", "evidence", "value", "semantics", "metadata", "unresolved", "content", "model",
];
/** Reason codes are single lowercase identifiers; free text can never match. */
const CODE = /^[a-z][a-z0-9_]{0,63}$/;
/** Field paths are dotted/indexed identifiers only. */
const PATH = /^[a-z][a-zA-Z0-9_.[\]]{0,79}$/;
/** Only a bare identifier may pass through from an arbitrary Error message. */
const IDENTIFIER = /^[a-zA-Z][a-zA-Z0-9_.]{0,63}$/;
const CONTRACT = /^Invalid gate:\s*([a-zA-Z][a-zA-Z0-9_.[\]]{0,79})$/;

export class ExtractionValidationFailure extends Error {
  readonly diagnostic: ExtractionDiagnostic;
  constructor(diagnostic: Partial<ExtractionDiagnostic> | undefined) {
    super("invalid_extraction");
    this.name = "ExtractionValidationFailure";
    this.diagnostic = normalizeDiagnostic(diagnostic);
  }
}

/** Drops anything that is not an allowlisted identifier shape. */
export function normalizeDiagnostic(value: Partial<ExtractionDiagnostic> | undefined): ExtractionDiagnostic {
  const stage = value && STAGES.includes(value.stage as DiagnosticStage) ? (value.stage as DiagnosticStage) : "structure";
  const diagnostic: ExtractionDiagnostic = { stage, code: "unspecified" };
  if (value && typeof value.code === "string" && CODE.test(value.code)) diagnostic.code = value.code;
  if (value && typeof value.path === "string" && PATH.test(value.path)) diagnostic.path = value.path;
  if (value && Number.isInteger(value.index) && (value.index as number) >= 0 && (value.index as number) <= 100_000) {
    diagnostic.index = value.index;
  }
  return diagnostic;
}

export function fail(stage: DiagnosticStage, code: string, extra: { path?: string; index?: number } = {}): never {
  throw new ExtractionValidationFailure({ stage, code, path: extra.path, index: extra.index });
}

/** Rethrows an arbitrary error as a located validation failure, preserving any location we already know. */
export function failFrom(error: unknown, stage: DiagnosticStage, code: string, extra: { index?: number } = {}): never {
  const diagnostic = diagnosticFrom(error, stage, code);
  if (extra.index !== undefined) diagnostic.index = extra.index;
  throw new ExtractionValidationFailure(diagnostic);
}

/**
 * Converts any thrown value into a bounded diagnostic.
 *
 * Frozen domain contracts (e.g. `gate.ts`) throw `Invalid gate: <path>`; that
 * path is a field name and is safe to keep. Any other message is kept only when
 * it is a bare identifier — a sentence that could quote a JD is discarded.
 */
export function diagnosticFrom(error: unknown, stage: DiagnosticStage, code: string): ExtractionDiagnostic {
  if (error instanceof ExtractionValidationFailure) return normalizeDiagnostic(error.diagnostic);
  const message = error instanceof Error ? error.message : "";
  const contract = CONTRACT.exec(message);
  if (contract) return normalizeDiagnostic({ stage: "gate", code: "gate_contract_rejected", path: contract[1] });
  if (IDENTIFIER.test(message)) return normalizeDiagnostic({ stage, code: message.replace(/\./g, "_").toLowerCase() });
  return normalizeDiagnostic({ stage, code });
}

/** Stable single-line rendering used in run output, checkpoints and summaries. */
export function describeDiagnostic(value: Partial<ExtractionDiagnostic> | undefined): string {
  const diagnostic = normalizeDiagnostic(value);
  return [
    diagnostic.stage,
    diagnostic.code,
    diagnostic.path,
    diagnostic.index === undefined ? undefined : `#${diagnostic.index}`,
  ].filter(Boolean).join(":");
}
