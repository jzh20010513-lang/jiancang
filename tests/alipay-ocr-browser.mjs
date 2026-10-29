import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage();page.on('dialog',d=>d.accept());
const truth=[{name:'合成半导体指数A',value:'12345.67'},{name:'合成医疗指数C',value:'8096.25'}];
try{
 await page.goto(process.env.BASE_URL||'http://127.0.0.1:4318');
 const png=await page.evaluate(rows=>{
 const c=document.createElement('canvas');c.width=1080;c.height=820;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#202632';
 x.font='32px "Microsoft YaHei"';x.fillText('合成测试 · 基金持有',40,80);x.font='26px "Microsoft YaHei"';x.fillText('基金名称',40,170);x.fillText('持有金额(元)',490,170);x.fillText('持有收益',820,170);
 rows.forEach((r,i)=>{const y=280+i*220;x.font='30px "Microsoft YaHei"';x.fillText(r.name,40,y);x.fillText(Number(r.value).toLocaleString('en-US',{minimumFractionDigits:2}),490,y);x.fillText(i?'-56.78':'+123.45',820,y);x.fillText(i?'-0.70%':'+2.30%',820,y+60);});
 return c.toDataURL('image/png').split(',')[1];},truth);
 await mkdir('artifacts',{recursive:true});await writeFile('artifacts/alipay-style-synthetic.png',Buffer.from(png,'base64'));
 await page.locator('[data-action="import"]').first().click();await page.locator('#image-input').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await page.locator('#canvas-host canvas').waitFor();await page.locator('[data-action="recognize"]').click();await page.locator('[data-action="cancel-ocr"]').waitFor({state:'detached',timeout:150000});
 const rows=await page.locator('[data-row]').evaluateAll(els=>els.map(el=>({name:el.querySelector('[data-field="name"]').value,value:el.querySelector('[data-field="marketValue"]').value,currency:el.querySelector('[data-field="currency"]').value})));
 await writeFile('artifacts/alipay-style-ocr.json',JSON.stringify({synthetic:true,rows,truth},null,2));
 assert.deepEqual(rows.map(({name,value})=>({name:name.replaceAll(' ',''),value})),truth);assert.ok(rows.every(r=>r.currency==='CNY'));
 console.log('Synthetic Alipay-style multi-column actual OCR passed (2 rows); not a real-platform certification.');
}finally{await browser.close();}
