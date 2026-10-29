# Personal sector guidance implementation plan

> For agentic workers: use superpowers:executing-plans to implement in this session.

**Goal:** 用户已选择以可接受亏损、预计用钱日期、板块配置上限建立本地可解释建议。

**Architecture:** 在现有 plan 中增加可选 riskProfile，旧备份保持兼容。独立纯函数依据已确认金额、分类、个人输入和已有行情生成建议；两类观察卡共用简短摘要。

**Tech Stack:** 原生 JavaScript、现有本地存储及备份、Vite、Node test、Playwright。

## Agreed design

选择本地规则与解释；不增加远程AI或用户数据请求。相比只显示分类可给出配置行动，相比云端推理容易核验且保持隐私。三个输入均可留空，不猜测风险偏好。上限适用于各个分类关联产品金额占同币种已确认持仓的比例，不代表真实底层敞口；分类可能重叠。未来365日内用钱作为公开的检查窗口，不预设合理资产比例。亏损比例只计算整体已确认金额的假设波动金额，不预测实际亏损、不据此下止损指令。现有情绪来源未接入，明确披露，不生成分数。分类缺少行情时仍提供个人配置建议。遮罩隐藏比例和情景金额；不同币种分开计算。日期缺失、混合或待补持仓限制结论。用户确认的个人版隔离与不上GitHub要求持续适用。

## Review focus

- 旧备份无profile仍可恢复；严格字段校验、有效日期及百分比0至100。
- 未确认/负金额/未知币种不计入分母；零总额不产生比例；多个币种不相加。
- 缺失或陈旧行情不参与当前方向性建议；未知情绪不按中性处理。
- 多板块重叠不重复计算单板块分母，不推断真实行业权重。
- 设置保存失败保持旧目标；导入真实持仓不沿用演示profile。

## Tasks

- [x] 先写纯测试：profile严格校验/备份往返、上限优先、短期用钱、缺失与陈旧数据、币种和遮罩；观察失败。
- [x] 实现 profile、目标表单、独立 guidance 引擎及共用卡片摘要；保留原详细证据。
- [x] 用虚构持仓验证保存目标→两类卡片→导出恢复→修改目标即时更新，并检查窄屏。
- [x] 完整测试/构建、相关浏览器回归、静态隐私扫描、独立复核；按明确文件路径本地提交。

## Completion ledger

Implemented optional plan.riskProfile, independent pure guidance module and shared view. Added fresh proxy drawdown versus self-defined willingness and zero-loss checks, explicitly bounded to historical proxy evidence. Existing triggered personal rules remain available. Fixed review findings: reload failure invalidates retained evidence for current suggestions; mask hides personal titles and priority. Browser tests now use BASE_URL consistently rather than assuming port4318. Full validation and local review evidence recorded in docs/PERSONAL_SECTOR_GUIDANCE_REVIEW.md. No remote operations or private data access.
