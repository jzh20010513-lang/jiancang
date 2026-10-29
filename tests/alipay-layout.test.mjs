import test from 'node:test';
import assert from 'node:assert/strict';
import {alipayTextFromBlocks} from '../src/alipay-layout.mjs';
const w=(text,x0,y0,x1=x0+text.length*12)=>({text,bbox:{x0,y0,x1,y1:y0+20}});
const blocks=words=>[{paragraphs:[{lines:words.map(word=>({words:[word]}))}]}];
const header=[w('名称/金额',20,10),w('日收益',500,10),w('持有收益',700,10),w('累计收益',900,10)];
const row=(name,amount,y)=>[w(name,20,y),w(amount,20,y+30),w('占 比 12.34%',20,y+55),w('+28.91',500,y+30),w('-99.21',700,y+30)];
test('reconstructs six stacked cards with no implicit currency or profit values',()=>{
 const names=['合成晨星混合A','合成远海债券C','合成新城指数A','合成绿洲ETF','合成云端LOF','余额宝'];
 const text=alipayTextFromBlocks(blocks([...header,...names.flatMap((name,i)=>row(name,String(1200+i)+'.45',60+i*120))]));
 assert.ok(text);assert.equal((text.match(/产品名称：/g)||[]).length,6);
 names.forEach((name,i)=>assert.ok(text.includes(`产品名称：${name}\n持仓金额：${1200+i}.45`)));
 assert.doesNotMatch(text,/币种|占|28.91|99.21|收益/);
});
test('accepts split spaced combined heading and long multiword names with short wrapped suffixes',()=>{
 const text=alipayTextFromBlocks(blocks([w('名 称',20,10),w('／',80,10),w('市 值',100,10),...header.slice(1),w('合成未来产业发展',20,60,300),w('指数基金',305,60,650),w('C',20,85),w('3,456.78',20,115)]));
 assert.equal(text,'产品名称：合成未来产业发展指数基金C\n持仓金额：3456.78');
});
test('skips badges before amount and ratios after amount while retaining explicit yuan unit',()=>{
 const text=alipayTextFromBlocks(blocks([w('名称/金额(元)',20,10),...header.slice(1),w('基金',20,50),w('合成测试混合A',20,80),w('进阶理财',20,105),w('全市场指数基金',20,130),w('2345.67',20,155),w('占 比',20,180),w('88.88%',100,180)]));
 assert.equal(text,'产品名称：合成测试混合A\n持仓金额(元)：2345.67');
});
test('requires explicit combined header and a daily-profit header to its right',()=>{
 for(const h of [[w('名称',20,10),w('金额',200,10),...header.slice(1)],[w('名称/金额',20,10)],[w('日收益',20,10),w('名称/金额',500,10)]])assert.equal(alipayTextFromBlocks(blocks([...h,...row('合成基金A','1234.56',60)])),null);
});
test('declines competing names, unlabeled amount, and multiple amount cells',()=>{
 const cases=[ [w('合成基金A',20,50),w('合成债券C',20,80),w('1000.00',20,110)], [w('1000.00',20,60)], [w('合成基金A',20,60),w('1000.00',20,90),w('2000.00',20,120)] ];
 for(const words of cases)assert.equal(alipayTextFromBlocks(blocks([...header,...words])),null);
});
test('does not pair a right-column value or percentage with a name',()=>{
 for(const value of [w('+1000.00',500,90),w('1000.00',500,90),w('12.34%',20,90),w('占 比 12.34',20,90)])assert.equal(alipayTextFromBlocks(blocks([...header,w('合成基金A',20,60),value])),null);
});
test('requires amount alignment with left name anchor',()=>{
 assert.equal(alipayTextFromBlocks(blocks([...header,w('合成基金A',20,60),w('1000.00',180,90)])),null);
});
test('declines two short independent names rather than inventing one wrapped name',()=>{
 assert.equal(alipayTextFromBlocks(blocks([...header,w('合成晨光',20,60),w('合成远海',20,85),w('1000.00',20,115)])),null);
});
test('preserves explicit currency without assuming it from product location',()=>{
 const text=alipayTextFromBlocks(blocks([...header,w('合成基金A',20,60),w('1000.00',20,90),w('USD',200,90)]));
 assert.equal(text,'产品名称：合成基金A\n持仓金额：1000.00\n币种：USD');
});
test('declines an amount vertically overlapping its preceding name',()=>{
 assert.equal(alipayTextFromBlocks(blocks([...header,w('合成基金A',20,60),w('1000.00',20,75)])),null);
});
test('never joins an independent Chinese fund title after an A or C share-class title',()=>{
 for(const name of ['合成远海(QDII)C','合成远海A','合成远海（QDII）A'])assert.equal(alipayTextFromBlocks(blocks([...header,w(name,20,60),w('指数成长混合A',20,85),w('2000.00',20,115)])),null);
});
test('declines uncertain Chinese continuation even when it starts with a fund type',()=>{
 assert.equal(alipayTextFromBlocks(blocks([...header,w('合成未来产业发展',20,60),w('指数基金C',20,85),w('2000.00',20,115)])),null);
});
test('punctuation-separated category badges never become names',()=>{
 for(const badge of ['基金 ，进阶理财','基金、灵活取用','基金，']){
  assert.equal(alipayTextFromBlocks(blocks([...header,w(badge,20,60),w('2000.00',20,90)])),null);
  assert.equal(alipayTextFromBlocks(blocks([...header,w('合成远海(QDII)C',20,60),w(badge,20,85),w('2000.00',20,115)])),'产品名称：合成远海(QDII)C\n持仓金额：2000.00');
 }
});
test('a ratio closes an incomplete card before a later orphan amount',()=>{
 const data=blocks([...header,w('合成科技股票A',20,60),w('+1',500,90),w('+2',700,90),w('+3',900,90),w('占比12.34%',20,115),w('2000',20,200)]);
 assert.equal(alipayTextFromBlocks(data),null);
});
