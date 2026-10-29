import test from 'node:test';
import assert from 'node:assert/strict';
import {createPersistence} from '../src/storage.mjs';
test('memory mode never writes; explicit save and disable clear',async()=>{
 const calls=[];const p=createPersistence({read:async()=>null,write:async v=>calls.push(v),clear:async()=>calls.push('clear')});
 await p.update({safe:1}); assert.equal(calls.length,0);
 await p.enable({safe:2});assert.equal(p.enabled,true);assert.deepEqual(calls,[{safe:2}]);
 await p.disable();assert.equal(p.enabled,false);assert.equal(calls.at(-1),'clear');
});
test('quota failure does not claim persistence enabled',async()=>{
 const p=createPersistence({read:async()=>null,write:async()=>{throw Error('quota');},clear:async()=>{}});
 await assert.rejects(p.enable({safe:1}));assert.equal(p.enabled,false);
});
test('clear failure retains enabled state so UI can retry',async()=>{
 const p=createPersistence({read:async()=>({saved:true}),write:async()=>{},clear:async()=>{throw Error('blocked');}});
 await p.restore();assert.equal(p.enabled,true);await assert.rejects(p.disable());assert.equal(p.enabled,true);
});
test('session fallback suspends writes without deleting the old persistent snapshot',async()=>{
 const calls=[];const p=createPersistence({read:async()=>({old:true}),write:async()=>{throw Error('quota');},clear:async()=>calls.push('deleted')});
 await p.restore();p.suspend();await p.update({next:true});assert.equal(p.enabled,false);assert.deepEqual(calls,[]);
});
