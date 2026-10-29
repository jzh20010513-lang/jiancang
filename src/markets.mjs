import {MARKET_CATALOG} from './market-catalog.mjs';

const invalid=()=>{throw new Error('市场设置或公共数据格式无效');};
const ids=()=>MARKET_CATALOG.map(item=>item.id);
function plain(input,keys){
 if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input)))invalid();
 for(const key of Reflect.ownKeys(input)){const descriptor=Object.getOwnPropertyDescriptor(input,key);if(typeof key!=='string'||!keys.includes(key)||!('value' in descriptor))invalid();}
 for(const key of keys)if(!Object.hasOwn(input,key))invalid();
}
function list(input,max){
 if(!Array.isArray(input)||Object.getPrototypeOf(input)!==Array.prototype||input.length>max)invalid();
 for(const key of Reflect.ownKeys(input)){if(key==='length')continue;const descriptor=Object.getOwnPropertyDescriptor(input,key);if(typeof key!=='string'||!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=input.length||!('value' in descriptor))invalid();}
 for(let i=0;i<input.length;i++)if(!Object.hasOwn(input,i))invalid();
}
function marketIds(input,max){list(input,max);const known=ids();const seen=new Set();return input.map(id=>{if(typeof id!=='string'||!known.includes(id)||seen.has(id))invalid();seen.add(id);return id;});}
export function defaultMarketPreferences(){return {pinned:[],hidden:[],order:[]};}
export function validateMarketPreferences(input){plain(input,['pinned','hidden','order']);return {pinned:marketIds(input.pinned,6),hidden:marketIds(input.hidden,6),order:marketIds(input.order,6)};}
export function validateBenchmarkIds(input){return marketIds(input,3);}
export function relatedMarkets(snapshot,prefs=defaultMarketPreferences()){
 const preferences=validateMarketPreferences(prefs);const linked=new Map();let unmappedCount=0,explicitNoneCount=0;
 for(const row of snapshot.holdings){
  if(row.benchmarkReview!=='confirmed'||row.benchmarkIds===undefined){unmappedCount++;continue;}
  const benchmarks=validateBenchmarkIds(row.benchmarkIds);if(!benchmarks.length){explicitNoneCount++;continue;}
  for(const id of benchmarks){if(!linked.has(id))linked.set(id,[]);linked.get(id).push({id:row.id,name:row.name,reviewStatus:row.reviewStatus});}
 }
 const related=new Set([...linked.keys(),...preferences.pinned]);const hidden=new Set(preferences.hidden);const hiddenRelatedCount=[...related].filter(id=>hidden.has(id)).length;
 const ordering=[...preferences.order,...ids().filter(id=>!preferences.order.includes(id))];
 const markets=ordering.filter(id=>related.has(id)&&!hidden.has(id)).map(id=>({id,reason:linked.has(id)?preferences.pinned.includes(id)?'both':'holding':'pinned',holdings:linked.get(id)??[]}));
 return {markets,unmappedCount,explicitNoneCount,hiddenRelatedCount};
}
function validDate(value){return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number(value.slice(0,4))>0&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
export function validateMarketBundle(input,{maxDate=new Date().toISOString().slice(0,10)}={}){
 plain(input,['schemaVersion','mode','generatedAt','records']);
 if(input.schemaVersion!==1||input.mode!=='public-snapshot'||typeof input.generatedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(input.generatedAt)||!validDate(input.generatedAt.slice(0,10))||!Number.isFinite(Date.parse(input.generatedAt))||!validDate(maxDate))invalid();
 list(input.records,6);const seen=new Set();
 const records=input.records.map(record=>{
  plain(record,['id','points','quote','source','status','error']);const item=MARKET_CATALOG.find(item=>item.id===record.id);
  if(!item||seen.has(record.id))invalid();seen.add(record.id);plain(record.source,['label','url']);
  if(record.source.label!==item.source.label||record.source.url!==item.source.url||record.quote!==null||!['available','unavailable'].includes(record.status)||(record.error!==null&&(typeof record.error!=='string'||record.error.length>2000)))invalid();
  list(record.points,300);let prior=null;
  const points=record.points.map(point=>{
   plain(point,['date','close']);if(!validDate(point.date)||point.date>maxDate||(prior!==null&&point.date<=prior)||typeof point.close!=='number'||!Number.isFinite(point.close)||point.close<=0)invalid();prior=point.date;return {date:point.date,close:point.close};
  });
  if((record.status==='available'&&!points.length)||(record.status==='unavailable'&&points.length))invalid();
  return {id:item.id,points,quote:null,source:{...item.source},status:record.status,error:record.error===null?null:'行情刷新失败，请查看有日期的旧快照或稍后重试。'};
 });
 return {schemaVersion:1,mode:'public-snapshot',generatedAt:input.generatedAt,records};
}
export function marketSeries(record,range='3m',now=new Date()){
 const count={'1m':21,'3m':63,'1y':250}[range];if(!count)invalid();
 const all=record.points;const points=all.slice(-count).map(point=>({...point}));const last=all.at(-1);const prior=all.at(-2);const dataDate=last?.date??null;
 const today=new Date(now);if(Number.isNaN(today.getTime()))invalid();const todayDate=today.toISOString().slice(0,10);const age=dataDate?(Date.parse(todayDate)-Date.parse(dataDate))/86400000:Infinity;
 const change=prior?(last.close/prior.close-1)*100:null;
 return {points,lastClose:last?.close??null,changePercent:Number.isFinite(change)?change:null,startDate:points[0]?.date??null,endDate:points.at(-1)?.date??null,dataDate,stale:age<0||age>7};
}
