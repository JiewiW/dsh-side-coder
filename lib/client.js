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
			// 按键刷新尾沿节流定时器：schedulePanelRefresh 挂在 state 上，面板未挂载时安全跳过。
			_panelRefreshTimer: null,
			// 统一改动数据源（createChangeFeed 实例），watcher 与 DiffPane 共用同一份轮询。
			_changeFeed: null,
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
			// startChangeWatcher 在统一改动数据源上的订阅取消函数；未订阅时为 null。
			_watcherUnsub: null,
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
		* 编辑器按键专用的尾沿节流刷新：leading 立即刷一次（首个按键的 ● 圆点即时出现），
		* 之后连续按键只保证最后一次按键后 PANEL_REFRESH_THROTTLE_MS 内必有一次刷新，
		* 避免每键一次整面板 forceUpdate。面板未挂载（state._refresh 为 null）时安全跳过。
		*/
		function schedulePanelRefresh() {
			if (!state._refresh) return;
			if (state._panelRefreshTimer === null) {
				// leading：首个按键立即刷新一次。
				refresh();
			} else {
				clearTimeout(state._panelRefreshTimer);
			}
			state._panelRefreshTimer = setTimeout(function() {
				state._panelRefreshTimer = null;
				// trailing：停顿后补一次，保证标签栏 ● 圆点等 UI 与最终状态一致。
				refresh();
			}, PANEL_REFRESH_THROTTLE_MS);
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
		* 当前会话工作目录：与 getCurrentSessionId 取同一行（retainedBy.mainView>0）的 cwd。
		* 进程重启/会话恢复后 UI 行 id 与实际 agent 会话 id 可能不同，cwd 用于后端按同工作目录回退。
		* 返回 null 表示尚无当前会话或行上不带 cwd。
		*/
		function getCurrentSessionCwd() {
			if (!sessions || !sessions.list || typeof sessions.list.getSnapshot !== "function") return null;
			const snap = sessions.list.getSnapshot();
			if (!snap) return null;
			if (snap.current && snap.byId && snap.byId[snap.current]) {
				return snap.byId[snap.current].cwd || null;
			}
			const byId = snap.byId;
			if (!byId) return null;
			const ids = Object.keys(byId);
			for (let i = 0; i < ids.length; i += 1) {
				const row = byId[ids[i]];
				if (row && row.retainedBy && (row.retainedBy.mainView || 0) > 0) return row.cwd || null;
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
			// POSIX 盘符路径：/X:/xxx → X:\xxx（MSYS2/Git Bash 工具事件带这种）。
			const posixDrive = relPath.match(/^\/([A-Za-z])\/(.+)$/);
			if (posixDrive) return posixDrive[1].toUpperCase() + ":\\" + posixDrive[2].replace(/\//g, "\\");
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
		/** Markdown 预览渲染尾沿防抖（毫秒）：连续打字不渲染，停顿后只渲一次。 */
		const PREVIEW_RENDER_DEBOUNCE_MS = 300;
		/** 编辑器按键触发整面板刷新的尾沿节流间隔（毫秒）：保证最后一次按键后必有一次刷新。 */
		const PANEL_REFRESH_THROTTLE_MS = 400;
		/** 改动数据源（createChangeFeed）活跃轮询间隔（毫秒）。 */
		const CHANGE_FEED_INTERVAL_MS = 2500;
		/** 改动数据源无变化后退避到的慢速轮询间隔（毫秒）。 */
		const CHANGE_FEED_SLOW_INTERVAL_MS = 5000;
		/** 连续多少次 tick 无变化后切入慢速间隔（次）。 */
		const CHANGE_FEED_IDLE_LIMIT = 8;
		/** VditorPreview 等待 Monaco 编辑器实例出现的重试间隔（毫秒）与最大次数。 */
		const PREVIEW_EDITOR_ATTACH_RETRY_MS = 200;
		const PREVIEW_EDITOR_ATTACH_MAX_RETRIES = 40;
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
		/**
		* 统一改动数据源 createChangeFeed：watcher（自动弹出）与 DiffPane（改动面板）共用同一份轮询，
		* 取代此前各自为政的两个 setInterval。
		*
		* 订阅形状：{ wantsGroups:boolean, currentSession:boolean, onData(payload) }，返回取消函数。
		* payload 形状：
		*   { kind:"groups", groups:[{sessionId, latestId, files:FileMeta[]}], fetchedSessionId }
		*   { kind:"files",  files:FileMeta[], latestId, fetchedSessionId }
		* wantsGroups:false 的订阅者在 groups 形态下只收到 fetchedSessionId 对应会话那一组（转成 files 形态）。
		*
		* 节奏：活跃 CHANGE_FEED_INTERVAL_MS=2500ms；以响应签名判变化，连续 CHANGE_FEED_IDLE_LIMIT 次
		* 无变化切慢速 CHANGE_FEED_SLOW_INTERVAL_MS=5000ms；慢速期间一旦检测到变化，立即恢复活跃间隔
		* 并立刻补一次 tick。后台标签页（document.hidden）跳过本次 RPC，重新可见时立即拉一次。
		* 没有任何订阅者时清掉 timer，有订阅者时启动。
		*/
		function createChangeFeed() {
			const subs = [];
			let timer = null;
			let interval = CHANGE_FEED_INTERVAL_MS;
			let idleCount = 0;
			let lastSig = "";
			let tickInFlight = false;

			function broadcast(payload) {
				subs.slice().forEach(function(sub) {
					try {
						if (payload.kind === "files" || sub.wantsGroups) {
							sub.onData(payload);
							return;
						}
						// groups 形态 → 非分组订阅者：只取 fetchedSessionId 对应会话那一组。
						let files = [];
						let latestId = 0;
						(payload.groups || []).forEach(function(g) {
							if (g.sessionId === payload.fetchedSessionId) {
								files = g.files || [];
								latestId = g.latestId || 0;
							}
						});
						sub.onData({ kind: "files", files: files, latestId: latestId, fetchedSessionId: payload.fetchedSessionId });
					} catch (e) {
						console.warn("[side-coder] changeFeed 订阅者回调异常:", e);
					}
				});
			}

			function fileSig(files) {
				return (files || []).map(function(f) {
					return [f.path, f.lastTime, f.count, f.chainLength, f.baselinePos, f.changeKind, f.renamedFrom].join("@");
				}).join("|");
			}

			function scheduleNext(changed) {
				clearTimeout(timer);
				timer = null;
				if (subs.length === 0) return;
				if (changed) {
					idleCount = 0;
					interval = CHANGE_FEED_INTERVAL_MS;
				} else {
					idleCount++;
					interval = idleCount >= CHANGE_FEED_IDLE_LIMIT ? CHANGE_FEED_SLOW_INTERVAL_MS : CHANGE_FEED_INTERVAL_MS;
				}
				timer = setTimeout(tick, interval);
			}

			async function tick() {
				// 同一时刻只允许一个在途请求；refreshNow 与定时触发重叠时让位（在途 tick 末尾会重新排期）。
				if (tickInFlight) return;
				if (subs.length === 0) return;
				// 后台标签页不发请求；visibilitychange 重新可见时会 refreshNow 补拉。
				if (typeof document !== "undefined" && document.hidden) return;
				tickInFlight = true;
				let payload = null;
				try {
					// 任一订阅者要分组 → 走 grouped（多订阅者场景理论上只有 DiffPane 一个，取第一个）。
					const groupsSub = subs.filter(function(s) { return s.wantsGroups; })[0];
					if (groupsSub) {
						const currentSessionId = groupsSub.currentSession ? getCurrentSessionId() : "";
						const currentCwd = groupsSub.currentSession ? getCurrentSessionCwd() : "";
						try {
							// 后端 grouped 读 payload.currentSessionId（注意不是 sessionId），传错会聚合全部会话；
							// currentCwd 支持重启/恢复后按同工作目录回退。
							const result = await rpcCall("listFileChangesGrouped", { currentSessionId: currentSessionId, currentCwd: currentCwd });
							const groups = (result && result.groups) || [];
							// fetchedSessionId 取后端解析后的真实会话：非 unknown 组即当前会话（id 可能与 UI 行 id 不同）。
							let realSid = currentSessionId;
							for (const g of groups) {
								if (g.sessionId && g.sessionId !== "unknown") { realSid = g.sessionId; break; }
							}
							payload = { kind: "groups", groups: groups, fetchedSessionId: realSid };
						} catch (e) {
							// grouped 失败：降级 listFileChanges，把结果包成单组广播，保持与旧实现一致的容错。
							const sid = getCurrentSessionId();
							const cwd = getCurrentSessionCwd();
							const result = await rpcCall("listFileChanges", { sessionId: sid, currentCwd: cwd });
							const realSid = (result && result.matchedSessionId) || sid;
							payload = {
								kind: "groups",
								groups: [{ sessionId: realSid || "unknown", latestId: (result && result.latestId) || 0, files: (result && result.files) || [] }],
								fetchedSessionId: realSid
							};
						}
					} else {
						const sid = getCurrentSessionId();
						const cwd = getCurrentSessionCwd();
						const result = await rpcCall("listFileChanges", { sessionId: sid, currentCwd: cwd });
						const realSid = (result && result.matchedSessionId) || sid;
						payload = { kind: "files", files: (result && result.files) || [], latestId: (result && result.latestId) || 0, fetchedSessionId: realSid };
					}
					const sig = payload.kind === "groups"
						? payload.groups.map(function(g) { return (g.sessionId || "") + ":" + (g.latestId || 0) + ":" + fileSig(g.files); }).join(";;")
						: (payload.fetchedSessionId || "") + ":" + (payload.latestId || 0) + ":" + fileSig(payload.files);
					const changed = sig !== lastSig;
					const wasSlow = interval === CHANGE_FEED_SLOW_INTERVAL_MS;
					lastSig = sig;
					broadcast(payload);
					if (changed && wasSlow) {
						// 慢速期间检测到变化：恢复活跃间隔，并立刻补一次 tick。
						idleCount = 0;
						interval = CHANGE_FEED_INTERVAL_MS;
						clearTimeout(timer);
						timer = setTimeout(tick, 0);
					} else {
						scheduleNext(changed);
					}
				} catch (e) {
					// RPC 整体失败：不广播，维持当前节奏重试。
					scheduleNext(false);
				} finally {
					tickInFlight = false;
				}
			}

			function onVisibility() {
				if (typeof document !== "undefined" && !document.hidden && subs.length > 0) feed.refreshNow();
			}

			function subscribe(sub) {
				subs.push(sub);
				if (subs.length === 1) {
					if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisibility);
					// 首个订阅者：立即拉一次，随后进入轮询。
					feed.refreshNow();
				}
				return function unsubscribe() {
					const i = subs.indexOf(sub);
					if (i >= 0) subs.splice(i, 1);
					if (subs.length === 0) {
						clearTimeout(timer);
						timer = null;
						idleCount = 0;
						lastSig = "";
						interval = CHANGE_FEED_INTERVAL_MS;
						if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisibility);
					}
				};
			}

			/** 基线移动等场景：强制立即拉取并广播（取消在途定时，tick 末尾会重新排期）。 */
			function refreshNow() {
				if (subs.length === 0) return;
				clearTimeout(timer);
				timer = null;
				tick();
			}

			const feed = { subscribe: subscribe, refreshNow: refreshNow };
			return feed;
		}
		/**
		* 启动改动追踪：订阅统一改动数据源（当前会话 files 形态），出现新改动即自动弹出右栏并指向最新改动。
		* 面板没打开也照跑，是"自动弹出"的动力源。
		*
		* 会话绑定关键点：
		* - feed 的 files 数据由 listFileChanges 按【当前处于的会话】聚合，绝不会混入其它会话的文件；
		*   其它会话产生修改时当前会话的 latestId 不推进，编辑器不会被别人的改动"带着跳"（需求1）。
		* - _lastSeenBySession 按会话独立记账：首轮只收敛一次"早就发生的旧改动"（刷新后不弹旧账），
		*   之后每当切换进一个会话，只要该会话有新改动且尚未"消费"到它的最新编号，就无条件跳一次——
		*   保证切会话时总是指向当前会话窗口的最新改动文件（需求3）。
		* - 会话可能在 RPC 在途期间切走，用 payload.fetchedSessionId（返回时刻的会话 id）记账，
		*   避免异步竞态把 A 会话的改动记到 B 会话头上。
		*/
		function startChangeWatcher() {
			if (state._watcherUnsub) return;
			if (!state._changeFeed) state._changeFeed = createChangeFeed();
			state._watcherUnsub = state._changeFeed.subscribe({
				wantsGroups: false,
				currentSession: true,
				onData: handleWatchPayload
			});
		}
		/**
		 * C1：检查指定会话 layout.tabs 中是否存在 kind="side-coder" 标签页。
		 * tabsIn 不可用、抛错或返回空时一律按"不存在"保守处理（不自动弹出）。
		 */
		function hasSideCoderTab(sessionId) {
			try {
				const sidebar = state._sidebarRight;
				if (!sidebar || typeof sidebar.tabsIn !== "function") return false;
				const tabs = sidebar.tabsIn(sessionId);
				if (!tabs || typeof tabs.length !== "number") return false;
				for (const tab of tabs) {
					if (tab && tab.kind === "side-coder") return true;
				}
				return false;
			} catch (e) {
				return false;
			}
		}
		/** watcher 的 feed 数据回调：自动弹出业务逻辑（与旧 tick 一致，仅数据来源换成 feed payload）。 */
		function handleWatchPayload(payload) {
			// C2 身份门控：请求在途期间发生会话切换时，payload.fetchedSessionId 与当前会话不一致，
			// 立即丢弃该载荷——不弹、不切文件、不记账，覆盖请求与会话切换交错竞态。
			const requestedSid = getCurrentSessionId();
			const fetchedSid = payload.fetchedSessionId || "";
			if (requestedSid && fetchedSid && requestedSid !== fetchedSid) return;
			const sessionId = fetchedSid || requestedSid;
			if (!sessionId) return;
			const files = payload.files || [];
			if (files.length === 0) return;
			const latestId = Number(payload.latestId || 0);
			const seen = state._lastSeenBySession[sessionId];
			// 首轮（从未记录过本会话）且从未启动过追踪：只把它收敛为当前编号，不弹旧账。
			// 首轮之后切进来的会话走「无条件跳一次」分支，见下方。
			const isBooting = state._watcherBooted === false && seen === undefined;
			if (isBooting) {
				state._watcherBooted = true;
				state._lastSeenBySession[sessionId] = latestId;
				return;
			}
			// C1 标签页存在门控：当前会话无 side-coder 标签页时只收敛编号，
			// 不 openTab、不写任何 pending（seen 记账后下次轮询按 latestId>seen 判断）。
			if (!hasSideCoderTab(requestedSid)) {
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
				// autoPopup=false：整个自动动作不执行（两个 pending 都不写、不 openTab）。
				if (state.autoPopup === false) return;
				// C3：同时挂起"打开文件"(_pendingOpenPath) 与"diff 选中文件"(_pendingChangePath)
				// 两个一次性 pending；面板/DiffPane 挂载后经 applyGroups→setSelectedPath→
				// fileChangeContent→onDetailChange 既有链路消费，自动打开文件并显示 diff。
				state._pendingOpenPath = files[0].path;
				state._pendingChangePath = files[0].path;
				// 显式自动弹出视图动作（决策表 #12/#13）：paneOpen=改动列表面板开关的持久化值。
				// 面板未挂载时本次分发不落地，由 DiffPane applyGroups 消费 _pendingChangePath 时兜底补发。
				if (state._viewDispatch) {
					state._viewDispatch({ type: "autoPopup", path: toAbs(files[0].path), paneOpen: read_toggle(TOGGLE_DIFF_OPEN, true) === true });
				}
				openSidebarTab();
				refresh();
				return;
			}
			if (latestId <= seen) return;
			state._lastSeenBySession[sessionId] = latestId;
			// 新改动：autoPopup=false 时同样完全不触发自动动作。
			if (state.autoPopup === false) return;
			state._pendingOpenPath = files[0].path;
			state._pendingChangePath = files[0].path;
			// 显式自动弹出视图动作（决策表 #12/#13）：同上，未挂载时由 pending 消费点兜底。
			if (state._viewDispatch) {
				state._viewDispatch({ type: "autoPopup", path: toAbs(files[0].path), paneOpen: read_toggle(TOGGLE_DIFF_OPEN, true) === true });
			}
			openSidebarTab();
			refresh();
		}
		/** 停止改动追踪：取消 feed 订阅（feed 无其它订阅者时自行停轮询）。 */
		function stopChangeWatcher() {
			if (state._watcherUnsub) {
				state._watcherUnsub();
				state._watcherUnsub = null;
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
			".dsh-cc-diff-btn:disabled{opacity:.5;cursor:not-allowed}",
			// 「预览/对比」segmented 控件（T3）：连体样式，同一时刻至多一个 active（editor 态两钮均不亮）。
			".dsh-cc-view-seg{display:flex;align-items:center}",
			".dsh-cc-view-seg>.dsh-cc-diff-btn{border-radius:0}",
			".dsh-cc-view-seg>.dsh-cc-diff-btn:last-child{margin-left:-1px;border-top-left-radius:4px;border-bottom-left-radius:4px}",
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
			// 三视图互斥渲染门（T3）：data-view 由 viewByTab 派生，同一时刻仅一视图可见。
			".dsh-cc-editor-panel[data-view=\"diff\"]>.dsh-cc-editor{display:none}",
			".dsh-cc-editor-panel[data-view=\"diff\"]>.dsh-cc-editor-placeholder{display:none}",
			".dsh-cc-editor-panel[data-view=\"diff\"]>.dsh-cc-diff-overlay{position:static;flex:1;min-height:0}",
			".dsh-cc-editor-panel[data-view=\"preview\"]>.dsh-cc-editor{display:none}",
			".dsh-cc-editor-panel[data-view=\"preview\"]>.dsh-cc-editor-placeholder{display:none}",
			".dsh-cc-preview{flex:1;min-height:0;overflow:auto;display:none}",
			".dsh-cc-preview.vditor-reset{padding:20px 24px;box-sizing:border-box;max-width:none}",
			".dsh-cc-preview.vditor-reset>:first-child{margin-top:0}",
			".dsh-cc-preview.vditor-reset>:last-child{margin-bottom:0}",
			".dsh-cc-editor-panel[data-view=\"preview\"]>.dsh-cc-preview{display:block}",
			// diff 视图的三种数据态：ready=浮层铺满；loading=载入占位；failed=失败条+重试。
			".dsh-cc-diff-state{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--dsw-alias-label-secondary);font-size:13px}",
			".dsh-cc-diff-error{color:var(--dsw-alias-danger,#d13438)}",
			".dsh-cc-diff-retry{cursor:pointer;border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:4px 14px;background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);font-size:12px;font-family:inherit}",
			".dsh-cc-diff-retry:hover{background:var(--dsw-alias-interactive-bg-active)}",
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
			// 点「侧栏编程」定位到某行时的一次性整行底色（琥珀色，深浅色主题都够对比）。
			".dsh-cc-hl{background:color-mix(in srgb,#f59e0b 20%,transparent)}",
			".dsh-cc-hl-gutter{background:color-mix(in srgb,#f59e0b 55%,transparent);border-left:2px solid #f59e0b}",
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
		/**
		 * 编辑器三视图状态机（计划书 4.6 纯函数 reducer，T1）。
		 * 零自由变量：不引用模块级 helper/常量；路径归一与 isMd 由调用方预算后放入 action。
		 * state 形状 {viewByTab:{}, detailByPath:{}}；无迁移/缺字段/未知 action 一律返回原引用（决策表 #22）。
		 * action 全集：view/open/close/autoPopup/firstSeen/follow/detailReady/detailFailed（决策表 4.2 共 22 行）。
		 */
		function reduceViewState(state, action) {
			if (!state || typeof state !== "object" || !state.viewByTab || !state.detailByPath) return state;
			if (!action || typeof action !== "object" || typeof action.type !== "string") return state;
			const viewByTab = state.viewByTab;
			const detailByPath = state.detailByPath;
			const path = typeof action.path === "string" && action.path.length > 0 ? action.path : null;
			const hasViewKey = function(p) { return Object.prototype.hasOwnProperty.call(viewByTab, p); };
			const hasDetailKey = function(p) { return Object.prototype.hasOwnProperty.call(detailByPath, p); };
			// 写视图键；目标值与现值一致时不产生新对象（无迁移返回原引用）。
			const setView = function(p, next) {
				const current = hasViewKey(p) ? viewByTab[p] : "editor";
				if (current === next) return state;
				const nextView = Object.assign({}, viewByTab);
				nextView[p] = next;
				return { viewByTab: nextView, detailByPath: detailByPath };
			};
			switch (action.type) {
				case "view": { // #1-#8/#21：用户点「对比」「预览」「✕ 退出对比」
					if (!path) return state;
					const requested = action.view;
					if (requested !== "editor" && requested !== "diff" && requested !== "preview") return state;
					if (requested === "preview" && action.isMd !== true) return state; // #4 非 md 收到也返回原 state
					const current = hasViewKey(path) ? viewByTab[path] : "editor";
					// 再点当前视图=退出回 editor（#6/#8）；点其它视图一步直达（#1-#3/#5/#7，不经过中间态）。
					return setView(path, requested === current ? "editor" : requested);
				}
				case "open": { // #9 新标签落地显式写 editor（「首次打开默认 editor」唯一落地处）；#10 已有键不迁移
					if (!path || hasViewKey(path)) return state;
					const nextView = Object.assign({}, viewByTab);
					nextView[path] = "editor";
					return { viewByTab: nextView, detailByPath: detailByPath };
				}
				case "close": { // #11 标签关闭/文件删除：按 paths 批量删两映射键（groups 孤儿 GC 复用此通道）
					if (!Array.isArray(action.paths) || action.paths.length === 0) return state;
					let nextView = null;
					let nextDetail = null;
					for (const p of action.paths) {
						if (typeof p !== "string" || p.length === 0) continue;
						if (hasViewKey(p)) {
							if (!nextView) nextView = Object.assign({}, viewByTab);
							delete nextView[p];
						}
						if (hasDetailKey(p)) {
							if (!nextDetail) nextDetail = Object.assign({}, detailByPath);
							delete nextDetail[p];
						}
					}
					if (!nextView && !nextDetail) return state;
					return { viewByTab: nextView || viewByTab, detailByPath: nextDetail || detailByPath };
				}
				case "autoPopup": // #12 paneOpen=true→diff；#13 paneOpen=false→不分发视图键（保持 editor 默认）
					if (!path || action.paneOpen !== true) return state;
					return setView(path, "diff");
				case "firstSeen": // #14 首见无键→diff；有键（含显式 editor/preview）不动
					if (!path || hasViewKey(path)) return state;
					return setView(path, "diff");
				case "follow": // #15 入参即写 diff（ack/foreignTop 门控留组件层）；#16 follow=false 组件层不分发
					if (!path) return state;
					return setView(path, "diff");
				case "detailReady": { // #17/#19 只写 ready 缓存，不迁移视图（视图由显式 action 决定）
					if (!path || !action.detail || typeof action.detail !== "object") return state;
					if (hasDetailKey(path) && detailByPath[path].status === "ready" && detailByPath[path].detail === action.detail) return state;
					const nextDetail = Object.assign({}, detailByPath);
					nextDetail[path] = { status: "ready", detail: action.detail };
					return { viewByTab: viewByTab, detailByPath: nextDetail };
				}
				case "detailFailed": { // #20 写 failed；视图为 diff 时回退 editor（失败条+重试在组件层）
					if (!path) return state;
					const current = hasViewKey(path) ? viewByTab[path] : "editor";
					if (current !== "diff" && hasDetailKey(path) && detailByPath[path].status === "failed") return state;
					const nextDetail = Object.assign({}, detailByPath);
					nextDetail[path] = { status: "failed" };
					if (current !== "diff") return { viewByTab: viewByTab, detailByPath: nextDetail };
					const nextView = Object.assign({}, viewByTab);
					nextView[path] = "editor";
					return { viewByTab: nextView, detailByPath: nextDetail };
				}
				default:
					return state; // #22 未知 action 返回原引用
			}
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
					// 入口 #8 文件树批删（决策表 #11）：先收集被关标签再过滤，close 清两映射。
					const removedTabs = state.openTabs.filter(function(t) {
						const k = norm(t.path);
						return k === pre || k.startsWith(pre + "\\");
					});
					state.openTabs = state.openTabs.filter(function(t) {
						const k = norm(t.path);
						return !(k === pre || k.startsWith(pre + "\\"));
					});
					if (removedTabs.length && state._viewDispatch) {
						state._viewDispatch({ type: "close", paths: removedTabs.map(function(t) { return toAbs(t.path); }) });
					}
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
		* 数据源语义（不再接收 props.md）：若 Monaco 编辑器已就绪且持有当前文件模型，取 getValue()
		* （含未保存编辑），否则取 findOpenTab(path).content 标签内容。
		* 调度：Vditor 脚本为全局单例（window.__sideCoderVditor），组件重挂不重复 fetch+eval；
		* 自订阅 Monaco onDidChangeModelContent（编辑器晚于预览创建时 200ms 轮询挂载，最多 40 次），
		* 按键经 300ms 尾沿防抖后渲染；渲染前做 {path,content} 短路，内容不变不重复 preview；
		* 切换预览文件立即渲一次；主题翻转清短路记录强制渲一次。
		* @param props - path=当前文件路径；active=预览是否生效。
		*/
		function VditorPreview(props) {
			const boxRef = react.useRef(null);
			const darkRef = react.useRef(isDarkTheme());
			const renderTokenRef = react.useRef(0);
			// 300ms 尾沿防抖定时器；lastRenderedRef 记录上次成功渲染的 {path, content}，用于内容短路。
			const debounceTimerRef = react.useRef(null);
			const lastRenderedRef = react.useRef({ path: null, content: null });
			// 编辑器晚于预览创建时的重试定时器、剩余次数与内容订阅 disposable。
			const attachRetryTimerRef = react.useRef(null);
			const attachRetriesLeftRef = react.useRef(PREVIEW_EDITOR_ATTACH_MAX_RETRIES);
			const contentSubRef = react.useRef(null);
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
			// Vditor 加载状态为全局单例：多个预览组件实例（或重挂）共享同一份 loaded/loading，绝不重复 fetch+eval。
			function loadVditor() {
				const g = window.__sideCoderVditor = window.__sideCoderVditor || { loaded: false, loading: null };
				if (g.loaded) return Promise.resolve();
				if (g.loading) return g.loading;
				const base = VDITOR_CDN + "/dist";
				// method.min.js 与 katex.min.js 均为 UMD（会被 AMD 捕获）。
				// 先以经典脚本方式装载 Vditor 本身与 KaTeX（后者是 math 渲染所需的 window.katex 全局），
				// 其余资源（lute/mermaid/hljs 等）沿用 Vditor 内部脚本装载（实测可正常挂载全局）。
				g.loading = Promise.all([
					loadScriptClassic(base + "/method.min.js"),
					loadScriptClassic(base + "/js/katex/katex.min.js")
				]).then(function() {
					if (!window.Vditor) throw new Error("Vditor 挂载失败");
				}).then(function() {
					g.loaded = true;
					g.loading = null;
				}).catch(function(e) {
					// 失败时清掉全局 loading，允许后续重挂重试。
					g.loading = null;
					throw e;
				});
				return g.loading;
			}
			/** 读取本次应渲染的内容：编辑器 getValue 优先（含未保存编辑），标签内容回退。 */
			function readContent() {
				let content = "";
				const tab = findOpenTab(props.path);
				if (tab && typeof tab.content === "string") content = tab.content;
				const editor = state._editorInstance;
				const activeTab = state.activeTab;
				// showFileInEditor 让当前 Monaco 模型恒等于 state.activeTab 文件；
				// 仅当活动标签就是被预览文件、编辑器未 dispose 且持有模型时才用 getValue（含未保存编辑）。
				// 注意 Monaco 的 isDisposed 是方法不是属性，必须调用。
				const editorAlive = editor && (typeof editor.isDisposed !== "function" || !editor.isDisposed());
				if (activeTab && props.path && samePath(activeTab, props.path) && editorAlive && editor.getModel()) {
					content = editor.getValue();
				}
				return content;
			}
			/**
			* 渲染预览。force=true 时跳过内容短路（主题翻转用）；切文件时由 path effect 先清短路记录。
			*/
			function renderPreview(force) {
				const box = boxRef.current;
				if (!box || !window.Vditor) return;
				const content = readContent();
				// 内容短路：同一路径同一内容且非强制时跳过，避免无谓全量 preview。
				if (!force && lastRenderedRef.current.path === props.path && lastRenderedRef.current.content === content) return;
				lastRenderedRef.current = { path: props.path, content: content };
				const dark = darkRef.current;
				// 渲染令牌：翻转即表示一次新的渲染开始，旧渲染的异步回调据此提前退出。
				const token = ++renderTokenRef.current;
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
			/** 300ms 尾沿防抖：连续打字不渲染，停顿后渲一次。 */
			function schedulePreview() {
				if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current);
				debounceTimerRef.current = setTimeout(function() {
					debounceTimerRef.current = null;
					renderPreview(false);
				}, PREVIEW_RENDER_DEBOUNCE_MS);
			}
			/** 订阅 Monaco 内容变化；编辑器尚未创建时返回 false，由 200ms 重试定时器轮询。 */
			function attachEditor() {
				const editor = state._editorInstance;
				// Monaco 的 isDisposed 是方法，必须调用（防御非函数）。
				const editorAlive = editor && (typeof editor.isDisposed !== "function" || !editor.isDisposed());
				if (editorAlive && typeof editor.onDidChangeModelContent === "function") {
					if (attachRetryTimerRef.current !== null) {
						clearInterval(attachRetryTimerRef.current);
						attachRetryTimerRef.current = null;
					}
					contentSubRef.current = editor.onDidChangeModelContent(function() {
						// 仅当活动标签就是被预览文件时才调度，其它标签的按键与本预览无关。
						if (state.activeTab && props.path && samePath(state.activeTab, props.path)) schedulePreview();
					});
					return true;
				}
				return false;
			}
			react.useEffect(function() {
				// 主题翻转入口：强制渲染（清短路）。
				state._renderPreview = function() { renderPreview(true); };
				let mounted = true;
				// (a) mount 后 Vditor 就绪立即渲一次。
				loadVditor().then(function() {
					if (mounted && boxRef.current) renderPreview(false);
				}).catch(function(e) {
					console.error("[side-coder] Vditor 加载失败:", e);
				});
				// (b) 订阅编辑器内容变化；拿不到实例时 200ms 轮询直到编辑器创建（最多 40 次≈8s）。
				attachRetriesLeftRef.current = PREVIEW_EDITOR_ATTACH_MAX_RETRIES;
				if (!attachEditor()) {
					attachRetryTimerRef.current = setInterval(function() {
						attachRetriesLeftRef.current--;
						if (attachEditor() || attachRetriesLeftRef.current <= 0) {
							if (attachRetryTimerRef.current !== null) {
								clearInterval(attachRetryTimerRef.current);
								attachRetryTimerRef.current = null;
							}
						}
					}, PREVIEW_EDITOR_ATTACH_RETRY_MS);
				}
				return function() {
					mounted = false;
					if (state._renderPreview) state._renderPreview = null;
					if (debounceTimerRef.current !== null) {
						clearTimeout(debounceTimerRef.current);
						debounceTimerRef.current = null;
					}
					if (attachRetryTimerRef.current !== null) {
						clearInterval(attachRetryTimerRef.current);
						attachRetryTimerRef.current = null;
					}
					if (contentSubRef.current) {
						contentSubRef.current.dispose();
						contentSubRef.current = null;
					}
					// 翻转令牌让在途异步渲染回调失效。
					renderTokenRef.current++;
				};
			}, [props.path, props.active]);
			// (e) props.path/active 变化：重置短路记录，脚本已就绪时立即渲一次（不等防抖）。
			react.useEffect(function() {
				lastRenderedRef.current = { path: null, content: null };
				if (window.__sideCoderVditor && window.__sideCoderVditor.loaded && boxRef.current) renderPreview(false);
			}, [props.path, props.active]);
			return react.createElement("div", {
				ref: boxRef,
				className: "dsh-cc-preview vditor-reset"
			});
		}
	// ===== 行号范围共享辅助（添加到对话带行号 / 侧栏编程定位高亮） =====
	// 解析只认冒号锚定，避免把文件名里的数字（README 2026-10-10.md）误当行号。
	const LINE_RANGE_RE = /[:：][ \t]*([0-9]+)(?:[ \t]*-[ \t]*([0-9]+))?/;
	const PATH_SPEC_RE = /[:：][ \t]*([0-9]+)(?:[ \t]*-[ \t]*([0-9]+))?[ \t]*$/;
	const LINE_RANGE_SEP = " - ";
	const HIGHLIGHT_DECO = "dsh-cc-hl";
	const HIGHLIGHT_GUTTER = "dsh-cc-hl-gutter";
	// 定位/高亮刚完成的一小段时间内忽略「光标变化」引发的取消，避免刚高亮就被自己清掉。
	const HIGHLIGHT_DISMISS_SUPPRESS_MS = 400;
	let suppressDismissUntil = 0;
	// 当前高亮归属：{ editor, modelUri, ids }，保证同一时刻只有一份行高亮。
	const highlightOwner = { editor: null, modelUri: "", ids: [] };

	/**
	* 把行号区间格式化成 DSH 原生链接同款后缀形态。
	* @param fromLine - 起始行号（1 基）。
	* @param toLine - 结束行号（1 基，含）。
	* @returns 单行 ":12"，多行 ":12 - 20"。
	*/
	function formatLineRange(fromLine, toLine) {
		if (!Number.isFinite(fromLine) || fromLine < 1) return "";
		if (!Number.isFinite(toLine) || toLine < fromLine) toLine = fromLine;
		return fromLine === toLine ? ":" + fromLine : ":" + fromLine + LINE_RANGE_SEP + toLine;
	}

	/**
	* 解析行号规格文本（":12 - 20" / "3413" / "12-20"）。
	* @param spec - 含行号的字符串。
	* @returns { from, to } 或 null（没有有效行号）。
	*/
	function parseLineRangeSpec(spec) {
		const s = String(spec == null ? "" : spec);
		const hit = s.match(LINE_RANGE_RE);
		if (!hit) return null;
		const fromLine = Number(hit[1]);
		const toLine = hit[2] === undefined ? fromLine : Number(hit[2]);
		if (!Number.isFinite(fromLine) || fromLine < 1) return null;
		if (!Number.isFinite(toLine) || toLine < fromLine) return { from: fromLine, to: fromLine };
		return { from: fromLine, to: toLine };
	}

	/**
	* 把链接文本 "路径:12 - 20" 拆成 { path, range }。
	* 行号后缀必须是冒号锚定且位于结尾，否则整串当路径（防误切含数字的文件名）。
	* @param rawPath - 原始路径文本（可带行号后缀）。
	* @returns { path, range }，range 为 { from, to } 或 null。
	*/
	function splitPathLineSpec(rawPath) {
		const s = String(rawPath == null ? "" : rawPath);
		const hit = s.match(PATH_SPEC_RE);
		if (!hit) return { path: s.trim(), range: null };
		const path = s.slice(0, hit.index).replace(/[ \t\u3000]+$/, "").trim();
		const fromLine = Number(hit[1]);
		const toLine = hit[2] === undefined ? fromLine : Number(hit[2]);
		if (!path || !Number.isFinite(fromLine) || fromLine < 1) return { path: s.trim(), range: null };
		if (!Number.isFinite(toLine) || toLine < fromLine) return { path: path, range: { from: fromLine, to: fromLine } };
		return { path: path, range: { from: fromLine, to: toLine } };
	}

	/** 取编辑器当前模型的稳定标识；模型被 dispose 时返回 null。 */
	function modelUriOf(editor) {
		try {
			const model = editor.getModel();
			if (!model || typeof model.uri === "undefined") return null;
			return typeof model.uri.toString === "function" ? model.uri.toString() : String(model.uri);
		} catch (e) {
			return null;
		}
	}

	/** 撤掉上一次的一次性定位高亮；模型已换或编辑器已 dispose 时静默放弃。 */
	function clearLineHighlight() {
		const editor = highlightOwner.editor;
		const ids = highlightOwner.ids;
		highlightOwner.editor = null;
		highlightOwner.modelUri = null;
		highlightOwner.ids = null;
		if (!editor || ids == null || ids.length === 0) return;
		try {
			if (typeof editor.isDisposed === "function" && editor.isDisposed()) return;
			if (modelUriOf(editor) !== null) editor.deltaDecorations(ids, []);
		} catch (e) {}
	}

	/**
	* 用 Monaco 装饰器给 [fromLine, toLine] 整段加一次性底色高亮。
	* 同一编辑器同一模型下用旧 id 换新装饰（天然互斥，永远只有一段高亮）；
	* 换模型或换编辑器时旧 id 随旧模型一起消亡，不再传给 deltaDecorations。
	* @param editor - Monaco ICodeEditor 实例。
	* @param fromLine - 起始行（1 基，越界自动夹取）。
	* @param toLine - 结束行（1 基，越界自动夹取）。
	*/
	function setLineHighlight(editor, fromLine, toLine) {
		if (!editor || typeof editor.deltaDecorations !== "function" || typeof editor.getModel !== "function") {
			clearLineHighlight();
			return;
		}
		let model = null;
		try { model = editor.getModel(); } catch (e) {}
		if (!model || typeof model.getLineCount !== "function") {
			clearLineHighlight();
			return;
		}
		let maxLine = 0;
		try { maxLine = model.getLineCount(); } catch (e) {}
		if (maxLine < 1) {
			clearLineHighlight();
			return;
		}
		const clampLine = (value) => Math.max(1, Math.min(maxLine, Math.floor(value)));
		const from = clampLine(fromLine);
		const to = Math.max(from, clampLine(toLine));
		const decorationOptions = {
			isWholeLine: true,
			className: HIGHLIGHT_DECO,
			glyphMarginClassName: HIGHLIGHT_GUTTER,
			overviewRuler: { color: "#f59e0b", position: 4 },
			summary: "side-coder 定位高亮",
		};
		const monacoNs = typeof window !== "undefined" ? window.monaco : null;
		const decorations = [];
		for (let line = from; line <= to; line += 1) {
			const range = (monacoNs && typeof monacoNs.Range === "function")
				? new monacoNs.Range(line, 1, line, 1)
				: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 };
			decorations.push({ range: range, options: decorationOptions });
		}
		const uri = modelUriOf(editor);
		const previousIds = (highlightOwner.editor === editor && highlightOwner.modelUri === uri && highlightOwner.ids)
			? highlightOwner.ids
			: [];
		let ids = null;
		try { ids = editor.deltaDecorations(previousIds, decorations); } catch (e) { return; }
		highlightOwner.editor = editor;
		highlightOwner.modelUri = uri;
		highlightOwner.ids = ids;
	}

	/**
	* 把目标行滚进视野并对齐原生查看器的定位手感：
	* 目标段已完整可见就不动画面（避免同文件小幅跳转时乱晃），否则垂直居中，最后把光标放到段首。
	* @param editor - Monaco ICodeEditor 实例。
	* @param fromLine - 起始行。
	* @param toLine - 结束行。
	*/
	function revealLineRange(editor, fromLine, toLine) {
		if (!editor || typeof editor.revealLineInCenter !== "function") return;
		let firstVisible;
		let lastVisible;
		try {
			const ranges = typeof editor.getVisibleRanges === "function" ? editor.getVisibleRanges() : null;
			if (ranges && ranges.length) {
				firstVisible = ranges[0].startLineNumber;
				lastVisible = ranges[ranges.length - 1].endLineNumber;
			}
		} catch (e) {}
		const alreadyVisible = typeof firstVisible === "number" && typeof lastVisible === "number"
			&& fromLine >= firstVisible && toLine <= lastVisible;
		if (!alreadyVisible) {
			try {
				editor.revealLineInCenter(fromLine);
			} catch (e) {
				try { editor.revealLine(fromLine); } catch (nested) {}
			}
		}
		if (typeof editor.setPosition === "function") {
			try { editor.setPosition({ lineNumber: fromLine, column: 1 }); } catch (e) {}
		}
	}

	function installHighlightDismiss(editor) {
		if (!editor || typeof editor.onMouseDown !== "function") return;
		if (editor._dshCcDismiss) return;
		editor._dshCcDismiss = true;
		const dismissSoon = () => {
			// 程序化 reveal 会顺带移动光标，那次光标变化不算「用户点了别的文本」，
			// 否则刚打上的高亮会被自己触发的回调立刻清掉。
			if (Date.now() < suppressDismissUntil) return;
			setTimeout(clearLineHighlight, 0);
		};
		try { editor.onMouseDown(dismissSoon); } catch (e) {}
		try { editor.onDidBlurEditorText(dismissSoon); } catch (e) {}
		try { editor.onDidChangeCursorPosition(dismissSoon); } catch (e) {}
	}

	/**
	* 消费一次「点侧栏编程链接带来的定位请求」：滚到目标行并打上一段一次性高亮。
	* 请求里带路径，只有正在显示的文件与之相同才生效，避免陈旧请求把别的文件拽走。
	* @param editor - 刚 setModel 完成的 Monaco 实例。
	* @param shownPath - 当前显示的文件路径。
	*/
	function applyPendingLineRange(editor, shownPath) {
		const pending = state._pendingLineRange;
		if (!pending) {
			clearLineHighlight();
			return;
		}
		state._pendingLineRange = null;
		clearLineHighlight();
		if (!editor || typeof pending.fromLine !== "number") return;
		if (pending.path && shownPath && !samePath(toAbs(pending.path), toAbs(shownPath))) return;
		// 模型刚换，布局未完成：等一帧再滚动/加装饰；同时开一个短暂窗口忽略
		// 由本次 reveal 自己引起的光标/焦点变化。
		suppressDismissUntil = Date.now() + HIGHLIGHT_DISMISS_SUPPRESS_MS;
		setTimeout(function() {
			if (typeof editor.isDisposed === "function" && editor.isDisposed()) return;
			revealLineRange(editor, pending.fromLine, pending.toLine);
			setLineHighlight(editor, pending.fromLine, pending.toLine);
		}, 0);
	}

	/**
	* 汇总当前所有光标/选区的行号并集（多光标取最小起点与最大终点）。
	* @param editor - Monaco ICodeEditor 实例。
	* @returns {fromLine, toLine}；无模型或取不到选区时返回 null。
	*/
	function selectionLineRange(editor) {
		if (!editor || typeof editor.hasModel === "function" && !editor.hasModel()) return null;
		let selections = null;
		try {
			selections = typeof editor.getSelections === "function" ? editor.getSelections() : [editor.getSelection()];
		} catch (e) {
			return null;
		}
		if (!selections || !selections.length) return null;
		let fromLine = 0;
		let toLine = 0;
		for (let index = 0; index < selections.length; index += 1) {
			const sel = selections[index];
			if (!sel) continue;
			const low = Math.min(sel.startLineNumber, sel.endLineNumber);
			const high = Math.max(sel.startLineNumber, sel.endLineNumber);
			if (!fromLine || low < fromLine) fromLine = low;
			if (high > toLine) toLine = high;
		}
		if (!fromLine || !toLine) return null;
		return { fromLine: fromLine, toLine: toLine };
	}

	/**
	* 编辑器右键入口：按选区行号范围弹出插件自己的菜单（与文件树/标签菜单同款）。
	* 右击已选区不清选区、无选区时 Monaco 已把光标移到右击处，故必须等下一拍再读取选区。
	* @param clientX - 右键位置（视口坐标）。
	* @param clientY - 右键位置（视口坐标）。
	*/
	function openEditorContextMenu(clientX, clientY) {
		const editor = state._editorInstance;
		if (!editor || !state.activeTab) return;
		try {
			if (typeof editor.isDisposed === "function" && editor.isDisposed()) return;
		} catch (e) {}
		const range = selectionLineRange(editor);
		if (!range) return;
		state.contextMenu = {
			x: clientX,
			y: clientY,
			kind: "editor",
			path: state.activeTab,
			isDir: false,
			fromLine: range.fromLine,
			toLine: range.toLine
		};
		refresh();
	}

	/**
	* 给编辑器容器挂右键监听：禁用 Monaco 原生菜单后由本插件接管右键。
	* minimap / 滚动条 / 概览标尺上的右键不弹菜单，避免遮挡正常操作。
	* @param container - 编辑器容器元素。
	* @param editor - Monaco ICodeEditor 实例。
	*/
	function bindEditorContextMenu(container, editor) {
		if (!container || typeof container.addEventListener !== "function") return;
		if (container._dshCcContextMenu) return;
		container._dshCcContextMenu = true;
		container.addEventListener("contextmenu", function(event) {
			try {
				const node = event.target;
				if (node && typeof node.closest === "function") {
					if (node.closest(".minimap") || node.closest(".slider") || node.closest(".decorationsOverviewRuler")) return;
				}
				event.preventDefault();
				const clientX = event.clientX;
				const clientY = event.clientY;
				setTimeout(function() { openEditorContextMenu(clientX, clientY); }, 0);
			} catch (e) {}
		}, false);
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
			* 创建 Monaco 实例并接线 Ctrl+S、内容变更、挂起文件与右键菜单。
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
					lineNumbers: "on",
					// 关掉 Monaco 自带右键菜单：内置的 monaco 包没有 overrideMenuItem / addEditorAction
					// 可用（实测 grep 0 命中），无法往原生菜单插项，故整体换成插件自己的菜单，
					// 与文件树/标签右键菜单同款，并补回剪切/复制/粘贴。
					contextmenu: false
				});
				state._editorInstance = editorInstanceRef.current;
				installHighlightDismiss(editorInstanceRef.current);
				bindEditorContextMenu(container, editorInstanceRef.current);
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
						// 不再每键整面板 forceUpdate：leading+400ms 尾沿节流，最后一次按键后必有一次刷新。
						schedulePanelRefresh();
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
					// 入口 #1 激活已存在标签（决策表 #10）：按标签记忆，不分发迁移动作。
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
					// 入口 #2 新标签落地（决策表 #9，open 唯一落地处）：无键视同 editor，显式写键。
					if (state._viewDispatch) state._viewDispatch({ type: "open", path: toAbs(tabPath) });
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
				if (!tab) {
					state._pendingLineRange = null;
					return;
				}
				if (currentModelRef.current) currentModelRef.current.dispose();
				currentModelRef.current = window.monaco.editor.createModel(tab.content, langByPath(tab.path));
				editorInstanceRef.current.setModel(currentModelRef.current);
				// 换模型即旧高亮随旧模型消亡；这里按待处理请求决定是打新高亮还是什么都不做。
				applyPendingLineRange(editorInstanceRef.current, tab.path);
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
			// 三视图渲染门（T3）：只读 props.mainView（editor/diff/preview）单一来源，三态互斥、同一时刻仅一视图可见。
			const mainView = props.mainView === "diff" || props.mainView === "preview" ? props.mainView : "editor";
			const isMdPreviewable = !!props.previewPath && isMarkdownPath(props.previewPath);
			return react.createElement("div", { className: "dsh-cc-editor-panel", "data-view": mainView }, hasTabs ? react.createElement("div", {
				ref: editorRef,
				className: "dsh-cc-editor"
			}) : react.createElement("div", { className: "dsh-cc-editor-placeholder" }, "从左侧文件树打开文件开始编辑"), mainView === "preview" && isMdPreviewable ? react.createElement(VditorPreview, {
				// 内容不再经 props 传入：预览组件自行订阅编辑器/读标签内容，避免每键全量 preview。
				path: props.previewPath,
				active: true
			}) : null, mainView === "diff" ? (props.diffStatus === "ready" && props.diffDetail ? react.createElement(DiffOverlay, {
				detail: props.diffDetail,
				follow: props.follow,
				onClose: props.onDiffClose,
				onAdvanceBaseline: props.onAdvanceBaseline,
				onRetreatBaseline: props.onRetreatBaseline,
				onAdvanceLatestBaseline: props.onAdvanceLatestBaseline,
				onRetreatStartBaseline: props.onRetreatStartBaseline
			}) : props.diffStatus === "failed" ? react.createElement("div", { className: "dsh-cc-diff-state dsh-cc-diff-error", role: "alert" }, react.createElement("span", null, "对比内容载入失败"), react.createElement("button", {
				className: "dsh-cc-diff-retry",
				onClick: props.onRetryDetail
			}, "重试")) : react.createElement("div", { className: "dsh-cc-diff-state" }, props.diffStatus === "nochanges" ? "活动标签不在本次改动列表中，暂无对比内容" : "对比内容生成中…")) : null);
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
			// 以内容签名做 effect 依赖：detail 对象每次轮询可能是新引用，但只要 before/after/path/loading 没变，
			// 就不销毁重建 diff 编辑器——根治"每几秒闪一下、行位置重排"。loading 纳入签名：
			// 全文按需拉取期间 loading=true 不建编辑器（占位保留），全文到达 loading 转 false 后正常创建。
			const sig = (detail ? [detail.path, detail.before, detail.after, detail.kind, detail.time, detail.loading ? 1 : 0].join("\u0001") : "") + (detail.base ? "\u0002" + detail.base : "");
			react.useEffect(function() {
				let cancelled = false;
				// 跟随定位留下的定时重试与尺寸监听，退出对比时统一停掉；未就绪时为空函数。
				let alignCleanup = null;
				// loading 期间（全文尚未拉回）不 loadMonaco/不建 diff model，保留 JSX 占位"对比内容生成中…"；
				// 不做任何资源分配，cleanup 只需翻转 cancelled。
				if (detail && detail.loading) {
					return function() {
						cancelled = true;
					};
				}
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
		*               onToggleFollow=切换跟随；retryTick=失败重试序号（自增强制重拉 detail）；
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
			// 全文按需拉取（fileChangeContent）的请求序号：旧响应晚回来时丢弃，防止覆盖新选择。
			const detailSeqRef = react.useRef(0);
			// 当前 detail 已拉取的目标签名（path/sessionId/lastTime/baselinePos/chainLength），
			// 签名不变（哪怕 fileChanges 引用变了）不重复拉全文。
			const detailKeyRef = react.useRef("");
			// 失败条「重试」序号快照（决策表 #20 配套）：retryTick 自增时跳过签名去重强制重拉。
			const lastRetryRef = react.useRef(0);
			const [groups, setGroups] = react.useState([]);
			const [fileChanges, setFileChanges] = react.useState([]);
			const [selectedPath, setSelectedPath] = react.useState(null);
			// 选中镜像（方案3）：同步 effect 以活动标签为权威选中源，经此 ref 读当前选中值；
			// effect 依赖不含 selectedPath——列表点选只改选中、活动标签随后异步回写，
			// 若把 selectedPath 列进依赖会在回写落地前把选中拉回旧标签（点选抖动）。
			const selectedPathRef = react.useRef(null);
			react.useEffect(function() {
				selectedPathRef.current = selectedPath;
			}, [selectedPath]);
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
					// 降级形态（feed 内 grouped 失败后包的单组）files 不带 sessionId，这里补成所属组 id，
					// 后续按需拉全文的 fileChangeContent 必须带会话 id。
					const flatFiles = [];
					visibleGroups.forEach(function(g) {
						(g.files || []).forEach(function(f) {
							if (!f.sessionId) f.sessionId = g.sessionId;
							flatFiles.push(f);
						});
					});
					// 内容签名去重：任何层次的引用都不因假变化重建 diff。
					// 列表项已无 original/currentAfter（全文改由 fileChangeContent 按需拉取），签名只含 FileMeta 字段。
					const sig = JSON.stringify(flatFiles.map(function(item) {
						return [item.path, item.sessionId, item.count, item.lastTime, item.tool, item.changeKind, item.hasPatch, item.renamedFrom, item.baselinePos, item.chainLength];
					}));
					const prevRef = changesStateRef.current;
					const resolved = prevRef.sig === sig && prevRef.arr !== null ? prevRef.arr : flatFiles;
					changesStateRef.current = { sig, arr: resolved };
					setFileChanges(resolved);
					state.fileChanges = resolved;
					// 入口 #9/#10 groups 刷新保守 GC（计划书 4.4）：detailByPath 中「既不在 openTabs、
					// 也不在当前 fileChanges（toAbs 比对，renamedFrom 的新路径即 item.path）」的孤儿键清掉；
					// viewByTab 不随列表变化清理（视图是用户态，只随标签 close 清）。
					// 入口 #9 重命名旧路径在 client 侧无事件（host index.js:1598-1600 配对）：旧键随旧标签存活（#11 关标签清），漏网孤儿由本 GC 兜底。
					const viewDispatch = state._viewDispatch;
					const detailByKey = state._viewDetailByPath;
					if (viewDispatch && detailByKey) {
						const keepKeys = {};
						const keepKey = function(x) {
							return String(x || "").toLowerCase();
						};
						state.openTabs.forEach(function(t) {
							keepKeys[keepKey(toAbs(t.path))] = 1;
						});
						resolved.forEach(function(item) {
							keepKeys[keepKey(toAbs(item.path))] = 1;
						});
						const orphanPaths = Object.keys(detailByKey).filter(function(k) {
							return !keepKeys[keepKey(k)];
						});
						if (orphanPaths.length) viewDispatch({ type: "close", paths: orphanPaths });
					}
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
							// 显式自动弹出视图动作（决策表 #12）：payload 时点已分发过则此处同值 no-op；
							// payload 时面板未挂载导致分发丢失时由本消费点兜底（DiffPane 挂载 ⇒ 面板开着 ⇒ paneOpen=true）。
							if (state._viewDispatch) {
								state._viewDispatch({ type: "autoPopup", path: toAbs(pendingPath), paneOpen: true });
							}
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
						// 首见（决策表 #14）：本页从未设定视图的标签直接呈现最新改动 diff（产品决策 A 重载自动呈现）；
						// 已有视图键的标签不被覆盖。旧 detail 回发链的 _openFile 强切标签在此显式保留。
						if (state._viewDispatch) {
							state._viewDispatch({ type: "firstSeen", path: toAbs(top.path) });
						}
						if (state._openFile) state._openFile(toRel(top.path));
						return;
					}
					if (props.follow && state._autoselectAck !== top.path) {
						// C4 follow 同源门控："只看当前会话"开启时，若列表首行归属其它存活会话，
						// 不自动 setSelectedPath/setFlash/follow 分发（竞态或他会话组置顶时防止被别人带着跳）；
						// 他会话行仍可见、用户手动点击仍可查看，仅抑制自动动作。
						const followCurrentSid = getCurrentSessionId();
						const foreignTop = props.currentSession === true
							&& !!top.sessionId && !!followCurrentSid
							&& top.sessionId !== followCurrentSid;
						if (!foreignTop) {
							state._autoselectAck = top.path;
							setSelectedPath(top.path);
							setFlash(true);
							setTimeout(function() {
								if (mountedRef.current) setFlash(false);
							}, 2000);
							// follow 抢视图（决策表 #15）：ack/foreignTop 门控留在组件层，reducer 按入参无条件写 diff；
							// 旧 detail 回发链的 _openFile 强切标签在此显式保留（原「展开对比条」死回调已移除）。
							if (state._viewDispatch) {
								state._viewDispatch({ type: "follow", path: toAbs(top.path) });
							}
							if (state._openFile) state._openFile(toRel(top.path));
						}
					}
				}
				// 统一改动数据源：订阅 createChangeFeed（分组形态）。轮询间隔/空闲退避/后台标签页跳过/
				// grouped 失败降级为单组，全部在 feed 内部处理；DiffPane 只消费分组数据，不再自建 setInterval。
				// currentSession 随订阅对象下发（feed 决定 grouped 请求的 currentSessionId）。
				if (!state._changeFeed) state._changeFeed = createChangeFeed();
				const feed = state._changeFeed;
				const unsub = feed.subscribe({
					wantsGroups: true,
					currentSession: !!props.currentSession,
					onData: function(payload) {
						applyGroups((payload && payload.groups) || [], payload && payload.fetchedSessionId);
					}
				});
				// mount、currentSession 切换（重订）、基线按钮导致 pollTick 变化，都立即强拉一次。
				feed.refreshNow();
				return function() {
					cancelled = true;
					unsub();
				};
			}, [props.follow, props.activePath, props.currentSession, props.pollTick]);
			// 选中权威源同步（方案3）：活动标签变化（或其文件新进改动列表）且不在选中位时，选中跟随 activeTab，
			// 让 detail 缓存按 activeTab 落键——根治面板晚开时 selectedPath 与 activeTab 错位、
			// 「对比内容生成中…」永不落地的死态。不在改动列表中的标签不动作（渲染层显 nochanges 占位）。
			react.useEffect(function() {
				if (!props.activePath) return;
				if (selectedPathRef.current && samePath(toAbs(selectedPathRef.current), toAbs(props.activePath))) return;
				const hit = fileChanges.some(function(item) {
					return samePath(toAbs(item.path), toAbs(props.activePath));
				});
				if (hit) setSelectedPath(props.activePath);
			}, [props.activePath, fileChanges]);
			// 选中文件的全文按需拉取：列表项不再带 original/currentAfter，
			// 先上 loading 占位，再用 fileChangeContent 按 {sessionId,path} 拉全文。
			react.useEffect(function() {
				if (!selectedPath) {
					// 作废任何在途响应，并清掉目标签名，下次重新选择会重新拉取。
					detailSeqRef.current++;
					detailKeyRef.current = "";
					if (props.onDetailChange) props.onDetailChange(null);
					return;
				}
				const meta = fileChanges.find(function(item) {
					return samePath(toAbs(item.path), toAbs(selectedPath));
				});
				if (!meta) {
					if (props.onDetailChange) props.onDetailChange(null);
					return;
				}
				// 目标签名不变（同一文件、lastTime/baselinePos/chainLength 都没变）则不重复拉，
				// 也不重发 loading——fileChanges 已在 applyGroups 里按内容签名复用引用，这里再加一道保险。
				const key = [meta.path, meta.sessionId || "", meta.lastTime, meta.baselinePos, meta.chainLength].join("\u0001");
				// 失败重试（决策表 #20 配套）：retryTick 自增时跳过签名去重，强制重发同 key 的取数链。
				const retryTick = props.retryTick || 0;
				const forcedRetry = retryTick !== lastRetryRef.current;
				lastRetryRef.current = retryTick;
				// entryReady 前置（计划书 #2：进 diff 无 ready 必须触发该文件拉取）：close/孤儿 GC 清掉
				// detailByPath 条目后，同 key 签名去重会永远跳过拉取、载入占位永转——只有面板仍持有
				// 该文件的 ready 条目才允许跳过；条目缺失/failed 时一律重发取数链。
				const entryNow = props.detailByPath ? props.detailByPath[toAbs(meta.path)] : null;
				const entryReady = !!(entryNow && entryNow.status === "ready");
				if (!forcedRetry && key === detailKeyRef.current && entryReady) return;
				detailKeyRef.current = key;
				const seq = ++detailSeqRef.current;
				// 立即上 loading 占位（before/after 为 null），DiffOverlay 在 loading 时不建编辑器。
				// meta.path 统一走 toAbs：覆盖 item.path 可能是 POSIX 盘符 (/X/xxx)、Windows 绝对、相对三种形态，
				// 让 RPC 参数、dispatch action、samePath 比较全用同一归一键。
				const absPath = toAbs(meta.path);
				if (props.onDetailChange) props.onDetailChange({
					path: absPath,
					before: null,
					after: null,
					time: meta.lastTime,
					tool: meta.tool,
					count: meta.count,
					// 列表已无 original，无法区分 write/patch，统一按 write 渲染。
					kind: "write",
					baselinePos: meta.baselinePos,
					chainLength: meta.chainLength,
					loading: true
				});
				rpcCall("fileChangeContent", { sessionId: meta.sessionId || getCurrentSessionId(), path: absPath }).then(function(result) {
					// 旧响应（用户已改选别的文件）或组件卸载：丢弃。
					if (seq !== detailSeqRef.current || !mountedRef.current) return;
					if (result && result.found) {
						props.onDetailChange({
							path: result.path || absPath,
							before: result.original == null ? "" : result.original,
							after: result.currentAfter == null ? "" : result.currentAfter,
							time: result.lastTime,
							tool: result.tool,
							count: result.count,
							kind: "write",
							baselinePos: result.baselinePos,
							chainLength: result.chainLength,
							loading: false
						});
					} else if (props.onDetailChange) {
						// 无改动内容（决策表 #20 失败链）：回发失败标记，由 handleDiffDetail 直发 detailFailed{path}。
						props.onDetailChange({ path: absPath, failed: true });
					}
				}).catch(function() {
					if (seq !== detailSeqRef.current || !mountedRef.current) return;
					// 取数异常（决策表 #20 失败链）：同上回发失败标记。
					if (props.onDetailChange) props.onDetailChange({ path: absPath, failed: true });
				});
			}, [selectedPath, fileChanges, props.retryTick]);
			const current = fileChanges.find(function(item) {
				return samePath(toAbs(item.path), toAbs(selectedPath));
			}) || null;
			// 左右三角在已修改文件之间按最后修改先后顺序切换（列表本身按 lastTime 降序）。
			const currentIndex = current ? fileChanges.findIndex(function(item) {
				return samePath(toAbs(item.path), toAbs(selectedPath));
			}) : -1;
			// 行点选/文件翻页显式切 diff（决策表 #18 与行点选入口）：视图动作由这里直发，不再依赖 detail 回发隐式驱动；
			// 当前已是 diff 时不重复分发（view:diff 对已是 diff 的标签是 #6 退出语义，重复分发会误退回 editor）。
			function ensureDiffView(path) {
				if (!path) return;
				const currentView = (state._viewByTab && state._viewByTab[toAbs(path)]) || "editor";
				if (currentView === "diff") return;
				if (state._viewDispatch) {
					state._viewDispatch({ type: "view", path: toAbs(path), view: "diff", isMd: isMarkdownPath(path) });
				}
			}
			function stepFile(delta) {
				if (fileChanges.length === 0) return;
				const next = ((currentIndex + delta) % fileChanges.length + fileChanges.length) % fileChanges.length;
				const nextPath = fileChanges[next].path;
				setSelectedPath(nextPath);
				// #18 文件翻页：打开/激活 q 标签并显式切 diff（q 有缓存直显）；来源 p 的视图键不动。
				ensureDiffView(nextPath);
				if (state._openFile) state._openFile(nextPath);
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
						// 行点选：显式开标签 + 切 diff 视图（原 detail 回发的隐式切签已移除，T4 解耦）。
						ensureDiffView(item.path);
						if (state._openFile) state._openFile(item.path);
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
			}), flash ? "● 新改动 · " : "", title), react.createElement("button", {
				// 面板标题栏 ✕ 收起（计划书 4.3：面板开合归标题栏）：写 changePaneOpen=false 并持久化。
				className: "dsh-cc-diff-btn dsh-cc-diff-close",
				title: "收起对比区",
				onClick: function() {
					if (props.onPaneClose) props.onPaneClose();
				}
			}, "✕")), react.createElement("div", { className: "dsh-cc-diff-files" }, (function() {
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
		* 取对话输入框当前光标/选区在 detect 视图的插入位置。
		* 优先宿主的 captureInsertion()（自带 draftRev 校验），退化到 caretSpan()；
		* 两者都拿不到时返回 null，由调用方回退「插到末尾」的旧行为。
		* @param input - conversation.input.for(actx) 的返回对象。
		* @param snapshot - input.state.getSnapshot() 的结果，用于补 draftRev。
		*/
		function inputCaretSpan(input, snapshot) {
			try {
				if (typeof input.captureInsertion === "function") {
					const span = input.captureInsertion();
					if (span && Number.isFinite(span.start) && Number.isFinite(span.end)) return span;
				}
			} catch (e) {}
			try {
				if (typeof input.caretSpan === "function") {
					const span = input.caretSpan();
					if (span && Number.isFinite(span.start) && Number.isFinite(span.end)) {
						return { start: span.start, end: span.end, draftRev: snapshot ? snapshot.draftRev : undefined };
					}
				}
			} catch (e) {}
			return null;
		}
		/**
		* 把文件/文件夹加入对话输入框：文件走结构化引用（和 DSH 自带 @文件 同款），
		* 文件夹用 @目录/ 纯文本；拿不到会话输入服务时退化为把引用文本复制到剪贴板。
		* @param relPath - 树内相对路径。
		* @param isDir - 是否文件夹。
		* @param lineRange - 可选 {fromLine,toLine}；带上时引用文本形如 `@路径:12 - 20`，
		*   而 chip 的 ref 保持纯路径（`@路径`），以免破坏宿主的路径解析。
		*/
		function addToConversation(relPath, isDir, lineRange) {
			const mention = isDir ? "@" + String(relPath).replace(/\\/g, "/").replace(/\/+$/, "") + "/" : fileMentionText(relPath);
			if (!mention) return;
			const rangeSpec = (!isDir && lineRange && typeof lineRange.fromLine === "number")
				? formatLineRange(lineRange.fromLine, lineRange.toLine === undefined ? lineRange.fromLine : lineRange.toLine)
				: "";
			const mentionText = mention + rangeSpec;
			try {
				const pluginCtx = state._pluginCtx;
				const sessionId = getCurrentSessionId();
				const actx = pluginCtx && sessions && typeof sessions.scope === "function" && sessionId ? sessions.scope(sessionId) : null;
				const conversation = pluginCtx && typeof pluginCtx.get === "function" ? pluginCtx.get("conversation") : null;
				if (!actx || !conversation || !conversation.input) throw new Error("会话输入服务不可用");
				const input = conversation.input.for(actx);
				if (isDir || typeof actx.emit !== "function") {
					const before = input.state.getSnapshot().draft;
					const next = !before || before.trim() === "" ? mentionText : before + " " + mentionText;
					input.setDraft(next);
				} else {
					const before = input.state.getSnapshot();
					// 插入点优先取输入框当前光标/选区（用户把光标停在中间时就插在那里），
					// 拿不到才回退到「文档末尾」。
					const caretSpan = inputCaretSpan(input, before);
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
							label: baseName(relPath) + rangeSpec,
							appearance: "file",
							clipboardText: mentionText
						},
						span: caretSpan || {
							draftRev: before.draftRev,
							start: detectEnd,
							end: detectEnd
						}
					});
				}
			} catch (e) {
				console.warn("[side-coder] 加入对话失败，改为复制引用文本:", e);
				copyText(mentionText);
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
				// 入口 #7 文件树单删（决策表 #11）：先收集被关标签再过滤，close 清两映射。
				const removedTabs = state.openTabs.filter(function(t) {
					const k = norm(t.path);
					return k === pre || k.startsWith(pre + "\\");
				});
				state.openTabs = state.openTabs.filter(function(t) {
					const k = norm(t.path);
					return !(k === pre || k.startsWith(pre + "\\"));
				});
				if (removedTabs.length && state._viewDispatch) {
					state._viewDispatch({ type: "close", paths: removedTabs.map(function(t) { return toAbs(t.path); }) });
				}
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
			const isEditor = menu.kind === "editor";
			const tabOps = props.tabOps || {};
			// 编辑器菜单：Monaco 原生右键菜单已由 contextmenu:false 关闭（内置 monaco 构建里没有
			// overrideMenuItem / addEditorAction 可用），这里补回剪切/复制/粘贴，
			// 走 editor.trigger 保留多光标与剪贴板行为，不伪造按键。
			const editorRange = isEditor && typeof menu.fromLine === "number"
				? { fromLine: menu.fromLine, toLine: typeof menu.toLine === "number" ? menu.toLine : menu.fromLine }
				: null;
			const triggerEditor = function(actionId) {
				const editor = state._editorInstance;
				if (!editor || typeof editor.trigger !== "function") return;
				try {
					if (typeof editor.focus === "function") editor.focus();
					editor.trigger("keyboard", actionId, null);
				} catch (e) {
					console.warn("[side-coder] 编辑器剪贴板操作失败:", e);
				}
			};
			const editorLineLabel = !editorRange ? "💬 添加到对话"
				: editorRange.fromLine === editorRange.toLine
					? "💬 添加到对话（第 " + editorRange.fromLine + " 行）"
					: "💬 添加到对话（第 " + editorRange.fromLine + " - " + editorRange.toLine + " 行）";
			const items = isEditor ? [
				{ id: "reflines", label: editorLineLabel, run: function() {
					addToConversation(menu.path, false, editorRange);
				} },
				{ id: "reffile", label: "📄 添加到对话（仅文件）", disabled: !editorRange, run: function() {
					addToConversation(menu.path, false, null);
				} },
				{ id: "sep0", sep: true },
				{ id: "ecut", label: "✂️ 剪切", run: function() {
					triggerEditor("editor.action.clipboardCutAction");
				} },
				{ id: "ecopy", label: "📋 复制", run: function() {
					triggerEditor("editor.action.clipboardCopyAction");
				} },
				{ id: "epaste", label: "📥 粘贴", run: function() {
					triggerEditor("editor.action.clipboardPasteAction");
				} },
				{ id: "sep1", sep: true },
				{ id: "rel", label: "📄 复制相对路径", run: function() {
					copyText(menu.path.replace(/\//g, "\\"));
				} },
				{ id: "abs", label: "📁 复制绝对路径", run: function() {
					copyText(toAbs(menu.path));
				} }
			] : isTab ? [
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
			const menuWidth = isEditor ? 300 : 220;
			const menuHeight = isEditor ? 300 : 340;
			const left = Math.max(0, Math.min(menu.x, window.innerWidth - menuWidth));
			const top = Math.max(0, Math.min(menu.y, window.innerHeight - menuHeight));
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
			// 三视图状态机（计划书 4.1/4.6）：viewByTab=各标签视图态（键=绝对路径，无键视同 editor，仅会话内存、不持久化）；
			// detailByPath=各文件 diff 缓存（条目仅由 detailReady/detailFailed 写入，loading 为渲染层派生态）。
			const [viewState, dispatch] = react.useReducer(reduceViewState, { viewByTab: {}, detailByPath: {} });
			const viewByTab = viewState.viewByTab;
			const detailByPath = viewState.detailByPath;
			// 模块级标签变更入口（openFile 落地、删标签、文件树单删/批删、groups GC）经 state._viewDispatch 分发；
			// _viewDetailByPath 供 applyGroups 计算 GC 孤儿键；_viewByTab 供 DiffPane ensureDiffView 判定当前视图
			// （三处均无 reducer 闭包访问权，渲染期每次刷新引用）。
			state._viewDispatch = dispatch;
			state._viewDetailByPath = detailByPath;
			state._viewByTab = viewByTab;
			const [treeOpen, setTreeOpen] = react.useState(state.treeOpen !== false);
			// 失败条「重试」（决策表 #20 配套）：自增后传给 DiffPane 强制重发 detailReady/detailFailed 取数链。
			const [detailRetryTick, setDetailRetryTick] = react.useState(0);
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
			// 面板首次挂载后的空闲期预热 Monaco：把 editor.main.js（约 3.77MB）的下载与解析
			// 提前到空闲时段，消除"agent 直接弹 DiffOverlay 而用户从没开过编辑器"时的现场等待。
			// loadMonaco 幂等（复用同一 Promise），预热失败静默（真正使用时仍会再次尝试）。
			react.useEffect(function() {
				if (state.monacoLoaded || state._monacoPreheatScheduled) return;
				state._monacoPreheatScheduled = true;
				function kick() {
					loadMonaco().catch(function() {});
				}
				if (typeof requestIdleCallback === "function") {
					requestIdleCallback(kick, { timeout: 3000 });
				} else {
					setTimeout(kick, 1500);
				}
			}, []);
			react.useEffect(function() {
				if (state._pendingOpenPath && state._openFile) {
					const pendingPath = state._pendingOpenPath;
					state._pendingOpenPath = null;
					handleFileOpen(toRel(pendingPath));
				}
				// 自动弹出不强行翻开「对比」：尊重用户记住的开关状态；
				// _pendingChangePath 保留着，DiffPane applyGroups 消费并直跳最新改动。
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
				// detail 拉取链回发（T4 解耦）：ready→detailReady（#19/#17 只写缓存、不迁视图）；
				// failed→detailFailed（#20 写失败态，视图是否回 editor 由 reducer 按当前视图裁决）；
				// loading 占位不落盘（渲染层按「view=diff 且非 ready/failed」派生占位）；
				// 切签副作用已移除：autoPopup/首见/follow/行点选/翻页各自显式分发动作并开标签。
				if (!detail || !detail.path || detail.loading) return;
				if (detail.failed) {
					dispatch({ type: "detailFailed", path: toAbs(detail.path) });
					return;
				}
				dispatch({ type: "detailReady", path: toAbs(detail.path), detail: detail });
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
				// 旧 setPreview(false) 已移除：预览态由 viewByTab 按标签记忆，新标签默认 editor（#9），不跨文件继承。
				if (state._openFile) state._openFile(filePath);
			}
			function handleEntryMenu(e, path, isDir) {
				state.contextMenu = { path, isDir, x: e.clientX, y: e.clientY };
				refresh();
			}
			function handleTabSelect(path) {
				// 切到已开标签（入口 #3，决策表 #10）：视图按标签记忆，不分发迁移动作。
				// 旧 setPreview(false) 已移除：非 md 标签的 view 键只能是 editor/diff（#4 拒绝 preview）。
				state.activeTab = path;
				if (state._openFile) state._openFile(path);
			}
			// 活动标签的 diff 数据态：ready 明细（键=toAbs(标签路径)，不看面板开关——面板关闭后缓存仍可展示）；
			// loading/failed 由渲染层按 mainView 派生占位/失败条。
			const activeEntry = state.activeTab ? detailByPath[toAbs(state.activeTab)] : null;
			const activeDiff = activeEntry && activeEntry.status === "ready" ? activeEntry.detail : null;
			// 权威源派生（方案3）：活动标签是否在改动列表中。不在列表 ⇒ diff 视图无数据可显，
			// 渲染层据此显 nochanges 占位，替代旧派生里「条目缺失一律 loading」的永卡死形态。
			const activeTabInChanges = !!state.activeTab && (state.fileChanges || []).some(function(item) {
				return samePath(toAbs(item.path), toAbs(state.activeTab));
			});
			// 当前活动标签的视图态（无键视同 editor），三视图渲染与 segmented 高亮的唯一来源。
			const mainView = state.activeTab ? (viewByTab[toAbs(state.activeTab)] || "editor") : "editor";
			function handleTabClose(path) {
				// 入口 #4 关标签（决策表 #11）：close 单键，同时删 viewByTab/detailByPath。
				const closedAbs = toAbs(path);
				state.openTabs = state.openTabs.filter(function(t) {
					return !samePath(t.path, path);
				});
				dispatch({ type: "close", paths: [closedAbs] });
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
				// 入口 #5 关闭其它标签（决策表 #11）：批量 close 被关标签的键。
				const closedPaths = state.openTabs.filter(function(t) {
					return !samePath(t.path, path);
				}).map(function(t) {
					return toAbs(t.path);
				});
				state.openTabs = state.openTabs.filter(function(t) {
					return samePath(t.path, path);
				});
				dispatch({ type: "close", paths: closedPaths });
				if (!samePath(toAbs(state.activeTab), toAbs(path))) {
					state.activeTab = path;
					if (state._openFile) state._openFile(path);
				}
				refresh();
			}
			function handleCloseAll() {
				// 入口 #6 关闭全部标签（决策表 #11）：批量 close 全部键。
				const closedPaths = state.openTabs.map(function(t) {
					return toAbs(t.path);
				});
				state.openTabs = [];
				state.activeTab = null;
				dispatch({ type: "close", paths: closedPaths });
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
			return react.createElement("div", { className: "dsh-cc-dock" }, react.createElement(UpdateBanner), react.createElement("div", { className: "dsh-cc-header" }, react.createElement("span", { className: "dsh-cc-header-title" }, "⌨️ 侧栏编程"), react.createElement("div", { className: "dsh-cc-header-actions" }, react.createElement("div", {
				className: "dsh-cc-view-seg",
				role: "group",
				"aria-label": "编辑器视图切换"
			}, react.createElement("button", attrs({
				className: "dsh-cc-diff-btn" + (mainView === "preview" ? " active" : ""),
				title: "Markdown 只读预览（当前文件为 .md/.markdown/.mdx 时可用）；再点一次回普通编辑",
				"aria-pressed": mainView === "preview",
				disabled: !state.activeTab || !isMarkdownPath(state.activeTab),
				onClick: function() {
					// 视图切换（决策表 #3/#5 进预览、#8 再点回 editor；#4 非 md 由 reducer 返回原 state）。
					dispatch({ type: "view", path: toAbs(state.activeTab), view: "preview", isMd: isMarkdownPath(state.activeTab) });
				}
			}), "预览"), react.createElement("button", attrs({
				className: "dsh-cc-diff-btn" + (mainView === "diff" ? " active" : ""),
				title: "对比视图：编辑器区显示改动 diff（面板开合用改动列表区标题栏 ✕）",
				"aria-pressed": mainView === "diff",
				disabled: !state.activeTab,
				onClick: function() {
					// 无活动标签时面板纯开关（决策表以活动标签为前提，此处不涉及视图态）；
					// 有标签时走视图 action（#1/#2 进 diff 并按需开面板、#6 退出、#7 preview 一步回 diff）。
					if (!state.activeTab) {
						setDiffOpen(!diffOpen);
						write_toggle(TOGGLE_DIFF_OPEN, !diffOpen);
						return;
					}
					const willBeDiff = mainView !== "diff";
					const activeEntryNow = detailByPath[toAbs(state.activeTab)];
					dispatch({ type: "view", path: toAbs(state.activeTab), view: "diff", isMd: isMarkdownPath(state.activeTab) });
					// #2 触发链：进 diff 且条目缺失（载入占位）时自增重试序号，令 detail effect 依赖变化
					// 并强制重发取数链（否则 close 清条目后永转载入占位）；ready 条目直接复用缓存；
					// failed 条目不自动重发——由失败条上的「重试」显式触发，否则 #20 会把视图立刻打回 editor。
					if (willBeDiff && !activeEntryNow) {
						setDetailRetryTick(function(t) {
							return t + 1;
						});
					}
					// #1/#2：目标为 diff 且面板关闭时，先置 changePaneOpen=true 并写盘（本按钮不开面板、只开不关）。
					if (willBeDiff && !diffOpen) {
						setDiffOpen(true);
						write_toggle(TOGGLE_DIFF_OPEN, true);
					}
				}
			}), "对比")), react.createElement("button", attrs({
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
				// 三视图渲染门（T3）：只读 mainView 单一来源；diffStatus 为该标签 detail 缓存状态；
				// diff 数据为 ready 明细，loading/failed 由 EditorPanel 派生占位/失败条。
				mainView,
				diffStatus: activeDiff ? "ready" : (activeEntry ? activeEntry.status : (activeTabInChanges ? "loading" : "nochanges")),
				diffDetail: activeDiff,
				previewPath: state.activeTab,
				follow,
				onRetryDetail: function() {
					// 失败条「重试」：自增重试序号强制 DiffPane 重发取数链；面板未开则按 #1 先置 changePaneOpen=true 写盘。
					setDetailRetryTick(function(t) {
						return t + 1;
					});
					if (!diffOpen) {
						setDiffOpen(true);
						write_toggle(TOGGLE_DIFF_OPEN, true);
					}
				},
				onDiffClose: function() {
					// ✕ 退出对比（决策表 #21）：只切回普通编辑视图，detail 缓存保留。
					dispatch({ type: "view", path: toAbs(state.activeTab), view: "editor", isMd: isMarkdownPath(state.activeTab) });
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
				retryTick: detailRetryTick,
				detailByPath,
				onToggleFollow: function() {
					const nextFollow = !follow;
					setFollow(nextFollow);
					write_toggle(TOGGLE_FOLLOW, nextFollow);
				},
				onPaneClose: function() {
					// 面板标题栏 ✕ 收起（计划书 4.3）：面板开合自此归标题栏，「对比」按钮只管视图切换。
					setDiffOpen(false);
					write_toggle(TOGGLE_DIFF_OPEN, false);
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
		* DSH 对话消息流中需要尾巴注入的三种文件按钮：
		* 1. 工具行 fileLink，CSS module hash 类名以 fileLink 结尾如 o3BgMG_fileLink，
		*    按钮文本是相对会话 cwd 的路径，显示层已 relativizeToCwd，点击默认由 Host 用系统默认应用打开。
		* 2. 产物区文件按钮，data-produced-files-row 容器内的 button，文本是 basename，完整绝对路径在 title 属性里。
		* 3. 轮尾「已编辑 N 个文件」改动卡片（data-changed-files）的文件行：CSS module 类名不可预测，
		*    按结构定位 ul 内的行按钮；行文本是「路径 + 增删统计」拼接，全路径藏在
		*    aria-describedby 指向的隐藏 span 里，见 changesRowPath。
		* 统一规则：在按钮后追加「侧栏编程」尾巴——点击路径本身保持原行为，外部打开，
		* 点击「侧栏编程」四字则在插件内打开该文件；行自带行号时（消息流正文链接）尾巴携带行号做定位高亮。
		*/
		const LINK_BTN_SELECTOR = "button[class*=\"fileLink\"], [data-produced-files-row=\"true\"] button[title], [data-changed-files] ul button";
		/**
		* 取改动卡片行按钮的全路径。行按钮自身文本是「路径 + 增删统计」拼接，不能直接用；
		* 全路径在 aria-describedby 指向的隐藏 span 里（resolveWorkspacePath(cwd, path)，
		* 相对路径已拼上工作目录，工作目录外的绝对路径原样保留）。
		* 没有 aria-describedby 或指向为空时返回空串——严格取不到就不注入，
		* 避免把浮层控制按钮的文案当路径开出错误标签。
		* @param btn - 改动卡片的行按钮元素。
		* @returns 全路径或空串。
		*/
		function changesRowPath(btn) {
			const id = btn.getAttribute("aria-describedby");
			if (!id) return "";
			const desc = document.getElementById(id);
			return desc ? (desc.textContent || "").trim() : "";
		}
		/**
		* 从按钮提取目标路径：优先用注入时缓存的干净路径即 data-cc-path，
		* 其次产物区按钮的 title 即绝对路径，改动卡片行走 aria-describedby 的隐藏 span，
		* 否则用文本即相对路径。
		* 不直接读 textContent——尾巴 span 注入后 textContent 会带上「侧栏编程」，
		* 重扫时若据此覆盖 dataset.path 会污染路径。
		* @param btn - 文件按钮元素。
		*/
		function btnPath(btn) {
			const cached = btn.getAttribute("data-cc-path");
			if (cached) return cached;
			const title = btn.getAttribute("title");
			if (title && /^[A-Za-z]:[\\/]|^\\\\/.test(title)) return title;
			if (btn.closest && btn.closest("[data-changed-files]")) return changesRowPath(btn);
			return (btn.textContent || "").trim();
		}
		/**
		* 为单个 fileLink 按钮注入尾巴 span。幂等：已注入且路径未变则跳过。
		* 注入时把路径快照存到 span.dataset.path 供点击用，并把干净路径缓存到
		* 按钮 data-cc-path，重扫时从此读，避免尾巴文本污染 textContent 后误覆盖。
		* 全量扫描（injectLinkTails）与增量扫描（MutationObserver addedNodes）共用本函数。
		* @param btn - 待注入的按钮元素。
		*/
		function injectOne(btn) {
			if (!btn) return;
			const raw = btnPath(btn);
			// 消息流里的文件链接常自带行号（如 `lib/client.js:3413`、`a.md:12 - 20`）：
			// 打开时要把行号从路径里剥出来——路径用来开文件，行号用来定位并高亮。
			const split = splitPathLineSpec(raw);
			const path = split.path;
			let lineSpec = split.range ? formatLineRange(split.range.from, split.range.to) : "";
			// btnPath 优先返回缓存的干净路径，重扫时行号已不在文本里，故回读按钮上的旧行号。
			if (!lineSpec) lineSpec = btn.getAttribute("data-cc-linespec") || "";
			if (!btn.hasAttribute("data-cc-path")) btn.setAttribute("data-cc-path", path);
			if (lineSpec) btn.setAttribute("data-cc-linespec", lineSpec);
			if (!path) return;
			const lineText = lineSpec ? lineSpec.replace(/^:/, "") : "";
			const existing = btn.querySelector(".dsh-cc-open-here");
			if (existing) {
				if (existing.dataset.path !== path) existing.dataset.path = path;
				if (lineText && existing.dataset.linespec !== lineText) existing.dataset.linespec = lineText;
				return;
			}
			const span = document.createElement("span");
			span.className = "dsh-cc-open-here";
			span.textContent = "侧栏编程";
			span.title = lineText ? "在侧栏编程中打开并定位到第 " + lineText + " 行" : "在侧栏编程中打开";
			span.dataset.path = path;
			span.dataset.linespec = lineText;
			// 改动卡片行右侧还有 +N -M 统计（最后一个子元素）：尾巴插到统计之前，
			// 让统计仍贴右对齐；工具行/产物区按钮直接追加在末尾。
			const inChangesRow = !!(btn.closest && btn.closest("[data-changed-files]"));
			const countsAnchor = inChangesRow ? btn.lastElementChild : null;
			if (countsAnchor) {
				btn.insertBefore(document.createTextNode("\xA0"), countsAnchor);
				btn.insertBefore(span, countsAnchor);
			} else {
				btn.appendChild(document.createTextNode("\xA0"));
				btn.appendChild(span);
			}
		}
		/**
		* 为指定容器内的所有 fileLink 按钮注入尾巴 span（启动时全量扫描用）。
		* @param root - 待扫描的容器。
		*/
		function injectLinkTails(root) {
			if (!root || !root.querySelectorAll) return;
			const buttons = root.querySelectorAll(LINK_BTN_SELECTOR);
			for (let i = 0; i < buttons.length; i++) {
				injectOne(buttons[i]);
			}
		}
		/**
		* 在插件内打开消息流 fileLink 指出的文件：打开面板 → 等 root 就绪 → 读文件。
		* 路径可能相对当前会话 cwd，DSH 显示层已 relativizeToCwd，也可能本身就是绝对路径。
		* @param rawPath - 尾巴携带的干净路径快照（行号已剥掉）。
		* @param lineSpec - 尾巴携带的行号段（如 `12 - 20`），空表示本次不带定位。
		*/
		function openPathInPicker(rawPath, lineSpec) {
			// 先登记定位请求，再开面板：无行号时也要清空旧值，避免上一次的高亮串到这次打开。
			const range = parseLineRangeSpec(lineSpec);
			state._pendingLineRange = range ? { path: rawPath, fromLine: range.from, toLine: range.to } : null;
			openSidebarTab();
			let attempts = 0;
			function tryOpen() {
				if (!state.root || !state._openFile) {
					if (attempts++ < 40) {
						setTimeout(tryOpen, 250);
						return;
					}
					console.error("[side-coder] 文件树根未就绪，无法在插件内打开:", rawPath);
					state._pendingLineRange = null;
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
			openPathInPicker(rawPath, pill.dataset.linespec || "");
		}
		/** 启动消息流尾巴注入：MutationObserver 监听 DOM 变化 + 文档级点击拦截。
		 *  优化：① observe 只看 childList+subtree（去掉 characterData，文本变动不触发）；
		 *  ② 回调按 requestAnimationFrame 合并，一帧最多处理一次（scheduled 标志）；
		 *  ③ 处理改为增量：只扫本批 mutation 的 addedNodes，节点本身匹配选择器就注入自身，
		 *  否则在其子树里找匹配按钮逐个注入，不再每次全文档 querySelectorAll。 */
		function startLinkTailWatcher() {
			if (state._linkTailStarted) return;
			state._linkTailStarted = true;
			injectLinkTails(document);
			let scheduled = false;
			let rafId = 0;
			let pendingRecords = [];
			function processRecords(records) {
				for (let r = 0; r < records.length; r++) {
					const nodes = records[r].addedNodes;
					if (!nodes) continue;
					for (let i = 0; i < nodes.length; i++) {
						const node = nodes[i];
						// 只处理元素节点；文本节点/注释节点跳过。
						if (node.nodeType !== 1) continue;
						const el = node;
						// 节点本身就是目标按钮：直接注入。
						if (el.matches && el.matches(LINK_BTN_SELECTOR)) {
							injectOne(el);
						}
						// 节点内部（含本身）还可能藏着目标按钮：扫一遍子树。
						if (el.querySelectorAll) {
							const inner = el.querySelectorAll(LINK_BTN_SELECTOR);
							for (let j = 0; j < inner.length; j++) {
								injectOne(inner[j]);
							}
						}
					}
				}
			}
			state._linkTailObserver = new MutationObserver(function(records) {
				// 把本批 records 攒进队列，已调度 rAF 就不再重复调度——一帧合并处理一次。
				pendingRecords.push.apply(pendingRecords, records);
				if (scheduled) return;
				scheduled = true;
				rafId = requestAnimationFrame(function() {
					scheduled = false;
					rafId = 0;
					const batch = pendingRecords;
					pendingRecords = [];
					processRecords(batch);
				});
			});
			state._linkTailObserver.observe(document.body, {
				childList: true,
				subtree: true
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