import { currencies,parseAmount } from './domain.mjs';
import { defaultPlan,validatePlan } from './checkup.mjs';
import { validateBenchmarkIds,validateMarketPreferences } from './markets.mjs';
import { validateSectorIds } from './sectors.mjs';
import { validateCustomSectorNames } from './sector-options.mjs';
const MAX_BYTES=5*1024*1024;
const CARDS=['allocation','accounts','holdings'];const COLUMNS=['account','category','date','pnl','tags'];
const fail=()=>{throw new Error('文件格式或字段校验失败，请核对版本与内容。');};
const object=value=>{if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))fail();};
function keys(value,required,optional=[]){object(value);for(const key of Reflect.ownKeys(value)){const descriptor=Object.getOwnPropertyDescriptor(value,key);if(!required.includes(key)&&!optional.includes(key)||!descriptor||!('value'in descriptor))fail();}for(const key of required)if(!Object.hasOwn(value,key))fail();}
const string=(value,max=200,empty=false)=>{if(typeof value!=='string'||value.length>max||(!empty&&!value.trim()))fail();return value;};
const nullable=(value,check)=>value===null?null:check(value);
const enumValue=(value,values)=>{if(!values.includes(value))fail();return value;};
const date=value=>{string(value,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(`${value}T00:00:00.000Z`))||new Date(`${value}T00:00:00.000Z`).toISOString().slice(0,10)!==value)fail();return value;};
const iso=value=>{string(value,32);if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString()!==value)fail();return value;};
const currencyCode=value=>{string(value,3);if(!/^[A-Z]{3}$/.test(value))fail();return value;};
const amount=value=>{if(typeof value!=='string'||! /^-?(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(value)||parseAmount(value)===null)fail();return value;};
function array(value,max,check){if(!Array.isArray(value)||value.length>max)fail();return value.map(check);}
function unique(values){if(new Set(values).size!==values.length)fail();return values;}
function fixedList(value,allowed){return unique(array(value,allowed.length,x=>enumValue(x,allowed)));}
export function defaultLayout(){return {cards:[...CARDS],hidden:[],theme:'light',density:'comfortable',mask:false,columns:[...COLUMNS]};}
export function defaultPlanning(){return {plan:defaultPlan(),previousSnapshot:null,dataKind:'user',planSource:'none'};}
export function validateLayout(input){
 guard(input);keys(input,['cards','hidden','theme','density','mask','columns']);const cards=fixedList(input.cards,CARDS);if(cards.length!==CARDS.length)fail();if(typeof input.mask!=='boolean')fail();
 return {cards,hidden:fixedList(input.hidden,CARDS),theme:enumValue(input.theme,['light','dark']),density:enumValue(input.density,['comfortable','compact']),mask:input.mask,columns:fixedList(input.columns,COLUMNS)};
}
function references(value,label){return array(value,200,item=>{keys(item,['id',label]);return {id:string(item.id,100),[label]:string(item[label],120)};});}
function validateSnapshot(input){
 keys(input,['schemaVersion','id','createdAt','coverage','accounts','categories','tags','holdings']);if(input.schemaVersion!==1||input.coverage!=='partial_or_unknown')fail();
 const accounts=references(input.accounts,'alias'),categories=references(input.categories,'name'),tags=references(input.tags,'name');
 const accountIds=new Set(unique(accounts.map(x=>x.id))),categoryIds=new Set(unique(categories.map(x=>x.id))),tagIds=new Set(unique(tags.map(x=>x.id)));
 const fields=['id','accountId','name','code','assetGroupId','currency','marketValue','asOfDate','categoryId','tagIds','source','reviewStatus','reportedHoldingPnl','reportedDailyPnl','reportedPnlCurrency','reportedPnlDate'];
 const holdings=array(input.holdings,1000,row=>{
  keys(row,fields,['favorite','liquidity','unlockDate','benchmarkIds','benchmarkReview','sectorIds','sectorReview','customSectorNames']);if(!accountIds.has(row.accountId)||row.categoryId!==null&&!categoryIds.has(row.categoryId))fail();
  const tagList=unique(array(row.tagIds,50,x=>{string(x,100);if(!tagIds.has(x))fail();return x;}));
  const clean={id:string(row.id,100),accountId:string(row.accountId,100),name:string(row.name,200,true),code:nullable(row.code,x=>string(x,80)),assetGroupId:nullable(row.assetGroupId,x=>string(x,100)),currency:nullable(row.currency,currencyCode),marketValue:nullable(row.marketValue,amount),asOfDate:nullable(row.asOfDate,date),categoryId:nullable(row.categoryId,x=>string(x,100)),tagIds:tagList,source:enumValue(row.source,['manual','screenshot']),reviewStatus:enumValue(row.reviewStatus,['confirmed','needs_attention']),reportedHoldingPnl:nullable(row.reportedHoldingPnl,amount),reportedDailyPnl:nullable(row.reportedDailyPnl,amount),reportedPnlCurrency:nullable(row.reportedPnlCurrency,currencyCode),reportedPnlDate:nullable(row.reportedPnlDate,date)};
  if(Object.hasOwn(row,'favorite')){if(typeof row.favorite!=='boolean')fail();clean.favorite=row.favorite;}
  if(Object.hasOwn(row,'liquidity'))clean.liquidity=enumValue(row.liquidity,['unknown','available','locked']);
  if(Object.hasOwn(row,'unlockDate')){clean.unlockDate=nullable(row.unlockDate,date);if(clean.unlockDate!==null&&clean.liquidity!=='locked')fail();}
  if(Object.hasOwn(row,'benchmarkIds'))clean.benchmarkIds=validateBenchmarkIds(row.benchmarkIds);
  if(Object.hasOwn(row,'benchmarkReview')){clean.benchmarkReview=enumValue(row.benchmarkReview,['unreviewed','confirmed']);if(clean.benchmarkReview==='confirmed'&&!Object.hasOwn(row,'benchmarkIds'))fail();}
  if(Object.hasOwn(row,'sectorIds'))clean.sectorIds=validateSectorIds(row.sectorIds);
  if(Object.hasOwn(row,'customSectorNames'))clean.customSectorNames=validateCustomSectorNames(row.customSectorNames);
  if((clean.sectorIds?.length||0)+(clean.customSectorNames?.length||0)>3)fail();
  if(Object.hasOwn(row,'sectorReview')){clean.sectorReview=enumValue(row.sectorReview,['unreviewed','confirmed']);if(clean.sectorReview==='confirmed'&&!Object.hasOwn(row,'sectorIds'))fail();}
  if(clean.reviewStatus==='confirmed'&&(!clean.name.trim()||!currencies.includes(clean.currency)||clean.marketValue===null))fail();return clean;
 });unique(holdings.map(x=>x.id));
 return {schemaVersion:1,id:string(input.id,100),createdAt:iso(input.createdAt),coverage:'partial_or_unknown',accounts,categories,tags,holdings};
}
function validatePlanning(input){
 keys(input,['plan','previousSnapshot','dataKind'],['planSource','marketPreferences']);
 const plan=validatePlan(input.plan),dataKind=enumValue(input.dataKind,['user','demo']);
 const planSource=Object.hasOwn(input,'planSource')?enumValue(input.planSource,['none','demo','user']):dataKind==='demo'?'demo':plan.rules.length||plan.purpose||Object.values(plan.riskProfile||{}).some(v=>v!==null)?'user':'none';
 const clean={plan,previousSnapshot:nullable(input.previousSnapshot,validateSnapshot),dataKind,planSource};
 if(Object.hasOwn(input,'marketPreferences'))clean.marketPreferences=validateMarketPreferences(input.marketPreferences);
 return clean;
}
function guard(value,seen=new Set(),depth=0){
 if(depth>10)fail();if(value===null||typeof value!=='object'){if(!['string','number','boolean','object'].includes(typeof value))fail();return;}
 if(seen.has(value))fail();if(Array.isArray(value)&&Reflect.ownKeys(value).some(key=>key!=='length'&&(typeof key!=='string'||!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=value.length)))fail();seen.add(value);if(!Array.isArray(value))object(value);
 for(const key of Reflect.ownKeys(value)){if(typeof key!=='string'||['__proto__','prototype','constructor'].includes(key))fail();const desc=Object.getOwnPropertyDescriptor(value,key);if(!desc||!('value'in desc))fail();guard(desc.value,seen,depth+1);}seen.delete(value);
}
export function validateExport(input){
 let value=input;if(typeof value==='string'){if(new TextEncoder().encode(value).length>MAX_BYTES)fail();try{value=JSON.parse(value);}catch{fail();}}
 guard(value);if(new TextEncoder().encode(JSON.stringify(value)).length>MAX_BYTES)fail();object(value);
 if(value.formatId==='local-portfolio-layout'){keys(value,['formatId','schemaVersion','layout']);if(value.schemaVersion!==1)fail();return {formatId:value.formatId,schemaVersion:1,layout:validateLayout(value.layout)};}
 const version=value.schemaVersion;keys(value,['formatId','schemaVersion','exportedAt','snapshot','layout',...(version===2?['planning']:[])]);if(value.formatId!=='local-portfolio-backup'||![1,2].includes(version))fail();
 const clean={formatId:value.formatId,schemaVersion:version,exportedAt:iso(value.exportedAt),snapshot:validateSnapshot(value.snapshot),layout:validateLayout(value.layout)};
 if(version===2)clean.planning=validatePlanning(value.planning);return clean;
}
export function exportFull(snapshot,layout,planning=undefined){return validateExport({formatId:'local-portfolio-backup',schemaVersion:planning===undefined?1:2,exportedAt:new Date().toISOString(),snapshot,layout,...(planning===undefined?{}:{planning})});}
export function exportLayout(layout){return validateExport({formatId:'local-portfolio-layout',schemaVersion:1,layout});}
