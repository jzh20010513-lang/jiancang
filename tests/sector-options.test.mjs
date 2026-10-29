import test from 'node:test';
import assert from 'node:assert/strict';
import {SECTOR_CATALOG} from '../src/sector-catalog.mjs';
import {SECTOR_OPTIONS,validateCustomSectorNames,customSectorId,sectorOptionsFor} from '../src/sector-options.mjs';

test('selectable sectors include US technology with explicit index reference identities',()=>{
 assert.equal(SECTOR_OPTIONS.length,22);
 assert.deepEqual(SECTOR_OPTIONS.find(option=>option.id==='us-tech'),{id:'us-tech',name:'美股科技',group:'海外',referenceId:'us-growth'});
 assert.deepEqual(SECTOR_OPTIONS.filter(option=>option.referenceId!==null).map(option=>option.referenceId),['semiconductor','medical','ev','us-growth','hk-tech-reference']);
 assert.deepEqual(SECTOR_CATALOG.map(option=>option.providerKey),['sh512480','sh512170','sh515030','usNDX','hkHSTECH']);
 assert.equal(new Set(SECTOR_OPTIONS.map(option=>option.id)).size,22);
 assert.ok(Object.isFrozen(SECTOR_OPTIONS));
 assert.ok(SECTOR_OPTIONS.every(Object.isFrozen));
});

test('custom names accept at most three distinct plain names and return a copy',()=>{
 const input=['机器人','日本股票','a'.repeat(40)];
 const result=validateCustomSectorNames(input);
 assert.deepEqual(result,input);assert.notEqual(result,input);
 result.push('独立副本');assert.equal(input.length,3);
 assert.deepEqual(validateCustomSectorNames([]),[]);
});

test('custom names reject invalid text, duplicate names, and builtin labels',()=>{
 for(const value of [null,{},'机器人',[''],[' '],[' 机器人'],['机器人 '],['a\nb'],['a\rb'],['a\tb'],['a\0b'],['a\u007fb'],['a\u0085b'],['a,b'],['a，b'],['a'.repeat(41)],[3],[new String('机器人')],['机器人','机器人'],['1','2','3','4'],['美股科技'],['半导体']]){
  assert.throws(()=>validateCustomSectorNames(value),undefined,JSON.stringify(value));
 }
});

test('custom names reject sparse arrays, extra properties, symbols and changed prototypes',()=>{
 const extra=['机器人'];extra.foo='extra';
 const symbol=['机器人'];symbol[Symbol('extra')]=true;
 const altered=['机器人'];Object.setPrototypeOf(altered,null);
 const ownProto=['机器人'];Object.defineProperty(ownProto,'__proto__',{value:[]});
 for(const value of [Array(1),extra,symbol,altered,ownProto])assert.throws(()=>validateCustomSectorNames(value));
});

test('custom name validation rejects accessors without executing them',()=>{
 let reads=0;
 const accessor=['机器人'];Object.defineProperty(accessor,'0',{get(){reads++;return '机器人';}});
 assert.throws(()=>validateCustomSectorNames(accessor));assert.equal(reads,0);
});

test('custom IDs are stable encoded labels and validate their input',()=>{
 assert.equal(customSectorId('机器人'),'custom:%E6%9C%BA%E5%99%A8%E4%BA%BA');
 assert.equal(customSectorId('A/B & C'),'custom:A%2FB%20%26%20C');
 assert.throws(()=>customSectorId('美股科技'));
 assert.throws(()=>customSectorId('bad,name'));
});

test('custom names reject unpaired UTF-16 surrogates before ID encoding',()=>{
 for(const name of ['\uD800','\uDC00','名称\uD800','\uDC00名称']){
  assert.throws(()=>validateCustomSectorNames([name]));
  assert.throws(()=>customSectorId(name));
 }
 assert.deepEqual(validateCustomSectorNames(['机器人🤖']),['机器人🤖']);
 assert.equal(customSectorId('🤖'),'custom:%F0%9F%A4%96');
});

test('snapshot options derive unique custom labels without mutating or retaining snapshots',()=>{
 const snapshot={holdings:[{customSectorNames:['机器人','日本股票']},{customSectorNames:['机器人']},{}]};
 const before=structuredClone(snapshot);const result=sectorOptionsFor(snapshot);
 assert.deepEqual(result.slice(22),[
  {id:'custom:%E6%9C%BA%E5%99%A8%E4%BA%BA',name:'机器人',group:'自定义',referenceId:null,isCustom:true},
  {id:'custom:%E6%97%A5%E6%9C%AC%E8%82%A1%E7%A5%A8',name:'日本股票',group:'自定义',referenceId:null,isCustom:true},
 ]);
 assert.deepEqual(snapshot,before);
 assert.equal(sectorOptionsFor({holdings:[]}).length,22);
 assert.throws(()=>sectorOptionsFor({holdings:[{customSectorNames:['valid']},{customSectorNames:['invalid,name']}]}));
});
