import test from 'node:test';
import assert from 'node:assert/strict';
import {newHolding,makeSnapshot} from '../src/domain.mjs';
import {exportFull,validateExport,defaultLayout,defaultPlanning,exportLayout} from '../src/transfer.mjs';
import {analyzeSectors} from '../src/sectors.mjs';
const snapshot=fields=>makeSnapshot([newHolding({name:'合成海外股票',marketValue:'100',currency:'USD',reviewStatus:'confirmed',sectorIds:['us-tech'],sectorReview:'confirmed',...fields})]);
test('US tech classification roundtrips without adding a fake ETF data source',()=>{
 const s=snapshot({});const b=exportFull(s,defaultLayout(),defaultPlanning());assert.deepEqual(validateExport(JSON.stringify(b)).snapshot.holdings[0].sectorIds,['us-tech']);
 const report=analyzeSectors(s,null,null).reports[0];assert.equal(report.name,'美股科技');assert.equal(report.dataStatus,'unavailable');assert.equal(report.technical,null);assert.equal(report.relative20,null);assert.equal(report.sourceError,true);assert.equal(report.benchmarkError,true);assert.ok(report.notes.some(n=>n.includes('纯科技')));assert.ok(report.notes.every(n=>!n.includes('沪深300')));
});
test('custom labels roundtrip and aggregate locally without an invented source',()=>{
 const s=snapshot({sectorIds:[],customSectorNames:['自选海外主题']});const b=exportFull(s,defaultLayout(),defaultPlanning());assert.deepEqual(validateExport(b).snapshot.holdings[0].customSectorNames,['自选海外主题']);
 const a=analyzeSectors(s,null,null);assert.equal(a.explicitNoneCount,0);assert.equal(a.reports.length,1);assert.equal(a.reports[0].name,'自选海外主题');assert.equal(a.reports[0].dataStatus,'classification-only');assert.deepEqual(a.reports[0].totals,[{currency:'USD',value:'100'}]);
 assert.doesNotMatch(JSON.stringify(exportLayout(defaultLayout())),/自选海外|customSectorNames|sectorIds/);
});
test('combined selection limit and strict custom text fields are enforced',()=>{
 for(const fields of [{sectorIds:['us-tech','medical'],customSectorNames:['甲主题','乙主题']},{sectorIds:[],customSectorNames:['重复','重复']},{sectorIds:[],customSectorNames:['']},{sectorIds:[],customSectorNames:['a'.repeat(41)]},{sectorIds:[],customSectorNames:'invalid'}])assert.throws(()=>exportFull(snapshot(fields),defaultLayout(),defaultPlanning()));
});
