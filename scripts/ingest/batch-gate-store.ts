import type { BatchJob } from './batch-gate-extraction';
import { classify } from './batch-gate-extraction';
import { createGateExtractionStore } from './gate-extraction-store';
/** Explicitly reopen only a failed/stale attempt, with CAS; never clear valid gates. */
export function createBatchStore(baseUrl: string, key: string, request: typeof fetch = fetch) {
  const store = createGateExtractionStore(baseUrl, key, request);
  return { write: store.write, async prepare(job: BatchJob): Promise<BatchJob> {
    if (classify(job) === 'skip') throw new Error('Current success cannot be reopened');
    if (job.extraction_attempt_hash !== job.raw_content_hash) return job;
    const query = new URLSearchParams({ id: `eq.${job.id}`, raw_content_hash: `eq.${job.raw_content_hash}`,
      extraction_attempt_hash: `eq.${job.extraction_attempt_hash}`,
      extraction_attempted_at: job.extraction_attempted_at ? `eq.${job.extraction_attempted_at}` : 'is.null',
      extraction_status: job.extraction_status ? `eq.${job.extraction_status}` : 'is.null',
      extraction_version: job.extraction_version ? `eq.${job.extraction_version}` : 'is.null', select: 'id' });
    const headers: Record<string,string> = { apikey:key, 'Content-Type':'application/json', Prefer:'return=representation' };
    if (!key.startsWith('sb_secret_')) headers.Authorization=`Bearer ${key}`;
    const response=await request(new URL(`/rest/v1/jobs?${query}`,baseUrl),{method:'PATCH',headers,redirect:'error',signal:AbortSignal.timeout(30000),
      body:JSON.stringify({extraction_attempt_hash:null,extraction_status:'failed',extraction_error:'batch_retry_pending'})});
    if(!response.ok) throw new Error('Batch prepare failed');
    const rows=await response.json(); if(!Array.isArray(rows)||rows.length!==1||rows[0].id!==job.id)throw new Error('Batch prepare CAS failed');
    return {...job,extraction_attempt_hash:null,extraction_status:'failed',extraction_error:'batch_retry_pending'};
  }};
}
