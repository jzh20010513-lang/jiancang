import test from 'node:test';
import assert from 'node:assert/strict';
import {nameRegion,nameReviewMessage} from '../src/name-review.mjs';
const blocks=lines=>[{paragraphs:[{lines:lines.map(words=>({words}))}]}];
const w=(text,x0,x1)=>({text,bbox:{x0,y0:40,x1,y1:60}});
test('locates only matching name words and maps recognition pixels back to source',()=>{
 const b=blocks([[w('合成',20,60),w('成长A',65,130),w('1234',300,360)]]);
 assert.deepEqual(nameRegion('合成成长A',b,{width:400,height:200},{width:800,height:400}),{x:32,y:72,width:236,height:56});
});
test('does not guess a crop for duplicates, partial matches or invalid boxes',()=>{
 const b=blocks([[w('合成成长A',20,130)],[w('合成成长A',20,130)]]);
 assert.equal(nameRegion('合成成长A',b,{width:400,height:200},{width:400,height:200}),null);
 assert.equal(nameRegion('合成成长',blocks([[w('合成成长A',20,130)]]),{width:400,height:200},{width:400,height:200}),null);
 assert.equal(nameRegion('合成成长A',blocks([[{text:'合成成长A',bbox:{x0:NaN,y0:0,x1:10,y1:10}}]]),{width:400,height:200},{width:400,height:200}),null);
});
test('flags explicit ellipses and unclosed parentheses without inventing a full name',()=>{
 assert.match(nameReviewMessage('合成全球…'),/省略/);
 assert.match(nameReviewMessage('合成全球(QDII'),/括号/);
 assert.match(nameReviewMessage('合成成长A'),/逐字/);
});

test('retains mixed Latin share classes and clips padding at source edges',()=>{
 const b=blocks([[{text:'合成全球(QDII)C',bbox:{x0:0,y0:0,x1:200,y1:30}}]]);
 assert.deepEqual(nameRegion('合成 全球(QDII)C',b,{width:200,height:100},{width:200,height:100}),{x:0,y:0,width:200,height:34});
});
test('does not cross OCR lines to guess a wrapped name',()=>{
 assert.equal(nameRegion('合成全球(QDII)C',blocks([[w('合成全球',0,100)],[w('(QDII)C',0,100)]]),{width:400,height:200},{width:400,height:200}),null);
});
