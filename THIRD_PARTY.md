# 第三方组件与数据使用条件

核对日期：2026-10-29。应用自有源码按项目所有者选择采用 [MIT](LICENSE)。MIT 不替换第三方许可，也不授予行情数据、第三方商标或用户资料的权利。

## 组件与模型

| 对象 | 锁定版本 | 本轮核对 | 分发处理 |
| --- | --- | --- | --- |
| Tesseract.js / core | 7.0.0 / 7.0.0 | 已安装 LICENSE 声明 Apache-2.0 | 生成包保留许可及 Worker 内嵌组件声明 |
| chi_sim / eng 模型 npm 包 | 各 1.0.0 | 包元数据写 MIT，但没有独立许可文件；分发仓库 LICENSE 为 Apache-2.0 | 不将模型简单标成应用 MIT；一并保留上游 Apache 全文、来源与模型散列 |
| Vite | 8.3.5 | 已安装 LICENSE；MIT | 构建工具，不把其可执行程序放进源码审阅包 |
| Playwright / core | 1.64.1 | 已安装 LICENSE/NOTICE；Apache-2.0 | 仅测试，不包含浏览器程序或个人浏览器资料 |
| Lightning CSS 及平台包 | 1.33.0 | 锁文件及已安装 LICENSE；MPL-2.0 | 属于构建工具依赖，不因应用 MIT 而改许可 |

完整57项锁定依赖元数据及模型来源散列见 [DEPENDENCIES.json](docs/DEPENDENCIES.json)，元数据不是所有传递依赖的独立法律审计。不同系统安装的可选平台包可能不同。

上游 [naptha/tessdata 说明](https://github.com/naptha/tessdata/blob/gh-pages/README.md)说明 `4.0.0_best_int` 是整数化的 tessdata_best，npm 使用该分支文件。[分发仓库 LICENSE](https://github.com/naptha/tessdata/blob/gh-pages/LICENSE)和[模型上游 LICENSE](https://github.com/tesseract-ocr/tessdata_best/blob/main/LICENSE)均已核对、保存在 licenses/。本轮下载的两种上游压缩模型与已安装文件逐字节相同，散列见清单；未据此声称核验了完整训练数据权利链。

`scripts/vendor.mjs` 从锁定安装复制 Worker、core loader/WASM 和两种模型，不使用运行时 CDN。生成的 `vendor/THIRD_PARTY.txt` 汇总当前已安装依赖能取得的 LICENSE/NOTICE/COPYING、Worker 许可旁文件和上游模型许可。不得在分发构建时删去它。该汇总不等于全部原生 WASM 子组件已逐项完成权利审查；打包二进制公开发布前仍须复核上游原生组件和嵌入依赖的完整声明。

## 行情数据独立于代码许可证

| 来源 | 当前证据 | 本轮结论 |
| --- | --- | --- |
| 腾讯财经固定日线、周线及四指数报价接口 | 已知请求位置与本机使用；未取得覆盖本应用面向公众展示、缓存和再分发的明确许可 | 不把公开可访问视为分发授权；源码包不带行情快照，不把本机中转直接作为公众服务上线 |
| Cboe VIX CSV | [网站条款第2节](https://www.cboe.com/terms)限制材料使用，并区分个人非商业用途与其他复制、展示和分发；具体产品可能另有条款 | 未取得本应用公开展示/再分发授权；不把 CSV 随包公开，不把应用 MIT 当作数据授权 |

腾讯通用页面读取本轮未获得可确认的适用接口分发条款；这表示证据未解决，不表示确认允许或确认禁止所有用途。Cboe 具体产品授权须结合实际用途确认，本说明不替代授权文件。

## 发布边界

本轮准备的是不含 `.git`、依赖、模型二进制、浏览器、行情快照和用户资料的源码审阅包。下载者首次安装会从 npm 取得原依赖，首次构建没有行情时只生成不可用状态，不伪造走势。源码开源与运营含行情的网站是不同的发布决定。公众行情服务和二进制整包仍需解决上述授权及声明事项。
