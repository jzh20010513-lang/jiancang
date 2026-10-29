import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage();page.on('dialog',d=>d.accept());const errors=[];page.on('pageerror',e=>errors.push(e.message));
const click=a=>page.locator(`[data-action="${a}"]`).first().click({timeout:3000});
try{
 await page.goto(process.env.BASE_URL||'http://127.0.0.1:4318');await click('import');await click('manual');
 await page.locator('[data-field="name"]').fill('合成半导体指数基金C');await page.locator('[data-field="marketValue"]').fill('12345.67');await page.locator('[data-field="currency"]').selectOption('CNY');
 await click('suggest-fund');await page.getByText('本地分类建议',{exact:true}).waitFor({timeout:3000});
 await click('apply-fund-suggestion');assert.equal(await page.locator('[data-field="category"]').inputValue(),'权益');assert.equal(await page.locator('[data-field="sectorReady"]').isChecked(),false);
 await page.locator('[data-field="sectorReady"]').check();await page.locator('[data-field="ready"]').check();await click('preview');await click('apply');await page.locator('[data-sector-card="semiconductor"]').waitFor();
 assert.deepEqual(errors,[]);console.log('Fund suggestion import workflows passed.');
}finally{await browser.close();}
