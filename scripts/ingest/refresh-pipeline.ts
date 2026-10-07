import { extractionIsReady } from '../../src/lib/domain/qualification-engine';
import { canonicalize } from '../../src/lib/domain/canonicalize';
import { EXTRACTION_VERSION } from './extract-gates';
import { classify,runBatch,type BatchJob,type BatchStore,type Checkpoint } from './batch-gate-extraction';
import type { ExtractionModel } from './deepseek-responses';
import type { CanonicalizationSnapshot } from './canonicalization-store';
import { runIngestion,type RunOptions } from './run-job-pro';
import type { IngestionStore } from './source-store';
export function needsIncrementalExtraction(job:BatchJob) {
  if(job.extraction_status==='failed'&&job.extraction_attempt_hash===job.raw_content_hash)return false;
  return !extractionIsReady(job)||job.extraction_version!==EXTRACTION_VERSION;
}
export interface RefreshCheckpoint {
  version:1; unchanged?:number; options:RunOptions; started_at:string; baseline?:{records:number;jobs:number;ready:number};
  ingestion?:Awaited<ReturnType<typeof runIngestion>>; batch:Checkpoint;
}
interface Dependencies {
 snapshot():Promise<CanonicalizationSnapshot>;
 apply(token:string,jobs:ReturnType<typeof canonicalize>['jobs']):Promise<number>;
 cli:(args:readonly string[])=>Promise<unknown>;sourceStore:IngestionStore;gateStore:BatchStore;model:ExtractionModel;
 save():void; stopped?:()=>boolean;
}
export async function refresh(checkpoint:RefreshCheckpoint,d:Dependencies) {
 const start=performance.now();let state=await d.snapshot();
 const baseline=checkpoint.baseline??{records:state.records.length,jobs:state.jobs.length,ready:state.jobs.filter(j=>extractionIsReady(j)).length};
 checkpoint.baseline=baseline;d.save();
 if(!checkpoint.ingestion){
  checkpoint.unchanged=0;
  const previous=new Map(state.records.map(r=>[`${r.source}:${r.source_job_id}`,r.raw_hash]));
  const store:IngestionStore={...d.sourceStore,async upsertRecord(record){const result=await d.sourceStore.upsertRecord(record);if(previous.get(`${record.source}:${record.source_job_id}`)===record.raw_hash)checkpoint.unchanged!++;return result;}};
  checkpoint.ingestion=await runIngestion(checkpoint.options,{cli:d.cli,store});d.save();
 }
 const ingestion=checkpoint.ingestion;
 if(ingestion.sources.some(s=>s.audit_error||s.metrics.failure_reasons.write_failed))throw new Error('Unconfirmed ingestion write');
 state=await d.snapshot();
 if(ingestion.sources.some(s=>s.run.full_list))throw new Error('Bounded run must never be full-list');
 const plan=canonicalize(state.records,state.runs,state.jobs);
 // This pipeline has no explicit upstream closure collector: never introduce Closed here.
 const closed=new Set(state.jobs.filter(j=>j.application_status==='closed').map(j=>j.id));
 if(plan.jobs.some(j=>j.application_status==='closed'&&!closed.has(j.id)))throw new Error('Unexpected closure requires review');
 const canonical_new=plan.jobs.filter(j=>!state.jobs.some(old=>old.id===j.id)).length;
 const canonical_changed=plan.jobs.filter(j=>state.jobs.some(old=>old.id===j.id&&old.raw_content_hash!==j.raw_content_hash)).length;
 await d.apply(state.token,plan.jobs);
 state=await d.snapshot();
 const pending=(state.jobs as BatchJob[]).filter(needsIncrementalExtraction);
 const classification=pending.reduce((a,j)=>(a[classify(j)]=(a[classify(j)]??0)+1,a),{} as Record<string,number>);
 console.log(JSON.stringify({extraction_pending:pending.length,classification,max_model_calls:checkpoint.batch.max_calls,calls_reserved:checkpoint.batch.calls}));
 const extracted=await runBatch(pending,d.model,d.gateStore,checkpoint.batch,d.save,{stopped:d.stopped});
 const after=await d.snapshot();
 const identities=after.records.map(r=>`${r.source}:${r.source_job_id}`);
 if(new Set(identities).size!==identities.length||new Set(after.jobs.map(j=>j.id)).size!==after.jobs.length)throw new Error('Duplicate identities');
 let evidence=0;
 for(const job of after.jobs)for(const gate of job.gates)for(const e of gate.evidence){
   if(!e.quote.trim()||!job[e.source as 'title'|'description'|'requirements']?.includes(e.quote))throw new Error('Evidence verification failed');evidence++;
 }
 const changed=after.jobs.filter(j=>state.jobs.some(old=>old.id===j.id&&old.raw_content_hash!==j.raw_content_hash));
 if(changed.length)throw new Error('Concurrent content change during extraction');
 const sums=ingestion.sources.reduce((a,s)=>{a[s.run.status]++;a.listed+=s.metrics.listed;a.detail_success+=s.metrics.detail_success;a.admitted+=s.metrics.admission_passed;a.inserted+=s.run.records_new;a.updated+=s.run.records_updated;return a;}, {success:0,partial:0,failed:0,listed:0,detail_success:0,admitted:0,inserted:0,updated:0});
 const failures=extracted.filter(x=>x.status==='failed').length;
 const unfinished=extracted.some(x=>['store_unconfirmed','uncertain_interrupted','budget_deferred'].includes(x.status))||extracted.length<pending.length;
 return {status:unfinished||ingestion.status==='failed'?'failed':failures||ingestion.status==='partial'?'partial':'success',baseline,
  sources_attempted:ingestion.sources.length,...sums,unchanged:checkpoint.unchanged??0,canonical_new,canonical_changed,source_runs:ingestion.sources.map(s=>({id:s.run.id,source:s.run.source,status:s.run.status,...s.metrics})),
  source_records:after.records.length,canonical_jobs_total:after.jobs.length,extraction_pending:pending.length,parser_only:classification.parser??0,
  model_calls:checkpoint.batch.calls,extraction_success:extracted.filter(x=>x.status==='success').length,extraction_failure:failures,
  extraction_deferred:extracted.filter(x=>['budget_deferred','uncertain_interrupted','store_unconfirmed'].includes(x.status)).length,
  ready_jobs:after.jobs.filter(j=>extractionIsReady(j)).length,evidence_quotes_verified:evidence,
  application_status:after.jobs.reduce((a,j)=>(a[j.application_status]++,a),{open:0,unknown:0,closed:0}),
  duration_ms:Math.round(performance.now()-start),extracted};
}
