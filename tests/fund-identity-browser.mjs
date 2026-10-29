import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({acceptDownloads:true});page.setDefaultTimeout(5000);page.on('dialog',d=>d.accept());
const origin=process.env.BASE_URL||'http://127.0.0.1:4320',errors=[],requests=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push({url:r.url(),method:r.method(),body:r.postData()}));
const click=a=>page.locator(`[data-action="${a}"]`).first().click();
const row=i=>page.locator(`[data-row="${i}"]`),field=(key,i=0)=>row(i).locator(`[data-field="${key}"]`);
try{
 await page.goto(origin);await click('import');await click('manual');
 await field('name').fill('合成半导体指数基金C');await field('marketValue').fill('40');await field('currency').selectOption('CNY');
 await click('suggest-fund');await click('apply-fund-suggestion');await field('sectorReady').check();await field('ready').check();
 await click('add-row');await field('name',1).fill('合成备用现金');await field('marketValue',1).fill('60');await field('currency',1).selectOption('CNY');await field('ready',1).check();
 await click('preview');await click('apply');await page.locator('[data-sector-card="semiconductor"]').waitFor();
 await click('plan');await page.locator('#risk-sector-cap').fill('30');await page.locator('#risk-loss').fill('10');await page.locator('#risk-need-by').fill('2099-01-01');await click('save-plan');
 const oldCard=page.locator('[data-sector-card="semiconductor"]');assert.equal(await oldCard.locator('.sector-guidance').getAttribute('data-guidance'),'cap');assert.match(await oldCard.innerText(),/40.00%/);
 await click('edit');await field('name').fill('合成医疗指数基金C');await field('marketValue').focus();
 assert.equal(await field('ready').isChecked(),false);
 assert.equal(await field('sectorReady').isChecked(),false,'renaming a fund must require rechecking sector and market mappings');
 assert.match(await row(0).locator('.fund-suggestion').innerText(),/名称或代码已修改/);
 await field('ready').check();await click('preview');await click('apply');
 assert.equal(await page.locator('[data-sector-card="semiconductor"]').count(),0,'old confirmed sector must not drive advice for a renamed fund');
 await click('edit');await click('suggest-fund');await click('apply-fund-suggestion');await field('sectorReady').check();await field('ready').check();await click('preview');await click('apply');
 const pharma=page.locator('[data-sector-card="medical"]');await pharma.waitFor();assert.equal(await pharma.locator('.sector-guidance').getAttribute('data-guidance'),'cap');assert.match(await pharma.innerText(),/40.00%/);
 await click('edit');await field('code').fill('999999');await field('marketValue').focus();assert.equal(await field('sectorReady').isChecked(),false,'code changes require mapping review too');await field('sectorReady').check();await field('ready').check();await click('preview');await click('apply');
 await click('data');const pending=page.waitForEvent('download');await click('export-data');const backup=JSON.parse(await readFile(await(await pending).path(),'utf8'));
 assert.equal(backup.snapshot.holdings[0].name,'合成医疗指数基金C');assert.deepEqual(backup.snapshot.holdings[0].sectorIds,['medical']);assert.equal(backup.planning.plan.riskProfile.sectorCapPercent,'30');assert.equal(backup.snapshot.holdings[1].reviewStatus,'confirmed');
 await click('request-clear');await click('clear');await click('data');await page.locator('#restore-input').setInputFiles({name:'synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await click('apply');
 assert.equal(await pharma.locator('.sector-guidance').getAttribute('data-guidance'),'cap');assert.equal(await page.locator('[data-sector-card="semiconductor"]').count(),0);
 // Also cover explicit "no reference" choices and market mappings, not just non-empty sectors.
 const edge=structuredClone(backup);edge.snapshot.holdings[0].benchmarkIds=['us-tech'];edge.snapshot.holdings[0].benchmarkReview='confirmed';
 Object.assign(edge.snapshot.holdings[1],{sectorIds:[],sectorReview:'confirmed',benchmarkIds:[],benchmarkReview:'confirmed'});
 await click('data');await page.locator('#restore-input').setInputFiles({name:'synthetic-edge.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(edge))});await click('apply');await click('edit');
 await field('marketValue').fill('41');await field('code').focus();assert.equal(await field('sectorReady').isChecked(),true,'amount edits do not change product identity');
 await field('code').fill('888888');await field('marketValue').focus();assert.equal(await field('sectorReady').isChecked(),false);
 await field('name',1).fill('合成另一只基金');await field('marketValue',1).focus();assert.equal(await field('sectorReady',1).count(),0);
 await field('ready').check();await field('ready',1).check();await click('preview');await click('apply');
 await click('data');const edgeDownload=page.waitForEvent('download');await click('export-data');const changed=JSON.parse(await readFile(await(await edgeDownload).path(),'utf8'));
 for(const h of changed.snapshot.holdings){assert.equal(h.sectorReview,'unreviewed');assert.equal(h.benchmarkReview,'unreviewed');}
 assert.deepEqual(changed.snapshot.holdings[1].sectorIds,[],'retain choices without silently remapping');
 assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.method==='GET'&&r.url.startsWith(origin+'/')&&!r.body&&!r.url.includes('合成')));
 console.log('Fund correction → mapping re-review → personal cap → backup clear/restore and privacy journey passed.');
}finally{await browser.close();}
