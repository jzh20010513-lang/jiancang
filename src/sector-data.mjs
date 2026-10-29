import { SECTOR_CATALOG } from './sector-catalog.mjs';
import {weekKey} from './reference-periods.mjs';
import {validateVixRecord} from './volatility.mjs';

const invalid=()=>{throw new Error('板块公共数据格式无效');};
function plain(value,keys){
 if(!value||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))invalid();
 const actual=Reflect.ownKeys(value);
 if(actual.length!==keys.length)invalid();
 for(const key of actual){const descriptor=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||!keys.includes(key)||!('value' in descriptor))invalid();}
 for(const key of keys)if(!Object.hasOwn(value,key))invalid();
}
function list(value,max){
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>max)invalid();
 for(const key of Reflect.ownKeys(value)){if(key==='length')continue;const descriptor=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=value.length||!('value' in descriptor))invalid();}
 for(let i=0;i<value.length;i++)if(!Object.hasOwn(value,i))invalid();
}
function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number(value.slice(0,4))>0&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function validInstant(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)&&validDate(value.slice(0,10))&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString()===value.replace(/Z$/,value.length===20?'.000Z':'Z');}
export function validateReferencePoints(points,{maxDate='9999-12-31',period='day'}={}){
 if(!['day','week'].includes(period))invalid();
 list(points,period==='week'?400:300);let prior='';
  const result=points.map(point=>{
   plain(point,['date','open','high','low','close','volume']);
   if(!validDate(point.date)||point.date>maxDate||point.date<=prior)invalid();prior=point.date;
   for(const key of ['open','high','low','close'])if(typeof point[key]!=='number'||!Number.isFinite(point[key])||point[key]<=0)invalid();
   if(point.low>Math.min(point.open,point.close)||point.high<Math.max(point.open,point.close)||point.low>point.high||(point.volume!==null&&(typeof point.volume!=='number'||!Number.isFinite(point.volume)||point.volume<0)))invalid();
   return {date:point.date,open:point.open,high:point.high,low:point.low,close:point.close,volume:point.volume};
  });

 if(period==='week'){const weeks=new Set();for(const point of result){const key=weekKey(point.date);if(weeks.has(key))invalid();weeks.add(key);}}
 return result;
}
export function validateSectorBundle(input,{maxDate=new Date().toISOString().slice(0,10)}={}){
 plain(input,['schemaVersion','mode','generatedAt','records',...(Object.hasOwn(input,'context')?['context']:[])]);
 if(input.schemaVersion!==1||input.mode!=='public-snapshot'||!validInstant(input.generatedAt)||!validDate(maxDate))invalid();
 list(input.records,5);if(![3,5].includes(input.records.length))invalid();const seen=new Set();
 const records=input.records.map(record=>{
  plain(record,['id','points','source','status','error',...(Object.hasOwn(record,'weekly')?['weekly']:[])]);
  const item=SECTOR_CATALOG.find(item=>item.id===record.id);
  if(!item||seen.has(record.id))invalid();seen.add(record.id);
  plain(record.source,['label','url']);
  if(record.source.label!==item.source.label||record.source.url!==item.source.url||!['available','unavailable'].includes(record.status)||(record.error!==null&&(typeof record.error!=='string'||record.error.length>2000)))invalid();
  const points=validateReferencePoints(record.points,{maxDate});if(item.kind==='index'&&points.some(p=>p.volume!==null))invalid();
  if((record.status==='available')!==Boolean(points.length))invalid();
  let weekly;
  if(Object.hasOwn(record,'weekly')){
   if(!item.weeklySource)invalid();const w=record.weekly;plain(w,['points','source','status','error']);plain(w.source,['label','url']);
   if(w.source.label!==item.weeklySource.label||w.source.url!==item.weeklySource.url||!['available','unavailable'].includes(w.status)||(w.error!==null&&(typeof w.error!=='string'||w.error.length>2000)))invalid();
   const p=validateReferencePoints(w.points,{maxDate,period:'week'});if(item.kind==='index'&&p.some(point=>point.volume!==null))invalid();if((w.status==='available')!==Boolean(p.length))invalid();
   weekly={points:p,source:{...item.weeklySource},status:w.status,error:w.error===null?null:'周线刷新失败，保留有日期的旧快照。'};
  }
  return {...(weekly?{weekly}:{}),id:item.id,points,source:{...item.source},status:record.status,error:record.error===null?null:'板块日线刷新失败，请查看有日期的旧快照或稍后重试。'};
 });
 if(records.length===3&&records.some(r=>SECTOR_CATALOG.find(i=>i.id===r.id).market!=='CN'))invalid();
 let context;if(Object.hasOwn(input,'context')){plain(input.context,['vix']);context={vix:validateVixRecord(input.context.vix,{maxDate})};}
 const result={schemaVersion:1,mode:'public-snapshot',generatedAt:input.generatedAt,records,...(context?{context}:{})};
 if(new TextEncoder().encode(JSON.stringify(result)).byteLength>1_000_000)invalid();
 return result;
}
