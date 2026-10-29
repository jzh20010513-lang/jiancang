import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({acceptDownloads:true});page.setDefaultTimeout(5000);page.on('dialog',d=>d.accept());const click=a=>page.locator(`[data-action="${a}"]`).first().click();
try{
 await page.goto(process.env.BASE_URL||'http://127.0.0.1:4320');await click('data');assert.equal(await page.locator('[data-action="export-data"]').isEnabled(),false);await click('home');await click('plan');await page.locator('#risk-loss').fill('10');await click('save-plan');await click('data');assert.equal(await page.locator('[data-action="export-data"]').isEnabled(),true);
 const download=page.waitForEvent('download');await click('export-data');const backup=JSON.parse(await readFile(await(await download).path(),'utf8'));assert.equal(backup.snapshot.holdings.length,0);assert.equal(backup.planning.plan.riskProfile.lossTolerancePercent,'10');assert.equal(backup.planning.plan.purpose,'');assert.equal(backup.planning.plan.rules.length,0);
 await click('request-clear');await click('clear');await click('data');await page.locator('#restore-input').setInputFiles({name:'risk-only.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await click('apply');await click('plan');assert.equal(await page.locator('#risk-loss').inputValue(),'10');console.log('Risk-only goals export and restore without holdings or currency rules passed.');
}finally{await browser.close();}
