# side-coder 三视图改造计划书 独立审查报告（v1）

- 审查对象：`docs/side-coder-view-mode-plan.md`（v0.1，2026-10-11，264 行）
- 被审代码：`lib/client.js`（178668 字节 / 3901 行，审查时实测一致）、`lib/index.js`（1635 行）、`README.md`（43 行）
- 审查方法：逐条打开计划书所引行号亲验；grep 枚举全部相关调用点；实跑 `node --check` 与两个既有抽取测试；实查 6 个 profile 部署拷贝 SHA256；按 `llm-doc-writing-standard` R1–R55 核对
- 审查日期：2026-10-11
- 审查者：独立审查子代理（只审不改，未修改任何代码）

---

## 0. 审查结论总评

**结论：需修改后执行。**

改造方向（引入 `viewByTab` 单一视图事实源、`detailByPath` 数据/视图解耦、segmented 互斥按钮、纯函数 reducer + 抽取式单测）正确，第 2 章绝大多数〔代码取证〕经逐行亲验属实，三个用户现象的根因定位与用户猜测一致，纯函数抽取路线在现有测试基建下技术可行。

但计划书存在 **3 条阻断问题（P0）**：决策表遗漏「跟随」持续通道、把基线按钮误当 ◀▶ 手牌导航导致漏掉一条真实状态迁移通道、T4 完成信号在「不改 index.js」约束下物理上不可达成。另有 12 条应改问题（P1，含一处现象机制叙述错误、reducer 抽取依赖矛盾、多处映射清理入口遗漏、部署无回滚等）。未修正 P0 前开工，实施者必然在二义点上自行裁量，且 T4 无法按其完成判定验收。

实跑环境事实：`node --check lib/client.js` 退出码 0；`_test_openfile_dedup.mjs` 9/9、`_test_tab_dedup.mjs` 13/13 全绿；6 个 profile 部署拷贝 SHA256 与源文件**当前完全一致**（哈希 `777DA54F…D3C9B1`）。

---

## 1. 阻断问题（P0，必须改后再执行）

### P0-1 决策表遗漏「跟随（follow）持续通道」，与 README 既有承诺冲突

- **问题**：4.2 决策表只有「自动弹出命中」行（受 `changePaneOpen` 门控），但代码里存在第二个独立的自动跳转通道——DiffPane 的 follow 分支，决策表对它无任何行覆盖。
- **证据**：
  - follow 自动选中：`lib/client.js:2638-2655`，`props.follow && state._autoselectAck !== top.path` 时执行 `setSelectedPath(top.path)`（2648）、`setFlash`（2649）、`props.onAutoOpen()`（2653）。
  - 现状下 selectedPath 变化经 detail effect → `onDetailChange` → `handleDiffDetail`（`lib/client.js:3345-3353`），后者不仅写 diff，还 `state._selectChangePath = detail.path` + `state._openFile(...)`（3350-3351），即 follow 命中会**强切活动标签并进入 diff 视图**。
  - `README.md:11` 承诺：「『跟随』亮着时对比区自动跳最新改动，点灭后手动翻」。
  - 4.4 只规定「在列表点选文件 = setView(path,'diff')」，未规定 follow 的自动 `setSelectedPath` 是否发 `setView`；决策表（计划书 116-131 行）无 follow 行。
- **后果**：实施时二义分叉——若 follow 自动选中也 `setView('diff')`，则用户正在预览/编辑时会被新改动抢走视图（现状即如此，但新模型是否保留无定论）；若只写 `detailByPath` 不切视图，则「跟随」名存实亡，违反 README:11。违反 R25（条件不穷尽）/R27（无显式默认）。
- **建议改法**：4.2 增行，至少覆盖：①面板已挂载、`follow=true`、新改动到达且非 foreignTop（2643-2645 同源门控保留）；②`follow=false`。明确每行是否写 `viewByTab[top]='diff'`、是否切活动标签；并在 7.1 增对应用例（follow 开/关两态）。

### P0-2 ◀▶ 手牌导航与基线按钮身份认错、行号张冠李戴，漏掉 stepFile 换文件迁移通道

- **问题**：4.4（计划书 145 行）写「◀ ▶ 历史手牌导航（`client.js:2504-2519`、刷新序号 `client.js:3297`）：拉到新手牌后原地更新 `detailByPath[p]`，视图保持 diff」。`2504-2519` 实际是 **DiffOverlay 内的基线按钮**（⏮到最初 / ↖后退 / ↘前进 / ⏭到最新，基于 `detail.baselinePos/chainLength`），不是 ◀▶；◀▶ 在 DiffPane 列表头（`lib/client.js:2772-2784`），行为是 `stepFile`（`lib/client.js:2744-2748`）在**被改动文件之间循环跳转**。
- **证据**：
  - `lib/client.js:2501-2524`：四个按钮文案为「到最初/后退/前进/到最新」，`disabled` 条件绑 `baselinePos`/`chainLength`（2504、2509、2514、2519），回调为 `onRetreatStartBaseline` 等；对应 `handleBaseline`（3360-3378）→ `setBaselineTick` → DiffPane effect 因 `pollTick` 重订阅（依赖数组 2675）。
  - `lib/client.js:2744-2748`：`stepFile(delta)` 对 `fileChanges` 取模换索引并 `setSelectedPath(fileChanges[next].path)`——换的是**文件**（即 key 里的 p），不是同一文件的手牌版本。
  - `lib/client.js:2775-2783`：◀（stepFile(1)）、▶（stepFile(-1)）。
  - stepFile 换 selectedPath 后同样经 `handleDiffDetail`（3349-3351）`_openFile` 强切活动标签。
- **后果**：「原地更新 `detailByPath[p]`」对 stepFile 场景是错误设计（p 本身变了）；新模型必须决定 ◀▶ 是「仅换 DiffPane 选中行并写 `detailByPath[next]`」还是「同时 `setView(next,'diff')` 并打开标签」。若按计划书原文实施，◀▶ 将不再驱动编辑器区跳转，违反 `README.md:9`（「◀ ▶ 可翻历史改动」）。基线按钮通道（同 p、baselinePos 变、key 变重拉）反而未被计划书描述。
- **建议改法**：4.4 拆成两条独立迁移：①基线 ⏮↖↘⏭（2504-2524 + handleBaseline 3360-3378 + baselineTick 3297-3298/3536）：p 不变、原地替换 `detailByPath[p]`、视图保持 diff；②◀▶（stepFile 2744-2748、按钮 2775-2783）：定义其对 `viewByTab` 与活动标签的动作（建议：打开/切换目标标签并 `setView(next,'diff')`，沿用现状 `_openFile` 语义），并各配测试用例。

### P0-3 T4 完成信号「debug-events.jsonl 可见显式视图动作」在约束下不可达成

- **问题**：T4（计划书 175 行）完成判定写「`debug-events.jsonl` 弹出链可见显式视图动作」；第 6 章同时声明「不改 `lib/index.js` 后台半边」。client 端没有任何写该黑匣子的通道。
- **证据**：grep `debug-events|appendDebug` 全仓：写入函数 `appendDebug` 仅定义于 `lib/index.js:889-896`，全部 11 处调用点均在 `lib/index.js`（1040、1059、1076、1089、1123、1129、1620、1624、1628 等 host 侧）；`lib/client.js` 零命中。`README.md:43` 也说明它是后台账本。
- **后果**：实施者只有两条路——越界改 index.js 新增 RPC/埋点（违反第 6 章范围），或在没有该信号时宣称 T4 完成（伪造验证，违反 R31「验证只有证据/固定缺失标签两态」）。
- **建议改法**：二选一并落字：①把 T4 客观信号改为 client 侧可观测信号（如 `_test_view_mode.mjs` 对 reducer `autoPopup` action 的断言 + 浏览器实测 7.2 的具体现象断言）；②若确需黑匣子，显式把「index.js 增加一条视图动作埋点 RPC」纳入范围并同步修改第 6 章与 T6。

---

## 2. 应改问题（P1）

### P1-1 第 2.4 节「现象 2 机制」的因果叙述与代码不符（R47）

计划书 68 行称「打开 md 文件 B 后发生标签切换，`handleTabSelect` 清空 `diffDetail`，B 又无 diff 数据，`preview=true` 首次真正生效；切回 A 时 `diffDetail` 已被清空」。实测：

- 文件树打开 B 走 `handleFileOpen`（`lib/client.js:3379-3390`）→ `state._openFile(filePath)`（3389）；`state._openFile` 就是 `openFile`（2311 行赋值，定义 2233-2271），`openFile` **不调用 `handleTabSelect`、不清 `diffDetail`**。
- B 期间父组件 `diffDetail` 仍为 A；B 之所以显示预览，是 `activeDiff` 派生门失效：`lib/client.js:3407` `samePath(toAbs(diffDetail.path), toAbs(state.activeTab))` 在 activeTab=B 时为 false → 传给 EditorPanel 的 `diffDetail`（3513）为 null → 预览门（2318/2321，`preview && … && !props.diffDetail`）解除。
- `setDiffDetail(null)` 实际发生在**切回 A 时**点 TabBar → `handleTabSelect`（`lib/client.js:3395-3405`，3397 行清空）；此后 DiffPane 的 `selectedPath` 仍是 A、签名 key 未变（2695-2696 去重），不重发，A 只剩预览。

修复方向不受影响，但机制描述必须改正，否则 T4 实施者会去错误的链路上插 action。建议改为上述时序，并把标签区分为「openFile 直接改 activeTab（2237/2253/2263）」与「TabBar 走 handleTabSelect（3395）」两个入口。

### P1-2 reducer 抽取的依赖矛盾未解决：`toAbs` 与 state 形状冲突

- 4.6 规定 reducer 的 `state = { viewByTab, detailByPath }`，4.1 规定映射 key = `toAbs(path)`；但 `toAbs` 依赖模块级 `state.root`（既有测试 `_test_openfile_dedup.mjs:23` 必须构造 `state.root` 并把 `toAbs` 等 8 个函数一并抽取，36-40 行）。
- `extractFunction` 用 `new Function` 桩注入（测试 6-21、37-40 行），被抽函数引用的任何自由变量都必须在形参表或同批抽取的函数体内有定义，否则 `ReferenceError`。reducer 若内部调 `toAbs`，而其收到的 state 没有 `root` 字段，则归一得到 undefined；若改读模块级 state，桩环境不存在该绑定。
- **建议**：4.6 显式规定「action.path 由调用方预先 `toAbs` 归一，reducer 零外部 helper 依赖、零自由变量」，或把 `root` 纳入 reducer state 并在测试中连同 `toAbs` 依赖链（normalizeSeparators/stripDotPrefix 等）整批抽取；同时写明测试需共抽的函数名清单（照 36 行模式）。

### P1-3 T1 正信号串与既有测试模板不一致（R31）

计划书 172、199 行要求 stdout 含 `N/N passed`；既有两个测试的实际正信号是中文 `合计 N 项，通过 N，失败 0`（`_test_openfile_dedup.mjs:83`、`_test_tab_dedup.mjs` 同构），且退出码语义已在 84 行 `process.exit(failed.length===0?0:1)`。若新测试「沿用现有抽取模式」（164 行）却要求英文串，会出现测试全绿但正信号串缺失的自我矛盾。建议统一为 `合计 N 项，通过 N，失败 0` + 退出码 0。

### P1-4 `openTab`/`select` action 与 openFile 异步链的对接点未定义

决策表区分「已开过标签→原值」「首次打开→editor」（126-127 行），但没写 action 在哪里分发。`openFile` 对新标签是异步的：`readFile` RPC 返回后才 push tab 并设 activeTab（`lib/client.js:2248-2265`）；`handleFileOpen`/`handleTabSelect` 在同步段调用时标签可能尚未建立。需明确：`openTab` 在 2258-2263（新标签落地）分发、`select` 在 2237（已存在）与 3395-3404（TabBar）分发，否则「首次打开默认 editor」无处落地。

### P1-5 viewByTab/detailByPath 清理入口遗漏多处

决策表只有「关闭标签 q」单行（128 行），T2 也只写「标签关闭时清理」。实测 activeTab/openTabs 共有 10 个变更入口，以下不经过 `handleTabClose`：

- 文件树单个删除：`lib/client.js:2996-3010`（过滤 openTabs、3007-3008 改 activeTab）。
- 文件树批量删除：`lib/client.js:990-1009`（994-997 过滤、1001-1002 改 activeTab）。
- 关闭其他标签：`handleCloseOthers` 3423-3432。
- 关闭全部标签：`handleCloseAll` 3433-3437。
- （正牌单关：`handleTabClose` 3408-3418，关活动标签后内部转 `handleTabSelect` 3415。）

不补清理则两映射累积孤儿键（文件已删/标签已关，视图记忆仍在），且「首次打开默认 editor」对同名重建文件会被旧键污染。建议 T2 列出全部入口的清理/分发动作并配测试。

### P1-6 页面重载 / DiffPane 首见的行为回归未评估、无决策行

现状：`diffDetail` 不持久化，但重载后 `diffOpen` 从 localStorage 恢复（默认 true），DiffPane 挂载 → applyGroups 首见分支（`lib/client.js:2632-2637`）`setSelectedPath(top.path)` → detail effect 回发 → `handleDiffDetail` 连带 `_openFile`（3349-3351），用户重载后仍会落到最新改动的 diff。4.4 规定新链「拉取成功只写 `detailByPath`，不再驱动视图切换」，而 `viewByTab` 不持久化（4.1/188 行）→ 重载后首见只填缓存、视图恒为 editor、对比灯灭。这是相对现状的**静默回归**，决策表无「DiffPane 首见」行，7.1 无用例，T5 README 改写未提。需显式产品决策（首见是否写视图意图），并同步 README:10/25 与测试。

### P1-7 `onAutoOpen`（3543）拆分后归属未定，与决策表正面冲突

`lib/client.js:3542-3544`：`onAutoOpen: function() { setDiffOpen(true); }`，由 follow 分支 2653 调用——**运行时强制翻开面板但不写 localStorage**。决策表 130 行规定 `changePaneOpen===false` 时自动弹出「只弹面板/标签」不进 diff；4.3 又规定头部对比按钮不再承担面板开合。改造后此回调若保留旧行为，follow 命中仍会绕过用户点灭状态强开面板；若删除，follow 闪跳时面板关闭无从展示。必须在 4.2/4.4 明确它的新动作（建议：仅当 `autoPopup`/follow 组合允许时写 `viewByTab`，面板开合严格只听 `changePaneOpen`）。

### P1-8 「3099 独立实例」为悬空环境指令（R3/R52）

7.2（216 行）与 T6（177 行）要求「3099 独立实例实测」，但全文无该实例的启动命令、URL、profile 对应关系（本机 grep 仓库全部 md，`3099` 零命中）；也无「3099 不可用时用什么替代」。审查任务背景虽提及 3099，但计划书自身必须自足。建议补启动步骤或改为可核验的通用浏览器实测前置。

### P1-9 6 拷贝部署无回滚步骤，未利用/说明既有 shadow 备份机制（R24）

- 6 个目标清单本身准确：实测 `C:\Users\Administrator\.dsh\profiles` 下仅 `web`、`bili-test`、`dshcontext-test`、`tap-retire-qoder`、`tap-retire-trae`、`tap-retire-workbuddy` 存在 `node_modules\dsh-side-coder\lib\client.js`（另 4 个目录 govsmoke/headless/test-subagent/node_modules 无此拷贝）；6 份 SHA256 现与源完全一致。
- 但 T6 只有「同步 + 哈希比对」，无覆盖前备份/回滚动作。实测每个 profile 下存在宿主机制目录 `.dsh-shadowed-copies-backup\dsh-side-coder`（6 个 profile 均有，内含时间戳备份），计划书风险章完全未提该机制：未写明它是否备份 `lib/client.js`、回滚时从目录取件还是另行手工备份。建议 T6 增加「覆盖前把 6 份旧文件复制到带时间戳目录 + 一行回滚命令」，或显式声明以 shadow 备份为回滚源并给出核实方法。

### P1-10 detail 签名取证不精确（不影响结论但会误导实施）

计划书 65 行称签名为 `path@lastTime@baselinePos@chainLength`（@ 分隔、四字段），引 2695。实测 `lib/client.js:2695` 为 `[meta.path, meta.sessionId||"", meta.lastTime, meta.baselinePos, meta.chainLength].join("\u0001")`——五字段、含 sessionId、用 `\u0001` 分隔。另有一处 @ 分隔签名在 542 行（`path@lastTime@count@chainLength@baselinePos@changeKind@renamedFrom`，字段又不同）。两处签名勿混用；4.4「签名 key 检查逻辑保留」应引用 2695 真实字段。

### P1-11 「手牌」未入术语表，与 ◀▶/基线关系混乱（R34/R35）

术语表（245-251 行）无「手牌」；145 行「历史手牌导航」所指与 `README.md:39`（「多手牌配对、环形 200 条」）无法对应到具体控件。与 P0-2 同源，建议术语表补：手牌（环形缓冲中的单版本记录）、基线导航（⏮↖↘⏭/baselinePos）、文件翻页（◀▶/stepFile）三个条目。

### P1-12 单测用例 1–7 覆盖不穷尽

7.1 用例（208-214 行）未覆盖：follow 开/关自动跟随（对应 P0-1）、◀▶ 换文件（P0-2）、文件树删除/closeOthers/closeAll 的孤儿清理（P1-5）、DiffPane 重挂反初始化不重复 RPC（4.4 承诺，用例 7 只断言状态层去重，未覆盖反初始化选行）、重载后首见（P1-6）。建议随决策表补行同步补例。

---

## 3. 建议项（P2）

1. **R15 索引缺失**：全文 264 行（>200 行阈值），文首无目录/编号索引；章节号本身可当骨架，但无 TOC。建议文首加 0–11 章目录。
2. **R10/R33 自查清单形式**：第 11 章 8 条均为陈述句而非「是否……」动作化问句；多条含两个断言（如 257 行同时覆盖第 2/4 章映射、264 行同时查悬空文件与术语覆盖），无法逐项打勾。建议拆成单断言问句。
3. **R13 兜底项**：264 行「兜底核对」近似但不是标准措辞（「逐条核对全部规则编号，任一未覆盖即补查」），且其自身漏锚 R15、R40、R52 等。
4. **R25 单元格单信息**：119 行「展开面板；触发 DiffPane 选中该文件拉取；失败回 editor」一格三动作，建议拆「其他效果」为多行或子条。
5. **R49 模态灰区**：137 行「（可选加小型进度纹）」——「可选」无判定条件，与自查 259 行「无『尽量/适当』类措辞」自我声明不符。建议删除或给出触发条件。
6. **R40 无真实样例**：4.6 给了 action 字段清单但无一份真实 JSON 样例（初始 state、select/detailReady/autoPopup 各一），T1 编写者仍需猜键名与枚举值字面量。
7. **陈旧注释同名问题**：`lib/client.js:3332` 注释写 `_pendingChangeId`，实际通道名是 `state._pendingChangePath`（744/754/2611）。实施到该 effect 时顺手修正，避免 grep 断链（R34 精神）。
8. **DiffPane 空态与失败态复用结论**（对应待核实项 2）：空态已有文案「本次会话还没有文件改动」（`lib/client.js:2771`），无独立空态组件；DiffOverlay 仅有载入文案「对比内容生成中…」（2528），**无拉取失败 UI**（失败走 `onDetailChange(null)` 静默回退，2732-2735）。4.1 承诺的「一次性错误提示」需新增，无现成件可复用——计划书写法不应暗示可复用。
9. **Vditor 取数解耦提醒**：`readContent`（`lib/client.js:1715-1729`）依赖 `props.path === state.activeTab`（1725 `samePath`），预览门改造后须保证 VditorPreview 仍只以 activeTab 为 path 挂载（现 3515 `previewPath: state.activeTab`），否则 README:35 的取数优先级（实测与 README 一致）会被破坏。
10. **部署清单加注枚举时点**：profiles 目录另有 govsmoke/headless/test-subagent/node_modules 四个目录无插件拷贝，清单准确但建议注明「截至 2026-10-11 实测仅此 6 份」，避免日后新增 profile 时漏同步。
11. **R52 前置声明**：Node 版本、浏览器宿主、3099/3080 实例关系等环境前置未集中声明。
12. **计划 74 行 pending 引用只写 743/744**：新改动分支的第二份写入在 753/754，建议补行号以免实施时只改首见分支。

---

## 4. 第 8 章「待核实清单」逐条证实结果

| # | 待核实项 | 结论 | 代码证据 |
|---|---|---|---|
| 1 | 打开不在改动 groups 的 md B 时 applyGroups 完整路径，B 为何不产生 detail | **已证实，且推翻计划书 2.4 叙述**（见 P1-1）。applyGroups 不读被打开文件：B 打开后 activePath 变化只触发 effect 重订阅（依赖含 `props.activePath`，2675）→ `feed.refreshNow()`（2670）→ applyGroups；`_pendingChangePath` 已消费为空（2610-2612）、`_selectChangePath` 未设（handleFileOpen 3381-3384 match 失败）、`lastSeenRef.current===1` 非 null（2633 不命中）、follow 分支因 `_autoselectAck===top.path` 不动作（2638/2647）→ selectedPath 保持 A；detail effect 依赖 [selectedPath, fileChanges]（2736）两引用均不变 → 不重发（2696）。B 显预览是 activeDiff 同路径派生门（3407）失效，**非 diffDetail 被清空**；清空发生在切回 A 的 handleTabSelect（3397） | client.js:2610-2655、2675、2695-2696、3379-3390、3407、3395-3405 |
| 2 | DiffPane 空态 UI；载入/失败提示复用还是新增 | **已证实**：有空态文案无组件（2771）；载入文案在 DiffOverlay 2528；失败无 UI、静默 null（2729-2735）。失败提示须新增 | client.js:2771、2528、2729-2735 |
| 3 | renamedFrom 重命名对 per-tab key 的影响 | **已证实：不会出现「同一标签两键」，但产生孤儿键**。重命名配对在 host 侧 `annotateChangeKinds`：配对后删除项从 files 移除（index.js:1598-1600），列表只留新路径项（1592-1593 写 renamedFrom）。client 无重命名事件同步，已打开的旧路径标签继续存在；新模型 toAbs 键随列表只认新路径，旧 viewByTab/detailByPath 键成孤儿（与删除同类，纳入 P1-5 清理）。另：542 行 @ 签名含 renamedFrom，2600 行扁平签名亦含，重命名配对瞬间 sig 变化会触发一次正常刷新 | index.js:1553-1602；client.js:542、2600 |
| 4 | follow 关闭与 pendingChange 选中的交互 | **已证实：pendingChange 消费不受 follow 门控**。消费分支 2610-2620 在 follow 判断（2638）之前且无 follow 条件；follow=false 仅抑制 2638-2655 的持续自动跟随。故自动弹出→选中→detail 在 follow 关闭时照常；但 follow 自身的视图动作在决策表缺行（P0-1） | client.js:2610-2620、2638-2655 |
| 5 | 对比按钮不再收起面板后，其他依赖旧行为的入口（grep 全部 setDiffOpen/TOGGLE_DIFF_OPEN） | **已枚举完全**：常量 `TOGGLE_DIFF_OPEN="diffOpen"`（149）；初始化读取（3290）；头部按钮 toggle + 写盘（3479-3480）；`onAutoOpen` 运行时置 true **不写盘**（3543）。无其他调用点。拆语义安全，但 3543 必须重定义（P0-1/P1-7） | client.js:149、3290、3479-3480、3543（grep setDiffOpen/TOGGLE_DIFF_OPEN 全量 13 命中中其余为声明与 setPreview 等无关项） |

---

## 5. 第 2 章〔代码取证〕核实结果表

| 计划书位置/声称 | 结论 | 实测证据 |
|---|---|---|
| diffOpen 在 3290、diffDetail 在 3294、preview 在 3296 | 属实 | client.js:3290（`useState(read_toggle(TOGGLE_DIFF_OPEN,true))`）、3294、3296 |
| 预览按钮 3451-3460：className 只看 preview、disabled 不看 diff、点击仅 toggle | 属实 | className 3452；disabled 3454（仅 activeTab+isMarkdownPath）；onClick 3455-3459 |
| 对比按钮 3474-3482：只 toggle diffOpen 并写 localStorage | 属实 | 3475、3478-3480；不触碰 diffDetail/preview |
| 两按钮无 role=group/aria-pressed，可同时亮 | 属实 | 3451-3499 全段为独立 button + attrs()，无分组容器 |
| 渲染门 2318-2333（data-diff-active / data-preview-active / VditorPreview 与 DiffOverlay 挂载条件） | 属实 | 2318、2321（`&& !props.diffDetail`）、2325-2333 |
| CSS 853-862：diff 时隐藏 editor；preview 默认 none，双属性真才 block | 属实 | 855、857、861-862；预览根 className 为 `dsh-cc-preview vditor-reset`（1839）与选择器匹配 |
| activeDiff 派生 3407（diffOpen && diffDetail && activeTab && samePath） | 属实 | client.js:3407 原文一致 |
| handleTabSelect 3395-3405：必清 diffDetail，仅非 md 清 preview | 属实 | 3397 无条件 setDiffDetail(null)；3400-3403 非 md 才 setPreview(false) |
| handleFileOpen 3379-3390：仅非 md 清 preview | 属实 | 3385-3388；另 3381-3384 命中改动列表时写 `_selectChangePath`（计划书未提，不影响结论） |
| detail effect 2678-2736；key 去重 2695-2696 | 行号属实，**签名描述不精确**（P1-10）：2695 为 \u0001 分隔五字段含 sessionId，非 @ 四字段 | 2678-2736、2695-2696 |
| 首见自动选中 2632-2637（lastSeenRef===null→setSelectedPath(top.path)） | 属实 | 2632-2637 |
| applyGroups 选中分支区间 2610-2655 | 属实 | pending 2610-2620、_selectChangePath 2621-2631、首见 2632-2637、follow 2638-2655 |
| handleDiffDetail 3345-3353：写 detail + _selectChangePath + _openFile | 属实 | 3345-3353 |
| onDiffClose 3517-3519：仅 setDiffDetail(null) | 属实 | 3517-3519（清空在 3518） |
| handleWatchPayload 705-757；hasSideCoderTab 690-703；pending 写 743-744 | 属实，**有漏引**：新改动分支第二份写入在 753-754（P2-12）；门控链（booting 719-724、无标签 727-730、autoPopup 739/752）均如述 | 690-703、705-757 |
| pending 消费 3325-3333 | 属实 | 3325-3333；注释中 `_pendingChangeId` 为陈旧名（实际 `_pendingChangePath`），P2-7 |
| DiffPane 挂载 3532（diffOpen 三元） | 属实 | 3532-3545 |
| ◀▶ 历史手牌导航 2504-2519、刷新序号 3297 | **不属实（P0-2）**：2504-2519 是 DiffOverlay 基线按钮（⏮↖↘⏭）；◀▶ 在 2772-2784（stepFile 2744-2748）。3297 baselineTick 注释属实 | 2501-2524、2744-2748、2772-2784、3297-3298 |
| selectedPath（DiffPane 内部，初值 null）在 2559 | 属实 | 2559 |
| SideCoderPanel「约 3280 起」 | 属实（实际 3288） | 3288 |
| renamedFrom「见 client.js:542」 | 属实 | 542（另见 2600） |
| 文件规模 178668 字节/3901 行 | 属实 | 实测一致 |
| README 第 22/23/25/31/35 行引用 | 属实 | README.md:22（对比=收起/展开对比区）、23（预览）、25（持久化+尊重点灭+预览临时）、31（相对图片不支持）、35（数据源优先级） |

---

## 6. 方案有效性推演（针对三个用户现象与边界场景）

### 6.1 三现象消除推演（按修正前的 4.2 表）

- **现象 1（diff 中点预览无响应但按钮亮）**：可消除。diff 行点预览（isMd）→ preview 且 `d` 保留（122 行）；渲染门改读 `viewByTab[p]` 单源后，DiffOverlay/VditorPreview 挂载不再存在「按钮态与门不同源」的窗口。前提：预览按钮高亮改读同一枚举。
- **现象 2（开 B 正常、回 A 变预览）**：可消除，但依赖 P1-4（openTab 分发点落地）。B 首次打开 → openTab → editor（127 行），不从 A 继承 preview；回 A → select → A 的视图记忆（自动弹出时写入的 diff，129 行）。用例 2（209 行）断言正确。
- **现象 3（取消预览后 diff 回不来，要重挂）**：可消除。preview 点对比 → d 存在则一步回 diff（124 行）；d 在 `detailByPath` 中不随切标签/切视图清空，重挂不再是恢复手段。载入/失败有显式占位与回落（110 行），消灭说谎窗口。

### 6.2 两映射在各场景的自洽性

| 场景 | 结论 |
|---|---|
| ◀▶ 手牌（实为文件翻页）切换 | **不自洽，缺设计**（P0-2）：p 改变，「原地更新 [p]」不适用，且现状会 _openFile 切标签 |
| 基线 ⏮↖↘⏭ | 自洽：p 不变、key 含 baselinePos（2695）→ 重拉替换 detailByPath[p]，diff 视图保持；计划书漏描述 |
| 文件被再次改动（新 lastTime） | 自洽：key 变 → 重拉写缓存；当前为 diff 则原地更新，当前为 preview 不被抢（合理，但需确认 follow 语义，P0-1） |
| 重命名 | 不产生两键，产生旧路径孤儿键（第 4 章 #3），须纳入清理（P1-5） |
| 关闭标签 | handleTabClose 路径自洽（T2 已覆盖）；删除/closeOthers/closeAll 不自洽（P1-5） |
| 面板开关 toggle | 自洽：缓存留父组件，重挂按 4.4 反初始化；反初始化选行规则需补测（P1-12） |
| 页面重载 | **现状行为回归**（P1-6）：映射空 + onDetailChange 不再切视图 → 重载后停留 editor，不再自动呈现最新 diff；需显式决策 |
| follow 新改动（面板已开） | **决策表缺行**（P0-1），现状强切标签+diff 的去留未定 |
| 非活动标签在后台被 follow 选中 | 现状 handleDiffDetail 会把它抢成活动标签；新模型需明确 setView 是否伴随 activeTab 切换（与 P0-1 同批定义） |

---

## 7. 可测试性核实（任务 D）

1. **抽取兼容性**：`extractFunction`（`_test_openfile_dedup.mjs:6-21`）正则 `^[\t ]*function name\(` 容忍前导 tab，client.js 内具名函数为缩进的 function 声明（如 2233 `\t\t\tfunction openFile`），**形态兼容**；要求 reducer 也写成同级具名 `function reduceViewState(...)`，不可用箭头函数/const 赋值，否则正则失配。
2. **自由变量风险（实测成立）**：既有测试必须把依赖链整批抽取（36 行 8 个函数：normalizeSeparators、stripDotPrefix、toAbs、toRel、samePath、canonicalTabPath、findOpenTab、openFile），并通过 new Function 形参注入 state/rpcCall 等（37-40 行）。reducer 若引用 `toAbs`/`isMarkdownPath` 或任何模块级常量而未共抽，Node 桩环境直接 `ReferenceError`；共抽 toAbs 又需 state.root（测试桩 23 行），与 4.6 的 state 形状冲突（P1-2）。
3. **React 依赖**：reducer 设计为纯 ES 函数、不收 React 原语，技术上可做到零 React 依赖；接入组件侧的 useReducer/分发是另一层，不影响抽取。结论：**可行但必须按 P1-2 增加依赖边界规定**，并在 T1 先跑通抽取冒烟（能 `new Function` 实例化 reducer 本身就应列为第一条客观信号）。
4. **既有基建健康度**：审查时实跑 `node --check lib/client.js` 退出码 0；`node _test_openfile_dedup.mjs` 合计 9 项通过 9；`node _test_tab_dedup.mjs` 合计 13 项通过 13。新测试可直接复用基建，但正信号串须按 P1-3 统一。

---

## 8. 部署与风险核实（任务 F）

- **6 profile 清单**：准确。实测 `C:\Users\Administrator\.dsh\profiles` 下含 client.js 拷贝的恰为 `web`、`bili-test`、`dshcontext-test`、`tap-retire-qoder`、`tap-retire-trae`、`tap-retire-workbuddy`，每份当前均为 178668 字节，SHA256 与 `D:\dsh\dsh-side-coder\lib\client.js` 完全一致（`777DA54F32F2F6831417FB60CD05F3BE25C58F9881B8F7044227B6A5B7D3C9B1`）。govsmoke/headless/test-subagent/node_modules 四目录无该拷贝。
- **自动备份机制（计划书遗漏，P1-9）**：6 个 profile 下均存在 `.dsh-shadowed-copies-backup\dsh-side-coder\`（宿主的遮蔽拷贝备份，内含时间戳子目录）。风险章与 T6 未提及、未规定覆盖前备份与回滚取件路径。
- **Vditor 取数路径（README:35）**：实测 `readContent`（client.js:1715-1729）与 README 完全一致——活动标签即被预览文件且编辑器存活时用 `editor.getValue()`（含未保存编辑，1725-1726），否则回退 `tab.content`（1717-1718）；资源走本地同源 `/side-coder-vditor`（912、1695），无外网回退。计划书 4.5/第 6 章承诺不动，正确；仅提醒挂载门改造不得破坏 path===activeTab 前提（P2-9）。
- **风险表遗漏项汇总**：①无回滚（P1-9）；②onAutoOpen 旧行为残留（P1-7）；③重载重首见回归（P1-6）；④reducer 桩环境 ReferenceError（P1-2，属测试风险）；⑤◀▶/follow 两条语义回归（P0-1/P0-2）。

---

## 9. 文档规范违规清单（R1–R55）

| 规则 | 违规 | 位置 | 对应问题 |
|---|---|---|---|
| R3/R52 | 「3099 独立实例」无启动方式、无 URL、无降级 | 计划书 177、216 | P1-8 |
| R14 | 无「报错/症状→章节」反向索引；自查 257 行自称满足 R14 但文档无索引节 | 全文/第 11 章 | P2 |
| R15 | 264 行超阈值，文首无目录索引 | 文首 | P2-1 |
| R25 | 决策表遗漏 follow 通道、首见通道；119 行单元格三动作 | 116-131 | P0-1、P1-6、P2-4 |
| R27 | follow/首见/载入中再点按钮无分支、无显式默认 | 4.2 | P0-1、P1-6 |
| R31 | T4 信号不可达成；T1 正信号串与既有模板不符；浏览器实测缺逐条客观断言 | 172、175、199、216-218 | P0-3、P1-3 |
| R34/R35 | 「手牌」无定义；◀▶/基线/手牌三名混用；代码注释陈旧名 `_pendingChangeId` | 145、client.js:3332 | P1-11、P2-7 |
| R40 | reducer state/action 无真实样例 | 157-162 | P2-6 |
| R47 | 现象 2 机制把推断挂在〔代码取证〕名下且结论错误；事实标签未随传播 | 68 | P1-1 |
| R49 | 「可选加小型进度纹」模态无判据，与自查 259 行自我声明冲突 | 137 | P2-5 |
| R24 | 6 拷贝覆盖无回滚、未提高危备份机制 | 177-180、第 9 章 | P1-9 |
| R10/R33 | 自查 8 条为陈述句、多条两断言，非原子动作化问句 | 257-264 | P2-2 |
| R13 | 兜底项非标准措辞，且未覆盖 R15/R40/R52 等 | 264 | P2-3 |
| R22 | 测试用例与决策表不一一对应（表缺行、例缺 follow/删除/重挂/重载） | 206-214 | P1-12 |
| R21 | detail 签名两处（542 @ 七字段 / 2695 \u0001 五字段）与计划书第三处写法并存，未声明口径 | 65 | P1-10 |

未发现违规的重点项（已核对通过）：R16 TL;DR 具备且可复述；R26 单一一级标题；R4 章节编号稳定；R5/R45 README 行号引用（22/23/25/31/35）逐条属实；R43 localStorage 键保留策略明确（109、236 行，`TOGGLE_DIFF_OPEN` 实测 149 行）；R30 自动弹出 true/false 两行给了明确结果；R50 决策表条件 AND/OR 清晰。

---

## 10. 修订后放行条件（最小集）

1. 补全 4.2 决策表：follow 开/关两行、DiffPane 首见/重载行、◀▶ 文件翻页行、载入中重复点击行，并逐行配 7.1 用例（消解 P0-1、P0-2、P1-6、P1-12）。
2. 修正 2.4 现象 2 时序（P1-1）与 2695 签名（P1-10）、◀▶ 行号（P0-2）。
3. T4 完成信号改为 client 侧可观测信号，或显式扩大范围至 index.js（P0-3）。
4. 4.6 写明 reducer 自由变量边界与共抽函数清单、action.path 预归一规则（P1-2）；T1 正信号串改中文模板（P1-3）。
5. T2 列出全部 activeTab/openTabs 变更入口（10 处）的 action 分发与映射清理（P1-4、P1-5）。
6. 定义 onAutoOpen 新归属（P1-7）；补 3099 前置或替代（P1-8）；T6 加备份/回滚步骤并引用 shadow 备份目录（P1-9）。
