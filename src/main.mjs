import {nameReviewMessage} from './name-review.mjs';
import './styles.css';
import {aggregate,selectRows,newHolding,makeSnapshot,parseAmount,currencies} from './domain.mjs';
import {defaultLayout,validateExport,exportFull,exportLayout,defaultPlanning} from './transfer.mjs';
import {createPersistence,browserDriver} from './storage.mjs';
import {decodeImage,validateBatch} from './images.mjs';
import {startRecognition,cancelRecognition,parseCandidates} from './ocr.mjs';
import {formatDecimal} from './format.mjs';
import {renderGoalEditor,readGoalForm,showGoalError,renderCheckup,demoPlan} from './checkup-view.mjs';
import {advancePlanning} from './planning-state.mjs';
import {MARKET_CATALOG} from './market-catalog.mjs';
import {SECTOR_OPTIONS} from './sector-options.mjs';
import {suggestFund} from './fund-suggestions.mjs';
import {confirmSectorSelections} from './sectors.mjs';
import {validateLiveQuotes} from './live-quotes.mjs';
import {renderLiveQuotes} from './live-view.mjs';
import {validateSectorBundle} from './sector-data.mjs';
import {renderSectorObservation,createSectorDraft,readSectorManager,renderSectorManager} from './sector-view.mjs';
import {defaultMarketPreferences,validateMarketBundle} from './markets.mjs';
import {renderRelatedMarkets,renderMarketManager,createMarketDraft,readMarketManager} from './market-view.mjs';

const nameEvidence=new Map(),mappingRechecks=new Set();
function clearNameEvidence(){for(const e of nameEvidence.values())if(e.canvas){e.canvas.width=1;e.canvas.height=1;}nameEvidence.clear();}
function nameReview(row){const e=nameEvidence.get(row.id);if(!e)return '';return `<aside class="name-review"><b>识别原名称：${esc(e.name)}</b><p>${esc(nameReviewMessage(e.name))}</p>${e.canvas?`<div data-name-evidence="${attr(row.id)}"></div><small>第 ${e.imageNumber} 张截图的名称片段 · 仅本次会话</small>`:'<p>未能唯一定位名称片段，请对照上方完整截图或原平台核对。</p>'}</aside>`;}
const app=document.querySelector('#app'), persistence=createPersistence(browserDriver);
let snapshot=null,layout=defaultLayout(),draft=null,panel='',message='',busy=false,progress='',images=[],selectedImage=0,rawText='',preview=null,restoreLayout=null,isDemo=false,dirty=false;
let filters={accountId:'',categoryId:'',tagId:'',query:''},importGeneration=0,imageLoading=false;
let planning=defaultPlanning(),restorePlanning=null,draftMode='import',lastView='';
const publicStatic=import.meta.env?.VITE_PUBLIC_STATIC==='true';
let liveBundle=null,liveStatus='idle',liveEnabled=!publicStatic,liveGeneration=0,liveController=null;
let sectorBundle=null,sectorStatus='loading',sectorDraft=null,sectorGeneration=0;
let marketBundle=null,marketStatus='loading',marketDraft=null,marketRanges={},marketGeneration=0;
const uid=()=>crypto.randomUUID();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const attr=(v)=>esc(v);
const checked=v=>v?' checked':'';
const money=(v,currency='')=>layout.mask?'••••••':`${currency?currency+' ':''}${formatDecimal(v)}`;
const pill=(text,cls='')=>`<span class="pill ${cls}">${esc(text)}</span>`;
const button=(action,text,cls='',extra='')=>`<button type="button" data-action="${action}" class="${cls}" ${extra}>${text}</button>`;
function toast(text){message=text;let box=document.querySelector('.notification');if(!box){box=document.createElement('div');box.className='notification';box.setAttribute('role','status');document.querySelector('.topbar').after(box);}box.replaceChildren(document.createTextNode(text));const close=document.createElement('button');close.type='button';close.dataset.action='dismiss';close.className='quiet';close.setAttribute('aria-label','关闭提示');close.textContent='×';box.append(close);}
function disposeImages(){mappingRechecks.clear();clearNameEvidence();images.forEach(x=>{x.canvas.width=1;x.canvas.height=1;});images=[];rawText='';selectedImage=0;}
function blankDraft(){return {rows:[newHolding()],accounts:[],categories:[],tags:[]};}
function draftFrom(s){return {rows:s.holdings.map(r=>({...r,tagIds:[...r.tagIds]})),accounts:structuredClone(s.accounts),categories:structuredClone(s.categories),tags:structuredClone(s.tags)};}
function makeDemo(){
 const rows=[['远山宽基组合','128000','CNY','证券账户','权益'],['青禾现金管理','42000','CNY','日常账户','现金'],['澄海债券组合','30000','CNY','证券账户','固收'],['海外市场组合','8000','USD','海外账户','权益']];
 return makeSnapshot(rows.map(([name,marketValue,currency,accountId,categoryId])=>newHolding({name,marketValue,currency,accountId,categoryId,asOfDate:'2026-10-20',reviewStatus:'confirmed',favorite:false,liquidity:categoryId==='现金'?'available':categoryId==='固收'?'locked':'unknown',unlockDate:categoryId==='固收'?'2027-06-01':null,benchmarkIds:name==='远山宽基组合'?['cn-large']:name==='海外市场组合'?['us-tech']:[],benchmarkReview:'confirmed',sectorIds:name==='远山宽基组合'?['semiconductor']:[],sectorReview:'confirmed'})),{});
}
function header(){return `<aside class="sidebar"><a class="brand" href="#"><span class="brand-mark">见</span><span>见仓<small>LOCAL PORTFOLIO</small></span></a><p class="nav-label">我的工作空间</p>${button('home','▦ <span>资产看板</span>','nav active')}${button('import','＋ <span>导入持仓</span>','nav')}${button('plan','◎ <span>目标与体检</span>','nav')}${button('data','⇅ <span>数据与备份</span>','nav')}${button('help','◈ <span>使用与隐私</span>','nav')}<div class="sidebar-bottom"><span class="status-dot"></span><strong>数据留在此设备</strong><p>无账号 · 本地识别<br>你的资产，由你掌握。</p><span class="version">审阅版 0.3</span></div></aside>`;}
function empty(){return `<section class="welcome"><div class="eyebrow"><span class="status-dot"></span> 你的持仓，只属于你</div><h1>让持仓，清晰可见。</h1><p class="lead">从一张截图开始，整理分散的资产。<br>对照自己的计划，知道先核对什么。</p><div class="welcome-actions">${button('import','＋ 导入持仓截图','primary large')}${button('demo','体验虚构示例','secondary large')}</div><p class="caption">无需注册 · 截图本地识别 · 支持手动补录</p><div class="welcome-art" aria-label="导入、核对、看板三个步骤"><div class="paper"><span>持仓截图</span><div class="paper-line"></div><div class="paper-line short"></div><div class="paper-line"></div><strong>留在你的设备</strong></div><span class="flow-arrow">→</span><div class="art-board"><div class="art-title">你的资产分布</div><div class="art-bars"><i></i><i></i><i></i></div><p>看得清，也核对得明白</p></div></div><div class="feature-row"><article><b>先核对，再入账</b><p>识别不确定的地方，由你确认。<br>不把缺失数据当作零。</p></article><article><b>按自己的目标体检</b><p>配置、集中度和用钱安排，<br>都按你的标准核对。</p></article><article><b>随时导出与带走</b><p>默认只在本次会话使用，<br>保存与备份由你决定。</p></article></div></section>`;}
function options(list,idKey,labelKey,current,emptyLabel){return `<option value="">${emptyLabel}</option>`+list.map(x=>`<option value="${attr(x[idKey])}"${x[idKey]===current?' selected':''}>${esc(x[labelKey])}</option>`).join('');}
function distribution(items){return `<div class="distribution">${items.map((x,i)=>`<div class="distribution-row"><div><span class="swatch color-${i%6}"></span><span>${esc(x.name)}</span><b>${layout.mask?'•••':x.percent===null?'—':x.percent+'%'}</b></div><meter min="0" max="100" value="${x.percent??0}" class="meter-${i%6}" aria-label="${attr(x.name)}占比"></meter><small>${money(x.value)}</small></div>`).join('')}</div>`;}
function holdingsTable(){
 const rows=selectRows(snapshot,filters);
 const has=c=>layout.columns.includes(c),accounts=new Map(snapshot.accounts.map(x=>[x.id,x.alias])),cats=new Map(snapshot.categories.map(x=>[x.id,x.name])),tags=new Map(snapshot.tags.map(x=>[x.id,x.name]));
 return `<div class="table-scroll"><table><thead><tr><th>资产名称</th><th class="numeric">持仓金额</th>${has('account')?'<th>账户</th>':''}${has('category')?'<th>分类</th>':''}${has('date')?'<th>数据日期</th>':''}${has('pnl')?'<th>截图报告收益</th>':''}${has('tags')?'<th>标签</th>':''}<th>状态</th></tr></thead><tbody>${rows.map(r=>`<tr><td><strong>${r.favorite?'★ ':''}${esc(r.name||'待补名称')}</strong><small>${esc(r.code||'—')}</small></td><td class="numeric">${r.marketValue===null?'待补':money(r.marketValue,r.currency||'币种待补')}</td>${has('account')?`<td>${esc(accounts.get(r.accountId))}</td>`:''}${has('category')?`<td>${esc(cats.get(r.categoryId)||'未分类')}</td>`:''}${has('date')?`<td>${esc(r.asOfDate||'日期未知')}</td>`:''}${has('pnl')?`<td>${r.reportedHoldingPnl===null&&r.reportedDailyPnl===null?'未提供':`<small>持有：${r.reportedHoldingPnl===null?'未提供':money(r.reportedHoldingPnl,r.reportedPnlCurrency||'币种未知')}<br>当日：${r.reportedDailyPnl===null?'未提供':money(r.reportedDailyPnl,r.reportedPnlCurrency||'币种未知')}<br>${esc(r.reportedPnlDate||'报告日期未知')}</small>`}</td>`:''}${has('tags')?`<td>${esc(r.tagIds.map(t=>tags.get(t)).join('、')||'—')}</td>`:''}<td>${r.reviewStatus==='confirmed'&&r.marketValue!==null&&Number(r.marketValue)>=0&&currencies.includes(r.currency)?pill('已核对','green'):pill('待补 · 未计入','amber')}</td></tr>`).join('')||'<tr><td colspan="8">当前筛选无持仓</td></tr>'}</tbody></table></div>`;
}
function dashboard(){const data=aggregate(snapshot,filters);return `<div id="dashboard"><div class="page-title"><div class="eyebrow">我的资产 / 当前快照</div><div class="title-row"><h1>资产看板</h1><div class="actions">${button('edit','编辑持仓','secondary')}${button('settings','自定义看板','secondary')}${button('import','＋ 更新持仓','primary')}</div></div><p class="muted">每一笔资产，都有清晰的位置。${isDemo?' <strong class="demo-label">持仓为虚构示例 · 市场为公共收盘快照</strong>':''}</p></div><div class="scope-note">${pill('部分 / 未知覆盖范围')}<span>只统计你已导入的资产，不代表全部资产；不提供持仓实时净值或历史收益率；公共指数报价单独展示。</span></div><div class="filter-row"><label>账户<select id="filter-account">${options(snapshot.accounts,'id','alias',filters.accountId,'全部账户')}</select></label><label>分类<select id="filter-category">${options(snapshot.categories,'id','name',filters.categoryId,'全部分类')}</select></label><label>标签<select id="filter-tag">${options(snapshot.tags,'id','name',filters.tagId,'全部标签')}</select></label><label class="search-label">查找持仓<input id="filter-query" type="search" placeholder="资产名称" value="${attr(filters.query)}"></label></div><div class="metric-grid">${data.currencies.map(c=>`<article class="asset-metric"><div class="metric-label">已导入资产合计 <span>${c.currency}</span></div><div class="asset-number">${money(c.total)}</div><div class="asset-meta"><span>${c.rows.length} 条已计入持仓</span><span>当前筛选范围</span></div><div class="allocation-strip" aria-hidden="true">${c.categories.map((x,i)=>`<meter class="meter-${i%6}" min="0" max="100" value="${x.percent??0}"></meter>`).join('')}</div></article>`).join('')||'<article class="asset-metric"><h2>暂无可计算数据</h2><p>补齐名称、币种和金额并核对后，这里会显示分布。</p></article>'}</div><div class="quality-note">${pill(data.excluded?`${data.excluded} 条未计入`:'核对完成',data.excluded?'amber':'green')}<span>数据日期：${data.dates.length?esc(data.dates.join(' / ')):'未知'}${data.unknownDate?' · 含未知日期':''}${data.dates.length>1?' · 混合日期快照':''}。各币种独立计算。</span></div><div class="board-grid">${layout.cards.filter(c=>!layout.hidden.includes(c)).map(card=>card==='holdings'?`<section class="card wide"><div class="card-heading"><h2>持仓明细</h2><span>${data.filteredCount} 条 · 当前筛选</span></div>${holdingsTable()}</section>`:`<section class="card"><div class="card-heading"><h2>${card==='allocation'?'资产类别分布':'账户分布'}</h2><span>分母：当前币种有效金额</span></div>${data.currencies.map(c=>`<div class="currency-group"><h3>${c.currency}</h3>${distribution(card==='allocation'?c.categories:c.accounts)}${card==='allocation'&&c.largest?`<p class="concentration">最大单条 / 已确认分组：${esc(c.largest.name)} <b>${layout.mask?'•••':c.largest.percent===null?'—':c.largest.percent+'%'}</b></p>`:''}</div>`).join('')||'<p class="muted">暂无可计算数据</p>'}</section>`).join('')}</div><p class="footnote">分类是你的整理标签，不构成风险评级。占比按当前筛选范围、当前币种计算；显示舍入可能产生尾差。</p></div>`;}
function imageWorkspace(){if(!images.length)return '';return `<div class="image-workspace"><div class="image-tools"><label>截图<select id="image-select">${images.map((_,i)=>`<option value="${i}"${i===selectedImage?' selected':''}>第 ${i+1} 张</option>`).join('')}</select></label>${button('rotate','旋转 90°','secondary')}${button('remove-image','移除此图','quiet')}</div><div class="canvas-host" id="canvas-host"></div><div class="crop-tools"><span>裁剪区域（%）</span>${[['x','左',0],['y','上',0],['w','宽',100],['h','高',100]].map(([id,label,value])=>`<label>${label}<input id="crop-${id}" type="number" min="${id==='w'||id==='h'?1:0}" max="100" value="${value}"></label>`).join('')}${button('crop','应用裁剪','secondary')}</div><p class="caption">可裁去姓名和账号。裁剪只影响本次识别，原文件保持原样。</p></div>`;}
function fundSuggestionView(row,index){
 const hint=suggestFund(row),known=hint.confidence!=='unknown',sectorNames=[...(row.sectorIds||[]).map(id=>SECTOR_OPTIONS.find(s=>s.id===id)?.name||id),...(row.customSectorNames||[])],marketNames=(row.benchmarkIds||[]).map(id=>MARKET_CATALOG.find(s=>s.id===id)?.name||id);
 return `<div class="fund-suggestion">${mappingRechecks.has(row.id)?'<p class="mapping-recheck warning" role="status">名称或代码已修改，请重新核对板块和市场关联；原选择仅作待核对候选。</p>':''}<div class="card-heading"><b>本地分类建议</b>${button('suggest-fund','按当前名称 / 代码重新分析','quiet')}</div><p>${known?esc([hint.category,...hint.sectorIds.map(id=>SECTOR_OPTIONS.find(s=>s.id===id).name),...hint.benchmarkIds.map(id=>MARKET_CATALOG.find(s=>s.id===id).name)].filter(Boolean).join(' · ')):'暂无可靠候选，保持未知'}</p><p class="caption">${hint.basis.map(esc).join(' ')}</p>${known?button('apply-fund-suggestion','使用此候选，继续核对','secondary',`data-index="${index}"`):''}${sectorNames.length||marketNames.length?`<p>待核对参考：${esc([...sectorNames,...marketNames].join(' / '))}</p><label class="check-label"><input type="checkbox" data-field="sectorReady"${checked((!(row.sectorIds?.length||row.customSectorNames?.length)||row.sectorReview==='confirmed')&&(!row.benchmarkIds?.length||row.benchmarkReview==='confirmed'))}>我已核对这些板块 / 市场关联；这不代表实际底层行业比例</label>`:''}</div>`;
}
function draftRows(){const accountNames=new Map(draft.accounts.map(x=>[x.id,x.alias])),categoryNames=new Map(draft.categories.map(x=>[x.id,x.name])),tagNames=new Map(draft.tags.map(x=>[x.id,x.name]));return draft.rows.map((r,i)=>`<article class="review-row" data-row="${i}"><div class="review-row-heading"><b>持仓 ${i+1}</b><label class="check-label"><input data-field="favorite" type="checkbox"${checked(r.favorite)}>关注</label>${button('delete-row','删除','quiet',`data-index="${i}"`)}</div>${nameReview(r)}<div class="form-grid"><label>资产名称<input data-field="name" maxlength="200" value="${attr(r.name)}" placeholder="请输入或核对名称"></label><label>持仓金额<input data-field="marketValue" inputmode="decimal" value="${attr(r.marketValue??'')}" placeholder="例如 12,345.67 或 1.2万"></label><label>币种<select data-field="currency"><option value="">待确认</option>${currencies.map(c=>`<option${c===r.currency?' selected':''}>${c}</option>`).join('')}</select></label><label>账户别名<input data-field="account" maxlength="120" value="${attr(accountNames.get(r.accountId)||'默认账户')}"></label><label>资产分类<input data-field="category" maxlength="120" value="${attr(categoryNames.get(r.categoryId)||'')}" placeholder="未分类"></label><label>持仓数据日期<input type="date" data-field="asOfDate" value="${attr(r.asOfDate||'')}"></label><label>代码（选填）<input data-field="code" maxlength="80" value="${attr(r.code||'')}"></label><label>标签（逗号分隔）<input data-field="tags" maxlength="500" value="${attr(r.tagIds.map(t=>tagNames.get(t)).join(','))}"></label><label>流动性（由你核对）<select data-field="liquidity"><option value="unknown"${!r.liquidity||r.liquidity==='unknown'?' selected':''}>未知 / 未核对</option><option value="available"${r.liquidity==='available'?' selected':''}>当前可用</option><option value="locked"${r.liquidity==='locked'?' selected':''}>受限 / 有期限</option></select></label><label>预计解锁日期（受限时选填）<input data-field="unlockDate" type="date" value="${attr(r.unlockDate||'')}"></label><label>同一资产分组（确认后选填）<input data-field="assetGroupId" maxlength="100" value="${attr(r.assetGroupId||'')}" placeholder="同组填相同名称，不按同名自动合并"></label></div>${fundSuggestionView(r,i)}<details><summary>截图明确提供的收益金额（选填）</summary><div class="form-grid"><label>持有收益金额<input data-field="reportedHoldingPnl" value="${attr(r.reportedHoldingPnl??'')}" inputmode="decimal"></label><label>当日收益金额<input data-field="reportedDailyPnl" value="${attr(r.reportedDailyPnl??'')}" inputmode="decimal"></label><label>收益币种<select data-field="reportedPnlCurrency"><option value="">未知</option>${currencies.map(c=>`<option${c===r.reportedPnlCurrency?' selected':''}>${c}</option>`).join('')}</select></label><label>收益报告日期<input type="date" data-field="reportedPnlDate" value="${attr(r.reportedPnlDate||'')}"></label></div></details><label class="check-label confirmed-check"><input data-field="ready" type="checkbox"${checked(r.reviewStatus==='confirmed')}>我已核对本行，所填金额、币种、名称与日期状态准确</label><p class="caption">缺失项保持空白；日期未知可留空。负资产暂不计入统计。</p></article>`).join('');}
function importPanel(){return `<div class="panel-heading"><div><span class="eyebrow">导入 → 核对 → 看板</span><h1>${panel==='review'?'核对持仓':'导入你的持仓'}</h1></div>${button('close-panel','返回看板','secondary')}</div><p class="lead-small">截图只在当前浏览器处理。先核对，再生成你的看板。</p><div class="upload-box"><span class="upload-symbol">↥</span><h2>选择持仓截图</h2><p>PNG / JPEG / WebP · 最多 10 张 · 单张 10 MiB</p><label class="file-button primary">选择截图<input id="image-input" type="file" accept="image/png,image/jpeg,image/webp" multiple></label>${button('manual','手动添加持仓','secondary')}</div>${imageWorkspace()}<div class="recognition-actions">${button('recognize',busy?'识别中…':'开始本地识别','primary',busy||!images.length?'disabled':'')}${busy?button('cancel-ocr','取消识别','secondary'):''}<span role="status">${esc(progress)}</span></div>${rawText?`<details class="raw-text"><summary>查看识别原文 / 手动整理文字</summary><textarea id="raw-text" rows="8">${esc(rawText)}</textarea>${button('parse-text','从文字重新提取候选','secondary')}<p class="caption">识别原文仅在本次页面会话保留。</p></details>`:''}${!rawText?`<details id="text-recovery" class="raw-text"><summary>粘贴已有识别文字，重新整理持仓</summary><p class="caption">仅在当前浏览器配对字段，不联网、不保存识别原文。</p><textarea id="paste-text" rows="6" maxlength="200000" placeholder="粘贴本机已有的识别原文"></textarea>${button('parse-paste','从粘贴文字整理候选','secondary')}</details>`:''}${draft?`<div class="review-heading"><h2>核对结果 <span>${draft.rows.length} 条候选</span></h2>${button('add-row','＋ 添加一条','secondary')}</div><p class="scope-note">识别结果可能遗漏或错位。请对照截图核对；只有勾选确认且字段完整的行才会计入合计。未明确识别的币种、日期、账户和流动性需自行补充，不按平台或颜色推断。</p><div id="draft-rows">${draftRows()}</div><div class="review-footer"><label class="check-label"><input id="keep-pending" type="checkbox">将未核对 / 不完整的行作为待补行保留（不计入统计）</label>${button('preview','预览整组替换','primary')}</div>`:''}`;}
function settingsPanel(){const names={allocation:'资产类别分布',accounts:'账户分布',holdings:'持仓明细'};return `<div class="dialog-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="settings-title" class="dialog"><div class="card-heading"><h2 id="settings-title">自定义看板</h2>${button('close-settings','完成设置','primary')}</div><p class="muted">打造适合自己的工作空间。设置只保留在当前设备。</p><div class="settings-options"><label class="check-label"><input id="setting-mask" type="checkbox"${checked(layout.mask)}>隐藏金额</label><label>主题<select id="setting-theme"><option value="light"${layout.theme==='light'?' selected':''}>清浅</option><option value="dark"${layout.theme==='dark'?' selected':''}>夜间</option></select></label><label>间距<select id="setting-density"><option value="comfortable"${layout.density==='comfortable'?' selected':''}>舒适</option><option value="compact"${layout.density==='compact'?' selected':''}>紧凑</option></select></label></div><h3>卡片顺序与显隐</h3>${layout.cards.map((c,i)=>`<div class="setting-row"><label class="check-label"><input type="checkbox" data-card="${c}"${checked(!layout.hidden.includes(c))}>${names[c]}</label><div>${button('card-up','↑','secondary',`data-card="${c}" aria-label="上移${names[c]}" ${i===0?'disabled':''}`)}${button('card-down','↓','secondary',`data-card="${c}" aria-label="下移${names[c]}" ${i===layout.cards.length-1?'disabled':''}`)}</div></div>`).join('')}<h3>明细显示字段</h3><div class="columns-options">${[['account','账户'],['category','分类'],['date','日期'],['pnl','截图收益金额'],['tags','标签']].map(([c,n])=>`<label class="check-label"><input type="checkbox" data-column="${c}"${checked(layout.columns.includes(c))}>${n}</label>`).join('')}</div><div class="dialog-actions">${button('reset-layout','恢复默认','secondary')}${button('export-layout','导出纯布局','secondary')}</div><p class="caption">纯布局文件不含账户、资产名称、金额、分类名与标签。</p></section></div>`;}
function dataPanel(){return `<div class="panel-heading"><div><span class="eyebrow">随时带走你的数据</span><h1>数据与备份</h1></div>${button('close-panel','返回看板','secondary')}</div><section class="card"><h2>当前保存方式</h2><p>${persistence.enabled?'已启用：用户确认后的持仓、目标、上次快照与布局保存在此浏览器。':'仅本次会话：刷新或关闭后，当前内容可能丢失。'}</p><p class="muted">原始截图与 OCR 全文不保存。本机存储和导出文件未加密；金额遮罩不等于加密。</p><div class="actions">${button('toggle-save',persistence.enabled?'关闭保存并清除已存数据':'在此浏览器保存','primary')}${button('export-data','导出完整备份','secondary',snapshot||planning.plan.rules.length||planning.plan.purpose||Object.values(planning.plan.riskProfile||{}).some(v=>v!==null)?'':'disabled')}</div></section><section class="card"><h2>恢复数据或布局</h2><p class="muted">只接受本应用 JSON 文件，最大 5 MiB。恢复前会预览，确认后整组替换。</p><label class="file-button secondary">选择备份 / 布局文件<input id="restore-input" type="file" accept="application/json,.json"></label></section><section class="card danger-zone"><h2>清除本应用数据</h2><p class="muted">清除本机保存、当前持仓、截图会话和布局。不会删除你原始的截图或已下载的备份文件。</p>${button('request-clear','清除所有应用数据','danger')}</section>`;}
function helpPanel(){return `<div class="panel-heading"><h1>使用与隐私</h1>${button('close-panel','返回看板','secondary')}</div><section class="card prose"><h2>你的截图，不需要上传</h2><p>截图在浏览器内识别，处理时只下载本站固定的识别程序和模型文件，不向服务器发送截图、文件名、识别文字或持仓。首次识别需要加载本地运行的模型，可能耗时。</p><h2>先核对，再使用</h2><p>当前支持通用表格与带“产品名称 / 持仓金额 / 币种”标签的卡片候选提取。尚未认证任何券商或银行版式。模糊、截断、复杂多列截图可能遗漏或错位，均需人工确认；不能识别时可以手动补录。</p><h2>数字是怎样计算的</h2><p>仅合计当前筛选范围内已确认、名称和币种完整的非负持仓金额。按币种独立统计，不提供自动汇率和历史收益率。未知日期和混合日期都会提示。负资产和待补行不计入；分类只是你的整理标签。</p><h2>本机保存与清除</h2><p>默认仅本次会话使用。主动开启保存后，确认过的快照和布局保存在浏览器数据库；原图与 OCR 原文不会保存。共享设备请谨慎开启，浏览器清理可能删除数据，重要资料请导出。</p><h2>体检依据来自哪里</h2><p>在“目标与体检”填写自己的标准，在持仓编辑中核对流动性和同一资产分组。体检固定使用全部导入资产，不随图表筛选改变。没有设置的项目不会被猜测；没有真实解锁信息时不把受限资产算作当前可用。新旧快照变化可能来自导入范围变化，不等于收益。</p><h2>边界</h2><p>本机存储未加密，不能防止恶意浏览器扩展或已被控制的设备读取。静态托管方可能记录普通访问 IP、时间和资源路径。应用不提供云端同步、交易或投资建议。</p><p>反馈问题前请脱敏，不要提交真实截图、账户信息或备份文件。应用源码采用 MIT；第三方组件和行情另有条件，公开运营仍需另行准备。</p></section>`;}
function previewDialog(){if(!preview)return '';const old=snapshot?aggregate(snapshot):null,next=aggregate(preview);return `<div class="dialog-backdrop"><section role="dialog" aria-modal="true" aria-labelledby="preview-title" class="dialog"><h2 id="preview-title">确认整组替换</h2><p>原快照 ${snapshot?.holdings.length??0} 条 → 新快照 ${preview.holdings.length} 条。此操作不保存历史版本。</p><div class="preview-compare"><div><h3>原已计入金额</h3>${old?.currencies.map(c=>`<p>${money(c.total,c.currency)}</p>`).join('')||'无'}</div><div><h3>新已计入金额</h3>${next.currencies.map(c=>`<p>${money(c.total,c.currency)}</p>`).join('')||'无'}<p>${next.excluded} 条未计入</p></div></div>${duplicateNotice(preview)}<p class="caption">可能重复的行不会自动合并。请返回核对，删除重复或确认它们是不同账户的持仓。</p><div class="dialog-actions">${button('cancel-preview','返回核对','secondary')}${button('apply','确认替换并生成看板','primary')}</div></section></div>`;}
function duplicateNotice(s){const groups=new Map();s.holdings.forEach(r=>{const k=[r.name,r.currency,r.marketValue].join('|');groups.set(k,(groups.get(k)||0)+1);});return [...groups.values()].some(n=>n>1)?'<p class="warning">发现名称、币种和金额相同的候选，可能存在截图重叠。请核对后决定是否保留。</p>':'';}
function currentLiveView(){if(publicStatic)return '<section id="live-market-quotes" class="card" data-public-static><h3>公开试用版 · 盘中行情暂未接入</h3><p>你仍可整理持仓、核对配置并使用个人目标体检。当前没有获准公开分发的行情数据，不提供实时涨跌判断。</p></section>';return renderLiveQuotes(liveBundle,liveStatus,liveEnabled);}
function updateLiveView(){const section=document.querySelector('#live-market-quotes');if(section)section.outerHTML=currentLiveView();}
async function loadLiveQuotes(manual=false){
 if(publicStatic)return;
 if((!liveEnabled&&!manual)||liveStatus==='loading'||document.hidden)return;
 const generation=++liveGeneration;liveStatus='loading';updateLiveView();
 const controller=new AbortController();liveController=controller;const timer=setTimeout(()=>controller.abort(),13000);
 try{const response=await fetch('/api/market-quotes',{cache:'no-store',signal:controller.signal});if(!response.ok||Number(response.headers.get('content-length')||0)>500000)throw Error();const text=await response.text();if(new TextEncoder().encode(text).length>500000)throw Error();const bundle=JSON.parse(text);if(!validateLiveQuotes(bundle))throw Error();if(generation!==liveGeneration)return;liveBundle=bundle;liveStatus='ready';}
 catch{if(generation===liveGeneration)liveStatus='error';}
 finally{clearTimeout(timer);if(generation===liveGeneration){liveController=null;updateLiveView();}}
}
function currentMarketView(){return renderRelatedMarkets(snapshot||makeSnapshot([]),planning.marketPreferences||defaultMarketPreferences(),marketBundle,marketRanges,marketStatus).replace('<div class="market-card-grid">',currentLiveView()+'<div class="market-card-grid">');}
function currentSectorView(){return renderSectorObservation(snapshot||makeSnapshot([]),planning,layout,sectorBundle,marketBundle,sectorStatus,marketStatus);}
function updateSectorView(){const section=document.querySelector('#sector-observation');if(section)section.outerHTML=currentSectorView();}
async function loadSectorData(){
 const generation=++sectorGeneration;sectorStatus='loading';updateSectorView();const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{const response=await fetch('/sector-data.json',{cache:'no-store',signal:controller.signal});if(!response.ok||Number(response.headers.get('content-length')||0)>1000000)throw Error();const text=await response.text();if(new TextEncoder().encode(text).length>1000000)throw Error();const bundle=validateSectorBundle(JSON.parse(text));if(generation!==sectorGeneration)return;sectorBundle=bundle;sectorStatus='ready';}
 catch{if(generation===sectorGeneration)sectorStatus='error';}
 finally{clearTimeout(timer);if(generation===sectorGeneration)updateSectorView();}
}
function renderDashboard(){return dashboard().replace('<div class="scope-note">',currentMarketView()+'<div class="scope-note">').replace('<div class="board-grid">',renderCheckup(snapshot,planning,layout)+currentSectorView()+'<div class="board-grid">');}
async function loadMarketData(){
 const generation=++marketGeneration;marketStatus='loading';updateSectorView();
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
 try{const response=await fetch('/market-data.json',{cache:'no-store',signal:controller.signal});if(!response.ok||Number(response.headers.get('content-length')||0)>2*1024*1024)throw Error();const text=await response.text();if(text.length>2*1024*1024)throw Error();const bundle=validateMarketBundle(JSON.parse(text));if(generation!==marketGeneration)return;marketBundle=bundle;marketStatus='ready';}
 catch{if(generation!==marketGeneration)return;marketStatus='error';}
 finally{clearTimeout(timer);if(generation===marketGeneration){const section=document.querySelector('#related-markets');if(section)section.outerHTML=currentMarketView();updateSectorView();}}
}
function render(){
 const view=panel==='settings'?(snapshot?'dashboard':'home'):panel||(snapshot?'dashboard':'home');
 const settings=panel==='settings';document.documentElement.dataset.theme=layout.theme;document.documentElement.dataset.density=layout.density;
 app.innerHTML=`${header()}<main><header class="topbar"><span>个人资产工作空间</span><div>${pill(persistence.enabled?'已在此浏览器保存':'仅本次会话','green')}${button('data','备份与保存','quiet')}</div></header>${message?`<div class="notification" role="status">${esc(message)}${button('dismiss','×','quiet','aria-label="关闭提示"')}</div>`:''}<div class="content">${panel==='import'||panel==='review'?importPanel():panel==='markets'?renderMarketManager(marketDraft):panel==='sectors'?renderSectorManager(sectorDraft):panel==='plan'?renderGoalEditor(planning.plan,snapshot):panel==='data'?dataPanel():panel==='help'?helpPanel():snapshot?renderDashboard():empty()}</div><footer>见仓 · 本地持仓看板 <span>数据不上传 · 记录与整理，不提供买卖建议</span></footer></main>${settings?settingsPanel():''}${previewDialog()}${panel==='clear'?`<div class="dialog-backdrop"><section role="dialog" aria-modal="true" aria-label="确认清除" class="dialog"><h2>清除当前设备上的应用数据？</h2><p>持仓和布局会移除。如需保留，请先导出备份。</p><div class="dialog-actions">${button('data','取消','secondary')}${button('clear','确认清除','danger')}</div></section></div>`:''}`;
 if(images.length&&document.querySelector('#canvas-host')){const c=images[selectedImage].canvas.cloneNode();c.getContext('2d').drawImage(images[selectedImage].canvas,0,0);c.setAttribute('aria-label','当前截图预览');document.querySelector('#canvas-host').append(c);}
 for(const host of document.querySelectorAll('[data-name-evidence]')){const source=nameEvidence.get(host.dataset.nameEvidence)?.canvas;if(source){const c=source.cloneNode();c.getContext('2d').drawImage(source,0,0);c.setAttribute('role','img');c.setAttribute('aria-label','识别时的名称原图片段，请与下方输入逐字核对');host.append(c);}}
 const dialog=document.querySelector('[role=dialog]');if(dialog)dialog.querySelector('button,input,select')?.focus();
 if(view!==lastView){window.scrollTo(0,0);lastView=view;}
 if(snapshot&&(!panel||panel==='settings')&&liveStatus==='idle'&&liveEnabled&&!document.hidden)void loadLiveQuotes();
}
function readDraft(){
 if(!draft)return;
 const accounts=[],categories=[],tags=[],map={account:new Map(),category:new Map(),tag:new Map()};
 const ref=(type,text)=>{if(!text)return null;const old=map[type].get(text);if(old)return old;const id=uid();map[type].set(text,id);(type==='account'?accounts:type==='category'?categories:tags).push({id,[type==='account'?'alias':'name']:text});return id;};
 draft.rows=[...document.querySelectorAll('[data-row]')].map((el,i)=>{
  const get=key=>el.querySelector(`[data-field="${key}"]`),val=key=>get(key)?.value.trim()||'';
  for(const key of ['marketValue','reportedHoldingPnl','reportedDailyPnl'])if(val(key)&&parseAmount(val(key))===null)throw Error('金额格式错误');
  const row={...draft.rows[i]};row.name=val('name');row.marketValue=parseAmount(val('marketValue'));row.currency=val('currency')||null;row.asOfDate=val('asOfDate')||null;row.code=val('code')||null;
  row.accountId=ref('account',val('account')||'默认账户');row.categoryId=ref('category',val('category'));row.tagIds=[...new Set(val('tags').split(/[,，]/).map(x=>x.trim()).filter(Boolean))].map(t=>ref('tag',t));
  row.liquidity=val('liquidity')||'unknown';row.unlockDate=row.liquidity==='locked'?(val('unlockDate')||null):null;row.assetGroupId=val('assetGroupId')||null;
  row.favorite=get('favorite').checked;row.reviewStatus=get('ready').checked&&row.name&&row.marketValue!==null&&row.currency?'confirmed':'needs_attention';
  if(get('sectorReady')){if(row.sectorIds?.length||row.customSectorNames?.length)row.sectorReview=get('sectorReady').checked?'confirmed':'unreviewed';if(row.benchmarkIds?.length)row.benchmarkReview=get('sectorReady').checked?'confirmed':'unreviewed';}
  row.reportedHoldingPnl=parseAmount(val('reportedHoldingPnl'));row.reportedDailyPnl=parseAmount(val('reportedDailyPnl'));row.reportedPnlCurrency=val('reportedPnlCurrency')||null;row.reportedPnlDate=val('reportedPnlDate')||null;
  return row;
 });draft.accounts=accounts;draft.categories=categories;draft.tags=tags;
}
async function commitLayout(next){const clean=exportLayout(next).layout;if(persistence.enabled)await persistence.update(exportFull(snapshot||makeSnapshot([]),clean,planning));layout=clean;}
async function applySnapshot(next,nextLayout=layout,mode=draftMode,overridePlanning=null){
 const nextPlanning=overridePlanning||restorePlanning||(mode==='demo'?{plan:demoPlan(),previousSnapshot:null,dataKind:'demo',planSource:'demo'}:advancePlanning(planning,snapshot,mode));
 const clean=exportFull(next,nextLayout,nextPlanning);let storageFailed=false;try{await persistence.update(clean);}catch{if(!confirm('本机保存失败。是否仅在本次会话应用？原来已保存的数据仍然保留。'))return {applied:false};storageFailed=true;persistence.suspend();message='当前会话未保存，请导出备份。原保存内容仍保留，刷新会恢复旧版。';}
 snapshot=clean.snapshot;layout=clean.layout;planning=clean.planning;marketDraft=null;sectorDraft=null;restorePlanning=null;preview=null;restoreLayout=null;draft=null;panel='';dirty=false;isDemo=planning.dataKind==='demo';filters={accountId:'',categoryId:'',tagId:'',query:''};disposeImages();render();
 return {applied:true,persisted:persistence.enabled,storageFailed};
}
function download(obj,name){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function closeImport(){importGeneration++;cancelRecognition();busy=false;imageLoading=false;marketDraft=null;sectorDraft=null;progress='';draft=null;preview=null;restorePlanning=null;restoreLayout=null;dirty=false;disposeImages();panel='';render();}
app.addEventListener('input',event=>{if(event.target.closest('[data-row],#goal-form,#market-manager,#sector-manager'))dirty=true;});
app.addEventListener('change',async event=>{
 const t=event.target;
 try{
  if(t.id==='sector-select'){const nextIndex=Number(t.value);try{sectorDraft=readSectorManager(document.querySelector('#sector-manager'),sectorDraft);}catch{t.value=String(sectorDraft.index);toast('请核对当前板块选择后再切换持仓。');return;}sectorDraft.index=nextIndex;sectorDraft.query='';render();return;}
  if(t.id==='mapping-select'){const nextIndex=Number(t.value);try{marketDraft=readMarketManager(document.querySelector('#market-manager'),marketDraft);}catch{t.value=String(marketDraft.index);toast('请先把当前持仓的参考项调整为最多3个，再切换持仓。');return;}marketDraft.index=nextIndex;render();return;}
  if(t.id.startsWith('filter-')){filters[{ 'filter-account':'accountId','filter-category':'categoryId','filter-tag':'tagId','filter-query':'query'}[t.id]]=t.value;render();return;}
  if(t.id==='image-input'){
   if(busy||imageLoading)return;const files=[...t.files];validateBatch(files);if(images.length+files.length>10)throw Error('每批最多 10 张，请移除部分截图。');
   readDraft();const token=importGeneration,decoded=[];imageLoading=true;t.disabled=true;
   try{
    for(const file of files)decoded.push({canvas:await decodeImage(file),size:file.size});
    if(token!==importGeneration){decoded.forEach(x=>x.canvas.width=1);return;}
    if(images.length+decoded.length>10||[...images,...decoded].reduce((s,x)=>s+x.size,0)>50*1024*1024)throw Error('截图数量或总大小超过限制。');
    readDraft();images.push(...decoded);dirty=true;progress=`已选择 ${images.length} 张截图，请检查裁剪区域。`;render();
   }catch(e){decoded.forEach(x=>{x.canvas.width=1;});throw e;}finally{if(token===importGeneration)imageLoading=false;t.disabled=false;}
  }
  if(t.id==='image-select'){readDraft();selectedImage=Number(t.value);render();}
  if(t.id==='restore-input'){
   const file=t.files[0];if(!file)return;if(file.size>5*1024*1024)throw Error('备份文件不能超过 5 MiB。');const result=validateExport(await file.text());
   if(result.formatId==='local-portfolio-layout'){if(confirm('用文件中的布局替换当前布局？不影响持仓。')){await commitLayout(result.layout);render();}}
   else{preview=result.snapshot;restoreLayout=result.layout;restorePlanning=result.planning||defaultPlanning();render();}
  }
  if(t.closest('.dialog')&&panel==='settings'){
   const next=structuredClone(layout);
   if(t.id==='setting-mask')next.mask=t.checked;
   if(t.id==='setting-theme')next.theme=t.value;
   if(t.id==='setting-density')next.density=t.value;
   if(t.dataset.card)next.hidden=t.checked?next.hidden.filter(c=>c!==t.dataset.card):[...new Set([...next.hidden,t.dataset.card])];
   if(t.dataset.column)next.columns=t.checked?[...new Set([...next.columns,t.dataset.column])]:next.columns.filter(c=>c!==t.dataset.column);
   try{await commitLayout(next);render();}catch{render();toast('设置未保存，已保留原布局。请导出数据后检查本机存储。');}
  }
 }catch{toast('操作未完成：请核对文件、输入内容或本机存储状态，原快照未被替换。');}
});
app.addEventListener('input',event=>{
 const el=event.target.closest('[data-row]'),key=event.target.dataset.field;if(!el||!key)return;
 const row=draft?.rows[Number(el.dataset.row)];
 if(key==='sectorReady'){if(event.target.checked){mappingRechecks.delete(row?.id);el.querySelector('.mapping-recheck')?.remove();}return;}
 if(key==='ready'){if(event.target.checked)el.querySelector('.confirmed-check')?.removeAttribute('data-recheck');return;}
 if(key==='favorite')return;
 const ready=el.querySelector('[data-field="ready"]');if(ready?.checked){ready.checked=false;el.querySelector('.confirmed-check')?.setAttribute('data-recheck','true');}
 if(row&&['name','code'].includes(key)&&(row.sectorReview!==undefined||row.benchmarkReview!==undefined||row.sectorIds?.length||row.benchmarkIds?.length||row.customSectorNames?.length)){
  // Product identity changes invalidate even previously confirmed "no reference" choices.
  if(row.sectorReview!==undefined)row.sectorReview='unreviewed';
  if(row.benchmarkReview!==undefined)row.benchmarkReview='unreviewed';
  const mapping=el.querySelector('[data-field="sectorReady"]');if(mapping)mapping.checked=false;
  mappingRechecks.add(row.id);
  const host=el.querySelector('.fund-suggestion');if(host&&!host.querySelector('.mapping-recheck')){const note=document.createElement('p');note.className='mapping-recheck warning';note.setAttribute('role','status');note.textContent='名称或代码已修改，请重新核对板块和市场关联；原选择仅作待核对候选。';host.prepend(note);}
 }
 dirty=true;
});
app.addEventListener('click',async event=>{
 const target=event.target.closest('[data-action]');if(!target)return;const action=target.dataset.action;
 try{
  if(action==='refresh-quotes'){await loadLiveQuotes(true);return;}
  if(action==='toggle-quotes'){liveEnabled=!liveEnabled;if(!liveEnabled){liveGeneration++;liveController?.abort();liveController=null;liveStatus=liveStatus==='error'?'error':liveBundle?'ready':'idle';updateLiveView();}else await loadLiveQuotes();return;}
  if(action==='filter-sectors'){const query=document.querySelector('#sector-search').value.trim();try{sectorDraft=readSectorManager(document.querySelector('#sector-manager'),sectorDraft);}catch{toast('筛选前请核对选择：合计最多3项，自定义名称不可重复或使用已有内置名称。');return;}sectorDraft.query=query;render();return;}
  if(action==='use-sector-suggestions'){try{sectorDraft=readSectorManager(document.querySelector('#sector-manager'),sectorDraft);}catch{toast('请先核对当前分类名称与选择数量。');return;}const row=sectorDraft.snapshot.holdings[sectorDraft.index],hint=suggestFund(row);if(!hint.sectorIds.length)return;if(hint.sectorIds.length+(row.customSectorNames?.length||0)>3){toast('推荐板块与自定义分类合计不能超过3项。');return;}row.sectorIds=hint.sectorIds;row.sectorReview='unreviewed';dirty=true;render();return;}
  if(action==='sectors'){if(dirty&&!confirm('离开会丢弃未应用的草稿，继续吗？'))return;closeImport();sectorDraft=createSectorDraft(snapshot||makeSnapshot([]));panel='sectors';render();return;}
  if(action==='cancel-sectors'){if(dirty&&!confirm('放弃未保存的板块关联修改？'))return;sectorDraft=null;dirty=false;panel='';render();return;}
  if(action==='save-sectors'){try{sectorDraft=readSectorManager(document.querySelector('#sector-manager'),sectorDraft);}catch{toast('板块关联未保存：合计最多3项，自定义名称最多40字、不可重复或使用内置名称。');return;}const result=confirmSectorSelections(sectorDraft.snapshot);const applied=await applySnapshot(result.snapshot,layout,'edit',planning);if(applied?.applied&&!applied.storageFailed)toast(`已确认并${applied.persisted?'保存于此浏览器':'应用（仅本次会话）'}${result.selectedCount}只持仓的板块；${result.unmappedCount}只仍待设置。持仓金额和币种的核对状态未改变。`);return;}
  if(action==='reload-sectors'){await loadSectorData();return;}
  if(action==='market-range'){marketRanges[target.dataset.id]=target.dataset.range;const section=document.querySelector('#related-markets');if(section)section.outerHTML=currentMarketView();return;}
  if(action==='reload-market'){await loadMarketData();return;}
  if(action==='markets'){if(dirty&&!confirm('离开会丢弃未应用的草稿，继续吗？'))return;closeImport();marketDraft=createMarketDraft(snapshot||makeSnapshot([]),planning.marketPreferences||defaultMarketPreferences());panel='markets';render();return;}
  if(action==='cancel-markets'){if(dirty&&!confirm('放弃未保存的市场关联修改？'))return;marketDraft=null;dirty=false;panel='';render();return;}
  if(action==='save-markets'){try{marketDraft=readMarketManager(document.querySelector('#market-manager'),marketDraft);}catch{toast('市场关联未保存：每项最多3个参考，请核对选择。');return;}await applySnapshot(marketDraft.snapshot,layout,'edit',{...planning,marketPreferences:marketDraft.prefs});return;}
  if(action==='market-up'||action==='market-down'){marketDraft=readMarketManager(document.querySelector('#market-manager'),marketDraft);const order=[...marketDraft.prefs.order,...MARKET_CATALOG.map(m=>m.id).filter(id=>!marketDraft.prefs.order.includes(id))],i=order.indexOf(target.dataset.id),j=i+(action==='market-up'?-1:1);if(j<0||j>=order.length)return;[order[i],order[j]]=[order[j],order[i]];marketDraft.prefs.order=order;dirty=true;render();return;}
  if(action==='dismiss'){message='';document.querySelector('.notification')?.remove();return;}
  if(action==='home'||action==='close-panel'){if(dirty&&!confirm('离开将丢弃尚未应用的核对草稿，继续吗？'))return;closeImport();return;}
  if(['data','help'].includes(action)){if(dirty&&!confirm('离开将丢弃未应用的草稿，继续吗？'))return;closeImport();panel=action;render();return;}
  if(action==='import'){if(dirty&&!confirm('开始新导入会丢弃当前草稿，继续吗？'))return;closeImport();draftMode='import';panel='import';render();return;}
  if(action==='demo'){await applySnapshot(makeDemo(),layout,'demo');return;}
  if(action==='edit'){draftMode='edit';disposeImages();draft=draftFrom(snapshot);panel='review';dirty=true;render();return;}
  if(action==='suggest-fund'){readDraft();render();return;}
  if(action==='apply-fund-suggestion'){readDraft();const row=draft.rows[Number(target.dataset.index)],hint=suggestFund(row);if(hint.confidence==='unknown'){toast('没有可靠分类候选，请核对基金名称和代码。');return;}if(row.sectorReview!=='confirmed'&&hint.sectorIds.length+(row.customSectorNames?.length||0)>3){toast('候选与自定义分类合计最多3项，请先在管理板块关联中调整自定义分类。');return;}if(!row.categoryId&&hint.category){let category=draft.categories.find(c=>c.name===hint.category);if(!category){category={id:uid(),name:hint.category};draft.categories.push(category);}row.categoryId=category.id;}if(row.sectorReview!=='confirmed'&&hint.sectorIds.length){row.sectorIds=hint.sectorIds;row.sectorReview='unreviewed';}if(row.benchmarkReview!=='confirmed'&&hint.benchmarkIds.length){row.benchmarkIds=hint.benchmarkIds;row.benchmarkReview='unreviewed';}row.reviewStatus='needs_attention';dirty=true;render();return;}
  if(action==='manual'||action==='add-row'){readDraft();if(!draft)draft=blankDraft();else draft.rows.push(newHolding());dirty=true;panel='review';render();return;}
  if(action==='delete-row'){readDraft();const row=draft.rows[Number(target.dataset.index)],e=nameEvidence.get(row.id);if(e?.canvas)e.canvas.width=1;nameEvidence.delete(row.id);draft.rows.splice(Number(target.dataset.index),1);dirty=true;render();return;}
  if(action==='rotate'){if(busy)return;readDraft();const src=images[selectedImage].canvas,c=document.createElement('canvas');c.width=src.height;c.height=src.width;const ctx=c.getContext('2d');ctx.translate(c.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(src,0,0);src.width=1;images[selectedImage].canvas=c;render();return;}
  if(action==='crop'){if(busy)return;const [x,y,w,h]=['x','y','w','h'].map(id=>Number(document.querySelector('#crop-'+id).value));if(![x,y,w,h].every(Number.isFinite)||x<0||y<0||w<=0||h<=0||x+w>100||y+h>100)throw Error();readDraft();const src=images[selectedImage].canvas,c=document.createElement('canvas');c.width=Math.max(1,Math.round(src.width*w/100));c.height=Math.max(1,Math.round(src.height*h/100));c.getContext('2d').drawImage(src,src.width*x/100,src.height*y/100,src.width*w/100,src.height*h/100,0,0,c.width,c.height);src.width=1;images[selectedImage].canvas=c;render();return;}
  if(action==='remove-image'){if(busy)return;readDraft();images[selectedImage].canvas.width=1;images.splice(selectedImage,1);selectedImage=0;render();return;}
  if(action==='recognize'){
   if(imageLoading){toast('图片正在准备，请稍候再开始识别。');return;}
   if(busy||!images.length)return;readDraft();if(draft?.rows.length&&!confirm('重新识别会替换本次草稿，继续吗？'))return;
   clearNameEvidence();busy=true;progress='准备本地识别模型…';render();const rows=[],texts=[],token=++importGeneration;
   try{for(let i=0;i<images.length;i++){const result=await startRecognition(images[i].canvas,m=>{if(token!==importGeneration)return;progress=`第 ${i+1}/${images.length} 张 · ${m.status==='recognizing text'?'识别文字':'准备本地模型'} ${Math.round((m.progress||0)*100)}%`;const el=document.querySelector('.recognition-actions [role=status]');if(el)el.textContent=progress;});if(token!==importGeneration)return;rows.push(...result.rows.map((r,index)=>{const row=newHolding(r),box=result.nameRegions?.[index];let crop=null;if(box){crop=document.createElement('canvas');crop.width=box.width;crop.height=box.height;crop.getContext('2d').drawImage(images[i].canvas,box.x,box.y,box.width,box.height,0,0,box.width,box.height);}nameEvidence.set(row.id,{name:r.name,canvas:crop,imageNumber:i+1});return row;}));texts.push(result.text);}
    draft={rows,accounts:[],categories:[],tags:[]};rawText=texts.join('\n\n');dirty=true;progress=rows.length?`提取 ${rows.length} 条待核对候选；请对照原图，缺失字段保持待补。`:'没有可靠匹配到持仓，未生成候选。请调整裁剪或使用识别原文整理，不能将标签和占比作为持仓。';panel='review';
   }catch{if(token===importGeneration)progress='识别已取消或未完成，可重试或手动添加持仓。';}
   finally{if(token===importGeneration){busy=false;render();}}return;
  }
  if(action==='cancel-ocr'){importGeneration++;cancelRecognition();busy=false;progress='已取消识别，当前看板未改变。';render();return;}
  if(action==='parse-text'||action==='parse-paste'){
   const text=document.querySelector(action==='parse-paste'?'#paste-text':'#raw-text').value;
   if(!text.trim()||text.length>200000){toast('没有可靠识别内容，或文字过长。当前草稿保持不变。');return;}
   const rows=parseCandidates(text).map(r=>newHolding(r));if(!rows.length){toast('没有可靠匹配到持仓，当前草稿保持不变；占比、收益和界面标签不会作为资产名称。');return;}
   if(draft?.rows.length&&!confirm('重新整理会替换当前核对草稿，继续吗？'))return;
   clearNameEvidence();for(const row of rows)nameEvidence.set(row.id,{name:row.name,canvas:null});rawText=text;draft={rows,accounts:[],categories:[],tags:[]};dirty=true;panel='review';progress=`按名称与金额配对 ${rows.length} 条待核对候选；未从截图读取的字段需补充。`;render();return;
  }
  if(action==='preview'){readDraft();if(!draft.rows.length)throw Error();if(draft.rows.some(r=>r.reviewStatus==='needs_attention')&&!document.querySelector('#keep-pending').checked){toast('存在待核对或不完整的行。请补齐并勾选核对，或明确选择保留为待补行。');return;}preview=exportFull(makeSnapshot(draft.rows,draft),layout).snapshot;render();return;}
  if(action==='cancel-preview'){preview=null;restoreLayout=null;restorePlanning=null;render();return;}
  if(action==='apply'){await applySnapshot(preview,restoreLayout||layout);return;}
  if(action==='settings'){panel='settings';render();return;}
  if(action==='plan'){if(dirty&&!confirm('离开会丢弃未应用的草稿，继续吗？'))return;closeImport();panel='plan';render();return;}
  if(action==='cancel-plan'){if(dirty&&!confirm('放弃尚未保存的目标修改？'))return;dirty=false;panel='';render();return;}
  if(action==='keep-allocation'){const rule=target.closest('[data-goal-currency]');rule.querySelector('[data-goal="allocations"]').value='';rule.querySelector('[data-allocation-note]').textContent='已选择保持当前配比，不检查配置偏离。其他标准保留；点击保存后生效。';document.querySelector('#goal-save-error')?.remove();dirty=true;return;}
  if(action==='save-plan'){
   let nextPlan;try{nextPlan=readGoalForm(document.querySelector('#goal-form'));}catch(error){showGoalError(document.querySelector('#goal-form'),error);return;}
   const next={...planning,plan:nextPlan,planSource:'user'};try{await persistence.update(exportFull(snapshot||makeSnapshot([]),layout,next));}catch{showGoalError(document.querySelector('#goal-form'),new Error('本机写入失败，原目标保持不变。请导出备份后重试。'));return;}
   planning=next;dirty=false;panel='';if(!snapshot)message='个人目标已保存，导入持仓后自动体检；也可先导出备份。';render();return;
  }
  if(action==='close-settings'){panel='';render();return;}
  if(action==='reset-layout'){await commitLayout(defaultLayout());render();return;}
  if(action==='card-up'||action==='card-down'){const next=structuredClone(layout),i=next.cards.indexOf(target.dataset.card),j=i+(action==='card-up'?-1:1);if(j<0||j>=next.cards.length)return;[next.cards[i],next.cards[j]]=[next.cards[j],next.cards[i]];await commitLayout(next);render();return;}
  if(action==='export-layout'){download(exportLayout(layout),'见仓-纯布局.json');return;}
  if(action==='export-data'){download(exportFull(snapshot||makeSnapshot([]),layout,planning),'见仓-持仓备份-未加密.json');return;}
  if(action==='toggle-save'){if(persistence.enabled){if(!confirm('关闭保存并删除已经保存的数据？当前页面仍可继续使用。'))return;await persistence.disable();}else{await persistence.enable(exportFull(snapshot||makeSnapshot([]),layout,planning));}render();return;}
  if(action==='request-clear'){panel='clear';render();return;}
  if(action==='clear'){importGeneration++;cancelRecognition();busy=false;imageLoading=false;await persistence.disable();snapshot=null;sectorDraft=null;marketDraft=null;planning=defaultPlanning();restorePlanning=null;layout=defaultLayout();draft=null;preview=null;disposeImages();panel='';dirty=false;isDemo=false;message='已清除本应用数据。原始文件和已导出备份仍由你保管。';render();return;}
 }catch{toast('操作未完成，请检查输入是否符合格式和范围；已有快照未被替换。');}
});
document.addEventListener('keydown',e=>{const dialog=document.querySelector('[role=dialog]');if(!dialog||e.key!=='Tab')return;const els=[...dialog.querySelectorAll('button:not(:disabled),input,select,a[href]')];const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
window.addEventListener('pagehide',()=>{cancelRecognition();liveController?.abort();});
setInterval(()=>{if(!document.hidden)updateLiveView();if(snapshot&&!panel&&liveEnabled&&!document.hidden)void loadLiveQuotes();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateLiveView();if(!document.hidden&&snapshot&&!panel&&liveEnabled)void loadLiveQuotes();});
render();
loadMarketData();
loadSectorData();
try{const stored=await persistence.restore();if(stored){const value=validateExport(stored);snapshot=value.snapshot;layout=value.layout;planning=value.planning||defaultPlanning();isDemo=planning.dataKind==='demo';render();}}catch{message='本机保存的内容暂时无法读取。未覆盖原数据，你可以尝试导入备份或清除数据。';render();}
