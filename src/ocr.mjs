import {nameRegion} from './name-review.mjs';
import {tableTextFromBlocks, prepareRecognitionCanvas} from './ocr-layout.mjs';
import {alipayCardsText,isInterfaceLabel} from './alipay-text.mjs';
import {alipayTextFromBlocks} from './alipay-layout.mjs';
// Conservative, generic adapters. Every candidate requires human review.
const currencies={CNY:'CNY',RMB:'CNY','人民币':'CNY',HKD:'HKD','港币':'HKD','港元':'HKD',USD:'USD','美元':'USD',EUR:'EUR','欧元':'EUR',JPY:'JPY','日元':'JPY',GBP:'GBP','英镑':'GBP'};
const moneyPattern=/[-+]?\d[\d,]*(?:\.\d+)?\s*[万亿]?/g;
function decimal(raw){if(raw.includes(',')&&!/^[-+]?\d{1,3}(?:,\d{3})+(?:\.\d+)?[万亿]?$/.test(raw.replace(/\s/g,'')))return null;const m=raw.replaceAll(',','').replace(/\s/g,'').match(/^([-+]?)(\d+)(?:\.(\d+))?([万亿])?$/);if(!m)return null;let digits=m[2]+(m[3]||''),scale=(m[3]||'').length-({万:4,亿:8}[m[4]]||0);if(scale<0){digits+='0'.repeat(-scale);scale=0;}if(scale>8)return null;digits=digits.padStart(scale+1,'0');let s=scale?digits.slice(0,-scale)+'.'+digits.slice(-scale):digits;s=s.replace(/^0+(?=\d)/,'');if(BigInt(digits)>10n**BigInt(15+scale))return null;return (m[1]==='-'&&s!=='0'?'-':'')+s;}
function currencyTokens(s){return (s.match(/\b(?:CNY|RMB|HKD|USD|EUR|JPY|GBP)\b|人民币|港币|港元|美元|欧元|日元|英镑/gi)||[]).map(t=>currencies[t.toUpperCase()]||currencies[t]);}
function currency(s){const found=[...new Set(currencyTokens(s))];return found.length===1?found[0]:null;}
function date(s){const m=s.match(/(20\d{2})[-/年](\d{1,2})[-/月](\d{1,2})日?/);if(!m)return null;const d=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;const parsed=new Date(d+'T00:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===d?d:null;}
const base=name=>({name,marketValue:null,currency:null,asOfDate:null,reviewStatus:'needs_attention',source:'screenshot'});
const amountLabel=/^(?:持仓金额|持仓市值|持有金额|资产金额|市值|金额)\s*(?:[（(]\s*(?:人民币|元|万元|亿元)\s*[）)])?\s*[:：]?\s*/;
const unitCurrency=s=>/[（(]\s*(?:人民币|元|万元|亿元)\s*[）)]/.test(s)?['CNY']:[];
const labelledDecimal=(raw,label)=>decimal(raw+(!/[万亿]/.test(raw)?(label.match(/[（(]\s*([万亿])元\s*[）)]/)?.[1]||''):''));
const cleanLine=s=>s.trim().replace(/([\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g,'$1');
const bareAmount=/^(?:(?:CNY|RMB|HKD|USD|EUR|JPY|GBP)\s+)?[$¥￥€£]?[-+]?\d[\d,]*(?:\.\d+)?\s*[万亿]?(?:元)?(?:\s+(?:CNY|RMB|HKD|USD|EUR|JPY|GBP))?$/i;
const isName=s=>!!s&&/[\u4e00-\u9fffA-Za-z]/.test(s)&&!/[：:]|收益|盈亏|金额|市值|币种|账户|合计|总计|总资产|日期|截至|更新|余额/.test(s)&&!bareAmount.test(s)&&!date(s);
export function parseCandidates(text){
 const alipay=alipayCardsText(text);if(alipay!==null)return parseCandidates(alipay);
 const lines=String(text||'').replace(/\r/g,'').split('\n').map(cleanLine).filter(Boolean),rows=[];
 let card=null,table=false,tableHeader='',globalDate=null,globalUnits=[],globalHeader='';
 const cardCurrencies=new WeakMap();
 const applyCurrency=(row,s,initial=[])=>{const known=cardCurrencies.get(row)||new Set(initial);for(const c of [...currencyTokens(s),...unitCurrency(s)])known.add(c);cardCurrencies.set(row,known);row.currency=known.size===1?[...known][0]:null;};
 const flush=()=>{if(card){rows.push(card);card=null;}};
 const newCard=name=>{flush();card=base(name);card.asOfDate=globalDate;applyCurrency(card,'',globalUnits);table=false;};
 const setAmount=(body,label='')=>{const matches=body.match(moneyPattern)||[];card.marketValue=matches.length===1&&!/%/.test(body)?labelledDecimal(matches[0],label):null;applyCurrency(card,body);};
 for(let i=0;i<lines.length;i++){
  const line=lines[i];
  if(/^(数据日期|持仓日期|截至|更新日期|日期)\s*[:：]?/.test(line)){const d=date(line);if(card)card.asOfDate=d;else globalDate=d;continue;}
  if(/名称/.test(line)&&/(?:金额|市值)/.test(line)&&!line.includes('：')&&!line.includes(':')){flush();const profitIndex=line.search(/收益|盈亏/);table=!(profitIndex>=0&&profitIndex<line.search(/金额|市值/));tableHeader=table?line:'';globalUnits=table?unitCurrency(line):[];globalHeader=table?line:'';continue;}
  if(amountLabel.test(line)&&line.replace(amountLabel,'')===''&&!card){globalUnits=unitCurrency(line);globalHeader=line;continue;}
  const name=line.match(/^(?:产品名称|资产名称|基金名称|证券名称|名称)(?:\s*[:：]\s*|\s+)(.+)$/);
  if(name){if(!isInterfaceLabel(name[1]))newCard(name[1].trim());else flush();continue;}
  if(isInterfaceLabel(line))continue;
  if(/^(?:账户总资产|总资产|总金额|合计|总计|账户余额)/.test(line)){flush();table=false;continue;}
  if(isName(line)&&amountLabel.test(lines[i+1]||'')){newCard(line);continue;}
  // A global amount heading supports cards whose name and numeric value occupy separate lines.
  if(!table&&globalUnits.length&&isName(line)){
   const suffix=/^(?:A|C|LOF|[（(]LOF[）)])$/i.test(lines[i+1]||'')?lines[i+1]:'';
   const value=lines[i+(suffix?2:1)]||'';
   if(bareAmount.test(value)){newCard(line+suffix);setAmount(value,globalHeader);i+=suffix?2:1;continue;}
  }
  if(card){
   if(amountLabel.test(line)){let body=line.replace(amountLabel,'');applyCurrency(card,line);if(!body&&bareAmount.test(lines[i+1]||''))body=lines[++i];setAmount(body,line);}
   if(/^币种\s*[:：]?/.test(line))applyCurrency(card,line);
   if(/^(?:代码|基金代码|证券代码)\s*[:：]?/.test(line)){const c=line.match(/\b\d{5,6}\b/);if(c)card.code=c[0];}
   continue;
  }
  if(!table||/(?:总资产|总金额|合计|总计|收益|盈亏|账户余额)/.test(line)||date(line))continue;
  const body=line.replace(/\|/g,' ').trim();
  // Digits embedded in names (e.g. 沪深300) are not numeric columns.
  const nums=[...body.matchAll(moneyPattern)].filter(m=>{
   const tail=body.slice(m.index+m[0].trimEnd().length);
   const nextWord=tail.match(/^\s+([A-Za-z\u4e00-\u9fff]+)/)?.[1];
   const followedByName=nextWord&&!/^(?:CNY|RMB|HKD|USD|EUR|JPY|GBP|人民币|港币|港元|美元|欧元|日元|英镑)$/i.test(nextWord);
   return (m.index===0||/[\s$¥￥€£]/.test(body[m.index-1]))&&!/[A-Za-z\u4e00-\u9fff]/.test(tail[0]||'')&&!followedByName;
  });
  if(!nums.length)continue;
  let code=null;
  if(nums.length>1&&/^\d{5,6}\s*$/.test(nums[0][0])&&(/代码/.test(tableHeader)||/^0\d{5}\s*$/.test(nums[0][0])))code=nums.shift()[0].trim();
  const amount=nums[0];
  let prefix=body.slice(0,amount.index).trim();
  if(code)prefix=prefix.replace(new RegExp('(?:^|\\s)'+code+'\\s*$'),'').trim();
  const prefixCurrency=prefix.match(/\s+(CNY|RMB|HKD|USD|EUR|JPY|GBP|人民币|港币|港元|美元|欧元|日元|英镑)$/i);
  if(prefixCurrency)prefix=prefix.slice(0,prefixCurrency.index).trim();
  prefix=prefix.replace(/[$¥￥€£]\s*$/,'').trim();
  if(!prefix||/^\d+$/.test(prefix))continue;
  const row=base(prefix);const orderedProfitColumns=/(?:金额|市值).*?(?:收益|盈亏)/.test(tableHeader);const expectedColumns=1+(tableHeader.match(/收益|盈亏/g)||[]).length;
  row.marketValue=((!orderedProfitColumns&&nums.length===1)||(orderedProfitColumns&&nums.length===expectedColumns))&&!body.slice(amount.index+amount[0].length).trimStart().startsWith('%')?labelledDecimal(amount[0],tableHeader):null;
  applyCurrency(row,(prefixCurrency?.[1]||'')+' '+body.slice(amount.index),globalUnits);row.asOfDate=globalDate;if(code)row.code=code;rows.push(row);
 }
 flush();return rows;
}
let generation=0,active=null;
export function cancelRecognition(){generation++;const a=active;active=null;if(a){a.cancel?.();a.nativeWorker?.terminate();a.worker?.terminate().catch(()=>{});}}
export async function startRecognition(canvas,onProgress=()=>{}){
 cancelRecognition();const id=generation;let rejectCancelled;const cancelled=new Promise((_,reject)=>{rejectCancelled=reject;});const job={worker:null,cancel:()=>rejectCancelled(new Error('识别已取消。'))};active=job;
 let timer;const timedOut=new Promise((_,reject)=>{timer=setTimeout(()=>{if(active===job)cancelRecognition();reject(new Error('识别超时，请重试或手动录入。'));},120_000);});
 const run=(async()=>{const {createWorker}=await import('tesseract.js');if(id!==generation)throw new Error('识别已取消。');
  // Capture the native worker before createWorker's model-initialization promise resolves.
  // Restoration is synchronous; the override is never held across an await.
  const NativeWorker=globalThis.Worker;let pending;
  if(NativeWorker)globalThis.Worker=new Proxy(NativeWorker,{construct(Target,args){const native=new Target(...args);job.nativeWorker=native;return native;}});
  try{pending=createWorker(['chi_sim','eng'],1,{workerPath:'/vendor/worker.min.js',corePath:'/vendor/core',langPath:'/vendor/lang',workerBlobURL:false,cacheMethod:'none',logger:m=>{if(id===generation)onProgress({status:m.status,progress:m.progress||0});}});}finally{if(NativeWorker)globalThis.Worker=NativeWorker;}
  const worker=await pending;job.worker=worker;
  if(id!==generation){await worker.terminate();throw new Error('识别已取消。');}
  const input=prepareRecognitionCanvas(canvas);job.input=input!==canvas?input:null;
  const {data}=await worker.recognize(input,{}, {text:true,blocks:true});if(id!==generation)throw new Error('识别已取消。');
  const layoutText=alipayTextFromBlocks(data.blocks)??tableTextFromBlocks(data.blocks);
  const rows=parseCandidates(layoutText??data.text);
  return {text:data.text,rows,nameRegions:rows.map(r=>nameRegion(r.name,data.blocks,input,canvas)),confidence:data.confidence};})();
 try{return await Promise.race([run,cancelled,timedOut]);}catch{throw new Error(id!==generation?'识别已取消或超时，请重试或手动录入。':'本地识别失败，请重试或手动录入。');}finally{clearTimeout(timer);if(active===job)active=null;if(job.worker)await job.worker.terminate().catch(()=>{});if(job.input){job.input.width=0;job.input.height=0;job.input=null;}}
}
