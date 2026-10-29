import test from 'node:test';
import assert from 'node:assert/strict';
import {renderLiveQuotes} from '../src/live-view.mjs';
test('live view separates provider timestamp and retrieval failure from historical curves',()=>{
 const html=renderLiveQuotes(null,'error',true);
 assert.match(html,/当天大盘报价/);assert.match(html,/暂不可用/);assert.doesNotMatch(html,/class="live-price"/);
 assert.match(renderLiveQuotes(null,'idle',false),/已暂停/);
});
test('retained values never imply real time and show exact source timestamp',()=>{
 const records=['sh000001','sz399001','sz399006','sh000300'].map(id=>({id,price:3000,previousClose:2999,changePercent:0.033,asOf:'2026-10-26T07:00:00.000Z',status:'available',error:null}));
 const html=renderLiveQuotes({records,fetchedAt:'2026-10-27T05:00:00.000Z'},'ready',true,'2026-10-27T05:00:00.000Z');
 assert.match(html,/过期/);assert.match(html,/2026-10-26/);assert.match(html,/延迟未知/);assert.doesNotMatch(html,/保证实时/);
});
test('paused or failed polling never leaves a freshness-positive label',()=>{
 const now=new Date().toISOString();const records=['sh000001','sz399001','sz399006','sh000300'].map(id=>({id,price:3000,previousClose:2999,changePercent:0.033,asOf:now,status:'available',error:null}));
 const bundle={records,fetchedAt:now};
 for(const [status,enabled] of [['ready',false],['error',true]]){const html=renderLiveQuotes(bundle,status,enabled,now);assert.doesNotMatch(html,/近期报价/);assert.match(html,/保留观测/);}
});
