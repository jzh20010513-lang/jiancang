# 本地持仓看板 Implementation Plan

> **For agentic workers:** Use the applicable execution and TDD skills. User has authorized implementation; continue through verification without a further plan approval gate.

**Goal:** 独立静态截图持仓看板，供用户本地审阅，不发布。
**Architecture:** ES modules + Vite，浏览器 Worker OCR，纯函数金额统计，可选 IndexedDB。
**Tech Stack:** 原生 JavaScript（采用运行时 schema 校验）、CSS、Tesseract.js、本机 Playwright。
**Spec:** docs/specs/PRD.md、docs/specs/TECHNICAL_DESIGN.md。

## Global Constraints
- 不读个人项目私有目录、不修改其文件或服务，不上传 GitHub、不部署。
- 默认内存模式，图片/OCR 原文不持久保存；仅同源静态资源请求。
- 10 张/10 MiB 每图/50 MiB 每批/2000 万像素；整组替换需预览确认。
- 独立新目录与 Git 仓库；可运行和验收后才初始化本地基线。

## Review Focus
- 恶意恢复文件与原型键：schema 测试拒绝且保留旧数据。
- 取消与迟到 OCR 结果：浏览器测试旧快照不变。
- 多币种/缺失/负资产/未知日期：领域测试与显示明确排除或标记。
- 持久化失败与恢复：存储事务失败不伪报保存成功。
- 网络和站点存储：实际识别和编辑期间只允许静态资源，原图不留存。

## Tasks
### 1 数据与计算
- [x] 创建 tests/domain.test.mjs、tests/transfer.test.mjs，运行并观察失败。
- [x] src/domain.mjs：parseAmount、aggregate、makeSnapshot；精确十进制、分币种、待补行。
- [x] src/transfer.mjs：validateExport、validateLayout；未知字段/版本/ID/引用拒绝。
- [x] 重跑领域和 schema 测试通过。
### 2 本地图片及 OCR
- [x] 测试先覆盖图像头/尺寸/动图/资源限制和字段解析。
- [x] src/images.mjs：validateImage、decodeImage；src/ocr.mjs：startRecognition、cancelRecognition、parseCandidates。
- [x] 同源 vendor、模型固定；Worker 取消/超时及手填退路。
- [x] 30 张三种合成版式 OCR 评测，记录原始数据，不声称真实平台兼容。
### 3 UI 与本机数据
- [x] src/main.mjs、src/styles.css、src/storage.mjs、index.html：首页、截图裁剪/旋转、核对、预览、看板、DIY、导出恢复。
- [x] 默认会话内存，选择保存才打开 IndexedDB；失败回退须显式同意。
- [x] 合成数据示例、重叠提示、金额遮罩、标签关注、筛选和固定分母说明。
### 4 验证与审阅交付
- [x] scripts/serve.mjs：仅独立静态目录、4318端口、不记录用户信息。
- [x] tests/browser.mjs：导入/核对/保存/导出/清除/DIY、360/768/1280、网络与存储、错误恢复。
- [x] 独立审阅并修复重要项，跑最终回归与构建。
- [x] README、PRIVACY、THIRD_PARTY、验收/限制说明；许可证由用户发布前选择。
- [x] 按文件暂存审查；创建可运行本地基线并报告，不创建远程。

## Design direction
冷白 #f3f6fa、墨蓝 #172b46、湖蓝 #167d9a、青绿 #217a68、琥珀 #a36a12；系统中文无衬线，金额用等宽数字。侧栏与工作区分层，特征为按币种独立的资产分布色带；不以收益涨跌构造虚假交易氛围。

## Rulings / progress
- 原生 JS 替代建议 TypeScript：减少构建依赖；运行时 schema 与测试仍是必需。
- 三个责任边界可并行：领域/schema、图片/OCR、UI/存储；仅根代理维护依赖与集成。
- 不继承个人版代码、Git 历史或真实配置。合成截图全部从零生成。
