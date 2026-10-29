// Classification labels do not grant access to market feeds. Only referenceId
// links a label to an existing, separately maintained public ETF proxy.
export const SECTOR_OPTIONS=Object.freeze([
 ['semiconductor','半导体','科技','semiconductor'],
 ['medical','医疗服务与器械','医药','medical'],
 ['ev','新能源汽车','能源制造','ev'],
 ['us-tech','美股科技','海外','us-growth'],
 ['hk-tech','港股科技','海外','hk-tech-reference'],
 ['cn-tech','A股科技','科技',null],
 ['ai','人工智能','科技',null],
 ['software','软件与云计算','科技',null],
 ['internet','互联网','科技',null],
 ['pharma','医药与生物科技','医药',null],
 ['consumer','消费','消费',null],
 ['energy','能源','能源制造',null],
 ['financials','金融与银行','金融',null],
 ['industrial','高端制造','能源制造',null],
 ['real-estate','房地产','其他',null],
 ['gold','黄金与贵金属','其他',null],
 ['cn-broad','A股宽基','宽基',null],
 ['us-broad','美股宽基','海外',null],
 ['hk-broad','港股宽基','海外',null],
 ['global-equity','全球股票','海外',null],
 ['bond','债券','稳健资产',null],
 ['cash','现金与货币','稳健资产',null],
].map(([id,name,group,referenceId])=>Object.freeze({id,name,group,referenceId})));

const builtinNames=new Set(SECTOR_OPTIONS.map(option=>option.name));

export function validateCustomSectorNames(value){
 const invalid=()=>{throw new Error('自定义板块须为至多三个不重复的名称，每个1至40字，不含逗号或控制字符；已有板块请直接选择。');};
 if(!Array.isArray(value)||Object.getPrototypeOf(value)!==Array.prototype||value.length>3)invalid();
 // Check descriptors before reading items so accessors cannot execute here.
 for(const key of Reflect.ownKeys(value)){
  if(key==='length')continue;
  const descriptor=Object.getOwnPropertyDescriptor(value,key);
  if(typeof key!=='string'||!/^(0|[1-9]\d*)$/.test(key)||Number(key)>=value.length||!('value' in descriptor))invalid();
 }
 const result=[],seen=new Set();
 for(let index=0;index<value.length;index++){
  if(!Object.hasOwn(value,index))invalid();
  const name=value[index];
  // Unicode mode treats valid surrogate pairs as one code point, so this
  // surrogate range rejects only unpaired UTF-16 that URI encoding cannot use.
  if(typeof name!=='string'||name.trim()!==name||name.length<1||name.length>40||/[\u0000-\u001f\u007f-\u009f\uD800-\uDFFF\u2028\u2029,，]/u.test(name)||seen.has(name)||builtinNames.has(name))invalid();
  seen.add(name);result.push(name);
 }
 return result;
}

export function customSectorId(name){
 validateCustomSectorNames([name]);
 return 'custom:'+encodeURIComponent(name);
}

export function sectorOptionsFor(snapshot){
 const result=[...SECTOR_OPTIONS],seen=new Set();
 for(const holding of snapshot.holdings){
  if(holding.customSectorNames===undefined)continue;
  for(const name of validateCustomSectorNames(holding.customSectorNames)){
   if(seen.has(name))continue;
   seen.add(name);
   result.push({id:customSectorId(name),name,group:'自定义',referenceId:null,isCustom:true});
  }
 }
 return result;
}
