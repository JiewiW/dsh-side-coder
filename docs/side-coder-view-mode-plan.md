# side-coder 编辑器区三视图（编辑 / 对比 / 预览）互斥改造计划书

- 版本：v0.2（依据独立审查报告 `docs/side-coder-view-mode-review-v1.md` 修订；3 条 P0、12 条 P1 全部消解，采纳 P2 第 1/2/3/5/6/7/8/9/10/12 项）
- 日期：2026-10-11
- 适用代码：`D:\dsh\dsh-side-coder\lib\client.js`（界面半边，178668 字节 / 3901 行，React.createElement 无构建步）；后台半边 `lib\index.js` 本次**不改动**
- 事实来源标记：〔用户报告〕= 用户描述的现象；〔代码取证〕= 直接读源码确认（附行号，经子代理逐条复核）；〔产品决策〕= 本次显式制定的行为规则；〔推断〕= 未直接证实的推导（v0.2 已无推断项，原第 8 章 5 条全部证实，见第 9 章）

## 目录

0. TL;DR
1. 问题描述（复现路径）
2. 现状机制（代码取证）
3. 缺陷归纳
4. 改进方案（状态模型 / 决策表 / 控件 / DiffPane / 兼容 / reducer）
5. action 分发点与映射清理全入口
6. 实施任务拆分
7. 不做什么（范围控制）
8. 验证方案
9. 审查待核实项证实结果
10. 风险与回滚
11. 术语表
12. 症状→章节反向索引
13. 计划书自查清单

---

## 0. TL;DR

编辑器区当前由 `preview`、`diffOpen`、`diffDetail` 三个互相独立的状态加活动标签匹配**隐式拼出**视图，没有单一事实源，导致按钮高亮与实际视图可长期不一致（预览点了没反应、对比取消后 diff 再也回不来）。

改造核心：

1. 引入**每标签一份的显式视图状态** `viewByTab[absPath] ∈ {'editor','diff','preview'}` 与 **diff 数据缓存** `detailByPath[absPath]`，数据与视图解耦，三态互斥穷尽。
2. 「预览 / 对比」改为同一 segmented 按钮组（`role=group` + `aria-pressed`，同一时刻至多一个高亮）；「对比」按钮只切编辑器视图，不再承担改动列表面板开合。
3. 自动弹出、DiffPane 首见（含页面重载）、跟随（follow）三条自动通道全部改为分发显式 reducer action，视图不再依赖组件挂载与 RPC 时序。
4. 状态迁移抽为零自由变量的具名纯函数 `reduceViewState`，沿用现有抽取式 Node 测试基建锁死全部迁移。
5. 不改后台、不加依赖、不加构建步；部署覆盖 6 个 profile 拷贝，覆盖前手工备份并给一行回滚命令。

---

## 1. 问题描述（复现路径）

**前置情景**〔用户报告〕：本会话内工作目录发生文件改动，且 DSH 侧栏已存在 side-coder 标签页。

1. 改动发生后侧栏自动弹出，显示最后一个被改动文件的 diff。此时点「预览」：按钮出现高亮边框，但 diff 区不切换为 Markdown 预览，维持现状。
2. 保持「预览」高亮，从文件列表打开另一个 `.md` 文档 B：B 正常显示预览；再切回原文件标签 A，A 也变成了 Markdown 预览。
3. 上一步后「预览」「对比」均高亮。取消「预览」：编辑器不显示 diff，而是回到普通编辑器；想再看 diff，必须先取消「预览」，再把「对比」取消并重亮一次，diff 才恢复。

用户判断：预览 / 对比 / 正常编辑器三种界面缺少互斥逻辑，按钮观感也未体现三态互斥。该判断经代码取证与独立审查确认成立。

---

## 2. 现状机制（代码取证）

### 2.1 状态变量

`SideCoderPanel` 组件体（实际起于 `client.js:3288`）持有：

| 变量 | 位置 | 含义 | 持久化 |
|---|---|---|---|
| `diffOpen` | `client.js:3290` | 「对比」按钮开关；同时决定 DiffPane 改动列表面板是否挂载（`client.js:3532`） | localStorage 常量 `TOGGLE_DIFF_OPEN="diffOpen"`（`client.js:149`），默认 true |
| `diffDetail` | `client.js:3294` | 当前 diff 内容对象（父组件 state），由子组件 DiffPane 异步选择后经 `onDetailChange` 回写 | 否，易失 |
| `preview` | `client.js:3296` | 「预览」布尔态 | 否，临时 |
| `selectedPath`（DiffPane 内部） | `client.js:2559` | 改动列表当前选中文件，初值 `null` | 否 |

实际可见视图 = `preview × diffOpen × diffDetail × activeTab 是否匹配` 的隐式组合，不存在显式视图枚举。

### 2.2 按钮行为

- 「预览」按钮（`client.js:3451-3460`）：`className` 只看 `preview`（3452）；`disabled` 仅看 `activeTab` 与 `isMarkdownPath`（3454），**不看 `diffDetail`/`diffOpen`**；点击仅 `setPreview(p=>!p)`（3455-3459）。
- 「对比」按钮（`client.js:3474-3482`）：只 toggle `diffOpen` 并写 localStorage（3479-3480）；不触碰 `diffDetail`、`preview`。
- 两按钮无分组容器、无 `role=group`、无 `aria-pressed`（3451-3499 全段为独立 button），可同时高亮。
- `setDiffOpen` 全量调用点仅两处：头部按钮（3479）与 `onAutoOpen`（`client.js:3543`，运行时置 true **不写盘**）；其余 grep 命中为常量/声明。

### 2.3 渲染门

- EditorPanel（`client.js:2318-2333`）：`data-diff-active = diffDetail ? "true":"false"`（2318）；`data-preview-active = (preview && previewPath && isMarkdown && !diffDetail) ? "true":"false"`；VditorPreview 挂载条件同样带 `&& !props.diffDetail`（2321）；DiffOverlay 在 `diffDetail` 真值时挂载（2325）。
- CSS（`client.js:853-862`）：`[data-diff-active="true"]>.dsh-cc-editor{display:none}`（855）；`.dsh-cc-preview` 默认 `display:none`，仅 `[data-preview-active="true"][data-diff-active="false"]` 时 `display:block`（861-862）。
- 即：**`diffDetail` 非空时预览组件不挂载、CSS 永不显示，但预览按钮已翻转高亮**——控件与界面脱钩，对应现象 1。
- `activeDiff` 派生（`client.js:3407` 原文）：`diffOpen && diffDetail && state.activeTab && samePath(toAbs(diffDetail.path), toAbs(state.activeTab)) ? diffDetail : null`；路径不匹配则静默无 diff。

### 2.4 切标签、打开文件与 detail 生命周期（v0.2 已按审查修正时序）

标签激活有两个独立入口：

- **文件树/链接打开**走 `handleFileOpen`（`client.js:3379-3390`）→ `state._openFile`（即 `openFile`，`client.js:2233-2271`）：已存在标签在 2237 直接激活；新标签经 `readFile` RPC 异步返回后在 2258-2263 才 push 并设 activeTab。`openFile` **不调用 `handleTabSelect`、不清 `diffDetail`**；`handleFileOpen` 仅在非 md 时 `setPreview(false)`（3385-3388），命中改动列表时另写 `state._selectChangePath`（3381-3384）。
- **TabBar 点标签**走 `handleTabSelect`（`client.js:3395-3405`）：无条件 `setDiffDetail(null)`（3397）；仅切到非 md 才 `setPreview(false)`（3400-3403）。

DiffPane detail effect（`client.js:2678-2736`）：仅当 `selectedPath` 或签名 key 变化时 RPC 拉取并 `onDetailChange` 回发；去重判断 `if (key === detailKeyRef.current) return;`（2696）。key 的真实构成（`client.js:2695`）是 **`\u0001` 分隔五字段**：`[meta.path, meta.sessionId||"", meta.lastTime, meta.baselinePos, meta.chainLength]`。注意另有一处 @ 分隔七字段签名在 `client.js:542`（groups 层：path/lastTime/count/chainLength/baselinePos/changeKind/renamedFrom），两者用途不同，禁止混用。

`selectedPath` 的赋值分支全部在 applyGroups（`client.js:2610-2655`）：pendingChange 消费（2610-2620）、`_selectChangePath`（2621-2631）、首见自动选中（2632-2637，`lastSeenRef.current===null → setSelectedPath(top.path)`，**无条件、不看 follow**）、follow 持续跟随（2638-2655，条件 `props.follow && state._autoselectAck !== top.path` 且同源门控，动作含 `setSelectedPath`（2648）、`setFlash`（2649）、`props.onAutoOpen()`（2653））。

`handleDiffDetail`（`client.js:3345-3353`）：写 `diffDetail`，并 `state._selectChangePath=detail.path` + `state._openFile(...)`（3350-3351），即**任何 detail 回发都会强切活动标签**。拉取失败走 `onDetailChange(null)` 静默回退（2729-2735），无失败 UI。`onDiffClose`（`client.js:3517-3519`）仅清空 diffDetail。

**现象 1 机制**：A 处于 diff 中（`diffDetail` 非空）时点预览，渲染门 `!diffDetail` 吞掉切换但按钮态翻转。

**现象 2 机制（v0.2 修正）**：打开 B 走 `openFile`，**不清 `diffDetail`**，父组件 diffDetail 仍指向 A；B 期间之所以显示预览，是 `activeDiff` 同路径派生门（`client.js:3407`）在 activeTab=B 时失效 → 传入 EditorPanel 的 diffDetail 为 null（3513）→ 预览门解除，`preview=true` 首次生效。`setDiffDetail(null)` 实际发生在**切回 A 时**的 `handleTabSelect`（3397）；此后 DiffPane 的 selectedPath 仍是 A、五字段 key 未变（2695-2696）不重发，A 只剩预览。

**现象 3 机制**：取消预览后 diffDetail 已为 null，diffOpen 虽 true 但无数据；「对比」toggle 一次只改 diffOpen——DiffPane 先卸载再挂载，selectedPath 重置 null，首见分支（2632-2637）重新选中并走完拉取回发链，diff 才恢复。用户被迫用「重挂子组件」间接重建数据。

### 2.5 自动弹出链

`handleWatchPayload`（`client.js:705-757`）：门控 `hasSideCoderTab`（690-703）+ autoPopup（739/752）；命中时写两个一次性 pending 通道：首改动分支 `state._pendingOpenPath`（743）、`state._pendingChangePath`（744）；后续改动分支第二份写入在 **753/754**，随后 `openSidebarTab()` + `refresh()`。消费点：面板 effect（`client.js:3325-3333`）用 pendingOpen 调 `handleFileOpen`（该 effect 注释中 `_pendingChangeId` 是陈旧名，实际通道为 `_pendingChangePath`，本次顺手修正）；DiffPane applyGroups（2610-2620）消费 pendingChange 后 `setSelectedPath` 并 return。pendingChange 消费**不受 follow 门控**（在 follow 判断之前）。全链路无显式视图模式，最终视图取决于面板 effect 与 DiffPane 拉取的完成时序。

### 2.6 两组导航控件（v0.2 修正：原 v0.1 认错身份）

- **基线导航**（DiffOverlay 工具条，`client.js:2501-2524`）：按钮文案「⏮ 到最初 / ↖ 后退 / ↘ 前进 / ⏭ 到最新」，disabled 绑 `detail.baselinePos/chainLength`（2504/2509/2514/2519），回调经 `handleBaseline`（3360-3378）→ `setBaselineTick`（序号声明 3297-3298，传入 3536）→ DiffPane effect 因 `pollTick` 重订阅（依赖数组 2675）。特征：**文件 p 不变，baselinePos 变，五字段 key 变 → 同文件重拉**。
- **文件翻页**（DiffPane 列表头，`client.js:2772-2784`）：按钮「◀ / ▶」，回调 `stepFile(delta)`（2744-2748）在 `fileChanges` 间按 lastTime 顺序取模换索引并 `setSelectedPath(fileChanges[next].path)`。特征：**p 本身改变**，detail 回来后同样经 handleDiffDetail 强切标签（3349-3351）。
- DiffOverlay 载入口文案为「对比内容生成中…」（2528）；DiffPane 空态文案为「本次会话还没有文件改动」（2771），无独立空态组件；**当前不存在拉取失败 UI**。

### 2.7 README 既有语义承诺（`README.md`）

- 第 9 行：◀ ▶ 可翻历史改动（实为文件翻页，README 措辞本次随 T5 澄清）。
- 第 10 行：新改动约 2 秒自动展开右栏、对比区直跳最新改动；「弹出」按钮点灭即只手动打开。
- 第 11 行：「跟随」亮着时对比区自动跳最新改动，点灭后手动翻。
- 第 22-23 行：「对比」= 收起/展开对比区；「预览」= Markdown 只读预览。
- 第 25 行：四个面板开关状态持久化；**自动弹出不强行翻开对比，尊重用户点灭的状态；用户手动点开对比时才直跳最新改动**；**预览临时，切换文件或退出面板即复位**。
- 第 31 行：相对路径图片明确不支持。
- 第 35 行：预览数据源优先级——活动编辑器即被预览文件时用 Monaco 实时内容（含未保存编辑，实现于 `readContent`，`client.js:1715-1729`，1725-1726 取 `editor.getValue()`，否则 1717-1718 回退 `tab.content`；挂载前提 `props.path === state.activeTab`，现传参 `previewPath: state.activeTab` 在 3515）；否则回退已保存内容。本次必须保持该行为不变。

---

## 3. 缺陷归纳

| 编号 | 缺陷 | 对应现象/风险 |
|---|---|---|
| D1 | 无单一视图事实源：三个独立布尔/对象态 + 标签匹配隐式决定视图，按钮态与实际视图可长期不一致 | 现象 1、2、3 |
| D2 | `diffDetail` 是父组件持有的易失 state，由子组件异步选择驱动；TabBar 切标签即清空且无再选机制，`diffOpen` 开关不保证 diff 可见 | 现象 3 |
| D3 | diff 激活时预览请求在渲染层被静默吞掉（`!diffDetail` 门），按钮仍翻转：UI 说谎，无 disabled、无提示 | 现象 1 |
| D4 | 自动弹出、首见、follow 三条自动通道只写数据/pending 不写视图意图，视图解析依赖挂载与 RPC 时序 | 现象 1 触发背景；重载/跟随行为无显式契约 |
| D5 | 无互斥控件观感（无 segmented 分组、无 aria-pressed，两钮可同时亮）；「对比」一钮混合「列表面板开关」与「编辑器 diff 视图」两层语义；`onAutoOpen`（3543）是绕过持久化开关的运行时强开残留 | 现象 2、3 |
| D6 | 标签/文件生命周期入口分散（10 处），单值 diffDetail 与未来的 per-tab 映射均缺统一清理，易产生孤儿状态 | 重命名/删除/关标签场景 |

---

## 4. 改进方案

### 4.1 状态模型（单一事实源 + 正交解耦）

`SideCoderPanel` 新增（仅会话内存，不持久化）：

```text
viewByTab:    Object<absPath, 'editor' | 'diff' | 'preview'>  // 键存在=显式设定过；无键视同 editor
detailByPath: Object<absPath, DetailEntry>                     // DetailEntry={status:'loading'|'ready'|'failed', detail?}
```

另保留一个正交持久化概念：

- `changePaneOpen`（沿用原 `diffOpen` state 与 **localStorage key `TOGGLE_DIFF_OPEN` 原样保留**，`client.js:149` 常量不动）：仅决定 DiffPane 改动列表面板是否挂载。
- diff 数据状态：`viewByTab[p]==='diff'` 但 `detailByPath[p].status!=='ready'` 时，编辑器区显示载入占位（复用文案「对比内容生成中…」，`client.js:2528`）；`failed` 时显示**新增**失败条「对比内容载入失败」+「重试」按钮（重试=重新触发该文件的拉取 effect）。两种状态下「对比」按钮都保持高亮，**禁止「灯亮着却显示普通编辑器且无说明」**。

### 4.2 视图迁移决策表（互斥穷尽；〔产品决策〕）

记 `v = viewByTab[p]`（无键=editor），`isMd` 由调用方按 `isMarkdownPath(p)` 预算，`d = detailByPath[p]`。表中「打开标签」指沿用现状 `_openFile` 把目标标签变为 activeTab。

| # | 当前状态 | 触发（action） | 条件 | 目标视图 | 其他效果（每行单动作组合，按序执行） |
|---|---|---|---|---|---|
| 1 | editor | 用户点「对比」(`view`) | `d.ready` | diff | 面板关闭时先置 `changePaneOpen=true` 并写盘 |
| 2 | editor | 用户点「对比」(`view`) | 无 `d.ready` | diff（loading 占位） | 同上展开面板；触发该文件选中拉取 |
| 3 | editor | 用户点「预览」(`view`) | `isMd` | preview | 无 |
| 4 | editor | 用户点「预览」 | 非 md | 不变 | 按钮 disabled，reducer 收到也返回原 state |
| 5 | diff | 用户点「预览」(`view`) | `isMd` | preview | `d` 原样保留 |
| 6 | diff | 用户点「对比」(`view`) | — | editor | 仅切视图；面板保持挂载；`d` 保留 |
| 7 | preview | 用户点「对比」(`view`) | `d.ready`/否则 | diff（或 loading） | 一步直达，不经过 editor 中间态 |
| 8 | preview | 用户再点「预览」(`view`) | — | editor | 再次点击=退出预览 |
| 9 | 任意 | 新标签落地 (`open`) | 该 p 无键 | editor | 在 `openFile` 新标签 push 处（2258-2263）分发；满足「新打开文件预览复位」 |
| 10 | 任意 | 切换到已开标签（TabBar 2237/3395） | — | 该键原值 | 不分发迁移 action；视图天然按标签记忆 |
| 11 | 任意 | 标签关闭/文件删除 (`close`) | — | — | 按 paths 批量删除两映射键，见第 5 章 |
| 12 | 任意 | 自动弹出 (`autoPopup`) | `changePaneOpen=true` | diff（目标文件，缺 d 则 loading） | 消费 pendingChange（2610-2620）时分发；保留 `_openFile` 强切标签；不看 follow（与现状一致） |
| 13 | 任意 | 自动弹出 (`autoPopup`) | `changePaneOpen=false` | editor（默认） | 仅打开标签；DiffPane 未挂载不消费，不写 diff（README 第 25 行承诺不变） |
| 14 | 任意 | DiffPane 首见拿到数据 (`firstSeen`) | 该 p 无键 | diff | 对应 2632-2637 无条件首见；保留现状「页面重载后自动呈现最新改动 diff」（见 4.5 决策 A）；有键则不动 |
| 15 | 任意 | follow 持续跟随 (`follow`) | follow=true 且 ack 未命中（组件层按 2643-2648 门控后分发） | diff | 写 top 文件视图并强切标签（保留 README:11 现状语义，**即使用户正在预览也会被新改动接走**，属显式保留） |
| 16 | 任意 | follow 点灭 | follow=false | 不变 | 不分发 follow；列表照常刷新、标题 flash（2649 的视觉提示保留在面板内） |
| 17 | diff | 基线 ⏮↖↘⏭（`detailReady`） | p 不变、baselinePos 变 | diff（保持） | 重拉结果原地替换 `detailByPath[p]` |
| 18 | 任意 | 文件翻页 ◀▶（`view`+打开标签） | stepFile 换 p→q | q 的 diff（或 loading） | 沿用现状：打开/激活 q 标签（2744-2748 驱动）；q 有缓存直接显示，无则拉取；不改动来源标签的视图键 |
| 19 | diff/loading | 拉取成功 (`detailReady`) | — | diff | 写 `detailByPath[p]={status:'ready',detail}` |
| 20 | diff/loading | 拉取失败 (`detailFailed`) | — | editor | 写 `status:'failed'` 并回退视图；失败条提供重试（重试成功走 #19 回 diff） |
| 21 | 任意 | diff 视图中点「✕ 退出对比」 | — | editor | 现状 onDiffClose（3517-3519）改发 `view:editor`，不清缓存 |
| 22 | 任意 | 未知 action / 缺字段 | 兜底 | 不变 | reducer 默认分支返回原 state 引用，禁止隐式迁移 |

### 4.3 按钮控件观感（D5）

- 「预览」「对比」包进同一容器：`role="group"` + `aria-label="编辑器显示模式"`；两钮均 `aria-pressed`，**同一时刻至多一个 true**，均 false=普通编辑态。视觉采用连体 segmented 样式（相邻圆角、共享边框），与「弹出 / 列表 / 跟随」三个独立开关拉开分组间距。
- 「预览」disabled 维持：无活动标签或非 Markdown。
- 「对比」在 loading 时高亮并显示细进度纹（**触发条件明确：`detailByPath[p].status==='loading'`**，非可选项）；failed 回落 editor 时灭灯。
- DiffPane 面板标题栏保留关闭入口（写 `changePaneOpen=false` 并持久化）；头部「对比」按钮不再承担面板开合，只切编辑器视图。
- **移除 `onAutoOpen`**（`client.js:3543` 回调与 2653 调用点）：grep 已证实 `setDiffOpen` 仅此两处业务调用；DiffPane 仅在 `changePaneOpen=true` 时挂载，follow 分支运行时面板必已开，该回调为无效果残留。移除后面板开合严格只听持久化开关。

### 4.4 DiffPane 解耦（D2/D4）

- DiffPane `selectedPath` 仍表示列表选中行；拉取成功写父组件 `detailByPath[path]`。是否切视图改由显式 action 决定（4.2 表 #12/#14/#15/#18），不再让「detail 回发」本身隐式驱动视图；但各自动通道保留现状的 `_openFile` 强切标签动作（在组件层 handler 中，不在 reducer 内）。
- 列表点选行（`renderFileRow`，`client.js:2766-2768`）= 打开标签 + 发 `view:diff`（沿用现 handleDiffDetail 的开标签行为 3350-3351）。
- 删除 `handleTabSelect` 中无条件 `setDiffDetail(null)`（3397）；切标签不清任何缓存。
- DiffPane 因 `changePaneOpen` toggle 重挂时：选中行由「当前 `viewByTab==='diff'` 的活动标签，否则列表 top」反初始化；目标 detail 已 ready 则直接复用、**不重复 RPC**（五字段 key 去重 2695-2696 保留）；重挂不再是恢复 diff 的必要手段。
- 基线导航：p 不变，重拉结果原地替换缓存（#17）。文件翻页：按 #18 换 p。
- groups 刷新时执行一次保守 GC：删除 `detailByPath` 中「既不在 openTabs、也不在当前 fileChanges（按 toAbs 比对，含 renamedFrom 新路径）」的键；`viewByTab` 只随标签关闭清理（视图意图是用户态，不被列表变化剥夺）。

### 4.5 与 README 承诺的兼容决策

- 〔产品决策 A〕**保留重载后自动呈现最新改动 diff**：首见 #14 无键即 diff。理由：现状如此且 README:10 隐含；`viewByTab` 不持久化与此不冲突——首见只对「本页生命周期内从未设定视图」的标签生效，用户本页内显式选过 editor/diff/preview 后首见不覆盖。
- 〔产品决策 B〕**保留 follow 抢视图**（#15）：follow 亮 = 用户授权「自动跳最新改动」（README:11），正在预览也接走；follow 灭则完全不抢。
- 「预览临时，切换文件复位」（README:25）精确化为：**新打开**的标签默认 editor（#9），不跨文件继承 preview；同一标签切走再切回保留该标签自己的视图（修复现象 2 的关键）；视图不跨页面重载保留。README 第 25 行由 T5 按此措辞更新。
- 预览数据源优先级（README:35）与 `readContent`（1715-1729）零改动；VditorPreview 仍只以 activeTab 为 path 挂载（保持 3515 传参前提）。
- 自动弹出尊重点灭、四开关持久化：不变（#13）。

### 4.6 纯函数 reducer（零自由变量，可抽取）

`lib/client.js` 内新增**缩进具名函数声明**（兼容抽取正则 `^[\t ]*function name\(`，禁止箭头函数/const 赋值）：

```text
function reduceViewState(state, action) -> state   // 返回新对象；无迁移时返回原引用
```

硬边界：

- reducer **零自由变量**：不引用 `toAbs`/`samePath`/`isMarkdownPath` 或任何模块级常量/helper；路径归一与 isMd 全部由调用方预算后放入 action。
- 因此测试只需抽取 `reduceViewState` 一个函数，`new Function("state","action", fnBody)` 即可实例化，无需共抽 toAbs 依赖链、无需构造 `state.root`。
- state 形状：`{ viewByTab: {}, detailByPath: {} }`；action 判别仅用 `type` 字符串字面量与已归一字段。

真实样例（R40）：

```json
// 初始
{ "state": { "viewByTab": {}, "detailByPath": {} } }

// 用户在已归一的绝对路径上点对比（行 #1，d 已 ready）
{ "action": { "type": "view", "path": "D:\\dsh\\a.md", "view": "diff", "isMd": true, "paneOpen": false } }
// → viewByTab[p]='diff'；paneOpen=false 的面板展开由组件层执行（reducer 不管持久化）

// 自动弹出、面板开（行 #12）
{ "action": { "type": "autoPopup", "path": "D:\\dsh\\a.md", "paneOpen": true } }

// detail 拉取成功（行 #19；detail 体由测试桩给最小对象即可）
{ "action": { "type": "detailReady", "path": "D:\\dsh\\a.md", "detail": { "path": "D:\\dsh\\a.md" } } }
```

action 全集与字段：`view{path,view,isMd}`、`open{path}`、`close{paths:[]}`、`autoPopup{path,paneOpen}`、`firstSeen{path}`、`follow{path}`、`detailReady{path,detail}`、`detailFailed{path}`。

---

## 5. action 分发点与映射清理全入口（T2 施工清单）

activeTab/openTabs 的全部 10 个变更入口（审查 grep 证实）与处理：

| 入口 | 位置 | 分发/清理 |
|---|---|---|
| openFile 激活已存在标签 | `client.js:2237` | 无迁移（#10） |
| openFile 新标签落地（readFile 异步回调内） | `client.js:2258-2263` | `open{path}`（#9），**这是「首次打开默认 editor」唯一落地处** |
| TabBar 点标签 | `client.js:3395-3405` | 无迁移；**删除 3397 的 setDiffDetail(null)** |
| 正牌关单标签（关后内部转 TabBar 选中 3415） | `handleTabClose` 3408-3418 | `close{paths:[被关p]}` |
| 关闭其他标签 | `handleCloseOthers` 3423-3432 | `close{paths:被关掉的全部}` |
| 关闭全部标签 | `handleCloseAll` 3433-3437 | `close{paths:全部}`（清空两映射） |
| 文件树单个删除（过滤 openTabs、改 activeTab） | `client.js:2996-3010`（过滤 3007-3008） | `close{paths:[被删p]}` |
| 文件树批量删除 | `client.js:990-1009`（过滤 994-997、activeTab 1001-1002） | `close{paths:被删全部}` |
| 重命名旧路径 | host 配对后旧项移出 files（`index.js:1598-1600`），client 无事件 | 旧标签仍开着→旧键随标签存活；标签关闭时 #11 清理；groups GC（4.4）兜底。**不产生同一标签两键**（审查第 9 章 #3 已证实） |
| groups 刷新孤儿 GC | applyGroups 内新增 | 按 4.4 保守 GC 规则清 detailByPath |

自动通道分发点：pendingChange 消费（2610-2620）→ `autoPopup`；首见（2632-2637）→ `firstSeen`；follow（2638-2655）→ `follow`；detail effect 成功/失败（2725/2729-2735）→ `detailReady/detailFailed`；基线 tick 重拉成功同走 `detailReady`；stepFile（2744-2748）与行点选（2766-2768）→ `view:diff`+打开标签；onDiffClose（3517-3519）→ `view:editor`。

---

## 6. 实施任务拆分

| 任务 | 内容 | 依赖 | 完成判定（客观信号） |
|---|---|---|---|
| T1 | 新增具名纯函数 `reduceViewState`（4.6）；新建 `_test_view_mode.mjs`，先覆盖第 8 章用例矩阵 U1-U14 | 无 | ①抽取冒烟：`new Function` 实例化 reducer 成功、空/未知 action 返回原引用；②`node _test_view_mode.mjs` 退出码 0 且末行含 `合计 N 项，通过 N，失败 0`（与既有测试模板一致，`_test_openfile_dedup.mjs:83`） |
| T2 | `SideCoderPanel` 接入 `viewByTab/detailByPath`（useReducer）；按第 5 章在 10 个入口接分发与清理；删除 3397 清 detail；移除 onAutoOpen（2653/3543）；顺手修正 3332 陈旧注释 `_pendingChangeId→_pendingChangePath` | T1 | `node --check lib/client.js` 退出码 0 无输出；U 矩阵全绿 |
| T3 | EditorPanel 渲染门与 CSS 改读单一视图枚举（data 属性由 view 推导）；segmented 按钮组（role/aria-pressed/连体样式）；loading 占位复用 2528 文案；新增 failed 失败条+重试按钮 | T2 | `node --check` 通过；第 8 章浏览器实测 B1-B6 |
| T4 | DiffPane 解耦：detail 写缓存、行点选/stepFile/基线三通道分流、重挂反初始化不重复 RPC、groups GC；自动弹出/首见/follow 分发显式 action（#12-16） | T2 | U 矩阵全绿；`node --check` 通过；浏览器实测 B1-B6 全部符合；**不以 debug-events.jsonl 为信号**（该账本仅 host 侧 `lib/index.js:889-896` 可写，本次不改 index.js） |
| T5 | README 更新：第 9 行（◀▶=文件翻页措辞）、10/11（三自动通道语义）、22-25（对比=视图切换、面板开合归标题栏、预览复位精确化）、35（数据源不变，确认描述仍准） | T3、T4 | README 每条表述与 4.2 决策表可逐条对照（人工核对表随 PR 说明列出） |
| T6 | 全量回归；6 profile 部署拷贝（覆盖前手工备份+回滚命令）；3099 隔离实例端到端实测 | T1-T5 | 见第 8 章 8.3/8.4 |

---

## 7. 不做什么（范围控制）

- 不改 `lib\index.js`（改动记录器、多手牌配对、环形 200 条、appendDebug 黑匣子均不动）。
- 不重构 Vditor 取数（`readContent` 1715-1729）、不实现相对路径图片（README:31 维持）。
- 不做视图状态跨页面重载持久化（保持临时语义；重载后行为由首见 #14 定义）。
- 不引入新 npm 依赖、不引入构建步、不改 localStorage key。
- 不改「弹出 / 列表 / 跟随」三个开关的现有语义。

---

## 8. 验证方案（全部绑定客观信号；负结果一律记 `VERIFY-FAIL:<检查名>` 并阻断后续）

### 8.1 自动化命令与正信号（工作目录 `D:\dsh\dsh-side-coder`）

| 检查 | 命令 | 正信号 | 观测位置 |
|---|---|---|---|
| 状态机单测 | `node _test_view_mode.mjs` | 退出码 0；末行 `合计 N 项，通过 N，失败 0` | 终端 stdout |
| 既有回归 1 | `node _test_openfile_dedup.mjs` | 退出码 0；`合计 9 项，通过 9，失败 0` | 终端 |
| 既有回归 2 | `node _test_tab_dedup.mjs` | 退出码 0；`合计 13 项，通过 13，失败 0` | 终端 |
| 语法 | `node --check lib/client.js` | 退出码 0、无任何输出 | 终端 |

审查时基线实测（2026-10-11）：上述四个检查在未改动代码上已全绿，SHA256 `777DA54F32F2F6831417FB60CD05F3BE25C58F9881B8F7044227B6A5B7D3C9B1`。

### 8.2 reducer 单测用例矩阵（与 4.2 表行号一一对应）

- U1（#5/#7/#19，现象 1/3）：editor+d ready，点预览→preview 且 d 保留；再点对比→一步回 diff，不经过 editor。
- U2（#9/#10/#12/#14，现象 2）：A 经 autoPopup 为 diff；新标签 B `open`→editor；B 点预览→preview；切回 A（无迁移）→A 仍 diff。
- U3（#8）：preview 再点预览→editor。
- U4（#4）：非 md，`view:preview` 返回原 state、无新键。
- U5（#12/#13）：autoPopup 在 paneOpen=true 时写 diff；false 时不写视图键。
- U6（#14）：firstSeen 对无键 p 写 diff；对已有键（含显式 editor/preview）不覆盖。
- U7（#15/#16）：follow action 无条件按入参写 diff（门控在组件层，用例只验证 reducer）；follow=false 场景无 action 分发时状态不变。
- U8（#17）：同 p 连续 detailReady（baselinePos 不同）原地替换，视图保持 diff。
- U9（#18）：stepFile 换 p→q：q 无缓存→viewByTab[q]=diff、detailByPath[q] 不伪造 ready；来源 p 视图键不变。
- U10（#11）：`close{paths}` 批量删除两映射键；closeAll 传全部路径后两对象为空。
- U11（#20/#21）：detailFailed→failed 记录且视图回 editor；退出对比→editor 但缓存保留。
- U12（重挂反初始化，4.4）：同一五字段 key 的 detailReady 重放不产生第二个写动作（组件层去重由现有 key 机制保证，状态层断言 detailByPath[p] 引用/内容不被重复覆盖）。
- U13（GC，4.4）：groups 刷新后，不在 openTabs 且不在 changes 的 detail 键被删；仍打开的标签键与全部 viewByTab 键保留。
- U14（#22 兜底）：未知 type、缺 path 的 action 返回原 state 引用（`===`）。

### 8.3 部署与回滚（T6）

截至 2026-10-11 实测，含 `node_modules\dsh-side-coder\lib\client.js` 的 profile 恰为 6 个：`web`、`bili-test`、`dshcontext-test`、`tap-retire-qoder`、`tap-retire-trae`、`tap-retire-workbuddy`（基目录 `C:\Users\Administrator\.dsh\profiles\`；govsmoke/headless/test-subagent 无拷贝）。各 profile 另有宿主自动目录 `.dsh-shadowed-copies-backup\dsh-side-coder\`（时间戳备份，触发时机不由本插件控制，仅作辅助回滚源）。

本次采用**显式手工备份**，不依赖 shadow 机制：

1. 覆盖前把 6 份旧文件复制到 `D:\dsh\dsh-side-coder\rollback\client-<yyyyMMdd-HHmm>-<profile>.js`，逐份校验字节数=178668（改动后以新基线为准，备份的是覆盖前版本）。
2. 复制仓库 `lib\client.js` 覆盖 6 份拷贝。
3. 比对：6 份 SHA256 与仓库新文件逐一相等（正信号：6 行哈希全等）。
4. 回滚命令（一行，按需）：`Get-ChildItem 'C:\Users\Administrator\.dsh\profiles\*\node_modules\dsh-side-coder\lib\client.js' | ForEach-Object { Copy-Item "D:\dsh\dsh-side-coder\rollback\client-<时间戳>-$($_.FullName -split '\\profiles\\' | Select-Object -Skip 1 -First 1).js" ... }`——实际执行时以 T6 记录的逐 profile 备份路径为准（实施时写一个 6 行映射的 `rollback.ps1` 落盘到 rollback 目录，禁止临场拼管道）。

### 8.4 3099 隔离实例浏览器实测

前置（插件隔离测试既有做法）：

```powershell
& 'D:\dsh\node_modules\.bin\dsh.cmd' --profile bili-test --no-open --port 3099
```

后台启动、精确 PID 落盘 `D:\dsh\logs\side-coder-3099.pid`、≤10s 轮询 stdout；正信号=打印带 token 的 URL（`http://127.0.0.1:3099/?token=<TOKEN>`）且无插件加载错误。浏览器必须用完整 token URL。降级：3099 起不来时，不在 3080 生产实例上做破坏性验证；改为先定位启动错误，确认无法当日恢复时向用户报告并暂停浏览器实测（自动化 8.1/8.2 信号仍有效）。

实测项（仅允许浏览器语义点击，禁止坐标模拟鼠标）：

- B1：触发文件改动→自动弹出直跳 diff；点「预览」**立即**切换（现象 1 消除）；预览中 diff 数据不丢，点「对比」一步回 diff。
- B2：diff 中打开另一个 md B→B 为普通编辑态；B 点预览才预览；切回 A→A 仍 diff（现象 2 消除）。
- B3：预览/对比任一时刻至多一个高亮；取消预览后点一次对比即回 diff，无需 toggle 重挂（现象 3 消除）。
- B4：非 md 文件预览置灰；◀▶ 在改动文件间切换且目标标签进 diff；基线 ⏮↖↘⏭ 原地换版本、视图稳定。
- B5：follow 灭时新改动不抢当前视图（只 flash）；follow 亮时新改动接走到 diff（#15/#16）。
- B6：`changePaneOpen=false`（面板标题栏关闭并刷新页面确认持久化）时新改动只弹标签不进 diff；页面重载后首见自动呈现最新改动 diff（#14）。
- B7：删除一个打开中的文件、关闭其他/全部标签后，重复同名打开走「首次打开默认 editor」（验证孤儿清理）。

---

## 9. 审查待核实项证实结果（独立审查已全部闭环）

1. 打开不在改动列表的 md B 的完整路径：已证实——applyGroups 不读被打开文件；B 显预览是 activeDiff 同路径派生门（3407）失效，diffDetail 清空发生在切回 A 的 handleTabSelect（3397）。本版 2.4 已按此修正。
2. 空态/失败 UI：空态文案在 2771、载入文案在 2528，均无独立组件；失败态当前不存在，本方案显式新增（4.1/ T3）。
3. renamedFrom：host 配对后旧路径移出 files（index.js:1598-1600），不产生两键，只产生随旧标签存活的孤儿键，由 #11 与 GC 兜底（第 5 章）。
4. follow 与 pendingChange：pendingChange 消费（2610-2620）不受 follow 门控；follow=false 仅抑制 2638-2655。决策表 #12/#15/#16 已分行。
5. setDiffOpen/TOGGLE_DIFF_OPEN 全量调用点：仅 3479（头部按钮）与 3543（onAutoOpen）；移除 onAutoOpen 安全（4.3）。

---

## 10. 风险与回滚

| 风险 | 影响 | 缓解 |
|---|---|---|
| 改 localStorage key | 面板开关记忆丢失 | key `TOGGLE_DIFF_OPEN`（149）原样保留 |
| reducer 误引自由变量 | 抽取测试 ReferenceError | 4.6 硬边界；T1 第一信号即抽取冒烟 |
| DiffPane 重挂/follow 与 detailByPath 双写不一致 | 重复 RPC 或旧 detail 覆盖新 | 五字段 key 去重保留；U8/U12/U13；B4/B5 |
| 移除 onAutoOpen 后闪跳面板不可见 | follow 体验变化 | 代码事实：调用时面板必已挂载（2653 在 DiffPane 内）；B5 验证 |
| 单文件 3901 行手工 React.createElement 接入 | 渲染回归 | 每任务后 `node --check`；T2/T3/T4 分批小改；B1-B7 回归 |
| 6 拷贝部署出错 | 各 profile 白屏/旧行为 | 8.3 显式备份+逐 profile 回滚脚本；先 3099 验证再同步 web |
| Vditor 取数前提被破坏 | 预览内容不符合 README:35 | 挂载 path 前提不动；T5 人工对照第 35 行 |

---

## 11. 术语表（同义异名映射）

| 术语 | 曾用名/代码名 | 含义 |
|---|---|---|
| 改动列表面板 | DiffPane / 对比区 / 对比面板 | 展示被改动文件列表、◀▶ 文件翻页、会话分组的子组件，挂载受 `changePaneOpen` 控制 |
| 对比视图 | diff overlay / DiffOverlay | 编辑器区内红删绿增的全屏 diff（含基线工具条） |
| 面板开关 | `diffOpen` / `changePaneOpen` / `TOGGLE_DIFF_OPEN` | 改动列表面板是否挂载（持久化） |
| 视图模式 | `viewByTab`（新增） | 编辑器区 editor/diff/preview 三态之一，每标签一份 |
| diff 数据缓存 | `diffDetail`（旧易失单值）/ `detailByPath`（新） | 文件的手牌 diff 内容与 loading/ready/failed 状态 |
| 手牌 | hand / change record | host 侧环形 200 条缓冲中的单版本改动记录（README:39「多手牌配对」） |
| 基线导航 | ⏮↖↘⏭ / baselinePos / handleBaseline | 同一文件内沿改动链移动基线（2501-2524），p 不变 |
| 文件翻页 | ◀▶ / stepFile | 在被改动文件之间循环跳转（2744-2748、2772-2784），p 改变 |
| 首见 | firstSeen / lastSeenRef===null | DiffPane 本页生命周期第一次拿到改动数据时自动选中最新文件（2632-2637） |
| 跟随 | follow / _autoselectAck | 面板已开时新改动自动跳到最新文件（2638-2655），受「跟随」开关控制 |

---

## 12. 症状→章节反向索引（R14）

| 症状/报错 | 机制 | 修复条目 |
|---|---|---|
| 点预览按钮亮但界面不变 | 2.3 渲染门 `!diffDetail`；D3 | 4.2 #5、4.3、T3；U1、B1 |
| 打开别的 md 再回来，原文件变成预览 | 2.4 activeDiff 派生门 + 3397 清空；D1/D2 | 4.2 #9/#10、4.4、T2；U2、B2 |
| 取消预览后 diff 回不来，要重亮对比 | 2.4/2.6 detail 易失、靠重挂重建；D2 | 4.1 缓存、4.4 反初始化；U1、B3 |
| 重载后不再自动显示最新改动（改造回归风险） | 首见通道 | 4.2 #14、4.5 决策 A；U6、B6 |
| follow 开关行为被改坏 | follow 通道 | 4.2 #15/#16、4.5 决策 B；U7、B5 |
| 关标签/删文件后状态串台 | 10 个入口 | 第 5 章、4.4 GC；U10/U13、B7 |
| 测试 ReferenceError: toAbs is not defined | reducer 自由变量 | 4.6 硬边界；T1 抽取冒烟 |
| 正信号串缺失但退出码 0 | 模板不一致 | 8.1 中文模板（`_test_openfile_dedup.mjs:83`） |

---

## 13. 计划书自查清单（原子问句，逐条可勾；依据 llm-doc-writing-standard）

- [ ] 三个用户现象是否都能在第 2 章定位机制、在 4.2 表定位修复行、在第 8 章定位用例与实测项？〔R14/R22〕
- [ ] 4.2 表 22 行是否两两互斥、条件穷尽、含 #22 兜底行？〔R25/R27〕
- [ ] 表中是否已无「尽量/适当/可选」类无判据措辞（进度纹触发条件已写死）？〔R49/R7〕
- [ ] 每条验证是否都给出命令+正信号串+观测位置，且负结果有 `VERIFY-FAIL` 固定标签？〔R31〕
- [ ] 全部代码事实是否带行号与来源标签，且 v0.1 被审查推翻的两处（现象 2 时序、导航身份/签名字段）已改正？〔R47/R21〕
- [ ] reducer 是否零自由变量、action.path 预归一、具名函数声明可被现有抽取正则命中？〔R40 可测试性〕
- [ ] 高危前置（localStorage key 不动、不改 index.js、6 拷贝备份回滚、3099 token URL）是否全部在施工前写明？〔R24/R52〕
- [ ] 第 5 章 10 个入口是否与代码行号一一对应、无遗漏（grep 可复查）？〔R6〕
- [ ] 术语表是否覆盖手牌/基线导航/文件翻页/首见/跟随及全部新旧命名？〔R34/R35〕
- [ ] 第 7 章范围排除是否与用户总目标无关项一致、无夹带优化？〔目标锚定〕
- [ ] README 需改行（9/10/11/22-25/35）是否逐条列出且 T5 有核对动作？〔R5〕
- [ ] 兜底核对：逐条核对本清单与第 12 章索引引用的全部规则编号/文件路径，任一未覆盖即返回补查。〔R13〕
