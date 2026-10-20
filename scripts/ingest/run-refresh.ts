import {existsSync,readFileSync,writeFileSync,renameSync,mkdirSync,openSync,closeSync,unlinkSync,appendFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {refresh,type RefreshCheckpoint} from './refresh-pipeline';
import {parseOptions} from './run-job-pro';
import {createCanonicalizationStore} from './canonicalization-store';
import {createSourceStore,serverConfig} from './source-store';
import {createBatchStore} from './batch-gate-store';
import {createDeepSeekModel,deepseekConfig} from './deepseek-responses';
import {invokeJobPro} from './job-pro-cli';
import {EXTRACTION_VERSION} from './extract-gates';
import {buildRefreshReport} from './refresh-report';
import type {RunOptions} from './run-job-pro';
/**
 * Field-wise window comparison. A checkpoint written before `start_page` existed
 * has no `startPage`; it still resumes as page 1, while any real change to the
 * window (start page, page size, caps, sources) is rejected.
 */
export function sameWindowOptions(saved: Partial<RunOptions>|undefined, current: RunOptions) {
  const project=(o:Partial<RunOptions>|undefined)=>JSON.stringify({sources:o?.sources,scope:o?.scope,limit:o?.limit,maxPages:o?.maxPages??1,maxJobs:o?.maxJobs??o?.limit,globalMaxJobs:o?.globalMaxJobs??15,startPage:o?.startPage??1});
  return project(saved)===project(current);
}
async function main(){
 if(existsSync('.env.local'))process.loadEnvFile('.env.local');
 const options=parseOptions(['--write','--sources',process.env.REFRESH_SOURCES??'alibaba,meituan,jd,netease,kuaishou,oppo,liauto,antgroup','--scope','intern','--limit',process.env.REFRESH_PAGE_SIZE??'2','--max-pages',process.env.REFRESH_MAX_PAGES??'1','--start-page',process.env.REFRESH_START_PAGE??'1','--max-jobs',process.env.REFRESH_MAX_JOBS??'2','--global-max-jobs',process.env.REFRESH_GLOBAL_MAX_JOBS??'16']);
 const cap=Number(process.env.REFRESH_MODEL_CAP??'8');if(!Number.isInteger(cap)||cap<0||cap>200)throw new Error('Invalid model cap');
 const config=serverConfig(process.env),model=createDeepSeekModel(deepseekConfig(process.env));
 const directory=resolve('.verification/refresh');mkdirSync(directory,{recursive:true});const path=resolve(directory,'checkpoint.json');
 const lock=openSync(resolve(directory,'writer.lock'),'wx');let stopped=false;const stop=()=>{stopped=true;};process.on('SIGINT',stop);process.on('SIGTERM',stop);
 try{
  const checkpoint:RefreshCheckpoint=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{version:1,options,started_at:new Date().toISOString(),batch:{version:1,extraction_version:EXTRACTION_VERSION,max_calls:cap,calls:0,entries:{}}};
  if(checkpoint.version!==1||!sameWindowOptions(checkpoint.options,options)||checkpoint.batch.max_calls!==cap||checkpoint.batch.extraction_version!==EXTRACTION_VERSION||!Number.isInteger(checkpoint.batch.calls)||checkpoint.batch.calls<0||checkpoint.batch.calls>cap)throw new Error('Resume configuration differs');
  const save=()=>{writeFileSync(path+'.tmp',JSON.stringify(checkpoint,null,2));renameSync(path+'.tmp',path);};
  const store=createCanonicalizationStore(config.url,config.key);
  const result=await refresh(checkpoint,{...store,cli:invokeJobPro,sourceStore:createSourceStore(config.url,config.key),gateStore:createBatchStore(config.url,config.key),model,save,stopped:()=>stopped});
  writeFileSync(resolve(directory,'summary.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  // Visibility only: a PARTIAL run is stated in the Step Summary and raised as an
  // Actions warning. The exit-code policy is unchanged — only `failed` is non-zero.
  const report=buildRefreshReport(result);
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,report.markdown);
  if(report.annotation)console.log(report.annotation);
  process.exitCode=report.exitCode;
 }finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);closeSync(lock);unlinkSync(resolve(directory,'writer.lock'));}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main().catch(()=>{const failure={status:'failed',error:'refresh_unconfirmed',action:'Inspect checkpoint and database before retry'};mkdirSync('.verification/refresh',{recursive:true});writeFileSync('.verification/refresh/summary.json',JSON.stringify(failure));const report=buildRefreshReport(failure);if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,report.markdown);if(report.annotation)console.log(report.annotation);console.error(JSON.stringify(failure));process.exitCode=report.exitCode;});
