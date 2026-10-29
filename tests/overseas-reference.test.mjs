import test from 'node:test';
import assert from 'node:assert/strict';
import {SECTOR_CATALOG} from '../src/sector-catalog.mjs';
import * as refresh from '../scripts/refresh-sectors.mjs';
import {validateSectorBundle} from '../src/sector-data.mjs';
import {normalizeSectorForBuild} from '../scripts/prepare-sectors.mjs';
import {analyzeSectors} from '../src/sectors.mjs';
const bar=date=>({date,open:100,high:102,low:98,close:101,volume:null});
const cn=()=>({schemaVersion:1,mode:'public-snapshot',generatedAt:'2026-10-28T00:00:00.000Z',records:SECTOR_CATALOG.filter(i=>i.market==='CN').map(i=>({id:i.id,points:[bar('2026-10-27')],source:i.source,status:'available',error:null}))});
test('overseas references have matched benchmarks and explicit non-fund identity',()=>{
 const us=SECTOR_CATALOG.find(i=>i.id==='us-growth'),hk=SECTOR_CATALOG.find(i=>i.id==='hk-tech-reference');assert.ok(us&&hk);assert.equal(us.benchmarkId,'us-broad');assert.equal(hk.benchmarkId,'hk-broad');assert.equal(us.unit,'点');assert.match(us.boundary,/纯科技/);
 const s={holdings:[{id:'u',name:'合成海外',sectorReview:'confirmed',sectorIds:['us-tech'],currency:'CNY',marketValue:'1',reviewStatus:'confirmed'}]};const r=analyzeSectors(s,null,null).reports[0];assert.equal(r.reference.id,'us-growth');assert.ok(r.notes.every(n=>!n.includes('沪深300')));
});
test('legacy three-CN package is validated and migrated offline, not silently marked fresh',()=>{
 assert.equal(validateSectorBundle(cn()).records.length,3);const next=normalizeSectorForBuild(JSON.stringify(cn()));assert.equal(next.records.length,5);const us=next.records.find(r=>r.id==='us-growth');assert.equal(us.status,'unavailable');assert.equal(us.points.length,0);assert.throws(()=>validateSectorBundle({...cn(),records:cn().records.slice(0,2)}));
});
test('daily completion uses source timezone and DST rather than China date',()=>{
 const p=[bar('2026-10-27'),bar('2026-10-28')];assert.equal(refresh.completedSectorPoints(p,'2026-10-28T20:59:00Z','us-growth').length,1);assert.equal(refresh.completedSectorPoints(p,'2026-10-28T21:00:00Z','us-growth').length,2);
 const winter=[bar('2026-11-03')];assert.equal(refresh.completedSectorPoints(winter,'2026-11-03T21:59:00Z','us-growth').length,0);assert.equal(refresh.completedSectorPoints(winter,'2026-11-03T22:00:00Z','us-growth').length,1);
 assert.equal(refresh.completedSectorPoints(p,'2026-10-28T08:59:00Z','hk-tech-reference').length,1);assert.equal(refresh.completedSectorPoints(p,'2026-10-28T09:00:00Z','hk-tech-reference').length,2);
});
test('weekly conservative cutoff excludes current week until source-local weekend, including short weeks',()=>{
 const p=[bar('2026-10-23'),bar('2026-10-28')];assert.deepEqual(refresh.completedWeeklyPoints(p,'2026-10-30T23:00:00Z','us-growth').map(p=>p.date),['2026-10-23']);assert.equal(refresh.completedWeeklyPoints(p,'2026-10-31T04:00:00Z','us-growth').length,2);
 const holiday=[bar('2026-12-24')];assert.equal(refresh.completedWeeklyPoints(holiday,'2026-12-26T05:00:00Z','us-growth').length,1);
 assert.throws(()=>refresh.completedWeeklyPoints([bar('2026-10-27'),bar('2026-10-28')],'2026-10-31T04:00:00Z','us-growth'));
});
test('overseas parsing accepts known series only and suppresses unverified index volume',()=>{
 const raw=JSON.stringify({code:0,data:{usNDX:{week:[['2026-10-23','100','101','102','98','123']]}}});const p=refresh.parseTencentSectorWeekly(raw,'usNDX');assert.equal(p[0].volume,null);assert.throws(()=>refresh.parseTencentSectorWeekly(raw,'untrusted'));assert.throws(()=>refresh.parseTencentSectorDaily(raw,'usNDX'));
});
test('analysis independently excludes unfinished same-day overseas bars',()=>{
 const data=refresh.updateSectorSnapshot(null,new Map([['us-growth',{points:[bar('2026-10-27'),bar('2026-10-28')]}]]),'2026-10-28T00:00:00.000Z');const s={holdings:[{id:'u',sectorReview:'confirmed',sectorIds:['us-tech'],currency:'CNY',marketValue:'100',reviewStatus:'confirmed'}]};
 assert.equal(analyzeSectors(s,data,null,[],{today:'2026-10-28',now:'2026-10-28T20:59:00Z'}).reports[0].technical.lastDate,'2026-10-27');assert.equal(analyzeSectors(s,data,null,[],{today:'2026-10-28',now:'2026-10-28T21:00:00Z'}).reports[0].technical.lastDate,'2026-10-28');
});
test('weekly source validation and independent refresh failure preserve provenance',()=>{
 const old=refresh.updateSectorSnapshot(cn(),new Map([['us-growth',{points:[bar('2026-10-27')],weeklyPoints:[bar('2026-10-23')]}]]),'2026-10-28T00:00:00.000Z');
 const next=refresh.updateSectorSnapshot(old,new Map([['us-growth',{points:[bar('2026-10-28')]}]]),'2026-10-28T22:00:00.000Z');const us=next.records.find(r=>r.id==='us-growth');assert.equal(us.error,null);assert.notEqual(us.weekly.error,null);assert.equal(us.weekly.points[0].date,'2026-10-23');
 for(const mutate of [r=>r.weekly.source.url='https://untrusted.test',r=>r.weekly.points.push(bar('2026-10-22')),r=>r.weekly.extra=true]){const copy=structuredClone(old);mutate(copy.records.find(r=>r.id==='us-growth'));assert.throws(()=>validateSectorBundle(copy));}
 const now='2027-01-02T05:00:00Z';assert.equal(refresh.completedWeeklyPoints([bar('2026-12-31')],now,'us-growth').length,1);
});
test('weekly explanation is independent and does not compare overseas reference to CN benchmark',()=>{
 const prices=Array.from({length:80},(_,i)=>{const d=new Date('2026-10-23T00:00:00Z');d.setUTCDate(d.getUTCDate()-7*(79-i));return {...bar(d.toISOString().slice(0,10)),open:100+i,high:102+i,low:98+i,close:101+i};});
 const data=refresh.updateSectorSnapshot(null,new Map([['us-growth',{points:[bar('2026-10-27')],weeklyPoints:prices}]]),'2026-10-28T00:00:00.000Z');
 const s={holdings:[{id:'u',sectorReview:'confirmed',sectorIds:['us-tech'],currency:'CNY',marketValue:'100',reviewStatus:'confirmed'}]};
 const r=analyzeSectors(s,data,null,[],{today:'2026-10-28',now:'2026-10-28T06:00:00Z'}).reports[0];assert.equal(r.weeklyExplanation.state,'available');assert.match(r.weeklyExplanation.period,/周线/);assert.equal(r.benchmarkName,'标普500');assert.equal(r.technicalExplanation.state,'insufficient');
 data.records.find(r=>r.id==='us-growth').weekly.error='failed';assert.equal(analyzeSectors(s,data,null,[],{today:'2026-10-28',now:'2026-10-28T06:00:00Z'}).reports[0].weeklyExplanation.state,'unavailable');
 const weeklyOnly=refresh.updateSectorSnapshot(null,new Map([['us-growth',{weeklyPoints:prices}]]),'2026-10-28T00:00:00.000Z');const independent=analyzeSectors(s,weeklyOnly,null,[],{today:'2026-10-28',now:'2026-10-28T06:00:00Z'}).reports[0];assert.equal(independent.technical,null);assert.equal(independent.weeklyExplanation.state,'available');
});
