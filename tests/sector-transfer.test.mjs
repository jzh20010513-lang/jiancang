import test from 'node:test';
import assert from 'node:assert/strict';
import {newHolding,makeSnapshot} from '../src/domain.mjs';
import {exportFull,exportLayout,defaultLayout,defaultPlanning,validateExport} from '../src/transfer.mjs';
const base=()=>exportFull(makeSnapshot([newHolding({name:'合成产品'})]),defaultLayout(),defaultPlanning());
test('sector mappings survive complete backups and legacy absence stays unknown',()=>{
 const b=base();Object.assign(b.snapshot.holdings[0],{sectorIds:['medical'],sectorReview:'confirmed'});
 const clean=validateExport(JSON.stringify(b));assert.deepEqual(clean.snapshot.holdings[0].sectorIds,['medical']);assert.equal(clean.snapshot.holdings[0].sectorReview,'confirmed');
 assert.equal(base().snapshot.holdings[0].sectorReview,undefined);
 assert.doesNotMatch(JSON.stringify(exportLayout(defaultLayout())),/sector/);
});
test('sector mapping rejects unknown ids, duplicates, malformed state and extras',()=>{
 for(const fields of [{sectorIds:['unknown']},{sectorIds:['medical','medical']},{sectorIds:'medical'},{sectorReview:'confirmed'},{sectorReview:'yes'},{sectorIds:[],sectorReview:'confirmed',sectorURL:'https://example.com'}]){
 const b=base();Object.assign(b.snapshot.holdings[0],fields);assert.throws(()=>validateExport(b));}
 const b=base();Object.assign(b.snapshot.holdings[0],{sectorIds:[],sectorReview:'confirmed'});assert.deepEqual(validateExport(b).snapshot.holdings[0].sectorIds,[]);
});
