# Market and volatility evidence implementation plan

> Implement inline with superpowers:executing-plans and test-first verification.

**Goal:** 以明确适用范围的真实数据补充美股波动背景，并展示市场对照的绝对涨跌和相对差值。

**Design:** 现有同源sector-data.json增加可选context.vix，旧包仍可读取；固定源为Cboe官方VIX历史CSV，仅采集脚本获取，不发送持仓。日线采用纽约17时后完成规则，保留最近253个完成收盘。严格来源/日期/数值/上限校验，失败独立保留旧记录并标失败。构建离线，不增加浏览器外部连接或用户业务存储。

**Interpretation:** VIX仅用于us-growth参考卡的美国宽基期权隐含波动背景，不能套给HK/CN/黄金或基金本身。显示当前值、相对上次变化、相对前20收盘均值及相对前252收盘的经验分位；不足则不计算对应项。分位不做风险评分、不设买卖阈值，VIX上升不推出指数一定下跌。仍明确缺少市场广度、估值/盈利与其他情绪证据。相对窗口同时展示参考和基准各自区间变化（共同21日期），说明百分点差值不是基金收益。

## Tasks

- [x] 测试：CSV严格解析/截断、旧包兼容、来源注入/未来值拒绝、陈旧/刷新失败、252分位样本数、市场范围与绝对对照。
- [x] 实现纯数据/解释模块，固定源采集与回退，扩展可选公共context；旧备份、持仓与个人规则顺序不变。
- [x] 两面卡片与个人解释中展示部分证据及来源日期；加载/源失败屏蔽当前判断，不生成方向交易建议。
- [x] 实际固定源刷新、单元/构建、虚构持仓与行情浏览器验收、隐私回归、独立复核、本地提交。

## Review focus

失效VIX不标当前；仅VIX成功不依赖日线；当前未结束日剔除；重复/乱序/HTML/大文件拒绝；分位含并列且不含本次样本；HK不能显示VIX结论；VIX不能冒充全市场情绪分；字段不进持仓备份；发布前数据授权另行核验。

## Ledger

Completed optional public context, fixed official CSV retrieval, recent-window validation, independent failure retention, scope-limited VIX explanation and common-window absolute returns. Verified canonical Cboe redirect endpoint rather than treating307 HTML as CSV. Only consumed recent254 OHLC rows are relationally validated; dates/order/positive numbers checked for all bounded archive rows. Short history hides only unavailable comparisons. Actual253 completed points through2026-10-27. Full validation: docs/MARKET_VOLATILITY_REVIEW.md. No remote release or private-data access.
