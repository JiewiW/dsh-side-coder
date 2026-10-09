import { access, cp, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, extname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { gzipSync, brotliCompressSync, constants as zlibConstants } from "node:zlib";
import { createHash } from "node:crypto";
//#region src/rpc-channel.ts
/** 端点路径段的合法字符集，与官方 ENDPOINT_SEGMENT_PATTERN 一致。 */
const SEGMENT = /^[A-Za-z0-9_$.-]+$/;
/**
* 请求体上限，与官方 bridge 默认的 300MiB 对齐。
* 请求体是整份文件内容加 JSON 封装，原来的 8MiB 会让约 8MiB 的文件保存失败，
* 而 readFile 响应不限长，会出现能打开却保存不了的不一致。
*/
const MAX_BODY_BYTES = 314572800;
/** 唯一接受的 content-type，与官方信封契约一致。 */
const JSON_MIME = "application/json";
/** 请求体超限的标记错误，由 serve 决定如何回写与断开。 */
var PayloadTooLargeError = class extends Error {};
/**
* 挂载一条 RPC 通道。webServer 或 connection 缺席时不挂载，其余功能不受影响。
* @param ctx - 插件上下文。
* @param channel - 绝对通道前缀，例如 /side-coder。
* @param handler - 端点处理器。
*/
function mountRpcChannel(ctx, channel, handler) {
	ctx.inject(["connection", "webServer"], (raw) => {
		const scope = raw;
		scope.effect(() => scope.webServer.register({
			kind: "prefix",
			path: channel,
			handler: (req, res) => serve(scope.connection, channel, handler, req, res)
		}), `${channel}: rpc channel`);
	});
}
/**
* 处理一次 HTTP 请求：信任与鉴权、端点解析、信封校验、结果回写。
* @param connection - connection 服务，用其信任判定。
* @param channel - 本通道前缀。
* @param handler - 端点处理器。
* @param req - node 请求。
* @param res - node 响应。
*/
async function serve(connection, channel, handler, req, res) {
	const rejection = connection.requestRejection(req);
	if (rejection !== void 0) {
		res.writeHead(rejection);
		res.end(rejection === 401 ? "unauthorized" : "forbidden");
		return;
	}
	if (req.method !== "POST") return missing(res);
	const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
	const prefix = `${channel}/`;
	if (!pathname.startsWith(prefix)) return missing(res);
	const endpoint = pathname.slice(prefix.length);
	if (!endpoint.split("/").every((part) => part !== "" && part !== "." && part !== ".." && SEGMENT.test(part))) return missing(res);
	if (!isJsonContentType(req)) {
		res.writeHead(415);
		res.end("unsupported media type");
		return;
	}
	const declared = Number(req.headers["content-length"]);
	if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return tooLarge(req, res);
	let raw;
	try {
		raw = await readBody(req);
	} catch (error) {
		if (error instanceof PayloadTooLargeError) return tooLarge(req, res);
		res.writeHead(400);
		res.end("body read failed");
		return;
	}
	let message;
	try {
		message = JSON.parse(raw);
	} catch (error) {
		res.writeHead(400);
		res.end("body is not JSON");
		return;
	}
	const rpcId = typeof message.rpcId === "string" ? message.rpcId : "invalid-request";
	if (message.type !== "client-request" || typeof message.method !== "string") return reply(res, rpcId, {
		ok: false,
		error: {
			code: "gateway/bad-request",
			message: "invalid client-request message",
			details: {}
		}
	});
	if (message.method !== endpoint) return reply(res, rpcId, {
		ok: false,
		error: {
			code: "gateway/bad-request",
			message: `method ${JSON.stringify(message.method)} does not match endpoint ${JSON.stringify(endpoint)}`,
			details: {}
		}
	});
	const controller = new AbortController();
	const onClose = () => {
		controller.abort(/* @__PURE__ */ new Error("client disconnected"));
	};
	res.on("close", onClose);
	let result;
	try {
		result = await handler(endpoint, message.payload, controller.signal);
	} catch (error) {
		result = {
			ok: false,
			error: {
				code: "internal",
				message: error instanceof Error ? error.message : String(error),
				details: {}
			}
		};
	} finally {
		res.off("close", onClose);
	}
	reply(res, rpcId, result);
}
/** 路径不匹配或方法不符时统一 404，与官方未认领端点一致。 */
function missing(res) {
	res.writeHead(404);
	res.end("not found");
}
/** 回写一个 server-response 信封。 */
function reply(res, rpcId, result) {
	res.writeHead(200, { "content-type": "application/json" });
	res.end(JSON.stringify({
		type: "server-response",
		rpcId,
		result
	}));
}
/** 先回 413 再销毁连接：顺序反了 socket 已断，413 永远发不出去。 */
function tooLarge(req, res) {
	res.writeHead(413, { connection: "close" });
	res.end("payload too large");
	req.destroy();
}
/** content-type 必须声明为 application/json，charset 等参数可忽略。 */
function isJsonContentType(req) {
	const header = req.headers["content-type"];
	if (typeof header !== "string") return false;
	const mime = header.split(";", 1)[0];
	return mime !== void 0 && mime.trim().toLowerCase() === JSON_MIME;
}
/** 读取并限长请求体，超限抛 PayloadTooLargeError，由调用方回写 413。 */
async function readBody(req) {
	const chunks = [];
	let size = 0;
	for await (const chunk of req) {
		const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
		size += buffer.length;
		if (size > MAX_BODY_BYTES) throw new PayloadTooLargeError("rpc channel: request body exceeds limit");
		chunks.push(buffer);
	}
	return Buffer.concat(chunks).toString("utf8");
}
//#endregion
//#region src/index.ts
/**
* 侧栏编程 - Host 端
*
* 注册 RPC 端点，为 Client 端提供文件系统操作能力。
* 经 mountRpcChannel 直接向 webServer 自注册 /side-coder 前缀路由，复用 connection 的信任判定，
* 实现官方 client-request/server-response 信封。共享通道 /api 的唯一拦截器槽位已被官方 gateway 占用。
*
* 官方 @deepseek-ai 服务面在此以最小结构接口描述，插件运行时由 host 注入真实实现，
* 不引入任何官方类型包依赖，避免版本漂移。
*
* @module dsh-side-coder
*/
/** 插件名，即 cordis.yml 配置条目 id */
const name = "dsh-side-coder";
/** 依赖的服务：fs 即文件系统；sessions、sessionPersistence 在 apply 内显式等待 */
const inject = ["fs"];
/** 需要隐藏的目录 */
const HIDDEN_DIRS = /* @__PURE__ */ new Set([
	".git",
	"node_modules",
	".next",
	".cache",
	"__pycache__",
	".venv",
	"dist",
	"build",
	".dsh"
]);
/**
* 强制要求绝对路径：防止相对路径被 fs.resolve 按进程 cwd 误解析。
* 文件树根由当前会话的 cwd 决定，不依赖 dsh 进程启动目录。
* @param path - 待校验路径。
*/
function requireAbsolute(path) {
	if (typeof path !== "string" || path.length === 0) throw new Error("path 必须是非空字符串");
	if (!isAbsolute(path)) throw new Error(`path 必须是绝对路径：收到 ${path}`);
}
/** 把未知 payload 收窄成字符串字段表。 */
function asRecord(value) {
	return typeof value === "object" && value !== null ? value : {};
}
/** 从字符串字段表里取字符串字段，缺失或类型不符返回 undefined。 */
function readString(record, key) {
	const value = record[key];
	return typeof value === "string" ? value : void 0;
}
/** 画图组件静态树根：随小工具分发的 monaco，不走外网（公司网络下外网 CDN 时通时断）。 */
const MONACO_ASSETS_ROOT = fileURLToPath(new URL("../assets/monaco", import.meta.url));
/** 画图组件静态资源小门的 URL 前缀。 */
const MONACO_ROUTE_PREFIX = "/side-coder-monaco/";
/** 静态资源扩展名到内容类型的对照表。 */
const STATIC_MIME_BY_EXT = {
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".map": "application/json; charset=utf-8",
	".ttf": "font/ttf",
	".woff": "font/woff",
	".woff2": "font/woff2",
	".png": "image/png",
	".gif": "image/gif",
	".svg": "image/svg+xml",
	".wasm": "application/wasm"
};
/** 可预压缩的文本/字体扩展名：js/css/json/map/svg/wasm 预算 gzip+br；ttf/woff 也压。 */
const STATIC_COMPRESSIBLE_EXT = /* @__PURE__ */ new Set([
	".js",
	".css",
	".json",
	".map",
	".svg",
	".wasm",
	".ttf"
]);
/** 静态资源压缩缓存条目数软上限：静态文件总数约 200，超过 400 视为异常膨胀，整体重建。 */
const STATIC_CACHE_MAX_ENTRIES = 400;
/**
* 静态资源压缩缓存：key=绝对路径，value={mtimeMs, etag, lastModified, payloadByEnc}。
* payloadByEnc 以编码名为键（"br"/"gzip"/"" 表示未压缩原文），原文只存一份，不额外复制。
* 命中条件：条目存在且 mtimeMs 与当前 stat 一致（文件被替换即自动重算）。
*/
const staticAssetCache = /* @__PURE__ */ new Map();
/**
* 取（或构建）某静态文件的压缩缓存条目：stat 校 mtime，未变则复用，否则重读并预算压缩。
* @param filePath - 已完成路径穿越校验的绝对路径。
* @returns 缓存条目；文件不存在时抛错（由调用方回 404）。
*/
async function loadStaticAssetEntry(filePath) {
	const stats = await stat(filePath);
	const cached = staticAssetCache.get(filePath);
	if (cached && cached.mtimeMs === stats.mtimeMs) return cached;
	const raw = await readFile(filePath);
	// 强 ETag：原文 sha1 前 16 位十六进制，加引号构成合法的 opaque-tag。
	const etag = '"' + createHash("sha1").update(raw).digest("hex").slice(0, 16) + '"';
	const payloadByEnc = new Map();
	payloadByEnc.set("", raw);
	if (STATIC_COMPRESSIBLE_EXT.has(extname(filePath).toLowerCase())) {
		payloadByEnc.set("gzip", gzipSync(raw));
		// brotli 默认 quality=11 对 MB 级 JS 同步冻结事件循环 5~8s；quality=6 实测约 76ms、
		// 体积仅增约 15%，性价比最优。
		payloadByEnc.set("br", brotliCompressSync(raw, {
			params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 6 }
		}));
	}
	// 超过软上限先清空再放当前这一条（正常总量约 200，不会触发）。
	if (staticAssetCache.size > STATIC_CACHE_MAX_ENTRIES) staticAssetCache.clear();
	const entry = {
		mtimeMs: stats.mtimeMs,
		etag,
		lastModified: stats.mtime.toUTCString(),
		payloadByEnc
	};
	staticAssetCache.set(filePath, entry);
	return entry;
}
/**
* 解析 accept-encoding，按优先级 br > gzip > 无编码返回可用编码名（无编码为 ""）。
* @param req - node 请求。
* @param payloadByEnc - 该资源已预算的编码表。
*/
function pickStaticEncoding(req, payloadByEnc) {
	const accepted = String(req.headers["accept-encoding"] ?? "").split(",").map(function(part) {
		return part.trim().split(";")[0].trim().toLowerCase();
	});
	if (accepted.includes("br") && payloadByEnc.has("br")) return "br";
	if (accepted.includes("gzip") && payloadByEnc.has("gzip")) return "gzip";
	return "";
}
/**
* 协商缓存判定：if-none-match 命中（支持逗号分隔多个 ETag 的任一精确相等），
* 或 if-modified-since 时间不早于文件 mtime（秒级比较），即回 304。
* @param req - node 请求。
* @param entry - 压缩缓存条目。
*/
function staticNotModified(req, entry) {
	const noneMatch = req.headers["if-none-match"];
	if (typeof noneMatch === "string" && noneMatch.length > 0) {
		const matched = noneMatch.split(",").some(function(tag) {
			return tag.trim() === entry.etag;
		});
		if (matched) return true;
	}
	const modifiedSince = req.headers["if-modified-since"];
	if (typeof modifiedSince === "string" && modifiedSince.length > 0) {
		const sinceMs = Date.parse(modifiedSince);
		if (Number.isFinite(sinceMs) && Math.floor(sinceMs / 1e3) >= Math.floor(entry.mtimeMs / 1e3)) return true;
	}
	return false;
}
/**
* 两套静态资源小门（Monaco/Vditor）共用的响应逻辑：压缩预算 + 协商缓存。
* 路径穿越校验与 401/403/404 判定仍由各调用方先行完成，本函数只负责 200/304/404。
* @param filePath - 已校验的静态文件绝对路径。
* @param req - node 请求。
* @param res - node 响应。
* @param cacheControlHeader - 沿用小门原有语义的 cache-control 值。
*/
async function respondStaticAsset(filePath, req, res, cacheControlHeader) {
	let entry;
	try {
		entry = await loadStaticAssetEntry(filePath);
	} catch {
		res.writeHead(404);
		res.end("not found");
		return;
	}
	const baseHeaders = {
		"content-type": STATIC_MIME_BY_EXT[extname(filePath).toLowerCase()] ?? "application/octet-stream",
		vary: "accept-encoding",
		etag: entry.etag,
		"last-modified": entry.lastModified,
		"cache-control": cacheControlHeader
	};
	// 协商缓存命中：只发校验头、不发体（304 无体，按契约不带 content-type；
	// Vditor 的 no-cache 每次协商，命中即走 304 不再重下）。
	if (staticNotModified(req, entry)) {
		res.writeHead(304, {
			vary: baseHeaders.vary,
			etag: baseHeaders.etag,
			"last-modified": baseHeaders["last-modified"],
			"cache-control": cacheControlHeader
		});
		res.end();
		return;
	}
	const encoding = pickStaticEncoding(req, entry.payloadByEnc);
	const headers = Object.assign({}, baseHeaders);
	if (encoding) headers["content-encoding"] = encoding;
	res.writeHead(200, headers);
	res.end(entry.payloadByEnc.get(encoding));
}
/**
* 伺服画图组件静态资源：只认前缀下的普通文件名段并做根前缀复核，杜绝目录穿越。
* @param connection - connection 服务，用其信任判定。
* @param req - node 请求。
* @param res - node 响应。
*/
async function serveMonacoAsset(connection, req, res) {
	const rejection = connection.requestRejection(req);
	if (rejection !== void 0) {
		res.writeHead(rejection);
		res.end(rejection === 401 ? "unauthorized" : "forbidden");
		return;
	}
	const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
	if (req.method !== "GET" || !pathname.startsWith(MONACO_ROUTE_PREFIX)) {
		res.writeHead(404);
		res.end("not found");
		return;
	}
	const segments = pathname.slice(MONACO_ROUTE_PREFIX.length).split("/");
	if (!segments.every((part) => part !== "" && part !== "." && part !== "..")) {
		res.writeHead(404);
		res.end("not found");
		return;
	}
	const filePath = join(MONACO_ASSETS_ROOT, ...segments);
	if (!filePath.startsWith(MONACO_ASSETS_ROOT)) {
		res.writeHead(404);
		res.end("not found");
		return;
	}
	try {
		await respondStaticAsset(filePath, req, res, "max-age=86400");
	} catch {
		res.writeHead(404);
		res.end("not found");
	}
}
/**
* 挂载画图组件静态资源小门：伺服随小工具分发的 monaco 静态树。
* @param ctx - 插件上下文。
*/
function mountMonacoAssets(ctx) {
	ctx.inject(["connection", "webServer"], (raw) => {
		const scope = raw;
		scope.effect(() => scope.webServer.register({
			kind: "prefix",
			path: "/side-coder-monaco",
			handler: (req, res) => serveMonacoAsset(scope.connection, req, res)
		}), "/side-coder-monaco: monaco assets");
	});
}
/** Vditor 只读预览静态树根：随插件分发的 vditor 预览最小子集，不走外网。 */
const VDITOR_ASSETS_ROOT = fileURLToPath(new URL("../assets/vditor", import.meta.url));
/** Vditor 静态资源预览小门的 URL 前缀。 */
const VDITOR_ROUTE_PREFIX = "/side-coder-vditor/";
/**
* 伺服用 Vditor 只读预览静态资源：路径段校验杜绝目录穿越，缓存 no-cache（避免升级后旧引擎常驻）。
* @param connection - connection 服务，用其信任判定。
* @param req - node 请求。
* @param res - node 响应。
*/
async function serveVditorAsset(connection, req, res) {
	const rejection = connection.requestRejection(req);
	if (rejection !== void 0) {
		res.writeHead(rejection);
		res.end(rejection === 401 ? "unauthorized" : "forbidden");
		return;
	}
	const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
	if (req.method !== "GET" || !pathname.startsWith(VDITOR_ROUTE_PREFIX)) {
		res.writeHead(404);
		res.end("not found");
		return;
	}
	const segments = pathname.slice(VDITOR_ROUTE_PREFIX.length).split("/");
	if (!segments.every((part) => part !== "" && part !== "." && part !== "..")) {
		res.writeHead(404);
		res.end("not found");
		return;
	}
	const filePath = join(VDITOR_ASSETS_ROOT, ...segments);
	if (!filePath.startsWith(VDITOR_ASSETS_ROOT)) {
		res.writeHead(404);
		res.end("not found");
		return;
	}
	try {
		await respondStaticAsset(filePath, req, res, "no-cache");
	} catch {
		// 压缩同步预算阶段若意外抛错（理论上不会，loadStaticAssetEntry 已内收 stat/readFile 错误），
		// 沿用原语义回 404。
		res.writeHead(404);
		res.end("not found");
	}
}
/**
* 挂载 Vditor 只读预览静态资源小门：伺服随插件分发的 vditor 预览子集。
* @param ctx - 插件上下文。
*/
function mountVditorAssets(ctx) {
	ctx.inject(["connection", "webServer"], (raw) => {
		const scope = raw;
		scope.effect(() => scope.webServer.register({
			kind: "prefix",
			path: "/side-coder-vditor",
			handler: (req, res) => serveVditorAsset(scope.connection, req, res)
		}), "/side-coder-vditor: vditor assets");
	});
}
/**
* Host 端 apply：注册文件系统 RPC 端点。
*
* 用 ctx.inject(['sessions', 'sessionPersistence'], ...) 延迟获取服务，
* 再经 mountRpcChannel 自注册独立的 /side-coder 通道。
* dsh 0.1.5 的 connection.rpc.handle 在登记路由时解析 webServer 会抛 without inject，因此自行注册 prefix 路由。
* @param ctx - 插件上下文。
*/
function apply(ctx) {
	const recorder = createChangeRecorder();
	const sessionWatcher = createSessionWatcher(recorder);
	ctx.on("session/event", sessionWatcher);
	mountMonacoAssets(ctx);
	mountVditorAssets(ctx);
	ctx.inject(["sessions", "sessionPersistence"], function(scope) {
		// H1：接通内核存活性查询——同 cwd 下当前活会话（即使尚无改动记录）不借用后台会话改动；
		// sessions.get 为同步查询，!! 归一为布尔，返回非 true 时 resolveSessionSid 维持回退兼容。
		recorder.setLiveness(function(id) {
			return !!scope.sessions.get(id);
		});
		mountRpcChannel(scope, "/side-coder", async function(endpoint, payload, signal) {
			const method = endpoint;
			try {
				switch (method) {
					case "describe": return {
						ok: true,
						value: await handleDescribe(scope.sessions, scope.sessionPersistence, payload, signal)
					};
					case "listDir": return {
						ok: true,
						value: await handleListDir(ctx, payload, signal)
					};
					case "searchFiles": return {
						ok: true,
						value: await handleSearchFiles(ctx, payload, signal)
					};
					case "readFile": return {
						ok: true,
						value: await handleReadFile(ctx, payload)
					};
					case "writeFile": return {
						ok: true,
						value: await handleWriteFile(payload)
					};
					case "copyEntry": return {
						ok: true,
						value: await handleCopyEntry(payload)
					};
					case "moveEntry": return {
						ok: true,
						value: await handleMoveEntry(payload)
					};
					case "deleteEntry": return {
						ok: true,
						value: await handleDeleteEntry(payload)
					};
					case "revealEntry": return {
						ok: true,
						value: await handleRevealEntry(payload)
					};
					case "listChanges": return {
						ok: true,
						value: { changes: recorder.list() }
					};
					case "listFileChanges": {
						// 可选 sessionId：非空则只聚合该会话，按文件折叠成整体对比；
						// latestId 是该会话存活记录最大 id，供前端判断"是否有新改动"。
						// 列表只回元数据白名单（toFileMeta 剥离 original/currentAfter 全文），全文走 fileChangeContent。
						const listSessionId = readString(asRecord(payload), "sessionId") || "";
					const listCwd = readString(asRecord(payload), "currentCwd") || "";
					const matchedSessionId = recorder.resolveSessionSid(listSessionId, listCwd);
						const files = recorder.aggregateByFile(listSessionId, listCwd);
						await annotateChangeKinds([{ files: files }]);
						return {
							ok: true,
							value: {
								files: files.map(toFileMeta),
								latestId: recorder.latestIdOf(matchedSessionId) || 0,
								matchedSessionId
							}
						};
					}
					case "listFileChangesGrouped": {
						// 按会话窗口分组：currentSessionId 非空则只返回当前会话一个组，
						// 否则返回全部会话组；组内文件按最后修改时间降序。
						const groupedSessionId = readString(asRecord(payload), "currentSessionId") || "";
					const groupedCwd = readString(asRecord(payload), "currentCwd") || "";
					const groups = recorder.aggregateBySession(groupedSessionId, groupedCwd);
						await annotateChangeKinds(groups);
						return {
							ok: true,
							value: {
								// 组元数据剥离全文，每组带组内 latestId（"unknown" 组为 null）。
								groups: groups.map(function(group) {
									const groupLatestId = group.sessionId === "unknown" ? null : recorder.latestIdOf(group.sessionId);
									return toGroupMeta(group, groupLatestId ?? null);
								})
							}
						};
					}
					case "changeDetail": return {
						ok: true,
						// 编号是数字（或数字文本），不能走只认字符串的 readString，原值交给 detail 内 Number() 归一
						value: recorder.detail(asRecord(payload).id)
					};
					case "fileChangeContent": {
						// 按需取某会话某文件的聚合全文（original/currentAfter），path 只做内存 Map 字符串匹配，不触盘。
						return {
							ok: true,
							value: await recorder.fileChangeContent(readString(asRecord(payload), "sessionId") || "", readString(asRecord(payload), "path") || "", readString(asRecord(payload), "currentCwd") || "")
						};
					}
					case "advanceBaseline": return {
						ok: true,
						value: recorder.advanceBaseline(readString(asRecord(payload), "sessionId"), readString(asRecord(payload), "path"))
					};
					case "retreatBaseline": return {
						ok: true,
						value: recorder.retreatBaseline(readString(asRecord(payload), "sessionId"), readString(asRecord(payload), "path"))
					};
					case "advanceLatestBaseline": return {
						ok: true,
						value: recorder.advanceLatestBaseline(readString(asRecord(payload), "sessionId"), readString(asRecord(payload), "path"))
					};
					case "retreatStartBaseline": return {
						ok: true,
						value: recorder.retreatStartBaseline(readString(asRecord(payload), "sessionId"), readString(asRecord(payload), "path"))
					};
					default: return {
						ok: false,
						error: {
							code: "bad-request",
							message: `未知端点: ${method}`,
							details: { issues: [] }
						}
					};
				}
			} catch (e) {
				return {
					ok: false,
					error: {
						code: "internal",
						message: e instanceof Error ? e.message : String(e),
						details: {}
					}
				};
			}
		});
	});
}
/**
* 处理 describe：返回当前会话工作区的绝对路径作为文件树根。
* 会话 id 由客户端从注入的 sessions 服务读取 sessions.list.current，与侧栏选择同步。
*
* 会话已挂载为 live 即内存 SessionStore 命中时直接取顶层 cwd；
* 否则，如浏览器刷新、会话尚未被 host resume 进 live 表时回退到
* sessionPersistence.stat 从磁盘冷读快照顶层 cwd。两者都拿不到才抛错，
* 绝不静默回退到进程目录。header 嵌套仅作向后兼容兜底。
* @param sessions - 会话服务。
* @param sessionPersistence - 会话持久化服务。
* @param payload - RPC 载荷，需带 sessionId。
* @param signal - 取消信号。
*/
async function handleDescribe(sessions, sessionPersistence, payload, signal) {
	const sessionId = readString(asRecord(payload), "sessionId");
	if (!sessionId) throw new Error("describe 缺少 sessionId");
	const live = sessions.get(sessionId);
	const liveCwd = live?.cwd ?? live?.header?.cwd;
	if (liveCwd) return { root: liveCwd };
	const cold = await sessionPersistence.stat(sessionId, { signal });
	const coldCwd = cold?.cwd ?? cold?.header?.cwd;
	if (coldCwd) return { root: coldCwd };
	if (live) throw new Error(`会话 ${sessionId} 工作目录缺失：cwd 为空`);
	throw new Error(`会话不存在: ${sessionId}`);
}
/**
* 处理 listDir：列出目录内容。
* @param ctx - 插件上下文。
* @param payload - RPC 载荷，需带绝对 path。
* @param signal - 取消信号。
*/
async function handleListDir(ctx, payload, signal) {
	const path = readString(asRecord(payload), "path");
	requireAbsolute(path);
	const target = await ctx.fs.resolve(path, { signal });
	const dirPath = ctx.fs.processPath(target);
	const dirents = (await readdir(dirPath, { withFileTypes: true })).filter(function(item) {
		return !HIDDEN_DIRS.has(item.name);
	});
	// size 与 mtimeMs 是前端"按大小/按最后修改时间"排序的排序键，
	// 目录不参与大小排序（统一 0），但保留真实 mtime 以便按时间排目录。
	const entries = await Promise.all(dirents.map(async function(item) {
		const isDirectory = item.isDirectory();
		let size = 0;
		let mtimeMs = 0;
		try {
			const info = await stat(join(dirPath, item.name));
			mtimeMs = info.mtimeMs;
			if (!isDirectory) size = info.size;
		} catch (error) {
			// 悬空符号链接或权限不足：排序键退化为 0，条目本身照常可见。
		}
		return {
			name: item.name,
			type: isDirectory ? "directory" : "file",
			size,
			mtimeMs
		};
	}));
	// 默认序（目录在前 + 名称升序）只作为兜底：前端会按用户选择的排序方式重排。
	return { entries: entries.sort(function(a, b) {
		if (a.type === b.type) return a.name.localeCompare(b.name);
		return a.type === "directory" ? -1 : 1;
	}) };
}
/** 模糊搜索：递归遍历的最大目录数上限（含根），防止在超大工程上长时间占满 IO。 */
const MAX_SEARCH_DIRS = 400;
/** 模糊搜索：返回结果条数上限，超出后截断并标记 truncated。 */
const MAX_SEARCH_RESULTS = 300;
/**
* 模糊匹配打分：query 的字符须按顺序出现在 name 中（subsequence 匹配），
* 越连续、越靠前、越短的名字得分越高；不匹配返回 null。
* 全等 1000 分，前缀命中额外加分，保证精确输入总是排在最前。
* @param query - 已小写化的查询串。
* @param name - 原始文件名（内部小写化）。
* @returns {number|null} 得分（越大越靠前），不匹配为 null。
*/
function fuzzyScore(query, name) {
	const haystack = name.toLowerCase();
	if (query.length === 0) return 0;
	if (haystack === query) return 1000;
	let score = 0;
	let hayIndex = 0;
	let previousMatch = -2;
	for (let queryIndex = 0; queryIndex < query.length; queryIndex += 1) {
		const found = haystack.indexOf(query[queryIndex], hayIndex);
		if (found < 0) return null;
		score += found === previousMatch + 1 ? 12 : 4;
		score -= Math.min(found, 20);
		previousMatch = found;
		hayIndex = found + 1;
	}
	if (haystack.startsWith(query)) score += 120;
	// 名字越短，命中密度越高，排序时更贴近用户意图。
	score -= Math.floor(haystack.length / 4);
	return score;
}
/**
* 处理 searchFiles：在当前工作目录整棵子树内按文件名模糊匹配。
*
* 广度优先遍历，跳过 HIDDEN_DIRS 里的目录；目录数超过 MAX_SEARCH_DIRS
* 或结果数超过 MAX_SEARCH_RESULTS 时截断，并在返回里标记 truncated，
* 由前端提示用户收窄关键词。只匹配文件名（不含目录名），不读文件内容。
* @param ctx - 插件上下文。
* @param payload - RPC 载荷，需带绝对 root 与 query。
* @param signal - 取消信号。
*/
async function handleSearchFiles(ctx, payload, signal) {
	const record = asRecord(payload);
	const root = readString(record, "root");
	const query = readString(record, "query");
	requireAbsolute(root);
	const needle = String(query || "").trim().toLowerCase();
	if (needle.length === 0) return { results: [], truncated: false, scannedDirs: 0 };
	const rootTarget = await ctx.fs.resolve(root, { signal });
	const rootPath = ctx.fs.processPath(rootTarget);
	const results = [];
	const queue = [rootPath];
	let scannedDirs = 0;
	let truncated = false;
	while (queue.length > 0) {
		if (scannedDirs >= MAX_SEARCH_DIRS) {
			truncated = true;
			break;
		}
		const currentDir = queue.shift();
		scannedDirs += 1;
		let dirents = [];
		try {
			dirents = await readdir(currentDir, { withFileTypes: true });
		} catch (error) {
			// 权限不足或目录已被删除：跳过该目录，不影响其余结果。
			continue;
		}
		for (const item of dirents) {
			if (HIDDEN_DIRS.has(item.name)) continue;
			const absolutePath = join(currentDir, item.name);
			if (item.isDirectory()) {
				queue.push(absolutePath);
				continue;
			}
			const score = fuzzyScore(needle, item.name);
			if (score === null) continue;
			results.push({
				name: item.name,
				path: absolutePath,
				// 树内相对路径，前端直接用它在编辑器里打开该文件。
				relativePath: relative(rootPath, absolutePath).replace(/\\/g, "/"),
				score
			});
			if (results.length >= MAX_SEARCH_RESULTS) {
				truncated = true;
				break;
			}
		}
		if (truncated) break;
	}
	results.sort(function(a, b) {
		return b.score - a.score || a.relativePath.localeCompare(b.relativePath);
	});
	return { results, truncated, scannedDirs };
}
/**
* 处理 readFile：读取文件内容。
* @param ctx - 插件上下文。
* @param payload - RPC 载荷，需带绝对 path。
*/
async function handleReadFile(ctx, payload) {
	const path = readString(asRecord(payload), "path");
	requireAbsolute(path);
	const target = await ctx.fs.resolve(path);
	return { content: await ctx.fs.readText(target) };
}
/**
* 处理 writeFile：写入文件内容。
*
* 刻意不走 ctx.fs：那是被 DSH 文件沙箱包过、按 agent 权限裁决的实现，
* 这里改用 Node 原生 fs.writeFile 直接写盘。
* 本插件本质是本地编辑器，Ctrl+S 保存与 agent 无关，不应被 agent 沙箱/权限链拦截，
* 否则会报 file access denied under workspace-write mode。
* 保存操作因此与 agent 的访问模式、会话 override 都无关，就是普通本地磁盘写入。
* @param payload - RPC 载荷，需带绝对 path 与 content。
*/
async function handleWriteFile(payload) {
	const record = asRecord(payload);
	const path = readString(record, "path");
	const content = readString(record, "content");
	requireAbsolute(path);
	if (typeof content !== "string") throw new Error("writeFile 缺少 content");
	await writeFile(path, content, "utf8");
	return { ok: true };
}
/**
* 复制文件或文件夹（含整棵子树）。
* @param payload - { from: 源绝对路径, to: 目标绝对路径 }。
*/
async function handleCopyEntry(payload) {
	const record = asRecord(payload);
	const from = readString(record, "from");
	const to = readString(record, "to");
	requireAbsolute(from);
	requireAbsolute(to);
	await cp(from, to, { recursive: true, force: true, errorOnExist: false });
	return { ok: true };
}
/**
* 移动/重命名文件或文件夹；跨盘移动自动退回复制后再删除源。
* @param payload - { from: 源绝对路径, to: 目标绝对路径 }。
*/
async function handleMoveEntry(payload) {
	const record = asRecord(payload);
	const from = readString(record, "from");
	const to = readString(record, "to");
	requireAbsolute(from);
	requireAbsolute(to);
	try {
		await rename(from, to);
	} catch (error) {
		if (!error || error.code !== "EXDEV") throw error;
		await cp(from, to, { recursive: true, force: true, errorOnExist: false });
		await rm(from, { recursive: true, force: true });
	}
	return { ok: true };
}
/**
* 删除文件或文件夹（含整棵子树，不可恢复；界面负责确认）。
* @param payload - { path: 绝对路径 }。
*/
async function handleDeleteEntry(payload) {
	const path = readString(asRecord(payload), "path");
	requireAbsolute(path);
	await rm(path, { recursive: true, force: true });
	return { ok: true };
}
/**
* 在 Windows 文件资源管理器中打开该文件/文件夹所在目录。
* 不采用 explorer /select,（高亮定位）：本机实测在已有 explorer shell 运行时，
* 单次 /select, 会弹两个相同路径的窗口，且行为不稳定（有时开新窗、有时复用）；
* 而裸目录调用 explorer <目录> 在本机稳定只开单窗口。
* 因此「在资源管理器中显示」退化为「打开父目录」——宁可不高亮，也要保证只有一个窗口。
* @param payload - { path: 绝对路径 }。
*/
async function handleRevealEntry(payload) {
	const path = readString(asRecord(payload), "path");
	requireAbsolute(path);
	// 目录路径直接用；文件路径打开其父目录（dirname）。
	const showPath = await stat(path).then((s) => (s.isDirectory() ? path : dirname(path)));
	await new Promise(function(resolve, reject) {
		const child = spawn("explorer.exe", [showPath]);
		child.once("error", reject);
		setTimeout(resolve, 300);
	});
	return { ok: true };
}
//#endregion
//#region src/change-recorder.ts
/** 关注的工具"种类"：写入类会留下可对比的文件改动，补丁类留编辑片段。 */
const WATCH_KINDS = /* @__PURE__ */ new Set(["write", "edit", "patch"]);
/** 具名白名单：这些名字必定是写文件类动作。 */
const WATCHED_TOOLS = /* @__PURE__ */ new Set([
	"edit",
	"write",
	"multiedit",
	"multi_edit",
	"str_replace_editor",
	"apply_patch",
	"notebook_edit",
	"write_file",
	"edit_file",
	"create_file"
]);
/** 名字启发式兜底：名字里带这些词根的也算写文件类动作（排除只读工具）。 */
const WATCH_NAME_HINT = /writ|edit|patch|replac|modif/i;
/** 改动记录环形上限：只保留最近 N 条，防长会话无限增长。 */
const MAX_CHANGES = 200;
/** 调试小账本路径：插件根目录下，旁观会话事件的接头情况，定位不记录问题用；写失败静默。 */
// 默认调试日志在插件根目录；SIDE_CODER_DEBUG_LOG 可覆盖（供离线隔离测试，避免与运行中的服务争用同一文件）。
const DEBUG_LOG_PATH = process.env.SIDE_CODER_DEBUG_LOG || join(dirname(fileURLToPath(import.meta.url)), "..", "debug-events.jsonl");
/** 调试小账本行数上限：达到即截断重写，防无限增长。 */
const DEBUG_MAX_LINES = 400;
/**
* 追加一行调试记录到调试小账本；写失败静默（绝不影响主功能）。
* @param entry - 要记录的事实（须可序列化为 JSON）。
*/
async function appendDebug(entry) {
	try {
		const line = JSON.stringify(Object.assign({ at: Date.now() }, entry)) + "\n";
		let prev = "";
		try {
			prev = await readFile(DEBUG_LOG_PATH, "utf8");
		} catch {}
		let next = prev + line;
		const lines = next.split("\n").filter(Boolean);
		if (lines.length > DEBUG_MAX_LINES) next = lines.slice(-DEBUG_MAX_LINES).join("\n") + "\n";
		await writeFile(DEBUG_LOG_PATH, next, "utf8");
	} catch {}
}
/**
* 创建文件改动记录器：观察会话工具事件，录制文件改动前后全文。
* tool/call 时读盘留存"改动前"，tool/result 时读盘留存"改动后"，配对有多手牌：
* 事件自带配对号、结果消息里的配对号、以及"谁先叫谁先配"的兜底。
* 相对路径按事件所属会话的顶层 cwd 解析为绝对路径（header 嵌套仅向后兼容）。
*/
function createChangeRecorder() {
	const pendingById = /* @__PURE__ */ new Map();
	const pendingQueue = [];
	const changes = [];
	let nextId = 1;
	// 会话存活门控函数：由 Host apply 经 setLiveness 注入（内核 sessions.get 同步存活性查询）。
	// 缺失时 recorder 可独立运行/测试，resolveSessionSid 维持原有全部回退逻辑。
	let livenessFn = null;
	// 每个文件的版本链与基线游标：key = `${sessionId}\x00${normPath(绝对路径)}`。
	// chain[0] 是会话最初的样子（首条 write 的 before），之后每次 write 的 after 依次入链，
	// 链尾即最新版。baselinePos 指向"我已确认到哪个版本"：默认 0（从头看），
	// 前进=把 pos 推到链尾（diff 清空，后续改动以它为基准），后退=pos-1。
	// 独立于环形 changes 数组持久保存，避免 MAX_CHANGES 环形 shift 丢失版本信息。
	const fileVersions = /* @__PURE__ */ new Map();
	// 会话编号 → 会话工作目录：从每个事件的顶层 session.cwd 登记（header 嵌套仅向后兼容）。
	// 用途：进程重启/会话恢复后，UI 主视图行 id（新建会话）与实际产生工具事件的
	// agent 会话 id（旧会话）可能不同；精确 id 查不到改动时，按同 cwd 回退到最近活跃会话。
	const sessionCwdById = /* @__PURE__ */ new Map();
	/** 归一化绝对路径用于版本链键值：统一斜杠与大小写（Windows 盘符大小写不敏感）。 */
	function normPath(p) {
		return String(p || "").replace(/\//g, "\\").toLowerCase();
	}
	/** 取某个文件版本链的键：sessionId + 归一化绝对路径。 */
	function versionKeyOf(sessionId, absPath) {
		return String(sessionId || "unknown") + "\x00" + normPath(absPath);
	}
	/**
	* 判定工具动作的种类：写入类 write / 补丁类 edit / 不关心返回 null。
	* 先看 kind 字段，再看具名白名单，最后按名字词根启发式。
	* @param data - tool/call 事件的判别载荷。
	*/
	function kindOf(data) {
		const rawKind = String(data.kind ?? "").toLowerCase();
		if (WATCH_KINDS.has(rawKind)) return rawKind;
		const name = String(data.name ?? data.toolName ?? data.tool ?? "").toLowerCase();
		if (WATCHED_TOOLS.has(name)) return /edit|patch|replac/.test(name) ? "edit" : "write";
		if (WATCH_NAME_HINT.test(name)) return /edit|patch|replac/.test(name) ? "edit" : "write";
		return null;
	}
	/**
	* 从工具入参 JSON 里提取文件路径字段。
	* @param rawArguments - tool/call 事件的 arguments（字符串或对象）。
	*/
	function extractPath(rawArguments) {
		try {
			const args = typeof rawArguments === "string" ? JSON.parse(rawArguments) : rawArguments;
			if (args && typeof args === "object") {
				for (const key of ["file_path", "path", "target_file", "notebook_path", "filePath", "file", "filename"]) {
					const value = args[key];
					if (typeof value === "string" && value.length > 0) return value;
				}
			}
		} catch {}
		return null;
	}
	/**
	* 从工具入参 JSON 里提取补丁片段（apply_patch 类工具）。
	* @param rawArguments - tool/call 事件的 arguments（字符串或对象）。
	*/
	function extractPatchText(rawArguments) {
		try {
			const args = typeof rawArguments === "string" ? JSON.parse(rawArguments) : rawArguments;
			if (args && typeof args === "object") {
				for (const key of ["patch", "diff", "new_string", "content", "newContent"]) {
					const value = args[key];
					if (typeof value === "string" && value.length > 0) return value;
				}
			}
		} catch {}
		return null;
	}
	/**
	* 从 tool/result 的结果消息里挖配对号；挖不到返回 null。
	* 文档只说配对号在结果消息里，没写字段名，多试几个常见拼法。
	* @param message - 结果消息（形状随工具而异）。
	*/
	function extractResultCallId(message) {
		if (!message || typeof message !== "object") return null;
		for (const key of ["callId", "toolCallId", "tool_call_id", "call_id", "toolUseId", "tool_use_id", "id"]) {
			const value = message[key];
			if (typeof value === "string" && value.length > 0) return value;
		}
		return null;
	}
	/**
	* 按会话工作目录解析出绝对路径；解析不出返回 null。
	* @param rawPath - 事件里的文件路径。
	* @param session - 事件所属会话（取顶层 cwd，header 嵌套仅向后兼容）。
	*/
	function resolvePath(rawPath, session) {
		if (typeof rawPath !== "string" || rawPath.length === 0) return null;
		if (isAbsolute(rawPath)) return rawPath;
		const cwd = session?.cwd ?? session?.header?.cwd;
		if (typeof cwd === "string" && cwd.length > 0) return join(cwd, rawPath);
		return null;
	}
	/**
	* 取事件所属会话的编号；取不到返回 null（结构差异兜底）。
	* @param session - 事件所属会话对象。
	*/
	function sessionIdOf(session) {
		if (!session) return null;
		if (typeof session === "string") return session;
		if (typeof session.id === "string") return session.id;
		const headerId = session?.header?.id;
		if (typeof headerId === "string") return headerId;
		return null;
	}
	/**
	* 读文件文本；失败返回 null（文件可能已删或不可读）。
	* @param path - 绝对路径。
	*/
	async function readTextOrNull(path) {
		try {
			return await readFile(path, "utf8");
		} catch {
			return null;
		}
	}
	/**
	* 入账一条改动记录；前后文本都拿不到的空记录丢弃。
	* @param entry - 记录内容（含 before/after 全文）。
	*/
	async function commitChange(entry) {
		if (entry.kind === "edit" && entry.before === "" && entry.after === "") {
			await appendDebug({ ev: "change/skip-empty", path: entry.path, tool: entry.tool });
			return;
		}
		entry.id = nextId++;
		changes.push(entry);
		if (changes.length > MAX_CHANGES) changes.shift();
		// 维护该文件的版本链：仅 kind=write 有完整前后文，patch 只留片段不入链。
		// chain 首元素推首条 write 的 before 作会话最初原型，此后每次 write 的 after 追加为下一个版本。
		if (entry.kind === "write" && entry.path) {
			const vkey = versionKeyOf(entry.sessionId, entry.path);
			let versions = fileVersions.get(vkey);
			if (!versions) {
				versions = { chain: [], pos: 0 };
				fileVersions.set(vkey, versions);
			}
			// 首次入链：把 before 作为 v0（可能是空串=新增文件，与聚合 hasOriginal 判定一致）。
			if (versions.chain.length === 0) versions.chain.push(entry.before == null ? "" : entry.before);
			versions.chain.push(entry.after == null ? "" : entry.after);
		}
		await appendDebug({
			ev: "change/committed",
			id: entry.id,
			kind: entry.kind,
			tool: entry.tool,
			path: entry.path,
			beforeLen: entry.before.length,
			afterLen: entry.after.length
		});
	}
	/**
	* 处理一条会话事件：tool/call 留改动前，tool/result 留改动后并入账。
	* @param session - 事件所属会话。
	* @param event - 会话事件（含 type 与 data 判别载荷）。
	*/
	async function onEvent(session, event) {
		if (!event || typeof event.type !== "string") {
			await appendDebug({ ev: "skip", why: "bad event", keys: event ? Object.keys(event).slice(0, 8) : null });
			return;
		}
		const data = event.data;
		if (!data) return;
		// 登记会话编号 → cwd（每个事件都登记，保证回退映射在 write 事件之前/之后均可用）。
		const eventSid = sessionIdOf(session);
		const eventCwd = session?.cwd ?? session?.header?.cwd ?? null;
		if (eventSid && typeof eventCwd === "string" && eventCwd.length > 0) {
			sessionCwdById.set(eventSid, normPath(eventCwd));
		}
		if (event.type === "tool/call") {
			const kind = kindOf(data);
			await appendDebug({ ev: "tool/call", name: data.name, kind: data.kind, callId: data.callId, matched: kind });
			if (!kind) return;
			const callId = typeof data.callId === "string" ? data.callId : null;
			const rawPath = extractPath(data.arguments);
			const path = resolvePath(rawPath, session);
			const pending = {
				callId,
				path,
				rawPath,
				kind,
				tool: String(data.name ?? data.toolName ?? data.tool ?? kind),
				sessionId: sessionIdOf(session),
				time: event.time || Date.now(),
				before: "",
				patchText: extractPatchText(data.arguments)
			};
			pending.before = path ? (await readTextOrNull(path)) ?? "" : "";
			if (callId) pendingById.set(callId, pending);
			pendingQueue.push(pending);
			return;
		}
		if (event.type === "tool/result") {
			const candidates = [event.callId, data.callId, extractResultCallId(data.message)];
			let pending = null;
			for (const candidate of candidates) {
				if (typeof candidate === "string" && pendingById.has(candidate)) {
					pending = pendingById.get(candidate);
					pendingById.delete(candidate);
					break;
				}
			}
			if (!pending && pendingQueue.length > 0) {
				pending = pendingQueue.shift();
				if (pending.callId) pendingById.delete(pending.callId);
				await appendDebug({ ev: "pair/fifo-fallback", tool: pending.tool, path: pending.path });
			}
			if (!pending) return;
			const queueIndex = pendingQueue.indexOf(pending);
			if (queueIndex >= 0) pendingQueue.splice(queueIndex, 1);
			if (!pending.path) {
				await appendDebug({ ev: "tool/result", matched: false, why: "no path" });
				return;
			}
			const afterText = (await readTextOrNull(pending.path)) ?? pending.before;
			if (pending.kind === "edit" && afterText === pending.before && pending.patchText) {
				await commitChange({
					sessionId: pending.sessionId,
					path: pending.path,
					tool: pending.tool,
					kind: "patch",
					time: pending.time,
					before: "",
					after: pending.patchText
				});
				return;
			}
			await commitChange({
				sessionId: pending.sessionId,
				path: pending.path,
				tool: pending.tool,
				kind: "write",
				time: pending.time,
				before: pending.before,
				after: afterText
			});
		}
	}
	/**
	* 把前端会话 id 解析为实际持有改动记录的会话编号。
	* 进程重启/会话恢复后 UI 主视图行 id（新建会话）与实际产生工具事件的 agent 会话 id
	* （旧会话）可能不同：传入 id 本身在 changes 中有记录时原样返回；否则按 cwd 在
	* sessionCwdById 中找同工作目录候选，只取 changes 中最近活跃（lastTime 最大）的唯一
	* 会话，避免同 cwd 的 subagent 会话混入；无候选时返回原 id。
	* @param sessionId - 前端当前会话编号（可空）。
	* @param cwd - 前端当前会话工作目录（可空）。
	* @returns 解析后的有效会话编号；两者皆空时返回 null。
	*/
	function resolveSessionSid(sessionId, cwd) {
		const sid = sessionId ? String(sessionId) : "";
		// H2："显示全部"语义不回退——空 sid 直接返回 null，跳过 cwd 匹配，聚合全部会话。
		if (!sid) return null;
		// H1：sid 经内核存活门控确认为活会话时立即采用，禁止借用同 cwd 后台会话的改动；
		// livenessFn 缺失（独立测试）或返回非 true（刷新后未 resume）时维持原有回退逻辑。
		if (typeof livenessFn === "function" && livenessFn(sid) === true) return sid;
		for (const item of changes) {
			if (item.sessionId === sid) return sid;
		}
		const cwdKey = normPath(cwd);
		if (!cwdKey) return sid;
		const cwdSids = /* @__PURE__ */ new Set();
		for (const [candidateSid, candidateCwd] of sessionCwdById) {
			if (candidateCwd === cwdKey) cwdSids.add(candidateSid);
		}
		let best = null;
		let bestTime = -1;
		for (const item of changes) {
			const t = item.time || 0;
			if (item.sessionId && cwdSids.has(item.sessionId) && t > bestTime) {
				best = item.sessionId;
				bestTime = t;
			}
		}
		return best || sid;
	}
	return {
		onEvent,
		resolveSessionSid,
		/** H1：注入会话存活门控函数（内核 sessions.get 同步查询）；传 null 可清除，恢复独立回退行为。 */
		setLiveness(fn) {
			livenessFn = typeof fn === "function" ? fn : null;
		},
		/** 改动元数据列表，新改动在前（不含前后全文，供列表轮询用）。 */
		list() {
			return changes.slice().reverse().map(function(item) {
				return {
					id: item.id,
					sessionId: item.sessionId,
					path: item.path,
					tool: item.tool,
					kind: item.kind,
					time: item.time
				};
			});
		},
		/**
		* 按文件聚合会话改动：同一文件多次改动折叠成一行整体对比。
		* 只保留"最初改动前全文"与"最后一次改后全文"，中间过程先后顺序不展示；
		* 同一段落多次插入也只看最初与最终的整体差异。
		* @param sessionId - 可选会话编号，非空则只聚合该会话的记录。
		* @returns 聚合数组，按最后改动时间倒序，每项 {path,count,original,currentAfter,lastTime,tool}。
		*          original 为空表示该文件只有补丁片段（kind=patch，未拿到全文）。
		*/
		aggregateByFile(sessionId, cwd) {
		const effectiveSid = resolveSessionSid(sessionId, cwd);
			/** 路径归一：统一斜杠与大小写（Windows 盘符路径大小写不敏感）。 */
			function normPath(p) {
				return String(p || "").replace(/\//g, "\\").toLowerCase();
			}
			const groups = new Map();
			for (const item of changes) {
				if (effectiveSid && item.sessionId && item.sessionId !== effectiveSid) continue;
				const key = normPath(item.path);
				let group = groups.get(key);
				if (!group) {
					group = {
						path: item.path,
						count: 0,
						original: null,
						currentAfter: null,
						hasPatch: false,
						lastTime: item.time || 0,
						tool: item.tool || ""
					};
					groups.set(key, group);
				}
				group.count += 1;
				// 保存在存活记录里的第一条 kind=write 的 before 即"会话最初的样子"；
				// 最后一条 kind=write 的 after 即"会话最终的样子"。
				if (item.kind === "write") {
					if (group.original === null) group.original = item.before;
					group.currentAfter = item.after;
					group.lastTime = item.time || group.lastTime;
					group.tool = item.tool || group.tool;
				} else if (item.kind === "patch") {
					group.hasPatch = true;
				}
			}
			// 用持久版本链覆盖 original/currentAfter：chain 独立于环形数组，环形 shift 不丢版本。
			// original = chain[baselinePos]（基线游标处），currentAfter = 链尾（最新版）；并带基线状态供前端断言按钮可用性。
			for (const group of groups.values()) {
				const versions = fileVersions.get(versionKeyOf(effectiveSid, group.path));
				if (!versions || versions.chain.length === 0) continue;
				const last = versions.chain.length - 1;
				const pos = Math.min(Math.max(0, versions.pos), last);
				group.original = versions.chain[pos] == null ? "" : versions.chain[pos];
				group.currentAfter = versions.chain[last];
				group.baselinePos = pos;
				group.chainLength = versions.chain.length;
			}
			return Array.from(groups.values()).sort(function(a, b) {
				return (b.lastTime || 0) - (a.lastTime || 0);
			});
		},
		/**
		* 取某会话存活记录的最大 id（跨会话则取全局最大）；无记录返回 null。
		* 作为"改动单调递增时钟"，供前端判断是否有新改动出现。
		* @param sessionId - 可选会话编号。
		*/
		latestIdOf(sessionId, cwd) {
			const effectiveSid = resolveSessionSid(sessionId, cwd);
			let max = 0;
			for (const item of changes) {
				if (effectiveSid && item.sessionId && item.sessionId !== effectiveSid) continue;
				if (item.id && item.id > max) max = item.id;
			}
			return max || null;
		},
		/**
		* 按会话窗口分组聚合改动：每组会话内按文件折叠成整体对比，组内文件按最后修改时间降序。
		* 供前端 diff 列表按会话分类展示；无会话归属的记录归入 "unknown" 组。
		* @param currentSessionId - 当前会话编号；非空时只返回该会话一个组（组 id 用当前会话）。
		*/
		aggregateBySession(currentSessionId, cwd) {
		const effectiveSid = resolveSessionSid(currentSessionId, cwd);
			/** 单会话聚合（复用按文件的折叠逻辑但不按 path 去重到全量，仅本组内）。 */
			function aggregateOne(sessionId, items) {
				const normPath = function(p) {
					return String(p || "").replace(/\//g, "\\").toLowerCase();
				};
				const groups = new Map();
				for (const item of items) {
					const key = normPath(item.path);
					let group = groups.get(key);
					if (!group) {
						group = {
							path: item.path,
							sessionId,
							count: 0,
							original: null,
							currentAfter: null,
							hasPatch: false,
							lastTime: item.time || 0,
							tool: item.tool || ""
						};
						groups.set(key, group);
					}
					group.count += 1;
					if (item.kind === "write") {
						if (group.original === null) group.original = item.before;
						group.currentAfter = item.after;
						group.lastTime = item.time || group.lastTime;
						group.tool = item.tool || group.tool;
					} else if (item.kind === "patch") {
						group.hasPatch = true;
					}
				}
				// 用持久版本链覆盖 original/currentAfter 并带基线状态（与 aggregateByFile 一致）。
				for (const group of groups.values()) {
					const versions = fileVersions.get(versionKeyOf(sessionId, group.path));
					if (!versions || versions.chain.length === 0) continue;
					const last = versions.chain.length - 1;
					const pos = Math.min(Math.max(0, versions.pos), last);
					group.original = versions.chain[pos] == null ? "" : versions.chain[pos];
					group.currentAfter = versions.chain[last];
					group.baselinePos = pos;
					group.chainLength = versions.chain.length;
				}
				return Array.from(groups.values()).sort(function(a, b) {
					return (b.lastTime || 0) - (a.lastTime || 0);
				});
			}
			// 按会话编号分组各条记录。
			const bySession = new Map();
			for (const item of changes) {
				const sid = item.sessionId || "unknown";
				if (!bySession.has(sid)) bySession.set(sid, []);
				bySession.get(sid).push(item);
			}
			// 激活"只看当前会话"时，只产出当前会话一个组；否则产出所有会话组，按组内最新时间降序排。
			const groups = [];
			for (const [sid, items] of bySession.entries()) {
				if (effectiveSid && sid !== "unknown" && sid !== effectiveSid) continue;
				groups.push({ sessionId: sid, files: aggregateOne(sid, items) });
			}
			groups.sort(function(a, b) {
				const aLast = a.files[0] ? a.files[0].lastTime || 0 : 0;
				const bLast = b.files[0] ? b.files[0].lastTime || 0 : 0;
				return bLast - aLast;
			});
			return groups;
		},
		/**
		* 把某文件的基线游标向前移动一步：基线指向的版本前进一档。
		* @param sessionId - 会话编号。
		* @param absPath - 绝对路径。
		* @returns 该文件更新后的基线状态 {baselinePos, chainLength}；无版本链返回 null。
		*/
		advanceBaseline(sessionId, absPath) {
			const versions = fileVersions.get(versionKeyOf(sessionId, absPath));
			if (!versions || versions.chain.length === 0) return null;
			const last = versions.chain.length - 1;
			versions.pos = Math.min(last, versions.pos + 1);
			return { baselinePos: versions.pos, chainLength: versions.chain.length };
		},
		/**
		* 把某文件的基线游标一步推进到最新版：diff 清空，后续新改动以它当前版为基准。
		* @param sessionId - 会话编号。
		* @param absPath - 绝对路径。
		* @returns 该文件更新后的基线状态 {baselinePos, chainLength}；无版本链返回 null。
		*/
		advanceLatestBaseline(sessionId, absPath) {
			const versions = fileVersions.get(versionKeyOf(sessionId, absPath));
			if (!versions || versions.chain.length === 0) return null;
			versions.pos = versions.chain.length - 1;
			return { baselinePos: versions.pos, chainLength: versions.chain.length };
		},
		/**
		* 把某文件的基线游标往回退一步：被前进"吞掉"的旧 diff 重新露出。
		* @param sessionId - 会话编号。
		* @param absPath - 绝对路径。
		* @returns 该文件更新后的基线状态 {baselinePos, chainLength}；无版本链返回 null。
		*/
		retreatBaseline(sessionId, absPath) {
			const versions = fileVersions.get(versionKeyOf(sessionId, absPath));
			if (!versions || versions.chain.length === 0) return null;
			versions.pos = Math.max(0, versions.pos - 1);
			return { baselinePos: versions.pos, chainLength: versions.chain.length };
		},
		/**
		* 把某文件的基线游标一步退回最初始：从头开始看整段会话改动。
		* @param sessionId - 会话编号。
		* @param absPath - 绝对路径。
		* @returns 该文件更新后的基线状态 {baselinePos, chainLength}；无版本链返回 null。
		*/
		retreatStartBaseline(sessionId, absPath) {
			const versions = fileVersions.get(versionKeyOf(sessionId, absPath));
			if (!versions || versions.chain.length === 0) return null;
			versions.pos = 0;
			return { baselinePos: versions.pos, chainLength: versions.chain.length };
		},
		/**
		* 单条改动详情：kind=write 含改动前后全文；kind=patch 只含片段全文。
		* @param id - 记录编号（list 返回的 id）。
		*/
		detail(id) {
			const numericId = Number(id);
			const found = changes.find(function(item) {
				return item.id === numericId;
			});
			if (!found) throw new Error(`改动记录不存在: ${id}`);
			return found;
		},
		/**
		* 按需取某会话某文件聚合后的全文与元数据（列表接口已剥离全文，由此端点补取）。
		* sessionId 非空只聚合该会话单组；为空则聚合全部组跨组查找。
		* 复用模块级 annotateChangeKinds，保证 changeKind/重命名配对结果与列表完全一致；
		* path 仅按 normPath 规则做内存字符串匹配，不做绝对路径校验、不触盘。
		* @param sessionId - 会话编号（空串表示跨全部会话查找）。
		* @param absPath - 目标文件路径（聚合时记录的原始路径）。
		* @returns 命中返回全文与元数据；未命中返回 {found:false,path,sessionId}。
		*/
		async fileChangeContent(sessionId, absPath, cwd) {
			const rawSid = sessionId ? String(sessionId) : "";
			const sid = rawSid ? resolveSessionSid(rawSid, cwd) || rawSid : "";
			const groups = sid ? this.aggregateBySession(sid) : this.aggregateBySession();
			await annotateChangeKinds(groups);
			const targetKey = normPath(absPath);
			for (const group of groups) {
				const matched = (group.files || []).find(function(file) {
					return normPath(file.path) === targetKey;
				});
				if (matched) {
					return {
						found: true,
						path: matched.path,
						sessionId: group.sessionId,
						count: matched.count,
						hasPatch: !!matched.hasPatch,
						lastTime: matched.lastTime,
						tool: matched.tool,
						changeKind: matched.changeKind,
						renamedFrom: matched.renamedFrom ?? null,
						baselinePos: matched.baselinePos ?? null,
						chainLength: matched.chainLength ?? null,
						// original/currentAfter 为 null 时原样给 null（如仅 patch 片段、无 write 全文）。
						original: matched.original ?? null,
						currentAfter: matched.currentAfter ?? null
					};
				}
			}
			return { found: false, path: absPath, sessionId: sid };
		}
	};
}

/** 磁盘存在性检查结果的短缓存 TTL（毫秒）：2 秒内同一路径不重复 access。 */
const DISK_EXISTS_TTL_MS = 2000;
/** 存在性缓存条目数软上限：超过 500 先清过期项，清完仍超 600 则整体清空。 */
const DISK_EXISTS_CACHE_SOFT_LIMIT = 500;
/** 存在性缓存清过期项后的硬上限：仍超过此值说明活跃路径过多，直接整体清空。 */
const DISK_EXISTS_CACHE_HARD_LIMIT = 600;
/**
* 磁盘存在性短 TTL 缓存：key=normPath 规则归一（"/"→"\\" 后小写）的路径，
* value={v:是否存在, exp:过期时间戳}。避免每轮列表对每个文件都做一次 access 系统调用。
*/
const diskExistsCache = /* @__PURE__ */ new Map();
/**
* 查磁盘上路径是否存在（目录/文件皆可），带 2 秒 TTL 缓存。
* 键归一规则与聚合内 normPath 完全一致，保证同一文件的多次查询命中同一条目。
* @param p - 任意形式的路径字符串。
* @returns 存在返回 true，不存在/无权访问返回 false。
*/
async function existsOnDiskWithCache(p) {
	const key = String(p || "").replace(/\//g, "\\").toLowerCase();
	const now = Date.now();
	const cached = diskExistsCache.get(key);
	if (cached && cached.exp > now) return cached.v;
	let exists;
	try {
		await access(p);
		exists = true;
	} catch {
		exists = false;
	}
	if (diskExistsCache.size > DISK_EXISTS_CACHE_SOFT_LIMIT) {
		// 先淘汰全部已过期条目。
		for (const [cacheKey, entry] of diskExistsCache) {
			if (entry.exp <= now) diskExistsCache.delete(cacheKey);
		}
		// 清完仍超硬上限（活跃路径异常多），整体清空，宁可重查也不任其膨胀。
		if (diskExistsCache.size > DISK_EXISTS_CACHE_HARD_LIMIT) diskExistsCache.clear();
	}
	diskExistsCache.set(key, { v: exists, exp: now + DISK_EXISTS_TTL_MS });
	return exists;
}
/**
* 把聚合+标注后的文件内存对象映射为列表契约的元数据白名单（剥离 original/currentAfter 全文）。
* 仅分组形态（aggregateBySession 的条目）才带 sessionId 键；按文件聚合的条目本无此字段，不加。
* 缺失的可选字段（renamedFrom/baselinePos/chainLength）统一补 null，保证响应形状稳定。
* @param file - annotateChangeKinds 处理过的聚合文件对象（调用方不得长期持有映射结果外的全文）。
*/
function toFileMeta(file) {
	// Object.assign 按参数顺序定键序：sessionId 仅分组形态有，且须排在 path 之后、count 之前。
	return Object.assign(
		{ path: file.path },
		Object.prototype.hasOwnProperty.call(file, "sessionId") ? { sessionId: file.sessionId } : null,
		{
			count: file.count,
			hasPatch: !!file.hasPatch,
			lastTime: file.lastTime,
			tool: file.tool,
			changeKind: file.changeKind,
			renamedFrom: file.renamedFrom ?? null,
			baselinePos: file.baselinePos ?? null,
			chainLength: file.chainLength ?? null
		}
	);
}
/**
* 把会话组内存对象映射为分组列表契约：剥离全文并附组内 latestId。
* @param group - annotateChangeKinds 处理过的会话组对象。
* @param latestId - 该会话组存活记录最大 id（"unknown" 组由调用方传 null）。
*/
function toGroupMeta(group, latestId) {
	return {
		sessionId: group.sessionId,
		latestId,
		files: (group.files || []).map(toFileMeta)
	};
}
/**
* 给聚合后的改动文件标注 git 式变更类型：新增 / 删除 / 修改 / 重命名。
*
* 判定依据：
* - 新增：original 为空（会话开始时文件读不到/不存在）且磁盘上现在存在；
* - 删除：original 非空且磁盘上现在不存在（记录器只记写不记删，删后文件从磁盘消失）；
* - 修改：original 非空且磁盘上现在存在；
* - 重命名：同一会话内"新增"文件与"删除"文件内容完全相同（更简单的等价实现：
*   直接用字符串全文相等做校验，效果等同内容哈希配对）。
*
* 重命名配对在会话组内进行（跨会话不配对）；配对后删除项并入新增项标注，不再单列。
* @param groups - aggregateBySession 返回的会话组数组，原地加 changeKind 字段。
* @returns Promise<void>（磁盘存在性检查是异步的）。
*/
async function annotateChangeKinds(groups) {
	for (const group of groups) {
		const files = group.files || [];
		/** 本组新增候选：{ file, content }，按内容归一后找配对删除。 */
		const added = [];
		/** 本组删除候选：{ file, content }，只等配对。 */
		const deleted = [];
		// 第一遍：先按磁盘与 original 判定基础类型，把"新增/删除"候选收集起来。
		for (const file of files) {
			const diskExists = await existsOnDiskWithCache(file.path);
			// original 为 null 或空串都视为"没有原文"：新建文件首条 write 的
			// before 读不到磁盘内容，会被记录成 ""（而非 null），两者都应算新增候选。
			const hasOriginal = file.original != null && file.original !== "";
			// 没有 write 全文但有过 patch 片段：是修改不是新增（拿不到原文只能归修改）。
			const patchOnly = !hasOriginal && file.hasPatch;
			if (diskExists) {
				if (!hasOriginal && !patchOnly) {
					file.changeKind = "added";
					added.push({ file, content: file.currentAfter == null ? "" : file.currentAfter });
				} else {
					file.changeKind = "modified";
				}
			} else {
				file.changeKind = "deleted";
				// 配对内容优先用 currentAfter（文件消失前的最终内容）：
				// 旧文件在改名/删除前可能先被修改过，original 只是会话最初的样子，
				// 而新增文件记录的是写入后的内容，两者对齐才能配对成重命名。
				const goneContent = file.currentAfter != null && file.currentAfter !== "" ? file.currentAfter : (hasOriginal ? file.original : "");
				deleted.push({ file, content: goneContent || "" });
			}
		}
		// 第二遍：内容配对，删除项并入新增项 → 重命名。
		const usedDeleted = new Set();
		for (const a of added) {
			const mate = deleted.find(function(d) {
				return !usedDeleted.has(d.file) && d.content === a.content;
			});
			if (!mate) continue;
			usedDeleted.add(mate.file);
			a.file.changeKind = "renamed";
			a.file.renamedFrom = mate.file.path;
			a.file.original = mate.file.original == null ? "" : mate.file.original;
			a.file.count = (a.file.count || 0) + (mate.file.count || 0);
		}
		// 已配对的删除项从列表移除（界面只展示改名后的文件）。
		group.files = files.filter(function(f) {
			return !usedDeleted.has(f);
		});
	}
}
/**
* 创建会话事件接头员：把 session/event 总线上的工具事件转给改动记录器。
* 接头姿势有多手牌：双参（会话, 事件）、单参（事件）、事件包在首参里，都认。
* @param recorder - 改动记录器（createChangeRecorder 的返回值）。
*/
function createSessionWatcher(recorder) {
	let seen = 0;
	let matched = 0;
	return function onSessionEvent(first, second) {
		let session = null;
		let event = null;
		if (second && typeof second === "object" && typeof second.type === "string") {
			session = first;
			event = second;
		} else if (first && typeof first === "object" && typeof first.type === "string") {
			event = first;
		} else {
			appendDebug({ ev: "bus/shape", a: typeof first, b: typeof second, aKeys: first && typeof first === "object" ? Object.keys(first).slice(0, 6) : null });
			return;
		}
		seen++;
		if (seen <= 20 || seen % 100 === 0) appendDebug({ ev: "bus/seen", count: seen, matched, type: event.type });
		if (event.type === "tool/call" || event.type === "tool/result") {
			matched++;
			recorder.onEvent(session, event).catch(function(error) {
				appendDebug({ ev: "record/error", message: String(error && error.message || error) });
			});
		}
	};
}
//#endregion

export { apply, inject, name };
