import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir} from 'node:fs/promises';
import {makeSnapshot,newHolding} from '../src/domain.mjs';
import {exportFull,defaultLayout,defaultPlanning} from '../src/transfer.mjs';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({acceptDownloads:true});page.setDefaultTimeout(5000);page.on('dialog',d=>d.accept());
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const click=a=>page.locator(`[data-action="${a}"]`).first().click();
try{
 const snapshot=makeSnapshot([newHolding({name:'合成科技配置',marketValue:'40',currency:'CNY',reviewStatus:'confirmed',sectorReview:'confirmed',sectorIds:['us-tech','semiconductor'],asOfDate:'2026-10-27'}),newHolding({name:'合成现金配置',marketValue:'60',currency:'CNY',reviewStatus:'confirmed',sectorReview:'confirmed',sectorIds:[],asOfDate:'2026-10-27'})]);
 await page.goto(process.env.BASE_URL||'http://127.0.0.1:4320');await click('data');await page.locator('#restore-input').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportFull(snapshot,defaultLayout(),defaultPlanning())))});await click('apply');await click('plan');
 await page.locator('#risk-loss').fill('10');await page.locator('#risk-need-by').fill('2099-01-01');await page.locator('#risk-sector-cap').fill('30');await click('save-plan');
 for(const sector of ['us-tech','semiconductor']){const g=page.locator(`[data-sector-card="${sector}"] .sector-guidance`);await g.waitFor();assert.equal(await g.getAttribute('data-guidance'),'cap');assert.match(await g.innerText(),/40.00%/);assert.match(await g.innerText(),/重复|上限/);}
 const card=page.locator('[data-sector-card="us-tech"]');await card.locator('.sector-guidance details summary').click();assert.match(await card.innerText(),/假设波动金额 10/);assert.match(await card.innerText(),/情绪证据不足/);
 for(const width of [360,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${width}`);}
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/sector-guidance-synthetic.png',fullPage:true});
 await click('data');const dl=page.waitForEvent('download');await click('export-data');const backup=JSON.parse(await readFile(await(await dl).path(),'utf8'));assert.equal(backup.planning.plan.riskProfile.sectorCapPercent,'30');assert.equal(backup.planning.previousSnapshot,null);
 await click('home');await click('settings');await page.locator('#setting-mask').check();await click('close-settings');assert.doesNotMatch(await page.locator('#sector-observation .sector-guidance').first().innerText(),/40.00%|30%|假设波动金额 10/);
 await click('settings');await page.locator('#setting-mask').uncheck();await click('close-settings');await click('plan');await page.locator('#risk-sector-cap').fill('50');await page.locator('#risk-need-by').fill('2001-01-01');await click('save-plan');assert.equal(await page.locator('[data-sector-card="us-tech"] .sector-guidance').getAttribute('data-guidance'),'liquidity');
 await click('data');await page.locator('#restore-input').setInputFiles({name:'roundtrip.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await click('apply');assert.equal(await page.locator('[data-sector-card="us-tech"] .sector-guidance').getAttribute('data-guidance'),'cap');assert.deepEqual(errors,[]);
 console.log('Personal profile → sector guidance → mask → backup → updated goals browser workflow passed.');
}finally{await browser.close();}
