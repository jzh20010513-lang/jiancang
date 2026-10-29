import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage();page.setDefaultTimeout(4000);page.on('dialog',d=>d.accept());const errors=[],network=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>network.push({url:r.url(),method:r.method(),body:r.postData()}));
let count=0,fail=false;const origin=process.env.BASE_URL||'http://127.0.0.1:4320';
await page.route('**/api/market-quotes',r=>{count++;if(fail)return r.abort();const now=new Date().toISOString();return r.fulfill({contentType:'application/json',body:JSON.stringify({schemaVersion:1,mode:'live-public',fetchedAt:now,records:['sh000001','sz399001','sz399006','sh000300'].map(id=>({id,price:3000,previousClose:2999,changePercent:(3000/2999-1)*100,asOf:now,status:'available',error:null}))})});});
const click=a=>page.locator(`[data-action="${a}"]`).first().click();
try{
 await page.goto(origin);assert.equal(count,0,'no quote poll before holdings view');await click('demo');await page.locator('#live-market-quotes[data-loaded="true"]').waitFor();assert.equal(await page.locator('.live-price').count(),4);assert.match(await page.locator('#live-market-quotes').innerText(),/近期报价|延迟未知/);
 await click('toggle-quotes');assert.match(await page.locator('#live-market-quotes').innerText(),/已暂停/);
 fail=true;await click('refresh-quotes');await page.getByText('当天公共报价暂不可用',{exact:false}).waitFor();assert.equal(await page.locator('.live-price').count(),4,'old quote values retained with failurewarning');
 fail=false;await click('toggle-quotes');await page.locator('#live-market-quotes[data-loaded="true"]').waitFor();fail=true;await click('refresh-quotes');await page.getByText('当天公共报价暂不可用',{exact:false}).waitFor();await click('toggle-quotes');assert.match(await page.locator('#live-market-quotes').innerText(),/暂不可用/);assert.doesNotMatch(await page.locator('#live-market-quotes').innerText(),/近期报价/);
 await click('sectors');await page.locator('[data-sector="medical"]').check();await click('home');
 assert.deepEqual(errors,[]);assert.deepEqual(network.filter(r=>r.method!=='GET'||!r.url.startsWith(origin+'/')||new URL(r.url).search||r.body),[]);
 await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/live-market-preview.png',fullPage:true});await writeFile('artifacts/live-browser.json',JSON.stringify({errors,network,count},null,2));console.log('Live quote browser workflows passed with synthetic quotes.');
}finally{await browser.close();}
