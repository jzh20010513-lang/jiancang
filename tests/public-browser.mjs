import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const origin=process.env.BASE_URL||'http://127.0.0.1:4322';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage();
const requests=[],errors=[];page.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()}));page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(origin);await page.getByRole('button',{name:'体验虚构示例',exact:true}).click();
 await page.locator('[data-public-static]').waitFor();assert.match(await page.locator('[data-public-static]').innerText(),/暂未接入/);
 for(const f of ['market-data.json','sector-data.json']){const response=await page.request.get(origin+'/'+f);assert.equal(response.status(),200);const data=await response.json();assert.ok(data.records.every(r=>r.points.length===0));}
 const notices=await page.request.get(origin+'/vendor/THIRD_PARTY.txt');assert.equal(notices.status(),200);assert.match(await notices.text(),/Independent JPEG Group/);
 assert.ok(requests.every(r=>r.method==='GET'&&r.url.startsWith(origin+'/')&&!r.body));assert.ok(!requests.some(r=>r.url.includes('/api/market-quotes')),'public app must not attempt unlicensed live proxy');
 for(const width of [390,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await page.screenshot({path:'artifacts/public-build-synthetic.png',fullPage:true});assert.deepEqual(errors,[]);console.log('Public build: no quote proxy, empty market bundles, notices, responsive layout and browser-local requests verified.');
}finally{await browser.close();}
