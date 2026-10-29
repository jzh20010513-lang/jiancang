const etfs = [
 ['semiconductor','半导体ETF','sh512480'],
 ['medical','医疗ETF','sh512170'],
 ['ev','新能源车ETF','sh515030'],
].map(([id,name,providerKey])=>Object.freeze({
 id,name,providerKey,kind:'etf',unit:'元',market:'CN',currency:'CNY',timeZone:'Asia/Shanghai',benchmarkId:'cn-large',benchmarkName:'沪深300',boundary:'ETF仅为板块观察代理，不代表你的基金收益或真实底层敞口。',
 source:Object.freeze({label:'腾讯财经ETF日线（本机审阅）',url:`https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${providerKey},day,,,250,qfq`}),
}));
const overseas=[
 ['us-growth','纳斯达克100','usNDX','US','USD','America/New_York','us-broad','标普500','纳斯达克100包含多个行业，不是纯科技指数，也不代表你所持基金。'],
 ['hk-tech-reference','恒生科技指数','hkHSTECH','HK','HKD','Asia/Hong_Kong','hk-broad','恒生指数','恒生科技指数仅为港股科技参考，不代表你所持基金的实际投资范围或收益。'],
].map(([id,name,providerKey,market,currency,timeZone,benchmarkId,benchmarkName,boundary])=>{
 const endpoint=`https://web.ifzq.gtimg.cn/appstock/app/${market==='US'?'usfqkline':'fqkline'}/get`;
 return Object.freeze({id,name,providerKey,kind:'index',unit:'点',market,currency,timeZone,benchmarkId,benchmarkName,boundary,
  source:Object.freeze({label:'腾讯财经指数日线（本机审阅）',url:`${endpoint}?param=${providerKey},day,,,250,qfq`}),
  weeklySource:Object.freeze({label:'腾讯财经指数周线（本机审阅）',url:`${endpoint}?param=${providerKey},week,,,320,qfq`})});
});
export const SECTOR_CATALOG=Object.freeze([...etfs,...overseas]);
