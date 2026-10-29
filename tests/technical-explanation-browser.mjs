import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const origin=process.env.BASE_URL||'http://127.0.0.1:4320',browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage();page.setDefaultTimeout(5000);page.on('dialog',d=>d.accept());const errors=[];page.on('pageerror',e=>errors.push(e.message));
const click=a=>page.locator(`[data-action="${a}"]`).first().click();
try{
 const source=await(await page.request.get(origin+'/sector-data.json')).json();const last=new Date();last.setUTCDate(last.getUTCDate()-1);const lastDate=last.toISOString().slice(0,10);
 const points=Array.from({length:80},(_,i)=>{const date=new Date(last);date.setUTCDate(date.getUTCDate()-(79-i));const close=200-i*i*.01;return {date:date.toISOString().slice(0,10),open:close,high:close,low:close,close,volume:100};});points.at(-1).volume=200;
 for(const r of source.records)Object.assign(r,{points:structuredClone(points).map(p=>({...p,volume:['us-growth','hk-tech-reference'].includes(r.id)?null:p.volume})),status:'available',error:null});
 let fail=false;await page.route('**/sector-data.json',route=>fail?route.abort():route.fulfill({json:source}));await page.goto(origin);await click('demo');
 const card=page.locator('[data-sector-card="semiconductor"] .technical-explanation');await card.waitFor();assert.match(await card.innerText(),/趋势[\s\S]*动能[\s\S]*量能/);assert.match(await card.innerText(),/2.00倍/);assert.match(await card.innerText(),/日线|周线尚未确认/);assert.match(await card.innerText(),new RegExp(lastDate));
 for(const width of [360,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${width}`);}
 await mkdir('artifacts',{recursive:true});await card.screenshot({path:'artifacts/technical-explanation-synthetic.png'});
 fail=true;await click('reload-sectors');await page.locator('#sector-observation .warning').waitFor();assert.equal(await card.getAttribute('data-technical-state'),'unavailable');assert.match(await card.innerText(),/读取失败/);assert.doesNotMatch(await card.innerText(),/2.00倍|负柱变长/);assert.deepEqual(errors,[]);
 console.log('Daily trend/momentum/volume explanations, viewport and retained-data reload failure checks passed.');
}finally{await browser.close();}
