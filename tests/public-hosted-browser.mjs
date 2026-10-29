import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const origin=process.env.BASE_URL||'https://jiancang-jzh20010513.jzh20010513.chatgpt.site';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage();
const requests=[],errors=[];page.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()}));page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(origin);await page.getByRole('button',{name:'体验虚构示例',exact:true}).click();
 await page.locator('[data-public-static]').waitFor();assert.match(await page.locator('[data-public-static]').innerText(),/暂未接入/);
 for(const f of ['market-data.json','sector-data.json']){const response=await page.evaluate(async path=>{const r=await fetch(path);return {status:r.status,text:await r.text()};},'/'+f);assert.equal(response.status,200);const data=JSON.parse(response.text);assert.ok(data.records.every(r=>r.points.length===0));}
 const notices=await page.evaluate(async()=>{const r=await fetch('/vendor/THIRD_PARTY.txt');return {status:r.status,text:await r.text()};});assert.equal(notices.status,200);assert.match(notices.text,/Independent JPEG Group/);
 const platform=requests.filter(r=>new URL(r.url).pathname.startsWith('/cdn-cgi/challenge-platform/'));const application=requests.filter(r=>!platform.includes(r));assert.ok(application.every(r=>r.method==='GET'&&r.url.startsWith(origin+'/')&&!r.body));assert.ok(platform.every(r=>r.url.startsWith(origin+'/')));console.log('Hosting security validation requests (separate from application): '+platform.length); // Does not inspect or certify opaque platform payloads.assert.ok(!requests.some(r=>r.url.includes('/api/market-quotes')),'public app must not attempt unlicensed live proxy');
 for(const width of [390,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await page.screenshot({path:'artifacts/public-hosted-synthetic.png',fullPage:true});assert.deepEqual(errors,[]);console.log('Public build: no quote proxy, empty market bundles, notices, responsive layout and browser-local requests verified.');
}finally{await browser.close();}
