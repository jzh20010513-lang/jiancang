import {VIX_SOURCE} from './volatility.mjs';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const signed=v=>(v>=0?'+':'')+v.toFixed(2);
export function renderMarketEvidence(report,{ready=true}={}){
 const r=report.relative20,usable=ready&&!report.stale&&!report.sourceError&&!report.relativeStale&&!report.benchmarkError&&r;
 return `<section class="market-evidence" data-market-evidence="${usable?'available':'unavailable'}"><h4>市场对照 · 部分证据</h4>${usable?`<p>${esc(report.reference.name)}：<b>${signed(r.referencePercent)}%</b><br>${esc(report.benchmarkName)}：<b>${signed(r.benchmarkPercent)}%</b></p><p>相对基准${r.percentPoints>0?'领先':r.percentPoints<0?'落后':'持平'}${Math.abs(r.percentPoints).toFixed(2)}个百分点。这是两个参考对象的差值，不是你的基金收益。</p>`:'<p>当前缺少可用的同日比较，或数据正在读取、过期、刷新失败，暂不判断相对强弱。</p>'}<p class="caption">${r?`比较窗口：${esc(r.from)} — ${esc(r.to)}；21个共同日期、20个间隔，不前向填充。${usable?'':'此窗口仅为保留记录。'}`:'需要21个共同收盘日期，缺失日期不补值。'}<br>尚未覆盖市场广度、估值与盈利，不单凭涨跌判断贵或便宜。</p></section>`;
}
export function renderVolatilityEvidence(v){
 return `<section class="volatility-evidence" data-volatility-state="${esc(v.state)}"><h4>情绪线索 · 部分证据</h4><p>${esc(v.summary)}</p>${v.state==='available'?`<p>VIX收盘：<b>${v.level.toFixed(2)}</b> · ${esc(v.asOf)}<br>较上次${v.changePoints===null?'：比较历史不足':`变化${signed(v.changePoints)}点`}</p><details><summary>查看波动数据与适用范围</summary><p>相对此前20个收盘均值：${v.ratio20===null?'样本不足':v.ratio20.toFixed(2)+'倍'}<br>相对此前252个收盘的位置：${v.percentile252===null?'样本不足':v.percentile252.toFixed(1)+'分位（非风险评分）'}</p><p class="caption">经验分位为此前252次收盘中小于或等于本次值的比例，不含本次样本；未设买卖阈值。</p><p>${esc(v.boundary)}</p><p class="caption">来源：${esc(VIX_SOURCE.label)}；收盘日线，不是实时值。</p></details>`:v.asOf?`<p class="caption">最后保留日期：${esc(v.asOf)}，不作为当前证据。</p>`:''}<p class="caption">${v.state==='available'?'仅有波动背景，其他情绪证据不足，暂不评分。':'没有充分证据时保持未知，不按中性或利好处理。'}</p></section>`;
}
