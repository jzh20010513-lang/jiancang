import test from 'node:test';
import assert from 'node:assert/strict';
import {newHolding,makeSnapshot} from '../src/domain.mjs';
import {defaultLayout,defaultPlanning} from '../src/transfer.mjs';
import {renderSectorObservation} from '../src/sector-view.mjs';
const snapshot=()=>makeSnapshot([newHolding({name:'<img src=x onerror=alert(1)>',categoryId:'权益',currency:'CNY',marketValue:'128000',reviewStatus:'confirmed',asOfDate:'2026-10-26',sectorIds:['medical'],sectorReview:'confirmed'})]);
test('sector evidence escapes holdings and masks product amounts and linked personal rule evidence',()=>{
 const p=defaultPlanning();p.plan.rules=[{currency:'CNY',allocations:[],deviationThreshold:'5',maxSinglePercent:'40',requiredLiquid:null,needBy:null}];
 const html=renderSectorObservation(snapshot(),p,{...defaultLayout(),mask:true},null,null,'error','error');
 assert.doesNotMatch(html,/<img |128000|128,000/);assert.match(html,/&lt;img/);assert.match(html,/金额已隐藏/);assert.match(html,/情绪证据不足/);
 assert.doesNotMatch(html,/class="technical-value"/);
});
test('homepage next step prioritizes triggered user rule and demo mapping provenance is explicit',()=>{
 const p=defaultPlanning();p.dataKind='demo';p.plan.rules=[{currency:'CNY',allocations:[],deviationThreshold:'5',maxSinglePercent:'40',requiredLiquid:null,needBy:null}];
 const html=renderSectorObservation(snapshot(),p,defaultLayout(),null,null,'error');
 const first=html.match(/<p class="guidance-action">([\s\S]*?)<\/p>/)?.[1]||'';
 assert.match(first,/核对分组和完整持仓/);assert.match(html,/示例关联为人为设定/);
});
test('failed sector refresh with retained data cannot drive current personal guidance',()=>{
 const p=defaultPlanning();p.plan.riskProfile={lossTolerancePercent:'1',needBy:null,sectorCapPercent:null};
 const points=Array.from({length:60},(_,i)=>({date:new Date(Date.now()-(59-i)*86400000).toISOString().slice(0,10),close:100-i,volume:100}));
 const bundle={records:[{id:'medical',status:'available',error:null,points}]};
 const html=renderSectorObservation(snapshot(),p,defaultLayout(),bundle,null,'error');
 assert.doesNotMatch(html,/data-guidance="(?:risk|technical)"/);assert.match(html,/专属技术证据不足或已过期/);
});
test('observation checklist never revives directional advice during reload or failure',()=>{
 const points=Array.from({length:80},(_,i)=>({date:new Date(Date.now()-(80-i)*86400000).toISOString().slice(0,10),close:100-i,volume:100}));const bundle={records:[{id:'medical',status:'available',error:null,points}]};
 for(const status of ['loading','error']){const html=renderSectorObservation(snapshot(),defaultPlanning(),defaultLayout(),bundle,null,status);const list=html.match(/<h4>下一步观察<\/h4><ul>([\s\S]*?)<\/ul>/)?.[1]||'';assert.doesNotMatch(list,/代理收盘|RSI\(14\)|相对.*个百分点/);assert.match(html,/MA20/);}
});
