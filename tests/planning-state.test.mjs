import test from 'node:test';
import assert from 'node:assert/strict';
import {advancePlanning} from '../src/planning-state.mjs';
const demo={dataKind:'demo',planSource:'demo',plan:{purpose:'示例规则',rules:[]},previousSnapshot:null};
test('real import clears demo-only goals and does not treat demo as history',()=>{
 const next=advancePlanning(demo,{id:'demo'},'import');assert.equal(next.planSource,'none');assert.equal(next.plan.purpose,'');assert.equal(next.previousSnapshot,null);assert.equal(next.dataKind,'user');assert.equal(demo.plan.purpose,'示例规则');
});
test('explicit user targets survive while demo positions never enter history',()=>{
 const current={...demo,planSource:'user',plan:{purpose:'用户保存',rules:[]}};
 assert.equal(advancePlanning(current,{id:'demo'},'import').plan.purpose,'用户保存');assert.equal(advancePlanning(current,{id:'demo'},'import').previousSnapshot,null);
});
test('editing does not roll baseline; actual user import retains one prior snapshot',()=>{
 const current={dataKind:'user',planSource:'user',plan:{purpose:'用户保存',rules:[]},previousSnapshot:{id:'older'}};
 assert.equal(advancePlanning(current,{id:'current'},'edit').previousSnapshot.id,'older');assert.equal(advancePlanning(current,{id:'current'},'import').previousSnapshot.id,'current');
});
