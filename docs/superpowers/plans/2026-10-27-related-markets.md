# Related Markets Implementation Plan

> Use TDD, bounded independent modules, and final independent review. User approved implementation; keep local for review.

**Goal:** 按持仓确认的参考市场展示公共走势，并重排首页。
**Architecture:** 固定公共市场包 + 浏览器本地映射 + 统一同源静态请求，不新增用户后端。
**Spec:** docs/specs/RELATED_MARKETS.md。

## Global Constraints
不读取或修改个人版，不上传，不部署；固定白名单，无自定义URL/执行代码；未知/过期数据不假装实时；参考走势不等于持仓收益。

## Review Focus
币种不能替代市场映射；原图/持仓代码/映射不外发；无数据不可画假线；新导入不能继承示例映射；折叠体检仍可访问全部证据。

## Tasks
- [x] 数据层：固定catalog、可测更新脚本、失效/历史解析、同源数据包与本机真实刷新证据。
- [x] 本地关系：确认映射、未设置与无参考区分、关联原因及pinned/hidden/order纯函数测试。
- [x] 备份与配置：可选row benchmarkIds/benchmarkReview，planning marketPreferences，旧格式兼容和纯布局边界。
- [x] 首页：市场曲线、时效/来源、关联管理、资产概况与前三项体检、完整细节折叠。
- [x] 新浏览器隐私/降级/UI与全部旧回归，审阅、文档、明确路径本地commit。

## 完成记录
2026-10-27：固定真实公共数据已采集，本地映射与首页重排已实现，90项单元及新旧浏览器回归通过；GLD仅单点按不足样本处理。独立审阅P2已修并复核。源码与文档本地提交，数据/产物忽略，不发布。详见docs/RELATED_MARKETS_REVIEW.md。
