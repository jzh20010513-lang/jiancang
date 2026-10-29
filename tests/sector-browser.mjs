import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.BASE_URL||'http://127.0.0.1:4318';
const browser=await chromium.launch({channel:'msedge',headless:true});
const ctx=await browser.newContext({acceptDownloads:true}),page=await ctx.newPage();
const network=[],errors=[];
ctx.on('request',r=>{if(/^https?:/.test(r.url()))network.push({url:r.url(),method:r.method(),body:r.postData()});});
page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const click=action=>page.locator(`[data-action="${action}"]`).first().click({timeout:3000});
try{
 await page.goto(origin);await click('demo');
 await page.locator('#sector-observation').waitFor({timeout:3000});
 await page.locator('#sector-observation[data-loaded="true"]').waitFor();
 assert.equal(await page.locator('[data-sector-card="semiconductor"]').count(),1);
 assert.match(await page.locator('#sector-observation').textContent(),/情绪证据不足/);
 await click('sectors');await page.locator('[data-sector="semiconductor"]').uncheck();await page.locator('[data-sector="medical"]').check();await page.locator('#sector-confirmed').check();
 await page.locator('#sector-select').selectOption({index:1});await page.locator('[data-sector="ev"]').check();await page.locator('#sector-confirmed').uncheck();
 await click('save-sectors');await page.locator('[data-sector-card="medical"]').waitFor();assert.equal(await page.locator('[data-sector-card="ev"]').count(),1,'explicit save confirms selected mappings without separate per-row checkboxes');
 await page.locator('[data-sector-card="medical"] .sector-details').first().evaluate(el=>el.open=true);
 assert.match(await page.locator('[data-sector-card="medical"]').innerText(),/关联产品金额|非实际行业敞口/);
 await click('settings');await page.locator('#setting-mask').check();await click('close-settings');assert.doesNotMatch(await page.locator('#sector-observation').innerText(),/128,000/);
 await click('sectors');await page.locator('#sector-select').selectOption({index:0});await page.locator('[data-sector="medical"]').uncheck();await click('cancel-sectors');assert.equal(await page.locator('[data-sector-card="medical"]').count(),1,'cancel leaves mapping intact');
 await click('data');const d=page.waitForEvent('download');await click('export-data');const backup=JSON.parse(await readFile(await(await d).path(),'utf8'));
 assert.deepEqual(backup.snapshot.holdings[0].sectorIds,['medical']);assert.equal(backup.snapshot.holdings[1].sectorReview,'confirmed');assert.equal(backup.planning.previousSnapshot,null,'mapping edits do not advance prior snapshot');
 await click('request-clear');await click('clear');await click('data');await page.locator('#restore-input').setInputFiles({name:'sector-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await click('apply');await page.locator('[data-sector-card="medical"]').waitFor();
 await click('data');await click('toggle-save');await page.getByRole('button',{name:'关闭保存并清除已存数据',exact:true}).waitFor();await page.reload();await page.locator('[data-sector-card="medical"]').waitFor();
 await click('settings');const pureD=page.waitForEvent('download');await click('export-layout');const pure=JSON.parse(await readFile(await(await pureD).path(),'utf8'));assert.doesNotMatch(JSON.stringify(pure),/sector/);await click('close-settings');
 for(const width of [360,768,1280]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await page.setViewportSize({width:1280,height:1000});await page.evaluate(()=>scrollTo(0,0));await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/sectors-overview.png',fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(network.filter(r=>r.method!=='GET'||!r.url.startsWith(origin+'/')||new URL(r.url).search||r.body),[]);
 // No data must yield no technical numbers; fixed endpoint failure has an honest state.
 const empty=await browser.newContext();const p=await empty.newPage();await p.route('**/sector-data.json',r=>r.abort());await p.goto(origin);await p.locator('[data-action="demo"]').click();await p.locator('#sector-observation[data-loaded="true"]').waitFor();
 assert.match(await p.locator('#sector-observation').textContent(),/数据暂不可用/);assert.equal(await p.locator('#sector-observation .technical-value').count(),0);await empty.close();
 await writeFile('artifacts/sector-browser.json',JSON.stringify({passed:true,errors,network},null,2));console.log('Sector workflows passed.');
}finally{await browser.close();}
