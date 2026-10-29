import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {makeSnapshot,newHolding} from '../src/domain.mjs';
import {exportFull,defaultLayout,defaultPlanning} from '../src/transfer.mjs';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage();page.setDefaultTimeout(5000);page.on('dialog',d=>d.accept());const errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>network.push({url:r.url(),method:r.method(),body:r.postData()}));const click=a=>page.locator(`[data-action="${a}"]`).first().click();
const origin=process.env.BASE_URL||'http://127.0.0.1:4320';
try{
 const snapshot=makeSnapshot(['us-tech','hk-tech'].map(id=>newHolding({name:'SYNTHETIC_'+id,marketValue:'100',currency:'CNY',reviewStatus:'confirmed',sectorIds:[id],sectorReview:'confirmed'})));
 await page.goto(origin);await click('data');await page.locator('#restore-input').setInputFiles({name:'synthetic-overseas.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportFull(snapshot,defaultLayout(),defaultPlanning())))});await click('apply');
 for(const [id,name,benchmark] of [['us-tech','纳斯达克100','标普500'],['hk-tech','恒生科技','恒生指数']]){
  const card=page.locator(`[data-sector-card="${id}"]`);await card.waitFor();assert.match(await card.innerText(),new RegExp(name));assert.match(await card.innerText(),new RegExp(benchmark));assert.doesNotMatch(await card.innerText(),/沪深300|ETF观察代理/);
  await card.locator('.weekly-observation > summary').click();assert.equal(await card.locator('.weekly-observation [data-technical-state]').getAttribute('data-technical-state'),'available');assert.match(await card.locator('.weekly-observation').innerText(),/周线/);assert.doesNotMatch(await card.locator('.technical-explanation').first().innerText(),/周线尚未确认/);
  await card.locator('.sector-details > summary').click();assert.match(await card.innerText(),/参考收盘（点）/);
 }
 for(const width of [360,768,1280]){await page.setViewportSize({width,height:950});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${width}`);}
 await mkdir('artifacts',{recursive:true});await page.locator('#sector-observation').screenshot({path:'artifacts/overseas-synthetic.png'});
 await page.route('**/sector-data.json',r=>r.abort());await click('reload-sectors');await page.locator('#sector-observation .warning').waitFor();assert.equal(await page.locator('[data-sector-card="us-tech"] .weekly-observation [data-technical-state]').getAttribute('data-technical-state'),'unavailable');
 assert.deepEqual(errors,[]);assert.ok(network.every(r=>r.method==='GET'&&r.url.startsWith(origin+'/')&&!r.url.includes('SYNTHETIC_')&&!r.body));console.log('Overseas reference identity, local benchmarks, complete weekly view, units and privacy browser checks passed.');
}finally{await browser.close();}
