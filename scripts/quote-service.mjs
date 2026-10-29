import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { QUOTE_CATALOG, isQuoteTimestamp, validateLiveQuotes } from '../src/live-quotes.mjs';

const runFile = promisify(execFile);
const URL = 'https://qt.gtimg.cn/q=sh000001,sz399001,sz399006,sh000300';
const MAX_BYTES = 500_000;
const FAILURE = '行情源暂不可用；保留上次有效观测（如有）';

async function fetchPublicQuotes() {
  const {stdout} = await runFile(process.platform === 'win32' ? 'curl.exe' : 'curl', [
    '--disable', '--silent', '--show-error', '--fail', '--proto', '=https',
    '--connect-timeout', '5', '--max-time', '10', '--max-filesize', String(MAX_BYTES), URL,
  ], {encoding: 'buffer', maxBuffer: MAX_BYTES, timeout: 11_000, windowsHide: true});
  return stdout;
}

function chinaTime(value) {
  if (!/^\d{14}$/.test(value)) throw Error('Invalid quote timestamp');
  const [year,month,day,hour,minute,second] = [value.slice(0,4),value.slice(4,6),value.slice(6,8),value.slice(8,10),value.slice(10,12),value.slice(12,14)].map(Number);
  const local = new Date(Date.UTC(year,month-1,day,hour,minute,second));
  if (year < 2000 || local.getUTCFullYear() !== year || local.getUTCMonth() !== month-1 || local.getUTCDate() !== day || local.getUTCHours() !== hour || local.getUTCMinutes() !== minute || local.getUTCSeconds() !== second) throw Error('Invalid quote calendar');
  return new Date(local.getTime() - 8 * 3600_000).toISOString();
}

export function parseProviderQuotes(raw) {
  if (!(typeof raw === 'string' || Buffer.isBuffer(raw) || raw instanceof Uint8Array)) throw Error('Invalid provider response');
  const bytes = typeof raw === 'string' ? Buffer.from(raw) : raw;
  if (bytes.byteLength > MAX_BYTES) throw Error('Provider response exceeds limit');
  const text = new TextDecoder('gb18030', {fatal: true}).decode(bytes);
  const rows = new Map();
  const pattern = /\s*(?:var )?v_([a-z]{2}\d{6})="([^"\r\n]*)";\s*/gy;
  let position = 0;
  while (position < text.length) {
    pattern.lastIndex = position;
    const match = pattern.exec(text);
    if (!match || rows.has(match[1]) || !QUOTE_CATALOG.some(item => item.providerKey === match[1])) throw Error('Invalid provider envelope');
    rows.set(match[1],match[2].split('~')); position = pattern.lastIndex;
  }
  if (rows.size !== QUOTE_CATALOG.length) throw Error('Missing quote');
  return QUOTE_CATALOG.map(({id,providerKey}) => {
    const fields = rows.get(providerKey);
    const number = value => typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : NaN;
    const price = number(fields[3]); const previousClose = number(fields[4]);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(previousClose) || previousClose <= 0) throw Error('Invalid quote price');
    return {id,price,previousClose,changePercent:(price - previousClose) / previousClose * 100,asOf:chinaTime(fields[30] ?? ''),status:'available',error:null};
  });
}

/** No request/user inputs; the upstream request is identical for every caller. */
export function createQuoteService({fetcher = fetchPublicQuotes, now = () => new Date().toISOString()} = {}) {
  let cached = null; let cachedAt = -Infinity; let inFlight = null;
  async function refresh() {
    let records;
    try {
      const raw = await fetcher();
      records = parseProviderQuotes(raw);
    } catch {
      records = QUOTE_CATALOG.map(({id}) => ({
        ...(cached?.records.find(record => record.id === id) ?? {id,price:null,previousClose:null,changePercent:null,asOf:null}),
        status:'unavailable',error:FAILURE,
      }));
    }
    const fetchedAt = now();
    if (!isQuoteTimestamp(fetchedAt)) throw Error('Invalid service clock');
    const result = {schemaVersion:1,mode:'live-public',fetchedAt,records};
    if (!validateLiveQuotes(result)) throw Error('Invalid quote response');
    cached = result; cachedAt = Date.parse(fetchedAt);
    return result;
  }
  return Object.freeze({async getQuotes() {
    const current = now();
    if (!isQuoteTimestamp(current)) throw Error('Invalid service clock');
    const elapsed = Date.parse(current) - cachedAt;
    if (cached && elapsed >= 0 && elapsed < 30_000) return structuredClone(cached);
    if (!inFlight) inFlight = refresh().finally(() => { inFlight = null; });
    return structuredClone(await inFlight);
  }});
}
