import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultMarketPreferences,validateMarketPreferences,validateBenchmarkIds,relatedMarkets,validateMarketBundle,marketSeries} from '../src/markets.mjs';
import {MARKET_CATALOG} from '../src/market-catalog.mjs';

test('market preferences validate known unique IDs and return isolated copies',()=>{
 const prefs=defaultMarketPreferences();prefs.pinned.push('gold-us');assert.deepEqual(defaultMarketPreferences(),{pinned:[],hidden:[],order:[]});
 const valid={pinned:['gold-us'],hidden:[],order:['gold-us','cn-large']};const result=validateMarketPreferences(valid);result.pinned.pop();assert.deepEqual(valid.pinned,['gold-us']);
 for(const bad of [{...valid,unknown:1},{...valid,pinned:['bogus']},{...valid,order:['gold-us','gold-us']},Object.assign(Object.create({}),valid)])assert.throws(()=>validateMarketPreferences(bad));
});
test('benchmark and preferences reject executable, sparse and extended arrays without invoking getters',()=>{
 let calls=0;const getter=[];Object.defineProperty(getter,'0',{get(){calls++;return 'cn-large';}});
 const extra=['cn-large'];extra.secret='private';
 for(const bad of [getter,extra,Array(1),['cn-large','cn-large'],['cn-large','cn-growth','us-tech','gold-us'],null])assert.throws(()=>validateBenchmarkIds(bad));
 const prefs={hidden:[],order:[]};Object.defineProperty(prefs,'pinned',{get(){calls++;return [];}});assert.throws(()=>validateMarketPreferences(prefs));assert.equal(calls,0);
 assert.deepEqual(validateBenchmarkIds(['cn-large','gold-us']),['cn-large','gold-us']);
});
test('only explicitly confirmed mappings relate holdings, retaining financial review and unmapped counts',()=>{
 const snapshot={holdings:[{id:'a',name:'A',reviewStatus:'needs_attention',benchmarkReview:'confirmed',benchmarkIds:['cn-large','us-tech']},{id:'b',name:'B',reviewStatus:'confirmed',benchmarkReview:'unreviewed',benchmarkIds:['gold-us']},{id:'c',name:'现金',benchmarkReview:'confirmed',benchmarkIds:[]},{id:'d',name:'美元',currency:'USD'}]};
 const before=structuredClone(snapshot);const out=relatedMarkets(snapshot,{pinned:['gold-us','cn-large'],hidden:['us-tech'],order:['gold-us']});
 assert.deepEqual(out,{markets:[{id:'gold-us',reason:'pinned',holdings:[]},{id:'cn-large',reason:'both',holdings:[{id:'a',name:'A',reviewStatus:'needs_attention'}]}],unmappedCount:2,explicitNoneCount:1,hiddenRelatedCount:1});assert.deepEqual(snapshot,before);
});
test('related holdings follow catalog order and all linked rows are preserved',()=>{
 const out=relatedMarkets({holdings:[{id:'a',name:'A',reviewStatus:'confirmed',benchmarkReview:'confirmed',benchmarkIds:['us-tech','cn-large']},{id:'b',name:'B',reviewStatus:'needs_attention',benchmarkReview:'confirmed',benchmarkIds:['cn-large']}]});
 assert.deepEqual(out.markets.map(x=>[x.id,x.reason,x.holdings.length]),[['cn-large','holding',2],['us-tech','holding',1]]);
});
test('daily samples retain observed dates, calculate adjacent close change and stale state',()=>{
 const points=Array.from({length:280},(_,i)=>({date:new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10),close:100+i}));
 const record={points};const out=marketSeries(record,'1m',new Date('2026-10-10T00:00:00Z'));
 assert.equal(out.points.length,21);assert.equal(out.startDate,'2026-09-17');assert.equal(out.endDate,'2026-10-07');assert.equal(out.dataDate,'2026-10-07');assert.equal(out.lastClose,379);assert.equal(out.changePercent,(379/378-1)*100);assert.equal(out.stale,false);
 assert.equal(marketSeries(record,'3m').points.length,63);assert.equal(marketSeries(record,'1y').points.length,250);assert.equal(marketSeries(record,'1m',new Date('2026-10-15')).stale,true);assert.equal(marketSeries(record,'1m',new Date('2026-10-01')).stale,true);
 out.points[0].close=0;assert.equal(points[259].close,359);
});
test('missing series is explicit null, and one sample has no daily comparison',()=>{
 assert.deepEqual(marketSeries({points:[]}),{points:[],lastClose:null,changePercent:null,startDate:null,endDate:null,dataDate:null,stale:true});
 assert.equal(marketSeries({points:[{date:'2026-10-01',close:100}]},'3m',new Date('2026-10-02')).changePercent,null);
});
test('extreme positive finite prices do not yield an infinite daily percentage',()=>{
 const out=marketSeries({points:[{date:'2026-10-06',close:1e-308},{date:'2026-10-07',close:1e308}]},'3m',new Date('2026-10-08'));assert.equal(out.changePercent,null);assert.equal(out.lastClose,1e308);
});
const bundle=()=>({schemaVersion:1,mode:'public-snapshot',generatedAt:'2026-10-07T08:00:00.000Z',records:MARKET_CATALOG.map(item=>({id:item.id,points:[{date:'2026-10-06',close:100},{date:'2026-10-07',close:102}],quote:null,source:{...item.source},status:'available',error:null}))});
test('public bundle accepts fixed source metadata and isolates normalized copies',()=>{
 const input=bundle();const out=validateMarketBundle(input,{maxDate:'2026-10-07'});assert.equal(out.records.length,6);out.records[0].points[0].close=1;assert.equal(input.records[0].points[0].close,100);
 const failed=bundle();failed.records[0]={...failed.records[0],points:[],status:'unavailable',error:'operational detail'};const safe=validateMarketBundle(failed,{maxDate:'2026-10-07'});assert.ok(safe.records[0].error);assert.ok(!JSON.stringify(safe).includes('operational detail'));
});
test('public bundle rejects private additions, arbitrary source URLs and non-public schemas',()=>{
 const mutations=[b=>b.private='secret',b=>b.mode='private',b=>b.schemaVersion=2,b=>b.generatedAt='yesterday',b=>b.records.push(b.records[0]),b=>b.records[0].source.url='https://evil.example/secret',b=>b.records[0].source.label='arbitrary',b=>b.records[0].points[0].secret='private',b=>b.records[0].quote={price:10},b=>b.records[0].status='live',b=>b.records[0].error={private:'secret'}];
 for(const mutate of mutations){const input=bundle();mutate(input);assert.throws(()=>validateMarketBundle(input,{maxDate:'2026-10-07'}),/市场/);}
});
test('public bundle rejects duplicate, unordered, impossible and future dates, and bad prices',()=>{
 const mutations=[r=>r.points[1].date='2026-10-06',r=>r.points.reverse(),r=>r.points[0].date='2026-02-30',r=>r.points[1].date='2026-10-08',r=>r.points[0].close=0,r=>r.points[0].close=NaN,r=>r.points[0].close='100',r=>r.points=Array.from({length:301},()=>({date:'2026-10-06',close:1})),r=>r.points=[],r=>r.status='unavailable'];
 for(const mutate of mutations){const input=bundle();mutate(input.records[0]);assert.throws(()=>validateMarketBundle(input,{maxDate:'2026-10-07'}));}
});
test('bundle validators never run nested getters or reflect rejected input in errors',()=>{
 let calls=0;const input=bundle();Object.defineProperty(input.records[0].points[0],'close',{get(){calls++;return 100;}});assert.throws(()=>validateMarketBundle(input));assert.equal(calls,0);
 const privateInput=bundle();privateInput.records[0].id='MY_PRIVATE_ACCOUNT';assert.throws(()=>validateMarketBundle(privateInput),error=>!error.message.includes('MY_PRIVATE_ACCOUNT'));
});
