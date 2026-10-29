import test from 'node:test';
import assert from 'node:assert/strict';
import {newHolding,makeSnapshot} from '../src/domain.mjs';
import {defaultLayout,defaultPlanning,exportFull,exportLayout,validateExport,validateLayout} from '../src/transfer.mjs';

const snapshot=(fields={})=>makeSnapshot([newHolding({name:'虚构持仓',...fields})]);
const full=(fields={},planning)=>exportFull(snapshot(fields),defaultLayout(),planning);

test('full backups preserve confirmed and unreviewed mappings and history without aliasing',()=>{
 for(const benchmarkReview of ['confirmed','unreviewed'])for(const planning of [undefined,{...defaultPlanning(),previousSnapshot:snapshot({benchmarkReview:'confirmed',benchmarkIds:['gold-us']})}]){
  const input=snapshot({benchmarkReview,benchmarkIds:['cn-large','us-broad','gold-us']});
  const value=exportFull(input,defaultLayout(),planning);
  assert.deepEqual(validateExport(JSON.stringify(value)),value);
  assert.equal(value.snapshot.holdings[0].benchmarkReview,benchmarkReview);
  assert.deepEqual(value.snapshot.holdings[0].benchmarkIds,['cn-large','us-broad','gold-us']);
  value.snapshot.holdings[0].benchmarkIds.pop();
  assert.equal(input.holdings[0].benchmarkIds.length,3);
  if(planning)assert.deepEqual(value.planning.previousSnapshot.holdings[0].benchmarkIds,['gold-us']);
 }
 const pending=full({benchmarkIds:['cn-large']});assert.ok(!Object.hasOwn(pending.snapshot.holdings[0],'benchmarkReview'));
 const state={...defaultPlanning(),marketPreferences:{pinned:['gold-us'],hidden:['cn-large'],order:['us-tech','gold-us','cn-large']}};
 assert.deepEqual(validateExport(JSON.stringify(full({},state))).planning.marketPreferences,state.marketPreferences);
});

test('confirmed empty market mapping differs from legacy unknown in v1 and v2',()=>{
 for(const planning of [undefined,defaultPlanning()]){
  const none=full({benchmarkReview:'confirmed',benchmarkIds:[]},planning);
  assert.deepEqual(validateExport(JSON.stringify(none)),none);
  assert.deepEqual(none.snapshot.holdings[0].benchmarkIds,[]);
  assert.equal(none.snapshot.holdings[0].benchmarkReview,'confirmed');
  const legacy=full({},planning).snapshot.holdings[0];
  assert.ok(!Object.hasOwn(legacy,'benchmarkReview'));
  assert.ok(!Object.hasOwn(legacy,'benchmarkIds'));
 }
 assert.throws(()=>full({benchmarkReview:'confirmed'}));
});

test('market preferences are optional planning state and never added to legacy defaults',()=>{
 assert.ok(!Object.hasOwn(defaultPlanning(),'marketPreferences'));
 const state={...defaultPlanning(),marketPreferences:{pinned:[],hidden:[],order:[]}};
 const value=full({},state);
 assert.deepEqual(value.planning.marketPreferences,state.marketPreferences);
 assert.deepEqual(validateExport(JSON.stringify(value)),value);
 assert.notEqual(value.planning.marketPreferences,state.marketPreferences);
 state.marketPreferences.pinned.push('unknown');
 assert.deepEqual(value.planning.marketPreferences.pinned,[]);
 const v1=full();assert.ok(!Object.hasOwn(v1,'planning'));
 assert.throws(()=>validateExport({...v1,planning:defaultPlanning()}));
});

test('strict market fields reject bad review states, IDs, arrays, prototypes and accessors',()=>{
 for(const fields of [{benchmarkReview:'yes'},{benchmarkReview:null},{benchmarkIds:null},{benchmarkIds:['unknown']},{benchmarkIds:['cn-large','cn-large']},{benchmarkIds:['cn-large','us-broad','gold-us','us-tech']}])assert.throws(()=>full(fields));
 for(const prefs of [null,{}, {pinned:[],hidden:[],order:[],extra:true},{pinned:['unknown'],hidden:[],order:[]}])assert.throws(()=>full({},{...defaultPlanning(),marketPreferences:prefs}));
 let calls=0;const fields={benchmarkReview:'confirmed'};
 Object.defineProperty(fields,'benchmarkIds',{get(){calls++;return [];},enumerable:true});
 const b=full();Object.defineProperty(b.snapshot.holdings[0],'benchmarkIds',Object.getOwnPropertyDescriptor(fields,'benchmarkIds'));
 assert.throws(()=>validateExport(b));assert.equal(calls,0);
 const hostile=full();hostile.planning={...defaultPlanning(),marketPreferences:Object.create({pinned:[]})};hostile.schemaVersion=2;
 assert.throws(()=>validateExport(hostile));
 const extra=full({benchmarkIds:[]});extra.snapshot.holdings[0].benchmarkIds.secret='private';assert.throws(()=>validateExport(extra));
});

test('pure layout exports keep the original fixed schema and reject market or holding leaks',()=>{
 const value=exportLayout(defaultLayout());
 assert.deepEqual(Object.keys(value.layout).sort(),['cards','columns','density','hidden','mask','theme']);
 assert.deepEqual(Object.keys(value).sort(),['formatId','layout','schemaVersion']);
 for(const key of ['benchmarkIds','benchmarkReview','marketPreferences','pinned','holdings','snapshot','planning']){
  assert.throws(()=>validateExport({...value,[key]:[]}));
  assert.throws(()=>validateLayout({...defaultLayout(),[key]:[]}));
 }
});
