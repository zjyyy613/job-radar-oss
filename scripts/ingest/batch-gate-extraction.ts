import type { CanonicalJob } from '../../src/lib/domain/canonical-job';
import { extractionIsReady, type ExtractionReadiness } from '../../src/lib/domain/qualification-engine';
import { parseGates } from './gate-parser';
import { validateExtraction } from './gate-extraction-validation';
import { extractJob, EXTRACTION_VERSION, type ExtractionResult } from './extract-gates';
import type { ExtractionModel } from './deepseek-responses';
export type BatchJob = CanonicalJob & ExtractionReadiness & { extraction_attempted_at: string | null };
export function classify(job: BatchJob): 'skip' | 'parser' | 'model' | 'invalid' {
  if (extractionIsReady(job) && job.extraction_version === EXTRACTION_VERSION) return 'skip';
  if (!job.raw_content_hash) return 'invalid';
  try { const parsed = parseGates(job); validateExtraction(parsed, job); return parsed.unresolved.length ? 'model' : 'parser'; }
  catch { return 'invalid'; }
}
export interface Checkpoint {
  version: 1; extraction_version: string; max_calls: number; calls: number;
  entries: Record<string, { hash: string | null; state: 'started' | 'result' | 'done'; result?: ExtractionResult }>;
}
export interface BatchStore { prepare(job: BatchJob): Promise<BatchJob>; write(job: BatchJob, result: ExtractionResult): Promise<unknown> }
/** A serial worker is deliberately the concurrency bound. Checkpoint reserves every HTTP attempt before dispatch. */
export async function runBatch(jobs: BatchJob[], model: ExtractionModel, store: BatchStore, checkpoint: Checkpoint,
  save: () => void, options: { stopped?: () => boolean; pause?: (ms: number) => Promise<void>; progress?: (row: object) => void } = {}) {
  if (jobs.length > 500 || checkpoint.version !== 1 || checkpoint.extraction_version !== EXTRACTION_VERSION || !Number.isInteger(checkpoint.max_calls) || checkpoint.max_calls < 0 || checkpoint.max_calls > 200 || checkpoint.calls < 0 || checkpoint.calls > checkpoint.max_calls) throw new Error('Invalid batch budget');
  const pause = options.pause ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const summary: { id: string; status: string; error?: string | null }[] = [];
  for (const job of jobs) {
    if (options.stopped?.()) break;
    const kind = classify(job), prior = checkpoint.entries[job.id];
    if (!job.raw_content_hash) { summary.push({ id: job.id, status: 'failed', error: 'missing_content_hash' }); continue; }
    if (kind === 'skip') { summary.push({ id: job.id, status: 'skipped' }); continue; }
    if (prior?.hash === job.raw_content_hash && prior.state === 'done') { summary.push({ id: job.id, status: 'checkpoint_done' }); continue; }
    // An abruptly terminated request may have been billed. Never blindly repeat it on resume.
    if (prior?.hash === job.raw_content_hash && prior.state === 'started') { summary.push({ id: job.id, status: 'uncertain_interrupted' }); continue; }
    if (kind === 'model' && checkpoint.calls >= checkpoint.max_calls && !(prior?.hash === job.raw_content_hash && prior.state === 'result')) { summary.push({ id: job.id, status: 'budget_deferred' }); continue; }
    let prepared: BatchJob;
    try { prepared = await store.prepare(job); }
    catch { summary.push({ id: job.id, status: 'store_unconfirmed' }); break; }
    let result = prior?.hash === job.raw_content_hash && prior.state === 'result' ? prior.result : undefined;
    if (!result) {
      checkpoint.entries[job.id] = { hash: job.raw_content_hash, state: 'started' }; save();
      const guarded: ExtractionModel = async (text, clauses) => {
        for (let attempt = 0; attempt < 2; attempt++) {
          if (checkpoint.calls >= checkpoint.max_calls || options.stopped?.()) throw new Error('model_transport_failed');
          await pause(attempt ? 1500 : 350);
          checkpoint.calls++; save();
          try { return await model(text, clauses); }
          catch (error) {
            if (attempt || !(error instanceof Error) || !/^(model_transport_failed|model_http_5\d\d)$/.test(error.message)) throw error;
          }
        }
        throw new Error('model_transport_failed');
      };
      // Explicit batch retry authorization; original extractor default skip semantics stay intact.
      result = await extractJob({ ...prepared, extraction_attempt_hash: null }, guarded);
      checkpoint.entries[job.id] = { hash: job.raw_content_hash, state: 'result', result }; save();
    }
    try { await store.write(prepared, result); }
    catch { summary.push({ id: job.id, status: 'store_unconfirmed' }); break; }
    checkpoint.entries[job.id].state = 'done'; save();
    const row = { id: job.id, status: result.status, error: result.error }; summary.push(row); options.progress?.(row);
  }
  return summary;
}
