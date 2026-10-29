import test from 'node:test';
import assert from 'node:assert/strict';
import {newHolding,makeSnapshot} from '../src/domain.mjs';
import * as transfer from '../src/transfer.mjs';

const snapshot=(overrides={})=>makeSnapshot([newHolding({name:'虚构持仓',...overrides})]);
const planning=()=>({plan:{purpose:'',rules:[]},previousSnapshot:null,dataKind:'user'});
const full=()=>transfer.exportFull(snapshot(),transfer.defaultLayout(),planning());

test('planning defaults are isolated and v1 backup remains unmodified',()=>{
 assert.deepEqual(transfer.defaultPlanning(),{...planning(),planSource:'none'});
 const a=transfer.defaultPlanning();a.plan.purpose='changed';assert.equal(transfer.defaultPlanning().plan.purpose,'');
 const legacy=transfer.exportFull(snapshot(),transfer.defaultLayout());assert.equal(legacy.schemaVersion,1);assert.ok(!Object.hasOwn(legacy,'planning'));
 assert.deepEqual(transfer.validateExport(JSON.stringify(legacy)),legacy);
 assert.throws(()=>transfer.validateExport({...legacy,schemaVersion:2}));
});

test('v2 roundtrip preserves planning and validated independent previous snapshot',()=>{
 const plan=planning();plan.plan.purpose='未来用途';plan.previousSnapshot=snapshot({liquidity:'locked',unlockDate:'2027-01-01'});plan.dataKind='demo';
 const value=transfer.exportFull(snapshot({liquidity:'available',unlockDate:null}),transfer.defaultLayout(),plan);
 assert.equal(value.schemaVersion,2);assert.deepEqual(Object.keys(value).sort(),['exportedAt','formatId','layout','planning','schemaVersion','snapshot']);
 assert.deepEqual(transfer.validateExport(JSON.stringify(value)),value);
 assert.equal(value.planning.previousSnapshot.holdings[0].unlockDate,'2027-01-01');
 value.planning.previousSnapshot.holdings[0].name='mutated';assert.equal(plan.previousSnapshot.holdings[0].name,'虚构持仓');
});

test('v2 rejects malformed planning, history and leaked OCR fields',()=>{
 for(const mutate of [b=>delete b.planning,b=>b.planning.extra=1,b=>b.planning.dataKind='private',b=>b.planning.plan={purpose:'',rules:[],secret:'x'},b=>b.planning.previousSnapshot={},b=>b.planning.previousSnapshot=snapshot({rawOCR:'secret'}),b=>b.snapshot.holdings[0].rawOCR='secret']){
  const b=full();mutate(b);assert.throws(()=>transfer.validateExport(b));
 }
 const legacy=transfer.exportFull(snapshot(),transfer.defaultLayout());assert.throws(()=>transfer.validateExport({...legacy,planning:planning()}));
});

test('liquidity is optional but restricted dates require locked holdings',()=>{
 const old=transfer.exportFull(snapshot(),transfer.defaultLayout());assert.ok(!Object.hasOwn(old.snapshot.holdings[0],'liquidity'));
 for(const fields of [{liquidity:'unknown'},{liquidity:'available',unlockDate:null},{liquidity:'locked',unlockDate:'2028-02-29'},{liquidity:'locked',unlockDate:null}]){
  const b=transfer.exportFull(snapshot(fields),transfer.defaultLayout());for(const [key,value]of Object.entries(fields))assert.equal(b.snapshot.holdings[0][key],value);
 }
 for(const fields of [{liquidity:'cash'},{liquidity:'locked',unlockDate:'2027-02-29'},{liquidity:'available',unlockDate:'2027-01-01'},{unlockDate:'2027-01-01'}])assert.throws(()=>transfer.exportFull(snapshot(fields),transfer.defaultLayout()));
});

test('layout-only backups carry no planning or business fields',()=>{
 const b=transfer.exportLayout(transfer.defaultLayout());assert.deepEqual(Object.keys(b).sort(),['formatId','layout','schemaVersion']);
 for(const key of ['planning','previousSnapshot','plan','snapshot','dataKind'])assert.throws(()=>transfer.validateExport({...b,[key]:null}));
});

test('v2 rejects accessors without invocation and hostile prototypes',()=>{
 let calls=0;const b=full();Object.defineProperty(b.planning,'plan',{get(){calls++;return planning().plan;},enumerable:true});assert.throws(()=>transfer.validateExport(b));assert.equal(calls,0);
 const c=full();Object.setPrototypeOf(c.planning.previousSnapshot=snapshot(),{secret:true});assert.throws(()=>transfer.validateExport(c));
 const d=full();Object.defineProperty(d.planning,'rawOCR',{value:'private',enumerable:false});assert.throws(()=>transfer.validateExport(d));
});

test('v2 limits each snapshot to 1000 rows and combined envelope to 5 MiB',()=>{
 const b=full();b.planning.previousSnapshot=snapshot();b.planning.previousSnapshot.holdings=Array.from({length:1001},(_,i)=>({...b.snapshot.holdings[0],id:`old-${i}`}));assert.throws(()=>transfer.validateExport(b));
 const allowed=full();allowed.planning.previousSnapshot=snapshot();for(const snap of [allowed.snapshot,allowed.planning.previousSnapshot])snap.holdings=Array.from({length:1000},(_,i)=>({...snap.holdings[0],id:`r-${i}`}));assert.equal(transfer.validateExport(allowed).planning.previousSnapshot.holdings.length,1000);
 const c=full();c.planning.previousSnapshot=snapshot();
 for(const [index,snap]of [c.snapshot,c.planning.previousSnapshot].entries()){
  snap.tags=Array.from({length:200},(_,i)=>({id:`t-${i}-${'x'.repeat(90)}`,name:'t'}));
  snap.holdings=Array.from({length:1000},(_,i)=>({...snap.holdings[0],id:`${index}-${i}`,tagIds:snap.tags.slice(0,30).map(t=>t.id)}));
 }
 assert.ok(new TextEncoder().encode(JSON.stringify(c)).length>5*1024*1024);assert.throws(()=>transfer.validateExport(c));
});
