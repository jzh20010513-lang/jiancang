import test from 'node:test';
import assert from 'node:assert/strict';
const catalog = await import('../src/market-catalog.mjs').catch(() => ({}));
const adapter = await import('../scripts/refresh-market.mjs').catch(() => ({}));
const preparation = await import('../scripts/prepare-market.mjs');
const rows = [['2026-10-23','10','12','13','9'], ['2026-10-26','12','14','15','11']];
const payload = (day = rows) => JSON.stringify({code:0,data:{sh000300:{day}}});

test('catalog contains exactly six immutable public references', () => {
  assert.ok(Array.isArray(catalog.MARKET_CATALOG));
  assert.deepEqual(catalog.MARKET_CATALOG.map(x => x.id), ['cn-large','cn-growth','hk-broad','us-broad','us-tech','gold-us']);
  assert.ok(Object.isFrozen(catalog.MARKET_CATALOG));
  assert.ok(catalog.MARKET_CATALOG.every(Object.isFrozen));
  assert.equal(catalog.MARKET_CATALOG.at(-1).currency, 'USD');
});
test('parses daily closes from JSON and inert Tencent assignment wrapper', () => {
  assert.equal(typeof adapter.parseTencentDaily, 'function');
  const expected = [{date:'2026-10-23',close:12},{date:'2026-10-26',close:14}];
  assert.deepEqual(adapter.parseTencentDaily(payload(), 'sh000300'), expected);
  assert.deepEqual(adapter.parseTencentDaily(`v_kline_dayqfq=${payload()};`, 'sh000300'), expected);
});
test('rejects invalid closes, calendar dates, duplicate or reversed rows and executable wrappers', () => {
  assert.equal(typeof adapter.parseTencentDaily, 'function');
  for (const bad of [[], [['2026-02-30','1','2']], [['2026-10-23','1','0']], [['2026-10-23','1','NaN']], [rows[1],rows[0]], [rows[0],rows[0]]]) {
    assert.throws(() => adapter.parseTencentDaily(payload(bad), 'sh000300'));
  }
  assert.throws(() => adapter.parseTencentDaily(`${payload()}; process.exit()`, 'sh000300'));
  assert.throws(() => adapter.parseTencentDaily(payload(), 'custom-symbol'));
});
test('failed update retains only validated previous daily data and exposes error', () => {
  assert.equal(typeof adapter.updateSnapshot, 'function');
  const now = '2026-10-27T03:00:00.000Z';
  const previous = {schemaVersion:1,mode:'public-snapshot',records:[{id:'cn-large',points:[{date:'2026-10-23',close:12}],quote:{price:99},status:'available'}]};
  const result = adapter.updateSnapshot(previous, new Map([['cn-growth',{points:[{date:'2026-10-26',close:23}]}]]), now);
  assert.equal(result.records.length,6);
  assert.equal(result.generatedAt,now);
  assert.deepEqual(result.records[0].points,previous.records[0].points);
  assert.equal(result.records[0].status,'available');
  assert.ok(result.records[0].error);
  assert.equal(result.records[0].quote,null);
  assert.equal(result.records[1].error,null);
  assert.equal(result.records[2].status,'unavailable');
  assert.deepEqual(result.records[2].points,[]);
  assert.equal(adapter.updateSnapshot({records:[{id:'cn-large',points:[{date:'bad',close:0}]}]},new Map(),now).records[0].status,'unavailable');
});
test('fixed URLs and unavailable preparation never accept arbitrary symbols', () => {
  assert.equal(typeof adapter.marketUrl, 'function');
  assert.match(adapter.marketUrl('cn-large'),/^https:\/\/web\.ifzq\.gtimg\.cn\//);
  assert.throws(() => adapter.marketUrl('sh600000'));
  const empty=adapter.updateSnapshot(null,new Map(),'2026-10-27T03:00:00.000Z');
  assert.ok(empty.records.every(r=>r.status==='unavailable'&&r.quote===null&&r.error));
});
test('drops in-progress market-local daily bars before conservative session cutoff', () => {
  assert.equal(typeof adapter.completedPoints,'function');
  const points=[{date:'2026-10-26',close:10},{date:'2026-10-27',close:12}];
  assert.deepEqual(adapter.completedPoints(points,'cn-large','2026-10-27T02:00:00.000Z'),points.slice(0,1));
  assert.deepEqual(adapter.completedPoints(points,'cn-large','2026-10-27T08:00:00.000Z'),points);
  assert.deepEqual(adapter.completedPoints(points,'us-broad','2026-10-27T02:00:00.000Z'),points.slice(0,1));
});
test('build preparation rejects private fields and arbitrary sources while sanitizing public error text', () => {
  assert.equal(typeof preparation.normalizeForBuild,'function');
  const bundle=adapter.updateSnapshot(null,new Map([['cn-large',{points:[{date:'2026-10-23',close:12}]}]]),'2026-10-27T03:00:00.000Z');
  const privateBundle=structuredClone(bundle);
  privateBundle.holdings=[{name:'PRIVATE_ACCOUNT',value:500}];
  assert.throws(()=>preparation.normalizeForBuild(JSON.stringify(privateBundle)));
  const arbitrarySource=structuredClone(bundle);
  arbitrarySource.records[0].source.url='https://example.com/private-account';
  assert.throws(()=>preparation.normalizeForBuild(JSON.stringify(arbitrarySource)));
  bundle.records[1].error='PRIVATE_PROXY_ACCOUNT in transport exception';
  const clean=preparation.normalizeForBuild(JSON.stringify(bundle));
  assert.equal(clean.generatedAt,bundle.generatedAt);
  assert.deepEqual(clean.records[0].points,bundle.records[0].points);
  assert.ok(!JSON.stringify(clean).includes('PRIVATE_PROXY_ACCOUNT'));
});
