# Overseas reference implementation plan

> Use superpowers:executing-plans inline; preserve local-only boundaries.

**Goal:** 接入已探测的纳斯达克100和恒生科技日周线，严格标注参考对象并只采用完成周期。

**Design:** 扩展固定SECTOR_CATALOG两项指数，保留原三个ETF。美股科技映射纳指100市场参考（不是纯科技或实际基金），港股科技映射恒生科技指数参考；相对基准分别标普500、恒生指数。用户确认的分类是关联依据，不以基金名新增网络请求。旧3记录公共包兼容并在离线构建中升级为5项，新增缺失项明确不可用。完整持仓备份结构不变。

**Data:** 每项固定日线地址与海外项固定周线地址。日线按源市场时区在本地17时后接纳同日数据（原CN保持16时）；周线只有在该市场周末才接纳本周数据，周内舍弃本周，即使周五盘后也等待周末，避免半日市/假期推断。无需按本机日期判断美国收盘。周线严格每ISO周至多一条，最多400条，跨假期不补值。指数volume置null，避免来源单位未核实时解释交易活跃度。周线刷新错误独立保存，旧日周数据只能按各自来源/日期参与判断。

## Tasks

- [x] 写失败测试：时区与夏令时、周末/跨年/短周、旧包迁移、固定来源校验、海外基准匹配及周线缺失。
- [x] 扩展catalog、严格公共包、固定源采集、完整周期截断、离线迁移和失败回退。
- [x] 日周解释分别展示、期别分歧与参考边界、动态单位和基准；取消ETF/元/沪深300的海外硬编码。
- [x] 固定公共数据实际刷新/构建，虚构持仓浏览器验收与隐私网络回归、独立复核、本地提交。

## Review focus

旧3项包只容许原CN三项；任意缺项/重复/伪造源拒绝。日线可用而周线失败不互相冒充。周内实时周条不得确认。纽约夏令时影响本地日期/时刻。跨市场不前向填充。纳指100与纯科技区别；指数成交量未知；不改个人版、不上传。公开接口可返回不等于长期许可或服务保证，发布前另行核实。

## Ledger

Completed fixed source expansion, legacy migration, independent daily/weekly fallback and source-timezone truncation at collection and analysis. Review fixed first-refresh daily failure incorrectly hiding valid weekly data. Unverified index volume is null end-to-end. Verified public source snapshots: 250 daily samples and319 completed weeks per overseas index, current incomplete week excluded. Full review/validation and release limitations: docs/OVERSEAS_REFERENCE_REVIEW.md. No private data, push, or deployment.
