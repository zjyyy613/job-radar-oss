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
async function main(){
 if(existsSync('.env.local'))process.loadEnvFile('.env.local');
 const options=parseOptions(['--write','--sources',process.env.REFRESH_SOURCES??'alibaba,meituan,jd,netease,kuaishou,oppo,liauto,antgroup','--scope','intern','--limit',process.env.REFRESH_PAGE_SIZE??'2','--max-pages',process.env.REFRESH_MAX_PAGES??'1','--max-jobs',process.env.REFRESH_MAX_JOBS??'2','--global-max-jobs',process.env.REFRESH_GLOBAL_MAX_JOBS??'16']);
 const cap=Number(process.env.REFRESH_MODEL_CAP??'8');if(!Number.isInteger(cap)||cap<0||cap>200)throw new Error('Invalid model cap');
 const config=serverConfig(process.env),model=createDeepSeekModel(deepseekConfig(process.env));
 const directory=resolve('.verification/refresh');mkdirSync(directory,{recursive:true});const path=resolve(directory,'checkpoint.json');
 const lock=openSync(resolve(directory,'writer.lock'),'wx');let stopped=false;const stop=()=>{stopped=true;};process.on('SIGINT',stop);process.on('SIGTERM',stop);
 try{
  const checkpoint:RefreshCheckpoint=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):{version:1,options,started_at:new Date().toISOString(),batch:{version:1,extraction_version:EXTRACTION_VERSION,max_calls:cap,calls:0,entries:{}}};
  if(checkpoint.version!==1||JSON.stringify(checkpoint.options)!==JSON.stringify(options)||checkpoint.batch.max_calls!==cap||checkpoint.batch.extraction_version!==EXTRACTION_VERSION||!Number.isInteger(checkpoint.batch.calls)||checkpoint.batch.calls<0||checkpoint.batch.calls>cap)throw new Error('Resume configuration differs');
  const save=()=>{writeFileSync(path+'.tmp',JSON.stringify(checkpoint,null,2));renameSync(path+'.tmp',path);};
  const store=createCanonicalizationStore(config.url,config.key);
  const result=await refresh(checkpoint,{...store,cli:invokeJobPro,sourceStore:createSourceStore(config.url,config.key),gateStore:createBatchStore(config.url,config.key),model,save,stopped:()=>stopped});
  writeFileSync(resolve(directory,'summary.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,`## Job Radar refresh\n\n\`\`\`json\n${JSON.stringify(result,null,2)}\n\`\`\`\n`);
  if(result.status==='failed')process.exitCode=1;
 }finally{process.off('SIGINT',stop);process.off('SIGTERM',stop);closeSync(lock);unlinkSync(resolve(directory,'writer.lock'));}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)await main().catch(()=>{const failure={status:'failed',error:'refresh_unconfirmed',action:'Inspect checkpoint and database before retry'};mkdirSync('.verification/refresh',{recursive:true});writeFileSync('.verification/refresh/summary.json',JSON.stringify(failure));if(process.env.GITHUB_STEP_SUMMARY)appendFileSync(process.env.GITHUB_STEP_SUMMARY,'## Job Radar refresh FAILED\n\nInspect checkpoint and database before retry. No raw diagnostics logged.\n');console.error(JSON.stringify(failure));process.exitCode=1;});
