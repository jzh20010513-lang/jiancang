import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {SECTOR_CATALOG} from '../src/sector-catalog.mjs';
import {MARKET_CATALOG} from '../src/market-catalog.mjs';
import {VIX_SOURCE} from '../src/volatility.mjs';
import {makeSnapshot,newHolding} from '../src/domain.mjs';
import {exportFull,defaultPlanning,defaultLayout} from '../src/transfer.mjs';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage();page.setDefaultTimeout(5000);page.on('dialog',d=>d.accept());const errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>network.push(r));const click=a=>page.locator(`[data-action="${a}"]`).first().click();const origin=process.env.BASE_URL||'http://127.0.0.1:4320';
try{
 const now=new Date(),end=new Date(now);end.setUTCDate(end.getUTCDate()-1);
 const points=Array.from({length:253},(_,i)=>{const d=new Date(end);d.setUTCDate(d.getUTCDate()-252+i);return {date:d.toISOString().slice(0,10),close:100+i};});
 const sector={schemaVersion:1,mode:'public-snapshot',generatedAt:now.toISOString(),records:SECTOR_CATALOG.map(item=>({id:item.id,source:item.source,status:'available',error:null,points:points.map(p=>({...p,open:p.close,high:p.close,low:p.close,volume:item.kind==='index'?null:100}))})),context:{vix:{source:VIX_SOURCE,status:'available',error:null,points:points.map((p,i)=>({date:p.date,close:i===252?22:20}))}}};
 const market={schemaVersion:1,mode:'public-snapshot',generatedAt:now.toISOString(),records:MARKET_CATALOG.map(item=>({id:item.id,source:item.source,quote:null,status:'available',error:null,points}))};
 await page.route('**/sector-data.json',r=>r.fulfill({json:sector}));await page.route('**/market-data.json',r=>r.fulfill({json:market}));await page.goto(origin);await click('data');
 const snapshot=makeSnapshot(['us-tech','hk-tech'].map(id=>newHolding({name:'SYNTHETIC_'+id,marketValue:'100',currency:'CNY',reviewStatus:'confirmed',sectorReview:'confirmed',sectorIds:[id]})));
 await page.locator('#restore-input').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exportFull(snapshot,defaultLayout(),defaultPlanning())))});await click('apply');
 const us=page.locator('[data-sector-card="us-tech"]'),hk=page.locator('[data-sector-card="hk-tech"]');await us.locator('[data-volatility-state="available"]').waitFor();assert.match(await us.innerText(),/VIX收盘：22.00/);assert.match(await us.innerText(),/标普500/);assert.equal(await hk.locator('.volatility-evidence').getAttribute('data-volatility-state'),'not-applicable');assert.doesNotMatch(await hk.innerText(),/VIX收盘/);
 await us.locator('.volatility-evidence details summary').click();assert.match(await us.innerText(),/非风险评分/);assert.match(await us.innerText(),/不预测涨跌方向/);assert.match(await us.locator('.market-evidence').innerText(),/纳斯达克100[\s\S]*标普500[\s\S]*百分点/);
 for(const width of [360,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
 await mkdir('artifacts',{recursive:true});await us.screenshot({path:'artifacts/volatility-synthetic.png'});
 let capture;const routeReady=new Promise(r=>capture=r);await page.route('**/sector-data.json',r=>capture(r));await click('reload-sectors');const held=await routeReady;assert.equal(await us.locator('.volatility-evidence').getAttribute('data-volatility-state'),'unavailable');await held.abort();await page.locator('#sector-observation .warning').waitFor();assert.doesNotMatch(await us.innerText(),/VIX收盘：22/);assert.deepEqual(errors,[]);assert.ok(network.every(r=>r.method()==='GET'&&r.url().startsWith(origin+'/')&&!r.postData()&&!r.url().includes('SYNTHETIC_')));console.log('VIX partial evidence, market scope, absolute comparison, loading/failure and privacy browser workflow passed.');
}finally{await browser.close();}
