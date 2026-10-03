import { existsSync, readFileSync, writeFileSync, renameSync, openSync, closeSync, unlinkSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCanonicalizationStore } from './canonicalization-store';
import { serverConfig } from './source-store';
import { createDeepSeekModel, deepseekConfig } from './deepseek-responses';
import { EXTRACTION_VERSION } from './extract-gates';
import { classify, runBatch, type BatchJob, type Checkpoint } from './batch-gate-extraction';
import { createBatchStore } from './batch-gate-store';
async function main() {
  const [mode, file, cap, ...extra]=process.argv.slice(2);
  if(!['--preview','--write'].includes(mode)||extra.length||mode==='--write'&&(!file||!/^\d+$/.test(cap??'')||Number(cap)>200))throw new Error('Use --preview or --write <checkpoint.json> <max-calls 0–200>');
  if(existsSync('.env.local'))process.loadEnvFile('.env.local');
  const config=serverConfig(process.env);
  const jobs=(await createCanonicalizationStore(config.url,config.key).snapshot()).jobs as BatchJob[];
  const counts=jobs.reduce((a,j)=>(a[classify(j)]=(a[classify(j)]??0)+1,a),{} as Record<string,number>);
  console.log(JSON.stringify({classification:counts,total:jobs.length}));
  if(mode==='--preview')return;
  const model=createDeepSeekModel(deepseekConfig(process.env));
  const path=resolve(file);mkdirSync(dirname(path),{recursive:true});
  // Exclusive local lock: never start concurrent writers with the same checkpoint.
  const lock=openSync(path+'.lock','wx');
  let stopped=false;const stop=()=>{stopped=true;};process.on('SIGINT',stop);process.on('SIGTERM',stop);
  try {
    const checkpoint:Checkpoint=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{version:1,extraction_version:EXTRACTION_VERSION,max_calls:Number(cap),calls:0,entries:{}};
    if(checkpoint.max_calls!==Number(cap))throw new Error('Checkpoint call cap cannot change');
    const save=()=>{writeFileSync(path+'.tmp',JSON.stringify(checkpoint,null,2));renameSync(path+'.tmp',path);};save();
    const summary=await runBatch(jobs,model,createBatchStore(config.url,config.key),checkpoint,save,{stopped:()=>stopped,progress:row=>console.log(JSON.stringify(row))});
    writeFileSync(path+'.summary.json',JSON.stringify({calls:checkpoint.calls,summary},null,2));
    console.log(JSON.stringify({calls:checkpoint.calls,processed:summary.length,stopped}));
    if(stopped||summary.some(r=>['failed','store_unconfirmed','uncertain_interrupted','budget_deferred'].includes(r.status)))process.exitCode=1;
  } finally {process.off('SIGINT',stop);process.off('SIGTERM',stop);closeSync(lock);unlinkSync(path+'.lock');}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main().catch(()=>{console.error('Batch stopped: inspect checkpoint and current DB before retry. No credentials logged.');process.exitCode=1;});
