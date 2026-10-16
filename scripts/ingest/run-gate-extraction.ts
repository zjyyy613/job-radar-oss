import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createDeepSeekModel, deepseekConfig, type ExtractionModel } from "./deepseek-responses";
import { extractJob, type ExtractionJob } from "./extract-gates";
import { createGateExtractionStore } from "./gate-extraction-store";
import { serverConfig } from "./source-store";
import { parseGates } from "./gate-parser";
import { describeDiagnostic } from "./extraction-diagnostics";

export async function runGateExtraction(jobs: ExtractionJob[], model: ExtractionModel, store?: Pick<ReturnType<typeof createGateExtractionStore>, "write">) {
  const summary = [];
  for (const job of jobs) {
    const start = performance.now();
    const result = await extractJob(job, model);
    if (store && result.status !== "skipped") await store.write(job, result);
    summary.push({ id: job.id, status: result.status, model_calls: result.model_calls, gates: result.gates.length,
      metadata: result.status === "skipped" ? null : result.metadata.length,
      extractor_type: result.status === "skipped" ? null : result.extractor_type, duration_ms: Math.round(performance.now() - start), error: result.error,
      diagnostic: result.status === "failed" && result.diagnostic ? describeDiagnostic(result.diagnostic) : null });
    // Bounded, secret-free progress during slow model requests.
    console.log(JSON.stringify(summary.at(-1)));
  }
  return summary;
}
async function main() {
  if (existsSync(".env.local")) process.loadEnvFile(".env.local");
  const [mode, ...ids] = process.argv.slice(2);
  if (!["--preview", "--write", "--corpus"].includes(mode)) throw new Error("Use --preview/--write with 1–6 job IDs, or --corpus");
  if (mode === "--corpus") {
    if (ids.length) throw new Error("Corpus mode takes no IDs");
    const samples = JSON.parse(readFileSync("tests/fixtures/gates/spike-sample-6.json", "utf8"));
    const rows: ExtractionJob[] = samples.map((sample: ExtractionJob & { post_id: string }) => ({ ...sample, id: sample.post_id,
      raw_content_hash: `corpus:${sample.post_id}`, extraction_attempt_hash: null, gates: [] }));
    const model = createDeepSeekModel(deepseekConfig(process.env));
    const results = await runGateExtraction(rows, model);
    if (results.some(r => r.status === "failed")) process.exitCode = 1;
    return;
  }
  const config = serverConfig(process.env);
  const store = createGateExtractionStore(config.url, config.key);
  const rows = await store.read(ids);
  if (mode === "--preview") {
    console.log(JSON.stringify(rows.map(job => ({ id: job.id, unchanged: job.raw_content_hash === job.extraction_attempt_hash,
      deterministic_gates: parseGates(job).gates.length, unresolved_clauses: parseGates(job).unresolved.length })), null, 2));
    return;
  }
  // Validate configuration before any write; model calls remain lazy and clause-scoped.
  const results = await runGateExtraction(rows, createDeepSeekModel(deepseekConfig(process.env)), store);
  if (results.some(r => r.status === "failed")) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const deadline = setTimeout(() => { console.error("Extraction runner timed out; inspect DB before retrying writes."); process.exit(1); }, 720_000);
  await main().catch(() => { console.error("Extraction runner failed. Check server configuration and migrations; inspect DB before retrying writes."); process.exitCode = 1; }).finally(() => clearTimeout(deadline));
}
