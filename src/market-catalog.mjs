const references = [
  ['cn-large','沪深300','CN','CNY','点','index','sh000300','Asia/Shanghai'],
  ['cn-growth','创业板指','CN','CNY','点','index','sz399006','Asia/Shanghai'],
  ['hk-broad','恒生指数','HK','HKD','点','index','hkHSI','Asia/Hong_Kong'],
  ['us-broad','标普500','US','USD','点','index','usINX','America/New_York'],
  ['us-tech','纳斯达克100','US','USD','点','index','usNDX','America/New_York'],
  ['gold-us','GLD黄金ETF（美元参考）','US','USD','美元/份','etf','usGLD','America/New_York'],
];
export const MARKET_CATALOG = Object.freeze(references.map(([id,name,market,currency,unit,kind,providerKey,timeZone]) => Object.freeze({
  id,name,market,currency,unit,kind,providerKey,timeZone,
  source:Object.freeze({label:'腾讯财经日线（本机审阅）',url:`https://web.ifzq.gtimg.cn/appstock/app/${market==='US'?'usfqkline':'fqkline'}/get?param=${providerKey},day,,,250,qfq`}),
})));
