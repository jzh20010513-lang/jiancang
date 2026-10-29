import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,readFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const build=await import('../scripts/build-public.mjs').catch(()=>({}));
test('public asset staging excludes local quotes, backups and unrecognized public files',async()=>{
 assert.equal(typeof build.stagePublicAssets,'function');
 const dir=await mkdtemp(join(tmpdir(),'jiancang-public-test-'));try{
 const src=join(dir,'src'),out=join(dir,'out');await mkdir(join(src,'vendor'),{recursive:true});
 for(const file of ['favicon.svg','_headers','market-data.json','sector-data.json','personal-backup.json'])await writeFile(join(src,file),'SYNTHETIC_LOCAL_CACHE');
 await build.stagePublicAssets(src,out);
 assert.deepEqual((await readdir(out)).sort(),['_headers','favicon.svg','market-data.json','sector-data.json','vendor'].sort());
 for(const file of ['market-data.json','sector-data.json']){const text=await readFile(join(out,file),'utf8');assert.doesNotMatch(text,/SYNTHETIC_LOCAL_CACHE/);const data=JSON.parse(text);assert.ok(data.records.every(r=>r.points.length===0&&r.status==='unavailable'));}
 assert.equal(await readFile(join(src,'market-data.json'),'utf8'),'SYNTHETIC_LOCAL_CACHE','local cache must remain unchanged');
 }finally{await rm(dir,{recursive:true,force:true});}
});
