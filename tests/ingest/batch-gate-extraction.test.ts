import { describe,it,expect,vi } from 'vitest';
import { classify,runBatch,selectBatchJobs,type BatchJob,type Checkpoint } from '../../scripts/ingest/batch-gate-extraction';
import type { ExtractionResult } from '../../scripts/ingest/extract-gates';
import { EXTRACTION_VERSION } from '../../scripts/ingest/extract-gates';
import { createBatchStore } from '../../scripts/ingest/batch-gate-store';
const job=(id='1',requirements='本科及以上'):BatchJob=>({id,title:'实习',description:null,requirements,raw_content_hash:'hash',gates:[],extraction_attempt_hash:null,extraction_input_hash:null,extraction_status:null,extraction_error:null,extraction_version:null,extraction_attempted_at:null} as unknown as BatchJob);
const cp=():Checkpoint=>({version:1,extraction_version:EXTRACTION_VERSION,max_calls:4,calls:0,entries:{}});
const store=()=>({prepare:vi.fn(async(j:BatchJob)=>j),write:vi.fn(async(_job:BatchJob,_result:ExtractionResult)=>{void _job;void _result;return {};})});
const ready=(j:BatchJob):BatchJob=>({...j,extraction_status:'success',extraction_input_hash:'hash',extraction_attempt_hash:'hash',extraction_version:EXTRACTION_VERSION});
describe('batch orchestration preserves frozen extraction',()=>{
 it('parser-only calls no model; current success skipped; stale hash/version reruns',async()=>{
 const model=vi.fn(),s=store();const rows=[job(),ready(job('2')),{...ready(job('3')),raw_content_hash:'new'},{...ready(job('4')),extraction_version:'old'}];
 expect((await runBatch(rows,model,s,cp(),()=>{})).map(x=>x.status)).toEqual(['success','skipped','success','success']);expect(model).not.toHaveBeenCalled();expect(s.write).toHaveBeenCalledTimes(3);
 });
 it('isolates invalid model/evidence and preserves previous gates',async()=>{
 const old=(await import('../../scripts/ingest/gate-parser')).parseGates(job()).gates;
 const j={...job('1','博士相关方向，或具备长期科研意愿的硕士'),gates:old};const s=store();
 const model=vi.fn().mockResolvedValue({gates:[{...old[0],evidence:[{quote:'fabricated',source:'requirements',context:null}]}],metadata:[]});
 const r=await runBatch([j,job('2')],model,s,cp(),()=>{},{pause:async()=>{}});
 expect(r.map(x=>x.status)).toEqual(['failed','success']);expect(s.write.mock.calls[0][1].gates).toEqual(old);
 });
 it('bounds concurrency to one and all HTTP attempts including retry',async()=>{
 let active=0,max=0;const model=vi.fn(async()=>{active++;max=Math.max(max,active);await Promise.resolve();active--;throw new Error('model_http_503');});const c=cp();c.max_calls=3;
 await runBatch([job('1','每周三天'),job('2','每周三天'),job('3','每周三天')],model,store(),c,()=>{},{pause:async()=>{}});
 expect(max).toBe(1);expect(model).toHaveBeenCalledTimes(3);expect(c.calls).toBe(3);
 });
 it('resumes saved result after write failure without repeating model',async()=>{
 const c=cp(),s=store();s.write.mockRejectedValueOnce(new Error('network'));const model=vi.fn();
 expect((await runBatch([job()],model,s,c,()=>{}))[0].status).toBe('store_unconfirmed');
 expect((await runBatch([job()],model,s,c,()=>{}))[0].status).toBe('success');expect(model).not.toHaveBeenCalled();
 expect((await runBatch([job()],model,s,c,()=>{}))[0].status).toBe('checkpoint_done');
 });
 it('resumes a model result without another paid call',async()=>{
 const j=job('1','每周三天'),c=cp(),s=store();s.write.mockRejectedValueOnce(new Error('write unknown'));
 const model=vi.fn().mockResolvedValue({gates:[],metadata:[{kind:'unsupported',requirement:'required',evidence:{quote:'每周三天',source:'requirements',context:null},branches:[]}]});
 await runBatch([j],model,s,c,()=>{},{pause:async()=>{}});await runBatch([j],model,s,c,()=>{},{pause:async()=>{}});
 expect(model).toHaveBeenCalledTimes(1);expect(c.calls).toBe(1);expect(c.entries['1'].state).toBe('done');
 });
 it('missing input hash does not block the next job or call the model',async()=>{
 const s=store(),model=vi.fn();const r=await runBatch([{...job(),raw_content_hash:null},job('2')],model,s,cp(),()=>{});
 expect(r.map(x=>x.status)).toEqual(['failed','success']);expect(s.write).toHaveBeenCalledTimes(1);expect(model).not.toHaveBeenCalled();
 });
 it('partial restart preserves completed jobs and flags uncertain interrupted request',async()=>{
 const c=cp();let stopped=false;await runBatch([job(),job('2')],vi.fn(),store(),c,()=>{},{stopped:()=>stopped,progress:()=>{stopped=true;}});
 c.entries['3']={hash:'hash',state:'started'};const r=await runBatch([job(),job('2'),job('3')],vi.fn(),store(),c,()=>{});
 expect(r.map(x=>x.status)).toEqual(['checkpoint_done','success','uncertain_interrupted']);
 });
 it('failed same-hash retry is explicit and current success cannot be prepared',async()=>{
 const request=vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify([{id:'1'}])));const s=createBatchStore('https://example.com','sb_secret_test',request);
 await expect(s.prepare(ready(job()))).rejects.toThrow();expect(request).not.toHaveBeenCalled();
 const failed={...ready(job()),extraction_status:'failed' as const,extraction_error:'bad'};
 const prepared=await s.prepare(failed);expect(prepared.extraction_attempt_hash).toBeNull();expect(prepared.gates).toEqual(failed.gates);
 expect(JSON.parse(request.mock.calls[0][1]!.body as string)).not.toHaveProperty('gates');expect(classify(failed)).toBe('parser');
 });
 it('an explicit batch run carries only the jobs that still need work',()=>{
 // The job table grows past runBatch's own 500-row budget guard as sourcing
 // expands; selecting the pending jobs keeps an explicit run possible.
 const rows=[job('pending'),ready(job('ready')),{...ready(job('stale')),raw_content_hash:'new'},{...job('nohash'),raw_content_hash:null}];
 expect(selectBatchJobs(rows).map(j=>j.id)).toEqual(['pending','stale','nohash']);
 const big=Array.from({length:501},(_,i)=>ready(job(String(i))));
 expect(big.length).toBeGreaterThan(500);expect(selectBatchJobs(big)).toEqual([]);
 });
 it('the batch budget guard still rejects more than 500 selected jobs',async()=>{
 await expect(runBatch(Array.from({length:501},(_,i)=>job(String(i))),vi.fn(),store(),cp(),()=>{})).rejects.toThrow('Invalid batch budget');
 });
});
