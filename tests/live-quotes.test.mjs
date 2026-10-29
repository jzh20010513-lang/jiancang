import test from 'node:test';
import assert from 'node:assert/strict';
import { QUOTE_CATALOG, validateLiveQuotes, quoteState } from '../src/live-quotes.mjs';
import { createQuoteService, parseProviderQuotes } from '../scripts/quote-service.mjs';

const NOW = '2026-10-27T07:00:00.000Z';
function provider(stamp = '20261027150000') {
  return ['sh000001', 'sz399001', 'sz399006', 'sh000300'].map(key => {
    const fields = Array(33).fill('');
    fields[3] = '3300'; fields[4] = '3000'; fields[30] = stamp; fields[32] = '999';
    return `var v_${key}="${fields.join('~')}";`;
  }).join('\n');
}
const payload = () => ({ schemaVersion: 1, mode: 'live-public', fetchedAt: NOW, records: QUOTE_CATALOG.map(({id}) => ({id,price:3300,previousClose:3000,changePercent:10,asOf:NOW,status:'available',error:null})) });

test('strict payload validation rejects foreign fields, duplicate indices, bad values and inconsistent change', () => {
  assert.equal(validateLiveQuotes(payload()), true);
  const cases = [p => p.holdings = [], p => p.records[0].token = 'x', p => p.records[0].id = 'unknown', p => p.records[0].id = p.records[1].id, p => p.records.pop(), p => p.records[0].price = Infinity, p => p.records[0].price = -1, p => p.records[0].changePercent = 99, p => p.records[0].asOf = '2026-02-30T00:00:00.000Z', p => p.fetchedAt = 'yesterday'];
  for (const mutate of cases) { const p = payload(); mutate(p); assert.equal(validateLiveQuotes(p), false); }
});

test('quote state marks old, future, missing and failed observations honestly', () => {
  const record = payload().records[0];
  assert.equal(quoteState(record, NOW), 'latest');
  assert.equal(quoteState(record, '2026-10-27T07:05:00.001Z'), 'stale');
  assert.equal(quoteState(record, '2026-10-27T06:59:59.999Z'), 'stale');
  assert.equal(quoteState({...record,status:'unavailable'},NOW), 'unavailable');
  assert.equal(quoteState({...record,asOf:null},NOW), 'unavailable');
});

test('provider parser converts China clock to UTC and derives change instead of trusting supplied percent', () => {
  const records = parseProviderQuotes(provider());
  assert.equal(records.length,4);
  assert.equal(records[0].asOf,NOW);
  assert.equal(records[0].changePercent,10);
  for (const bad of [provider('20260230150000'), provider('20261027250000'), provider().replace('3300','NaN'), 'globalThis.pwned = true;', provider() + provider()]) {
    assert.throws(() => parseProviderQuotes(bad));
  }
  assert.equal(globalThis.pwned,undefined);
});

test('provider bare assignment envelope observed from live endpoint is inertly supported', () => {
  assert.equal(parseProviderQuotes(provider().replaceAll('var ',''))[0].price,3300);
});

test('service coalesces concurrent requests, caches 30 seconds, returns independent copies', async () => {
  let calls = 0; let now = NOW;
  const service = createQuoteService({fetcher: async () => { calls++; return Buffer.from(provider()); }, now: () => now});
  const [a,b] = await Promise.all([service.getQuotes(),service.getQuotes()]);
  assert.equal(calls,1); assert.equal(validateLiveQuotes(a),true);
  a.records[0].price = 1;
  assert.equal(b.records[0].price,3300);
  assert.equal((await service.getQuotes()).records[0].price,3300);
  now = '2026-10-27T07:00:30.000Z';
  await service.getQuotes(); assert.equal(calls,2);
});

test('failed refresh retains observation timestamps and exposes only a fixed sanitized error', async () => {
  let now = NOW; let fails = false;
  const service = createQuoteService({fetcher: async () => { if (fails) throw Error('secret-user-data'); return provider(); },now: () => now});
  await service.getQuotes(); fails = true; now = '2026-10-27T07:01:00.000Z';
  const result = await service.getQuotes();
  assert.equal(result.records[0].asOf,NOW);
  assert.equal(result.records[0].price,3300);
  assert.equal(result.records[0].status,'unavailable');
  assert.equal(validateLiveQuotes(result),true);
  assert.equal(JSON.stringify(result).includes('secret-user-data'),false);
});

test('initial and oversize failures return four unavailable records without invented prices', async () => {
  for (const fetcher of [async () => {throw Error('offline');},async () => 'a'.repeat(500001)]) {
    const p = await createQuoteService({fetcher, now: () => NOW}).getQuotes();
    assert.equal(validateLiveQuotes(p),true);
    assert.equal(p.records.length,4);
    assert.equal(p.records.every(r => r.price === null && r.asOf === null && r.status === 'unavailable'),true);
  }
});
