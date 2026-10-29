import { SECTOR_CATALOG } from '../src/sector-catalog.mjs';
import {emptyVixRecord,updateVixRecord} from '../src/volatility.mjs';
import {fetchVixPoints} from './vix-source.mjs';
import { validateSectorBundle,validateReferencePoints } from '../src/sector-data.mjs';
import {completedReferencePoints} from '../src/reference-periods.mjs';
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const SECTOR_FILE=fileURLToPath(new URL('../public/sector-data.json',import.meta.url));
const MAX_BYTES=1_000_000;
const runFile=promisify(execFile);
function emptyBundle(generatedAt){return {schemaVersion:1,mode:'public-snapshot',generatedAt,context:{vix:emptyVixRecord()},records:SECTOR_CATALOG.map(item=>({id:item.id,points:[],source:{...item.source},status:'unavailable',error:'未获取公共ETF日线数据'}))};}
function itemFor(id){const item=SECTOR_CATALOG.find(i=>i.id===id);if(!item)throw Error('Unknown fixed reference');return item;}
function checkedPoints(points,item,maxDate='9999-12-31',period='day'){return validateReferencePoints(points,{maxDate,period});}
function parseSeries(raw,providerKey,period){
 const item=SECTOR_CATALOG.find(i=>i.providerKey===providerKey);
 if(!item||(period==='week'&&!item.weeklySource))throw Error('Unknown fixed reference');
 if(typeof raw!=='string'||Buffer.byteLength(raw)>MAX_BYTES)throw Error('Invalid response');
 const body=raw.trim().replace(/^[A-Za-z_$][\w$]*\s*=\s*(?=\{)/,'').replace(/;\s*$/,'');
 const parsed=JSON.parse(body);if(parsed.code!==0)throw Error('Provider rejected response');
 const data=parsed.data?.[providerKey],rows=data?.['qfq'+period]??data?.[period];
 if(!Array.isArray(rows)||!rows.length)throw Error('Missing series');
 const number=v=>typeof v==='number'?v:typeof v==='string'&&v.trim()?Number(v):NaN;
 return checkedPoints(rows.map(row=>{
  if(!Array.isArray(row)||row.length<5)throw Error('Malformed bar');
  return {date:row[0],open:number(row[1]),close:number(row[2]),high:number(row[3]),low:number(row[4]),volume:item.kind==='index'||row[5]===undefined||row[5]===null||row[5]===''?null:number(row[5])};
 }),item,'9999-12-31',period);
}
export const parseTencentSectorDaily=(raw,key)=>parseSeries(raw,key,'day');
export const parseTencentSectorWeekly=(raw,key)=>parseSeries(raw,key,'week');
export function completedSectorPoints(points,now=new Date().toISOString(),id='semiconductor'){
 const item=itemFor(id);return completedReferencePoints(checkedPoints(points,item),item,now,'day');
}
export function completedWeeklyPoints(points,now,id){
 const item=itemFor(id);if(!item.weeklySource)throw Error('No weekly source');
 return completedReferencePoints(checkedPoints(points,item,'9999-12-31','week'),item,now,'week');
}
export function updateSectorSnapshot(previous,results,generatedAt=new Date().toISOString()){
 let prior=null;try{prior=validateSectorBundle(previous);}catch{/* Reject invalid old files as a whole. */}
 const bundle=emptyBundle(generatedAt);
 for(const item of SECTOR_CATALOG){
  const record=bundle.records.find(r=>r.id===item.id);const incoming=results.get(item.id);
  let points=[];let fresh=false;
  if(incoming?.points){try{points=checkedPoints(incoming.points,item);fresh=points.length>0;}catch{/* fallback below */}}
  if(!fresh)points=prior?.records.find(r=>r.id===item.id)?.points??[];
  Object.assign(record,{points,status:points.length?'available':'unavailable',error:fresh?null:'固定公共源刷新失败，保留可用旧快照'});
  if(item.weeklySource){
   let wp=[],wf=false;
   if(incoming?.weeklyPoints){try{wp=checkedPoints(incoming.weeklyPoints,item,'9999-12-31','week');wf=wp.length>0;}catch{}}
   if(!wf)wp=prior?.records.find(r=>r.id===item.id)?.weekly?.points??[];
   record.weekly={points:wp,source:{...item.weeklySource},status:wp.length?'available':'unavailable',error:wf?null:'固定周线源刷新失败，保留可用旧快照'};
  }
 }
 bundle.context={vix:updateVixRecord(prior?.context?.vix,results.get('us-volatility')?.points)};
 return validateSectorBundle(bundle);
}
export async function saveSectorSnapshot(snapshot){
 const validated=validateSectorBundle(snapshot);
 await mkdir(new URL('../public/',import.meta.url),{recursive:true});
 const temporary=`${SECTOR_FILE}.${process.pid}.tmp`;
 try{await writeFile(temporary,JSON.stringify(validated,null,2)+'\n','utf8');await rename(temporary,SECTOR_FILE);}
 finally{await unlink(temporary).catch(()=>{});}
}
export async function refreshSectors(){
 const generatedAt=new Date().toISOString();const results=new Map();
 for(const item of SECTOR_CATALOG){
  const incoming={};
  for(const period of ['day',...(item.weeklySource?['week']:[])]){
   try{
    const source=period==='day'?item.source:item.weeklySource;
    const {stdout}=await runFile(process.platform==='win32'?'curl.exe':'curl',['--fail','--silent','--show-error','--max-time','20','--max-filesize',String(MAX_BYTES),source.url],{timeout:23000,maxBuffer:MAX_BYTES,windowsHide:true});
    const parsed=period==='day'?parseTencentSectorDaily(stdout,item.providerKey):parseTencentSectorWeekly(stdout,item.providerKey);
    const points=period==='day'?completedSectorPoints(parsed,generatedAt,item.id):completedWeeklyPoints(parsed,generatedAt,item.id);
    if(points.length)incoming[period==='day'?'points':'weeklyPoints']=points;
   }catch{}
  }
  results.set(item.id,incoming);
 }
 try{results.set('us-volatility',{points:await fetchVixPoints(generatedAt)});}catch{results.set('us-volatility',{error:'VIX采集失败'});}
 let previous=null;try{const raw=await readFile(SECTOR_FILE,'utf8');if(Buffer.byteLength(raw)<=MAX_BYTES)previous=JSON.parse(raw);}catch{/* Missing or invalid prior data is not promoted. */}
 const snapshot=updateSectorSnapshot(previous,results,generatedAt);await saveSectorSnapshot(snapshot);
 console.log(JSON.stringify({generatedAt,vix:{status:snapshot.context.vix.status,count:snapshot.context.vix.points.length,last:snapshot.context.vix.points.at(-1)?.date??null,error:snapshot.context.vix.error},records:snapshot.records.map(r=>({id:r.id,status:r.status,count:r.points.length,first:r.points[0]?.date??null,last:r.points.at(-1)?.date??null,error:r.error,weeklyCount:r.weekly?.points.length??0,weeklyLast:r.weekly?.points.at(-1)?.date??null,weeklyError:r.weekly?.error??null}))},null,2));
 return snapshot;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw new Error('No arguments accepted: fixed public sector whitelist only');
 await refreshSectors();
}
