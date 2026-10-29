import {completedReferencePoints} from './reference-periods.mjs';
export const VIX_SOURCE=Object.freeze({label:'Cboe官方VIX历史日线',url:'https://cdn-api.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv'});
const invalid=()=>{throw Error('波动背景数据格式无效');};
function plain(v,keys){if(!v||typeof v!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(v)))invalid();const actual=Reflect.ownKeys(v);if(actual.length!==keys.length)invalid();for(const k of actual){const d=Object.getOwnPropertyDescriptor(v,k);if(typeof k!=='string'||!keys.includes(k)||!('value'in d))invalid();}}
const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number(d.slice(0,4))>0&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
export function validateVixRecord(input,{maxDate=new Date().toISOString().slice(0,10)}={}){
 plain(input,['source','points','status','error']);plain(input.source,['label','url']);if(input.source.label!==VIX_SOURCE.label||input.source.url!==VIX_SOURCE.url||!validDate(maxDate)||!['available','unavailable'].includes(input.status)||(input.error!==null&&(typeof input.error!=='string'||input.error.length>2000)))invalid();
 const list=input.points;if(!Array.isArray(list)||Object.getPrototypeOf(list)!==Array.prototype||list.length>253)invalid();
 for(const k of Reflect.ownKeys(list)){if(k==='length')continue;const d=Object.getOwnPropertyDescriptor(list,k);if(typeof k!=='string'||!/^(0|[1-9]\d*)$/.test(k)||Number(k)>=list.length||!('value'in d))invalid();}
 let prior='';const points=[];for(let i=0;i<list.length;i++){if(!Object.hasOwn(list,i))invalid();const p=list[i];plain(p,['date','close']);if(!validDate(p.date)||p.date>maxDate||p.date<=prior||typeof p.close!=='number'||!Number.isFinite(p.close)||p.close<=0)invalid();prior=p.date;points.push({date:p.date,close:p.close});}
 if((input.status==='available')!==Boolean(points.length))invalid();return {source:{...VIX_SOURCE},points,status:input.status,error:input.error===null?null:'VIX采集失败，保留有日期的旧记录。'};
}
export const emptyVixRecord=()=>({source:{...VIX_SOURCE},points:[],status:'unavailable',error:'VIX尚未采集。'});
export function updateVixRecord(previous,points){
 if(points?.length){try{return validateVixRecord({source:VIX_SOURCE,points,status:'available',error:null});}catch{}}
 let old;try{old=validateVixRecord(previous);}catch{old=emptyVixRecord();}
 return {...old,error:'VIX采集失败，保留有日期的旧记录。'};
}
export function describeVolatility(input,{referenceId,now=new Date().toISOString(),loadStatus='ready'}={}){
 const boundary='VIX反映标普500未来30天的预期波动，属于美国宽基期权背景，不代表科技基金情绪，也不预测涨跌方向。点位是年化口径，不是未来30天的涨跌百分比。';
 const empty={state:'unavailable',level:null,asOf:null,changePoints:null,ratio20:null,percentile252:null,summary:'情绪证据不足：暂缺可用的美股波动背景。',boundary};
 if(referenceId!=='us-growth')return {...empty,state:'not-applicable',summary:'情绪证据不足：本轮未接入对应市场的波动、广度或调查数据，不套用美股VIX。'};
 if(loadStatus!=='ready')return {...empty,summary:'波动背景正在读取或读取失败，暂不用于当前判断。'};
 if(!input)return empty;const record=validateVixRecord(input),points=completedReferencePoints(record.points,{timeZone:'America/New_York',market:'US'},now,'day');
 const last=points.at(-1),previous=points.at(-2),age=last?(Date.parse(new Date(now).toISOString().slice(0,10))-Date.parse(last.date))/86400000:Infinity;
 if(!last||record.error!==null||age<0||age>7)return {...empty,asOf:last?.date??null,summary:record.error!==null?'VIX来源采集失败，旧记录不用于当前判断。':'VIX数据缺失、过期或本日尚未完成，不用于当前判断。'};
 const history=points.slice(0,-1),mean20=history.length>=20?history.slice(-20).reduce((mean,p,i)=>mean+(p.close-mean)/(i+1),0):null;
 const ratio=mean20>0?last.close/mean20:null;const ratio20=Number.isFinite(ratio)?ratio:null;
 const percentile252=history.length>=252?history.slice(-252).filter(p=>p.close<=last.close).length/252*100:null;
 const change=previous?last.close-previous.close:null,changePoints=Number.isFinite(change)?change:null;
 return {...empty,state:'available',level:last.close,asOf:last.date,changePoints,ratio20,percentile252,summary:changePoints===null?'已取得VIX收盘值，比较历史不足。':changePoints>0?'美国宽基期权市场对未来波动的定价较上次升高；不能据此判断科技股会跌。':changePoints<0?'美国宽基期权市场对未来波动的定价较上次降低；不能据此判断科技股会涨。':'VIX与上次基本持平，不能据此认定市场情绪稳定。'};
}
