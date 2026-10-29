import test from 'node:test';
import assert from 'node:assert/strict';
import {tableTextFromBlocks, recognitionSize} from '../src/ocr-layout.mjs';
import {parseCandidates} from '../src/ocr.mjs';
const word=(text,x0,y0,x1,y1)=>({text,bbox:{x0,y0,x1,y1}});
const blocks=words=>[{paragraphs:[{lines:words.map(w=>({words:[w]}))}]}];
const header=[word('基金名称',10,10,100,30),word('金额(元)',250,10,330,30),word('昨日收益',400,10,480,30),word('持有收益',550,10,630,30)];
test('geometry reconstructs columns despite separate OCR blocks and wrapped fund suffix',()=>{
 const data=blocks([...header,word('合成沪深300指数',10,60,190,80),word('A',10,85,25,100),word('12,345.67',250,60,345,80),word('+123.45',400,60,480,80),word('+2.3%',550,60,620,80),word('合成债券',10,140,100,160),word('C',10,165,25,180),word('8,000.00',250,140,340,160)]);
 const rows=parseCandidates(tableTextFromBlocks(data));assert.equal(rows.length,2);assert.equal(rows[0].name,'合成沪深300指数A');assert.equal(rows[0].marketValue,'12345.67');assert.equal(rows[1].name,'合成债券C');assert.equal(rows[1].marketValue,'8000.00');
});
test('geometry declines missing headers and ambiguous amount cells',()=>{assert.equal(tableTextFromBlocks(blocks([word('100',10,50,50,70)])),null);const rows=parseCandidates(tableTextFromBlocks(blocks([...header,word('合成基金',10,60,100,80),word('100 200',250,60,340,80)])));assert.equal(rows[0].marketValue,null);});
test('local OCR scale helps small text and respects pixel budget',()=>{assert.deepEqual(recognitionSize(700,1600),{width:1400,height:3200});for(const [w,h] of [[1000,30000],[5000,10000],[10,10]]){const size=recognitionSize(w,h);assert.ok(size.width*size.height<=18_000_000);assert.ok(size.width/w<=2.5);}});
test('geometry refuses card-style names above the next amount rather than joining funds',()=>{const data=blocks([...header,word('合成基金甲',10,60,110,80),word('1000.00',250,60,340,80),word('合成基金乙',10,110,110,130),word('2000.00',250,150,340,170)]);assert.equal(tableTextFromBlocks(data),null);});
test('geometry retains explicit conflicting currency rather than defaulting to header yuan',()=>{const data=blocks([...header,word('合成基金',10,60,100,80),word('100.00',250,60,340,80),word('USD',650,60,700,80)]);assert.equal(parseCandidates(tableTextFromBlocks(data))[0].currency,null);});
test('profit amount headings are never used as holding columns',()=>{for(const label of ['持有收益金额(元)','盈亏金额(元)']){const data=blocks([word('基金名称',10,10,100,30),word(label,250,10,380,30),word('合成基金',10,60,100,80),word('123.45',250,60,340,80)]);assert.equal(tableTextFromBlocks(data),null);}});
test('geometry preserves a separate ten-thousand-yuan amount header unit',()=>{const data=blocks([word('基金名称',10,10,100,30),word('金额',250,10,300,30),word('(万元)',305,10,365,30),word('昨日收益',400,10,480,30),word('合成基金',10,60,100,80),word('2.5',250,60,290,80),word('CNY',650,60,700,80)]);const row=parseCandidates(tableTextFromBlocks(data))[0];assert.equal(row.marketValue,'25000');assert.equal(row.currency,'CNY');});
test('geometry refuses competing units near the amount heading',()=>{const data=blocks([word('基金名称',10,10,100,30),word('金额',250,10,300,30),word('(万元)',305,10,365,30),word('(元)',370,10,395,30),word('昨日收益',450,10,530,30),word('合成基金',10,60,100,80),word('2.5',250,60,290,80)]);assert.equal(tableTextFromBlocks(data),null);});
