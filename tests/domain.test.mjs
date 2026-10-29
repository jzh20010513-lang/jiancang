import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount, newHolding, makeSnapshot, aggregate, selectRows } from '../src/domain.mjs';

test('amounts normalize exact decimals, grouped separators and Chinese units', () => {
  for (const [input, value] of [['1,234.50','1234.5'],['0.1','0.1'],['1.23456789','1.23456789'],['1.25万','12500'],['-2亿','-200000000'],['-0.00','0'],['1000000000000000','1000000000000000']]) assert.equal(parseAmount(input),value);
});
test('malformed, missing, excessive precision and overflow amounts are rejected', () => {
  for (const input of ['',null,undefined,NaN,Infinity,'1e2','1,23','12,3456','1.2.3','1万亿','1000000000000000.00000001','0.000000001','--1','￥12','1 234']) assert.equal(parseAmount(input),null,String(input));
});
test('new rows are pending and snapshots preserve explicit references', () => {
  const row=newHolding({name:'甲',tagIds:['tag'],categoryId:'cat'});
  assert.equal(row.reviewStatus,'needs_attention');
  const snapshot=makeSnapshot([row],{accounts:[{id:row.accountId,alias:'自定义'}],categories:[{id:'cat',name:'类别'}],tags:[{id:'tag',name:'标签'}]});
  assert.equal(snapshot.accounts[0].alias,'自定义'); assert.equal(snapshot.holdings[0].id,row.id);
});
const confirmed=(overrides={})=>newHolding({name:'合成资产',marketValue:'0.1',currency:'CNY',reviewStatus:'confirmed',asOfDate:'2026-10-01',...overrides});
test('aggregation adds exact amounts, separates currencies and excludes unsupported rows',()=>{
  const s=makeSnapshot([confirmed(),confirmed({marketValue:'0.2'}),confirmed({currency:'USD',marketValue:'8'}),confirmed({marketValue:'-1'}),confirmed({name:''}),newHolding({marketValue:'9',currency:'CNY'}),confirmed({currency:null})]);
  const a=aggregate(s); assert.equal(a.currencies.find(c=>c.currency==='CNY').total,'0.3'); assert.equal(a.currencies.find(c=>c.currency==='USD').total,'8'); assert.equal(a.excluded,4);assert.equal(a.filteredCount,7);
});
test('filters change denominator, dates mark mixed and unknown and equal names stay separate',()=>{
 const s=makeSnapshot([confirmed({marketValue:'3',accountId:'a',asOfDate:null}),confirmed({marketValue:'1',accountId:'b',asOfDate:'2026-10-02'}),confirmed({marketValue:'4',accountId:'b',asOfDate:'2026-10-03'})]);
 const a=aggregate(s,{accountId:'b'});assert.equal(a.currencies[0].total,'5');assert.equal(a.currencies[0].largest.percent,80);assert.equal(a.currencies[0].rows.length,2);assert.deepEqual(a.dates,['2026-10-02','2026-10-03']);assert.equal(aggregate(s).unknownDate,true);
});
test('zero denominator has no percentages and pnl never affects asset totals',()=>{
 const a=aggregate(makeSnapshot([confirmed({marketValue:'0',reportedHoldingPnl:'999'})]));assert.equal(a.currencies[0].accounts[0].percent,null);assert.equal(a.currencies[0].largest.percent,null);assert.equal(a.currencies[0].total,'0');
});
test('only explicit asset groups combine concentration',()=>{
 const a=aggregate(makeSnapshot([confirmed({marketValue:'3',assetGroupId:'g'}),confirmed({marketValue:'2',assetGroupId:'g'}),confirmed({marketValue:'4'})]));assert.equal(a.currencies[0].largest.value,'5');assert.equal(a.currencies[0].largest.percent,55.56);
});
test('selectRows shares trimmed metadata-aware filtering with aggregate',()=>{
 const first=confirmed({accountId:'a',name:'甲',code:'TEST-A',categoryId:'fund',tagIds:['focus']});const second=newHolding({accountId:'b',name:'乙'});
 const s=makeSnapshot([first,second],{accounts:[{id:'a',alias:'投资账户'},{id:'b',alias:'储备账户'}],categories:[{id:'fund',name:'基金'}],tags:[{id:'focus',name:'关注'}]});
 assert.deepEqual(selectRows(s,{query:'   '}),s.holdings);
 for(const query of [' 投资账户 ','test-a','基金','关注','甲']){const filters={query};assert.deepEqual(selectRows(s,filters),[s.holdings[0]]);assert.equal(aggregate(s,filters).filteredCount,selectRows(s,filters).length);}
 assert.deepEqual(selectRows(s,{accountId:'b',query:'甲'}),[]);assert.deepEqual(selectRows(s,{categoryId:'fund',tagId:'focus'}),[s.holdings[0]]);
 assert.deepEqual(selectRows(s,{query:'储备账户'}),[s.holdings[1]]);assert.equal(aggregate(s,{query:'储备账户'}).excluded,1);
});
