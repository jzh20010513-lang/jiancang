import {technicalAnalysis} from './technical.mjs';
// Comparison tolerance suppresses floating-point noise, not economic changes.
const cmp=(a,b)=>Math.abs(a-b)<=1e-10*Math.max(Math.abs(a),Math.abs(b),1)?0:a>b?1:-1;
function explainDaily(points,{usable=true,reason='行情暂不可用'}={}){
 const period='日线 · 按已完成交易样本计算',weekly='周线尚未确认：本轮仅解释日线，不把短期反弹当作周线转强。';
 const empty={state:'unavailable',summary:reason,period,weekly,trend:{state:'unknown',text:'暂不判断当前趋势。'},momentum:{state:'unknown',text:'暂不判断当前动能。',cross:null,aboveZero:null,zeroCross:null},volume:{ratio:null,text:'成交量证据不足。'}};
 if(!usable)return empty;
 const t=technicalAnalysis(points);if(!t.sampleCount)return {...empty,state:'insufficient',summary:'历史样本不足，暂不判断走势。'};
 const previous=technicalAnalysis(points.slice(0,-1)),prior5=technicalAnalysis(points.slice(0,-5));
 let trend={state:'unknown',text:'不足60个日线样本，不能同时对照20与60样本均线。'};
 if(t.ma20!==null&&t.ma60!==null){
  const above=cmp(t.lastClose,t.ma20)>0&&cmp(t.lastClose,t.ma60)>0,below=cmp(t.lastClose,t.ma20)<0&&cmp(t.lastClose,t.ma60)<0;
  const directions=prior5.ma60!==null?[cmp(t.ma20,prior5.ma20),cmp(t.ma60,prior5.ma60)]:null;
  trend={state:below&&directions?.every(d=>d<0)?'weak':above&&directions?.every(d=>d>0)?'strong':'mixed',text:`收盘${above?'高于':below?'低于':'处于或贴近'}20、60样本均线${directions?`；两条均线相对5个样本前${directions.every(d=>d>0)?'均向上':directions.every(d=>d<0)?'均向下':directions.every(d=>d===0)?'基本持平':'方向不一致'}`:'；均线方向的比较历史不足'}。`};
 }
 let momentum={state:'unknown',text:'MACD连续比较需要至少61个日线样本，暂不判断交叉或动能变化。',cross:null,aboveZero:null,zeroCross:null};
 if(t.macd&&previous.macd){
  const m=t.macd,p=previous.macd,signal=cmp(m.dif,m.dea),priorSignal=cmp(p.dif,p.dea),zero=cmp(m.dif,0),priorZero=cmp(p.dif,0),change=cmp(m.histogram,p.histogram);
  const cross=signal>0&&priorSignal<=0?'golden':signal<0&&priorSignal>=0?'dead':null;
  const zeroCross=zero>0&&priorZero<=0?'up':zero<0&&priorZero>=0?'down':null;
  const state=signal<0&&change>0?'easing':signal<0&&change<0?'weakening':signal>0&&change>0?'strengthening':signal>0&&change<0?'cooling':'steady';
  const changeText={easing:'负柱缩短，下跌动能有所减弱',weakening:'负柱变长，下跌动能仍在增强',strengthening:'正柱变长，上涨动能有所增强',cooling:'正柱缩短，上涨动能有所放缓',steady:'柱体变化不明显或正处于交界'}[state];
  momentum={state,cross,aboveZero:zero>0,zeroCross,text:`${cross==='golden'?'DIF刚上穿DEA（常说的金叉）；':cross==='dead'?'DIF刚下穿DEA（常说的死叉）；':''}${changeText}。DIF${zero>0?'在零轴上方':zero<0?'仍在零轴下方':'接近零轴'}${zeroCross?`，本次${zeroCross==='up'?'上穿':'下穿'}零轴`:''}；交叉与越过零轴是不同条件。`};
 }
 const ratio=t.volumeRatio20,priceChange=previous.lastClose===null?null:cmp(t.lastClose,previous.lastClose);
 const volume={ratio,text:ratio===null?'成交量缺失、样本不足或历史均量为零，无法比较交易活跃程度。':`本次成交量是此前20个样本均量的${ratio.toFixed(2)}倍；收盘较上一样本${priceChange>0?'上涨':priceChange<0?'下跌':'基本持平'}。这只说明交易活跃程度，不代表主力进场或资金净流入。`};
 let summary=trend.state==='strong'?'日线位置和均线方向偏强，仍需观察能否持续。':trend.state==='weak'?'日线仍偏弱，尚未出现足够的趋势改善证据。':trend.state==='unknown'?'趋势历史不足，先观察已有样本。':'价格位置与均线方向未形成一致信号，暂不确认趋势转强。';
 if(trend.state==='weak'&&(momentum.state==='easing'||momentum.state==='strengthening'))summary='日线仍偏弱，但下跌动能减弱或短线动能改善；有反弹观察迹象，尚未确认趋势转强。';
 if(trend.state==='strong'&&(momentum.state==='cooling'||momentum.state==='weakening'))summary='日线位置偏强，但动能放缓或转弱，信号有分歧。';
 return {state:trend.state==='unknown'?'insufficient':'available',summary,period,weekly,trend,momentum,volume,lastDate:t.lastDate};
}

export function explainTechnical(points,options={}){
 const timeframe=options.timeframe??'day';if(!['day','week'].includes(timeframe))throw Error('Unknown timeframe');
 const result=explainDaily(points,options);
 if(timeframe==='day')return {...result,timeframe};
 const convert=value=>typeof value==='string'?value.replaceAll('日线','周线'):Array.isArray(value)?value.map(convert):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,convert(v)])):value;
 return {...convert(result),timeframe,period:'周线 · 按源市场已结束的交易周计算',weekly:'周线与日线分别观察，不代表基金实际收益。'};
}
