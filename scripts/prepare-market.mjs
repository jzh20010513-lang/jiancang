import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { MARKET_FILE, updateSnapshot, saveSnapshot } from './refresh-market.mjs';
import { validateMarketBundle } from '../src/markets.mjs';
export function normalizeForBuild(raw) {
  if(typeof raw!=='string'||Buffer.byteLength(raw)>1_000_000) throw new Error('Invalid or oversized public market bundle');
  return validateMarketBundle(JSON.parse(raw));
}
export async function prepareMarket() {
  let raw;
  try {raw=await readFile(MARKET_FILE,'utf8');}
  catch(error) {
    if(error.code!=='ENOENT') throw error;
    raw=JSON.stringify(updateSnapshot(null,new Map()));
  }
  // Reject untrusted fields before replacing anything; only a validated public copy enters the build.
  await saveSnapshot(normalizeForBuild(raw));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  if(process.argv.length!==2) throw new Error('No arguments accepted');
  await prepareMarket();
}
