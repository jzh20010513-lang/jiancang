import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const ctx=await browser.newContext({acceptDownloads:true});const page=await ctx.newPage();
const errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));ctx.on('request',r=>{if(/^https?:/.test(r.url()))network.push({url:r.url(),method:r.method(),body:r.postData()});});page.on('dialog',d=>d.accept());
const click=(action)=>page.locator(`[data-action="${action}"]`).first().click({timeout:5000});
const rule=currency=>page.locator(`[data-goal-currency="${currency}"]`);
const origin=process.env.BASE_URL||'http://127.0.0.1:4318';
try{
 await page.goto(origin);await click('demo');
 await page.locator('#checkup-section').waitFor({timeout:1500});
 assert.match(await page.locator('#checkup-section').innerText(),/目标|体检/);
 await click('plan');
 await page.locator('#goal-purpose').fill('TEST_GOAL_PRIVACY_教育用途');
 const cny=rule('CNY');await cny.locator('[data-goal="enabled"]').check();
 await cny.locator('[data-goal="allocations"]').fill('权益=50\n现金=20\n固收=30');
 await cny.locator('[data-goal="deviationThreshold"]').fill('5');await cny.locator('[data-goal="maxSinglePercent"]').fill('40');await cny.locator('[data-goal="requiredLiquid"]').fill('60000');await cny.locator('[data-goal="needBy"]').fill('2027-01-01');
 await click('save-plan');await page.locator('#checkup-section').waitFor();
 assert.equal(await page.evaluate(()=>scrollY),0,'saving a plan should return to the top of the checkup');
 const before=await page.locator('#checkup-section').innerText();assert.match(before,/TEST_GOAL_PRIVACY/);assert.match(await page.locator('#checkup-section').textContent(),/集中|上限/);assert.match(before,/可用|流动/);assert.doesNotMatch(before,/建议买入|建议卖出|保证收益/);
 await page.setViewportSize({width:1280,height:1000});await mkdir('artifacts',{recursive:true});await page.screenshot({path:'artifacts/checkup-overview.png'});
 await page.locator('#filter-query').fill('海外');await page.locator('#filter-query').press('Tab');assert.equal(await page.locator('#checkup-section').innerText(),before,'checkup must ignore dashboard filters');
 await click('settings');await page.getByLabel('隐藏金额').check();await click('close-settings');assert.doesNotMatch(await page.locator('#checkup-section').innerText(),/128,000|60,000|42,000/);
 await click('data');const dp=page.waitForEvent('download');await click('export-data');const backup=JSON.parse(await readFile(await (await dp).path(),'utf8'));assert.equal(backup.schemaVersion,2);assert.equal(backup.planning.plan.purpose,'TEST_GOAL_PRIVACY_教育用途');
 await click('home');await click('settings');const lp=page.waitForEvent('download');await click('export-layout');const pure=JSON.parse(await readFile(await (await lp).path(),'utf8'));assert.doesNotMatch(JSON.stringify(pure),/TEST_GOAL_PRIVACY|planning|previousSnapshot|requiredLiquid/);await click('close-settings');
 await click('plan');await cny.locator('[data-goal="allocations"]').fill('权益=80');await click('save-plan');assert.equal(await cny.locator('[data-goal="allocations"]').inputValue(),'权益=80');assert.ok(await page.locator('#goal-purpose').isVisible(),'invalid goal form must remain');await click('cancel-plan');
 await click('data');await click('toggle-save');await page.getByRole('button',{name:'关闭保存并清除已存数据',exact:true}).waitFor();await page.reload();assert.match(await page.locator('#checkup-section').innerText(),/TEST_GOAL_PRIVACY/);
 await page.evaluate(()=>{window.originalPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw Error('synthetic quota');};});
 await click('plan');await page.locator('#goal-purpose').fill('SHOULD_NOT_SAVE');await click('save-plan');await page.locator('#goal-save-error').filter({hasText:'目标未保存'}).waitFor();await click('cancel-plan');assert.match(await page.locator('#checkup-section').innerText(),/TEST_GOAL_PRIVACY/);assert.doesNotMatch(await page.locator('#checkup-section').innerText(),/SHOULD_NOT_SAVE/);await page.evaluate(()=>{IDBObjectStore.prototype.put=window.originalPut;});
 await click('edit');await page.locator('[data-row="0"] [data-field="marketValue"]').fill('130000');await page.getByLabel('将未核对 / 不完整的行作为待补行保留（不计入统计）').check();await click('preview');await click('apply');await page.locator('#checkup-section').waitFor();assert.match(await page.locator('.snapshot-change').textContent(),/暂无上次/);assert.equal(await page.locator('.snapshot-change tbody tr').count(),0);
 // Real replacement retains a single previous snapshot; editing alone above does not.
 await click('import');await click('manual');await page.locator('[data-row="0"] [data-field="name"]').fill('新导入资产');await page.locator('[data-row="0"] [data-field="marketValue"]').fill('100');await page.locator('[data-row="0"] [data-field="currency"]').selectOption('CNY');await page.locator('[data-row="0"] [data-field="ready"]').check();await click('preview');await click('apply');await page.locator('#checkup-section').waitFor();
 assert.match(await page.locator('.snapshot-change').textContent(),/暂无上次/,'demo must not become real comparison history');
 await click('import');await click('manual');await page.locator('[data-row="0"] [data-field="name"]').fill('第二次真实导入资产');await page.locator('[data-row="0"] [data-field="marketValue"]').fill('200');await page.locator('[data-row="0"] [data-field="currency"]').selectOption('CNY');await page.locator('[data-row="0"] [data-field="ready"]').check();await click('preview');await click('apply');await page.locator('#checkup-section').waitFor();
 await page.locator('.checkup-deep > summary').click();assert.match(await page.locator('.snapshot-change').textContent(),/不等于收益/);assert.equal(await page.locator('.snapshot-change tbody tr').count(),1);assert.match(await page.locator('.snapshot-change tbody').innerText(),/CNY/);
 await click('data');await click('request-clear');await click('clear');await page.getByRole('heading',{name:'让持仓，清晰可见。'}).waitFor();await page.locator('[data-action="data"]').first().click();await page.locator('#restore-input').setInputFiles({name:'goals.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await click('apply');await page.locator('#checkup-section').waitFor();assert.match(await page.locator('#checkup-section').innerText(),/TEST_GOAL_PRIVACY/);
 for(const width of [360,768,1280]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`overflow ${width}`);await mkdir('artifacts',{recursive:true});await page.screenshot({path:`artifacts/checkup-${width}.png`,fullPage:true});}
 const legacy={...backup,schemaVersion:1};delete legacy.planning;
 await click('data');await page.locator('#restore-input').setInputFiles({name:'legacy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});await click('apply');await page.locator('#checkup-section').waitFor();assert.doesNotMatch(await page.locator('#checkup-section').innerText(),/TEST_GOAL_PRIVACY/);assert.match(await page.locator('#checkup-section').innerText(),/尚未填写用途/);
 await click('data');await click('request-clear');await click('clear');await page.getByRole('heading',{name:'让持仓，清晰可见。'}).waitFor();
 await click('plan');await page.locator('#goal-purpose').fill('只有目标尚无持仓');await click('save-plan');await click('data');const goalOnlyDownload=page.waitForEvent('download');await click('export-data');const goalOnly=JSON.parse(await readFile(await (await goalOnlyDownload).path(),'utf8'));assert.equal(goalOnly.snapshot.holdings.length,0);assert.equal(goalOnly.planning.plan.purpose,'只有目标尚无持仓');assert.equal(goalOnly.planning.planSource,'user');
 await click('request-clear');await click('clear');await page.getByRole('heading',{name:'让持仓，清晰可见。'}).waitFor();await click('demo');await page.locator('#checkup-section').waitFor();
 await click('import');await click('manual');await page.locator('[data-row="0"] [data-field="name"]').fill('真实导入测试');await page.locator('[data-row="0"] [data-field="marketValue"]').fill('100');await page.locator('[data-row="0"] [data-field="currency"]').selectOption('CNY');await page.locator('[data-row="0"] [data-field="ready"]').check();await click('preview');await click('apply');await page.locator('#checkup-section').waitFor();assert.match(await page.locator('#checkup-section').innerText(),/尚未填写用途/);assert.doesNotMatch(await page.locator('#checkup-section').innerText(),/虚构示例：|单资产占比超过自定上限|60000/);
 assert.deepEqual(errors,[]);assert.deepEqual(network.filter(r=>r.method!=='GET'||!r.url.startsWith(origin+'/')||r.url.includes('TEST_GOAL_PRIVACY')||r.body),[]);
 await writeFile('artifacts/checkup-browser.json',JSON.stringify({passed:true,errors,network},null,2));console.log('Checkup workflows passed.');
}finally{await browser.close();}
