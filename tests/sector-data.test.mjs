import test from 'node:test';
import assert from 'node:assert/strict';
import { SECTOR_CATALOG } from '../src/sector-catalog.mjs';
import { validateSectorBundle } from '../src/sector-data.mjs';
import { parseTencentSectorDaily, completedSectorPoints, updateSectorSnapshot } from '../scripts/refresh-sectors.mjs';
import { normalizeSectorForBuild } from '../scripts/prepare-sectors.mjs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const bar = (date='2026-10-23') => ({date,open:1.1,high:1.3,low:1,close:1.2,volume:null});
const bundle = () => ({schemaVersion:1,mode:'public-snapshot',generatedAt:'2026-10-24T00:00:00.000Z',records:SECTOR_CATALOG.map(item=>({id:item.id,points:[bar()],source:{...item.source},status:'available',error:null}))});
const options={maxDate:'2026-10-27'};
const raw = rows => JSON.stringify({code:0,data:{sh512480:{qfqday:rows}}});

test('valid sector bundles retain OHLC and missing volume including fixed overseas reference records',()=>{
 assert.deepEqual(validateSectorBundle(bundle(),options).records.map(r=>r.id),['semiconductor','medical','ev','us-growth','hk-tech-reference']);
 assert.deepEqual(validateSectorBundle(bundle(),options).records[0].points,[bar()]);
 assert.ok(Object.isFrozen(SECTOR_CATALOG)&&SECTOR_CATALOG.every(x=>Object.isFrozen(x)&&Object.isFrozen(x.source)));
});
test('strict sector schema rejects untrusted fields, sources, identities and malformed bars',()=>{
 const mutations=[b=>b.private='secret',b=>b.records[0].quote=null,b=>b.records[0].source.url='https://evil.test',b=>b.records[0].id='cn-large',b=>b.records.push(b.records[0]),b=>b.records.pop(),b=>b.records[0].points[0].date='2026-02-30',b=>b.records[0].points[0].date='2026-10-28',b=>b.records[0].points.push(bar()),b=>b.records[0].points[0].high=1.15,b=>b.records[0].points[0].open=0,b=>b.records[0].points[0].volume=-1,b=>b.records[0].points[0].close=Infinity,b=>b.records[0].points[0].volume='4',b=>b.records[0].status='unavailable',b=>b.generatedAt='2026-10-24T99:00:00Z',b=>b.generatedAt='2026-02-30T00:00:00Z',b=>b.records[0].points=Array(301).fill(bar())];
 for(const mutate of mutations){const b=bundle();mutate(b);assert.throws(()=>validateSectorBundle(b,options));}
 const b=bundle();Object.defineProperty(b.records[0],'error',{get(){throw new Error('getter executed');}});assert.throws(()=>validateSectorBundle(b,options),/无效/);
});
test('provider parsing accepts inert assignment wrappers and preserves missing volume',()=>{
 assert.deepEqual(parseTencentSectorDaily('daily = '+raw([['2026-10-23','1.1','1.2','1.3','1']])+';','sh512480'),[bar()]);
 assert.equal(parseTencentSectorDaily(raw([['2026-10-23',1.1,1.2,1.3,1,0]]),'sh512480')[0].volume,0);
 assert.throws(()=>parseTencentSectorDaily('daily = '+raw([])+'; process.exit()','sh512480'));
 assert.throws(()=>parseTencentSectorDaily(raw([]),'sh000300'));
 assert.throws(()=>parseTencentSectorDaily(raw([['2026-10-23',1.1,1.2,1.3,1,'oops']]),'sh512480'));
 assert.throws(()=>parseTencentSectorDaily(' '.repeat(1_000_001),'sh512480'));
});
test('same-day CN bars become eligible only from 16:00 local and future bars stay excluded',()=>{
 const points=[bar('2026-10-26'),bar('2026-10-27'),bar('2026-10-28')];
 assert.deepEqual(completedSectorPoints(points,'2026-10-27T07:59:59Z').map(p=>p.date),['2026-10-26']);
 assert.deepEqual(completedSectorPoints(points,'2026-10-27T08:00:00Z').map(p=>p.date),['2026-10-26','2026-10-27']);
 assert.throws(()=>completedSectorPoints(points,'invalid'));
});
test('failed refresh preserves validated old source dates and sanitizes provider errors',()=>{
 const result=updateSectorSnapshot(bundle(),new Map([['semiconductor',{error:'token=secret <script>'}]]),'2026-10-27T08:00:00Z');
 assert.deepEqual(result.records[0].points,[bar()]);assert.equal(result.records[0].status,'available');assert.doesNotMatch(result.records[0].error,/secret|script/);
 const invalid=bundle();invalid.records[0].source.url='https://evil.test';
 assert.equal(updateSectorSnapshot(invalid,new Map(),'2026-10-27T08:00:00Z').records[0].status,'unavailable');
});
test('offline build normalization emits fixed unavailable records for missing input and rejects invalid input',()=>{
 const empty=normalizeSectorForBuild(undefined);
 assert.equal(empty.records.length,5);assert.ok(empty.records.every(r=>r.status==='unavailable'&&r.points.length===0));
 assert.deepEqual(normalizeSectorForBuild(JSON.stringify(bundle()),options),validateSectorBundle(bundle(),options));
 assert.throws(()=>normalizeSectorForBuild(' '.repeat(1_000_001)));
 assert.throws(()=>normalizeSectorForBuild('{broken'));
 assert.throws(()=>normalizeSectorForBuild(JSON.stringify({...bundle(),private:'sensitive'}),options));
});
test('refresh and preparation CLIs reject user-supplied symbols or paths before doing work',()=>{
 for(const name of ['refresh-sectors','prepare-sectors']){
  const result=spawnSync(process.execPath,[fileURLToPath(new URL(`../scripts/${name}.mjs`,import.meta.url)),'https://untrusted.test'],{encoding:'utf8',windowsHide:true});
  assert.notEqual(result.status,0);assert.match(result.stderr,/No arguments accepted/);
 }
});
