import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeSnapshot,newHolding} from '../src/domain.mjs';
import {exportFull,defaultLayout,defaultPlanning} from '../src/transfer.mjs';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({acceptDownloads:true});page.setDefaultTimeout(4000);page.on('dialog',d=>d.accept());
const click=a=>page.locator(`[data-action="${a}"]`).first().click();
try{
 const backup=exportFull(makeSnapshot(['合成海外基金','合成医药基金','尚未选板块'].map(name=>newHolding({name,marketValue:'100'}))),defaultLayout(),defaultPlanning());
 await page.goto(process.env.BASE_URL||'http://127.0.0.1:4320');await click('data');await page.locator('#restore-input').setInputFiles({name:'pending.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await click('apply');await click('sectors');
 for(const width of [360,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`manager overflow ${width}`);}
 await page.locator('[data-sector="us-tech"]').check();await page.locator('#sector-select').selectOption({index:1});await page.locator('[data-sector="pharma"]').check();await click('save-sectors');
 await page.locator('[data-sector-card="us-tech"]').waitFor();await page.locator('[data-sector-card="pharma"]').waitFor();assert.match(await page.locator('.notification').innerText(),/2.*确认|确认.*2/);
 await click('data');const dl=page.waitForEvent('download');await click('export-data');const saved=JSON.parse(await readFile(await(await dl).path(),'utf8'));assert.equal(saved.snapshot.holdings[0].sectorReview,'confirmed');assert.equal(saved.snapshot.holdings[1].sectorReview,'confirmed');assert.equal(saved.snapshot.holdings[2].sectorReview,undefined);assert.ok(saved.snapshot.holdings.every(r=>r.reviewStatus==='needs_attention'&&r.currency===null));assert.equal(saved.planning.previousSnapshot,null);
 await click('toggle-save');await page.getByRole('button',{name:'关闭保存并清除已存数据',exact:true}).waitFor();await page.evaluate(()=>{IDBObjectStore.prototype.put=function(){throw new DOMException('Synthetic quota failure','QuotaExceededError');};});await click('home');await click('sectors');await click('save-sectors');await page.locator('.notification').filter({hasText:'当前会话未保存'}).waitFor();assert.match(await page.locator('.notification').innerText(),/当前会话未保存|原保存内容仍保留|刷新会恢复旧版/);assert.doesNotMatch(await page.locator('.notification').innerText(),/已确认并保存/);
 console.log('Selecting then explicitly saving confirms all chosen sector mappings without extra per-row checkboxes.');
}finally{await browser.close();}
