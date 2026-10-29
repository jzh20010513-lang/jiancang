import {mkdir,copyFile,readdir,writeFile,readFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..'), dest=join(root,'public/vendor');
await mkdir(join(dest,'core'),{recursive:true}); await mkdir(join(dest,'lang'),{recursive:true});
await copyFile(join(root,'node_modules/tesseract.js/dist/worker.min.js'),join(dest,'worker.min.js'));
for(const f of await readdir(join(root,'node_modules/tesseract.js-core'))) if(/\.wasm(\.js)?$/.test(f)) await copyFile(join(root,'node_modules/tesseract.js-core',f),join(dest,'core',f));
for(const lang of ['chi_sim','eng']) await copyFile(join(root,`node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`),join(dest,'lang',`${lang}.traineddata.gz`));
const notices=['JianCang application source: MIT. Third-party files retain their own licenses.\nInstalled package inventory includes build/test dependencies, not all of which ship in the browser.'];
const lock=JSON.parse(await readFile(join(root,'package-lock.json'),'utf8'));
for(const key of Object.keys(lock.packages).filter(k=>k.startsWith('node_modules/')).sort()) {
 if(key.includes('..'))throw Error('Invalid lockfile package path');
 const dir=join(root,key);let pkg;try{pkg=JSON.parse(await readFile(join(dir,'package.json'),'utf8'));}catch(e){if(e.code==='ENOENT')continue;throw e;}
 const names=(await readdir(dir)).filter(f=>/^(?:licen[sc]e|notice|copying)(?:$|[.-])/i.test(f));
 const texts=await Promise.all(names.map(async f=>f+'\n'+await readFile(join(dir,f),'utf8')));
 notices.push(`${pkg.name} ${pkg.version}\nDeclared license: ${pkg.license}\n${texts.length?texts.join('\n\n'):'No standalone license text in installed package; see THIRD_PARTY.md for scope and upstream.'}`);
}
notices.push('Embedded worker notice: worker.min.js.LICENSE.txt\n'+await readFile(join(root,'node_modules/tesseract.js/dist/worker.min.js.LICENSE.txt'),'utf8'));
for(const [name,file] of [['naptha/tessdata upstream - Apache-2.0','naptha-tessdata-APACHE-2.0.txt'],['tesseract-ocr/tessdata_best upstream - Apache-2.0','tessdata-best-APACHE-2.0.txt']])notices.push(name+'\n'+await readFile(join(root,'licenses',file),'utf8'));
await writeFile(join(dest,'THIRD_PARTY.txt'),notices.join('\n\n----------------\n\n'));
console.log('Local OCR assets prepared. No runtime CDN required.');
