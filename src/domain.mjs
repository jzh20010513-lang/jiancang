export const currencies = Object.freeze(['CNY','HKD','USD','EUR','JPY','GBP']);
const SCALE=100000000n;
const LIMIT=1000000000000000n*SCALE;
let sequence=0;
const id=()=>globalThis.crypto?.randomUUID?.() ?? `local-${Date.now()}-${++sequence}`;
const scaled=text=>{ const negative=text.startsWith('-');const [whole,frac='']=text.replace(/^-/, '').split('.');return BigInt(`${whole}${frac.padEnd(8,'0')}`)*(negative?-1n:1n); };
const decimal=value=>{const negative=value<0n;const abs=negative?-value:value;const frac=(abs%SCALE).toString().padStart(8,'0').replace(/0+$/,'');return `${negative?'-':''}${abs/SCALE}${frac?`.${frac}`:''}`;};

export function parseAmount(input){
 if(typeof input!=='string' && typeof input!=='number')return null;
 if(typeof input==='number' && !Number.isFinite(input))return null;
 const text=String(input).trim();if(text.length>100)return null;
 const match=/^([+-]?)(\d+|[1-9]\d{0,2}(?:,\d{3})+)(?:\.(\d{1,8}))?([万亿]?)$/.exec(text);if(!match)return null;
 const value=scaled(`${match[1]==='-'?'-':''}${match[2].replaceAll(',','')}${match[3]?`.${match[3]}`:''}`)*(match[4]==='万'?10000n:match[4]==='亿'?100000000n:1n);
 return value>LIMIT || value< -LIMIT ? null:decimal(value);
}

export function newHolding(overrides={}){
 return {id:id(),accountId:'account-default',name:'',code:null,assetGroupId:null,currency:null,marketValue:null,asOfDate:null,categoryId:null,tagIds:[],source:'manual',reviewStatus:'needs_attention',reportedHoldingPnl:null,reportedDailyPnl:null,reportedPnlCurrency:null,reportedPnlDate:null,...overrides};
}

export function makeSnapshot(holdings,extras={}){
 const accounts=(extras.accounts??[]).map(x=>({...x}));const categories=(extras.categories??[]).map(x=>({...x}));const tags=(extras.tags??[]).map(x=>({...x}));
 for(const row of holdings){
  if(!accounts.some(x=>x.id===row.accountId))accounts.push({id:row.accountId,alias:row.accountId==='account-default'?'默认账户':row.accountId});
  if(row.categoryId&&!categories.some(x=>x.id===row.categoryId))categories.push({id:row.categoryId,name:row.categoryId});
  for(const tag of row.tagIds??[])if(!tags.some(x=>x.id===tag))tags.push({id:tag,name:tag});
 }
 return {schemaVersion:1,id:extras.id??id(),createdAt:extras.createdAt??new Date().toISOString(),coverage:'partial_or_unknown',accounts,categories,tags,holdings:holdings.map(row=>({...row,tagIds:[...row.tagIds]}))};
}

export function selectRows(snapshot,filters={}){
 const accountNames=new Map(snapshot.accounts.map(a=>[a.id,a.alias]));const categoryNames=new Map(snapshot.categories.map(a=>[a.id,a.name]));const tagNames=new Map(snapshot.tags.map(a=>[a.id,a.name]));
 const query=(filters.query??'').trim().toLocaleLowerCase();
 return snapshot.holdings.filter(row=>(!filters.accountId||row.accountId===filters.accountId)&&(!filters.categoryId||row.categoryId===filters.categoryId)&&(!filters.tagId||row.tagIds.includes(filters.tagId))&&(!query||[row.name,row.code,accountNames.get(row.accountId),categoryNames.get(row.categoryId),...row.tagIds.map(t=>tagNames.get(t))].filter(Boolean).join(' ').toLocaleLowerCase().includes(query)));
}

export function aggregate(snapshot,filters={}){
 const accountNames=new Map(snapshot.accounts.map(a=>[a.id,a.alias]));const categoryNames=new Map(snapshot.categories.map(a=>[a.id,a.name]));
 const rows=selectRows(snapshot,filters);
 const valid=rows.filter(row=>row.reviewStatus==='confirmed'&&row.name.trim()&&currencies.includes(row.currency)&&row.marketValue!==null&&parseAmount(row.marketValue)!==null&&scaled(parseAmount(row.marketValue))>=0n);
 const result=[];
 for(const currency of currencies){const currencyRows=valid.filter(row=>row.currency===currency);if(!currencyRows.length)continue;
  const total=currencyRows.reduce((sum,row)=>sum+scaled(parseAmount(row.marketValue)),0n);
  const percent=value=>total===0n?null:Number((value*10000n+total/2n)/total)/100;
  const group=(field,names,fallback)=>{const grouped=new Map();for(const row of currencyRows){const key=row[field];grouped.set(key,(grouped.get(key)??0n)+scaled(parseAmount(row.marketValue)));}return [...grouped].map(([key,value])=>({name:names.get(key)??fallback,value:decimal(value),percent:percent(value)})).sort((a,b)=>scaled(a.value)>scaled(b.value)?-1:scaled(a.value)<scaled(b.value)?1:0);};
  const concentration=new Map();for(const row of currencyRows){const key=row.assetGroupId?`group:${row.assetGroupId}`:`row:${row.id}`;const previous=concentration.get(key);concentration.set(key,{name:previous?.name??row.name,value:(previous?.value??0n)+scaled(row.marketValue)});}
  const largest=[...concentration.values()].reduce((best,item)=>!best||item.value>best.value?item:best,null);
  result.push({currency,total:decimal(total),rows:currencyRows,accounts:group('accountId',accountNames,'未命名账户'),categories:group('categoryId',categoryNames,'未分类'),largest:largest?{name:largest.name,value:decimal(largest.value),percent:percent(largest.value)}:null});
 }
 return {currencies:result,excluded:rows.length-valid.length,dates:[...new Set(valid.map(row=>row.asOfDate).filter(Boolean))].sort(),unknownDate:valid.some(row=>row.asOfDate===null),filteredCount:rows.length};
}
