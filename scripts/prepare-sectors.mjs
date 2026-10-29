import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { validateSectorBundle } from '../src/sector-data.mjs';
import { SECTOR_CATALOG } from '../src/sector-catalog.mjs';
import { SECTOR_FILE, updateSectorSnapshot, saveSectorSnapshot } from './refresh-sectors.mjs';

export function normalizeSectorForBuild(raw,options){
 if(raw===undefined)return updateSectorSnapshot(null,new Map());
 if(typeof raw!=='string'||Buffer.byteLength(raw)>1_000_000)throw new Error('Invalid or oversized public sector bundle');
 const checked=validateSectorBundle(JSON.parse(raw),options);
 return validateSectorBundle({...checked,records:SECTOR_CATALOG.map(item=>checked.records.find(r=>r.id===item.id)||{id:item.id,points:[],source:{...item.source},status:'unavailable',error:'新增参考尚未采集'})},options);
}
export async function prepareSectors(){
 let raw;try{raw=await readFile(SECTOR_FILE,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
 // Validation completes before writing. Builds never invoke network refresh.
 const normalized=normalizeSectorForBuild(raw);await saveSectorSnapshot(normalized);return normalized;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw new Error('No arguments accepted');await prepareSectors();
}
