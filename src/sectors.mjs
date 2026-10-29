import {currencies,parseAmount} from './domain.mjs';
import {SECTOR_CATALOG} from './sector-catalog.mjs';
import {SECTOR_OPTIONS,validateCustomSectorNames,customSectorId,sectorOptionsFor} from './sector-options.mjs';
import {technicalAnalysis} from './technical.mjs';
import {explainTechnical} from './technical-explanation.mjs';
import {completedReferencePoints} from './reference-periods.mjs';
import {describeVolatility} from './volatility.mjs';

const SCALE=100000000n;
const units=text=>{const [whole,fraction='']=text.split('.');return BigInt(whole)*SCALE+BigInt(fraction.padEnd(8,'0'));};
const decimal=value=>{const fraction=(value%SCALE).toString().padStart(8,'0').replace(/0+$/,'');return `${value/SCALE}${fraction?'.'+fraction:''}`;};
const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number(value.slice(0,4))>0&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;

export function validateSectorIds(value){
 const invalid=()=>{throw new Error('板块关联必须为至多三个已知且不重复的板块ID');};
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>3)invalid();
 for(const key of Reflect.ownKeys(value)){
  if(key==='length')continue;
  const descriptor=Object.getOwnPropertyDescriptor(value,key);
  if(typeof key!=='string'||!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=value.length||!('value' in descriptor))invalid();
 }
 const seen=new Set();const known=new Set(SECTOR_OPTIONS.map(item=>item.id));const result=[];
 for(let i=0;i<value.length;i++){
  if(!Object.hasOwn(value,i))invalid();const id=value[i];
  if(typeof id!=='string'||!known.has(id)||seen.has(id))invalid();seen.add(id);result.push(id);
 }
 return result;
}

// Called only by the explicitly labelled "confirm and save all selected" action.
// Reading a draft, importing a backup, or rendering the dashboard never confirms it.
export function confirmSectorSelections(snapshot){
 const next=structuredClone(snapshot);let selectedCount=0;
 for(const row of next.holdings){
  const ids=validateSectorIds(row.sectorIds??[]),names=validateCustomSectorNames(row.customSectorNames??[]);
  if(ids.length+names.length>3)throw Error('内置与自定义板块合计最多3项');
  if(ids.length+names.length){row.sectorIds=ids;row.sectorReview='confirmed';selectedCount++;}
 }
 return {snapshot:next,selectedCount,unmappedCount:next.holdings.filter(row=>row.sectorReview!=='confirmed').length};
}

function availableRecord(bundle,id){
 const record=bundle?.records?.find(record=>record.id===id);
 return record?.status==='available'&&Array.isArray(record.points)&&record.points.length?record:null;
}
function relativeReturn(sector,benchmark){
 if(!sector||!benchmark)return null;
 const benchmarkDates=new Map(benchmark.points.map(point=>[point.date,point.close]));
 const common=sector.points.filter(point=>benchmarkDates.has(point.date)).slice(-21);
 if(common.length!==21)return null;
 const first=common[0],last=common.at(-1);const baseFirst=benchmarkDates.get(first.date),baseLast=benchmarkDates.get(last.date);
 if(![first.close,last.close,baseFirst,baseLast].every(value=>typeof value==='number'&&Number.isFinite(value)&&value>0))return null;
 const referencePercent=(last.close/first.close-1)*100,benchmarkPercent=(baseLast/baseFirst-1)*100;
 const percentPoints=referencePercent-benchmarkPercent;
 return [percentPoints,referencePercent,benchmarkPercent].every(Number.isFinite)?{percentPoints,referencePercent,benchmarkPercent,from:first.date,to:last.date,samples:21}:null;
}

export function analyzeSectors(snapshot,sectorBundle,marketBundle,checkupFindings=[],{today=new Date().toISOString().slice(0,10),now=new Date().toISOString(),sourceReady=true,benchmarkReady=true}={}){
 if(!validDate(today))throw new Error('today须为有效UTC日历日期');
 const options=sectorOptionsFor(snapshot);
 const linked=new Map();let unmappedCount=0,explicitNoneCount=0;const seenRows=new Set();
 for(const row of snapshot.holdings){
  if(seenRows.has(row.id))continue;seenRows.add(row.id);
  if(row.sectorReview!=='confirmed'||row.sectorIds===undefined){unmappedCount++;continue;}
  const sectors=validateSectorIds(row.sectorIds),custom=validateCustomSectorNames(row.customSectorNames||[]);if(sectors.length+custom.length>3)throw Error('每项持仓最多3个分类');if(!sectors.length&&!custom.length){explicitNoneCount++;continue;}
  for(const id of [...sectors,...custom.map(customSectorId)]){if(!linked.has(id))linked.set(id,[]);linked.get(id).push(row);}
 }
 const reports=options.filter(item=>linked.has(item.id)).map(item=>{
  const reference=SECTOR_CATALOG.find(r=>r.id===item.referenceId)||null;
  const rows=linked.get(item.id),totalsByCurrency=new Map();let excludedCount=0;
  for(const row of rows){
   const amount=parseAmount(row.marketValue);
   if(row.reviewStatus!=='confirmed'||!currencies.includes(row.currency)||amount===null||amount.startsWith('-')){excludedCount++;continue;}
   totalsByCurrency.set(row.currency,(totalsByCurrency.get(row.currency)??0n)+units(amount));
  }
  const totals=currencies.filter(currency=>totalsByCurrency.has(currency)).map(currency=>({currency,value:decimal(totalsByCurrency.get(currency))}));
  const dates=[...new Set(rows.map(row=>row.asOfDate).filter(validDate))].sort();const unknownDate=rows.some(row=>!validDate(row.asOfDate));
  const rawRecord=reference?availableRecord(sectorBundle,reference.id):null;
  const completed=rawRecord?completedReferencePoints(rawRecord.points,reference,now,'day'):[];
  const record=rawRecord&&completed.length?{...rawRecord,points:completed}:null;const lastDate=record?.points.at(-1)?.date;
  const age=validDate(lastDate)?(Date.parse(today)-Date.parse(lastDate))/86400000:Infinity;
  const stale=!!reference&&(age<0||age>7||(rawRecord?.points.at(-1)?.date??'')>today);const sourceError=!!reference&&(!record||record.error!==null&&record.error!==undefined);
  const dataStatus=!reference?'classification-only':record?'available':'unavailable';
  const technical=record?technicalAnalysis(record.points):null;
  const technicalExplanation=explainTechnical(record?.points||[],{usable:!!record&&!stale&&!sourceError,reason:sourceError?'行情来源缺失或采集失败，暂不判断当前走势。':'行情日期过期，暂不判断当前走势。'});
  const weeklyRecord=reference?sectorBundle?.records?.find(r=>r.id===reference.id)?.weekly:null;
  const weeklyPoints=reference?.weeklySource&&weeklyRecord?.status==='available'?completedReferencePoints(weeklyRecord.points,reference,now,'week'):[];
  const weeklyLast=weeklyPoints.at(-1)?.date,weeklyAge=validDate(weeklyLast)?(Date.parse(today)-Date.parse(weeklyLast))/86400000:Infinity;
  const weeklyStale=weeklyAge<0||weeklyAge>14,weeklyError=!weeklyRecord||weeklyRecord.error!==null&&weeklyRecord.error!==undefined;
  const weeklyExplanation=reference?.weeklySource?explainTechnical(weeklyPoints,{timeframe:'week',usable:weeklyPoints.length>0&&!weeklyStale&&!weeklyError,reason:weeklyError?'周线来源缺失或刷新失败，暂不判断周线。':weeklyStale?'周线日期过期或异常，暂不判断周线。':'尚无已完成周线。'}):null;
  if(reference?.kind==='index'){technicalExplanation.volume.text='指数成交量口径尚未核实，本轮不据此判断量能或情绪。';if(weeklyExplanation)weeklyExplanation.volume.text='指数成交量口径尚未核实，本轮不据此判断量能或情绪。';}
  const benchmarkName=reference?.benchmarkName||'沪深300';
  const benchmark=reference?availableRecord(marketBundle,reference.benchmarkId):null;const relative20=relativeReturn(record,benchmark);
  const relativeAge=relative20?(Date.parse(today)-Date.parse(relative20.to))/86400000:Infinity;
  const relativeStale=!!reference&&(relativeAge<0||relativeAge>7);
  const benchmarkError=!!reference&&(!benchmark||benchmark.error!==null&&benchmark.error!==undefined);
  const sentimentContext=describeVolatility(sectorBundle?.context?.vix,{referenceId:reference?.id,now});
  const notes=[reference?reference.boundary:'已保存分类，专属行情尚未接入；此分类没有技术或相对表现指标，不代表已取得行业数据。',sentimentContext.state==='available'?'情绪仅有美国宽基VIX波动背景，其他证据不足，不生成综合情绪分数。':'情绪未评分：没有充分的对应市场情绪证据，不按中性处理。','金额仅为已确认关联产品金额；多板块关联会重叠，不能相加作为组合敞口。'];
  if(sourceError)notes.push('板块行情来源缺失或刷新失败；需核对来源与有日期的旧快照。');
  if(stale)notes.push('板块行情日期缺失、在未来或超过7天，属于过期或异常日期。');
  if(rows.some(row=>row.reviewStatus!=='confirmed'))notes.push('存在待确认持仓，保留名称关联但不计入金额。');
  if(excludedCount)notes.push(`${excludedCount}条关联记录因待确认、币种未知或金额无效未计入汇总。`);
  if(unknownDate||dates.length>1)notes.push('关联持仓日期未知或不一致，金额不能视为同日完整快照。');
  if(reference&&!relative20)notes.push('与'+benchmarkName+'不足21个共同交易日期，未计算20期相对表现；未做日期前向填充。');
  if(relative20&&relativeStale)notes.push('相对表现共同窗口已过期或日期异常，不代表当前市场状态。');
  if(benchmarkError)notes.push(benchmarkName+'基准来源缺失或刷新失败，需核对比较窗口。');
  const nextSteps=[];const technicalReady=sourceReady&&!stale&&!sourceError,marketReady=technicalReady&&benchmarkReady&&!relativeStale&&!benchmarkError;
  if(!reference)nextSteps.push('根据产品说明核对分类与实际投资范围；如需市场背景，可另行设置参考市场。');
  if(reference&&(!sourceReady||!benchmarkReady||!record||stale||sourceError||relativeStale||benchmarkError))nextSteps.push('先核对公共行情和基准的来源与日期；数据恢复并更新后再观察指标。');
  if(technicalReady&&technical?.ma20!==null&&technical?.ma20!==undefined&&Number.isFinite(technical.lastClose))nextSteps.push(`代理收盘${technical.lastClose>=technical.ma20?'高于或等于':'低于'}20期均线；后续观察该关系是否延续，并核对样本日期。`);
  if(technicalReady&&technical?.rsi14!==null&&technical?.rsi14!==undefined)nextSteps.push(`RSI(14)为${technical.rsi14.toFixed(2)}；仅记录动量状态，后续观察变化是否与价格及成交量一致。`);
  if(marketReady&&relative20)nextSteps.push(`同日样本20期相对${benchmarkName}为${relative20.percentPoints.toFixed(2)}个百分点；后续在相同日期窗口复核。`);
  if(!nextSteps.length)nextSteps.push('等待足够的有效交易日样本，再核对均线、动量与量能的变化。');
  const holdingIds=rows.map(row=>row.id),ids=new Set(holdingIds);
  const planNotes=checkupFindings.filter(finding=>Array.isArray(finding.holdingIds)&&finding.holdingIds.some(id=>ids.has(id))).slice(0,3).map(({title,evidence,nextStep,source})=>({title,evidence,nextStep,source}));
  return {id:item.id,name:item.name,isCustom:!!item.isCustom,reference,dataStatus,holdingIds,holdings:rows.map(({id,name,reviewStatus})=>({id,name,reviewStatus})),totals,excludedCount,dates,unknownDate,technical,technicalExplanation,weeklyExplanation,weeklyDate:weeklyLast??null,weeklyStale,weeklyError,benchmarkName,sentimentContext,relative20,relativeStale,benchmarkError,stale,sourceError,notes,nextSteps:nextSteps.slice(0,3),planNotes};
 });
 return {reports,unmappedCount,explicitNoneCount};
}
