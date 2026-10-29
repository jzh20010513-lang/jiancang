import {currencies,parseAmount} from './domain.mjs';

const SCALE=100000000n;
const units=value=>{const text=parseAmount(value);if(text===null)throw new Error('金额无效');const negative=text.startsWith('-');const [whole,frac='']=text.replace(/^-/,'').split('.');return BigInt(whole+frac.padEnd(8,'0'))*(negative?-1n:1n);};
const decimal=value=>{const sign=value<0n?'-':'';const n=value<0n?-value:value;const fraction=(n%SCALE).toString().padStart(8,'0').replace(/0+$/,'');return `${sign}${n/SCALE}${fraction?'.'+fraction:''}`;};
const abs=n=>n<0n?-n:n;
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number(value.slice(0,4))>0&&!Number.isNaN(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
function plain(value,keys,label){
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new Error(`${label}必须为普通对象`);
 for(const key of Reflect.ownKeys(value)){const desc=Object.getOwnPropertyDescriptor(value,key);if(typeof key!=='string'||!keys.includes(key)||!('value'in desc))throw new Error(`${label}含未知或非数据字段`);}
 for(const key of keys)if(!Object.hasOwn(value,key))throw new Error(`${label}缺少${key}`);
}
function list(value,max,label){if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>max)throw new Error(`${label}无效或过长`);for(const key of Reflect.ownKeys(value)){const desc=Object.getOwnPropertyDescriptor(value,key);if(key==='length')continue;if(typeof key!=='string'||!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=value.length||!('value'in desc))throw new Error(`${label}含非数据字段`);}for(let i=0;i<value.length;i++)if(!Object.hasOwn(value,i))throw new Error(`${label}不能稀疏`);}
function text(value,max,label,empty=true){if(typeof value!=='string'||value.length>max||(!empty&&!value.trim()))throw new Error(`${label}无效`);return value;}
function percent(value){if(typeof value!=='string'||value.length>6||! /^(0|[1-9]\d*)(?:\.\d{1,2})?$/.test(value))throw new Error('百分比须为至多两位小数的十进制字符串');const [whole,frac='']=value.split('.');const n=BigInt(whole)*100n+BigInt(frac.padEnd(2,'0'));if(n>10000n)throw new Error('百分比范围应为0至100');return n;}
export const defaultPlan=()=>({purpose:'',rules:[]});
export function validateRiskProfile(input){
 plain(input,['lossTolerancePercent','needBy','sectorCapPercent'],'个人偏好');
 for(const key of ['lossTolerancePercent','sectorCapPercent'])if(input[key]!==null)percent(input[key]);
 if(input.needBy!==null&&!date(input.needBy))throw Error('用钱日期无效');
 return {lossTolerancePercent:input.lossTolerancePercent,needBy:input.needBy,sectorCapPercent:input.sectorCapPercent};
}
export function validatePlan(input){
 plain(input,['purpose','rules',...(Object.hasOwn(input??{},'riskProfile')?['riskProfile']:[])],'目标');text(input.purpose,200,'用途');list(input.rules,6,'币种规则');const seen=new Set();
 const rules=input.rules.map(r=>{
  plain(r,['currency','allocations','deviationThreshold','maxSinglePercent','requiredLiquid','needBy'],'规则');
  if(!currencies.includes(r.currency)||seen.has(r.currency))throw new Error('币种无效或重复');seen.add(r.currency);list(r.allocations,30,'类别目标');const names=new Set();let total=0n;
  const allocations=r.allocations.map(a=>{plain(a,['category','percent'],'类别目标');text(a.category,120,'类别名称',false);if(names.has(a.category))throw new Error('类别名称重复');names.add(a.category);total+=percent(a.percent);return {category:a.category,percent:a.percent};});
  if(allocations.length&&total!==10000n)throw new Error('配置目标必须合计100%');percent(r.deviationThreshold);if(r.maxSinglePercent!==null)percent(r.maxSinglePercent);
  if(r.requiredLiquid!==null&&(typeof r.requiredLiquid!=='string'||parseAmount(r.requiredLiquid)===null||units(r.requiredLiquid)<0n))throw new Error('需要可用金额无效');
  if(r.needBy!==null&&!date(r.needBy))throw new Error('用钱日期无效');
  return {currency:r.currency,allocations,deviationThreshold:r.deviationThreshold,maxSinglePercent:r.maxSinglePercent,requiredLiquid:r.requiredLiquid===null?null:parseAmount(r.requiredLiquid),needBy:r.needBy};
 });return {purpose:input.purpose,rules,...(Object.hasOwn(input,'riskProfile')?{riskProfile:validateRiskProfile(input.riskProfile)}:{})};
}
function summarize(snapshot){
 const valid=[],invalid=[];for(const row of snapshot.holdings){const amount=parseAmount(row.marketValue);if(row.reviewStatus!=='confirmed'||typeof row.name!=='string'||!row.name.trim()||!currencies.includes(row.currency)||amount===null||units(amount)<0n)invalid.push(row);else valid.push({...row,amount:units(amount)});}
 const totals=new Map();for(const row of valid)totals.set(row.currency,(totals.get(row.currency)??0n)+row.amount);return {valid,invalid,totals};
}
const localToday=()=>{const now=new Date();return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');};
export function analyzeCheckup(snapshot,plan,previousSnapshot=null,{today=localToday()}={}){
 if(!date(today))throw new Error('today须为有效本地日历日期');const checked=validatePlan(plan);const {valid,invalid,totals}=summarize(snapshot);const findings=[],comparisons=[],liquidity=[],changes=[];
 const add=(id,priority,title,evidence,nextStep,source,currency=null,holdingIds=[])=>findings.push({id,priority,title,evidence,nextStep,source,currency,holdingIds});
 if(invalid.length)add('incomplete','high','先补全待确认持仓',`${invalid.length}条持仓未确认、名称/币种/金额缺失或含负金额；以下汇总仅含已确认非负金额。`,'核对原始记录并补全信息；缺失行可能改变对照结果。','missing-data',null,invalid.map(r=>r.id));
 const dates=new Set(valid.map(r=>r.asOfDate).filter(date));const invalidDate=valid.some(r=>!date(r.asOfDate));
 if(invalidDate||dates.size>1)add('dates','medium','数据日期不完整或不一致',`已确认金额涉及${dates.size}个有效日期，${valid.filter(r=>!date(r.asOfDate)).length}条日期未知或无效。`,'核对为同一日期后再判断可用覆盖；快照不是当前赎回承诺。','missing-data',null,valid.filter(r=>!date(r.asOfDate)||dates.size>1).map(r=>r.id));
 const codes=new Map();for(const row of snapshot.holdings){if(typeof row.code!=='string'||!row.code.trim()||!currencies.includes(row.currency))continue;const key=JSON.stringify([row.currency,row.code]);if(!codes.has(key))codes.set(key,[]);codes.get(key).push(row);}
 for(const [key,rows] of codes)if(rows.length>1)add(`duplicate:${key}`,'medium','发现相同代码的待核候选',`${rows.length}条记录代码相同；未据此合并，也未推断底层资产敞口。`,'核对是否为重复录入；确认同一资产后可设置资产分组。',rows.every(r=>r.reviewStatus==='confirmed')?'confirmed-data':'missing-data',rows[0].currency,rows.map(r=>r.id));
 const categoryNames=new Map(snapshot.categories.map(c=>[c.id,c.name]));
 for(const currency of currencies){
  const rows=valid.filter(r=>r.currency===currency);const rule=checked.rules.find(r=>r.currency===currency);if(!rows.length&&!rule)continue;
  const total=totals.get(currency)??0n;const incomplete=invalid.some(r=>!currencies.includes(r.currency)||r.currency===currency);const unknownCategories=rows.filter(r=>!categoryNames.has(r.categoryId));const unknownAmount=unknownCategories.reduce((n,r)=>n+r.amount,0n);
  if(unknownCategories.length)add(`category:${currency}`,'medium','部分持仓尚未分类',`${unknownCategories.length}条记录缺少有效类别；类别目标是否满足尚不能确认。`,'补全类别，再核对目标。','missing-data',currency,unknownCategories.map(r=>r.id));
  const categories=new Map();for(const r of rows){const name=categoryNames.get(r.categoryId);if(name!==undefined)categories.set(name,(categories.get(name)??0n)+r.amount);}
  if(rule?.allocations.length){
   const targets=new Map(rule.allocations.map(a=>[a.category,a.percent]));const names=[...new Set([...targets.keys(),...categories.keys()])];const comparisonRows=[];
   for(const category of names){const amount=categories.get(category)??0n;const targetPercent=targets.get(category)??'0';const target=percent(targetPercent);const difference=amount*10000n-total*target;const actualPercent=total>0n?Number(amount*1000000n/total)/10000:null;const deltaPp=total>0n?Number(difference*100n/total)/10000:null;
    comparisonRows.push({category,actualPercent,targetPercent,deltaPp,gapAmount:total>0n?decimal((total*target-amount*10000n)/10000n):null});
    if(targets.has(category)&&!categories.has(category))add(`target-unmatched:${currency}:${category}`,'medium','目标类别未匹配当前持仓',`目标「${category}」没有匹配的已确认类别金额；可能是类别更名、导入范围变化或当前没有该类别。`,'核对类别名称与持仓范围；目标仍保留。','user-rule',currency);
    if(!targets.has(category))add(`unmatched:${currency}:${category}`,'medium','实际类别未列入目标',`类别「${category}」未匹配目标；在表中以目标0%列示。`,'核对类别名称或更新目标。','user-rule',currency,rows.filter(r=>categoryNames.get(r.categoryId)===category).map(r=>r.id));
    if(total>0n&&abs(difference)>total*percent(rule.deviationThreshold))add(`allocation:${currency}:${category}`,'medium','类别配置偏离自定目标',`类别「${category}」目标${targetPercent}%，偏离超过自定${rule.deviationThreshold}个百分点。${incomplete||unknownCategories.length?'待补记录使完整配置结论不确定。':''}`,'核对持仓范围、类别与目标；此处只比较快照。','user-rule',currency,rows.filter(r=>categoryNames.get(r.categoryId)===category).map(r=>r.id));
   }
   comparisons.push({currency,total:decimal(total),rows:comparisonRows,unknownCategoryAmount:decimal(unknownAmount)});
   if(incomplete||unknownCategories.length||total===0n)add(`allocation-uncertain:${currency}`,'medium','配置目标结论不确定','存在待补记录、未知类别或零总额，不能宣称配置达标。','补齐数据后重新核对。','missing-data',currency);
  }
  if(rule?.maxSinglePercent!==null&&rule?.maxSinglePercent!==undefined&&total>0n){const groups=new Map();for(const row of rows){const key=row.assetGroupId?`group:${row.assetGroupId}`:`row:${row.id}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(row);}for(const [key,members] of groups){const value=members.reduce((n,r)=>n+r.amount,0n);if(value*10000n>total*percent(rule.maxSinglePercent))add(`concentration:${currency}:${key}`,'medium','单资产占比超过自定上限',`「${members.slice(0,5).map(r=>r.name).join("、")}${members.length>5?"等"+members.length+"条":""}」在${currency}已确认持仓中占${Number(value*10000n/total)/100}%，超过你自定的${rule.maxSinglePercent}%上限；仅按明确分组或单条计算，未推断底层敞口。${incomplete?'待补记录使完整占比不确定。':''}`,'核对分组和完整持仓，再检查自定上限。','user-rule',currency,members.map(r=>r.id));}}
  let available=0n,unknown=0n,locked=0n;for(const row of rows){if(row.liquidity==='available')available+=row.amount;else if(row.liquidity==='locked')locked+=row.amount;else unknown+=row.amount;}
  const required=rule?.requiredLiquid??null;let status='not-set';
  if(required!==null){const needed=units(required);const stale=rows.some(r=>r.asOfDate!==today);status=available<needed?'insufficient':!rows.length||incomplete||invalidDate||dates.size>1||stale||unknown>0n?'uncertain':'covered-by-labels';add(`liquidity:${currency}`,status==='insufficient'?'high':status==='uncertain'?'medium':'info',status==='insufficient'?'已标注可用金额不足':status==='uncertain'?'可用覆盖仍需核对':'标注金额达到自定需求',`已标注当前可用${decimal(available)}，未知${decimal(unknown)}，受限${decimal(locked)}；自定需要${required}。${status==='uncertain'?'日期或数据范围存在不确定性。':''}标签不等于真实赎回承诺。`,'核对账户实际可用余额、到账时间及数据日期。','user-rule',currency,rows.map(r=>r.id));}
  liquidity.push({currency,confirmedAvailable:decimal(available),unknown:decimal(unknown),locked:decimal(locked),required,needBy:rule?.needBy??null,status});
  const late=rows.filter(r=>r.liquidity==='locked'&&rule?.needBy&&(!date(r.unlockDate)||r.unlockDate>rule.needBy));if(late.length)add(`locked:${currency}`,'high','受限期限与用钱日期需核对',`${late.length}条受限记录解锁晚于需要日期或日期未知；预计解锁未计入当前可用。`,'核对真实解锁与到账条件。','user-rule',currency,late.map(r=>r.id));
 }
 if(previousSnapshot){const before=summarize(previousSnapshot).totals;for(const currency of currencies){if(!totals.has(currency)&&!before.has(currency))continue;const a=totals.get(currency),b=before.get(currency);changes.push({currency,before:b===undefined?null:decimal(b),after:a===undefined?null:decimal(a),delta:a===undefined||b===undefined?null:decimal(a-b)});}if(changes.length)add('snapshot-change','info','上次与本次快照金额变化','仅对两次均存在的币种计算快照金额差；导入范围、日期可能不同，差额不代表收益。','先核对两次导入范围和数据日期。','confirmed-data');}
 const priorities={high:0,medium:1,info:2};findings.sort((a,b)=>priorities[a.priority]-priorities[b.priority]);return {findings,comparisons,liquidity,changes};
}
