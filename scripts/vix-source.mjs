import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {VIX_SOURCE} from '../src/volatility.mjs';
import {completedReferencePoints} from '../src/reference-periods.mjs';
const run=promisify(execFile),MAX_BYTES=1500000;
export function parseVixCsv(raw){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>MAX_BYTES)throw Error('Invalid VIX CSV');
 const lines=raw.replace(/^\uFEFF/,'').trim().split(/\r?\n/);if(lines.length<2||lines.length>20001||lines[0].trim()!=='DATE,OPEN,HIGH,LOW,CLOSE')throw Error('Invalid VIX header or length');
 let prior='';const rows=lines.slice(1);return rows.map((line,index)=>{
  const cells=line.split(',').map(s=>s.trim());if(cells.length!==5)throw Error('Invalid VIX row');const match=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(cells[0]);if(!match)throw Error('Invalid VIX date');
  const date=match[3]+'-'+match[1]+'-'+match[2];if(Number(match[3])===0||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||date<=prior)throw Error('Invalid VIX order');prior=date;
  const numbers=cells.slice(1).map(s=>/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(s)?Number(s):NaN);if(!numbers.every(n=>Number.isFinite(n)&&n>0))throw Error('Invalid VIX value');const [open,high,low,close]=numbers;
  // Only this bounded recent window is consumed. Some unused 1990s OHLC rows
  // in the official archive are inconsistent; retain strict OHLC checks here.
  if(index>=rows.length-254&&(low>Math.min(open,close)||high<Math.max(open,close)||low>high))throw Error('Invalid VIX OHLC');return {date,close};
 }).slice(-254);
}
export async function fetchVixPoints(now){
 const {stdout}=await run(process.platform==='win32'?'curl.exe':'curl',['--fail','--silent','--show-error','--max-time','20','--max-filesize',String(MAX_BYTES),VIX_SOURCE.url],{timeout:23000,maxBuffer:MAX_BYTES,windowsHide:true});
 return completedReferencePoints(parseVixCsv(stdout),{timeZone:'America/New_York',market:'US'},now,'day').slice(-253);
}
