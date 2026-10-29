// An explicit combined name/value header identifies this stacked layout.
// Labels are stripped locally; no product lookup, currency/date defaults or name correction.
const clean=s=>String(s??'').trim().replace(/([\u4e00-\u9fff])\s+(?=[\u4e00-\u9fff])/g,'$1');
export const isInterfaceLabel=value=>{
 const s=clean(value).replace(/\s*([，,、])\s*/g,'$1');
 return /^(?:占比|持仓占比|持有占比|资产占比|份额占比)/.test(s)||/^(?:基金(?:[，,、]|进阶理财|$)|进阶理财|灵活取用|全部[持有]?|金额[\/／]占比|排序|名称[\/／])/.test(s);
};
const currency=/^(?:CNY|RMB|HKD|USD|EUR|JPY|GBP|人民币|港币|港元|美元|欧元|日元|英镑)$/i;
const numeric=/^(?:[-+]?\d[\d,]*(?:\.\d+)?[万亿]?%?|--|—)$/;
const header=s=>/名称\s*[\/／]\s*(?:持仓|持有)?(?:金额|市值)/.test(s)&&/(?:日收益|昨日收益|今日收益)/.test(s);
const headerUnit=s=>s.match(/(?:金额|市值)\s*([（(]\s*(?:人民币|[万亿]?元)\s*[）)])/i)?.[1]||'';
export function alipayCardsText(text){
 const lines=String(text??'').replace(/\r/g,'').split('\n').map(clean).filter(Boolean);
 const at=lines.findIndex(header);
 if(at<0)return null;
 let unit=headerUnit(lines[at]);
 let pending=null;const out=[];
 const flush=()=>{if(!pending)return;out.push('产品名称：'+pending.name,'持仓金额'+unit+'：'+(pending.amount||''));if(pending.currency.length)out.push('币种：'+pending.currency.join(' '));pending=null;};
 for(const line of lines.slice(at+1)){
  if(header(line)){flush();unit=headerUnit(line);continue;}
  if(/^(?:占比|持仓占比|持有占比|资产占比|份额占比)/.test(line)){flush();continue;}
  if(isInterfaceLabel(line)){if(pending&&/^灵活取用/.test(line))pending.cashStyle=true;continue;}
  if(/^(?:(?:日|今日|昨日|当日|持有|累计)?(?:收益|盈亏)(?:率|金额)?(?:$|[\s:：\d+−-])|总资产|总金额|合计|总计|账户余额|数据日期|持仓日期|更新日期|截至)/.test(line))continue;
  if(line.includes('%'))continue;
  const cells=line.replace(/^[¥￥$€£]\s*/,'').split(/\s+/).filter(Boolean),currencies=cells.filter(s=>currency.test(s)),values=cells.filter(s=>!currency.test(s));
  if(values.length&&values.every(s=>numeric.test(s))){
   if(!pending)continue;
   // Never borrow a signed profit or a short/shifted row when the holding cell is absent.
   const expected=pending.cashStyle?3:4;
   pending.numericRows++;
   if(pending.numericRows===1&&values.length===expected&&/^\d[\d,]*(?:\.\d+)?[万亿]?$/.test(values[0]))pending.amount=values[0];else pending.amount=null;
   pending.currency.push(...currencies);continue;
  }
  if(pending&&/^(?:A|C|LOF|[（(]LOF[）)])$/i.test(line)&&pending.amount===null){pending.name+=line;continue;}
  // Metadata badges and navigation are not names; only textual left-column candidates remain.
  if(!/[\u4e00-\u9fff]/.test(line)||line.length<2||line.length>200||/[：:]|^币种|^代码|^基金代码/.test(line))continue;
  flush();pending={name:line,amount:null,currency:[],cashStyle:false,numericRows:0};
 }
 flush();return out.join('\n');
}
