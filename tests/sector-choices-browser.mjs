import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {makeSnapshot,newHolding} from '../src/domain.mjs';
import {exportFull,defaultLayout,defaultPlanning} from '../src/transfer.mjs';
const browser=await chromium.launch({channel:'msedge',headless:true}),ctx=await browser.newContext({acceptDownloads:true}),page=await ctx.newPage();page.setDefaultTimeout(4000);page.on('dialog',d=>d.accept());const errors=[];page.on('pageerror',e=>errors.push(e.message));
const click=a=>page.locator(`[data-action="${a}"]`).first().click();
try{
 await page.goto(process.env.BASE_URL||'http://127.0.0.1:4320');await click('demo');await click('sectors');assert.ok(await page.locator('[data-sector="us-tech"]').count());
 await page.locator('[data-sector="semiconductor"]').uncheck();await page.locator('[data-sector="us-tech"]').check();await page.locator('#custom-sector-names').fill('自选海外主题');await page.locator('#sector-confirmed').check();await click('save-sectors');
 await page.locator('[data-sector-card="us-tech"]').waitFor();assert.match(await page.locator('[data-sector-card="us-tech"]').textContent(),/美股科技|专属行情/);assert.match(await page.locator('[data-sector-card="us-tech"]').textContent(),/纳斯达克100|市场参考/);assert.equal(await page.locator('[data-sector-card^="custom:"] .technical-value').count(),0);
 await click('sectors');await page.locator('#sector-search').fill('美股');await click('filter-sectors');assert.equal(await page.locator('[data-sector="us-tech"]').isChecked(),true);assert.equal(await page.locator('#custom-sector-names').inputValue(),'自选海外主题');await click('save-sectors');
 await click('data');const d=page.waitForEvent('download');await click('export-data');const backup=JSON.parse(await readFile(await(await d).path(),'utf8'));assert.deepEqual(backup.snapshot.holdings[0].sectorIds,['us-tech']);assert.deepEqual(backup.snapshot.holdings[0].customSectorNames,['自选海外主题']);
 await click('request-clear');await click('clear');await click('data');await page.locator('#restore-input').setInputFiles({name:'sector-choices.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await click('apply');await page.locator('[data-sector-card="us-tech"]').waitFor();assert.match(await page.locator('#sector-observation').textContent(),/自选海外主题/);
 for(const width of [360,768,1280]){await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await click('sectors');await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/sector-choices.png',fullPage:true});assert.deepEqual(errors,[]);console.log('Expanded sector choices and custom backup browser workflows passed.');
 const limit=await ctx.newPage();limit.setDefaultTimeout(4000);limit.on('dialog',d=>d.accept());await limit.goto(process.env.BASE_URL||'http://127.0.0.1:4320');await limit.locator('[data-action="data"]').first().click();
 const backupLimit=exportFull(makeSnapshot([newHolding({name:'合成半导体指数A',marketValue:'100',currency:'CNY',reviewStatus:'confirmed',sectorIds:[],sectorReview:'unreviewed',customSectorNames:['甲主题','乙主题','丙主题']})]),defaultLayout(),defaultPlanning());
 await limit.locator('#restore-input').setInputFiles({name:'limit.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backupLimit))});await limit.locator('[data-action="apply"]').click();await limit.locator('[data-action="edit"]').first().click();await limit.locator('[data-action="apply-fund-suggestion"]').click();await limit.getByText('候选与自定义分类合计最多3项',{exact:false}).waitFor();assert.equal(await limit.locator('[data-field="category"]').inputValue(),'');await limit.close();
}finally{await browser.close();}
