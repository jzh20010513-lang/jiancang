import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePlan,defaultPlan} from '../src/checkup.mjs';
import {exportFull,validateExport,defaultLayout,defaultPlanning} from '../src/transfer.mjs';
import {makeSnapshot,newHolding} from '../src/domain.mjs';
import * as guidance from '../src/sector-guidance.mjs';
import {renderGuidance} from '../src/sector-guidance-view.mjs';
const profile={lossTolerancePercent:'10',needBy:'2027-02-01',sectorCapPercent:'30'};
const row=(name,value,more={})=>newHolding({name,marketValue:value,currency:'CNY',reviewStatus:'confirmed',asOfDate:'2026-10-27',sectorReview:'confirmed',sectorIds:['us-tech'],...more});
const snapshot=()=>makeSnapshot([row('合成科技','40'),row('合成其他','60',{sectorIds:[]})]);
const report={id:'us-tech',holdingIds:[],technical:null,relative20:null,stale:false,sourceError:false,relativeStale:false,benchmarkError:false};
const run=(s=snapshot(),p=profile,r=report)=>guidance.analyzeSectorGuidance(s,r,p,{today:'2026-10-27'});
test('risk profile strictly validates and survives full backup; old plans remain unchanged',()=>{
 const plan=validatePlan({...defaultPlan(),riskProfile:profile});assert.deepEqual(plan.riskProfile,profile);
 const backup=exportFull(snapshot(),defaultLayout(),{...defaultPlanning(),plan});assert.deepEqual(validateExport(backup).planning.plan.riskProfile,profile);assert.deepEqual(validatePlan(defaultPlan()),defaultPlan());
 for(const bad of [{...profile,sectorCapPercent:'101'},{...profile,lossTolerancePercent:'-1'},{...profile,needBy:'2027-02-30'},{...profile,extra:true}])assert.throws(()=>validatePlan({...defaultPlan(),riskProfile:bad}));
});
test('personal cap drives actionable guidance without requiring sector market feeds',()=>{
 const r=run();assert.equal(r.priority,'cap');assert.equal(r.allocations[0].percent,40);assert.equal(r.allocations[0].overCap,true);assert.match(r.action,/重复|目标|上限/);assert.match(r.context,/10%/);assert.match(r.sentiment,/不足|未接入/);
});
test('near-term money takes priority over bullish technical signals and empty preferences are not guessed',()=>{
 assert.equal(run(snapshot(),{...profile,sectorCapPercent:null}).priority,'liquidity');assert.equal(run(snapshot(),null).priority,'profile');
});
test('pending and mixed currencies constrain denominator without silently inferring holdings',()=>{
 const s=snapshot();s.holdings.push(row('待核对','900',{reviewStatus:'needs_attention',currency:null}),row('合成美元','10',{currency:'USD'}));const r=run(s);assert.deepEqual(r.allocations.map(a=>[a.currency,a.percent]),[['CNY',40],['USD',100]]);assert.equal(r.incomplete,true);assert.match(r.caveat,/待|不完整/);
 const zero=run(makeSnapshot([row('零','0')]));assert.equal(zero.allocations[0].percent,null);assert.equal(zero.priority,'data');
});
test('stale technical signals do not drive directional actions and valid weak signals do',()=>{
 const p={...profile,needBy:null,sectorCapPercent:null};const weak={...report,technical:{lastClose:5,ma20:10,ma60:12,lastDate:'2026-10-27'}};
 assert.equal(run(snapshot(),p,weak).priority,'technical');assert.notEqual(run(snapshot(),p,{...weak,stale:true}).priority,'technical');
});
test('a mixed trend explanation prevents legacy price-only weakness advice',()=>{
 const p={...profile,needBy:null,sectorCapPercent:null};const weak={...report,technical:{lastClose:5,ma20:10,ma60:12,lastDate:'2026-10-27'},technicalExplanation:{trend:{state:'mixed'},summary:'价格位置与均线方向有分歧。'}};
 assert.notEqual(run(snapshot(),p,weak).priority,'technical');assert.match(run(snapshot(),p,weak).technical,/分歧/);
});
test('loss willingness is compared only to fresh proxy history and zero means no loss acceptance',()=>{
 const p={...profile,needBy:null,sectorCapPercent:null};const r={...report,technical:{lastClose:10,ma20:9,ma60:8,maxDrawdown20:-20,lastDate:'2026-10-27'}};
 assert.equal(run(snapshot(),p,r).priority,'risk');assert.notEqual(run(snapshot(),p,{...r,sourceError:true}).priority,'risk');assert.equal(run(snapshot(),{...p,lossTolerancePercent:'0'},report).priority,'risk');assert.equal(run(snapshot(),{...p,lossTolerancePercent:null},r).priority,'profile');
});
test('masked guidance never exposes personal percentages or scenario amounts and markup escapes custom text',()=>{
 const r=run();const html=renderGuidance(r,{mask:true});assert.doesNotMatch(html,/40.00%|30%|10%|假设波动金额 10|优先检查板块集中度/);assert.match(html,/data-guidance="masked"/);assert.match(renderGuidance({...r,action:'<script>test</script>'},{mask:false}),/&lt;script&gt;/);
});
