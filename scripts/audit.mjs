import {readdir,readFile,mkdir,writeFile,lstat} from 'node:fs/promises';
import {resolve,join,relative} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(import.meta.dirname,'..'),dist=join(root,'dist');
const files=[];
async function walk(dir){for(const name of await readdir(dir)){const path=join(dir,name),stat=await lstat(path);if(stat.isSymbolicLink())throw Error('Symlink forbidden in static output');if(stat.isDirectory())await walk(path);else{
 const rel=relative(dist,path).replaceAll('\\','/');
 if(!/^(?:index\.html|(?:market|sector)-data\.json|favicon\.svg|_headers|assets\/[\w.-]+\.(?:js|css)|vendor\/(?:worker\.min\.js|THIRD_PARTY\.txt|core\/[\w.-]+|lang\/(?:chi_sim|eng)\.traineddata\.gz))$/.test(rel))throw Error('Unexpected output file');
 const bytes=await readFile(path);files.push({path:rel,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}}}
await walk(dist);
const scans=['src','scripts','tests','docs'];let hits=0,scanned=0;
async function scan(dir){for(const name of await readdir(dir)){const path=join(dir,name),s=await lstat(path);if(s.isSymbolicLink())throw Error('Source symlink forbidden');if(s.isDirectory())await scan(path);else if(/\.(mjs|md|css|html)$/.test(name)){scanned++;const text=await readFile(path,'utf8');hits+=(text.match(/(?:sk-[A-Za-z0-9]{24,}|ghp_[A-Za-z0-9]{24,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/g)||[]).length;}}}
for(const dir of scans)await scan(join(root,dir));
await mkdir(join(root,'artifacts'),{recursive:true});
await writeFile(join(root,'artifacts/build-manifest.json'),JSON.stringify({files,sourceFilesScanned:scanned,credentialPatternHits:hits},null,2));
if(hits)throw Error('Credential pattern hits: count='+hits);
console.log(`Static audit passed: ${files.length} files; credential pattern hits=${hits}; no symlinks.`);
