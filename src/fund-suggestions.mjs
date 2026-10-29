// Deliberately tiny, offline reference set. This is not a fund master database.
const CODE_SECTORS = Object.freeze({'512480':'semiconductor','512170':'medical','515030':'ev'});
const SECTORS = Object.freeze([
 {id:'semiconductor',pattern:/半导体|芯片/},
 {id:'medical',pattern:/医疗/},
 {id:'ev',pattern:/新能源车|新能源汽车/},
 {id:'us-tech',pattern:/美股科技|美国(?:信息)?科技/},
 {id:'hk-tech',pattern:/港股科技|恒生科技/},
 {id:'cn-tech',pattern:/A股科技/i},
 {id:'ai',pattern:/人工智能/},
 {id:'software',pattern:/软件|云计算/},
 {id:'internet',pattern:/互联网/},
 {id:'pharma',pattern:/医药|生物科技/},
 {id:'consumer',pattern:/消费/},
 {id:'energy',pattern:/能源/},
 {id:'financials',pattern:/金融|银行/},
 {id:'industrial',pattern:/制造/},
 {id:'real-estate',pattern:/房地产/},
 {id:'global-equity',pattern:/全球(?:精选)?股票/},
]);
const BENCHMARKS = Object.freeze([
 {id:'cn-large',pattern:/沪深\s*300(?=指数|ETF|基金|联接|$)/i},
 {id:'cn-growth',pattern:/创业板(?:指数(?=ETF|基金|联接|$)|ETF)/i},
 {id:'hk-broad',pattern:/恒生(?:指数(?=ETF|基金|联接|$)|ETF)/i},
 {id:'us-broad',pattern:/标普\s*500(?=指数|ETF|基金|联接|$)/i},
 {id:'us-tech',pattern:/纳斯达克\s*100(?=指数|ETF|基金|联接|$)/i},
 {id:'gold-us',pattern:/黄金/},
]);
const empty = basis => ({category:null,sectorIds:[],benchmarkIds:[],basis,confidence:'unknown',canonicalName:null});

/** Return candidates only. Never writes holding, classification, or review state. */
export function suggestFund(row) {
 const name=typeof row?.name==='string'?row.name.trim():'';
 const code=typeof row?.code==='string'?row.code.trim():'';
 const knownSector=Object.hasOwn(CODE_SECTORS,code)?CODE_SECTORS[code]:null;
 const sectorIds=SECTORS.filter(rule=>rule.pattern.test(rule.id==='energy'?name.replace(/新能源/g,''):name)).map(rule=>rule.id);
 const goldEquity=/黄金(?:股|产业|矿|珠宝)|黄金.*股票/.test(name);
 const indexVariant=/红利|等权|低波|价值|成长|科技|生物|医疗|债券/.test(name);
 const benchmarkIds=BENCHMARKS.filter(rule=>rule.pattern.test(name) && (rule.id==='gold-us'?!goldEquity:!indexVariant)).map(rule=>rule.id);
 // Broad index aliases share the same variant protection as benchmark candidates.
 for(const [benchmark,sector] of [['cn-large','cn-broad'],['us-broad','us-broad'],['hk-broad','hk-broad']])if(benchmarkIds.includes(benchmark))sectorIds.push(sector);
 const specific=[];
 if(/债券/.test(name))specific.push('固收');
 if(/货币(?:市场)?基金|现金管理|^现金$/.test(name) && !/数字货币|虚拟货币|加密货币/.test(name))specific.push('现金');
 if(/黄金/.test(name) && !goldEquity)specific.push('黄金');
 if(/股票/.test(name))specific.push('权益');
 if(/混合/.test(name))specific.push('混合');
 const categoryConflict=specific.length>1;
 // ETF / 指数 describes a wrapper; it must not override an explicit bond/gold type.
 const category=specific[0]??(/ETF|指数/i.test(name)?'权益':null);
 if(category==='固收')sectorIds.push('bond');
 if(category==='现金')sectorIds.push('cash');
 if(category==='黄金')sectorIds.push('gold');
 const equityIndexName=/沪深\s*300|创业板|恒生|标普\s*500|纳斯达克\s*100/.test(name);
 const codeConflict=knownSector && (
  sectorIds.some(id=>id!==knownSector) || benchmarkIds.length>0 || equityIndexName || goldEquity ||
  (category!==null && category!=='权益')
 );
 const equitySectors=sectorIds.filter(id=>!['bond','cash','gold'].includes(id));
 const typeConflict=['固收','现金','黄金'].includes(category) && (equitySectors.length>0 || equityIndexName);
 if(categoryConflict || codeConflict || typeConflict)return empty(['代码与名称或名称类别关键词存在冲突，请核对原始名称和代码；不提供分类或映射候选。']);
 if(sectorIds.length>3)return empty(['名称包含过多行业或市场关键词，候选关系不确定；保留未知，请人工核对，不截断为前三项。']);
 if(knownSector)return {category:'权益',sectorIds:[knownSector],benchmarkIds:[],basis:[`代码 ${code} 命中本地有限参考表，仅提供对应行业参考关系候选；不是穿透持仓分析，须人工核对并确认。`],confidence:'exact-code',canonicalName:null};
 if(category || sectorIds.length || benchmarkIds.length)return {category,sectorIds,benchmarkIds,basis:[`名称关键词候选：${name}。仅依据名称中明确出现的类别、行业或指数词；不是穿透持仓分析，也不证明实际跟踪关系，须人工核对并确认。`,...(category==='现金' && /货币/.test(name)?['名称含“货币”，按工作台分类提供“现金”候选；不表示等同银行现金。']:[])],confidence:'name-keyword',canonicalName:null};
 return empty(['未命中本地代码参考表或明确名称关键词；保留未知，请人工核对。']);
}
