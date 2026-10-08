import {readFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
import {refresh,needsIncrementalExtraction,type RefreshCheckpoint} from '../../scripts/ingest/refresh-pipeline';
import type {BatchJob} from '../../scripts/ingest/batch-gate-extraction';
import {EXTRACTION_VERSION,type ExtractionResult} from '../../scripts/ingest/extract-gates';
import type {CanonicalizationSnapshot} from '../../scripts/ingest/canonicalization-store';
import type {SourceRecord,SourceRun} from '../../scripts/ingest/contracts';
import {canonicalize} from '../../src/lib/domain/canonicalize';
const detail=JSON.parse(readFileSync('tests/fixtures/job-pro/meituan-detail.json','utf8'));
const options={sources:['meituan'] as const,scope:'intern' as const,limit:1,maxPages:1,maxJobs:1,globalMaxJobs:1};
const cp=():RefreshCheckpoint=>({version:1,options,started_at:new Date().toISOString(),batch:{version:1,extraction_version:EXTRACTION_VERSION,max_calls:2,calls:0,entries:{}}});
function harness(){
 const state:CanonicalizationSnapshot={token:'x',records:[],jobs:[],runs:[]};let requirements='本科及以上';
 const cli=vi.fn(async(args:readonly string[])=>args[1]==='search'?{ok:true,source:'zhaopin.meituan.com',total:100,positions:[detail]}:{...detail,requirements});
 const model=vi.fn();
 const d={snapshot:async()=>structuredClone(state),apply:async(_token:string,jobs:ReturnType<typeof canonicalize>['jobs'])=>{state.jobs=jobs.map(j=>{const old=state.jobs.find(o=>o.id===j.id);return old?{...old,...j,gates:old.gates,extraction_version:old.extraction_version,...Object.fromEntries(Object.entries(old).filter(([k])=>k.startsWith('extraction_')))}:j;});return jobs.length;},cli,model,
 sourceStore:{async upsertRecord(r:SourceRecord){const i=state.records.findIndex(x=>x.source===r.source&&x.source_job_id===r.source_job_id);if(i<0){state.records.push({...r,id:'source-1'});return 'new' as const;}state.records[i]={...r,id:state.records[i].id};return 'updated' as const;},async writeRun(r:SourceRun){state.runs.push(r);}},
 gateStore:{async prepare(j:BatchJob){return j;},async write(j:BatchJob,r:ExtractionResult){const target=state.jobs.find(x=>x.id===j.id)!;Object.assign(target,{gates:r.gates,extraction_version:r.extraction_version,extraction_status:r.status,extraction_input_hash:j.raw_content_hash,extraction_attempt_hash:j.raw_content_hash,extraction_error:r.error});}},save:vi.fn()};
 return {state,d,change:()=>{requirements='硕士及以上';}};
}
describe('incremental refresh',()=>{
 it('extracts new jobs, skips unchanged current success, reruns changed hash',async()=>{
 const h=harness();const first=await refresh(cp(),h.d);expect(first.canonical_new).toBe(1);expect(first.extraction_success).toBe(1);
 const second=await refresh(cp(),h.d);expect(second.unchanged).toBe(1);expect(second.extraction_pending).toBe(0);expect(h.state.jobs).toHaveLength(1);
 h.change();const third=await refresh(cp(),h.d);expect(third.canonical_changed).toBe(1);expect(third.extraction_success).toBe(1);expect(h.d.model).not.toHaveBeenCalled();
 });
 it('resumes completed ingestion without additional source/model calls',async()=>{
 const h=harness(),c=cp();await refresh(c,h.d);const calls=h.d.cli.mock.calls.length;await refresh(c,h.d);expect(h.d.cli).toHaveBeenCalledTimes(calls);expect(h.d.model).not.toHaveBeenCalled();
 });
 it('keeps existing same-hash failures on Check, changed failure becomes pending',()=>{
 const j={raw_content_hash:'x',extraction_attempt_hash:'x',extraction_status:'failed'} as BatchJob;
 expect(needsIncrementalExtraction(j)).toBe(false);expect(needsIncrementalExtraction({...j,raw_content_hash:'y'})).toBe(true);
 });
 it('failed source does not close existing jobs or roll back other successful sources',async()=>{
 const h=harness();await refresh(cp(),h.d);const cli=h.d.cli;
 h.d.cli=vi.fn(async args=>{if(args[0]==='alibaba')throw new Error('network');return cli(args);});
 const c=cp();c.options={...options,sources:['alibaba','meituan'],globalMaxJobs:2};
 const r=await refresh(c,h.d);expect(r.status).toBe('partial');expect(r.failed).toBe(1);expect(r.success).toBe(1);expect(r.application_status.closed).toBe(0);expect(h.state.jobs[0].consecutive_missing_count).toBe(0);
 });
 it('capped absence is Unknown rather than Closed',async()=>{
 const h=harness();await refresh(cp(),h.d);h.d.cli=vi.fn(async()=>({ok:true,source:'zhaopin.meituan.com',total:0,positions:[]}));
 const r=await refresh(cp(),h.d);expect(r.application_status.closed).toBe(0);expect(h.state.jobs[0].consecutive_missing_count).toBe(0);
 });
 it('workflow shares its writer lock and pipeline across daily/manual runs with bounded model calls',()=>{
 const workflow=readFileSync('.github/workflows/refresh.yml','utf8'),ncss=readFileSync('.github/workflows/ingest-ncss.yml','utf8');
 for(const w of [workflow,ncss]){expect(w).toContain('group: job-radar-production-writer');expect(w).toContain('cancel-in-progress: false');}
 expect(workflow).toContain('workflow_dispatch:');expect(workflow).toContain('timeout-minutes: 45');expect(workflow).not.toContain('NEXT_PUBLIC_');expect(workflow).not.toContain('path: .env');expect(workflow).toContain('checkpoint.json');
 expect(workflow).toContain("cron: '17 23 * * *'");
 expect(workflow).toContain("format('{0}', inputs.model_cap) || '8'");
 });
});
