window.__ModuleLoader__.load({
	id: "dsh-side-coder",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperties(exports, {
			__esModule: { value: true },
			[Symbol.toStringTag]: { value: "Module" }
		});
		//#region \0rolldown/runtime.js
		var __create = Object.create;
		var __defProp = Object.defineProperty;
		var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
		var __getOwnPropNames = Object.getOwnPropertyNames;
		var __getProtoOf = Object.getPrototypeOf;
		var __hasOwnProp = Object.prototype.hasOwnProperty;
		var __copyProps = (to, from, except, desc) => {
			if (from && typeof from === "object" || typeof from === "function") for (var keys = __getOwnPropNames(from), i = 0, n = keys.length, key; i < n; i++) {
				key = keys[i];
				if (!__hasOwnProp.call(to, key) && key !== except) __defProp(to, key, {
					get: ((k) => from[k]).bind(null, key),
					enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable
				});
			}
			return to;
		};
		var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(isNodeMode || !mod || !mod.__esModule || !__hasOwnProp.call(mod, "default") ? __defProp(target, "default", {
			value: mod,
			enumerable: true
		}) : target, mod));
		//#endregion
		let react = require("react");
		react = __toESM(react, 1);
		//#region src/client.ts
		/**
		* 侧栏编程 - Client 端
		* Monaco 编辑器 + 文件树覆盖层面板。
		*
		* 构建产物经 DSH 的 __ModuleLoader__ 机制注册为浏览器端插件，
		* 侧边栏底部按钮触发覆盖层，覆盖层包含文件树、标签栏和 Monaco 编辑器。
		*
		* @module dsh-side-coder/client
		*/
		/** 文件扩展名到 Monaco 语言的映射 */
		const LANG_MAP = {
			js: "javascript",
			jsx: "javascript",
			ts: "typescript",
			tsx: "typescript",
			py: "python",
			go: "go",
			rs: "rust",
			java: "java",
			c: "c",
			cpp: "cpp",
			h: "c",
			cs: "csharp",
			html: "html",
			css: "css",
			scss: "scss",
			json: "json",
			yaml: "yaml",
			yml: "yaml",
			toml: "toml",
			md: "markdown",
			markdown: "markdown",
			mdx: "markdown",
			xml: "xml",
			sql: "sql",
			sh: "shell",
			ps1: "powershell",
			bat: "bat",
			cmd: "bat"
		};
		/**
		* 根据文件扩展名获取语言。
		* @param path - 文件路径。
		*/
		function langByPath(path) {
			const dot = path.lastIndexOf(".");
			if (dot === -1) return "plaintext";
			return LANG_MAP[path.slice(dot + 1).toLowerCase()] || "plaintext";
		}
		/**
		* 根据文件名获取图标。
		* @param name - 文件或目录名。
		* @param type - 条目类型。
		*/
		function iconFor(name, type) {
			if (type === "directory") return "📁";
			return {
				js: "🟨",
				jsx: "🟨",
				ts: "⚡",
				tsx: "⚡",
				py: "🐍",
				go: "🦦",
				rs: "⚙️",
				html: "🌐",
				css: "🎨",
				md: "📝",
				yaml: "📋",
				yml: "📋",
				sh: "⌨️",
				txt: "📄"
			}[(name.split(".").pop() || "").toLowerCase()] || "📄";
		}
		/**
		* 把含 data-* 的属性表收窄成 React 可接受的属性类型。
		* @param value - 属性表。
		*/
		function attrs(value) {
			return value;
		}
		let rpcIdCounter = 0;
		/**
		* 调用 Host 端 RPC 端点。
		* 格式：POST /side-coder/<method>，独立 RPC 通道，
		* 遵循 DSH 四象限消息模型：body.method 必须等于 URL 中的端点名。
		* @param method - 端点名。
		* @param payload - 端点载荷。
		*/
		async function rpcCall(method, payload) {
			const rpcId = "cc-" + String(++rpcIdCounter);
			const body = JSON.stringify({
				type: "client-request",
				rpcId,
				method,
				payload: payload || {}
			});
			const res = await fetch("/side-coder/" + method, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body
			});
			if (!res.ok) throw new Error("HTTP " + res.status);
			const envelope = await res.json();
			if (envelope.result && envelope.result.ok) return envelope.result.value;
			const errMsg = envelope.result && envelope.result.error ? envelope.result.error.message : "RPC 调用失败";
			throw new Error(errMsg);
		}
		/** 当前会话服务；当前会话 id 由 getCurrentSessionId() 从快照解析（兼容两代内核）。 */
		let sessions = null;
		/** 开关状态存档在浏览器本地存储里的键名：面板重新挂载、页面重载后按此恢复，不再回到默认值。 */
		const TOGGLE_STORE_KEY = "dsh-side-coder-toggles:v1";
		/** 开关在存档里的字段名：文件列表展开。 */
		const TOGGLE_TREE_OPEN = "treeOpen";
		/** 开关在存档里的字段名：改动对比展开。 */
		const TOGGLE_DIFF_OPEN = "diffOpen";
		/** 开关在存档里的字段名：AI 改动自动跟随。 */
		const TOGGLE_FOLLOW = "follow";
		/** 开关在存档里的字段名：新改动自动弹出右栏。 */
		const TOGGLE_AUTO_POPUP = "autoPopup";
		/** 开关在存档里的字段名：只显示当前会话窗口的改动。 */
		const TOGGLE_CURRENT_SESSION = "currentSession";
		/** 开关在存档里的字段名：文件列表排序方式。 */
		const TOGGLE_TREE_SORT = "treeSort";
		/** 文件列表排序方式：id 即存档值，label 即下拉框显示文案。 */
		const TREE_SORT_MODES = [
			{ id: "name", label: "名称" },
			{ id: "mtime", label: "修改时间" },
			{ id: "size", label: "大小" },
			{ id: "type", label: "类型" }
		];
		/** 默认排序方式：按名称。 */
		const TREE_SORT_DEFAULT = "name";
		/** 文件栏搜索输入防抖（毫秒）：停止输入后才发起一次递归搜索，避免逐字符打满磁盘 IO。 */
		const SEARCH_DEBOUNCE_MS = 250;
		/**
		* 读取一个存档字段（任意 JSON 值），供排序方式这类非布尔设置使用。
		* @param name - 字段名（TOGGLE_* 常量之一）。
		* @param fallback - 无存档或存档不可读时的默认值。
		* @returns 存档里的值，或 fallback。
		*/
		function read_setting(name, fallback) {
			try {
				const raw = window.localStorage.getItem(TOGGLE_STORE_KEY);
				if (!raw) return fallback;
				const saved = JSON.parse(raw);
				if (!saved || saved[name] === void 0 || saved[name] === null) return fallback;
				return saved[name];
			} catch (e) {
				return fallback;
			}
		}
		/**
		* 记住一个存档字段（任意 JSON 值），尽力而为：本地存储不可用时静默跳过。
		* @param name - 字段名（TOGGLE_* 常量之一）。
		* @param value - 要记住的值。
		*/
		function write_setting(name, value) {
			try {
				const raw = window.localStorage.getItem(TOGGLE_STORE_KEY);
				const saved = raw ? JSON.parse(raw) : {};
				saved[name] = value;
				window.localStorage.setItem(TOGGLE_STORE_KEY, JSON.stringify(saved));
			} catch (e) {
				// 本地存储不可用：放弃记住本次状态
			}
		}
		/**
		* 读取一个开关的存档状态。
		* @param name - 开关字段名（TOGGLE_* 常量之一）。
		* @param fallback - 无存档或存档不可读时的默认状态。
		* @returns 存档里的布尔状态，或 fallback。
		*/
		function read_toggle(name, fallback) {
			try {
				const raw = window.localStorage.getItem(TOGGLE_STORE_KEY);
				if (!raw) return fallback;
				const saved = JSON.parse(raw);
				if (!saved || typeof saved[name] !== "boolean") return fallback;
				return saved[name];
			} catch (e) {
				return fallback;
			}
		}
		/**
		* 记住一个开关的存档状态（尽力而为：本地存储不可用时静默跳过，不影响功能）。
		* @param name - 开关字段名（TOGGLE_* 常量之一）。
		* @param value - 用户选定的开关状态。
		*/
		function write_toggle(name, value) {
			try {
				const raw = window.localStorage.getItem(TOGGLE_STORE_KEY);
				const saved = raw ? JSON.parse(raw) : {};
				saved[name] = value;
				window.localStorage.setItem(TOGGLE_STORE_KEY, JSON.stringify(saved));
			} catch (e) {
				// 本地存储不可用：放弃记住本次状态
			}
		}
		const state = {
			isOpen: false,
			root: null,
			monacoLoaded: false,
			monacoLoading: false,
			files: {},
			openTabs: [],
			activeTab: null,
			_pendingShowPath: null,
			expandedDirs: {},
			styleTag: null,
			sessionId: null,
			_linkTailStarted: false,
			_linkTailObserver: null,
			_refresh: null,
			_setIsOpen: null,
			_openFile: null,
			_saveFile: null,
			// 正在读盘的标签：键为规范化绝对路径（小写），值为登记时的标签路径。
			// 同一文件读盘尚未返回时再进来，只切标签不再发起第二次读盘，避免并发开出重复标签。
			_openingTabs: {},
			_editorInstance: null,
			_themeObserver: null,
			_monacoPromise: null,
			_renderPreview: null,
			_vditorThemeObs: null,
			autoPopup: read_toggle(TOGGLE_AUTO_POPUP, true),
			_pendingChangePath: null,
			_selectChangePath: null,
			// 自动弹出待打开路径：由改动追踪写入，SideCoderPanel 消费后清空并跳转编辑器。
			_pendingOpenPath: null,
			// 对比区"已自动选中过"的顶部文件锚点，切会话时由 DiffPane 删除以强制重新定位。
			_autoselectAck: null,
			fileChanges: [],
			// 每个会话独立记录"已见过的最新改动编号"：切到哪个会话就以哪个会话为准，
			// 其它会话的改动不会推进它，也不互相串扰（需求1、需求3）。
			_lastSeenBySession: {},
			// 改动追踪首轮是否已跑：仅首轮对"早就发生的改动"收敛（刷新后不弹旧账），
			// 此后每切进来一个会话都无条件跳当前会话的最新改动。
			_watcherBooted: false,
			_watchTimer: null,
			treeOpen: read_toggle(TOGGLE_TREE_OPEN, true),
			treeTick: 0,
			// 文件列表排序方式（name | mtime | size | type），用户选择后存档。
			treeSort: read_setting(TOGGLE_TREE_SORT, TREE_SORT_DEFAULT),
			// 文件栏搜索：searchQuery=输入框提交的查询串；searchResults=后端递归模糊匹配结果。
			searchQuery: "",
			searchResults: [],
			searchLoading: false,
			// 搜索结果是否被后端上限截断（目录数或结果数超限），供前端提示收窄关键词。
			searchTruncated: false,
			fileClipboard: null,
			// 文件树多选状态：selectedPaths=已选条目（树内相对路径）；selectionAnchor=Shift 区间锚点。
			selectedPaths: [],
			selectionAnchor: null,
			// Ctrl+V 粘贴目标目录（最后点击的目录；空串=工作区根）。
			lastTreeDir: null,
			contextMenu: null,
			_pluginCtx: null
		};
		/**
		* 触发主面板重渲染：所有直接修改全局 state 的调用点用它刷新 UI。
		* 面板未挂载时 state._refresh 为 null，安全跳过。
		*/
		function refresh() {
			if (state._refresh) state._refresh();
		}
		/**
		* 当前会话 id 从注入的 sessions 服务读取，不抓取 DSH 内部 localStorage。
		*
		* 兼容两代内核：旧内核 sessions.list 快照带 current 字段，直接用；
		* 0.2.0-rc.2 内核的 projectList() 只 set {ids, byId, phase, projectionsBySession}，
		* 已无 current —— 此时改用内核自身的等价语义：retainedBy.mainView > 0
		* 即"该会话正被主视图持有/显示"（见内核 ui-workspace 与 ui-session 的同款取值）。
		* 返回 null 表示尚无当前会话，页面刚加载或连接未建立时。
		*/
		function getCurrentSessionId() {
			if (!sessions || !sessions.list || typeof sessions.list.getSnapshot !== "function") return null;
			const snap = sessions.list.getSnapshot();
			if (!snap) return null;
			if (snap.current) return snap.current;
			const byId = snap.byId;
			if (!byId) return null;
			const ids = Object.keys(byId);
			for (let i = 0; i < ids.length; i += 1) {
				const row = byId[ids[i]];
				if (row && row.retainedBy && (row.retainedBy.mainView || 0) > 0) return row.id || ids[i];
			}
			return null;
		}
		/**
		* 统一路径分隔符为反斜杠：正斜杠形态（D:/x/y.js）与树内形态（a/b.js）都归一为 Windows 形态。
		* @param rawPath - 任意形态路径。
		* @returns 分隔符统一后的路径字符串。
		*/
		function normalizeSeparators(rawPath) {
			return String(rawPath == null ? "" : rawPath).replace(/\//g, "\\");
		}
		/**
		* 折叠路径首部的 "." 段："./a.js"、".\\a.js" 归一为 "a.js"，使树内路径比较不受前缀写法影响。
		* @param rawPath - 已统一分隔符的路径。
		* @returns 去掉前导 "./" 的路径。
		*/
		function stripDotPrefix(rawPath) {
			let result = String(rawPath == null ? "" : rawPath);
			while (result.startsWith(".\\")) result = result.slice(2);
			return result;
		}
		/**
		* 相对路径即文件树内转绝对路径即 RPC 用，Windows 分隔符。
		* 已是绝对路径即盘符或 UNC 时原样返回：消息流尾巴传入的路径可能是绝对路径，
		* 不能再用 root 拼接。
		* @param relPath - 文件树内相对路径或绝对路径。
		*/
		function toAbs(relPath) {
			if (!relPath) return state.root || "";
			const p = normalizeSeparators(relPath);
			if (/^[A-Za-z]:\\|^\\\\/.test(p)) return p;
			// 工作目录未知时不做拼接：避免把树内相对路径变成 "\lib\x.js" 这种无盘符根路径，
			// 让 root 就绪前后的同一文件仍能按同一键比较。
			const root = normalizeSeparators(state.root || "");
			if (!root) return stripDotPrefix(p);
			return root + "\\" + stripDotPrefix(p);
		}
		/**
		* 绝对路径转文件树内相对路径：去掉工作目录前缀；不在工作目录下则原样返回。
		* 比较前统一分隔符与大小写，因此正斜杠形态的绝对路径（D:/x/y）也能正确落回相对路径。
		* @param absPath - 绝对路径。
		*/
		function toRel(absPath) {
			const root = normalizeSeparators(state.root || "");
			const p = normalizeSeparators(absPath);
			if (!root) return p;
			const prefix = root.endsWith("\\") ? root : root + "\\";
			if (p.toLowerCase().startsWith(prefix.toLowerCase())) return stripDotPrefix(p.slice(prefix.length));
			return p;
		}
		/** 改动记录轮询间隔（毫秒）。 */
		const POLL_INTERVAL_MS = 3000;
		/** 对比浮层跟随定位：diff 算完后最多再重试几次（次）；diff 是异步算的，事件偶发丢失时靠它兜底。 */
		const FOLLOW_ALIGN_RETRY_COUNT = 8;
		/** 对比浮层跟随定位：每次重试的间隔（毫秒）。 */
		const FOLLOW_ALIGN_RETRY_MS = 120;
		/**
		* 路径同值判定：统一斜杠与大小写后比较（Windows 盘符路径大小写不敏感）。
		* @param a - 路径一。
		* @param b - 路径二。
		*/
		function samePath(a, b) {
			function normalize(p) {
				return String(p || "").replace(/\//g, "\\").toLowerCase();
			}
			return normalize(a) === normalize(b);
		}
		/**
		* 标签页路径规范化：任何入口传入的路径（树内相对、盘符绝对、正斜杠、带 "./" 前缀）
		* 统一折算成同一个标签键，避免同一文件被当成两个文件而开出重复标签。
		* @param rawPath - 任意入口传入的路径。
		* @returns 归一后的标签路径（优先树内相对路径，工作目录外则保留绝对路径）。
		*/
		function canonicalTabPath(rawPath) {
			return toRel(toAbs(rawPath));
		}
		/**
		* 按路径查找已打开的标签：用规范化后的绝对路径比较，形态不同但指向同一文件即命中。
		* @param rawPath - 任意形态路径。
		* @returns 命中的标签对象；未打开时返回 null。
		*/
		function findOpenTab(rawPath) {
			const target = toAbs(canonicalTabPath(rawPath));
			for (let i = 0; i < state.openTabs.length; i += 1) {
				if (samePath(toAbs(state.openTabs[i].path), target)) return state.openTabs[i];
			}
			return null;
		}
		/**
		* 取路径的文件名段。
		* @param path - 文件路径。
		*/
		function baseName(path) {
			return String(path || "").split(/[\\/]/).pop() || "";
		}
		/**
		* 毫秒时间戳格式化为 HH:MM:SS。
		* @param time - 毫秒时间戳。
		*/
		function formatTime(time) {
			function pad(n) {
				return n < 10 ? "0" + n : String(n);
			}
			const d = new Date(Number(time) || Date.now());
			return pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
		}
		/**
		* 打开右栏的侧栏编程标签页；没有会话面时给出提示而不抛错。
		*/
		function openSidebarTab() {
			const sidebarRight = state._sidebarRight;
			if (!sidebarRight) return;
			try {
				sidebarRight.openTab("side-coder");
			} catch (e) {
				console.warn("[side-coder] 打开右栏失败(需先选中会话):", e);
			}
		}
		/** 改动追踪间隔（毫秒）：与对话里的文件改动保持近实时同步。 */
		const WATCH_INTERVAL_MS = 2000;
		/**
		* 启动改动追踪：定时向后台要当前会话的改动记录，出现新改动即自动弹出右栏并指向最新改动。
		* 面板没打开也照跑，是"自动弹出"的动力源。
		*
		* 会话绑定关键点：
		* - 每次都把 listFileChanges 的 sessionId 限定为【当前处于的会话】。后端 latestId 会随之只反映
		*   该会话的最新改动编号，其它正在运行的会话产生修改时，这个编号不会推进，当前会话的编辑器
		*   也就不会被别人的改动"带着跳"（需求1）。
		* - _lastSeenBySession 按会话独立记账：首轮只收敛一次"早就发生的旧改动"（刷新后不弹旧账），
		*   之后每当切换进一个会话，只要该会话有新改动且尚未"消费"到它的最新编号，就无条件跳一次——
		*   保证切会话时总是指向当前会话窗口的最新改动文件（需求3）。
		* - 会话读写都在同一 tick 内完成，RPC 返回前会话可能又切走，用返回时刻的会话 id（而非调用的）
		*   判断最新改动归属，避免异步竞态把 A 会话的改动记到 B 会话头上。
		*/
		function startChangeWatcher() {
			if (state._watchTimer) return;
			function tick() {
				const sessionId = getCurrentSessionId();
				if (!sessionId) return;
				rpcCall("listFileChanges", { sessionId: sessionId }).then(function(result) {
					const rawFiles = (result && result.files) || [];
					// 后端已按 sessionId 聚合，绝不会混入其它会话的文件。
					const files = rawFiles;
					if (files.length === 0) return;
					const latestId = Number((result && result.latestId) || 0);
					const seen = state._lastSeenBySession[sessionId];
					// 首轮（从未记录过本会话）且从未启动过追踪：只把它收敛为当前编号，不弹旧账。
					// 首轮之后切进来的会话走「无条件跳一次」分支，见下方。
					const isBooting = state._watcherBooted === false && seen === undefined;
					if (isBooting) {
						state._watcherBooted = true;
						state._lastSeenBySession[sessionId] = latestId;
						return;
					}
					// 纯会话切换的本轮：当前会话编号 ≥ 已见编号就算"有未消费的改动"，跳最新文件一次。
					if (seen === undefined) {
						if (latestId <= 0) {
							state._lastSeenBySession[sessionId] = latestId;
							return;
						}
						state._lastSeenBySession[sessionId] = latestId;
						// 编辑跳转始终执行；autoPopup 只决定要不要顺便把右栏拉出来。
						state._pendingOpenPath = files[0].path;
						if (state.autoPopup !== false) {
							openSidebarTab();
							refresh();
						}
						return;
					}
					if (latestId <= seen) return;
					state._lastSeenBySession[sessionId] = latestId;
					// 新改动：编辑跳转始终执行，autoPopup 只决定要不要顺手弹出右栏。
					state._pendingOpenPath = files[0].path;
					if (state.autoPopup === false) return;
					openSidebarTab();
					refresh();
				}).catch(function() {});
			}
			state._watchTimer = setInterval(tick, WATCH_INTERVAL_MS);
			tick();
		}
		/** 停止改动追踪。 */
		function stopChangeWatcher() {
			if (state._watchTimer) {
				clearInterval(state._watchTimer);
				state._watchTimer = null;
			}
		}
		const CSS = [
			".dsh-cc-trigger{display:flex;flex-direction:column;gap:5px;width:100%;min-width:0;padding:7px 9px 8px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:transparent;cursor:pointer;text-align:left;color:var(--dsw-alias-label-primary);font-family:inherit;transition:background .12s ease,border-color .12s ease}",
			".dsh-cc-trigger:hover{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l2)}",
			".dsh-cc-trigger:active{background:var(--dsw-alias-interactive-bg-active)}",
			".dsh-cc-trigger-head{display:flex;align-items:center;gap:7px;min-width:0}",
			".dsh-cc-trigger-icon{display:inline-flex;flex:none;width:16px;height:16px;align-items:center;justify-content:center;font-style:normal;opacity:.85}",
			".dsh-cc-trigger-title{font-size:12.5px;font-weight:600;line-height:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dsh-cc-trigger-desc{font-size:11px;line-height:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--dsw-alias-label-secondary)}",
			".dsh-cc-dock{position:relative;width:100%;height:100%;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#333);overflow:hidden}",
			".dsh-cc-header-actions{display:flex;gap:6px;margin-left:auto}",
			".dsh-cc-main-col{flex:1;display:flex;flex-direction:column;min-width:0;min-height:0}",
			".dsh-cc-main-col>.dsh-cc-editor-panel{flex:1;min-height:0}",
			// 当前文件绝对路径横条：位于标签栏与编辑器之间，flex-shrink:0 保证编辑器 flex 链不被压缩。
			".dsh-cc-pathbar{flex:0 0 auto;display:flex;align-items:center;gap:6px;padding:3px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);font-size:11px;color:var(--dsw-alias-fg-2,#9aa3b2);min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;user-select:all;background:var(--dsw-alias-bg-layer-1,#14171c)}",
			".dsh-cc-pathbar .dsh-cc-pathbar-icon{flex:none;opacity:.8;font-size:11px}",
			".dsh-cc-diff{flex:0 0 auto;display:flex;flex-direction:column;border-top:1px solid var(--dsw-alias-border-l1)}",
			".dsh-cc-diff-head{display:flex;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);flex-shrink:0;font-size:11px;color:var(--dsw-alias-label-secondary)}",
			".dsh-cc-diff-title{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dsh-cc-diff-flash{color:var(--dsw-alias-brand-primary,#2f6feb);font-weight:600}",
			// 改动文件列表最多 5 行：单行高 = 内容行 18px + 上下内边距 12px + 底边框 1px = 31px，
			// 超过 5 行的部分在本区内部滚动，不再继续往上顶掉编辑器的可用高度。
			".dsh-cc-diff-files{display:flex;flex-direction:column;overflow-y:auto;max-height:calc(5 * 31px)}",
			".dsh-cc-diff-file{display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;padding:6px 10px;text-align:left;background:transparent;border:none;color:var(--dsw-alias-fg-1,#c7ccd7);font-weight:600;line-height:18px;cursor:pointer;border-left:3px solid transparent}",
			".dsh-cc-diff-file:hover{background:var(--dsw-alias-bg-hover,rgba(255,255,255,0.06))}",
			".dsh-cc-diff-file.active{background:var(--dsw-alias-bg-active,rgba(47,111,235,0.12));border-left-color:var(--dsw-alias-brand-primary,#2f6feb)}",
			".dsh-cc-diff-file-name{flex:0 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dsh-cc-diff-file-meta{flex:0 0 auto;font-size:12px;color:var(--dsw-alias-fg-2,#9aa3b2)}",
			".dsh-cc-diff-file-time{flex:0 0 auto;font-size:11px;color:var(--dsw-alias-fg-3,#6b7280)}",
			// 改动类型徽章：git 式 A/M/D/R，颜色区分（新增绿/修改黄/删除红/重命名蓝）。
			".dsh-cc-diff-file-icon{flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:4px;font-size:10px;font-weight:700;line-height:1;font-family:ui-monospace,Consolas,monospace}",
			".dsh-cc-diff-file-icon.ck-added{color:#3fb950;background:rgba(63,185,80,0.14)}",
			".dsh-cc-diff-file-icon.ck-modified{color:#d29922;background:rgba(210,153,34,0.14)}",
			".dsh-cc-diff-file-icon.ck-deleted{color:#f85149;background:rgba(248,81,73,0.14)}",
			".dsh-cc-diff-file-icon.ck-renamed{color:#58a6ff;background:rgba(88,166,255,0.14)}",
			".dsh-cc-diff-group-head{display:flex;align-items:center;gap:6px;padding:5px 10px 3px;font-size:11px;font-weight:600;color:var(--dsw-alias-label-secondary,#8b93a5);border-top:1px solid var(--dsw-alias-border-l1);position:sticky;top:0;background:var(--dsw-alias-bg-layer-1,#14171c)}",
			".dsh-cc-diff-group-head:first-child{border-top:none}",
			".dsh-cc-diff-group-label{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dsh-cc-diff-group-count{flex:0 0 auto;font-size:10px;font-weight:400;color:var(--dsw-alias-fg-3,#6b7280)}",
			".dsh-cc-diff-overlay{position:absolute;inset:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1,#101216) !important;z-index:5}",
			".dsh-cc-diff-overlay-bar{display:flex;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);flex-shrink:0;font-size:11px;color:var(--dsw-alias-label-secondary)}",
			".dsh-cc-diff-overlay-title{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".dsh-cc-diff-overlay-box{flex:1;min-height:0;position:relative;background:var(--dsw-alias-bg-layer-1,#101216) !important}",
			".dsh-cc-diff-overlay-placeholder{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--dsw-alias-label-secondary);font-size:13px;background:var(--dsw-alias-bg-layer-1,#101216)}",
			".dsh-cc-menu{position:fixed;z-index:1000;min-width:180px;background:var(--dsw-alias-bg-overlay,#101216);border:1px solid var(--dsw-alias-border-l1,#3a3f4b);border-radius:6px;box-shadow:0 8px 24px rgba(0,0,0,.28);padding:4px;display:flex;flex-direction:column}",
			".dsh-cc-menu-item{display:flex;align-items:center;gap:8px;padding:5px 10px;font-size:12px;color:var(--dsw-alias-label-primary);border-radius:4px;cursor:pointer;background:none;border:none;text-align:left;width:100%}",
			".dsh-cc-menu-item:hover{background:var(--dsw-alias-bg-layer-3,#262b33)}",
			".dsh-cc-menu-item.danger{color:#e5534b}",
			".dsh-cc-menu-item.disabled{opacity:.4;cursor:default}",
			".dsh-cc-menu-item.disabled:hover{background:none}",
			".dsh-cc-menu-sep{height:1px;background:var(--dsw-alias-border-l1);margin:4px 6px}",
			".dsh-cc-diff-btn{cursor:pointer;background:transparent;border:1px solid var(--dsw-alias-border-l1);border-radius:4px;color:inherit;font-size:11px;padding:1px 7px}",
			".dsh-cc-diff-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-cc-diff-btn.active{border-color:var(--dsw-alias-brand-primary,#2f6feb);color:var(--dsw-alias-brand-primary,#2f6feb)}",
			".dsh-cc-header{display:flex;align-items:center;justify-content:space-between;padding:8px 16px;border-bottom:1px solid var(--dsw-alias-border-l1);flex-shrink:0}",
			".dsh-cc-header-title{font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px}",
			".dsh-cc-close{cursor:pointer;font-size:20px;line-height:1;padding:2px 6px;border-radius:4px;background:transparent;border:none;color:inherit}",
			".dsh-cc-close:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-cc-tabs{display:flex;overflow-x:auto;border-bottom:1px solid var(--dsw-alias-border-l1);flex-shrink:0}",
			".dsh-cc-tab{display:flex;align-items:center;gap:5px;padding:6px 12px;font-size:12px;cursor:pointer;border-right:1px solid var(--dsw-alias-border-l1);white-space:nowrap;color:var(--dsw-alias-label-secondary);background:transparent;border-top:none;border-bottom:none;border-left:none;font-family:inherit}",
			".dsh-cc-tab:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-cc-tab[data-active=\"true\"]{color:var(--dsw-alias-brand-primary-invert,#fff);font-weight:600;background:var(--dsw-alias-brand-primary,#3b82f6);border-bottom:none}",
			".dsh-cc-tab-modified{color:var(--dsw-alias-state-error-primary)}",
			".dsh-cc-tab-close{font-size:14px;padding:0 2px;border-radius:3px;opacity:.5;cursor:pointer;background:transparent;border:none;color:inherit;line-height:1}",
			".dsh-cc-tab-close:hover{opacity:1;background:rgba(255,0,0,.1)}",
			".dsh-cc-body{display:flex;flex:1;overflow:hidden}",
			".dsh-cc-tree-panel{width:250px;min-width:150px;max-width:500px;overflow:hidden;border-left:1px solid var(--dsw-alias-border-l1);flex-shrink:0;display:flex;flex-direction:column}",
			// 搜索栏固定在文件栏顶部，下方的树/结果区各自滚动，搜索框不会被列表滚走。
			".dsh-cc-tree-wrap{flex:1;min-height:0;display:flex;flex-direction:column}",
			".dsh-cc-tree-bar{flex:0 0 auto;display:flex;align-items:center;gap:4px;padding:4px 6px;border-bottom:1px solid var(--dsw-alias-border-l1)}",
			".dsh-cc-search{flex:1;min-width:0;display:flex;align-items:center;gap:4px;border:1px solid var(--dsw-alias-border-l1);border-radius:4px;padding:1px 5px}",
			".dsh-cc-search:focus-within{border-color:var(--dsw-alias-brand-primary,#2f6feb)}",
			".dsh-cc-search-icon{flex:none;font-size:11px;opacity:.7}",
			".dsh-cc-search-input{flex:1;min-width:0;border:none;outline:none;background:transparent;color:inherit;font-family:inherit;font-size:12px;padding:2px 0}",
			".dsh-cc-search-clear{flex:none;border:none;background:transparent;color:inherit;cursor:pointer;font-size:11px;opacity:.6;padding:0 2px;font-family:inherit;line-height:1}",
			".dsh-cc-search-clear:hover{opacity:1}",
			".dsh-cc-sort-select{flex:none;max-width:92px;font-size:11px;font-family:inherit;color:inherit;background:transparent;border:1px solid var(--dsw-alias-border-l1);border-radius:4px;padding:1px 2px;cursor:pointer}",
			".dsh-cc-search-results{flex:1;min-height:0;overflow-y:auto;padding:2px 0}",
			".dsh-cc-search-hit{display:flex;align-items:center;gap:4px;padding:3px 8px;font-size:13px;line-height:1.6;cursor:pointer;white-space:nowrap;overflow:hidden}",
			".dsh-cc-search-hit:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-cc-search-hit-icon{flex:none}",
			".dsh-cc-search-hit-name{flex:0 1 auto;overflow:hidden;text-overflow:ellipsis}",
			".dsh-cc-search-hit-dir{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;font-size:11px;color:var(--dsw-alias-label-secondary)}",
			".dsh-cc-search-meta{padding:6px 10px;font-size:11px;color:var(--dsw-alias-label-secondary)}",
			".dsh-cc-tree-item{padding:3px 8px;font-size:13px;line-height:1.6;display:flex;align-items:center;gap:4px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dsh-cc-tree-item:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsh-cc-tree-item.selected{background:var(--dsw-alias-interactive-bg-active,#2f5fb3);color:var(--dsw-alias-label-primary,#fff)}",
			".dsh-cc-tree-view{flex:1;min-height:0;overflow-y:auto;outline:none;padding:4px 0}",
			".dsh-cc-tree-loading{padding:12px;font-size:13px;color:var(--dsw-alias-label-secondary)}",
			".dsh-cc-editor-panel{flex:1;min-height:0;overflow:hidden;position:relative;display:flex;flex-direction:column}",
			".dsh-cc-editor{flex:1;min-height:0;width:100%}",
			".dsh-cc-editor-panel[data-diff-active=\"true\"]>.dsh-cc-editor{display:none}",
			".dsh-cc-editor-panel[data-diff-active=\"true\"]>.dsh-cc-diff-overlay{position:static;flex:1;min-height:0}",
			".dsh-cc-preview{flex:1;min-height:0;overflow:auto;display:none}",
			".dsh-cc-preview.vditor-reset{padding:20px 24px;box-sizing:border-box;max-width:none}",
			".dsh-cc-preview.vditor-reset>:first-child{margin-top:0}",
			".dsh-cc-preview.vditor-reset>:last-child{margin-bottom:0}",
			".dsh-cc-editor-panel[data-preview-active=\"true\"]>.dsh-cc-editor{display:none}",
			".dsh-cc-editor-panel[data-preview-active=\"true\"][data-diff-active=\"false\"]>.dsh-cc-preview{display:block}",
			".dsh-cc-editor-placeholder{display:flex;align-items:center;justify-content:center;width:100%;height:100%;color:var(--dsw-alias-label-tertiary);font-size:14px}",
			".dsh-cc-status{padding:4px 16px;font-size:11px;border-top:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-tertiary);flex-shrink:0}",
			"@media(max-width:768px){.dsh-cc-panel{width:92vw;min-width:0}.dsh-cc-tree-panel{width:160px}}",
			"[class*=\"footerActions\"]:has(button.dsh-cc-trigger){flex-direction:column;align-items:stretch}",
			"[data-sidebar-collapsed] [class*=\"footerActions\"]:has(button.dsh-cc-trigger){align-items:center}",
			"[data-sidebar-collapsed] button.dsh-cc-trigger{width:36px;height:36px;padding:0;align-items:center;justify-content:center;border-radius:12px;border-color:transparent}",
			"[data-sidebar-collapsed] .dsh-cc-trigger-title,[data-sidebar-collapsed] .dsh-cc-trigger-desc{display:none}",
			"[data-sidebar-collapsed] .dsh-cc-trigger-head{gap:0}",
			".dsh-cc-open-here{margin-left:6px;cursor:pointer;font-size:12px;color:var(--dsw-alias-brand-primary);text-decoration:underline dotted;white-space:nowrap;user-select:none}",
			".dsh-cc-open-here:hover{text-decoration:underline;background:color-mix(in srgb,var(--dsw-alias-brand-primary) 12%,transparent);border-radius:3px}",
			// 整页刷新提示条：插件热重载后 Monaco 全局状态可能半残，用黄条提示一次完整刷新。
			".dsh-cc-update-banner{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:6px 12px;background:#bb8009;color:#1a1500;font-size:12px}",
			".dsh-cc-update-banner-icon{flex:none;font-size:13px}",
			".dsh-cc-update-banner-text{flex:1;min-width:0;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
			".dsh-cc-update-banner-btn{flex:none;cursor:pointer;border:none;border-radius:4px;padding:3px 10px;background:#1a1500;color:#ffd778;font-size:11px;font-weight:700;font-family:inherit}",
			".dsh-cc-update-banner-close{flex:none;cursor:pointer;border:none;background:transparent;color:#1a1500;font-size:15px;line-height:1;padding:0 2px;opacity:.7;font-family:inherit}"
		].join("\n");
		/** 幂等挂载 Vditor 主排版样式 index.css（content-theme 与 hljs 主题由 Vditor 按 theme.current / hljs.style 自行加载切换，无需宿主介入）。 */
		const VDITOR_BASE_SHEET_ID = "dsh-cc-vditor-base";
		function ensureVditorBaseSheet() {
			if (document.getElementById(VDITOR_BASE_SHEET_ID)) return;
			const link = document.createElement("link");
			link.id = VDITOR_BASE_SHEET_ID;
			link.rel = "stylesheet";
			link.href = VDITOR_CDN + "/dist/index.css";
			document.head.appendChild(link);
		}
		/** 注入插件样式表，幂等。 */
		function ensureStyle() {
			if (state.styleTag) return;
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-side-coder";
			tag.textContent = CSS;
			document.head.appendChild(tag);
			state.styleTag = tag;
		}
		/** 移除插件样式表。 */
		function removeStyle() {
			if (state.styleTag && state.styleTag.parentNode) state.styleTag.parentNode.removeChild(state.styleTag);
			state.styleTag = null;
		}
		/** DSH 暗色主题标记：ui-theme 在 body 上设置 data-ds-dark-theme。 */
		function isDarkTheme() {
			return document.body.hasAttribute("data-ds-dark-theme");
		}
		/** Vditor 预览资源基址：仅本地小门（../../hard-constraint: 零外部请求），无外网回退。 */
		const VDITOR_CDN = "/side-coder-vditor";
		/** 判断文件是否为可预览的 Markdown（.md/.markdown/.mdx）。 */
		function isMarkdownPath(p) {
			const dot = p.lastIndexOf(".");
			if (dot === -1) return false;
			return ["md", "markdown", "mdx"].indexOf(p.slice(dot + 1).toLowerCase()) !== -1;
		}
		/** 画图组件的两个来源：优先本地小门，取不到退回外网（外网在公司网络下时通时断）。 */
		const MONACO_SOURCES = [{
			loader: "/side-coder-monaco/vs/loader.js",
			base: "/side-coder-monaco/vs"
		}, {
			loader: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs/loader.js",
			base: "https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs"
		}];
		/** 加载画图组件：逐个来源尝试，全部失败才报错；重复调用复用同一个 Promise。 */
		function loadMonaco() {
			if (state.monacoLoaded) return Promise.resolve();
			if (state.monacoLoading && state._monacoPromise) return state._monacoPromise;
			state.monacoLoading = true;
			state._monacoPromise = new Promise(function(resolve, reject) {
				function attempt(index) {
					if (index >= MONACO_SOURCES.length) {
						state.monacoLoading = false;
						reject(/* @__PURE__ */ new Error("画图组件加载失败（本地小门与外网均不可达）"));
						return;
					}
					const source = MONACO_SOURCES[index];
					const script = document.createElement("script");
					script.src = source.loader;
					script.onload = function() {
						try {
							window.require.config({ paths: { vs: source.base } });
							window.require(["vs/editor/editor.main"], function() {
								state.monacoLoaded = true;
								state.monacoLoading = false;
								resolve();
							}, function() {
								attempt(index + 1);
							});
						} catch (e) {
							attempt(index + 1);
						}
					};
					script.onerror = function() {
						attempt(index + 1);
					};
					document.head.appendChild(script);
				}
				attempt(0);
			});
			return state._monacoPromise;
		}
		/**
		* 树内缓存定向清理（多选操作的内联版，避免依赖后置的 settleTreeCache）。
		* @param prefix - 受影响的树内路径（空串=整棵）。
		*/
		function settleTreeCacheLocal(prefix) {
			const norm = function(p) {
				return String(p || "").replace(/\//g, "\\").toLowerCase();
			};
			const pre = norm(prefix);
			Object.keys(state.files).forEach(function(key) {
				const k = norm(key);
				if (pre === "" || k === pre || k.startsWith(pre + "\\") || pre.startsWith(k + "\\")) delete state.files[key];
			});
			state.treeTick = (state.treeTick || 0) + 1;
			refresh();
		}
		/**
		* 批量删除选中的条目（文件树 Ctrl/Shift 多选 + Delete）。
		* @param paths - 树内相对路径数组。
		*/
		function deleteSelected(paths) {
			let done = 0;
			const total = paths.length;
			paths.forEach(function(p) {
				rpcCall("deleteEntry", { path: toAbs(p) }).then(function() {
					const norm = function(x) {
						return String(x || "").replace(/\//g, "\\").toLowerCase();
					};
					const pre = norm(p);
					state.openTabs = state.openTabs.filter(function(t) {
						const k = norm(t.path);
						return !(k === pre || k.startsWith(pre + "\\"));
					});
					if (state.activeTab && !state.openTabs.some(function(t) {
						return samePath(t.path, state.activeTab);
					})) {
						const last = state.openTabs[state.openTabs.length - 1];
						state.activeTab = last ? last.path : null;
					}
					done += 1;
					if (done >= total) {
						state.selectedPaths = [];
						state.selectionAnchor = null;
						settleTreeCacheLocal(p);
					}
				}).catch(function(e) {
					console.error("[side-coder] 批量删除失败:", p, e);
					done += 1;
				});
			});
		}
		/**
		* 为目标目录里的文件生成不冲突的树内路径：已存在则追加 " (1)"、" (2)"…
		* 与 Windows 资源管理器粘贴重名行为一致。
		* @param targetDir - 目标目录树内路径（空串=根）。
		* @param name - 源文件名（含扩展名）。
		* @param existing - 目标目录现有条目名数组。
		* @returns {string} 不冲突的树内路径。
		*/
		function uniqueDestPath(targetDir, name, existing) {
			const exists = function(n) {
				return existing.indexOf(n) >= 0;
			};
			if (!exists(name)) return targetDir ? targetDir + "/" + name : name;
			const dot = name.lastIndexOf(".");
			const stem = dot > 0 ? name.slice(0, dot) : name;
			const ext = dot > 0 ? name.slice(dot) : "";
			let i = 1;
			let candidate = stem + " (" + i + ")" + ext;
			while (exists(candidate)) {
				i += 1;
				candidate = stem + " (" + i + ")" + ext;
			}
			return targetDir ? targetDir + "/" + candidate : candidate;
		}
		/**
		* 把剪贴板内容粘贴到指定目录；支持多选（paths 数组）与旧单条（path）两种格式。
		* 重名时自动生成 " (1)" 后缀，与 Windows 资源管理器一致。
		* @param targetDir - 目标目录的树内路径（空串=工作区根）。
		*/
		function pasteClipboardTo(targetDir) {
			const clip = state.fileClipboard;
			if (!clip) return;
			const paths = clip.paths || (clip.path ? [clip.path] : []);
			if (paths.length === 0) return;
			// 先取目标目录现有条目名，用于重名自动重命名。
			rpcCall("listDir", { path: toAbs(targetDir || ".") }).then(function(dirResult) {
				const existing = (dirResult.entries || []).map(function(en) {
					return en.name;
				});
				let done = 0;
				const total = paths.length;
				paths.forEach(function(srcPath) {
					const base = baseName(srcPath);
					const dest = uniqueDestPath(targetDir, base, existing);
					const srcAbs = toAbs(srcPath);
					const destAbs = toAbs(dest);
					if (samePath(srcAbs, destAbs)) {
						done += 1;
						if (done >= total) settleTreeCacheLocal(targetDir);
						return;
					}
					const method = clip.op === "cut" ? "moveEntry" : "copyEntry";
					rpcCall(method, { from: srcAbs, to: destAbs }).then(function() {
						// 若生成了唯一名，加入 existing 防止后续条目重名撞车。
						if (dest !== (targetDir ? targetDir + "/" + base : base)) {
							existing.push(dest.split("/").pop());
						}
						done += 1;
						if (done >= total) {
							if (clip.op === "cut") {
								state.fileClipboard = null;
								state.selectedPaths = [];
								state.selectionAnchor = null;
								settleTreeCacheLocal(srcPath);
							} else {
								settleTreeCacheLocal(targetDir);
							}
						}
					}).catch(function(e) {
						console.error("[side-coder] 粘贴失败:", srcPath, e);
						done += 1;
					});
				});
			}).catch(function(e) {
				console.error("[side-coder] 粘贴目标目录读取失败:", e);
			});
		}
		/**
		* 取文件扩展名（小写、不含点）；无扩展名或纯点文件名返回空串。
		* 用于「按类型」排序：同扩展名的文件聚在一起。
		* @param name - 文件或目录名。
		*/
		function extensionOf(name) {
			const text = String(name || "");
			const dot = text.lastIndexOf(".");
			if (dot <= 0) return "";
			return text.slice(dot + 1).toLowerCase();
		}
		/**
		* 生成文件树排序比较器。
		* 目录恒排在文件之前（与资源管理器一致），同类之间才按所选方式比较，
		* 这样"按大小/按时间"不会把目录和文件混在一起打乱层级直觉。
		* @param mode - 排序方式：name | mtime | size | type。
		* @returns 供 Array.prototype.sort 使用的比较函数。
		*/
		function makeTreeComparator(mode) {
			return function(a, b) {
				const aIsDir = a.type === "directory";
				const bIsDir = b.type === "directory";
				if (aIsDir !== bIsDir) return aIsDir ? -1 : 1;
				if (mode === "mtime") {
					return (b.mtimeMs || 0) - (a.mtimeMs || 0) || a.name.localeCompare(b.name);
				}
				if (mode === "size") {
					return (b.size || 0) - (a.size || 0) || a.name.localeCompare(b.name);
				}
				if (mode === "type") {
					const aExt = extensionOf(a.name);
					const bExt = extensionOf(b.name);
					// 无扩展名排最后，其余按扩展名字母序；同类内再按名称。
					if (aExt !== bExt) {
						if (aExt === "") return 1;
						if (bExt === "") return -1;
						return aExt.localeCompare(bExt);
					}
					return a.name.localeCompare(b.name, "zh-Hans-CN", { numeric: true });
				}
				// 默认：按名称，数字按数值比较（file2 排在 file10 之前）。
				return a.name.localeCompare(b.name, "zh-Hans-CN", { numeric: true });
			};
		}
		/**
		* 排序方式下拉框：切换后写入存档并重排当前文件列表。
		* @param props - value=当前排序 id；onChange=切换回调。
		*/
		function SortSelect(props) {
			return react.createElement("select", {
				className: "dsh-cc-sort-select",
				value: props.value,
				title: "文件列表排序方式",
				onMouseDown: function(e) {
					e.stopPropagation();
				},
				onChange: function(e) {
					props.onChange(e.target.value);
				}
			}, TREE_SORT_MODES.map(function(mode) {
				return react.createElement("option", {
					key: mode.id,
					value: mode.id
				}, mode.label);
			}));
		}
		/**
		* 文件栏顶部搜索框：本地即时回显输入，防抖后再把查询提交给上层触发递归搜索。
		* Esc 清空；输入框自身吞掉键盘事件，避免 Delete/Ctrl+C 被文件树的快捷键接走。
		* @param props - query=已提交的查询串；onQueryChange=防抖后的提交回调。
		*/
		function FileSearchBar(props) {
			const [text, setText] = react.useState(props.query || "");
			react.useEffect(function() {
				const timer = setTimeout(function() {
					props.onQueryChange(text);
				}, SEARCH_DEBOUNCE_MS);
				return function() {
					clearTimeout(timer);
				};
			}, [text]);
			return react.createElement("div", { className: "dsh-cc-search" }, react.createElement("span", { className: "dsh-cc-search-icon" }, "🔍"), react.createElement("input", {
				className: "dsh-cc-search-input",
				type: "text",
				value: text,
				placeholder: "搜索文件名…",
				title: "在当前工作目录整棵子树内模糊匹配文件名",
				onMouseDown: function(e) {
					e.stopPropagation();
				},
				onKeyDown: function(e) {
					e.stopPropagation();
					if (e.key === "Escape") setText("");
				},
				onChange: function(e) {
					setText(e.target.value);
				}
			}), text ? react.createElement("button", {
				className: "dsh-cc-search-clear",
				title: "清空搜索",
				onMouseDown: function(e) {
					e.stopPropagation();
				},
				onClick: function() {
					setText("");
				}
			}, "✕") : null);
		}
		/**
		* 一条搜索命中：文件名 + 所在相对目录，点击直接在编辑器打开。
		* @param props - item=命中项（含 name/relativePath/path）；onOpen=打开回调。
		*/
		function SearchResultRow(props) {
			const item = props.item;
			const rel = String(item.relativePath || "");
			const slash = rel.lastIndexOf("/");
			const dirPart = slash > 0 ? rel.slice(0, slash) : "";
			return react.createElement("div", {
				className: "dsh-cc-search-hit",
				title: item.path,
				onClick: function() {
					props.onOpen(rel);
				},
				onContextMenu: function(e) {
					// 与文件树条目一致：右键弹出自定义菜单，阻止浏览器原生菜单。
					// 搜索命中项均为文件（后端 searchFiles 只返回文件），isDir 恒为 false。
					e.preventDefault();
					e.stopPropagation();
					if (props.onEntryMenu) props.onEntryMenu(e, rel, false);
				}
			}, react.createElement("span", { className: "dsh-cc-search-hit-icon" }, iconFor(item.name, "file")), react.createElement("span", { className: "dsh-cc-search-hit-name" }, item.name), dirPart ? react.createElement("span", { className: "dsh-cc-search-hit-dir" }, dirPart) : null);
		}
		/**
		* 单个文件树条目，目录展开时递归渲染子条目。
		* @param props - 条目 props。
		*/
		function FileTreeEntry(props) {
			const entry = props.entry;
			const parentPath = props.parentPath;
			const level = props.level;
			const onEntryClick = props.onEntryClick;
			const fullPath = parentPath ? parentPath + "/" + entry.name : entry.name;
			const isDir = entry.type === "directory";
			const icon = isDir ? "📁" : iconFor(entry.name, entry.type);
			const paddingLeft = 8 + level * 16;
			const expanded = state.expandedDirs[fullPath] || false;
			const children = state.files[fullPath] || null;
			const [loading, setLoading] = react.useState(false);
			// 依赖里带上刷新序号：用户点「刷新」时缓存被清空，已展开的文件夹靠它重新读一次盘，
			// 否则组件实例被复用、展开状态没变，子项会一直停在旧内容上。
			react.useEffect(function() {
				if (!isDir || !expanded || children || loading) return;
				setLoading(true);
				rpcCall("listDir", { path: toAbs(fullPath) }).then(function(result) {
					state.files[fullPath] = result.entries;
					setLoading(false);
					onEntryClick();
				}).catch(function(e) {
					console.error("[side-coder] listDir error:", e);
					setLoading(false);
				});
			}, [expanded, props.refreshTick]);
			function handleClick(event) {
				// 记录当前目录作为 Ctrl+V 粘贴目标：点目录=该目录，点文件=父目录。
				state.lastTreeDir = isDir ? fullPath : parentPath;
				// 文件树多选：Ctrl=切换复选；Shift=从锚点区间选择；普通=单选并打开/展开。
				if (isDir && !event.ctrlKey && !event.shiftKey) {
					if (state.expandedDirs[fullPath]) {
						delete state.expandedDirs[fullPath];
						onEntryClick();
					} else {
						state.expandedDirs[fullPath] = true;
						onEntryClick();
						if (!children) {
							setLoading(true);
							rpcCall("listDir", { path: toAbs(fullPath) }).then(function(result) {
								state.files[fullPath] = result.entries;
								setLoading(false);
								onEntryClick();
							}).catch(function(e) {
								console.error("[side-coder] listDir error:", e);
								setLoading(false);
								delete state.expandedDirs[fullPath];
								onEntryClick();
							});
						}
					}
					return;
				}
				// 选择处理（文件或目录都支持复选/区间）
				const order = props.treeOrder || [];
				if (event.shiftKey) {
					const anchor = state.selectionAnchor;
					if (anchor != null && order.length > 0) {
						const ai = order.indexOf(anchor);
						const bi = order.indexOf(fullPath);
						if (ai >= 0 && bi >= 0) {
							const lo = Math.min(ai, bi);
							const hi = Math.max(ai, bi);
							state.selectedPaths = order.slice(lo, hi + 1);
						} else {
							state.selectedPaths = [fullPath];
						}
					} else {
						state.selectedPaths = [fullPath];
					}
					state.selectionAnchor = fullPath;
				} else if (event.ctrlKey) {
					const idx = state.selectedPaths.indexOf(fullPath);
					if (idx >= 0) {
						state.selectedPaths = state.selectedPaths.filter(function(p) {
							return p !== fullPath;
						});
					} else {
						state.selectedPaths = state.selectedPaths.concat([fullPath]);
					}
					state.selectionAnchor = fullPath;
				} else {
					state.selectedPaths = [fullPath];
					state.selectionAnchor = fullPath;
				}
				onEntryClick();
				if (!isDir && !event.ctrlKey && !event.shiftKey) props.onFileOpen(fullPath);
			}
			const items = [];
			const isSelected = state.selectedPaths.indexOf(fullPath) >= 0;
			// 渲染时按显示顺序登记到 treeOrder，供 Shift 区间选择使用。
			if (state._treeOrder) state._treeOrder.push(fullPath);
			items.push(react.createElement("div", {
				key: "item-" + fullPath,
				className: "dsh-cc-tree-item" + (isSelected ? " selected" : ""),
				style: { paddingLeft: paddingLeft + "px" },
				title: fullPath,
				onContextMenu: function(e) {
					e.preventDefault();
					e.stopPropagation();
					if (props.onEntryMenu) props.onEntryMenu(e, fullPath, isDir);
				},
				onClick: handleClick
			}, react.createElement("span", null, isDir ? expanded ? "▼ " : "▶ " : ""), react.createElement("span", null, icon + " "), react.createElement("span", null, entry.name)));
			if (isDir && expanded) {
				if (loading) items.push(react.createElement("div", {
					key: "loading-" + fullPath,
					className: "dsh-cc-tree-loading",
					style: { paddingLeft: paddingLeft + 20 + "px" }
				}, "加载中..."));
				else if (children) children.slice().sort(makeTreeComparator(props.sort)).forEach(function(child) {
					items.push(react.createElement(FileTreeEntry, {
						key: child.name,
						entry: child,
						parentPath: fullPath,
						level: level + 1,
						refreshTick: props.refreshTick,
						treeOrder: props.treeOrder,
						sort: props.sort,
						onEntryClick,
						onFileOpen: props.onFileOpen,
						onEntryMenu: props.onEntryMenu
					}));
				});
			}
			return react.createElement(react.Fragment, null, items);
		}
		/**
		* 文件树根组件：跟随当前会话工作区加载根目录。
		* @param props - 组件 props。
		*/
		function FileTree(props) {
			const onFileOpen = props.onFileOpen;
			const viewRef = react.useRef(null);
			const [, forceUpdate] = react.useState(0);
			const [rootEntries, setRootEntries] = react.useState([]);
			const [loading, setLoading] = react.useState(true);
			const [error, setError] = react.useState(null);
			// 当前会话工作目录：必须放进 React state，搜索 effect 才能以它为依赖重跑。
			// 若只读 state.root（普通对象字段），切会话时 root 变了也不会触发搜索重跑，
			// 会出现"用上一个会话的根目录去搜"的错配结果。
			const [rootPath, setRootPath] = react.useState(null);
			const sessionId = getCurrentSessionId();
			const [pendingSession, setPendingSession] = react.useState(sessionId);
			react.useEffect(function() {
				if (!sessions || !sessions.list || typeof sessions.list.subscribe !== "function") return;
				return sessions.list.subscribe(function() {
					const id = getCurrentSessionId();
					setPendingSession(function(prev) {
						return prev === id ? prev : id;
					});
				});
			}, []);
			react.useEffect(function() {
				if (!pendingSession) return;
				state.sessionId = pendingSession;
				state.files = {};
				state.expandedDirs = {};
				// 换会话即换工作目录：上一次的搜索结果与搜索词都属于旧根，一并清掉，
				// 否则新会话会带着旧关键词去搜（搜索结果列表还停留在旧目录的命中上）。
				state.searchResults = [];
				state.searchTruncated = false;
				state.searchLoading = false;
				state.searchQuery = "";
				setRootPath(null);
				setLoading(true);
				setError(null);
				setRootEntries([]);
			}, [pendingSession]);
			react.useEffect(function() {
				if (!pendingSession) {
					const timer = setInterval(function() {
						const id = getCurrentSessionId();
						if (id) {
							clearInterval(timer);
							setPendingSession(id);
						}
					}, 500);
					return function() {
						clearInterval(timer);
					};
				}
				let cancelled = false;
				rpcCall("describe", { sessionId: pendingSession }).then(function(result) {
					state.root = result.root;
					if (!cancelled) setRootPath(result.root);
					return rpcCall("listDir", { path: result.root });
				}).then(function(result) {
					if (!cancelled) {
						setRootEntries(result.entries);
						setLoading(false);
					}
				}).catch(function(e) {
					console.error("[side-coder] 初始化失败:", e);
					if (!cancelled) {
						setError(e instanceof Error ? e.message : String(e));
						setLoading(false);
					}
				});
				return function() {
					cancelled = true;
				};
			}, [pendingSession, props.refreshTick]);
			// 搜索 effect：查询串变化（含防抖后的提交与清空）时发起一次递归模糊搜索。
			// 未输入时直接清空结果，回到常规目录树视图。
			react.useEffect(function() {
				const keyword = String(props.query || "").trim();
				if (keyword.length === 0) {
					state.searchResults = [];
					state.searchTruncated = false;
					state.searchLoading = false;
					triggerUpdate();
					return;
				}
				if (!pendingSession || !rootPath) return;
				let cancelled = false;
				state.searchLoading = true;
				triggerUpdate();
				rpcCall("searchFiles", { root: rootPath, query: keyword }).then(function(result) {
					if (cancelled) return;
					state.searchResults = (result && result.results) || [];
					state.searchTruncated = !!(result && result.truncated);
					state.searchLoading = false;
					triggerUpdate();
				}).catch(function(e) {
					if (cancelled) return;
					console.error("[side-coder] 搜索失败:", e);
					state.searchResults = [];
					state.searchTruncated = false;
					state.searchLoading = false;
					triggerUpdate();
				});
				return function() {
					cancelled = true;
				};
			}, [props.query, pendingSession, rootPath]);
			function triggerUpdate() {
				forceUpdate(function(n) {
					return n + 1;
				});
			}
			// 点击树面板任意处时聚焦面板，确保 Ctrl+C/X/V/Delete 键盘操作生效
			// （不聚焦时按键事件落在面板外，快捷键被吞）。
			function focusTree() {
				if (viewRef.current) viewRef.current.focus();
			}
			// 顶部工具条（搜索框 + 排序下拉）在任何状态下都常驻，避免加载/报错时输入框闪没。
			const toolbar = react.createElement("div", {
				className: "dsh-cc-tree-bar",
				onMouseDown: function(e) {
					// 工具条内的输入框与下拉自行处理焦点，不要触发树的聚焦与选中逻辑。
					e.stopPropagation();
				}
			}, react.createElement(FileSearchBar, {
				// key 绑定会话：切会话时强制重挂载，把输入框里的旧关键词一并清掉，
				// 否则组件实例被复用、本地 text 仍是上一个会话的搜索词。
				key: "cc-search-" + (pendingSession || "none"),
				query: props.query,
				onQueryChange: props.onQueryChange
			}), react.createElement(SortSelect, {
				value: props.sort,
				onChange: props.onSortChange
			}));
			/**
			* 把工具条与主体内容组装成文件栏外壳。
			* @param body - 工具条下方的主体节点。
			*/
			function shell(body) {
				return react.createElement("div", { className: "dsh-cc-tree-wrap" }, toolbar, body);
			}
			if (!pendingSession) return shell(react.createElement("div", { className: "dsh-cc-tree-loading" }, "等待会话就绪..."));
			if (loading) return shell(react.createElement("div", { className: "dsh-cc-tree-loading" }, "加载中..."));
			if (error) return shell(react.createElement("div", { className: "dsh-cc-tree-loading" }, "文件树加载失败: " + error));
			// 渲染期间按显示顺序收集全部可见条目路径，供 Shift 区间选择使用。
			const treeOrder = [];
			state._treeOrder = treeOrder;
			/**
			* 树面板键盘操作：Delete 删除选中、Ctrl+C 复制、Ctrl+X 剪切、Ctrl+V 粘贴。
			* @param event - 键盘事件。
			*/
			function handleTreeKeyDown(event) {
				const sel = state.selectedPaths || [];
				if (event.key === "Delete" && sel.length > 0) {
					event.preventDefault();
					event.stopPropagation();
					if (window.confirm("删除选中的 " + sel.length + " 个条目？此操作不可恢复。")) {
						deleteSelected(sel);
					}
					return;
				}
				if ((event.ctrlKey || event.metaKey) && event.key === "c" && sel.length > 0) {
					event.preventDefault();
					event.stopPropagation();
					state.fileClipboard = { op: "copy", paths: sel.slice() };
					return;
				}
				if ((event.ctrlKey || event.metaKey) && event.key === "x" && sel.length > 0) {
					event.preventDefault();
					event.stopPropagation();
					state.fileClipboard = { op: "cut", paths: sel.slice() };
					return;
				}
				if ((event.ctrlKey || event.metaKey) && event.key === "v" && state.fileClipboard) {
					event.preventDefault();
					event.stopPropagation();
					pasteClipboardTo(state.lastTreeDir || "");
				}
			}
			const keyword = String(props.query || "").trim();
			if (keyword.length > 0) {
				return shell(react.createElement("div", { className: "dsh-cc-search-results" }, (function() {
					if (state.searchLoading) return react.createElement("div", { className: "dsh-cc-search-meta" }, "搜索中…");
					const hits = state.searchResults || [];
					if (hits.length === 0) return react.createElement("div", { className: "dsh-cc-search-meta" }, "没有匹配「" + keyword + "」的文件");
					const rows = hits.map(function(item) {
						return react.createElement(SearchResultRow, {
							key: item.relativePath,
							item,
							onOpen: onFileOpen,
							onEntryMenu: props.onEntryMenu
						});
					});
					rows.push(react.createElement("div", {
						key: "dsh-cc-search-meta",
						className: "dsh-cc-search-meta"
					}, "共 " + hits.length + " 个匹配" + (state.searchTruncated ? "（已截断，请收窄关键词）" : "")));
					return rows;
				})()));
			}
			// 常规目录树：根目录按用户选择的排序方式重排（子目录在 FileTreeEntry 内同样重排）。
			const sortedRootEntries = rootEntries.slice().sort(makeTreeComparator(props.sort));
			return shell(react.createElement("div", {
				className: "dsh-cc-tree-view",
				tabIndex: 0,
				ref: viewRef,
				onClick: focusTree,
				onMouseDown: function(e) {
					e.preventDefault();
					focusTree();
				},
				onKeyDown: handleTreeKeyDown
			}, sortedRootEntries.map(function(entry) {
				return react.createElement(FileTreeEntry, {
					key: entry.name,
					entry,
					parentPath: "",
					level: 0,
					treeOrder,
					sort: props.sort,
					onEntryClick: triggerUpdate,
					onFileOpen,
					onEntryMenu: props.onEntryMenu
				});
			})));
		}
		/**
		* 标签栏：渲染已打开文件，含修改标记与关闭按钮。
		* @param props - 组件 props。
		*/
		function TabBar(props) {
			const tabsRef = react.useRef(null);
			// 当前文件标签被横向滚动条挤出可视区时，自动把标签栏滚到它身上：
			// 切标签/打开新文件后，活动标签始终可见并聚焦。
			react.useEffect(function() {
				const container = tabsRef.current;
				if (!container) return;
				const activeEl = container.querySelector('[data-active="true"]');
				if (activeEl && activeEl.scrollIntoView) activeEl.scrollIntoView({ inline: "nearest", block: "nearest" });
			}, [state.activeTab]);
			return react.createElement("div", attrs({ className: "dsh-cc-tabs", ref: tabsRef }), state.openTabs.map(function(tab) {
				const name = tab.path.split(/[\\/]/).pop() || "";
				const isActive = samePath(tab.path, state.activeTab);
				return react.createElement("div", attrs({
					key: tab.path,
					className: "dsh-cc-tab",
					"data-active": isActive ? "true" : "false",
					onClick: function() {
						props.onTabSelect(tab.path);
					},
					onContextMenu: function(e) {
						e.preventDefault();
						e.stopPropagation();
						if (props.onTabContextMenu) props.onTabContextMenu(e, tab.path);
					}
				}), react.createElement("span", null, iconFor(name, "file") + " "), react.createElement("span", null, name), tab.modified ? react.createElement("span", { className: "dsh-cc-tab-modified" }, " ●") : null, react.createElement("button", {
					className: "dsh-cc-tab-close",
					onClick: function(e) {
						e.stopPropagation();
						props.onTabClose(tab.path);
					}
				}, "×"));
			}));
		}
		/**
		* 当前文件绝对路径横条：位于标签栏与编辑器之间，展示选中文件的完整路径。
		* @param props - 无（路径直接读 state.activeTab）。
		*/
		function PathBar() {
			const active = state.activeTab;
			const abs = active ? toAbs(active) : "";
			return react.createElement("div", { className: "dsh-cc-pathbar", title: abs || "未打开文件" }, react.createElement("span", { className: "dsh-cc-pathbar-icon" }, "📄"), react.createElement("span", null, abs || "（未打开文件）"));
		}
		/**
		* Vditor 只读预览面板：以本地 /side-coder-vditor 资源渲染 Markdown。
		* 数据源语义：若 Monaco 编辑器已就绪且持有当前文件模型，取 getValue()（含未保存编辑），否则取标签内容。
		* 渲染完成后 options.after 只表示异步脚本已发起，mermaid/katex 需在 DOM 轮询确认。
		* @param props - path=当前文件路径；md=标签内容；active=预览是否生效。
		*/
		function VditorPreview(props) {
			const boxRef = react.useRef(null);
			const darkRef = react.useRef(isDarkTheme());
			const scriptLoadedRef = react.useRef(false);
			const scriptLoadingRef = react.useRef(null);
			const renderTokenRef = react.useRef(0);
			// 暗色跟随：监听 body[data-ds-dark-theme] 变化后重渲染。
			react.useEffect(function() {
				if (state._vditorThemeObs) return;
				state._vditorThemeObs = new MutationObserver(function() {
					const next = isDarkTheme();
					if (next !== darkRef.current) {
						darkRef.current = next;
						if (state._renderPreview) state._renderPreview();
					}
				});
				state._vditorThemeObs.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
				return function() {
					if (state._vditorThemeObs) {
						state._vditorThemeObs.disconnect();
						state._vditorThemeObs = null;
					}
				};
			}, []);
			function loadScriptClassic(url) {
				// 部分资源是 UMD：本界面已加载 Monaco 的 AMD 运行时（window.require+define），
				// 直接 append <script> 会被 AMD 捕获、登记成未执行模块，目标全局对象（如 window.Vditor/katex）永不挂载。
				// 故用 fetch + 直接 eval 强制以经典脚本执行（同步完成，无竞态），期间临时清掉 define/module。
				return fetch(url).then(function(resp) {
					if (!resp.ok) throw new Error("资源 HTTP " + resp.status + ": " + url);
					return resp.text();
				}).then(function(text) {
					const savedDefine = window.define;
					const savedModule = window.module;
					window.define = void 0;
					window.module = void 0;
					try {
						(0, eval)(text);
					} finally {
						if (savedDefine !== void 0) window.define = savedDefine; else delete window.define;
						if (savedModule !== void 0) window.module = savedModule; else delete window.module;
					}
				});
			}
			function loadVditor() {
				if (scriptLoadedRef.current) return Promise.resolve();
				if (scriptLoadingRef.current) return scriptLoadingRef.current;
				const base = VDITOR_CDN + "/dist";
				// method.min.js 与 katex.min.js 均为 UMD（会被 AMD 捕获）。
				// 先以经典脚本方式装载 Vditor 本身与 KaTeX（后者是 math 渲染所需的 window.katex 全局），
				// 其余资源（lute/mermaid/hljs 等）沿用 Vditor 内部脚本装载（实测可正常挂载全局）。
				scriptLoadingRef.current = Promise.all([
					loadScriptClassic(base + "/method.min.js"),
					loadScriptClassic(base + "/js/katex/katex.min.js")
				]).then(function() {
					if (!window.Vditor) throw new Error("Vditor 挂载失败");
				}).then(function() {
					scriptLoadedRef.current = true;
					scriptLoadingRef.current = null;
				});
				return scriptLoadingRef.current;
			}
			function renderPreview() {
				const box = boxRef.current;
				if (!box || !window.Vditor) return;
				const dark = darkRef.current;
				// 渲染令牌：翻转即表示一次新的渲染开始，旧渲染的轮询回调据此提前退出。
				const token = ++renderTokenRef.current;
				// 数据源：编辑器就绪且持有当前文件 → getValue()（含未保存编辑），否则回退标签内容。
				let content = props.md || "";
				const editor = state._editorInstance;
				const activeTab = state.activeTab;
				// showFileInEditor 让当前 Monaco 模型恒等于 state.activeTab 文件；
				// 仅当活动标签就是被预览文件时才用 getValue（含未保存编辑），否则回退标签内容。
				if (activeTab && props.path && samePath(activeTab, props.path) && editor && !editor.isDisposed && editor.getModel()) {
					content = editor.getValue();
				}
				const base = VDITOR_CDN + "/dist";
				// 暗色需要的样式表，幂等挂载于 head，避免重复插入。
				// 主排版样式(index.css)需宿主自行引入；content-theme 与 hljs 主题由 Vditor 按
				// theme.current / hljs.style 自行加载并在主题切换时替换，避免我方冗余样式表残留冲突。
				ensureVditorBaseSheet();
				window.Vditor.preview(box, content, {
					cdn: VDITOR_CDN,
					mode: dark ? "dark" : "light",
					theme: { current: dark ? "dark" : "light", path: base + "/css/content-theme" },
					hljs: { style: dark ? "github-dark" : "github" },
					icon: "ant",
					i18n: {},
					markdown: { sanitize: true },
					after: function() {
						// after 只表示异步脚本已发起；mermaid/katex 的实际渲染由 Vditor 内部完成，
						// 渲染竞态由 renderToken 防重入兜底，此处无需再介入 DOM 轮询。
					}
				}).catch(function(e) {
					if (token === renderTokenRef.current) console.error("[side-coder] 预览渲染失败:", e);
				});
			}
			react.useEffect(function() {
				state._renderPreview = renderPreview;
				loadVditor().then(function() {
					if (boxRef.current) renderPreview();
				}).catch(function(e) {
					console.error("[side-coder] Vditor 加载失败:", e);
				});
				return function() {
					if (state._renderPreview === renderPreview) state._renderPreview = null;
					renderTokenRef.current++;
				};
			}, [props.md, props.path, props.active]);
			return react.createElement("div", {
				ref: boxRef,
				className: "dsh-cc-preview vditor-reset"
			});
		}
		/**
		* Monaco 编辑器面板：负责编辑器实例生命周期、文件打开与保存。
		* @param props - 组件 props。
		*/
		function EditorPanel(props) {
			const editorRef = react.useRef(null);
			const editorInstanceRef = react.useRef(null);
			const currentModelRef = react.useRef(null);
			react.useEffect(function() {
				if (editorRef.current && !editorInstanceRef.current) loadMonaco().then(function() {
					if (editorRef.current && !editorInstanceRef.current) createEditor(editorRef.current);
				}).catch(function(e) {
					console.error("[side-coder] Monaco 加载失败:", e);
				});
			});
			react.useEffect(function() {
				if (!state._themeObserver) {
					state._themeObserver = new MutationObserver(function() {
						if (state._editorInstance) state._editorInstance.setTheme(isDarkTheme() ? "vs-dark" : "vs");
					});
					state._themeObserver.observe(document.body, {
						attributes: true,
						attributeFilter: ["data-ds-dark-theme"]
					});
				}
				return function() {
					if (editorInstanceRef.current) {
						editorInstanceRef.current.dispose();
						editorInstanceRef.current = null;
					}
					if (state._editorInstance) state._editorInstance = null;
				};
			}, []);
			const hasTabs = state.openTabs.length > 0;
			react.useEffect(function() {
				if (!hasTabs && editorInstanceRef.current) {
					editorInstanceRef.current.dispose();
					editorInstanceRef.current = null;
					if (state._editorInstance) state._editorInstance = null;
					if (currentModelRef.current) {
						currentModelRef.current.dispose();
						currentModelRef.current = null;
					}
				}
			}, [hasTabs]);
			/**
			* 创建 Monaco 实例并接线 Ctrl+S、内容变更与挂起文件。
			* @param container - 编辑器容器元素。
			*/
			function createEditor(container) {
				editorInstanceRef.current = window.monaco.editor.create(container, {
					value: "// 欢迎使用侧栏编程!\n// 从左侧文件树打开文件开始编辑\n// Ctrl+S 保存文件\n",
					language: "plaintext",
					theme: isDarkTheme() ? "vs-dark" : "vs",
					fontSize: 14,
					fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
					minimap: { enabled: true },
					scrollBeyondLastLine: false,
					automaticLayout: true,
					tabSize: 2,
					wordWrap: "on",
					lineNumbers: "on"
				});
				state._editorInstance = editorInstanceRef.current;
				editorInstanceRef.current.addCommand(window.monaco.KeyMod.CtrlCmd | window.monaco.KeyCode.KeyS, function() {
					if (state.activeTab) saveFile(state.activeTab);
				});
				if (state.activeTab) {
					const current = findOpenTab(state.activeTab);
					if (current) {
						currentModelRef.current = window.monaco.editor.createModel(current.content, langByPath(current.path));
						editorInstanceRef.current.setModel(currentModelRef.current);
					}
				}
				if (state._pendingShowPath) {
					const pending = state._pendingShowPath;
					state._pendingShowPath = null;
					showFileInEditor(pending);
				}
				editorInstanceRef.current.onDidChangeModelContent(function() {
					if (!state.activeTab) return;
					const tab = findOpenTab(state.activeTab);
					if (tab && editorInstanceRef.current) {
						tab.content = editorInstanceRef.current.getValue();
						tab.modified = true;
						refresh();
					}
				});
			}
			/**
			* 打开文件：已打开则切标签，否则读盘后新建标签。
			* 路径先经 canonicalTabPath 归一，同一文件无论从文件树、消息流尾巴还是改动跳转进来
			* 都只占一个标签；读盘期间重复进入也只登记一次，杜绝同名重复标签。
			* @param filePath - 文件树内相对路径或绝对路径。
			*/
			function openFile(filePath) {
				const tabPath = canonicalTabPath(filePath);
				const existing = findOpenTab(tabPath);
				if (existing) {
					state.activeTab = existing.path;
					showFileInEditor(existing.path);
					refresh();
					return;
				}
				// 在飞键用归一后的标签路径而非绝对路径：root 就绪前后同一文件仍是同一个键。
				const inflightKey = tabPath.toLowerCase();
				const inflight = state._openingTabs && state._openingTabs[inflightKey];
				if (inflight) return;
				if (!state._openingTabs) state._openingTabs = {};
				state._openingTabs[inflightKey] = tabPath;
				rpcCall("readFile", { path: toAbs(tabPath) }).then(function(result) {
					delete state._openingTabs[inflightKey];
					// 读盘期间可能已被别的入口打开：复用既有标签，不再新增。
					const opened = findOpenTab(tabPath);
					if (opened) {
						state.activeTab = opened.path;
						showFileInEditor(opened.path);
						refresh();
						return;
					}
					state.openTabs.push({
						path: tabPath,
						content: result.content,
						modified: false
					});
					state.activeTab = tabPath;
					showFileInEditor(tabPath);
					refresh();
				}).catch(function(e) {
					delete state._openingTabs[inflightKey];
					console.error("[side-coder] 读取文件失败:", filePath, e);
					refresh();
				});
			}
			/**
			* 保存文件：写盘后清修改标记。
			* @param filePath - 文件树内相对路径。
			*/
			function saveFile(filePath) {
				const tab = findOpenTab(filePath);
				if (!tab) return;
				if (editorInstanceRef.current && samePath(tab.path, state.activeTab)) tab.content = editorInstanceRef.current.getValue();
				rpcCall("writeFile", {
					path: toAbs(tab.path),
					content: tab.content
				}).then(function() {
					tab.modified = false;
					props.onStatusChange("✅ 已保存: " + tab.path);
					refresh();
				}).catch(function(e) {
					console.error("[side-coder] 保存失败:", filePath, e);
					props.onStatusChange("❌ 保存失败: " + tab.path);
				});
			}
			function showFileInEditor(filePath) {
				if (!editorInstanceRef.current) {
					state._pendingShowPath = filePath;
					return;
				}
				const tab = findOpenTab(filePath);
				if (!tab) return;
				if (currentModelRef.current) currentModelRef.current.dispose();
				currentModelRef.current = window.monaco.editor.createModel(tab.content, langByPath(tab.path));
				editorInstanceRef.current.setModel(currentModelRef.current);
				props.onStatusChange(tab.path);
				refresh();
			}
			react.useEffect(function() {
				state._openFile = openFile;
				state._saveFile = saveFile;
				return function() {
					state._openFile = null;
					state._saveFile = null;
				};
			});
			return react.createElement("div", { className: "dsh-cc-editor-panel", "data-diff-active": props.diffDetail ? "true" : "false", "data-preview-active": (props.preview && props.previewPath && isMarkdownPath(props.previewPath) && !props.diffDetail) ? "true" : "false" }, hasTabs ? react.createElement("div", {
				ref: editorRef,
				className: "dsh-cc-editor"
			}) : react.createElement("div", { className: "dsh-cc-editor-placeholder" }, "从左侧文件树打开文件开始编辑"), props.preview && props.previewPath && isMarkdownPath(props.previewPath) && !props.diffDetail ? react.createElement(VditorPreview, {
				path: props.previewPath,
				md: (findOpenTab(props.previewPath) || {}).content || "",
				active: !!props.preview
			}) : null, props.diffDetail ? react.createElement(DiffOverlay, {
				detail: props.diffDetail,
				follow: props.follow,
				onClose: props.onDiffClose,
				onAdvanceBaseline: props.onAdvanceBaseline,
				onRetreatBaseline: props.onRetreatBaseline,
				onAdvanceLatestBaseline: props.onAdvanceLatestBaseline,
				onRetreatStartBaseline: props.onRetreatStartBaseline
			}) : null);
		}
		/**
		* 编辑器区改动对比浮层：在编辑器上方直接呈现红绿对比，✕ 退回普通编辑。
		* @param props - detail=改动详情（含 before/after 全文）；onClose=退出对比回调。
		*/
		function DiffOverlay(props) {
			const boxRef = react.useRef(null);
			const diffRef = react.useRef(null);
			const modelsRef = react.useRef({ original: null, modified: null });
			const detail = props.detail;
			// 以内容签名做 effect 依赖：detail 对象每次轮询可能是新引用，但只要 before/after/path 没变，
			// 就不销毁重建 diff 编辑器——根治"每几秒闪一下、行位置重排"。
			const sig = (detail ? [detail.path, detail.before, detail.after, detail.kind, detail.time].join("\u0001") : "") + (detail.base ? "\u0002" + detail.base : "");
			react.useEffect(function() {
				let cancelled = false;
				// 跟随定位留下的定时重试与尺寸监听，退出对比时统一停掉；未就绪时为空函数。
				let alignCleanup = null;
				loadMonaco().then(function() {
					if (cancelled || !boxRef.current) return;
					diffRef.current = window.monaco.editor.createDiffEditor(boxRef.current, {
						readOnly: true,
						renderSideBySide: false,
						automaticLayout: true,
						theme: isDarkTheme() ? "vs-dark" : "vs",
						minimap: { enabled: false },
						scrollBeyondLastLine: false,
						originalEditable: false
					});
					const lang = langByPath(detail.path || "");
					modelsRef.current.original = window.monaco.editor.createModel(detail.before == null ? "" : detail.before, lang);
					modelsRef.current.modified = window.monaco.editor.createModel(detail.after == null ? "" : detail.after, lang);
					diffRef.current.setModel({
						original: modelsRef.current.original,
						modified: modelsRef.current.modified
					});
					// 对比编辑器就绪后，隐藏"生成中"占位（绝对定位占位会盖住 Monaco，必须移除）。
					try {
						const ph = boxRef.current && boxRef.current.querySelector(".dsh-cc-diff-overlay-placeholder");
						if (ph && ph.parentNode) ph.parentNode.removeChild(ph);
					} catch (e) {}
					// 跟随激活时：把 diff 视口定位到第一处改动，用户不用自己找改在哪一行。
					// 定位时机不能只赌"创建完就到位"：diff 是后台异步算出来的，容器高度也要等排版落地，
					// 一次性延迟定位常在这之前执行、拿不到改动行。这里改为三重保障——
					// ① 订阅"diff 算完"事件，算完即定位（最准）；
					// ② 定时重试若干次，兜住事件偶发丢失；
					// ③ 容器尺寸变化时重新定位（面板拉宽、下方列表行数增减都会改高度）。
					// 定位落点：改动块能放进可视窗就居中显示；放不下就把改动行顶到窗口上沿，从改动处看起。
					if (props.follow) {
						let alignRetryTimer = null;
						let alignRetryCount = 0;
						let alignResizeObserver = null;
						let alignDiffListener = null;
						/**
						* 把 diff 视口对准第一处改动：能放下就居中，放不下就把改动行顶到窗口上沿。
						* 返回 true 表示这次真的对上了；diff 还没算完（取不到改动块）返回 false，交给重试兜底。
						*/
						function alignToFirstChange() {
							if (!diffRef.current || cancelled) return true;
							try {
								const lineChanges = (diffRef.current.getLineChanges && diffRef.current.getLineChanges()) || [];
								const firstChange = lineChanges[0];
								if (!firstChange) return false;
								const modEditor = diffRef.current.getModifiedEditor && diffRef.current.getModifiedEditor();
								if (!modEditor) return false;
								// 该改动块在修改侧覆盖的行数；拿不到 end 时按单行处理。
								const startLine = firstChange.modifiedStartLineNumber;
								const endLine = firstChange.modifiedEndLineNumber || startLine;
								if (!startLine) return false;
								// 可视区能容纳的行数：容器高度 ÷ 行高。
								let visibleLines = 1;
								try {
									const layout = modEditor.getLayoutInfo && modEditor.getLayoutInfo();
									const lineHeight = layout && layout.lineHeight || 20;
									const boxHeight = boxRef.current ? boxRef.current.clientHeight : 0;
									visibleLines = boxHeight > 0 ? Math.max(1, Math.floor(boxHeight / lineHeight)) : 1;
								} catch (e) {
									console.error("[side-coder] 跟随可视行数计算失败:", e);
								}
								const changeLineCount = Math.max(startLine, endLine) - startLine + 1;
								if (changeLineCount > visibleLines) {
									// diff 比窗口高：滚动条停在 diff 开头，顶部对齐第一处改动行。
									if (modEditor.revealLineAtTop) modEditor.revealLineAtTop(startLine);
									else modEditor.revealLineInCenter(startLine);
								} else {
									// diff 在窗口内能放下：视图中心对准改动行，让改动落在窗口中部。
									if (modEditor.revealLineInCenter) modEditor.revealLineInCenter(startLine);
								}
								return true;
							} catch (e) {
								console.error("[side-coder] 跟随定位失败:", e);
								return true;
							}
						}
						/**
						* 再试一次定位：diff 算完、行高就绪、容器量到真实高度，都可能晚于首次调用。
						* 对上了就不再排下一次；连续没对上超过上限也停下，不无限空转。
						*/
						function retryAlignToFirstChange() {
							if (cancelled) return;
							if (alignToFirstChange()) return;
							if (alignRetryCount >= FOLLOW_ALIGN_RETRY_COUNT) return;
							alignRetryCount += 1;
							alignRetryTimer = setTimeout(retryAlignToFirstChange, FOLLOW_ALIGN_RETRY_MS);
						}
						// 订阅 diff 算完事件：这是最可靠的定位时机，比掐时间等更准。
						try {
							if (diffRef.current.onDidUpdateDiff) alignDiffListener = diffRef.current.onDidUpdateDiff(retryAlignToFirstChange);
						} catch (e) {
							console.error("[side-coder] 订阅 diff 算完事件失败:", e);
						}
						setTimeout(retryAlignToFirstChange, 0);
						// 容器尺寸变了（面板拉宽、下方列表行数变化）也要重新对准，否则改动行会被挤出可视区。
						if (typeof ResizeObserver === "function" && boxRef.current) {
							alignResizeObserver = new ResizeObserver(function() {
								alignRetryCount = 0;
								retryAlignToFirstChange();
							});
							alignResizeObserver.observe(boxRef.current);
						}
						alignCleanup = function() {
							if (alignRetryTimer) {
								clearTimeout(alignRetryTimer);
								alignRetryTimer = null;
							}
							if (alignDiffListener && alignDiffListener.dispose) {
								alignDiffListener.dispose();
								alignDiffListener = null;
							}
							if (alignResizeObserver) {
								alignResizeObserver.disconnect();
								alignResizeObserver = null;
							}
						};
					}
				}).catch(function(e) {
					console.error("[side-coder] 对比浮层加载失败:", e);
				});
				return function() {
					cancelled = true;
					if (alignCleanup) {
						alignCleanup();
						alignCleanup = null;
					}
					if (modelsRef.current.original) {
						modelsRef.current.original.dispose();
						modelsRef.current.original = null;
					}
					if (modelsRef.current.modified) {
						modelsRef.current.modified.dispose();
						modelsRef.current.modified = null;
					}
					if (diffRef.current) {
						diffRef.current.dispose();
						diffRef.current = null;
					}
				};
			}, [sig]);
			return react.createElement("div", { className: "dsh-cc-diff-overlay" }, react.createElement("div", { className: "dsh-cc-diff-overlay-bar" }, react.createElement("span", {
				className: "dsh-cc-diff-overlay-title"
			}, "🟢🔴 改动对比 · " + baseName(detail.path || "") + " · " + formatTime(detail.time)), react.createElement("button", attrs({
				className: "dsh-cc-diff-btn",
				title: "基线后退到最初：把基线退回会话最开始，从头看整段改动",
				disabled: !(detail.baselinePos > 0),
				onClick: props.onRetreatStartBaseline
			}), "⏮ 到最初"), react.createElement("button", attrs({
				className: "dsh-cc-diff-btn",
				title: "基线后退一步：基线回退一档，之前被确认的那次改动重新显示",
				disabled: !(detail.baselinePos > 0),
				onClick: props.onRetreatBaseline
			}), "↖ 后退"), react.createElement("button", attrs({
				className: "dsh-cc-diff-btn",
				title: "基线前进一步：基线向前一档，少看一步历史改动",
				disabled: !(detail.baselinePos != null && detail.chainLength != null && detail.baselinePos < detail.chainLength - 1),
				onClick: props.onAdvanceBaseline
			}), "↘ 前进"), react.createElement("button", attrs({
				className: "dsh-cc-diff-btn",
				title: "基线前进到最新：把基线推到当前版本，清空当前 diff，后续改动以它为基准",
				disabled: !(detail.baselinePos != null && detail.chainLength != null && detail.baselinePos < detail.chainLength - 1),
				onClick: props.onAdvanceLatestBaseline
			}), "⏭ 到最新"), react.createElement("button", attrs({
				className: "dsh-cc-diff-btn",
				title: "退出对比，回到普通编辑",
				onClick: props.onClose
			}), "✕ 退出对比")), react.createElement("div", {
				ref: boxRef,
				className: "dsh-cc-diff-overlay-box"
			}, react.createElement("div", { className: "dsh-cc-diff-overlay-placeholder" }, "对比内容生成中…")));
		}
		/**
		* 底部状态栏：显示当前文件路径或保存结果。
		* @param props - 组件 props。
		*/
		function StatusBar(props) {
			return react.createElement("div", { className: "dsh-cc-status" }, props.status);
		}
		/**
		* 实时改动对比条：轮询后台改动记录，选中改动后把详情交给编辑器区浮层呈现红绿对比。
		* @param props - follow=是否自动跟随新改动；activePath=当前编辑的文件；
		*               onToggleFollow=切换跟随；onAutoOpen=有新改动时展开对比条；
		*               onDetailChange=选中改动的详情变化通知（null=无选中）。
		*/
		function DiffPane(props) {
			const mountedRef = react.useRef(true);
			const lastSeenRef = react.useRef(null);
			// 上次展示的会话 id：切会话时把"已消费过"的锚点清掉，强制重新定位到新会话的最新改动
			// （需求3：切换到存在 diff 的会话，编辑器应跳向该会话最近改动的文件）。
			const scopedSessionRef = react.useRef(null);
			// 上次轮询得到的文件列表内容签名 + 已提交给 state 的数组引用；
			// 内容相同则复用同一份数组，避免假引用变化反复重建 diff。
			const changesStateRef = react.useRef({ sig: null, arr: null });
			const [groups, setGroups] = react.useState([]);
			const [fileChanges, setFileChanges] = react.useState([]);
			const [selectedPath, setSelectedPath] = react.useState(null);
			const [flash, setFlash] = react.useState(false);
			react.useEffect(function() {
				mountedRef.current = true;
				return function() {
					mountedRef.current = false;
				};
			}, []);
			react.useEffect(function() {
				let cancelled = false;
				// 把「会话组 → 扁平文件列表 → 选中逻辑」的统一落点抽出，分组端点与降级端点共用同一条消费链路。
				function applyGroups(groups, scopedSessionId) {
					if (cancelled || !mountedRef.current) return;
					// 会话切换：重置"已消费"锚点，让列表重新定位到这棵会话树的最新改动。
					if (scopedSessionRef.current !== scopedSessionId) {
						scopedSessionRef.current = scopedSessionId;
						lastSeenRef.current = null;
						delete state._autoselectAck;
					}
					// 激活"本会话"：只看当前会话的组；否则所有组都展示。
					let visibleGroups;
					if (props.currentSession && scopedSessionId) {
						visibleGroups = groups.filter(function(g) {
							return g.sessionId === scopedSessionId;
						});
					} else {
						visibleGroups = groups;
					}
					// 扁平文件列表（供 diff 详情/三角切换），按组顺序拼。
					const flatFiles = [];
					visibleGroups.forEach(function(g) {
						(g.files || []).forEach(function(f) {
							flatFiles.push(f);
						});
					});
					// 内容签名去重：任何层次的引用都不因假变化重建 diff。
					const sig = JSON.stringify(flatFiles.map(function(item) {
						return [item.path, item.sessionId, item.original, item.currentAfter, item.count, item.lastTime, item.tool];
					}));
					const prevRef = changesStateRef.current;
					const resolved = prevRef.sig === sig && prevRef.arr !== null ? prevRef.arr : flatFiles;
					changesStateRef.current = { sig, arr: resolved };
					setFileChanges(resolved);
					state.fileChanges = resolved;
					state.diffGroupsRef = visibleGroups;
					setGroups(visibleGroups);
					const top = resolved[0] || null;
					if (state._pendingChangePath) {
						const pendingPath = state._pendingChangePath;
						state._pendingChangePath = null;
						if (resolved.some(function(item) {
							return samePath(toAbs(item.path), toAbs(pendingPath));
						})) {
							lastSeenRef.current = 1;
							setSelectedPath(pendingPath);
							return;
						}
					}
					if (state._selectChangePath) {
						const wantedPath = state._selectChangePath;
						state._selectChangePath = null;
						if (resolved.some(function(item) {
							return samePath(toAbs(item.path), toAbs(wantedPath));
						})) {
							lastSeenRef.current = 1;
							setSelectedPath(wantedPath);
							return;
						}
					}
					if (!top) return;
					if (lastSeenRef.current === null) {
						lastSeenRef.current = 1;
						setSelectedPath(top.path);
						return;
					}
					if (props.follow && state._autoselectAck !== top.path) {
						state._autoselectAck = top.path;
						setSelectedPath(top.path);
						setFlash(true);
						setTimeout(function() {
							if (mountedRef.current) setFlash(false);
						}, 2000);
						if (props.onAutoOpen) props.onAutoOpen();
					}
				}
				function poll() {
					const scopedSessionId = getCurrentSessionId();
					// 优先会话分组端点；旧后端未提供该端点时降级到按文件端点，保证列表与浮层始终可用。
					rpcCall("listFileChangesGrouped", { currentSessionId: props.currentSession ? scopedSessionId : "" }).then(function(result) {
						applyGroups((result && result.groups) || [], scopedSessionId);
					}).catch(function() {
						rpcCall("listFileChanges", { sessionId: props.currentSession ? scopedSessionId : "" }).then(function(result) {
							const files = (result && result.files) || [];
							applyGroups([{ sessionId: scopedSessionId || "unknown", files: files }], scopedSessionId);
						}).catch(function() {});
					});
				}
				poll();
				const timer = setInterval(poll, POLL_INTERVAL_MS);
				return function() {
					cancelled = true;
					clearInterval(timer);
				};
			}, [props.follow, props.activePath, props.currentSession, props.pollTick]);
			react.useEffect(function() {
				if (!selectedPath) {
					if (props.onDetailChange) props.onDetailChange(null);
					return;
				}
				const current = fileChanges.find(function(item) {
					return samePath(toAbs(item.path), toAbs(selectedPath));
				});
				if (!current) {
					if (props.onDetailChange) props.onDetailChange(null);
					return;
				}
				if (props.onDetailChange) props.onDetailChange({
					path: current.path,
					before: current.original == null ? "" : current.original,
					after: current.currentAfter == null ? "" : current.currentAfter,
					time: current.lastTime,
					tool: current.tool,
					count: current.count,
					kind: current.original == null ? "patch" : "write",
					baselinePos: current.baselinePos,
					chainLength: current.chainLength
				});
			}, [selectedPath, fileChanges]);
			const current = fileChanges.find(function(item) {
				return samePath(toAbs(item.path), toAbs(selectedPath));
			}) || null;
			// 左右三角在已修改文件之间按最后修改先后顺序切换（列表本身按 lastTime 降序）。
			const currentIndex = current ? fileChanges.findIndex(function(item) {
				return samePath(toAbs(item.path), toAbs(selectedPath));
			}) : -1;
			function stepFile(delta) {
				if (fileChanges.length === 0) return;
				const next = ((currentIndex + delta) % fileChanges.length + fileChanges.length) % fileChanges.length;
				setSelectedPath(fileChanges[next].path);
			}
			// 改动类型徽章：git 式 A/M/D/R 字母徽章，色随类型。
			function changeKindBadge(kind) {
				const map = {
					added: { label: "A", cls: "ck-added", title: "新增" },
					modified: { label: "M", cls: "ck-modified", title: "修改" },
					deleted: { label: "D", cls: "ck-deleted", title: "删除" },
					renamed: { label: "R", cls: "ck-renamed", title: "重命名" }
				};
				const entry = map[kind] || map.modified;
				return react.createElement("span", { className: "dsh-cc-diff-file-icon " + entry.cls, title: entry.title }, entry.label);
			}
			function renderFileRow(item) {
				const isSelected = current != null && samePath(toAbs(item.path), toAbs(selectedPath));
				return react.createElement("button", attrs({
					key: item.path,
					className: "dsh-cc-diff-file" + (isSelected ? " active" : ""),
					title: item.path,
					onClick: function() {
						setSelectedPath(item.path);
					}
				}), changeKindBadge(item.changeKind), react.createElement("span", { className: "dsh-cc-diff-file-name" }, baseName(item.path)), react.createElement("span", { className: "dsh-cc-diff-file-meta" }, "改 " + item.count + " 次"), react.createElement("span", { className: "dsh-cc-diff-file-time" }, formatTime(item.lastTime)));
			}
			const title = current ? baseName(current.path) + " · 改 " + current.count + " 次 · " + formatTime(current.lastTime) : "本次会话还没有文件改动";
			return react.createElement("div", { className: "dsh-cc-diff" }, react.createElement("div", { className: "dsh-cc-diff-head" }, react.createElement("button", {
				className: "dsh-cc-diff-btn",
				title: "上一个被修改的文件",
				onClick: function() {
					stepFile(1);
				}
			}, "◀"), react.createElement("button", {
				className: "dsh-cc-diff-btn",
				title: "下一个被修改的文件",
				onClick: function() {
					stepFile(-1);
				}
			}, "▶"), react.createElement("span", attrs({
				className: "dsh-cc-diff-title" + (flash ? " dsh-cc-diff-flash" : ""),
				title: current ? current.path : ""
			}), flash ? "● 新改动 · " : "", title)), react.createElement("div", { className: "dsh-cc-diff-files" }, (function() {
				const scopedSessionId = getCurrentSessionId();
				// 只有关掉"本会话"且出现多个会话组时才显示会话分组标题；否则扁平展示当前会话文件。
				const flatMode = props.currentSession || groups.length <= 1;
				const rows = [];
				if (flatMode) {
					groups.forEach(function(g) {
						(g.files || []).forEach(function(item) {
							rows.push(renderFileRow(item));
						});
					});
				} else {
					groups.forEach(function(g) {
						const isCurrent = scopedSessionId != null && g.sessionId === scopedSessionId;
						rows.push(react.createElement("div", { key: "grp-" + g.sessionId, className: "dsh-cc-diff-group-head" },
							react.createElement("span", { className: "dsh-cc-diff-group-label" },
								isCurrent ? "● 本会话" : "会话 " + String(g.sessionId)),
							react.createElement("span", { className: "dsh-cc-diff-group-count" }, (g.files || []).length + " 个文件")));
						(g.files || []).forEach(function(item) {
							rows.push(renderFileRow(item));
						});
					});
				}
				return rows;
			})()));
		}
		/**
		* 复制一段文本到系统剪贴板；新式接口失败时退回老办法。
		* @param text - 要复制的文本。
		*/
		async function copyText(text) {
			try {
				if (navigator.clipboard && navigator.clipboard.writeText) {
					await navigator.clipboard.writeText(text);
					return true;
				}
			} catch {}
			try {
				const ta = document.createElement("textarea");
				ta.value = text;
				ta.style.position = "fixed";
				ta.style.opacity = "0";
				document.body.appendChild(ta);
				ta.select();
				document.execCommand("copy");
				ta.remove();
				return true;
			} catch {
				return false;
			}
		}
		/**
		* DSH @文件 的写法：无空格直接 @路径，带空格用 @"路径"；含控制符或引号则写不出。
		* @param relPath - 树内相对路径。
		*/
		function fileMentionText(relPath) {
			const p = String(relPath || "").replace(/[\\/]+$/, "");
			if (/[\u0000-\u001f\u007f-\u009f"]/.test(p)) return null;
			return /\s/.test(p) ? '@"' + p + '"' : "@" + p;
		}
		/**
		* 取树内路径的父目录；根层返回空串。
		* @param path - 树内相对路径。
		*/
		function parentDirOf(path) {
			const norm = String(path || "").replace(/\\/g, "/");
			const at = norm.lastIndexOf("/");
			return at === -1 ? "" : norm.slice(0, at);
		}
		/**
		* 把文件/文件夹加入对话输入框：文件走结构化引用（和 DSH 自带 @文件 同款），
		* 文件夹用 @目录/ 纯文本；拿不到会话输入服务时退化为把引用文本复制到剪贴板。
		* @param relPath - 树内相对路径。
		* @param isDir - 是否文件夹。
		*/
		function addToConversation(relPath, isDir) {
			const mention = isDir ? "@" + String(relPath).replace(/\\/g, "/").replace(/\/+$/, "") + "/" : fileMentionText(relPath);
			if (!mention) return;
			try {
				const pluginCtx = state._pluginCtx;
				const sessionId = getCurrentSessionId();
				const actx = pluginCtx && sessions && typeof sessions.scope === "function" && sessionId ? sessions.scope(sessionId) : null;
				const conversation = pluginCtx && typeof pluginCtx.get === "function" ? pluginCtx.get("conversation") : null;
				if (!actx || !conversation || !conversation.input) throw new Error("会话输入服务不可用");
				const input = conversation.input.for(actx);
				if (isDir || typeof actx.emit !== "function") {
					const before = input.state.getSnapshot().draft;
					const next = !before || before.trim() === "" ? mention : before + " " + mention;
					input.setDraft(next);
				} else {
					const before = input.state.getSnapshot();
					// span 坐标作用于编辑器的 detect 视图，而 snapshot.draft 是 clipboard 视图：
					// 每个已插入的结构化引用（chip）在 clipboard 视图占完整路径长度，在 detect 视图只占 1 个占位字符。
					// 直接用 draft.length 会在已有引用时坐标越界、第二个引用静默插不进去，
					// 故按「每个 chip 折叠成 1 字符」换算出 detect 视图的文档末尾坐标。
					const existingRefs = Array.isArray(before.occurrences) ? before.occurrences : [];
					let foldedChars = 0;
					for (let refIndex = 0; refIndex < existingRefs.length; refIndex += 1) {
						const refLen = existingRefs[refIndex] && typeof existingRefs[refIndex].length === "number" ? existingRefs[refIndex].length : 0;
						if (refLen > 1) foldedChars += refLen - 1;
					}
					const detectEnd = Math.max(0, before.draft.length - foldedChars);
					actx.emit("slash/input-insert-reference", {
						reference: {
							source: "reference",
							ref: mention,
							label: baseName(relPath),
							appearance: "file",
							clipboardText: mention
						},
						span: {
							draftRev: before.draftRev,
							start: detectEnd,
							end: detectEnd
						}
					});
				}
			} catch (e) {
				console.warn("[side-coder] 加入对话失败，改为复制引用文本:", e);
				copyText(mention);
			}
		}
		/**
		* 目录树缓存定向清理：被改动的条目、它的子孙与父级缓存全部作废，下次展开即重读。
		* @param prefix - 受影响的树内路径（空串=整棵树）。
		*/
		function settleTreeCache(prefix) {
			const norm = function(p) {
				return String(p || "").replace(/\//g, "\\").toLowerCase();
			};
			const pre = norm(prefix);
			Object.keys(state.files).forEach(function(key) {
				const k = norm(key);
				if (pre === "" || k === pre || k.startsWith(pre + "\\") || pre.startsWith(k + "\\")) delete state.files[key];
			});
			state.treeTick = (state.treeTick || 0) + 1;
			refresh();
		}
		/**
		* 粘贴剪贴板里的文件/文件夹到目标目录；重名时自动生成 " (1)" 后缀。
		* @param targetDir - 目标目录的树内路径（空串=工作区根）。
		*/
		function pasteInto(targetDir) {
			const clip = state.fileClipboard;
			if (!clip) return;
			const dest = targetDir ? targetDir + "/" + baseName(clip.path) : baseName(clip.path);
			const srcAbs = toAbs(clip.path);
			const destAbs = toAbs(dest);
			if (samePath(srcAbs, destAbs)) return;
			if (clip.isDir && destAbs.toLowerCase().startsWith(srcAbs.toLowerCase() + "\\")) return;
			// 目标已存在时改用唯一名（Windows 式 " (1)" 后缀），避免覆盖。
			rpcCall("listDir", { path: toAbs(targetDir || ".") }).then(function(dirResult) {
				const existing = (dirResult.entries || []).map(function(en) {
					return en.name;
				});
				const finalDest = uniqueDestPath(targetDir, baseName(clip.path), existing);
				const method = clip.op === "cut" ? "moveEntry" : "copyEntry";
				rpcCall(method, { from: srcAbs, to: toAbs(finalDest) }).then(function() {
					settleTreeCache(targetDir);
					if (clip.op === "cut") {
						state.fileClipboard = null;
						settleTreeCache(clip.path);
					}
				}).catch(function(e) {
					console.error("[side-coder] 粘贴失败:", e);
				});
			}).catch(function(e) {
				console.error("[side-coder] 粘贴目标目录读取失败:", e);
			});
		}
		/**
		* 删除文件/文件夹：关掉相关标签页，清缓存并刷新。
		* @param path - 树内相对路径。
		*/
		function deleteEntry(path) {
			rpcCall("deleteEntry", { path: toAbs(path) }).then(function() {
				const norm = function(p) {
					return String(p || "").replace(/\//g, "\\").toLowerCase();
				};
				const pre = norm(path);
				state.openTabs = state.openTabs.filter(function(t) {
					const k = norm(t.path);
					return !(k === pre || k.startsWith(pre + "\\"));
				});
				if (state.activeTab && !state.openTabs.some(function(t) {
					return samePath(t.path, state.activeTab);
				})) {
					const last = state.openTabs[state.openTabs.length - 1];
					state.activeTab = last ? last.path : null;
				}
				settleTreeCache(path);
			}).catch(function(e) {
				console.error("[side-coder] 删除失败:", e);
			});
		}
		/**
		* 文件树右键菜单：复制路径、加入对话、复制/剪切/粘贴、删除。
		* @param props - menu=菜单位置与目标条目；onClose=关闭回调。
		*/
		function ContextMenu(props) {
			const menu = props.menu;
			const ref = react.useRef(null);
			react.useEffect(function() {
				function onDown(e) {
					if (ref.current && !ref.current.contains(e.target)) props.onClose();
				}
				function onKey(e) {
					if (e.key === "Escape") props.onClose();
				}
				document.addEventListener("mousedown", onDown, true);
				document.addEventListener("keydown", onKey);
				return function() {
					document.removeEventListener("mousedown", onDown, true);
					document.removeEventListener("keydown", onKey);
				};
			}, []);
			const isRoot = samePath(toAbs(menu.path), state.root || "");
			const canPaste = !!state.fileClipboard;
			const isTab = menu.kind === "tab";
			const tabOps = props.tabOps || {};
			const items = isTab ? [
				{ id: "tclose", label: "✖ 关闭本文件", run: function() {
					if (tabOps.onTabClose) tabOps.onTabClose(menu.path);
				} },
				{ id: "tcloseothers", label: "⊘ 关闭所有（除本文件）", run: function() {
					if (tabOps.onCloseOthers) tabOps.onCloseOthers(menu.path);
				} },
				{ id: "tcloseall", label: "⛌ 关闭所有", run: function() {
					if (tabOps.onCloseAll) tabOps.onCloseAll();
				} },
				{ id: "sept", sep: true },
				{ id: "reveal", label: "📂 在文件资源管理器中查看", run: function() {
					if (tabOps.onReveal) tabOps.onReveal(menu.path);
				} },
				{ id: "ref", label: "💬 添加到对话", run: function() {
					addToConversation(menu.path, false);
				} },
				{ id: "rel", label: "📄 复制相对路径", run: function() {
					copyText(menu.path.replace(/\//g, "\\"));
				} },
				{ id: "abs", label: "📁 复制绝对路径", run: function() {
					copyText(toAbs(menu.path));
				} }
			] : [
				{ id: "rel", label: "📄 复制相对路径", run: function() {
					copyText(menu.path.replace(/\//g, "\\"));
				} },
				{ id: "abs", label: "📁 复制绝对路径", run: function() {
					copyText(toAbs(menu.path));
				} },
				{ id: "ref", label: "💬 添加到对话", run: function() {
					addToConversation(menu.path, menu.isDir);
				} },
				{ id: "reveal", label: "📂 在文件资源管理器中查看", run: function() {
					rpcCall("revealEntry", { path: toAbs(menu.path) }).catch(function(e) {
						console.error("[side-coder] 资源管理器打开失败:", menu.path, e);
					});
				} },
				{ id: "sep1", sep: true },
				{ id: "copy", label: "📋 复制", run: function() {
					if (state.selectedPaths && state.selectedPaths.length > 0) {
						state.fileClipboard = { op: "copy", paths: state.selectedPaths.slice() };
					} else {
						state.fileClipboard = { op: "copy", path: menu.path, isDir: menu.isDir };
					}
				} },
				{ id: "cut", label: "✂️ 剪切", disabled: isRoot, run: function() {
					if (state.selectedPaths && state.selectedPaths.length > 0) {
						state.fileClipboard = { op: "cut", paths: state.selectedPaths.slice() };
					} else {
						state.fileClipboard = { op: "cut", path: menu.path, isDir: menu.isDir };
					}
				} },
				{ id: "paste", label: "📥 粘贴", disabled: !canPaste, run: function() {
					if (state.fileClipboard && state.fileClipboard.paths) {
						pasteClipboardTo(menu.isDir ? menu.path : parentDirOf(menu.path));
					} else {
						pasteInto(menu.isDir ? menu.path : parentDirOf(menu.path));
					}
				} },
				{ id: "sep2", sep: true },
				{ id: "del", label: "🗑 删除", danger: true, disabled: isRoot, run: function() {
					if (state.selectedPaths && state.selectedPaths.length > 0) {
						if (window.confirm("删除选中的 " + state.selectedPaths.length + " 个条目？此操作不可恢复。")) deleteSelected(state.selectedPaths.slice());
					} else {
						if (window.confirm("删除「" + baseName(menu.path) + "」？此操作不可恢复。")) deleteEntry(menu.path);
					}
				} }
			];
			const left = Math.max(0, Math.min(menu.x, window.innerWidth - 220));
			const top = Math.max(0, Math.min(menu.y, window.innerHeight - 340));
			return react.createElement("div", attrs({
				className: "dsh-cc-menu",
				ref,
				style: { left: left + "px", top: top + "px" }
			}), items.map(function(item) {
				if (item.sep) return react.createElement("div", { key: item.id, className: "dsh-cc-menu-sep" });
				return react.createElement("button", attrs({
					key: item.id,
					className: "dsh-cc-menu-item" + (item.danger ? " danger" : "") + (item.disabled ? " disabled" : ""),
					onClick: function() {
						if (item.disabled) return;
						props.onClose();
						item.run();
					}
				}), item.label);
			}));
		}
		/** 插件树事件通道：服务端在插件重建时推送新版本。 */
		const PLUGIN_EVENTS_ENDPOINT = "/plugins/events";
		/**
		* 插件树版本监视器：插件加载即订阅事件通道，记住页面启动时的版本，
		* 之后任何插件热重载都标记为「页面已过期」。
		* Monaco 全局实例与 AMD 模块无法随热重载卸载，半热重载会让编辑器半残，
		* 整页刷新是唯一彻底恢复手段。单例持续监听，面板开关不中断。
		* @returns start=启动监听；subscribe=订阅过期状态，返回取消函数。
		*/
		function createUpdateWatch() {
			let baselineRev = null;
			let staleRev = null;
			const subscribers = new Set();
			function notify() {
				subscribers.forEach(function(callback) {
					callback(staleRev);
				});
			}
			function start() {
				let source;
				try {
					source = new EventSource(PLUGIN_EVENTS_ENDPOINT);
				} catch (e) {
					return;
				}
				source.addEventListener("message", function(event) {
					let payload;
					try {
						payload = JSON.parse(event.data);
					} catch (e) {
						return;
					}
					if (!payload) return;
					// 单个插件热重载：任何 rebuilt 都意味着页面脚本已落后磁盘版本。
					if (payload.type === "rebuilt") {
						if (staleRev === null) {
							staleRev = typeof payload.rev === "string" ? payload.rev : "rebuilt";
							notify();
						}
						return;
					}
					if (!payload.graph) return;
					const nextRev = payload.graph.rev;
					if (typeof nextRev !== "string") return;
					if (baselineRev === null) {
						baselineRev = nextRev;
						return;
					}
					if (nextRev !== baselineRev && staleRev === null) {
						staleRev = nextRev;
						notify();
					}
				});
			}
			function markStale(reason) {
				if (staleRev !== null) return;
				staleRev = reason || "self-reload";
				notify();
			}
			return {
				start,
				markStale,
				subscribe(callback) {
					subscribers.add(callback);
					callback(staleRev);
					return function() {
						subscribers.delete(callback);
					};
				}
			};
		}
		const updateWatch = createUpdateWatch();
		// 自我热重载检测：window 标记在整页加载后一直存在；factory 再次执行即热重载，
		// 此时旧 Monaco 全局实例已半残，新模块直接挂黄条。
		if (window.__sideCoderHotReloaded === true) {
			updateWatch.markStale("self-reload");
		}
		window.__sideCoderHotReloaded = true;
		/**
		* 整页刷新提示条：插件热重载后挂在面板顶部，一键整页刷新恢复完整界面。
		*/
		function UpdateBanner() {
			const [staleRev, setStaleRev] = react.useState(null);
			const [dismissed, setDismissed] = react.useState(false);
			react.useEffect(function() {
				return updateWatch.subscribe(setStaleRev);
			}, []);
			if (!staleRev || dismissed) return null;
			return react.createElement("div", {
				className: "dsh-cc-update-banner",
				role: "alert"
			}, react.createElement("span", {
				className: "dsh-cc-update-banner-icon",
				"aria-hidden": "true"
			}, "⚠️"), react.createElement("span", {
				className: "dsh-cc-update-banner-text"
			}, "插件刚更新过，编辑器可能显示不完整，建议刷新页面"), react.createElement("button", attrs({
				className: "dsh-cc-update-banner-btn",
				type: "button",
				onClick: function() {
					window.location.reload();
				}
			}), "立即刷新"), react.createElement("button", attrs({
				className: "dsh-cc-update-banner-close",
				type: "button",
				title: "暂不刷新",
				"aria-label": "暂不刷新",
				onClick: function() {
					setDismissed(true);
				}
			}), "✕"));
		}
		/** 右栏停靠面板：文件树 + 标签栏 + 编辑器 + 实时改动对比。 */
		function SideCoderPanel() {
			const [status, setStatus] = react.useState("就绪");
			const [diffOpen, setDiffOpen] = react.useState(read_toggle(TOGGLE_DIFF_OPEN, true));
			const [follow, setFollow] = react.useState(read_toggle(TOGGLE_FOLLOW, true));
			const [autoPopup, setAutoPopup] = react.useState(state.autoPopup !== false);
			const [currentSession, setCurrentSession] = react.useState(read_toggle(TOGGLE_CURRENT_SESSION, true));
			const [diffDetail, setDiffDetail] = react.useState(null);
			const [treeOpen, setTreeOpen] = react.useState(state.treeOpen !== false);
			const [preview, setPreview] = react.useState(false);
			// 基线前进/后退后的强制刷新序号：自增后传给 DiffPane 触发重新 poll，拿到新的 baselinePos。
			const [baselineTick, setBaselineTick] = react.useState(0);
			const [, forceUpdate] = react.useState(0);
			react.useEffect(function() {
				state._refresh = function() {
					forceUpdate(function(n) {
						return n + 1;
					});
				};
				return function() {
					state._refresh = null;
				};
			}, []);
			react.useEffect(function() {
				if (state._pendingOpenPath && state._openFile) {
					const pendingPath = state._pendingOpenPath;
					state._pendingOpenPath = null;
					handleFileOpen(toRel(pendingPath));
				}
				// 自动弹出不强行翻开「对比」：尊重用户记住的开关状态；
				// _pendingChangeId 保留着，用户手动点开「对比」时由对比区消费并直跳最新改动。
			});
			/**
			* 重新读取文件目录：清掉所有文件夹的内容记忆并让树整体重读一次。
			* 用于对话里新建/删除/改名文件后，把目录树拉回与磁盘一致。
			* 展开状态保留，刷新完还是原来展开的那几层。
			*/
			function refreshFileTree() {
				state.files = {};
				state.treeTick = (state.treeTick || 0) + 1;
				setStatus("🔄 已重新读取文件目录");
				refresh();
			}
			function handleDiffDetail(detail) {
				setDiffDetail(detail);
				// 选中文件整体对比时，自动把该文件切为当前标签，让编辑器就地显示它的 diff；
				// detail 为空（退出对比/无选中）时保持当前标签不动。
				if (detail && detail.path && state._openFile) {
					state._selectChangePath = detail.path;
					state._openFile(toRel(detail.path));
				}
			}
			/**
			* 基线移动：调后端端点移动当前文件的基线游标，成功后强制 DiffPane 重新 poll。
			* 前进/后退只单步移动；"到最新/到最初"一步到位。
			* @param mode - "advance" | "retreat" | "latest" | "start"。
			* @param detail - 当前 diff 的详情（含 path）。
			*/
			function handleBaseline(mode, detail) {
				if (!detail || !detail.path) return;
				const methodMap = {
					advance: "advanceBaseline",
					retreat: "retreatBaseline",
					latest: "advanceLatestBaseline",
					start: "retreatStartBaseline"
				};
				const method = methodMap[mode] || "advanceBaseline";
				rpcCall(method, { sessionId: getCurrentSessionId(), path: toAbs(detail.path) }).then(function() {
					setBaselineTick(function(t) {
						return t + 1;
					});
					refresh();
				}).catch(function(e) {
					console.error("[side-coder] 基线移动失败:", mode, e);
					setStatus("❌ " + (mode === "advance" ? "基线前进" : "基线后退") + "失败");
				});
			}
			function handleFileOpen(filePath) {
				const files = state.fileChanges || [];
				const match = files.find(function(item) {
					return samePath(toAbs(filePath), item.path);
				});
				if (match) state._selectChangePath = filePath;
				if (!isMarkdownPath(filePath)) {
					setPreview(false);
					refresh();
				}
				if (state._openFile) state._openFile(filePath);
			}
			function handleEntryMenu(e, path, isDir) {
				state.contextMenu = { path, isDir, x: e.clientX, y: e.clientY };
				refresh();
			}
			function handleTabSelect(path) {
				// 切到别的文件标签：清掉对比，回到该文件普通编辑（单界面语义）。
				setDiffDetail(null);
				state.activeTab = path;
				// 预览仅对 Markdown 生效：切到非 .md/.markdown/.mdx 文件自动关预览，回到普通编辑。
				if (!isMarkdownPath(path)) {
					setPreview(false);
					refresh();
				}
				if (state._openFile) state._openFile(path);
			}
			// 只把"属于当前活动文件标签"的对比传给编辑器：切文件/开新文件自动回普通编辑。
			const activeDiff = diffOpen && diffDetail && state.activeTab && samePath(toAbs(diffDetail.path), toAbs(state.activeTab)) ? diffDetail : null;
			function handleTabClose(path) {
				state.openTabs = state.openTabs.filter(function(t) {
					return !samePath(t.path, path);
				});
				if (samePath(state.activeTab, path)) {
					const last = state.openTabs[state.openTabs.length - 1];
					state.activeTab = last ? last.path : null;
					if (state.activeTab) handleTabSelect(state.activeTab);
				}
				refresh();
			}
			function handleTabMenu(e, path) {
				state.contextMenu = { kind: "tab", path, x: e.clientX, y: e.clientY };
				refresh();
			}
			function handleCloseOthers(path) {
				state.openTabs = state.openTabs.filter(function(t) {
					return samePath(t.path, path);
				});
				if (!samePath(toAbs(state.activeTab), toAbs(path))) {
					state.activeTab = path;
					if (state._openFile) state._openFile(path);
				}
				refresh();
			}
			function handleCloseAll() {
				state.openTabs = [];
				state.activeTab = null;
				refresh();
			}
			function handleRevealEntry(path) {
				// 打开系统文件管理器定位该文件（后端用 explorer /select 实现）。
				rpcCall("revealEntry", { path: toAbs(path) }).catch(function(e) {
					console.error("[side-coder] 资源管理器打开失败:", path, e);
				});
			}
			// 标签右键菜单可执行的关闭/定位动作，传给 ContextMenu 的 tabOps。
			const contextMenuTabOps = {
				onTabClose: handleTabClose,
				onCloseOthers: handleCloseOthers,
				onCloseAll: handleCloseAll,
				onReveal: handleRevealEntry
			};
			return react.createElement("div", { className: "dsh-cc-dock" }, react.createElement(UpdateBanner), react.createElement("div", { className: "dsh-cc-header" }, react.createElement("span", { className: "dsh-cc-header-title" }, "⌨️ 侧栏编程"), react.createElement("div", { className: "dsh-cc-header-actions" }, react.createElement("button", attrs({
				className: "dsh-cc-diff-btn" + (preview ? " active" : ""),
				title: "Markdown 只读预览（当前文件为 .md/.markdown/.mdx 时可用）",
				disabled: !state.activeTab || !isMarkdownPath(state.activeTab),
				onClick: function() {
					setPreview(function(prev) {
						return !prev;
					});
				}
			}), "预览"), react.createElement("button", attrs({
				className: "dsh-cc-diff-btn" + (treeOpen ? " active" : ""),
				title: "收起/展开文件列表",
				onClick: function() {
					state.treeOpen = !state.treeOpen;
					setTreeOpen(state.treeOpen);
					write_toggle(TOGGLE_TREE_OPEN, state.treeOpen);
				}
			}), "列表"), react.createElement("button", attrs({
				className: "dsh-cc-diff-btn",
				title: "重新读取文件目录（在对话里新建、删除、改名后点它，目录树立即跟上）",
				onClick: function() {
					refreshFileTree();
				}
			}), "刷新"), react.createElement("button", attrs({
				className: "dsh-cc-diff-btn" + (diffOpen ? " active" : ""),
				title: "显示/收起改动对比",
				onClick: function() {
					const nextDiffOpen = !diffOpen;
					setDiffOpen(nextDiffOpen);
					write_toggle(TOGGLE_DIFF_OPEN, nextDiffOpen);
				}
			}), "对比"), react.createElement("button", attrs({
				className: "dsh-cc-diff-btn" + (follow ? " active" : ""),
				title: "AI 改动自动跟随",
				onClick: function() {
					const nextFollow = !follow;
					setFollow(nextFollow);
					write_toggle(TOGGLE_FOLLOW, nextFollow);
				}
			}), "跟随"), react.createElement("button", attrs({
				className: "dsh-cc-diff-btn" + (autoPopup ? " active" : ""),
				title: "对话里改文件时自动弹出并展示最新改动",
				onClick: function() {
					const next = state.autoPopup === false;
					state.autoPopup = next;
					setAutoPopup(next);
					write_toggle(TOGGLE_AUTO_POPUP, next);
				}
			}), "弹出"), react.createElement("button", attrs({
				className: "dsh-cc-diff-btn" + (currentSession ? " active" : ""),
				title: "只看当前会话窗口产生的改动（关闭后显示所有会话）",
				onClick: function() {
					const next = !currentSession;
					setCurrentSession(next);
					write_toggle(TOGGLE_CURRENT_SESSION, next);
				}
			}), "仅本会话改动"))), react.createElement(TabBar, {
				onTabSelect: handleTabSelect,
				onTabClose: handleTabClose,
				onTabContextMenu: handleTabMenu
			}), react.createElement("div", { className: "dsh-cc-body" }, react.createElement("div", { className: "dsh-cc-main-col" }, react.createElement(PathBar, null), react.createElement(EditorPanel, {
				onStatusChange: setStatus,
				diffDetail: activeDiff,
				preview,
				previewPath: state.activeTab,
				follow,
				onDiffClose: function() {
					setDiffDetail(null);
				},
				onAdvanceBaseline: function() {
					handleBaseline("advance", activeDiff);
				},
				onRetreatBaseline: function() {
					handleBaseline("retreat", activeDiff);
				},
				onAdvanceLatestBaseline: function() {
					handleBaseline("latest", activeDiff);
				},
				onRetreatStartBaseline: function() {
					handleBaseline("start", activeDiff);
				}
			}), diffOpen ? react.createElement(DiffPane, {
				follow,
				currentSession,
				activePath: state.activeTab,
				pollTick: baselineTick,
				onToggleFollow: function() {
					const nextFollow = !follow;
					setFollow(nextFollow);
					write_toggle(TOGGLE_FOLLOW, nextFollow);
				},
				onAutoOpen: function() {
					setDiffOpen(true);
				},
				onDetailChange: handleDiffDetail
			}) : null), treeOpen ? react.createElement("div", { className: "dsh-cc-tree-panel" }, react.createElement(FileTree, {
				onFileOpen: handleFileOpen,
				onEntryMenu: handleEntryMenu,
				refreshTick: state.treeTick,
				sort: state.treeSort,
				query: state.searchQuery,
				onSortChange: function(mode) {
					state.treeSort = mode;
					write_setting(TOGGLE_TREE_SORT, mode);
					refresh();
				},
				onQueryChange: function(keyword) {
					if (state.searchQuery === keyword) return;
					state.searchQuery = keyword;
					refresh();
				}
			})) : null), react.createElement(StatusBar, {
				status
			}), state.contextMenu ? react.createElement(ContextMenu, {
				menu: state.contextMenu,
				tabOps: contextMenuTabOps,
				onClose: function() {
					state.contextMenu = null;
					refresh();
				}
			}) : null);
		}
		/** 侧边栏底部触发按钮。 */
		function TriggerButton() {
			return react.createElement("button", attrs({
				className: "dsh-cc-trigger",
				title: "侧栏编程 Side Coder",
				type: "button",
				"aria-label": "侧栏编程 Side Coder",
				onClick: openSidebarTab
			}), react.createElement("div", { className: "dsh-cc-trigger-head" }, react.createElement("span", attrs({
				className: "dsh-cc-trigger-icon",
				"aria-hidden": "true"
			}), "⌨"), react.createElement("span", { className: "dsh-cc-trigger-title" }, "侧栏编程")), react.createElement("div", { className: "dsh-cc-trigger-desc" }, "右栏编辑器 + 改动对比"));
		}
		/**
		* DSH 对话消息流中需要尾巴注入的两种文件按钮：
		* 1. 工具行 fileLink，CSS module hash 类名以 fileLink 结尾如 o3BgMG_fileLink，
		*    按钮文本是相对会话 cwd 的路径，显示层已 relativizeToCwd，点击默认由 Host 用系统默认应用打开。
		* 2. 产物区文件按钮，data-produced-files-row 容器内的 button，文本是 basename，完整绝对路径在 title 属性里。
		* 统一规则：在按钮后追加「侧栏编程」尾巴——点击路径本身保持原行为，外部打开，
		* 点击「侧栏编程」四字则在插件内打开该文件。
		*/
		const LINK_BTN_SELECTOR = "button[class*=\"fileLink\"], [data-produced-files-row=\"true\"] button[title]";
		/**
		* 从按钮提取目标路径：优先用注入时缓存的干净路径即 data-cc-path，
		* 其次产物区按钮的 title 即绝对路径，否则用文本即相对路径。
		* 不直接读 textContent——尾巴 span 注入后 textContent 会带上「侧栏编程」，
		* 重扫时若据此覆盖 dataset.path 会污染路径。
		* @param btn - 文件按钮元素。
		*/
		function btnPath(btn) {
			const cached = btn.getAttribute("data-cc-path");
			if (cached) return cached;
			const title = btn.getAttribute("title");
			if (title && /^[A-Za-z]:[\\/]|^\\\\/.test(title)) return title;
			return (btn.textContent || "").trim();
		}
		/**
		* 为指定容器内的所有 fileLink 按钮注入尾巴 span。幂等：已注入且路径未变则跳过。
		* 注入时把路径快照存到 span.dataset.path 供点击用，并把干净路径缓存到
		* 按钮 data-cc-path，重扫时从此读，避免尾巴文本污染 textContent 后误覆盖。
		* @param root - 待扫描的容器。
		*/
		function injectLinkTails(root) {
			if (!root || !root.querySelectorAll) return;
			const buttons = root.querySelectorAll(LINK_BTN_SELECTOR);
			for (let i = 0; i < buttons.length; i++) {
				const btn = buttons[i];
				if (!btn) continue;
				const path = btnPath(btn);
				if (!btn.hasAttribute("data-cc-path")) btn.setAttribute("data-cc-path", path);
				if (!path) continue;
				const existing = btn.querySelector(".dsh-cc-open-here");
				if (existing) {
					if (existing.dataset.path !== path) existing.dataset.path = path;
					continue;
				}
				const span = document.createElement("span");
				span.className = "dsh-cc-open-here";
				span.textContent = "侧栏编程";
				span.title = "在侧栏编程中打开";
				span.dataset.path = path;
				btn.appendChild(document.createTextNode("\xA0"));
				btn.appendChild(span);
			}
		}
		/**
		* 在插件内打开消息流 fileLink 指出的文件：打开面板 → 等 root 就绪 → 读文件。
		* 路径可能相对当前会话 cwd，DSH 显示层已 relativizeToCwd，也可能本身就是绝对路径。
		* @param rawPath - 尾巴携带的路径快照。
		*/
		function openPathInPicker(rawPath) {
			openSidebarTab();
			let attempts = 0;
			function tryOpen() {
				if (!state.root || !state._openFile) {
					if (attempts++ < 40) {
						setTimeout(tryOpen, 250);
						return;
					}
					console.error("[side-coder] 文件树根未就绪，无法在插件内打开:", rawPath);
					return;
				}
				if (state._openFile) state._openFile(rawPath);
			}
			tryOpen();
		}
		/**
		* 捕获阶段拦截点击：点击「侧栏编程」尾巴时阻止默认外部打开，改为插件内打开。
		* @param e - 点击事件。
		*/
		function onDocClickCapture(e) {
			const target = e.target;
			const pill = target && target.closest ? target.closest(".dsh-cc-open-here") : null;
			if (!pill) return;
			const rawPath = pill.dataset.path;
			if (!rawPath) return;
			e.preventDefault();
			e.stopPropagation();
			if (e.stopImmediatePropagation) e.stopImmediatePropagation();
			openPathInPicker(rawPath);
		}
		/** 启动消息流尾巴注入：MutationObserver 监听 DOM 变化 + 文档级点击拦截。 */
		function startLinkTailWatcher() {
			if (state._linkTailStarted) return;
			state._linkTailStarted = true;
			injectLinkTails(document);
			state._linkTailObserver = new MutationObserver(function() {
				injectLinkTails(document);
			});
			state._linkTailObserver.observe(document.body, {
				childList: true,
				subtree: true,
				characterData: true
			});
			document.addEventListener("click", onDocClickCapture, true);
		}
		/** 停止尾巴注入：断开 observer、移除注入的 span、移除点击拦截。 */
		function stopLinkTailWatcher() {
			if (state._linkTailObserver) {
				state._linkTailObserver.disconnect();
				state._linkTailObserver = null;
			}
			document.removeEventListener("click", onDocClickCapture, true);
			state._linkTailStarted = false;
			const pills = document.querySelectorAll(".dsh-cc-open-here");
			for (let i = 0; i < pills.length; i++) {
				const pill = pills[i];
				if (!pill) continue;
				const prev = pill.previousSibling;
				if (prev && prev.nodeType === 3 && /^\u00A0+$/.test(prev.textContent || "")) {
					if (prev.parentNode) prev.parentNode.removeChild(prev);
				}
				if (pill.parentNode) pill.parentNode.removeChild(pill);
			}
		}
		/** 插件名，与 cordis.patch.yml 的 name 一致。 */
		const name = "dsh-side-coder";
		/** 依赖的客户端服务：slots 与 sessions 由客户端核心插件提供；右栏两个服务按可选获取。 */
		/* 2026-10-05 修复「侧栏编程按钮点了没反应」。
		   根因：inject 只声明 ["slots", "sessions"]，而 apply() 里对两个侧栏服务是
		   一次性可选读取 —— ctx.get("sidebarRight") / ctx.get("sidebarRightTabs")。
		   内核的 dsh-client-ui-sidebar-right 自己要等 layout / shortcuts 才激活，
		   若它排在 side-coder 之后，apply 那一刻两个服务都还没就绪：
		     - state._sidebarRight = null  -> openSidebarTab() 在 312 行静默 return，按钮无反应
		     - if (tabsRegistry) 不成立   -> 整个 tab 注册被跳过，右栏里连标签都没有
		   改法：把两个服务按官方写法（参照 dsh-client-ui-deliverables 的 inject 数组，
		   纯字符串、无 optional 形式）纳入 inject，交给 cordis 调度时序。 */
		const inject = ["slots", "sessions", "sidebarRight", "sidebarRightTabs"];
		/** 右栏 tab 类型标识：openTab 按它点名，正文与标题坑位按它 keyed。 */
		const TAB_KIND = "side-coder";
		/**
		* 客户端 apply：注册右栏停靠标签页（真侧栏编辑器 + 实时对比）、
		* 侧边栏触发按钮，并启动样式与文件链接尾巴注入。
		* @param ctx - 客户端插件上下文。
		*/
		function apply(ctx) {
			const slots = ctx.get("slots");
			if (!slots) return;
			const sessionsService = ctx.get("sessions");
			if (!sessionsService) throw new Error("[side-coder] 缺少 sessions 服务，请确认 dsh-client-runtime 已加载");
			sessions = sessionsService;
			state._pluginCtx = ctx;
			state._sidebarRight = ctx.get("sidebarRight") || null;
			const tabsRegistry = ctx.get("sidebarRightTabs");
			ctx.effect(function() {
				ensureStyle();
				updateWatch.start();
				startLinkTailWatcher();
				startChangeWatcher();
				return function() {
					removeStyle();
					stopLinkTailWatcher();
					stopChangeWatcher();
				};
			});
			if (tabsRegistry) {
				ctx.effect(function() {
					return tabsRegistry.register({
						id: "dsh-side-coder",
						kind: TAB_KIND,
						title: function() {
							return "侧栏编程";
						},
						guide: [{
							order: 25,
							title: function() {
								return "侧栏编程";
							},
							description: function() {
								return "文件树 + 编辑器 + AI 改动实时对比";
							}
						}]
					});
				}, "side-coder tab type");
				ctx.effect(function() {
					return slots.inject("sidebar.right.pane.tab", function() {
						return slots.register({
							name: "sidebar.right.pane.tab",
							key: "dsh-side-coder"
						}, SideCoderPanel);
					});
				}, "side-coder tab body");
				ctx.effect(function() {
					return slots.inject("sidebar.right.pane.tab.title", function() {
						return slots.register({
							name: "sidebar.right.pane.tab.title",
							key: "dsh-side-coder"
						}, function() {
							return react.createElement("span", null, "⌨️ 侧栏编程");
						});
					});
				}, "side-coder tab title");
			}
			slots.inject("sidebar.footer.action", function() {
				return slots.register({
					name: "sidebar.footer.action",
					id: "dsh-side-coder-trigger",
					order: 15
				}, function() {
					return react.createElement(TriggerButton);
				});
			});
		}
		const plugin = {
			name,
			inject,
			apply
		};
		//#endregion
		exports.apply = apply;
		exports.default = plugin;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map