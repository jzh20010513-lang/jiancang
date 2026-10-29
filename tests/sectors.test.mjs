import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeSectors,validateSectorIds} from '../src/sectors.mjs';

const holding=(id,overrides={})=>({id,name:`虚构${id}`,currency:'CNY',marketValue:'10',asOfDate:'2026-10-25',reviewStatus:'confirmed',sectorReview:'confirmed',sectorIds:['semiconductor'],...overrides});
const snapshot=holdings=>({holdings});
const run=(rows,sectors=null,markets=null,findings=[],today='2026-10-27')=>analyzeSectors(snapshot(rows),sectors,markets,findings,{today,now:today+'T23:59:59Z'});
const points=(start=100,step=1)=>Array.from({length:21},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,close:start+i*step,volume:100}));
const bundle=(id,data,overrides={})=>({records:[{id,status:'available',error:null,points:data,...overrides}]});

test('sector IDs reject unknown, repeated and non-data arrays without invoking accessors',()=>{
 assert.deepEqual(validateSectorIds(['medical','ev']),['medical','ev']);
 for(const value of [null,'ev',['unknown'],['ev','ev'],new Array(1),['ev','medical','semiconductor','ev']])assert.throws(()=>validateSectorIds(value));
 let invoked=false;const accessor=[];Object.defineProperty(accessor,0,{get(){invoked=true;return 'ev';}});assert.throws(()=>validateSectorIds(accessor));assert.equal(invoked,false);
 const extra=['ev'];extra.extra=true;assert.throws(()=>validateSectorIds(extra));
});
test('explicit reviewed mappings are required and no names, codes or currencies infer a sector',()=>{
 const result=run([holding('old',{name:'半导体ETF',code:'512480',sectorReview:undefined,sectorIds:undefined}),holding('pending',{sectorReview:'unreviewed'}),holding('none',{sectorIds:[]}),holding('yes')]);
 assert.equal(result.unmappedCount,2);assert.equal(result.explicitNoneCount,1);assert.equal(result.reports.length,1);assert.deepEqual(result.reports[0].holdingIds,['yes']);
});
test('reports count each row once and aggregate exact amounts only within known currencies',()=>{
 const row=holding('a',{marketValue:'999999999999999.00000001',sectorIds:['semiconductor','medical']});
 const rows=[row,row,holding('b',{marketValue:'0.00000002'}),holding('hk',{currency:'HKD',marketValue:'3'}),holding('pending',{reviewStatus:'needs_attention'}),holding('bad',{currency:'USDT'}),holding('negative',{marketValue:'-1'})];
 const {reports}=run(rows);const report=reports.find(r=>r.id==='semiconductor');
 assert.equal(report.holdingIds.length,6);assert.equal(report.holdings.find(r=>r.id==='pending').reviewStatus,'needs_attention');assert.equal(report.excludedCount,3);
 assert.deepEqual(report.totals,[{currency:'CNY',value:'999999999999999.00000003'},{currency:'HKD',value:'3'}]);
 assert.deepEqual(reports.find(r=>r.id==='medical').totals,[{currency:'CNY',value:'999999999999999.00000001'}]);
});
test('reports disclose pending rows and mixed or unknown holding dates',()=>{
 const report=run([holding('a'),holding('b',{asOfDate:'2026-10-24'}),holding('c',{asOfDate:null}),holding('pending',{reviewStatus:'needs_attention'})]).reports[0];
 assert.deepEqual(report.dates,['2026-10-24','2026-10-25']);assert.equal(report.unknownDate,true);assert.ok(report.notes.some(n=>n.includes('待确认')));assert.ok(report.notes.some(n=>n.includes('日期')));
 assert.ok(report.notes.some(n=>n.includes('ETF')&&n.includes('敞口')));assert.ok(report.notes.some(n=>n.includes('情绪')&&n.includes('评分')));
});
test('relative return uses 21 exact shared dates and expresses percentage points',()=>{
 const report=run([holding('a')],bundle('semiconductor',points(100,1)),bundle('cn-large',points(100,0.5))).reports[0];
 assert.equal(report.technical.sampleCount,21);assert.ok(Math.abs(report.relative20.percentPoints-10)<1e-10);assert.ok(Math.abs(report.relative20.referencePercent-20)<1e-10);assert.ok(Math.abs(report.relative20.benchmarkPercent-10)<1e-10);assert.deepEqual({...report.relative20,percentPoints:10,referencePercent:20,benchmarkPercent:10},{percentPoints:10,referencePercent:20,benchmarkPercent:10,from:'2026-10-01',to:'2026-10-21',samples:21});
 const missing=points(100,0.5).filter((_,i)=>i!==10);assert.equal(run([holding('a')],bundle('semiconductor',points()),bundle('cn-large',missing)).reports[0].relative20,null);
});
test('unavailable sources never produce technical or relative output and stale boundary is seven days',()=>{
 for(const data of [null,bundle('semiconductor',[]),bundle('semiconductor',points(),{status:'unavailable',error:'failure'})]){
  const report=run([holding('a')],data,bundle('cn-large',points())).reports[0];assert.equal(report.technical,null);assert.equal(report.relative20,null);assert.equal(report.stale,true);assert.equal(report.sourceError,true);
 }
 assert.equal(run([holding('a')],bundle('semiconductor',points()),null,[],'2026-10-28').reports[0].stale,false);
 assert.equal(run([holding('a')],bundle('semiconductor',points()),null,[],'2026-10-29').reports[0].stale,true);
 assert.equal(run([holding('a')],bundle('semiconductor',points()),null,[],'2026-10-20').reports[0].stale,true);
});
test('plan notes use overlapping explicit holding IDs only and cap summaries at three',()=>{
 const findings=Array.from({length:5},(_,i)=>({title:`规则${i}`,evidence:'用户规则证据',nextStep:'核对规则',holdingIds:[i===0?'other':'a']}));
 const report=run([holding('a')],null,null,findings).reports[0];assert.deepEqual(report.planNotes.map(n=>n.title),['规则1','规则2','规则3']);assert.ok(report.nextSteps.length);assert.doesNotMatch(report.nextSteps.join(' '),/买入|卖出|目标价/);
});
test('relative evidence has separate freshness and benchmark failure warnings',()=>{
 const newer=[...points(),{date:'2026-10-28',close:150,volume:100}];
 const report=run([holding('a')],bundle('semiconductor',newer),bundle('cn-large',points(100,0.5),{error:'failed'}),[],'2026-10-29').reports[0];
 assert.equal(report.stale,false);assert.equal(report.relativeStale,true);assert.equal(report.benchmarkError,true);
 assert.ok(report.notes.some(n=>n.includes('共同窗口')&&n.includes('过期')));assert.ok(report.notes.some(n=>n.includes('基准')&&n.includes('失败')));
});
test('expired or failed retained data stays in evidence but never generates directional next steps',()=>{
 const report=run([holding('a')],bundle('semiconductor',points(),{error:'synthetic failure'}),bundle('cn-large',points(100,0.5)),[],'2026-11-20').reports[0];assert.ok(report.technical);assert.ok(report.relative20);assert.doesNotMatch(report.nextSteps.join(' '),/代理收盘|RSI\(14\)|相对.*个百分点/);
});
