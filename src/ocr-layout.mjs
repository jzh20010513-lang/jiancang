// Geometry is used only when distinct name and amount column headers are present.
export function tableTextFromBlocks(blocks){
 const words=[];
 for(const block of blocks||[])for(const paragraph of block.paragraphs||[])for(const line of paragraph.lines||[])for(const word of line.words||[]){
  const b=word.bbox;if(word.text?.trim()&&b&&['x0','y0','x1','y1'].every(k=>Number.isFinite(b[k])))words.push({...word,text:word.text.trim()});
 }
 const cy=w=>(w.bbox.y0+w.bbox.y1)/2;
 const sameLine=(a,b)=>Math.abs(cy(a)-cy(b))<=Math.max(a.bbox.y1-a.bbox.y0,b.bbox.y1-b.bbox.y0)*0.6;
 const nameHeader=words.find(w=>/名称/.test(w.text));
 const amountHeader=words.find(w=>/(?:金额|市值)/.test(w.text)&&!/收益|盈亏/.test(w.text)&&!words.some(prior=>/收益|盈亏/.test(prior.text)&&sameLine(prior,w)&&prior.bbox.x0>=nameHeader?.bbox.x1&&prior.bbox.x1<=w.bbox.x0)&&nameHeader&&sameLine(w,nameHeader)&&w.bbox.x0>nameHeader.bbox.x1);
 if(!nameHeader||!amountHeader)return null;
 const profit=words.filter(w=>/收益|盈亏|币种/.test(w.text)&&sameLine(w,amountHeader)&&w.bbox.x0>amountHeader.bbox.x1).sort((a,b)=>a.bbox.x0-b.bbox.x0)[0];
 const inlineUnits=amountHeader.text.match(/[（(]\s*(?:人民币|[万亿]?元)\s*[）)]/g)||[];
 const separateUnits=words.filter(w=>w!==amountHeader&&sameLine(w,amountHeader)&&/^[（(]\s*(?:人民币|[万亿]?元)\s*[）)]$/.test(w.text)&&w.bbox.x0>=amountHeader.bbox.x1&&w.bbox.x0<(profit?.bbox.x0??Infinity)).sort((a,b)=>a.bbox.x0-b.bbox.x0);
 // Units must belong to this header, not merely appear somewhere on the same line.
 if(inlineUnits.length+separateUnits.length>1||separateUnits.some(w=>w.bbox.x0-amountHeader.bbox.x1>Math.max(20,amountHeader.bbox.y1-amountHeader.bbox.y0)))return null;
 const amountUnit=inlineUnits[0]||separateUnits[0]?.text||'';
 const left=(nameHeader.bbox.x1+amountHeader.bbox.x0)/2;
 const right=profit?(amountHeader.bbox.x1+profit.bbox.x0)/2:Infinity;
 const top=Math.max(nameHeader.bbox.y1,amountHeader.bbox.y1);
 const valueWords=words.filter(w=>w.bbox.y0>top&&w.bbox.x0>=left&&w.bbox.x1<right&&/\d/.test(w.text)).sort((a,b)=>cy(a)-cy(b)||a.bbox.x0-b.bbox.x0);
 const values=[];
 for(const word of valueWords){const last=values.at(-1);if(last&&sameLine(last[0],word))last.push(word);else values.push([word]);}
 if(!values.length)return null;
 const out=[];
 for(let i=0;i<values.length;i++){
  const y0=i?Math.min(...values[i].map(w=>w.bbox.y0))-3:top;
  const y1=i+1<values.length?Math.min(...values[i+1].map(w=>w.bbox.y0))-3:Math.max(...values[i].map(w=>w.bbox.y1))+Math.max(...values[i].map(w=>w.bbox.y1-w.bbox.y0))*2;
  const nameWords=words.filter(w=>w.bbox.x0<left&&w.bbox.x1<amountHeader.bbox.x0&&cy(w)>y0&&cy(w)<y1).sort((a,b)=>a.bbox.y0-b.bbox.y0||a.bbox.x0-b.bbox.x0);
  const aligned=nameWords.filter(w=>sameLine(w,values[i][0]));
  if(!aligned.length)return null;
  const suffix=nameWords.filter(w=>!aligned.includes(w));
  // Only an explicit share-class suffix can continue below an aligned name.
  // Other off-line names signal card layout: abandon geometry rather than join funds.
  if(suffix.length>1||suffix.some(w=>!/^(?:A|C|LOF|[（(]LOF[）)])$/i.test(w.text)||cy(w)<=cy(values[i][0])))return null;
  const name=[...aligned,...suffix].map(w=>w.text).join('');if(!name||/总资产|总金额|账户|合计|总计|收益|盈亏|日期/.test(name))continue;

  out.push('产品名称：'+name,'持仓金额'+amountUnit+'：'+values[i].sort((a,b)=>a.bbox.x0-b.bbox.x0).map(w=>w.text).join(' '));
  const explicitCurrencies=words.filter(w=>sameLine(w,values[i][0])&&/^(?:CNY|RMB|HKD|USD|EUR|JPY|GBP|人民币|港币|港元|美元|欧元|日元|英镑)$/i.test(w.text)).map(w=>w.text);
  if(explicitCurrencies.length)out.push('币种：'+explicitCurrencies.join(' '));
 }
 return out.length?out.join('\n'):null;
}
export function recognitionSize(width,height){
 const scale=Math.min(Math.max(1,1400/width),2.5,Math.sqrt(18_000_000/(width*height)));
 return {width:Math.max(1,Math.floor(width*scale)),height:Math.max(1,Math.floor(height*scale))};
}
export function prepareRecognitionCanvas(canvas){
 const size=recognitionSize(canvas.width,canvas.height);
 if(size.width===canvas.width&&size.height===canvas.height)return canvas;
 const scaled=document.createElement('canvas');scaled.width=size.width;scaled.height=size.height;
 const ctx=scaled.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(canvas,0,0,size.width,size.height);return scaled;
}
