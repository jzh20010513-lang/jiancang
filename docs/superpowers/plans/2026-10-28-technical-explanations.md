# Technical explanations implementation plan

> Use superpowers:executing-plans for inline implementation.

**Goal:** 按已批准范围升级现有日频技术解释，同时核实海外参考数据可用性，不扩展未经核验的指标。

**Design:** 独立纯函数从现有OHLCV和technicalAnalysis提取当期、前期、前5样本的值，输出趋势/动能/量能及综合解释。核心原始指标算法不变。运行时缺失、刷新失败、过期与加载状态统一禁止当前方向结论；旧数值可在详情保留日期。卡片保留个人规则优先顺序，新增说明不替代个人配置约束。

**Rules:** 均线位置与方向分别描述。MA20/60方向比较当前与5个样本前；不足时不猜测。MACD至少61条才比较连续两次值，金叉不等于DIF上穿零轴；柱变化只作动能描述，不计综合分。成交量仅对照前20有效样本均量，直接展示倍数，不推断资金身份。只有日频数据，本轮不生成周线确认。所有窗口指交易样本，不当作自然日。沿用本地处理、三个ETF代理及现有隐私边界。

## Tasks

- [x] 先写趋势、MACD交叉/零轴、下跌动能减弱、量价分歧、缺失、过期与刷新失败测试，确认失败。
- [x] 新增technical-explanation模块和共用视图，接入sector报告、卡片与个人建议依据；说明原始参数及证据限制。
- [x] 独立请求固定公开海外数据地址，核实返回对象、周期/长度和可靠性；记录成功与失败，不修改行情白名单。
- [x] 单元/构建、虚构数据浏览器验收、旧目标与板块回归、窄屏检查、独立代码复核与本地提交。

## Review focus

刷新失败仍有旧bundle；加载期间旧数据；只有60条无法确认MACD交叉；负柱缩短但价格仍低于均线；成交量null/零基准；价格与均线相等；遮罩不暴露个人建议；海外科技不等于纳斯达克100纯科技；250日不足长期周线。

## Ledger

Completed independent explanation layer, shared UI, runtime evidence gates and personal advice consistency. Seven pure explanation tests plus a guidance regression exercise actual cross/zero-axis differences and conflicting averages. One review P2 fixed: weak advice now follows new trend state rather than price position alone. Source probe returned daily and weekly candidates; no production data-source changes. Verification and limitations: docs/TECHNICAL_EXPLANATION_REVIEW.md.
