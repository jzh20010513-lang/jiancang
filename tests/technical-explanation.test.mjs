import test from 'node:test';
import assert from 'node:assert/strict';
import * as explain from '../src/technical-explanation.mjs';
const bars=closes=>closes.map((close,i)=>({date:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),close,volume:100}));
const down=()=>Array.from({length:80},(_,i)=>200-i);
test('explains trend position and direction with explicit daily scope',()=>{
 const r=explain.explainTechnical(bars(down()));assert.equal(r.trend.state,'weak');assert.match(r.trend.text,/均线/);assert.match(r.summary,/偏弱|下跌/);assert.match(r.period,/日线/);assert.match(r.weekly,/周线.*(?:不足|未确认)/);
});
test('shrinking negative MACD bars are easing, never a confirmed reversal',()=>{
 const r=explain.explainTechnical(bars([...Array.from({length:80},(_,i)=>200-i*i*.01),137.5]));assert.equal(r.momentum.state,'easing');assert.match(r.summary,/反弹|减弱/);assert.match(r.summary,/尚未|仍|不能/);assert.notEqual(r.trend.state,'strong');
});
test('MACD cross and zero crossing are separate facts; 60 bars cannot establish a crossing',()=>{
 const r=explain.explainTechnical(bars([...down(),121,122,125,130,135]));assert.equal(r.momentum.aboveZero,false);assert.match(r.momentum.text,/零轴下方/);
 const short=explain.explainTechnical(bars(down().slice(0,60)));assert.equal(short.momentum.cross,null);
});
test('actual signal crossing below zero does not imply a zero-axis crossing',()=>{
 const prices=[...down(),...Array.from({length:25},(_,i)=>122+i*3)];const results=prices.map((_,i)=>i>=80?explain.explainTechnical(bars(prices.slice(0,i+1))):null).filter(Boolean);
 const golden=results.find(r=>r.momentum.cross==='golden');assert.ok(golden);assert.equal(golden.momentum.aboveZero,false);assert.equal(golden.momentum.zeroCross,null);
 const zero=results.find(r=>r.momentum.zeroCross==='up');assert.ok(zero);assert.equal(zero.momentum.cross,null);
});
test('price below rising averages is a conflict, not a uniform downtrend',()=>{
 const prices=Array.from({length:80},(_,i)=>100+i);prices.push(140);const r=explain.explainTechnical(bars(prices));assert.equal(r.trend.state,'mixed');assert.match(r.summary,/一致|分歧/);
});
test('volume describes trading only, missing volume is unknown and flat price is not bullish',()=>{
 const points=bars(Array(80).fill(10));points.at(-1).volume=200;const r=explain.explainTechnical(points);assert.equal(r.volume.ratio,2);assert.match(r.volume.text,/2.00倍/);assert.notEqual(r.trend.state,'strong');assert.match(r.volume.text,/不.*主力|不.*资金/);
 points.at(-2).volume=null;assert.equal(explain.explainTechnical(points).volume.ratio,null);
});
test('unusable or insufficient evidence never produces current trend assertions',()=>{
 const r=explain.explainTechnical(bars(down()),{usable:false,reason:'刷新失败'});assert.equal(r.state,'unavailable');assert.match(r.summary,/刷新失败/);assert.equal(r.momentum.cross,null);
 assert.equal(explain.explainTechnical([]).state,'insufficient');
});
