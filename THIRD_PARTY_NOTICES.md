# 第三方组件声明（THIRD_PARTY_NOTICES）

本插件 · Markdown 只读预览功能 · 内置/引用的第三方组件与许可证如下。

组件以「就地内置（vendored）」方式随插件发布。全部组件的运行期加载均走插件自身的同源静态路由 `/side-coder-vditor/dist/…`，不发起任何外部网络请求。

## Vditor（含内置配套引擎）

- 组件：独立于编辑器的预览渲染器（`method.min.js` + `index.css` 及打包的运行时子资源）
- 版本：4.0.0（固定版，MIT）
- 许可证：MIT
- 来源：https://github.com/Vditor/vditor
- 说明：本项目仅内置 Vditor 的**预览子集**资产，不内置完整包体；Vditor 4.0.0 的完整第三方依赖与版权信息以其官方仓库为准。

## lute（Markdown 解析引擎）

- 组件：`dist/js/lute/lute.min.js`（纯 JS 版，无 wasm）
- 版本：随 Vditor 4.0.0 打包
- 许可证：MIT
- 来源：https://github.com/b3log/lute

## mermaid（流程图渲染引擎）

- 组件：`dist/js/mermaid/mermaid.min.js`
- 版本：11.16.1（URL 参数 `?v=11.16.1`）
- 许可证：MIT
- 来源：https://github.com/mermaid-js/mermaid

## KaTeX（数学公式渲染引擎）

- 组件：`dist/js/katex/katex.min.js`、`mhchem.min.js`、`katex.min.css`、`fonts/` 字体
- 版本：0.16.9（URL 参数 `?v=0.16.9`）
- 许可证：MIT
- 来源：https://github.com/KaTeX/KaTeX

## highlight.js（代码高亮）

- 组件：`dist/js/highlight.js/highlight.min.js`、`third-languages.js`、`styles/github.min.css`、`styles/github-dark.min.css`
- 版本：11.7.0（URL 参数 `?v=11.7.0`）
- 许可证：BSD-3-Clause
- 来源：https://github.com/highlightjs/highlight.js

## icons（图标）

- 组件：`dist/js/icons/ant.js`
- 说明：随 Vditor 4.0.0 打包的图标资源，遵循 Vditor 的 MIT 许可。