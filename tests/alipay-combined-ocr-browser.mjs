import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true}),page=await browser.newPage();page.on('dialog',d=>d.accept());
const rows=[['合成现金产品','1234.56'],['合成全球股票C','2345.67'],['合成科技ETF联接C','3456.78'],['合成医疗股票A','4567.89'],['合成债券基金C','5678.90'],['合成半导体股票A','6789.01']];
try{
 await page.goto(process.env.BASE_URL||'http://127.0.0.1:4320');
 const png=await page.evaluate(rows=>{const c=document.createElement('canvas');c.width=1290;c.height=2400;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#172432';x.font='32px "Microsoft YaHei"';
 x.fillText('名称/金额',40,90);x.fillText('日收益',630,90);x.fillText('持有收益',840,90);x.fillText('累计收益',1060,90);
 rows.forEach(([name,value],i)=>{const y=200+i*350;x.fillStyle='#172432';x.font='34px "Microsoft YaHei"';x.fillText(name,40,y);x.font='28px "Microsoft YaHei"';x.fillStyle='#6b7e8a';x.fillText(i===0?'灵活取用':'基金，进阶理财',40,y+55);x.fillStyle='#172432';x.font='32px "Microsoft YaHei"';x.fillText(Number(value).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}),40,y+120);x.fillText('+12.34',630,y+120);if(i)x.fillText('-23.45',840,y+120);x.fillText('+34.56',1060,y+120);x.fillStyle='#71808e';x.font='28px "Microsoft YaHei"';x.fillText('占比 12.34%',40,y+175);if(i)x.fillText('-1.23%',840,y+175);});return c.toDataURL('image/png').split(',')[1];},rows);
 await page.locator('[data-action="import"]').first().click();await page.locator('#image-input').setInputFiles({name:'anonymous-stacked.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.locator('#canvas-host canvas').waitFor();await page.locator('[data-action="recognize"]').click();await page.locator('[data-action="cancel-ocr"]').waitFor({state:'detached',timeout:150000});
 const actual=await page.locator('[data-row]').evaluateAll(els=>els.map(el=>[el.querySelector('[data-field="name"]').value.replaceAll(' ',''),el.querySelector('[data-field="marketValue"]').value]));
 await mkdir('artifacts',{recursive:true});await writeFile('artifacts/combined-ocr-synthetic.json',JSON.stringify({synthetic:true,actual,expected:rows},null,2));
 assert.deepEqual(actual.map(([n,v])=>[n,Number(v)]),rows.map(([n,v])=>[n,Number(v)]));assert.ok(actual.every(([name])=>!name.includes('占比')));
 console.log('Combined-column actual local OCR passed on six anonymous synthetic rows.');
}finally{await browser.close();}
