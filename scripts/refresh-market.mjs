import { MARKET_CATALOG } from '../src/market-catalog.mjs';
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export const MARKET_FILE = fileURLToPath(new URL('../public/market-data.json',import.meta.url));
const MAX_BYTES=1_000_000;
const runFile=promisify(execFile);
function reference(id) {
  const item=MARKET_CATALOG.find(x=>x.id===id);
  if(!item) throw new Error('Unknown fixed public reference');
  return item;
}
export function marketUrl(id) { return reference(id).source.url; }
function validatePoints(points) {
  if(!Array.isArray(points)||!points.length||points.length>1000) throw new Error('Empty or oversized daily series');
  let last='';
  return points.map(p=>{
    if(!p||!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!Number.isFinite(Date.parse(p.date+'T00:00:00Z'))||new Date(p.date+'T00:00:00Z').toISOString().slice(0,10)!==p.date||p.date<=last||typeof p.close!=='number'||!Number.isFinite(p.close)||p.close<=0) throw new Error('Invalid or unordered daily series');
    last=p.date; return {date:p.date,close:p.close};
  });
}
export function parseTencentDaily(raw,providerKey) {
  if(!MARKET_CATALOG.some(x=>x.providerKey===providerKey)) throw new Error('Unknown provider key');
  if(typeof raw!=='string'||Buffer.byteLength(raw)>MAX_BYTES) throw new Error('Oversized or invalid response');
  const body=raw.trim().replace(/^[A-Za-z_$][\w$]*\s*=\s*(?=\{)/,'').replace(/;\s*$/,'');
  const parsed=JSON.parse(body);
  if(parsed.code!==0) throw new Error('Provider rejected daily request');
  const data=parsed.data?.[providerKey];
  const rows=data?.qfqday??data?.day;
  if(!Array.isArray(rows)) throw new Error('Missing daily series');
  return validatePoints(rows.map(row=>({date:row?.[0],close:typeof row?.[2]==='string'&&row[2].trim()?Number(row[2]):NaN})));
}
export function completedPoints(points,id,now=new Date().toISOString()) {
  const item=reference(id);
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:item.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).map(x=>[x.type,x.value]));
  const today=`${parts.year}-${parts.month}-${parts.day}`;
  const cutoff=item.market==='CN'?16:17;
  return validatePoints(points).filter(p=>p.date<today||(p.date===today&&Number(parts.hour)>=cutoff));
}
export function updateSnapshot(previous,results,generatedAt=new Date().toISOString()) {
  if(!Number.isFinite(Date.parse(generatedAt))) throw new Error('Invalid generatedAt');
  return {schemaVersion:1,generatedAt,mode:'public-snapshot',records:MARKET_CATALOG.map(item=>{
    let points=[],error=results.get(item.id)?.error??'未获取公共日线数据';
    const incoming=results.get(item.id);
    if(incoming?.points) { try {points=validatePoints(incoming.points);error=null;} catch {error='公共日线数据校验失败';} }
    if(!points.length) { try { points=validatePoints(previous?.records?.find(x=>x.id===item.id)?.points); } catch { /* no valid prior snapshot */ } }
    return {id:item.id,points,quote:null,source:{...item.source},status:points.length?'available':'unavailable',error};
  })};
}
export async function readPrevious() {
  try {const raw=await readFile(MARKET_FILE,'utf8');if(Buffer.byteLength(raw)>MAX_BYTES) return null;return JSON.parse(raw);} catch{return null;}
}
export async function saveSnapshot(snapshot) {
  await mkdir(new URL('../public/',import.meta.url),{recursive:true});
  const temporary=`${MARKET_FILE}.${process.pid}.tmp`;
  try { await writeFile(temporary,JSON.stringify(snapshot,null,2)+'\n','utf8');await rename(temporary,MARKET_FILE); }
  finally {await unlink(temporary).catch(()=>{});}
}
export async function refreshMarket() {
  const generatedAt=new Date().toISOString();
  const results=new Map();
  // curl inherits the host's existing proxy settings; never print headers, proxy values or raw responses.
  for(const item of MARKET_CATALOG) {
    try {
      const {stdout}=await runFile(process.platform==='win32'?'curl.exe':'curl',['--fail','--silent','--show-error','--max-time','20','--max-filesize',String(MAX_BYTES),item.source.url],{timeout:23000,maxBuffer:MAX_BYTES,windowsHide:true});
      const points=completedPoints(parseTencentDaily(stdout,item.providerKey),item.id,generatedAt);
      if(!points.length) throw new Error('No completed daily bars');
      results.set(item.id,{points});
    } catch {results.set(item.id,{error:'固定公共源刷新失败（网络、响应或完整日线校验未通过），保留可用旧快照'});}
  }
  const snapshot=updateSnapshot(await readPrevious(),results,generatedAt);
  await saveSnapshot(snapshot);
  console.log(JSON.stringify({generatedAt,records:snapshot.records.map(r=>({id:r.id,status:r.status,count:r.points.length,first:r.points[0]?.date??null,last:r.points.at(-1)?.date??null,error:r.error}))},null,2));
  return snapshot;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  if(process.argv.length!==2) throw new Error('No arguments accepted: fixed public whitelist only');
  await refreshMarket();
}
