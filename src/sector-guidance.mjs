import {currencies,parseAmount} from './domain.mjs';
import {validateRiskProfile} from './checkup.mjs';
import {customSectorId} from './sector-options.mjs';
const scale=100000000n;
const units=value=>{const [whole,frac='']=value.split('.');return BigInt(whole)*scale+BigInt(frac.padEnd(8,'0'));};
const decimal=value=>{const frac=(value%scale).toString().padStart(8,'0').replace(/0+$/,'');return `${value/scale}${frac?'.'+frac:''}`;};
const basis=value=>{const [whole,frac='']=value.split('.');return BigInt(whole)*100n+BigInt(frac.padEnd(2,'0'));};
const todayLocal=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export function analyzeSectorGuidance(snapshot,report,profile=null,{today=todayLocal()}={}){
 const prefs=profile?validateRiskProfile(profile):null,seen=new Set(),valid=[];let excluded=0;
 for(const row of snapshot.holdings){
  if(seen.has(row.id))continue;seen.add(row.id);const value=parseAmount(row.marketValue);
  if(row.reviewStatus!=='confirmed'||!currencies.includes(row.currency)||value===null||value.startsWith('-')){excluded++;continue;}
  valid.push({...row,amount:units(value)});
 }
 const linked=row=>row.sectorReview==='confirmed'&&[...(row.sectorIds||[]),...(row.customSectorNames||[]).map(customSectorId)].includes(report.id);
 const allocations=currencies.filter(c=>valid.some(row=>row.currency===c&&linked(row))).map(currency=>{
  const rows=valid.filter(row=>row.currency===currency),total=rows.reduce((sum,row)=>sum+row.amount,0n),amount=rows.filter(linked).reduce((sum,row)=>sum+row.amount,0n);
  return {currency,amount:decimal(amount),total:decimal(total),percent:total>0n?Number(amount*10000n/total)/100:null,overCap:total>0n&&prefs?.sectorCapPercent!==null&&prefs?.sectorCapPercent!==undefined?amount*10000n>total*basis(prefs.sectorCapPercent):false,scenarioLoss:prefs?.lossTolerancePercent!==null&&prefs?.lossTolerancePercent!==undefined?decimal(total*basis(prefs.lossTolerancePercent)/10000n):null};
 });
 const dates=new Set(valid.map(row=>row.asOfDate));const incomplete=excluded>0;const caveat=[incomplete?`${excluded}条待核对或无效持仓未计入，完整配置仍不确定。`:'',dates.has(null)||dates.has(undefined)||dates.size>1?'持仓日期缺失或不同，需核对到同一日期。':'','关联产品占比不代表基金底层行业敞口；多板块可能重叠，不能相加。'].filter(Boolean).join('');
 const fresh=!report.stale&&!report.sourceError,tech=report.technical;
 const weak=fresh&&(report.technicalExplanation?report.technicalExplanation.trend.state==='weak':tech&&Number.isFinite(tech.ma20)&&Number.isFinite(tech.ma60)&&Number.isFinite(tech.lastClose)&&tech.lastClose<tech.ma20&&tech.lastClose<tech.ma60);
 const technical=fresh&&report.technicalExplanation?report.technicalExplanation.summary:fresh&&tech&&Number.isFinite(tech.ma20)&&Number.isFinite(tech.lastClose)?`行情代理收盘${tech.lastClose>=tech.ma20?'位于':'低于'}20样本均线（${tech.lastDate}）。`:'专属技术证据不足或已过期。';
 const market=fresh&&!report.relativeStale&&!report.benchmarkError&&report.relative20?`参考对象相对${report.benchmarkName||'沪深300'}的20期表现为${report.relative20.percentPoints.toFixed(2)}个百分点（截至${report.relative20.to}）。`:'尚无可用的同日市场相对表现证据。';
 const days=prefs?.needBy?(Date.parse(prefs.needBy+'T00:00:00Z')-Date.parse(today+'T00:00:00Z'))/86400000:null;
 const personalRule=report.planNotes?.find(n=>n.source==='user-rule');
 let priority='observe',title='按个人计划观察',action='定期核对配置与产品实际投资范围，再根据自己的目标评估调整。';
 if(!allocations.some(a=>a.percent!==null)){priority='data';title='先补齐可计算的持仓';action='补全并确认金额、币种，再计算关联占比；现阶段无法判断是否超过你的配置上限。';}
 else if(allocations.some(a=>a.overCap)){priority='cap';title='优先检查板块集中度';action=`关联占比超过你设置的${prefs.sectorCapPercent}%上限；先检查多只基金的投资范围是否重复，再评估是否回到目标比例。${weak?'同时代理走势偏弱，调整前核对最新行情。':''}${days!==null&&days<=365?'另请优先核对近期用钱安排。':''}`;}
 else if(days!==null&&days<=365){priority='liquidity';title=days<0?'先更新已到期的用钱安排':'先核对近期用钱安排';action=`${days<0?'预计用钱日期已过':'未来365日检查窗口内有用钱安排'}；先到“目标与体检”确认需要的金额、赎回时间及可用资金覆盖，再评估这部分持仓是否适合承担波动。`;}
 else if(prefs?.lossTolerancePercent!==null&&prefs?.lossTolerancePercent!==undefined&&basis(prefs.lossTolerancePercent)===0n){priority='risk';title='先核实能否接受本金波动';action='你设置不接受本金亏损；先核实关联产品是否存在本金损失风险及是否有明确保障，不能凭市场走势认定符合这个要求。';}
 else if(fresh&&Number.isFinite(tech?.maxDrawdown20)&&prefs?.lossTolerancePercent!==null&&prefs?.lossTolerancePercent!==undefined&&Math.abs(tech.maxDrawdown20)>Number(prefs.lossTolerancePercent)){priority='risk';title='复核波动承受意愿';action=`代理最近20收盘样本的最大回撤幅度超过你自定的${prefs.lossTolerancePercent}%承受幅度；这不是你的组合回撤或未来预测，先复核是否接受同类波动，再评估配置。`;}
 else if(personalRule){priority='rule';title=personalRule.title;action=personalRule.nextStep;}
 else if(!prefs||Object.values(prefs).every(v=>v===null)){priority='profile';title='先设置你的风险与配置标准';action='填写可接受亏损、预计用钱日期和板块上限，才能判断当前配置是否符合自己的计划。';}
 else if(weak){priority='technical';title='走势偏弱，复核持有计划';action='代理收盘低于20及60样本均线；复核持有理由与资金期限，观察后续价格和量能，单次技术信号不直接决定交易。';}
 else if(!fresh||!tech){title='先按配置管理，等待行情证据';action='先对照个人上限及用钱安排管理配置；专属行情证据不足，暂不判断当前是否适合加减仓。';}
 const context=[prefs?.needBy?`预计用钱：${prefs.needBy}`:'用钱时间未设置',prefs?.lossTolerancePercent!==null&&prefs?.lossTolerancePercent!==undefined?`自定可接受亏损${prefs.lossTolerancePercent}%：以下展示同币种已确认总额的假设波动金额，不是亏损预测或止损线。`:'可接受亏损未设置',prefs?.sectorCapPercent!==null&&prefs?.sectorCapPercent!==undefined?`自定单板块上限${prefs.sectorCapPercent}%`:'板块上限未设置'].join('；');
 return {priority,title,action,allocations,incomplete,caveat,context,technical,market,sentiment:report.sentimentContext?.summary||'情绪证据不足，未接入可核验情绪来源，不按中性或利好处理。'};
}
