import test from 'node:test';
import assert from 'node:assert/strict';
import {renderMarketEvidence,renderVolatilityEvidence} from '../src/market-evidence-view.mjs';
import {VIX_SOURCE} from '../src/volatility.mjs';
import {validateSectorBundle} from '../src/sector-data.mjs';
import {updateSectorSnapshot} from '../scripts/refresh-sectors.mjs';
import {analyzeSectors} from '../src/sectors.mjs';
const report={reference:{name:'合成参考'},benchmarkName:'合成基准',stale:false,sourceError:false,relativeStale:false,benchmarkError:false,relative20:{referencePercent:-20,benchmarkPercent:-30,percentPoints:10,from:'2026-09-01',to:'2026-09-30'}};
test('outperforming a falling benchmark is not rendered as a positive absolute return',()=>{
 const html=renderMarketEvidence(report);assert.match(html,/-20.00%/);assert.match(html,/-30.00%/);assert.match(html,/领先10.00个百分点/);assert.match(html,/不是你的基金收益/);assert.match(html,/尚未覆盖市场广度/);
 assert.doesNotMatch(renderMarketEvidence(report,{ready:false}),/-20.00%|领先10/);assert.doesNotMatch(renderMarketEvidence({...report,relativeStale:true}),/-20.00%|领先10/);
});
test('old public bundles are compatible and optional volatility context is strict',()=>{
 const points=[{date:'2026-10-27',close:20}];const full=updateSectorSnapshot(null,new Map([['us-volatility',{points}]]),'2026-10-28T00:00:00.000Z');assert.deepEqual(validateSectorBundle(full).context.vix.source,VIX_SOURCE);const old=structuredClone(full);delete old.context;assert.equal(validateSectorBundle(old).context,undefined);
 for(const change of [b=>b.context.extra=true,b=>b.context.vix.source.url='https://bad.test',b=>b.context.vix.points[0].private='data']){const b=structuredClone(full);change(b);assert.throws(()=>validateSectorBundle(b));}
 const failed=updateSectorSnapshot(full,new Map(),'2026-10-28T00:00:00.000Z');assert.deepEqual(failed.context.vix.points,points);assert.notEqual(failed.context.vix.error,null);
});
test('insufficient or failed volatility evidence hides current figures and escapes text',()=>{
 const html=renderVolatilityEvidence({state:'unavailable',summary:'<b>失败</b>',asOf:'2026-10-27'});assert.doesNotMatch(html,/<b>失败|VIX收盘/);assert.match(html,/&lt;b&gt;/);
});
test('evidence limits acknowledge available VIX but never claim complete sentiment coverage',()=>{
 const bundle=updateSectorSnapshot(null,new Map([['us-volatility',{points:[{date:'2026-10-27',close:20}]}]]),'2026-10-28T00:00:00.000Z');
 const r=analyzeSectors({holdings:[{id:'u',sectorIds:['us-tech'],sectorReview:'confirmed',reviewStatus:'needs_attention'}]},bundle,null,[],{today:'2026-10-28',now:'2026-10-28T22:00:00Z'}).reports[0];assert.equal(r.sentimentContext.state,'available');assert.match(r.notes.join(' '),/VIX.*其他证据不足/);assert.doesNotMatch(r.notes.join(' '),/没有经过核验的情绪数据/);
});
