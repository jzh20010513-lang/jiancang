import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.BASE_URL||'http://127.0.0.1:4318';
const browser=await chromium.launch({channel:'msedge',headless:true});const ctx=await browser.newContext({acceptDownloads:true});const page=await ctx.newPage();
const network=[],errors=[];ctx.on('request',r=>{if(/^https?:/.test(r.url()))network.push({url:r.url(),method:r.method(),body:r.postData()});});page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
const click=action=>page.locator(`[data-action="${action}"]`).first().click({timeout:5000});
try{
 await page.goto(origin);await click('demo');await page.locator('#related-markets').waitFor({timeout:1500});
 await page.locator('#related-markets[data-loaded="true"]').waitFor();assert.ok(await page.locator('[data-market-card]').count()>=2);assert.match(await page.locator('#related-markets').innerText(),/参考|收盘/);
 assert.equal(await page.locator('#checkup-section .finding-grid > article').count()<=3,true,'compact checkup');
 await click('markets');await page.locator('#mapping-select').selectOption({index:0});
 for(const id of ['cn-growth','hk-broad','us-broad'])await page.locator(`[data-benchmark="${id}"]`).check();
 await page.locator('#mapping-select').selectOption({index:1});assert.equal(await page.locator('#mapping-select').inputValue(),'0','invalid mapping must keep selector on the actual edited asset');
 for(const id of ['cn-growth','us-broad'])await page.locator(`[data-benchmark="${id}"]`).uncheck();
 await page.locator('[data-benchmark="cn-large"]').uncheck();await page.locator('[data-benchmark="hk-broad"]').check();await page.locator('#mapping-confirmed').check();await page.locator('[data-pin="us-broad"]').check();await page.locator('[data-hide="us-tech"]').check();await click('save-markets');
 await page.locator('#related-markets [data-market-card="hk-broad"]').waitFor();assert.equal(await page.locator('[data-market-card="us-tech"]').count(),0);assert.equal(await page.locator('[data-market-card="us-broad"]').count(),1);
 await page.locator('[data-market-card="hk-broad"] [data-range="1m"]').click();assert.match(await page.locator('[data-market-card="hk-broad"]').innerText(),/1月|1 月/);
 await page.locator('[data-market-card="hk-broad"] [data-action="market-reason"]').click();assert.match(await page.locator('[data-market-card="hk-broad"]').innerText(),/远山宽基组合/);
 await click('data');const dl=page.waitForEvent('download');await click('export-data');const backup=JSON.parse(await readFile(await (await dl).path(),'utf8'));assert.equal(backup.snapshot.holdings[0].benchmarkReview,'confirmed');assert.deepEqual(backup.snapshot.holdings[0].benchmarkIds,['hk-broad']);assert.ok(backup.planning.marketPreferences.pinned.includes('us-broad'));
 await click('request-clear');await click('clear');await page.getByRole('heading',{name:'让持仓，清晰可见。'}).waitFor();await click('data');await page.locator('#restore-input').setInputFiles({name:'market-backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await click('apply');await page.locator('[data-market-card="hk-broad"]').waitFor();await click('data');await click('toggle-save');await page.getByRole('button',{name:'关闭保存并清除已存数据',exact:true}).waitFor();await page.reload();await page.locator('[data-market-card="hk-broad"]').waitFor();assert.equal(await page.locator('[data-market-card="us-tech"]').count(),0,'hidden choice restored');
 await click('home');await click('settings');const pureDownload=page.waitForEvent('download');await click('export-layout');const pure=JSON.parse(await readFile(await (await pureDownload).path(),'utf8'));assert.doesNotMatch(JSON.stringify(pure),/benchmark|pinned|hiddenRelated|marketPreferences/);await click('close-settings');
 await page.setViewportSize({width:1280,height:1000});await page.evaluate(()=>scrollTo(0,0));await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/markets-overview.png'});
 for(const width of [360,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await mkdir('artifacts',{recursive:true});await page.screenshot({path:`artifacts/markets-${width}.png`,fullPage:true});}
 // All users read the same URL regardless of changed mapping; model requests not triggered here.
 assert.deepEqual(network.filter(r=>r.method!=='GET'||!r.url.startsWith(origin+'/')||r.url.includes('hk-broad')||r.body),[]);assert.deepEqual(errors,[]);
 await ctx.close();const unavailable=await browser.newContext();const p=await unavailable.newPage();await p.route('**/market-data.json',r=>r.abort());await p.goto(origin);await p.locator('[data-action="demo"]').click();await p.locator('#related-markets').waitFor();await p.getByText('公共行情暂不可用',{exact:false}).first().waitFor();assert.equal(await p.locator('.market-sparkline').count(),0,'failure must not create fake curves');await unavailable.close();
 await writeFile('artifacts/market-browser.json',JSON.stringify({passed:true,errors,network},null,2));console.log('Related market workflows passed.');
}finally{await browser.close();}
