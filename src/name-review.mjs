// Exact, unique word-span matching only. No fuzzy lookup or fund-name correction.
const compact=s=>String(s??'').replace(/\s/gu,'');
export function nameRegion(name,blocks,input,source){
 const target=compact(name),sizes=[input?.width,input?.height,source?.width,source?.height];
 if(!target||sizes.some(v=>!Number.isFinite(v)||v<=0))return null;
 const matches=[];
 for(const block of blocks||[])for(const para of block.paragraphs||[])for(const line of para.lines||[]){
  const words=line.words||[];
  for(let start=0;start<words.length;start++){
   let text='';
   for(let end=start;end<words.length;end++){
    text+=compact(words[end].text);
    if(!target.startsWith(text))break;
    if(text!==target)continue;
    const boxes=words.slice(start,end+1).map(w=>w.bbox);
    if(boxes.some(b=>!b||['x0','y0','x1','y1'].some(k=>!Number.isFinite(b[k]))||b.x0<0||b.y0<0||b.x1<=b.x0||b.y1<=b.y0||b.x1>input.width||b.y1>input.height))break;
    matches.push(boxes);break;
   }
  }
 }
 if(matches.length!==1)return null;
 const boxes=matches[0],sx=source.width/input.width,sy=source.height/input.height;
 const x=Math.max(0,Math.floor((Math.min(...boxes.map(b=>b.x0))-4)*sx));
 const y=Math.max(0,Math.floor((Math.min(...boxes.map(b=>b.y0))-4)*sy));
 const right=Math.min(source.width,Math.ceil((Math.max(...boxes.map(b=>b.x1))+4)*sx));
 const bottom=Math.min(source.height,Math.ceil((Math.max(...boxes.map(b=>b.y1))+4)*sy));
 return {x,y,width:right-x,height:bottom-y};
}
export function nameReviewMessage(name){
 const s=String(name??'');
 if(/…|\.{2,}|⋯/.test(s))return '名称含省略号，可能未显示完整。请到原平台核对全名，不自动猜补。';
 const opens=(s.match(/[（(]/g)||[]).length,closes=(s.match(/[）)]/g)||[]).length;
 if(opens!==closes)return '名称括号不完整，可能存在遗漏。请对照原图或原平台补齐。';
 return '请逐字核对名称，尤其是相似汉字、英文和 A/C 份额；没有提示也不代表识别正确。';
}
