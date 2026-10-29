import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();page.setDefaultTimeout(4000);page.on('dialog',d=>d.accept());
const requests=[],errors=[];page.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()}));page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(process.env.BASE_URL||'http://127.0.0.1:4320');await page.locator('[data-action="import"]').first().click();
 await page.locator('#text-recovery summary').click();
 await page.locator('#paste-text').fill('名称/金额 日收益 持有收益 累计收益\n合成现金产品\n灵活取用\n1,234.56 +0.12 +23.45\n占比12.34%\n合成全球股票(QDII)C\n基金 ，进阶理财\n2,345.67 +12.34 +23.45 +34.56\n占比23.45% +1.23%');
 await page.locator('[data-action="parse-paste"]').click();
 const rows=await page.locator('[data-row]').evaluateAll(els=>els.map(el=>({name:el.querySelector('[data-field="name"]').value,amount:el.querySelector('[data-field="marketValue"]').value,currency:el.querySelector('[data-field="currency"]').value,ready:el.querySelector('[data-field="ready"]').checked})));
 assert.deepEqual(rows,[{name:'合成现金产品',amount:'1234.56',currency:'',ready:false},{name:'合成全球股票(QDII)C',amount:'2345.67',currency:'',ready:false}]);
 await page.locator('.raw-text summary').click();await page.locator('#raw-text').fill('名称/金额 日收益 持有收益 累计收益\n占比99.99%');await page.locator('[data-action="parse-text"]').click();assert.equal(await page.locator('[data-row]').count(),2,'failed parsing preserves existing draft');
 assert.match(await page.locator('.notification').innerText(),/没有可靠/);assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(r=>r.method!=='GET'||r.body||r.url.includes('合成')),[]);
 console.log('Stacked Alipay text recovery workflows passed.');
}finally{await browser.close();}
