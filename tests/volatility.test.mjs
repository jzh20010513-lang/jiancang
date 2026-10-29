import test from 'node:test';
import assert from 'node:assert/strict';
import * as vix from '../src/volatility.mjs';
import * as source from '../scripts/vix-source.mjs';
const points=()=>Array.from({length:253},(_,i)=>({date:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),close:i<252?10:20}));
const record=()=>({source:vix.VIX_SOURCE,points:points(),status:'available',error:null});
const now='2026-09-11T22:00:00Z';
test('VIX parsing validates original OHLC, dates/order and never accepts arbitrary URLs',()=>{
 const csv='DATE,OPEN,HIGH,LOW,CLOSE\r\n10/26/2026,15,17,14,16\r\n10/27/2026,16,19,15,18\r\n';assert.equal(source.parseVixCsv(csv)[1].close,18);
 for(const bad of ['<html>bad</html>',csv.replace('10/27/2026','02/30/2026'),csv.replace('16,19,15,18','16,10,15,18'),csv+csv.split('\r\n')[2],csv.replace('16,19,15,18','16,19,15,Infinity')])assert.throws(()=>source.parseVixCsv(bad));
 assert.throws(()=>vix.validateVixRecord({...record(),source:{...vix.VIX_SOURCE,url:'https://evil.test'}}));
});
test('VIX is partial US broad equity evidence, never HK/CN or a directional trade score',()=>{
 const result=vix.describeVolatility(record(),{referenceId:'us-growth',now});assert.equal(result.state,'available');assert.equal(result.percentile252,100);assert.equal(result.ratio20,2);assert.match(result.summary,/波动/);assert.match(result.boundary,/标普500/);assert.match(result.boundary,/不.*涨跌|不.*方向/);assert.equal(result.score,undefined);
 for(const id of ['hk-tech-reference','medical','gold-us',null])assert.equal(vix.describeVolatility(record(),{referenceId:id,now}).state,'not-applicable');
});
test('missing, stale, failed and unfinished evidence does not produce current numbers',()=>{
 assert.equal(vix.describeVolatility(null,{referenceId:'us-growth',now}).state,'unavailable');
 assert.equal(vix.describeVolatility(record(),{referenceId:'us-growth',now:'2026-10-28T12:00:00Z'}).state,'unavailable');assert.equal(vix.describeVolatility({...record(),error:'failed'},{referenceId:'us-growth',now}).level,null);
 const sameDay={...record(),points:[{date:'2026-10-28',close:20}]};assert.equal(vix.describeVolatility(sameDay,{referenceId:'us-growth',now:'2026-10-28T20:59:00Z'}).level,null);assert.equal(vix.describeVolatility(sameDay,{referenceId:'us-growth',now:'2026-10-28T21:00:00Z'}).level,20);
});
test('short series do not invent percentiles or 20 sample means; failed update preserves dated provenance',()=>{
 const r={...record(),points:points().slice(-2)};const short=vix.describeVolatility(r,{referenceId:'us-growth',now});assert.equal(short.percentile252,null);assert.equal(short.ratio20,null);
 const failed=vix.updateVixRecord(record(),null);assert.deepEqual(failed.points,record().points);assert.notEqual(failed.error,null);assert.equal(vix.describeVolatility(failed,{referenceId:'us-growth',now}).state,'unavailable');
});
test('only the bounded recent OHLC window is consumed; malformed recent history is rejected',()=>{
 const rows=Array.from({length:260},(_,i)=>{const d=new Date(Date.UTC(2026,0,i+1));return `${String(d.getUTCMonth()+1).padStart(2,'0')}/${String(d.getUTCDate()).padStart(2,'0')}/${d.getUTCFullYear()},15,17,14,16`;});rows[0]=rows[0].replace('15,17,14,16','15,12,14,16');assert.equal(source.parseVixCsv('DATE,OPEN,HIGH,LOW,CLOSE\n'+rows.join('\n')).length,254);rows[259]=rows[259].replace('15,17,14,16','15,12,14,16');assert.throws(()=>source.parseVixCsv('DATE,OPEN,HIGH,LOW,CLOSE\n'+rows.join('\n')));
});
test('data validation rejects future, sparse, duplicate and accessor values without executing them',()=>{
 for(const change of [r=>r.points.push(r.points.at(-1)),r=>r.points=[{date:'2026-10-29',close:20}],r=>r.points[0].extra=true,r=>r.points=new Array(2)]){const r=record();change(r);assert.throws(()=>vix.validateVixRecord(r,{maxDate:'2026-10-28'}));}
 const r=record();Object.defineProperty(r.points[0],'close',{get(){throw Error('getter ran');}});assert.throws(()=>vix.validateVixRecord(r),/数据格式无效/);
});
