import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.BASE_URL||'http://127.0.0.1:4318';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({acceptDownloads:true});const page=await context.newPage();
const errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()}));
try{
 await page.goto(origin);
 await page.getByRole('heading',{name:'让持仓，清晰可见。'}).waitFor();
 await page.getByRole('button',{name:'体验虚构示例',exact:true}).click();
 assert.match(await page.locator('#app').innerText(),/200,000/);
 await page.getByRole('button',{name:'自定义看板',exact:true}).click();
 await page.getByLabel('隐藏金额').check();
 await page.getByRole('button',{name:'完成设置'}).click();
 assert.doesNotMatch(await page.locator('#dashboard').innerText(),/200,000/);
 await page.getByRole('button',{name:'自定义看板',exact:true}).click();await page.getByLabel('隐藏金额').uncheck();await page.getByRole('button',{name:'完成设置'}).click();
 for(const width of [360,768,1280]){
  await page.setViewportSize({width,height:900});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${width}`);
  await mkdir('artifacts',{recursive:true});await page.screenshot({path:`artifacts/dashboard-${width}.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);
 assert.equal(requests.filter(r=>r.method!=='GET'||!r.url.startsWith(origin+'/')).length,0);
 await writeFile('artifacts/browser-report.json',JSON.stringify({errors,requests,viewports:[360,768,1280]},null,2));
 console.log('Browser smoke passed.');
}finally{await browser.close();}
