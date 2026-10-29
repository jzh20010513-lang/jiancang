export const QUOTE_CATALOG = Object.freeze([
  { id: 'sh000001', name: '上证综指', providerKey: 'sh000001', timeZone: 'Asia/Shanghai' },
  { id: 'sz399001', name: '深证成指', providerKey: 'sz399001', timeZone: 'Asia/Shanghai' },
  { id: 'sz399006', name: '创业板指', providerKey: 'sz399006', timeZone: 'Asia/Shanghai' },
  { id: 'sh000300', name: '沪深300', providerKey: 'sh000300', timeZone: 'Asia/Shanghai' },
].map(Object.freeze));

export function isQuoteTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}
const exactKeys = (object, keys) => object !== null && typeof object === 'object' && !Array.isArray(object) && Object.keys(object).length === keys.length && keys.every(key => Object.hasOwn(object,key));
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;

export function validateLiveQuotes(input) {
  if (!exactKeys(input,['schemaVersion','mode','fetchedAt','records']) || input.schemaVersion !== 1 || input.mode !== 'live-public' || !isQuoteTimestamp(input.fetchedAt) || !Array.isArray(input.records) || input.records.length !== QUOTE_CATALOG.length) return false;
  const seen = new Set();
  for (const record of input.records) {
    if (!exactKeys(record,['id','price','previousClose','changePercent','asOf','status','error']) || !QUOTE_CATALOG.some(item => item.id === record.id) || seen.has(record.id)) return false;
    seen.add(record.id);
    if (!['available','unavailable'].includes(record.status)) return false;
    if (record.status === 'available' ? record.error !== null : typeof record.error !== 'string' || record.error.length < 1 || record.error.length > 160 || /[\x00-\x1f<>]/.test(record.error)) return false;
    const empty = ['price','previousClose','changePercent','asOf'].every(key => record[key] === null);
    if (empty) { if (record.status === 'available') return false; continue; }
    if (!positive(record.price) || !positive(record.previousClose) || !isQuoteTimestamp(record.asOf) || typeof record.changePercent !== 'number' || !Number.isFinite(record.changePercent)) return false;
    const calculated = (record.price / record.previousClose - 1) * 100;
    if (Math.abs(calculated - record.changePercent) > 0.000001) return false;
  }
  return true;
}

export function quoteState(record, nowISO = new Date().toISOString()) {
  if (!record || record.status !== 'available' || !positive(record.price) || !isQuoteTimestamp(record.asOf) || !isQuoteTimestamp(nowISO)) return 'unavailable';
  const age = Date.parse(nowISO) - Date.parse(record.asOf);
  return age < 0 || age > 300_000 ? 'stale' : 'latest';
}
