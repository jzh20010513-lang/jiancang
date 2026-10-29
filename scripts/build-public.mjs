import {mkdir,cp,readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {updateSnapshot} from './refresh-market.mjs';
import {updateSectorSnapshot} from './refresh-sectors.mjs';
export async function stagePublicAssets(source,destination){
 await mkdir(destination,{recursive:true});
 for(const name of ['favicon.svg','_headers','vendor'])await cp(join(source,name),join(destination,name),{recursive:true});
 await writeFile(join(destination,'market-data.json'),JSON.stringify(updateSnapshot(null,new Map())));
 await writeFile(join(destination,'sector-data.json'),JSON.stringify(updateSectorSnapshot(null,new Map())));
}
export async function buildPublic(){
 const root=resolve(import.meta.dirname,'..'),stage=await mkdtemp(join(tmpdir(),'jiancang-public-'));
 try{
  execFileSync(process.execPath,[join(root,'scripts/vendor.mjs')],{cwd:root,stdio:'inherit'});
  await stagePublicAssets(join(root,'public'),stage);
  const {build}=await import('vite');
  await build({root,publicDir:stage,define:{'import.meta.env.VITE_PUBLIC_STATIC':JSON.stringify('true')},build:{outDir:'out'}});
 }finally{await rm(stage,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await buildPublic();
