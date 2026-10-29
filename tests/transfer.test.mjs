import test from 'node:test';
import assert from 'node:assert/strict';
import { newHolding,makeSnapshot } from '../src/domain.mjs';
import { defaultLayout,validateLayout,exportFull,exportLayout,validateExport } from '../src/transfer.mjs';
const backup=()=>exportFull(makeSnapshot([newHolding({name:'待补',favorite:true})]),defaultLayout());
test('full roundtrip preserves pending rows; layout roundtrip carries only fixed presentation',()=>{
 const b=backup(); assert.deepEqual(validateExport(JSON.stringify(b)),b);assert.equal(b.snapshot.holdings[0].reviewStatus,'needs_attention');
 const layout=exportLayout(defaultLayout());assert.deepEqual(validateExport(layout),layout);assert.deepEqual(Object.keys(layout).sort(),['formatId','layout','schemaVersion']);
});
test('strict layout rejects injected fields, IDs, duplicates and invalid types',()=>{
 for(const change of [{theme:'remote'},{mask:'true'},{cards:['accounts','accounts','holdings']},{hidden:['wat']},{columns:['raw']},{url:'https://example.com'}]) assert.throws(()=>validateLayout({...defaultLayout(),...change}));
});
test('envelopes reject unknown fields, versions and prototype keys',()=>{
 for(const change of [{schemaVersion:2},{formatId:'other'},{url:'https://example.com'}])assert.throws(()=>validateExport({...backup(),...change}));
 assert.throws(()=>validateExport('{"__proto__":{},"formatId":"local-portfolio-layout","schemaVersion":1,"layout":{}}'));
});
test('snapshot validates references, duplicate IDs, dates, decimals and field types',()=>{
 for(const mutate of [b=>b.snapshot.holdings.push({...b.snapshot.holdings[0]}),b=>b.snapshot.holdings[0].accountId='missing',b=>b.snapshot.holdings[0].tagIds=['missing'],b=>b.snapshot.holdings[0].asOfDate='2026-02-30',b=>b.snapshot.holdings[0].marketValue='NaN',b=>b.snapshot.holdings[0].favorite='yes',b=>b.snapshot.holdings[0].rawText='private',b=>b.snapshot.holdings[0].currency='$']){const b=backup();mutate(b);assert.throws(()=>validateExport(b));}
});
test('unsupported currencies remain recoverable pending; confirmed incomplete rows rejected',()=>{
 const b=backup();b.snapshot.holdings[0].currency='BTC';assert.equal(validateExport(b).snapshot.holdings[0].currency,'BTC');b.snapshot.holdings[0].reviewStatus='confirmed';assert.throws(()=>validateExport(b));
});
test('validators do not execute accessors or accept extra array properties',()=>{
 let calls=0;const b=backup();Object.defineProperty(b,'surprise',{get(){calls++;return 'x';},enumerable:true});assert.throws(()=>validateExport(b));assert.equal(calls,0);
 const layout=defaultLayout();layout.cards.surprise='unknown';assert.throws(()=>validateLayout(layout));
});
test('resource limits reject too many rows and huge strings without mutating original',()=>{
 const b=backup();b.snapshot.holdings=Array.from({length:1001},(_,i)=>({...b.snapshot.holdings[0],id:`r${i}`}));assert.throws(()=>validateExport(b));assert.throws(()=>validateExport(' '.repeat(5*1024*1024+1)));const original=backup();const clean=validateExport(original);clean.snapshot.holdings[0].name='changed';assert.equal(original.snapshot.holdings[0].name,'待补');
});
