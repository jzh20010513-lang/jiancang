// This adapter recognizes only the explicit stacked name/amount layout. It does
// not infer currency, dates or profits from the application that supplied it.
export function alipayTextFromBlocks(blocks){
 const words=[];
 for(const block of blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[])for(const word of line.words||[]){
  const b=word.bbox;
  if(word.text?.trim()&&b&&['x0','y0','x1','y1'].every(k=>Number.isFinite(b[k]))&&b.x1>b.x0&&b.y1>b.y0)words.push({text:word.text.trim(),bbox:b});
 }
 const cy=w=>(w.bbox.y0+w.bbox.y1)/2;
 const compact=s=>s.replace(/\s+/g,'');
 const lines=[];
 for(const word of words.sort((a,b)=>cy(a)-cy(b)||a.bbox.x0-b.bbox.x0)){
  const last=lines.at(-1);
  if(last&&Math.abs(cy(last[0])-cy(word))<=Math.min(last[0].bbox.y1-last[0].bbox.y0,word.bbox.y1-word.bbox.y0)*.45)last.push(word);else lines.push([word]);
 }
 let header;
 for(const line of lines){
  line.sort((a,b)=>a.bbox.x0-b.bbox.x0);
  // Prefixes allow Tesseract to split Chinese header characters into words.
  for(let i=1;i<line.length;i++){
   const left=line.slice(0,i),right=line.slice(i);
   const label=compact(left.map(w=>w.text).join(''));
   if(!/^(?:基金)?名称[/／](?:金额|市值)(?:[（(](?:人民币|[万亿]?元)[）)])?$/.test(label))continue;
   let daily;
   for(let j=1;j<=right.length;j++)if(/^(?:日收益|昨日收益)$/.test(compact(right.slice(0,j).map(w=>w.text).join('')))){daily=right[0];break;}
   if(!daily||daily.bbox.x0<=Math.max(...left.map(w=>w.bbox.x1)))continue;
   if(header)return null;
   header={line,x:left[0].bbox.x0,profitX:daily.bbox.x0,top:Math.max(...line.map(w=>w.bbox.y1)),height:Math.max(...left.map(w=>w.bbox.y1-w.bbox.y0)),unit:label.match(/[（(](?:人民币|[万亿]?元)[）)]/)?.[0]||''};
  }
 }
 if(!header)return null;
 const anchorTolerance=header.height*2;
 const currency=/^(?:CNY|RMB|HKD|USD|EUR|JPY|GBP|人民币|港币|港元|美元|欧元|日元|英镑)$/i;
 const badge=/^(?:基金|进阶理财|灵活取用|稳健理财|随时可取|全.*(?:指数)?基金.*)$/;
 const suffix=/^(?:[AC]|[（(]?(?:ETF|LOF)[）)]?[AC]?)$/i;
 const number=/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/;
 const out=[];let pending=[],nameBottom=0;
 for(const line of lines){
  if(line===header.line||Math.min(...line.map(w=>w.bbox.y0))<=header.top)continue;
  const left=line.filter(w=>w.bbox.x0<header.profitX);
  if(!left.length)continue;
  const text=compact(left.map(w=>w.text).join(''));
  // A ratio marks the end of a card. An unpaired title cannot borrow a later
  // amount from beyond that boundary, even when right-column profits exist.
  if(/占比|[%％]|收益率/.test(text)){
   if(pending.length)return null;
   continue;
  }
  // Category labels never supply product names or amounts.
  const badgeParts=text.split(/[，,、;；|｜·•]+/).filter(Boolean);
  if(badgeParts.length&&badgeParts.every(part=>badge.test(part)))continue;
  if(Math.abs(left[0].bbox.x0-header.x)>anchorTolerance)continue;
  const nonCurrency=left.filter(w=>!currency.test(compact(w.text)));
  const value=compact(nonCurrency.map(w=>w.text).join(' '));
  if(nonCurrency.length===1&&number.test(value)&&nonCurrency[0].bbox.x1<header.profitX){
   if(!pending.length||nonCurrency[0].bbox.y0<=nameBottom)return null;
   const name=pending.join('');
   out.push('产品名称：'+name,'持仓金额'+header.unit+'：'+value.replace(/,/g,''));
   const explicit=line.filter(w=>currency.test(compact(w.text))).map(w=>compact(w.text));
   if(explicit.length)out.push('币种：'+explicit.join(' '));
   pending=[];continue;
  }
  if(!text||/^[+−-]?\d|金额|市值|总资产|总金额|合计|总计|账户|日期|收益|盈亏|币种|[:：]/.test(text))return null;
  if(!/[\p{Script=Han}A-Za-z]/u.test(text))return null;
  // A Chinese type prefix cannot prove that two lines belong to the same fund.
  // Only a short explicit share-class suffix safely continues a prior title.
  if(pending.length&&!suffix.test(text))return null;
  pending.push(text);nameBottom=Math.max(...left.map(w=>w.bbox.y1));
 }
 return pending.length||!out.length?null:out.join('\n');
}
