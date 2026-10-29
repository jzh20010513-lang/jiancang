# 使用流程验收记录 · 2026-10-29

## 本轮范围
独立本地看板从导入、字段核对、板块关联、个人标准与建议到完整备份恢复。所有测试仅使用虚构基金、截图和持仓，不读取或修改个人版，不上传 GitHub，不部署。

## 已复现并修复的问题
名称或代码被更正后，原先已确认的板块/参考市场仍处于 confirmed，可能让新基金继续收到旧板块的观察建议。

新增浏览器回归先在原版本重现“更名后 sectorReady 仍为 true”，修复后通过。现在名称或代码发生输入变更时：
- 行核对和板块/市场关联确认均取消，保留关联选择作为待核对候选并显示提示；不会自动猜测新关联。
- 原来确认“无合适参考”的空选择也退回待核对。
- 没有重新确认的关联不会生成旧板块观察；重新选择并确认后按新关联计算。
- 仅修改金额仍需重核该行，但不取消板块/市场关联。
- 重新确认后移除“请重新核对”提示，运行时提示状态不进入备份。

## 真实运行的检查
- `npm.cmd run check`：241/241 单测通过，生产构建通过。
- 22/22 浏览器与 HTTP 流程通过，原始退出码保存在忽略目录 `artifacts/journey-browser-results.json`：fund-identity-browser、browser、name-review-browser、workflows、checkup-browser、market-browser、sector-browser、live-browser、overseas-browser、volatility-browser、technical-explanation-browser、sector-guidance-browser、sector-choices-browser、sector-confirmation-browser、goal-feedback-browser、fund-import-browser、stacked-import-browser、quote-http、risk-only-backup-browser、alipay-ocr-browser、alipay-combined-ocr-browser、cancellation。
- 新旅程从虚构基金录入，确认关联及持仓，设置个人上限，验证关联产品占比40%超过自定30%时触发集中度核对，再更名、确认新医疗板块、修改代码、导出完整备份、清空测试会话、恢复，验证配置和建议一致。
- 额外覆盖已有市场关联、明确无参考的空选择、金额修改保留关联、其他行核对状态不变，及网络没有持仓参数或上传请求。
- OCR 两组实际本地识别仅使用合成支付宝式图片；本轮未修改 OCR、解析、指标算法和数据源，未重复36张准确率基准，不宣称精度提升。
- 市场/情绪失败、加载中、过期和缺证据降级由既有合成数据浏览器回归覆盖；通过不代表外部行情源持续可用或低延迟。
- 静态输出审计25文件，凭据模式命中0，无符号链接；独立只读审查未发现P1/P2。

## 尚未完成的人工验收
开发者未读取用户真实持仓，也未确认真实支付宝截图逐字识别结果。请使用 [本机真实截图验收清单](USER_ACCEPTANCE.md) 在自己设备完成；截图和备份无需提供给开发者。

许可证、模型和行情数据使用条件审查仍是公开前待办，本轮不构成发布批准。
