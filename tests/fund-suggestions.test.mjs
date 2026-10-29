import test from 'node:test';
import assert from 'node:assert/strict';
import {suggestFund} from '../src/fund-suggestions.mjs';
const suggest=row=>{assert.equal(typeof suggestFund,'function','suggestFund must be implemented');return suggestFund(row);};

test('only three exact codes supply local ETF sector relationships',()=>{
 for(const [code,sector] of [['512480','semiconductor'],['512170','medical'],['515030','ev']]){
  const result=suggest({code,name:''});assert.deepEqual(result.sectorIds,[sector]);assert.equal(result.confidence,'exact-code');assert.equal(result.canonicalName,null);assert.equal(result.category,'权益');assert.match(result.basis.join(' '),/代码.*本地/);
 }
});
test('explicit sector name keywords are conservative candidates',()=>{
 for(const [name,sector] of [['半导体ETF','semiconductor'],['芯片指数基金','semiconductor'],['医疗ETF联接A','medical'],['新能源车指数','ev'],['新能源汽车指数C','ev']]){
  const result=suggest({name});assert.deepEqual(result.sectorIds,[sector]);assert.equal(result.confidence,'name-keyword');assert.match(result.basis.join(' '),/名称关键词候选/);assert.match(result.basis.join(' '),/不是穿透/);
 }
});
test('explicit benchmark names use catalog ids without regional or currency inference',()=>{
 for(const [name,id] of [['沪深300指数','cn-large'],['创业板ETF','cn-growth'],['恒生指数基金','hk-broad'],['标普500指数','us-broad'],['纳斯达克100指数','us-tech'],['黄金ETF','gold-us']]) assert.deepEqual(suggest({name}).benchmarkIds,[id]);
});
test('generic, truncated, and near-matching names do not fabricate mappings',()=>{
 for(const name of ['华夏稳健成长A','华夏半导…','纳斯达克指数','新能源ETF','华夏创…','标普50指数']){
  const result=suggest({name});assert.deepEqual(result.sectorIds,[]);assert.deepEqual(result.benchmarkIds,[]);
 }
 for(const row of [{name:'华夏稳健成长A',currency:'CNY',code:'000001'},{name:'',currency:'USD',code:'51248'},{name:'',code:'0512480'},{}]){
  const result=suggest(row);assert.equal(result.confidence,'unknown');assert.equal(result.category,null);
 }
});
test('category uses explicit type words and does not turn style or risk into type',()=>{
 for(const [name,category] of [['短期债券ETF','固收'],['货币基金','现金'],['现金','现金'],['黄金基金','黄金'],['股票型基金','权益'],['混合型基金','混合']])assert.equal(suggest({name}).category,category);
 for(const name of ['稳健A','成长C','低风险','医药主题']) assert.equal(suggest({name}).category,null);
});
test('conflicting codes and explicit names return no candidates',()=>{
 for(const name of ['医疗ETF','新能源汽车ETF','沪深300ETF','黄金ETF','债券ETF','货币基金']){
  const result=suggest({code:'512480',name});assert.equal(result.confidence,'unknown');assert.equal(result.category,null);assert.deepEqual(result.sectorIds,[]);assert.deepEqual(result.benchmarkIds,[]);assert.match(result.basis.join(' '),/冲突/);
 }
 const result=suggest({name:'股票债券基金'});assert.equal(result.confidence,'unknown');assert.equal(result.category,null);assert.match(result.basis.join(' '),/冲突/);
});
test('suggestions never change input or auto confirm and returned arrays cannot pollute later calls',()=>{
 const row=Object.freeze({name:'医疗ETF',sectorIds:Object.freeze([]),sectorReview:'unreviewed',reviewStatus:'needs_attention'});const before=JSON.stringify(row);const result=suggest(row);result.sectorIds.push('ev');result.basis.push('changed');assert.equal(JSON.stringify(row),before);assert.deepEqual(suggest(row).sectorIds,['medical']);assert.equal('sectorReview' in result,false);assert.equal('reviewStatus' in result,false);
});
test('malformed optional values are treated as unknown without coercing to a code',()=>{
 for(const row of [null,undefined,{name:42,code:512480},{name:['医疗ETF']},{code:'512480X'}]) assert.equal(suggest(row).confidence,'unknown');
});


test('cash flow equity and monetary themes are not cash products',()=>{
 assert.equal(suggest({name:'自由现金流ETF'}).category,'权益');
 assert.equal(suggest({name:'数字货币ETF'}).category,'权益');
 assert.equal(suggest({name:'现金管理货币基金'}).category,'现金');
 assert.equal(suggest({name:'货币市场基金'}).category,'现金');
});
test('index variants never inherit the parent benchmark',()=>{
 for(const name of ['恒生科技ETF','恒生中国企业ETF','恒生医疗ETF','创业板50ETF','创业板200ETF','创业板成长ETF','创业板指成长ETF','沪深300红利ETF','沪深300等权指数','标普500成长ETF','纳斯达克100等权ETF']) assert.deepEqual(suggest({name}).benchmarkIds,[],name);
 for(const [name,id] of [['恒生ETF','hk-broad'],['恒生指数ETF联接C','hk-broad'],['创业板指数基金','cn-growth'],['创业板ETF联接A','cn-growth']]) assert.deepEqual(suggest({name}).benchmarkIds,[id],name);
});
test('gold mining equity is not gold and debt sector conflicts remain unknown',()=>{
 for(const name of ['黄金股ETF','黄金股票ETF','黄金产业ETF','黄金矿业ETF']){const result=suggest({name});assert.equal(result.category,'权益',name);assert.deepEqual(result.benchmarkIds,[],name);}
 for(const name of ['半导体债券基金','医疗债券ETF','沪深300债券ETF']){const result=suggest({name});assert.equal(result.confidence,'unknown',name);assert.deepEqual(result.sectorIds,[],name);assert.deepEqual(result.benchmarkIds,[],name);}
});
test('explicit contradictory equity theme prevents code overriding the name',()=>{
 for(const name of ['恒生科技ETF','创业板50ETF','黄金股ETF'])assert.equal(suggest({code:'512480',name}).confidence,'unknown',name);
 for(const name of ['数字货币基金','加密货币指数基金'])assert.notEqual(suggest({name}).category,'现金',name);
});
test('noncash currency themes do not carry a cash classification explanation',()=>{
 assert.doesNotMatch(suggest({name:'数字货币ETF'}).basis.join(' '),/提供“现金”候选/);
});

test('explicit geographic technology names suggest the named market only',()=>{
 for(const name of ['美股科技ETF','美国科技股票基金','美国信息科技指数'])assert.deepEqual(suggest({name}).sectorIds,['us-tech'],name);
 for(const name of ['港股科技ETF','恒生科技ETF']){const result=suggest({name});assert.deepEqual(result.sectorIds,['hk-tech'],name);assert.deepEqual(result.benchmarkIds,[],name);}
 assert.deepEqual(suggest({name:'A股科技ETF'}).sectorIds,['cn-tech']);
 for(const name of ['全球科技股票基金','QDII科技股票基金','纳斯达克100指数'])assert.deepEqual(suggest({name}).sectorIds,[],name);
});

test('explicit themes provide distinct candidates without conflating pharmaceuticals and medical',()=>{
 for(const [name,ids] of [
  ['人工智能ETF',['ai']],['软件云计算ETF',['software']],['互联网ETF',['internet']],
  ['医药ETF',['pharma']],['生物科技ETF',['pharma']],['纳指生物科技ETF',['pharma']],
  ['医疗ETF',['medical']],['消费ETF',['consumer']],['能源ETF',['energy']],
  ['银行金融ETF',['financials']],['先进制造ETF',['industrial']],['房地产ETF',['real-estate']],
  ['黄金ETF',['gold']],['沪深300指数',['cn-broad']],['标普500指数',['us-broad']],
  ['恒生指数基金',['hk-broad']],['全球股票基金',['global-equity']],['全球精选股票基金',['global-equity']],
  ['债券基金',['bond']],['货币市场基金',['cash']],
 ])assert.deepEqual(suggest({name}).sectorIds,ids,name);
 for(const name of ['新能源ETF','新能源汽车ETF','黄金股ETF','黄金矿业ETF','自由现金流ETF','数字货币ETF','恒生中国企业ETF','标普500成长ETF']){
  const result=suggest({name});assert.ok(!result.sectorIds.includes('energy'),name);assert.ok(!result.sectorIds.includes('gold'),name);assert.ok(!result.sectorIds.includes('cash'),name);
 }
});

test('up to three themes are retained but an overloaded name is left unknown',()=>{
 assert.deepEqual(suggest({name:'人工智能软件云计算半导体ETF'}).sectorIds,['semiconductor','ai','software']);
 const overloaded=suggest({name:'人工智能软件半导体医疗ETF'});
 assert.equal(overloaded.confidence,'unknown');assert.deepEqual(overloaded.sectorIds,[]);assert.match(overloaded.basis.join(' '),/过多|不确定/);
 assert.deepEqual(suggest({name:'人工智能混合基金'}).sectorIds,['ai']);
});

test('new themes keep code and product type conflicts conservative',()=>{
 for(const name of ['美股科技ETF','医药ETF','债券基金','货币基金'])assert.equal(suggest({code:'512480',name}).confidence,'unknown',name);
 for(const name of ['软件债券基金','医药货币基金','医疗黄金基金'])assert.equal(suggest({name}).confidence,'unknown',name);
 assert.equal(suggest({name:'短期债券ETF'}).category,'固收');
 assert.deepEqual(suggest({name:'短期债券ETF'}).sectorIds,['bond']);
});
