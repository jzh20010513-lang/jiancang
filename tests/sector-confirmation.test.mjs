import test from 'node:test';
import assert from 'node:assert/strict';
import * as sectors from '../src/sectors.mjs';
import {makeSnapshot,newHolding} from '../src/domain.mjs';
import {exportFull,defaultLayout,defaultPlanning} from '../src/transfer.mjs';
test('explicit batch save confirms selected mappings but never financial rows or untouched choices',()=>{
 assert.equal(typeof sectors.confirmSectorSelections,'function');
 const before=makeSnapshot([newHolding({name:'合成海外科技',marketValue:'100',sectorIds:['us-tech'],sectorReview:'unreviewed'}),newHolding({name:'合成自选',customSectorNames:['自选主题']}),newHolding({name:'尚未选择'}),newHolding({name:'明确无参考',sectorIds:[],sectorReview:'confirmed'})]);
 const result=sectors.confirmSectorSelections(before),after=result.snapshot;
 assert.equal(result.selectedCount,2);assert.equal(after.holdings[0].sectorReview,'confirmed');assert.equal(after.holdings[1].sectorReview,'confirmed');assert.deepEqual(after.holdings[1].sectorIds,[]);
 assert.equal(after.holdings[2].sectorReview,undefined);assert.equal(after.holdings[3].sectorReview,'confirmed');assert.ok(after.holdings.every(r=>r.reviewStatus==='needs_attention'&&r.currency===null));assert.equal(before.holdings[0].sectorReview,'unreviewed');
 assert.equal(sectors.analyzeSectors(after,null,null).reports.length,2);assert.ok(sectors.analyzeSectors(after,null,null).reports.every(r=>r.totals.length===0));exportFull(after,defaultLayout(),defaultPlanning());
});
test('batch save validates all mappings atomically',()=>{
 assert.equal(typeof sectors.confirmSectorSelections,'function');const before=makeSnapshot([newHolding({name:'first',sectorIds:['us-tech'],sectorReview:'unreviewed'}),newHolding({name:'bad',sectorIds:['invalid']})]);
 assert.throws(()=>sectors.confirmSectorSelections(before));assert.equal(before.holdings[0].sectorReview,'unreviewed');
});
