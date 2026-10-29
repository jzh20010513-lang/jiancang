import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage({viewport:{width:1100,height:700}});
page.setDefaultTimeout(4000);page.on('dialog',d=>d.accept());const click=a=>page.locator(`[data-action="${a}"]`).first().click();
try{
 await page.goto(process.env.BASE_URL||'http://127.0.0.1:4320');await click('demo');await click('plan');
 const cny=page.locator('[data-goal-currency="CNY"]'),alloc=cny.locator('[data-goal="allocations"]');
 await page.locator('#goal-purpose').fill('合成用途保留');await alloc.fill('保持我的配置');await click('save-plan');
 const error=page.locator('#goal-save-error');await error.waitFor();assert.match(await error.innerText(),/类别名=目标百分比/);assert.equal(await error.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),true);assert.equal(await alloc.inputValue(),'保持我的配置');
 await cny.locator('[data-action="keep-allocation"]').click();assert.equal(await alloc.inputValue(),'');assert.equal(await cny.locator('[data-goal="maxSinglePercent"]').inputValue(),'40');await click('save-plan');await page.locator('#checkup-section').waitFor();assert.match(await page.locator('#checkup-section').innerText(),/合成用途保留/);
 await click('plan');await page.locator('#risk-loss').fill('101');await click('save-plan');await error.waitFor();assert.match(await error.innerText(),/0至100/);assert.equal(await page.locator('#risk-loss').inputValue(),'101');
 for(const width of [360,768,1100]){await page.setViewportSize({width,height:700});await error.evaluate(el=>el.scrollIntoView({block:'center'}));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${width}`);assert.equal(await error.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),true);}
 console.log('Goal validation feedback remains visible and preserves drafts; keeping current allocation saves other rules.');
}finally{await browser.close();}
