import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCandidates} from '../src/ocr.mjs';
const header='名称/金额 日收益 持有收益 累计收益';
test('combined name/value column pairs fund title above badges with first amount, never ratio below',()=>{
 const rows=parseCandidates(`${header}\n合成现金产品\n灵活取用\n1,234.56 +0.12 +34.56\n占 比 12.34%\n合成全球精选股票(QDII)C\n基金，进阶理财\n2,345.67 +12.34 +23.45 +56.78\n占比 23.45% +1.01%\n合成港股科技ETF联接C\n基金 进阶理财\n3,456.78 -12.34 -56.78 -78.90\n占比34.56% -1.23%`);
 assert.deepEqual(rows.map(r=>[r.name,r.marketValue]),[['合成现金产品','1234.56'],['合成全球精选股票(QDII)C','2345.67'],['合成港股科技ETF联接C','3456.78']]);
 assert.ok(rows.every(r=>r.currency===null&&r.asOfDate===null&&r.reviewStatus==='needs_attention'));
});
test('ratio and other interface labels never become assets even after ordinary table header',()=>{
 for(const text of [`${header}\n占比12.34% +3.21%`,`名称 金额\n占比 12.34%\n进阶理财 123.45`,`产品名称：占比\n持仓金额：100`])assert.deepEqual(parseCandidates(text),[]);
});
test('missing money in a fund block stays missing instead of shifting profit into amount',()=>{
 const rows=parseCandidates(`${header}\n合成股票指数A\n基金，进阶理财\n+12.34 +23.45 +34.56\n占比 12.34%\n合成股票指数C\n基金，进阶理财\n12.34 23.45 34.56\n占比 23.45%`);
 assert.equal(rows.length,2);assert.ok(rows.every(r=>r.marketValue===null));assert.deepEqual(rows.map(r=>r.name),['合成股票指数A','合成股票指数C']);
});
test('explicit amount header unit is used, but current time, ratio, UI badges are not metadata',()=>{
 const rows=parseCandidates('名称/金额(万元) 日收益 持有收益 累计收益\n合成债券A\n基金，进阶理财\n2.5 +0.12 +0.23 +0.34\n占比 34.56%');
 assert.equal(rows[0].marketValue,'25000');assert.equal(rows[0].currency,'CNY');assert.equal(rows[0].asOfDate,null);
});
test('only explicit short share-class continuation may join an Alipay name',()=>{
 const rows=parseCandidates(`${header}\n合成股票ETF联接\nC\n基金，进阶理财\n123.45 +0.12 +0.23 +0.34\n占比1.2%`);
 assert.equal(rows[0].name,'合成股票ETF联接C');assert.equal(rows[0].marketValue,'123.45');
});
test('Chinese OCR spaces around badge commas cannot replace the preceding fund name',()=>{
 const rows=parseCandidates(`名 称 /金 额 日 收 益 持 有 收 益 累 计 收 益\n合 成 股 票 基 金 C\n基 金 ， 进 阶 理财\n1,234.56 +12.34 +23.45 +34.56\n占 比 12.34% +2.3%`);
 assert.equal(rows.length,1);assert.equal(rows[0].name.replaceAll(' ',''),'合成股票基金C');assert.equal(rows[0].marketValue,'1234.56');
});
test('legitimate income fund name is a new card and cannot lend money to an incomplete prior fund',()=>{
 const rows=parseCandidates(`${header}\n合成科技股票A\n+1.00 +2.00 +3.00\n合成稳健收益债券C\n2000.00 +4.00 +5.00 +6.00`);
 assert.deepEqual(rows.map(r=>[r.name,r.marketValue]),[['合成科技股票A',null],['合成稳健收益债券C','2000.00']]);
});
test('duplicate full numeric lines under one fund make the amount ambiguous',()=>{
 const rows=parseCandidates(`${header}\n合成科技股票A\n1000.00 +1.00 +2.00 +3.00\n2000.00 +4.00 +5.00 +6.00\n占比12.34%`);
 assert.equal(rows.length,1);assert.equal(rows[0].marketValue,null);
});
test('each combined header resets unit and its currency evidence',()=>{
 const rows=parseCandidates('名称/金额(元) 日收益 持有收益 累计收益\n合成债券A\n1000 +1 +2 +3\n名称/金额(万元) 日收益 持有收益 累计收益\n合成股票C\n2 +1 +2 +3\n名称/金额 日收益 持有收益 累计收益\n合成混合A\n3 +1 +2 +3');
 assert.deepEqual(rows.map(r=>[r.name,r.marketValue,r.currency]),[['合成债券A','1000','CNY'],['合成股票C','20000','CNY'],['合成混合A','3',null]]);
});
test('a ratio closes the preceding card and cannot attach a later orphan amount',()=>{
 const rows=parseCandidates(`${header}\n合成科技股票A\n+1 +2 +3\n占比12.34%\n2000 +4 +5 +6`);
 assert.equal(rows.length,1);assert.equal(rows[0].marketValue,null);
});
