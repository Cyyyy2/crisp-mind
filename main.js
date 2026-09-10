/* ==========================================================================
   Crisp Mind — Obsidian-Native Thought Graphs Engine
   Crafted for the Crisp Plugin Suite
   ========================================================================== */

const obsidian = require("obsidian");
const { Plugin, TextFileView, MarkdownView, Setting, PluginSettingTab, Notice, TFile, Modal, FuzzySuggestModal, setIcon, Menu, requestUrl } = obsidian;
const addIcon = obsidian.addIcon || (() => {});

const VIEW_TYPE_CRISP_MIND = "crisp-mind-view";
const CRISP_MIND_ICON_ID = "crisp-mind";

const CRISP_MIND_SVG = `<svg class="crisp-mind-brand-icon" viewBox="0 0 75 75" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
  <defs>
    <linearGradient id="crisp-mind-chrome-flow" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#cbd5e1" />
      <stop offset="18%" stop-color="#ffffff" />
      <stop offset="36%" stop-color="#181a24" />
      <stop offset="54%" stop-color="#f8fafc" />
      <stop offset="72%" stop-color="#334155" />
      <stop offset="90%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#cbd5e1" />
      <animateTransform 
        attributeName="gradientTransform" 
        type="rotate" 
        from="0 37.5 37.5" 
        to="360 37.5 37.5" 
        dur="6s" 
        repeatCount="indefinite" 
      />
    </linearGradient>
    <filter id="crisp-mind-flare-glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="1.5" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <path fill="url(#crisp-mind-chrome-flow)" stroke="currentColor" stroke-width="0.8" stroke-opacity="0.3" fill-rule="evenodd" d="M37.964 37.212s2.384-17.2 9.323-27.643a15.7 15.7 0 0 1 2.971-4.283c5.6-5.751 14.42-6.246 19.7-1.105 5.28 5.14 5.02 13.97-.58 19.721a16 16 0 0 1-2.45 2.057c-9.954 8.098-28.964 11.253-28.964 11.253m-1.517 1.362s-17.13 2.844-27.383 10.059a15.7 15.7 0 0 0-4.202 3.085c-5.6 5.751-5.86 14.58-.58 19.721s14.1 4.646 19.7-1.105a16 16 0 0 0 1.991-2.506c7.828-10.167 10.474-29.254 10.474-29.254M8.943 27.818c10.442 6.939 27.642 9.323 27.642 9.323S33.43 18.131 25.332 8.178a16 16 0 0 0-2.057-2.452C17.524.126 8.695-.132 3.554 5.148s-4.646 14.099 1.105 19.699a15.7 15.7 0 0 0 4.284 2.971M37.78 38.59s17.2 2.385 27.642 9.323a15.7 15.7 0 0 1 4.284 2.972c5.751 5.6 6.246 14.42 1.105 19.699-5.14 5.28-13.97 5.02-19.721-.579a16 16 0 0 1-2.057-2.451C40.937 57.6 37.78 38.59 37.78 38.59" clip-rule="evenodd"/>
  <g filter="url(#crisp-mind-flare-glow)">
    <animate attributeName="opacity" values="0.75;1;0.75" dur="3s" repeatCount="indefinite" />
    <ellipse cx="37.134" cy="37.88" fill="#ffffff" rx=".834" ry="21.087"/>
    <ellipse cx="37.015" cy="37.879" fill="#ffffff" rx=".834" ry="21.087" transform="rotate(-90 37.015 37.88)"/>
    <circle cx="37.08" cy="37.88" r="2.2" fill="#ffffff" />
  </g>
</svg>`;

const CRISP_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAiz41HIDpD59SH3DjKnovUO+EEhTJXjvmiug/ev9t4ZQ=
-----END PUBLIC KEY-----`;

const CRISP_LICENSE_PRODUCTS = [
  "Crisp Suite",
  "Crisp Mind",
  "Crisp Pulse",
  "Crisp Organize",
  "Crisp ASR",
  "Crisp Annotations",
  "Crisp File Explorer",
  "Crisp Focus",
  "Crisp Reading Rail",
  "Crisp Base",
  "Crisp Visual"
];

const DEFAULT_SETTINGS = {
  defaultLayout: "logicalStructure", // logicalStructure | mindMap | organizationStructure | catalogOrganization | timeline | fishbone
  defaultTheme: "crisp-obsidian",     // crisp-obsidian | crisp-cupertino | crisp-nord | crisp-mono | crisp-amber
  toolbarPosition: "bottom",         // bottom | top
  enablePulseSync: true,
  enableFocusZen: true,
  autoBackup: true,
  licenseCode: "",
  licenseLastOnlineAt: 0
};

/* ==========================================================================
   Cryptography & Vault License Discovery
   ========================================================================== */

function base64UrlToUint8Array(base64url) {
  const base64 = (base64url || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const decodeFn = typeof atob === "function" ? atob : (b64) => (typeof Buffer !== "undefined" ? Buffer.from(b64, "base64").toString("binary") : "");
  const raw = decodeFn(padded);
  const buffer = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    buffer[i] = raw.charCodeAt(i);
  }
  return buffer;
}

function getCryptoSubtle(windowObj = (typeof window !== "undefined" ? window : null)) {
  if (windowObj && windowObj.crypto && windowObj.crypto.subtle) {
    return windowObj.crypto.subtle;
  }
  if (typeof globalThis !== "undefined" && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto.subtle;
  }
  try {
    const nodeCrypto = require("crypto");
    if (nodeCrypto && nodeCrypto.webcrypto && nodeCrypto.webcrypto.subtle) {
      return nodeCrypto.webcrypto.subtle;
    }
  } catch (e) {}
  return null;
}

async function verifyLicenseCode(licenseCode, targetPluginId = "crisp-mind", app = null, windowObj = null) {
  if (typeof targetPluginId === "object" && targetPluginId !== null && !app) {
    windowObj = targetPluginId;
    targetPluginId = "crisp-mind";
  }
  const trimmed = (licenseCode || "").trim();
  if (!trimmed || !trimmed.includes(".")) {
    return { valid: false, reason: "授权码格式无效（须包含 payload 与签名）" };
  }
  const parts = trimmed.split(".");
  if (parts.length !== 2) {
    return { valid: false, reason: "授权码分段无效" };
  }
  const [payloadB64, sigB64] = parts;
  try {
    let payloadJson;
    try {
      payloadJson = new TextDecoder().decode(base64UrlToUint8Array(payloadB64));
    } catch (e) {
      return { valid: false, reason: "无法解码授权载荷" };
    }
    const payload = JSON.parse(payloadJson);
    if (!payload || typeof payload !== "object") {
      return { valid: false, reason: "授权载荷数据结构无效" };
    }
    if (!CRISP_LICENSE_PRODUCTS.includes(payload.product)) {
      return { valid: false, reason: "授权码不属于 Crisp 系列插件" };
    }
    const features = Array.isArray(payload.features) ? payload.features : [];
    if (!features.includes("all") && !features.includes(targetPluginId)) {
      return { valid: false, reason: `该授权码未包含 ${targetPluginId} 权限` };
    }
    if (payload.expiresAt) {
      const expiresAt = new Date(payload.expiresAt).getTime();
      if (!Number.isFinite(expiresAt)) {
        return { valid: false, reason: "授权到期时间无效" };
      }
      if (expiresAt < Date.now()) {
        return { valid: false, reason: `授权已于 ${String(payload.expiresAt).split("T")[0]} 到期` };
      }
    }

    const subtle = getCryptoSubtle(windowObj);
    if (!subtle) {
      return { valid: false, reason: "当前环境无法验证签名" };
    }
    const pemContents = CRISP_PUBLIC_KEY_PEM
      .replace("-----BEGIN PUBLIC KEY-----", "")
      .replace("-----END PUBLIC KEY-----", "")
      .replace(/\s/g, "");
    const der = base64UrlToUint8Array(pemContents);
    const key = await subtle.importKey("spki", der.buffer, { name: "Ed25519" }, false, ["verify"]);
    const payloadBytes = new TextEncoder().encode(payloadB64);
    const sigBytes = base64UrlToUint8Array(sigB64);
    const verified = await subtle.verify({ name: "Ed25519" }, key, sigBytes, payloadBytes);
    if (!verified) return { valid: false, reason: "授权签名无效或伪造" };

    try {
      const deviceId = app?.appId || (app?.vault?.getName ? "vault-" + encodeURIComponent(app.vault.getName()) : "device-default");
      const requestFn = obsidian.requestUrl || (typeof requestUrl === "function" ? requestUrl : null);
      if (requestFn) {
        const res = await Promise.race([
          requestFn({
            url: "https://license.letschips.xyz/api/verify-device",
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              licenseCode: trimmed,
              deviceId: deviceId,
              action: "activate",
              pluginId: targetPluginId
            }),
            throw: false
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Crisp license check timeout")), 2500))
        ]);

        let cloudResult = null;
        try { cloudResult = res.json; } catch { cloudResult = null; }

        const isAuthDenial =
          (res.status === 200 || res.status === 400 || res.status === 401 || res.status === 403) &&
          cloudResult !== null &&
          cloudResult.valid === false;

        if (isAuthDenial) {
          return {
            valid: false,
            reason: cloudResult?.reason || "授权已被服务端拒绝或设备数已达上限"
          };
        }

        if (res.status === 200 && cloudResult && cloudResult.valid === true) {
          return { valid: true, payload, message: cloudResult.message, source: "online" };
        }
      }
    } catch (netErr) {
      // Offline fallback
      return { valid: true, payload, message: "离线验证成功", source: "offline" };
    }

    return { valid: true, payload, message: "离线验证成功", source: "offline" };
  } catch (e) {
    return { valid: false, reason: e.message || "验证异常" };
  }
}

class CrispMindLicenseManager {
  constructor(app, settings, options = {}) {
    this.app = app;
    this.settings = settings;
    this.pluginId = "crisp-mind";
    this.status = { valid: false, reason: "尚未激活" };
  }

  getStatus() {
    return this.status;
  }

  async validateCurrentLicense() {
    const code = (this.settings.licenseCode || "").trim();
    if (!code) {
      this.status = { valid: false, reason: "未输入授权码" };
      return this.status;
    }
    const result = await verifyLicenseCode(code, this.pluginId, this.app);
    if (result.valid) {
      this.status = { valid: true, payload: result.payload, source: result.source || "offline" };
      this.settings.licenseLastOnlineAt = Date.now();
    } else {
      this.status = { valid: false, reason: result.reason || "授权码无效" };
    }
    return this.status;
  }

  async activate(code) {
    const trimmed = (code || "").trim();
    if (!trimmed) {
      this.status = { valid: false, reason: "授权码为空" };
      return this.status;
    }
    const result = await verifyLicenseCode(trimmed, this.pluginId, this.app);
    if (result.valid) {
      this.settings.licenseCode = trimmed;
      this.settings.licenseLastOnlineAt = Date.now();
      this.status = { valid: true, payload: result.payload, source: result.source || "offline" };
      return this.status;
    }
    this.status = { valid: false, reason: result.reason || "激活失败" };
    return this.status;
  }

  clear() {
    this.settings.licenseCode = "";
    this.status = { valid: false, reason: "已清除授权" };
  }
}

function discoverVaultCrispLicense(app) {
  if (!app) return null;
  const crispPlugins = [
    "crisp-pulse",
    "crisp-focus",
    "crisp-file-explorer",
    "crisp-base",
    "crisp-recall",
    "crisp-annotations",
    "crisp-reading-rail",
    "crisp-asr",
    "crisp-visual"
  ];
  for (const pid of crispPlugins) {
    const p = app.plugins?.plugins?.[pid];
    if (p?.settings?.licenseCode && typeof p.settings.licenseCode === "string" && p.settings.licenseCode.includes(".")) {
      return p.settings.licenseCode.trim();
    }
  }
  try {
    const pathMod = typeof require === "function" ? require("path") : null;
    const fsMod = typeof require === "function" ? require("fs") : null;
    if (pathMod && fsMod) {
      const basePath = app.vault?.adapter?.basePath || (app.vault?.adapter?.getBasePath ? app.vault.adapter.getBasePath() : "");
      const pluginsDir = basePath ? pathMod.join(basePath, ".obsidian", "plugins") : "";
      if (pluginsDir && fsMod.existsSync(pluginsDir)) {
        const dirs = fsMod.readdirSync(pluginsDir);
        for (const d of dirs) {
          if (d.startsWith("crisp-") && d !== "crisp-mind") {
            const dataPath = pathMod.join(pluginsDir, d, "data.json");
            if (fsMod.existsSync(dataPath)) {
              const raw = fsMod.readFileSync(dataPath, "utf8");
              const data = JSON.parse(raw);
              const code = data?.licenseCode || data?.settings?.licenseCode;
              if (code && typeof code === "string" && code.includes(".")) {
                return code.trim();
              }
            }
          }
        }
      }
    }
  } catch (e) {}
  return null;
}

/* ==========================================================================
   Data Model & Markdown Converter
   ========================================================================== */

function generateUid() {
  return "node-" + Math.random().toString(36).slice(2, 10);
}

function markdownOutlineToTree(markdown) {
  if (!markdown || typeof markdown !== "string") {
    return { id: generateUid(), data: { text: "Central Topic" }, children: [] };
  }

  const lines = markdown.split(/\r?\n/);
  let rootText = "Central Topic";
  const items = [];

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("---")) continue;
    if (/^[a-zA-Z0-9_-]+:\s*.*/.test(trimmed) && items.length === 0 && !trimmed.startsWith("- ")) continue;

    const headingMatch = line.match(/^#{1,6}\s+(.*)/);
    if (headingMatch && items.length === 0) {
      rootText = headingMatch[1].trim();
      continue;
    }

    const listMatch = line.match(/^(\s*)(?:[-*+]|\d+\.)\s+(.*)/);
    if (listMatch) {
      const indent = listMatch[1].length;
      const text = listMatch[2].trim();
      items.push({ indent, text });
    }
  }

  const root = { id: generateUid(), data: { text: rootText }, children: [] };
  if (items.length === 0) {
    return root;
  }

  const stack = [{ node: root, indent: -1 }];

  for (const item of items) {
    const newNode = { id: generateUid(), data: { text: item.text }, children: [] };
    while (stack.length > 1 && stack[stack.length - 1].indent >= item.indent) {
      stack.pop();
    }
    const parent = stack[stack.length - 1].node;
    parent.children.push(newNode);
    parent.data.collapsed = false;
    stack.push({ node: newNode, indent: item.indent });
  }

  return root;
}

function treeToMarkdownOutline(rootNode, level = 0) {
  if (!rootNode || !rootNode.data) return "";
  let out = "";
  if (level === 0) {
    out += `# ${rootNode.data.text || "Central Topic"}\n`;
    if (Array.isArray(rootNode.children)) {
      for (const child of rootNode.children) {
        out += treeToMarkdownOutline(child, 1);
      }
    }
    return out;
  }

  const indent = "  ".repeat(level - 1);
  out += `${indent}- ${rootNode.data.text || ""}\n`;
  if (Array.isArray(rootNode.children)) {
    for (const child of rootNode.children) {
      out += treeToMarkdownOutline(child, level + 1);
    }
  }
  return out;
}

function validateAndRepairTree(docData) {
  if (!docData || typeof docData !== "object") {
    docData = {};
  }
  if (!docData.root || typeof docData.root !== "object") {
    docData.root = { id: generateUid(), data: { text: "Central Topic" }, children: [] };
  }

  function repairNode(node, isRoot = false) {
    if (!node || typeof node !== "object") {
      return { id: generateUid(), data: { text: isRoot ? "Central Topic" : "Topic" }, children: [] };
    }
    if (!node.id) node.id = generateUid();
    if (!node.data || typeof node.data !== "object") {
      node.data = { text: isRoot ? "Central Topic" : "Topic" };
    }
    if (typeof node.data.text !== "string" || !node.data.text.trim()) {
      node.data.text = isRoot ? "Central Topic" : "Topic";
    }
    if (!Array.isArray(node.children)) {
      node.children = [];
    } else {
      node.children = node.children
        .filter((c) => c !== null && typeof c === "object")
        .map((child) => repairNode(child, false));
    }
    return node;
  }

  docData.root = repairNode(docData.root, true);
  if (!docData.layout) docData.layout = "logicalStructure";
  if (!docData.theme) docData.theme = "crisp-obsidian";
  return docData;
}

function parseMindMarkdown(rawText) {
  if (!rawText || typeof rawText !== "string") {
    const defaultRoot = { id: generateUid(), data: { text: "Central Topic" }, children: [] };
    return {
      title: "Central Topic",
      frontmatter: "crisp-mind: true\n",
      data: { version: "1.0", layout: "logicalStructure", theme: "crisp-obsidian", root: defaultRoot }
    };
  }

  let frontmatter = "";
  let title = "Central Topic";
  let content = rawText;

  if (rawText.startsWith("---")) {
    const endIdx = rawText.indexOf("\n---", 3);
    if (endIdx !== -1) {
      frontmatter = rawText.slice(4, endIdx).trim() + "\n";
      content = rawText.slice(endIdx + 4).trim();
    }
  }

  const blockStart = content.indexOf("<!-- CRISP-MIND-DATA-START -->");
  const blockEnd = content.indexOf("<!-- CRISP-MIND-DATA-END -->");

  if (blockStart !== -1 && blockEnd !== -1) {
    const jsonBlock = content.slice(blockStart, blockEnd);
    const match = jsonBlock.match(/```crisp-mind\s*\n([\s\S]*?)\n```/);
    if (match) {
      try {
        const parsedData = JSON.parse(match[1]);
        const repaired = validateAndRepairTree(parsedData);
        title = repaired.root?.data?.text || title;
        return { title, frontmatter, data: repaired };
      } catch (e) {
        console.warn("Crisp Mind: Failed to parse embedded JSON block, falling back to outline", e);
      }
    }
  }

  const tree = markdownOutlineToTree(content);
  return {
    title: tree.data.text,
    frontmatter: frontmatter || "crisp-mind: true\n",
    data: {
      version: "1.0",
      layout: "logicalStructure",
      theme: "crisp-obsidian",
      root: tree
    }
  };
}

function normalizeMindLinkText(text, vaultName) {
  const source = text.trim();
  const prefix = source.match(/^\[[ xX]\]\s+/)?.[0] || "";
  const trimmed = source.slice(prefix.length);
  if (!/^obsidian:/i.test(trimmed)) return text;
  let url; try { url = new URL(trimmed); } catch (_) { throw Error("Obsidian 地址格式不正确"); }
  if (url.protocol !== "obsidian:" || url.hostname !== "open" || url.pathname && url.pathname !== "/") throw Error("仅支持 obsidian://open 笔记地址");
  const vault = url.searchParams.get("vault"), file = url.searchParams.get("file");
  if (!file?.trim()) throw Error("地址中缺少 file 笔记路径");
  if (vault && vaultName && vault !== vaultName) throw Error("此地址属于其他仓库，请使用当前仓库的笔记链接");
  const target = file.replace(/\\/g, "/").replace(/^\/+/, "").replace(/\.md(?=#|$)/i, "");
  if (!target || /[\[\]|\r\n]/.test(target) || /(^|\/)\.\.(\/|$)/.test(target)) throw Error("笔记路径包含不支持的字符");
  const label = target.split("/").pop();
  return `${prefix}[[${target}|${label}]]`;
}

function mindNodeLink(text, vaultName) {
  let normalized;
  try { normalized = normalizeMindLinkText(text, vaultName); } catch (_) { normalized = text; }
  const match = normalized.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  if (!match) return null;
  return { target: match[1], display: normalized.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) => alias || target) };
}

const MIND_GEOMETRY_KEYS = new Set(["_x", "_y", "_w", "_h", "_treeHeight", "_treeWidth", "_lines"]);
function cleanMindData(data) {
  return JSON.parse(JSON.stringify(data, (key, value) => MIND_GEOMETRY_KEYS.has(key) ? undefined : value));
}

// Managed files may be displayed after an error, but never silently repaired on disk.
function inspectMindSource(raw) {
  const start = "<!-- CRISP-MIND-DATA-START -->", end = "<!-- CRISP-MIND-DATA-END -->";
  if (!raw.includes(start) || !raw.includes(end)) return "缺少导图数据块，已只读打开";
  const block = raw.slice(raw.indexOf(start) + start.length, raw.lastIndexOf(end));
  const match = block.match(/^\s*```crisp-mind\s*\n([\s\S]*?)\n```\s*$/);
  if (!match) return "导图数据块损坏，已只读打开";
  try {
    const data = JSON.parse(match[1]);
    const ids = new Set(); let count = 0;
    const visit = (n, depth = 0) => {
      if (!n || typeof n !== "object" || Array.isArray(n) || !n.data || typeof n.data.text !== "string" || !n.data.text.trim() || typeof n.id !== "string" || !n.id || (n.children != null && !Array.isArray(n.children))) throw Error("节点数据损坏");
      if (ids.has(n.id)) throw Error("节点 ID 重复");
      if (++count > 10000 || depth > 200) throw Error("导图超过安全读取范围");
      ids.add(n.id); (n.children || []).forEach(c => visit(c, depth + 1));
    };
    visit(data.root);
    const body = raw.slice(0, raw.indexOf(start)).replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "");
    const flattenTexts = (node) => {
      const result = [];
      const walk = (n, depth) => {
        result.push(`${depth}:${(n.data?.text || "").trim()}`);
        (n.children || []).forEach(c => walk(c, depth + 1));
      };
      if (node) walk(node, 0);
      return result.join("\n");
    };
    if (flattenTexts(markdownOutlineToTree(body)) !== flattenTexts(data.root)) return "大纲与导图数据不一致，请保留原文并解决冲突";
    if (raw.slice(raw.lastIndexOf(end) + end.length).trim()) return "导图末尾有附加正文，已只读保护";
    return null;
  } catch (error) { return `导图数据损坏：${error.message}`; }
}

function assembleMindMarkdown(mindDoc) {
  const frontmatter = mindDoc.frontmatter ? mindDoc.frontmatter.trim() : "crisp-mind: true";
  const outline = treeToMarkdownOutline(mindDoc.data.root);
  const jsonStr = JSON.stringify(cleanMindData(mindDoc.data), null, 2).replace(/`/g, "\\u0060");

  return `---
${frontmatter}
---

${outline.trim()}

<!-- CRISP-MIND-DATA-START -->
\`\`\`crisp-mind
${jsonStr}
\`\`\`
<!-- CRISP-MIND-DATA-END -->
`;
}

function extractNodeToTopicContent(node) {
  let raw = node?.data?.text || "Untitled Topic";
  raw = raw.replace(/^\[[ xX]\]\s*/, "");
  const linkMatch = raw.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  let title = raw;
  if (linkMatch) {
    const target = linkMatch[1];
    const alias = linkMatch[2] || target.split("/").pop();
    title = raw.replace(/\[\[[^\]]+\]\]/g, alias).trim();
  }
  title = title.replace(/[\\/:*?"<>|#^\[\]\r\n]/g, " ").trim().replace(/\s+/g, " ") || "Untitled Topic";
  const outline = treeToMarkdownOutline(node);
  const content = `---
crisp-type: topic-note
title: ${JSON.stringify(title)}
created: "${new Date().toISOString().slice(0, 10)}"
tags: [topic, crisp/mind]
---

${outline.trim()}
`;
  return { title, content };
}

/* ==========================================================================
   Theme Palettes & Obsidian Integration
   ========================================================================== */

function getComputedThemeConfig(themeName = "crisp-obsidian") {
  const isDark = typeof document !== "undefined" && document.body?.classList?.contains
    ? document.body.classList.contains("theme-dark")
    : false;

  if (themeName === "crisp-cupertino") {
    return {
      name: "crisp-cupertino",
      backgroundColor: isDark ? "#1c1c1e" : "#f2f2f7",
      nodeBackground: isDark ? "#2c2c2e" : "#ffffff",
      accentColor: "#007aff",
      textColor: isDark ? "#f2f2f7" : "#1c1c1e",
      textMuted: isDark ? "#8e8e93" : "#6c6c70",
      borderColor: isDark ? "#3a3a3c" : "#d1d1d6",
      lineColor: "#007aff",
      activeBorderColor: "#5856d6",
      borderRadius: 8
    };
  }

  if (themeName === "crisp-nord") {
    return {
      name: "crisp-nord",
      backgroundColor: "#2e3440",
      nodeBackground: "#3b4252",
      accentColor: "#88c0d0",
      textColor: "#eceff4",
      textMuted: "#d8dee9",
      borderColor: "#4c566a",
      lineColor: "#81a1c1",
      activeBorderColor: "#8fbcbb",
      borderRadius: 6
    };
  }

  if (themeName === "crisp-mono") {
    return {
      name: "crisp-mono",
      backgroundColor: isDark ? "#121212" : "#f7f7f5",
      nodeBackground: isDark ? "#1e1e1e" : "#ffffff",
      accentColor: isDark ? "#e63946" : "#111111",
      textColor: isDark ? "#e0e0e0" : "#111111",
      textMuted: isDark ? "#757575" : "#666666",
      borderColor: isDark ? "#333333" : "#cccccc",
      lineColor: isDark ? "#e63946" : "#222222",
      activeBorderColor: "#e63946",
      borderRadius: 4
    };
  }

  if (themeName === "crisp-amber") {
    return {
      name: "crisp-amber",
      backgroundColor: isDark ? "#1a1612" : "#fffbeb",
      nodeBackground: isDark ? "#29231d" : "#fef3c7",
      accentColor: "#d97706",
      textColor: isDark ? "#fde68a" : "#78350f",
      textMuted: isDark ? "#b45309" : "#92400e",
      borderColor: isDark ? "#451a03" : "#fcd34d",
      lineColor: "#d97706",
      activeBorderColor: "#f59e0b",
      borderRadius: 10
    };
  }

  // Default: crisp-obsidian (Dynamic CSS variable extraction)
  let accent = "#7c3aed";
  let bgPrimary = isDark ? "#1e1e2e" : "#ffffff";
  let bgSecondary = isDark ? "#181825" : "#f8f9fa";
  let textNormal = isDark ? "#cdd6f4" : "#1e1e2e";
  let textMuted = isDark ? "#a6adc8" : "#6c757d";
  let border = isDark ? "#313244" : "#dee2e6";

  if (typeof window !== "undefined" && window.getComputedStyle) {
    const style = window.getComputedStyle(document.body);
    accent = style.getPropertyValue("--color-accent")?.trim() || accent;
    bgPrimary = style.getPropertyValue("--background-primary")?.trim() || bgPrimary;
    bgSecondary = style.getPropertyValue("--background-secondary")?.trim() || bgSecondary;
    textNormal = style.getPropertyValue("--text-normal")?.trim() || textNormal;
    textMuted = style.getPropertyValue("--text-muted")?.trim() || textMuted;
    border = style.getPropertyValue("--background-modifier-border")?.trim() || border;
  }

  const isTranslucent = typeof document !== "undefined" && document.body?.classList?.contains
    ? document.body.classList.contains("is-translucent")
    : false;

  return {
    name: "crisp-obsidian",
    backgroundColor: isTranslucent ? "transparent" : bgPrimary,
    nodeBackground: bgSecondary,
    accentColor: accent,
    textColor: textNormal,
    textMuted: textMuted,
    borderColor: border,
    lineColor: accent,
    activeBorderColor: accent,
    borderRadius: 8
  };
}

/* ==========================================================================
   Crisp Mind SVG Canvas Controller
   ========================================================================== */

class CrispMindCanvas {
  constructor(containerEl, docData, options = {}) {
    this.container = containerEl;
    this.document = containerEl.ownerDocument || document;
    this.window = this.document.defaultView || window;
    this.disposers = [];
    this.docData = docData;
    this.options = options;
    this.theme = getComputedThemeConfig(docData.theme || "crisp-obsidian");
    this.layout = docData.layout || "logicalStructure";

    this.scale = 1;
    this.translateX = 120;
    this.translateY = 220;
    this.isPanning = false;
    this.startX = 0;
    this.startY = 0;

    this.selectedNodeId = null;
    this.history = [];
    this.historyIndex = -1;

    this.saveState(false);
    this.initCanvas();
  }

  initCanvas() {
    this.container.classList.add("crisp-mind-view");
    this.container.tabIndex = 0;
    // Obsidian treats aria-label as a hover tooltip; name the canvas by a label
    // reference instead so it cannot compete with individual button tooltips.
    const canvasLabel = this.document.createElement("span");
    canvasLabel.id = generateUid();
    canvasLabel.className = "crisp-mind-accessible-label";
    canvasLabel.textContent = "思维导图画布";
    this.container.appendChild(canvasLabel);
    this.container.setAttribute("role", "group");
    this.container.setAttribute("aria-labelledby", canvasLabel.id);

    // Remove old svg if re-initializing
    const oldSvg = this.container.querySelector("svg.crisp-mind-canvas");
    if (oldSvg) oldSvg.remove();

    this.svg = this.document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svg.setAttribute("class", "crisp-mind-canvas");
    this.container.insertBefore(this.svg, this.container.firstChild);

    this.viewportGroup = this.document.createElementNS("http://www.w3.org/2000/svg", "g");
    this.svg.appendChild(this.viewportGroup);

    this.linesGroup = this.document.createElementNS("http://www.w3.org/2000/svg", "g");
    this.nodesGroup = this.document.createElementNS("http://www.w3.org/2000/svg", "g");
    this.viewportGroup.appendChild(this.linesGroup);
    this.viewportGroup.appendChild(this.nodesGroup);

    this.bindEvents();
    this.render();
    if (this.window.ResizeObserver) {
      const observer = new this.window.ResizeObserver(() => {
        const width = this.container.clientWidth, height = this.container.clientHeight;
        if (!width || !height) return;
        if (!this.viewportSize) this.resetZoom();
        else {
          this.commitEditor?.();
          this.translateX += (width - this.viewportSize.width) / 2;
          this.translateY += (height - this.viewportSize.height) / 2;
          this.updateTransform();
        }
        this.viewportSize = {width, height};
      });
      observer.observe(this.container); this.disposers.push(() => observer.disconnect());
    }
  }

  saveState(notify = true) {
    const state = cleanMindData(this.docData);
    if (this.historyIndex >= 0 && JSON.stringify(this.history[this.historyIndex]) === JSON.stringify(state)) return false;
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }
    this.history.push(state);
    this.historyIndex++;
    if (this.history.length > 50) {
      this.history.shift();
      this.historyIndex--;
    }
    if (notify && typeof this.options.onChange === "function") {
      this.options.onChange(this.docData);
    }
    return true;
  }

  undo() {
    if (this.options.readOnly) return;
    if (this.historyIndex > 0) {
      this.historyIndex--;
      Object.assign(this.docData, JSON.parse(JSON.stringify(this.history[this.historyIndex])));
      if (!this.findNode(this.selectedNodeId)) this.selectedNodeId = this.docData.root.id;
      this.layout = this.docData.layout;
      this.theme = getComputedThemeConfig(this.docData.theme);
      this.render();
      if (typeof this.options.onChange === "function") {
        this.options.onChange(this.docData);
      }
    }
  }

  redo() {
    if (this.options.readOnly) return;
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      Object.assign(this.docData, JSON.parse(JSON.stringify(this.history[this.historyIndex])));
      if (!this.findNode(this.selectedNodeId)) this.selectedNodeId = this.docData.root.id;
      this.layout = this.docData.layout;
      this.theme = getComputedThemeConfig(this.docData.theme);
      this.render();
      if (typeof this.options.onChange === "function") {
        this.options.onChange(this.docData);
      }
    }
  }

  setTheme(themeName) {
    this.docData.theme = themeName;
    this.theme = getComputedThemeConfig(themeName);
    this.render();
    if (!this.options.readOnly) this.saveState();
  }

  setLayout(layoutName) {
    this.docData.layout = layoutName;
    this.layout = layoutName;
    this.render();
    if (!this.options.readOnly) this.saveState();
  }

  findNode(id, node = this.docData.root) {
    if (!node) return null;
    if (node.id === id) return node;
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        const found = this.findNode(id, child);
        if (found) return found;
      }
    }
    return null;
  }

  findParent(id, node = this.docData.root, parent = null) {
    if (!node) return null;
    if (node.id === id) return parent;
    if (Array.isArray(node.children)) {
      for (const child of node.children) {
        const found = this.findParent(id, child, node);
        if (found) return found;
      }
    }
    return null;
  }

  addChildNode(parentId = this.selectedNodeId, edit = false) {
    if (this.options.readOnly) return;
    const parent = parentId ? this.findNode(parentId) : this.docData.root;
    if (!parent) return;
    const newNode = {
      id: generateUid(),
      data: { text: "新节点" },
      children: []
    };
    if (!Array.isArray(parent.children)) parent.children = [];
    parent.children.push(newNode);
    parent.data.collapsed = false;
    this.selectedNodeId = newNode.id;
    this.saveState();
    this.render();
    this.selectNode(newNode.id, true);
    if (edit && !this.options.readOnly) {
      const created = this.findNode(newNode.id);
      if (created) this.editNodeText(created);
    }
  }

  addSiblingNode(nodeId = this.selectedNodeId, edit = false) {
    if (this.options.readOnly) return;
    if (!nodeId || nodeId === this.docData.root.id) {
      this.addChildNode(this.docData.root.id, edit);
      return;
    }
    const parent = this.findParent(nodeId);
    if (!parent) return;
    const idx = parent.children.findIndex((c) => c.id === nodeId);
    const newNode = {
      id: generateUid(),
      data: { text: "同级节点" },
      children: []
    };
    parent.children.splice(idx + 1, 0, newNode);
    parent.data.collapsed = false;
    this.selectedNodeId = newNode.id;
    this.saveState();
    this.render();
    this.selectNode(newNode.id, true);
    if (edit && !this.options.readOnly) {
      const created = this.findNode(newNode.id);
      if (created) this.editNodeText(created);
    }
  }

  deleteNode(nodeId = this.selectedNodeId) {
    if (this.options.readOnly) return;
    if (!nodeId || nodeId === this.docData.root.id) return;
    const parent = this.findParent(nodeId);
    if (!parent) return;
    parent.children = parent.children.filter((c) => c.id !== nodeId);
    this.selectedNodeId = parent.id;
    this.saveState();
    this.render();
  }

  // All structural edits finish through one history boundary.
  transact(change) {
    if (this.options.readOnly || this.editor) return false;
    const before = cleanMindData(this.docData);
    try { if (change() === false) return false; }
    catch (error) { Object.assign(this.docData, before); throw error; }
    const changed = this.saveState();
    if (changed) this.render();
    return !!changed;
  }

  visibleNodes() {
    const list = [];
    const walk = n => { list.push(n); if (!n.data.collapsed) (n.children || []).forEach(walk); };
    walk(this.docData.root); return list;
  }

  toggleCollapse(id = this.selectedNodeId) {
    return this.transact(() => {
      const n = this.findNode(id); if (!n?.children?.length) return false;
      n.data.collapsed = !n.data.collapsed; this.selectedNodeId = n.id;
    });
  }

  moveNode(id, targetId, placement = "inside") {
    return this.transact(() => {
      const node = this.findNode(id), target = this.findNode(targetId), oldParent = this.findParent(id);
      if (!node || !target || !oldParent || node === target || this.findNode(targetId, node)) return false;
      const parent = placement === "inside" ? target : this.findParent(targetId);
      if (!parent || !["inside", "before", "after"].includes(placement)) return false;
      oldParent.children.splice(oldParent.children.indexOf(node), 1);
      const index = placement === "inside" ? parent.children.length : parent.children.indexOf(target) + (placement === "after" ? 1 : 0);
      parent.children.splice(index, 0, node); parent.data.collapsed = false;
      this.selectedNodeId = node.id;
    });
  }

  copyBranchText(id = this.selectedNodeId) {
    const node = this.findNode(id); if (!node) return "";
    // A readable outline is the clipboard interchange format, not executable HTML.
    const lines = [];
    const walk = (n, depth) => { lines.push("  ".repeat(depth) + "- " + n.data.text.replace(/\r?\n/g, " ")); (n.children || []).forEach(c => walk(c, depth + 1)); };
    walk(node, 0); return lines.join("\n");
  }

  pasteBranchText(text, parentId = this.selectedNodeId || this.docData.root.id) {
    if (typeof text !== "string" || !text.trim() || text.length > 100000) return false;
    const root = {children: []}; const stack = [{node: root, indent: -1}]; let count = 0;
    for (const line of text.replace(/\r/g, "").split("\n")) {
      if (!line.trim()) continue;
      if (++count > 1000) return false;
      const indent = line.match(/^\s*/)[0].replace(/\t/g, "  ").length;
      const label = line.trim().replace(/^(?:[-*+] |\d+[.)] |#{1,6} )/, "").trim(); if (!label) continue;
      const node = {id: generateUid(), data: {text: normalizeMindLinkText(label, this.options.vaultName)}, children: []};
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
      if (stack.length > 100) return false;
      stack[stack.length - 1].node.children.push(node); stack.push({node, indent});
    }
    return this.transact(() => {
      const parent = this.findNode(parentId); if (!parent || !root.children.length) return false;
      parent.children.push(...root.children); parent.data.collapsed = false;
      this.selectedNodeId = root.children[0].id;
    });
  }

  selectNode(id, reveal = false) {
    const node = this.findNode(id); if (!node) return;
    this.selectedNodeId = id; this.render();
    if (reveal) {
      const x = (node._x + node._w / 2) * this.scale + this.translateX;
      const y = (node._y + node._h / 2) * this.scale + this.translateY;
      if (x < 40 || x > this.container.clientWidth - 40 || y < 60 || y > this.container.clientHeight - 100) {
        this.translateX += this.container.clientWidth / 2 - x;
        this.translateY += this.container.clientHeight / 2 - y; this.updateTransform();
      }
    }
    this.options.onSelectNode?.(node, {x: (node._x + node._w / 2) * this.scale + this.translateX, y: node._y * this.scale + this.translateY});
  }

  navigate(key) {
    const node = this.findNode(this.selectedNodeId) || this.docData.root;
    const current = {x: node._x + node._w / 2, y: node._y + node._h / 2};
    let best = null, score = Infinity;
    for (const n of this.visibleNodes()) {
      if (n === node) continue;
      const dx = n._x + n._w / 2 - current.x, dy = n._y + n._h / 2 - current.y;
      const along = key === "ArrowRight" ? dx : key === "ArrowLeft" ? -dx : key === "ArrowDown" ? dy : -dy;
      const across = key === "ArrowRight" || key === "ArrowLeft" ? Math.abs(dy) : Math.abs(dx);
      if (along > 1 && along + across * 2 < score) { best = n; score = along + across * 2; }
    }
    this.selectNode((best || node).id, true);
  }

  /* --- Tree Layout Calculation --- */
  calculateLayout() {
    const H_GAP = 54;
    const V_GAP = 20;

    const children = n => n.data.collapsed ? [] : (n.children || []);
    const font = this.window?.getComputedStyle && this.container?.ownerDocument ? this.window.getComputedStyle(this.container).fontFamily : "sans-serif";
    if (this.document?.createElement && !this.measureContext) {
      try { this.measureContext = this.document.createElement("canvas").getContext("2d"); } catch (_) {}
    }
    const widthOf = (text, root) => {
      if (this.measureContext) {
        const fontSpec = `${root ? 600 : 450} ${root ? 14 : 13}px ${font}`, key = fontSpec + "\u0000" + text;
        this.textMetrics = this.textMetrics || new Map();
        if (this.textMetrics.has(key)) return this.textMetrics.get(key);
        this.measureContext.font = fontSpec; const width = this.measureContext.measureText(text).width;
        if (this.textMetrics.size >= 8192) this.textMetrics.clear();
        this.textMetrics.set(key, width); return width;
      }
      return [...text].reduce((n,c) => n + (/[^\x00-\xff]/.test(c) ? 14 : 8), 0);
    };
    const measure = (node, isRoot = false) => {
      const text = mindNodeLink(node.data?.text || "", this.options.vaultName)?.display || node.data?.text || "";
      const lines = [""];
      let width = 0;
      for (const char of text) {
        const w = widthOf(char, isRoot);
        if (width + w > 252 || char === "\n") { lines.push(""); width = 0; }
        if (char !== "\n") { lines[lines.length - 1] += char; width += w; }
      }
      node._lines = lines;
      node._w = Math.max(isRoot ? 140 : 100, Math.min(284, Math.max(...lines.map(line => widthOf(line, isRoot))) + 32));
      node._h = Math.max(isRoot ? 48 : 38, lines.length * 20 + 18);
      children(node).forEach(c => measure(c));
      node._treeHeight = Math.max(node._h, children(node).reduce((n,c) => n + c._treeHeight, 0) + Math.max(0, children(node).length - 1) * V_GAP);
      node._treeWidth = Math.max(node._w, children(node).reduce((n,c) => n + c._treeWidth, 0) + Math.max(0, children(node).length - 1) * H_GAP);
    };
    const root = this.docData.root;
    measure(root, true);
    const horizontal = (node, x, top, direction = 1) => {
      node._x = x;
      node._y = top + (node._treeHeight - node._h) / 2;
      let y = top;
      for (const child of children(node)) {
        horizontal(child, direction === 1 ? x + node._w + H_GAP : x - child._w - H_GAP, y, direction);
        y += child._treeHeight + V_GAP;
      }
    };
    if (this.layout === "organizationStructure") {
      const levelHeights = [];
      const heights = (n, depth) => { levelHeights[depth] = Math.max(levelHeights[depth] || 0, n._h); children(n).forEach(c => heights(c, depth + 1)); };
      heights(root, 0);
      const vertical = (n, left, y, depth) => {
        n._x = left + (n._treeWidth - n._w) / 2; n._y = y;
        const total = children(n).reduce((sum,c) => sum + c._treeWidth, 0) + Math.max(0, children(n).length - 1) * H_GAP;
        let x = left + (n._treeWidth - total) / 2;
        children(n).forEach(c => { vertical(c, x, y + levelHeights[depth] + 60, depth + 1); x += c._treeWidth + H_GAP; });
      };
      vertical(root, 0, 0, 0);
    } else if (this.layout === "catalogOrganization") {
      let y = 0;
      const outline = (n, depth) => { n._x = depth * 48; n._y = y; y += n._h + V_GAP; children(n).forEach(c => outline(c, depth + 1)); };
      outline(root, 0);
    } else if (this.layout === "mindMap") {
      root._x = 0; root._y = 0;
      for (const direction of [1, -1]) {
        const branch = children(root).filter((_, i) => i % 2 === (direction === 1 ? 0 : 1));
        let y = root._h / 2 - (branch.reduce((sum,c) => sum + c._treeHeight, 0) + Math.max(0, branch.length - 1) * V_GAP) / 2;
        branch.forEach(c => { horizontal(c, direction === 1 ? root._w + H_GAP : -c._w - H_GAP, y, direction); y += c._treeHeight + V_GAP; });
      }
    } else if (this.layout === "timeline") {
      root._x = 0; root._y = 0;
      const axisY = root._h / 2;
      let currX = root._w + 60;
      const rootChildren = children(root);
      rootChildren.forEach((milestone, idx) => {
        const isAbove = idx % 2 === 0;
        const top = isAbove ? (axisY - 60 - milestone._treeHeight) : (axisY + 60);
        horizontal(milestone, currX, top, 1);
        currX += milestone._treeWidth + 60;
      });
      this._timelineAxis = {
        startX: root._x + root._w,
        endX: Math.max(currX - 20, root._w + 120),
        y: axisY
      };
    } else if (this.layout === "fishbone") {
      const rootChildren = children(root);
      const axisY = 320; // Stable horizontal spine elevation

      // Helper to compute width required by a bone's subtree
      const calcBoneWidth = (bone) => {
        const subs = children(bone);
        if (subs.length === 0) return bone._w + 60;
        const maxSubTreeW = Math.max(...subs.map(s => s._treeWidth));
        const totalSubsH = subs.reduce((sum, s) => sum + s._treeHeight, 0) + Math.max(0, subs.length - 1) * V_GAP;
        const boneSpanY = Math.max(140, totalSubsH + 40);
        const boneDx = Math.max(80, Math.round(boneSpanY * 0.55));
        return Math.max(boneDx + bone._w + 40, boneDx + maxSubTreeW + 50);
      };

      // Pair up bones: stations along spine from left to right
      const pairCount = Math.ceil(rootChildren.length / 2);
      const stationWidths = [];
      for (let p = 0; p < pairCount; p++) {
        const upper = rootChildren[p * 2];
        const lower = rootChildren[p * 2 + 1];
        const wUpper = upper ? calcBoneWidth(upper) : 120;
        const wLower = lower ? calcBoneWidth(lower) : 120;
        stationWidths.push(Math.max(wUpper, wLower, 220));
      }

      // Calculate spine connection X for each station (from left to right)
      const stationSpineX = [];
      let accumX = 80;
      for (let p = 0; p < pairCount; p++) {
        accumX += stationWidths[p];
        stationSpineX.push(accumX);
        accumX += 100; // Comfortable spacing gap between stations
      }

      // Position Root (Fish Head) at far right
      const lastSpineX = stationSpineX.length > 0 ? stationSpineX[stationSpineX.length - 1] : 240;
      root._x = lastSpineX + 90;
      root._y = axisY - root._h / 2;

      // Position each bone and its subtrees
      rootChildren.forEach((bone, idx) => {
        const isUpper = idx % 2 === 0;
        const pairIdx = Math.floor(idx / 2);
        const spineX = stationSpineX[pairIdx] || (220 * (pairIdx + 1));

        const subs = children(bone);
        const totalSubsH = subs.reduce((sum, s) => sum + s._treeHeight, 0) + Math.max(0, subs.length - 1) * V_GAP;
        const boneSpanY = Math.max(140, totalSubsH + 40);
        const boneDx = Math.max(80, Math.round(boneSpanY * 0.55));

        const boneTipX = spineX - boneDx;
        const boneTipY = isUpper ? (axisY - boneSpanY) : (axisY + boneSpanY);

        bone._x = boneTipX - bone._w - 10;
        bone._y = isUpper ? (boneTipY - bone._h / 2) : (boneTipY - bone._h / 2);
        bone._isUpper = isUpper;
        bone._spineConnectX = spineX;
        bone._spineConnectY = axisY;
        bone._boneTipX = boneTipX;
        bone._boneTipY = boneTipY;

        // Position level 2 children and their subtrees
        if (subs.length > 0) {
          let currY = isUpper ? (boneTipY + 20) : (axisY + 30);
          subs.forEach((sub) => {
            const nodeY = currY + (sub._treeHeight - sub._h) / 2;
            const centerY = nodeY + sub._h / 2;
            const t = Math.max(0.1, Math.min(0.92, Math.abs(axisY - centerY) / boneSpanY));
            const onBoneX = spineX - t * boneDx;

            sub._x = onBoneX - 24 - sub._w;
            sub._y = nodeY;
            sub._boneConnectX = onBoneX;
            sub._boneConnectY = centerY;

            // Recursively layout level 3+ children to the left
            let subTop = currY;
            for (const deep of children(sub)) {
              horizontal(deep, sub._x - deep._w - H_GAP, subTop, -1);
              subTop += deep._treeHeight + V_GAP;
            }

            currY += sub._treeHeight + V_GAP;
          });
        }
      });

      this._fishboneAxis = {
        startX: 40,
        endX: root._x,
        y: axisY
      };
    } else horizontal(root, 0, 0);
  }

  render() {
    this.calculateLayout();
    this.container.style.backgroundColor = this.theme.backgroundColor;
    this.updateTransform();

    this.linesGroup.innerHTML = "";
    if (this.layout === "timeline" && this._timelineAxis) {
      const axisPath = this.document.createElementNS("http://www.w3.org/2000/svg", "path");
      axisPath.setAttribute("d", `M ${this._timelineAxis.startX} ${this._timelineAxis.y} H ${this._timelineAxis.endX}`);
      axisPath.setAttribute("stroke", this.theme.accentColor || "#7c3aed");
      axisPath.setAttribute("stroke-width", "3");
      axisPath.setAttribute("stroke-linecap", "round");
      this.linesGroup.appendChild(axisPath);

      for (const milestone of (this.docData.root.children || [])) {
        if (milestone._x == null) continue;
        const dot = this.document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", milestone._x + milestone._w / 2);
        dot.setAttribute("cy", this._timelineAxis.y);
        dot.setAttribute("r", "5");
        dot.setAttribute("fill", this.theme.accentColor || "#7c3aed");
        dot.setAttribute("stroke", this.theme.backgroundColor || "#ffffff");
        dot.setAttribute("stroke-width", "2");
        this.linesGroup.appendChild(dot);
      }
    } else if (this.layout === "fishbone" && this._fishboneAxis) {
      const spinePath = this.document.createElementNS("http://www.w3.org/2000/svg", "path");
      spinePath.setAttribute("d", `M ${this._fishboneAxis.startX} ${this._fishboneAxis.y} H ${this._fishboneAxis.endX}`);
      spinePath.setAttribute("stroke", this.theme.lineColor || "#7c3aed");
      spinePath.setAttribute("stroke-width", "3.5");
      spinePath.setAttribute("stroke-linecap", "round");
      this.linesGroup.appendChild(spinePath);

      // Fish Head Arrow
      const arrow = this.document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      const ay = this._fishboneAxis.y;
      const ax = this._fishboneAxis.endX;
      arrow.setAttribute("points", `${ax},${ay} ${ax - 10},${ay - 5} ${ax - 10},${ay + 5}`);
      arrow.setAttribute("fill", this.theme.lineColor || "#7c3aed");
      this.linesGroup.appendChild(arrow);
    }

    this.nodeElements = this.nodeElements || new Map();
    this.seenNodes = new Set();
    this.renderBranch(this.docData.root);
    for (const [id, element] of this.nodeElements) {
      if (!this.seenNodes.has(id)) { element.remove(); this.nodeElements.delete(id); }
    }
    this.options.onRender?.();
  }

  renderBranch(node) {
    if (!node) return;

    // Connecting lines
    if (!node.data.collapsed && node.children && node.children.length > 0) {
      node.children.forEach((child) => {
        const line = this.document.createElementNS("http://www.w3.org/2000/svg", "path");
        const leftward = child._x < node._x;
        const startX = leftward ? node._x : node._x + node._w;
        const startY = node._y + node._h / 2;
        const endX = leftward ? child._x + child._w : child._x;
        const endY = child._y + child._h / 2;
        const midX = (startX + endX) / 2;

        let d = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
        if (this.layout === "organizationStructure") {
          const sx = node._x + node._w / 2, sy = node._y + node._h;
          const ex = child._x + child._w / 2, ey = child._y, my = (sy + ey) / 2;
          d = `M ${sx} ${sy} C ${sx} ${my}, ${ex} ${my}, ${ex} ${ey}`;
        } else if (this.layout === "catalogOrganization") {
          d = `M ${node._x + 20} ${node._y + node._h} V ${endY} H ${child._x}`;
        } else if (this.layout === "timeline") {
          if (node.id === this.docData.root.id) {
            const axisY = this._timelineAxis ? this._timelineAxis.y : (node._y + node._h / 2);
            const midNodeX = child._x + child._w / 2;
            const childEdgeY = child._y > axisY ? child._y : (child._y + child._h);
            d = `M ${midNodeX} ${axisY} L ${midNodeX} ${childEdgeY}`;
          } else {
            const sx = node._x + node._w, sy = node._y + node._h / 2;
            const ex = child._x, ey = child._y + child._h / 2;
            const mx = (sx + ex) / 2;
            d = `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`;
          }
        } else if (this.layout === "fishbone") {
          if (node.id === this.docData.root.id) {
            const boneEndX = child._x + child._w;
            const boneEndY = child._y + child._h / 2;
            const spineConnectX = child._spineConnectX || (boneEndX + 80);
            const spineConnectY = child._spineConnectY || (this._fishboneAxis ? this._fishboneAxis.y : (node._y + node._h / 2));
            d = `M ${spineConnectX} ${spineConnectY} L ${boneEndX} ${boneEndY}`;
          } else if (child._boneConnectX != null) {
            d = `M ${child._boneConnectX} ${child._boneConnectY} H ${child._x + child._w}`;
          } else {
            const sx = node._x;
            const sy = node._y + node._h / 2;
            const ex = child._x + child._w;
            const ey = child._y + child._h / 2;
            const mx = (sx + ex) / 2;
            d = `M ${sx} ${sy} C ${mx} ${sy}, ${mx} ${ey}, ${ex} ${ey}`;
          }
        }
        line.setAttribute("d", d);
        line.setAttribute("fill", "none");
        line.setAttribute("stroke", this.theme.lineColor || "#7c3aed");
        line.setAttribute("stroke-width", "1.5");
        line.setAttribute("stroke-linecap", "round");
        this.linesGroup.appendChild(line);

        this.renderBranch(child);
      });
    }

    // Node Box
    const isSelected = this.selectedNodeId === node.id;
    const isRoot = node.id === this.docData.root.id;
    const rawText = node.data?.text || "Topic";
    const isCompleted = /^\[[xX]\]\s/.test(rawText);

    const signature = JSON.stringify([node.data, node._w, node._h, node._lines, isSelected, isRoot, this.theme, node.children?.length, isCompleted]);
    this.seenNodes = this.seenNodes || new Set();
    this.seenNodes.add(node.id);
    const cached = this.nodeElements ? this.nodeElements.get(node.id) : null;
    if (cached && cached._signature === signature) {
      cached._mindNode = node;
      cached.setAttribute("transform", `translate(${node._x}, ${node._y})`);
      return;
    }
    cached?.remove();
    const g = this.document.createElementNS("http://www.w3.org/2000/svg", "g");
    g._mindNode = node; g._signature = signature;
    if (isCompleted && g.classList?.add) g.classList.add("is-task-completed");
    if (this.nodeElements) this.nodeElements.set(node.id, g);
    g.setAttribute("transform", `translate(${node._x}, ${node._y})`);
    g.style.cursor = "pointer";
    g.setAttribute("data-node-id", node.id);
    const titleEl = this.document.createElementNS("http://www.w3.org/2000/svg", "title");
    titleEl.textContent = node.data.text;
    g.appendChild(titleEl);

    const rect = this.document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("width", node._w);
    rect.setAttribute("height", node._h);
    rect.setAttribute("rx", this.theme.borderRadius || 8);
    rect.setAttribute("ry", this.theme.borderRadius || 8);

    if (isRoot) {
      rect.setAttribute("fill", this.theme.accentColor || "#7c3aed");
      rect.setAttribute("stroke", isSelected ? "#ffffff" : "transparent");
      rect.setAttribute("stroke-width", isSelected ? "3" : "0");
      rect.style.filter = "drop-shadow(0 4px 12px rgba(124, 58, 237, 0.25))";
    } else {
      rect.setAttribute("fill", this.theme.nodeBackground || "#262626");
      rect.setAttribute("stroke", isSelected ? (this.theme.accentColor || "#7c3aed") : (this.theme.borderColor || "#3e3e3e"));
      rect.setAttribute("stroke-width", isSelected ? "2.5" : "1");
      if (isCompleted && !isSelected) rect.setAttribute("stroke-dasharray", "4 2");
      rect.style.filter = "drop-shadow(0 2px 6px rgba(0, 0, 0, 0.05))";
    }
    g.appendChild(rect);

    // Text element
    const textEl = this.document.createElementNS("http://www.w3.org/2000/svg", "text");
    textEl.setAttribute("x", node._w / 2);
    textEl.setAttribute("y", node._h / 2);
    textEl.setAttribute("text-anchor", "middle");
    textEl.setAttribute("dominant-baseline", "central");
    textEl.setAttribute("fill", isRoot ? "#ffffff" : this.theme.textColor);
    textEl.setAttribute("font-size", isRoot ? "14px" : "13px");
    textEl.setAttribute("font-weight", isRoot ? "600" : "450");
    textEl.setAttribute("font-family", "var(--font-interface)");

    const link = mindNodeLink(rawText, this.options.vaultName);
    textEl.setAttribute("class", "crisp-mind-node-label");
    if (this.editorNodeId === node.id) textEl.style.visibility = "hidden";
    if (isCompleted) {
      textEl.setAttribute("text-decoration", "line-through");
      textEl.style.opacity = "0.55";
    }
    if (link) {
      textEl.setAttribute("text-decoration", "underline");
      textEl.style.fill = isRoot ? "#ffffff" : this.theme.accentColor;
      textEl.style.cursor = "pointer";
      textEl.setAttribute("role", "link");
      textEl.addEventListener("click", e => {
        e.stopPropagation();
        if (this.suppressClickUntil > Date.now() || this.editor) return;
        this.options.onOpenLink?.(link.target);
      });
      g.addEventListener("click", e => {
        if ((e.metaKey || e.ctrlKey) && !(this.suppressClickUntil > Date.now())) this.options.onOpenLink?.(link.target);
      });
      g.addEventListener("mouseover", e => this.options.onHoverLink?.(e, link.target));
    }
    textEl.textContent = "";
    (node._lines || [rawText]).forEach((line, index, lines) => {
      const span = this.document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      span.setAttribute("x", node._w / 2);
      span.setAttribute("y", node._h / 2 + (index - (lines.length - 1) / 2) * 20);
      span.textContent = line;
      textEl.appendChild(span);
    });
    g.appendChild(textEl);

    // Click handler
    g.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.suppressClickUntil > Date.now()) return;
      const node = g._mindNode;
      this.selectedNodeId = node.id;
      this.container.focus({ preventScroll: true });
      // Keep the same SVG element under the pointer so native double-click survives.
      for (const element of this.nodesGroup.children) {
        const box = element.querySelector("rect");
        const selected = element.getAttribute("data-node-id") === node.id;
        const root = element.getAttribute("data-node-id") === this.docData.root.id;
        box.setAttribute("stroke", selected ? this.theme.activeBorderColor : (root ? "transparent" : this.theme.borderColor));
        box.setAttribute("stroke-width", selected ? "2.5" : (root ? "0" : "1"));
      }
      if (this.options.onSelectNode) {
        const screenX = (node._x + node._w / 2) * this.scale + this.translateX;
        const screenY = node._y * this.scale + this.translateY;
        this.options.onSelectNode(node, { x: screenX, y: screenY });
      }
    });

    // Double click to edit
    g.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      this.editNodeText(g._mindNode);
    });
    g.addEventListener("contextmenu", e => { e.preventDefault(); e.stopPropagation(); this.selectedNodeId = g._mindNode.id; this.options.onContextMenu?.(g._mindNode, e); });
    if (node.children?.length) {
      const fold = this.document.createElementNS("http://www.w3.org/2000/svg", "g");
      fold.setAttribute("data-collapse", node.id); fold.setAttribute("class", "crisp-mind-collapse");
      fold.setAttribute("role", "button"); fold.setAttribute("aria-label", node.data.collapsed ? `展开 ${node.children.length} 个子主题` : "折叠分支");

      let foldX = node._w + 13, foldY = node._h / 2;
      if (this.layout === "organizationStructure") {
        foldX = node._w / 2;
        foldY = node._h + 13;
      } else if (this.layout === "mindMap" && node.id !== this.docData.root.id) {
        const isLeftward = (node._x + node._w / 2) < (this.docData.root._x + this.docData.root._w / 2);
        if (isLeftward) foldX = -13;
      } else if (this.layout === "fishbone") {
        foldX = -13;
      }

      const circle = this.document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", foldX); circle.setAttribute("cy", foldY); circle.setAttribute("r", 10);
      circle.setAttribute("fill", this.theme.nodeBackground); circle.setAttribute("stroke", this.theme.borderColor); fold.appendChild(circle);
      const label = this.document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", foldX); label.setAttribute("y", foldY); label.setAttribute("text-anchor", "middle"); label.setAttribute("dominant-baseline", "central"); label.setAttribute("font-size", "11"); label.setAttribute("fill", this.theme.textColor);
      label.textContent = node.data.collapsed ? String(node.children.length) : "−"; fold.appendChild(label);
      fold.addEventListener("click", e => { e.stopPropagation(); this.toggleCollapse(g._mindNode.id); });
      g.appendChild(fold);
    }
    this.nodesGroup.appendChild(g);
  }

  editNodeText(node) {
    if (!node || this.options.readOnly || this.editor) return;
    const currentText = node.data?.text || "";
    const input = this.document.createElement("input");
    input.type = "text";
    input.value = currentText;
    input.className = "crisp-mind-inline-editor";

    const screenX = node._x * this.scale + this.translateX;
    const screenY = node._y * this.scale + this.translateY;

    input.style.left = `${screenX}px`;
    input.style.top = `${screenY}px`;
    input.style.width = `${Math.min(Math.max(node._w * this.scale, 180), Math.max(120, this.container.clientWidth - 24))}px`;
    input.style.left = `${Math.max(8, Math.min(screenX, this.container.clientWidth - parseFloat(input.style.width) - 8))}px`;
    input.style.top = `${Math.max(8, Math.min(screenY, this.container.clientHeight - 52))}px`;

    const labelEl = this.nodeElements?.get(node.id)?.querySelector(".crisp-mind-node-label");
    if (labelEl) labelEl.style.visibility = "hidden";
    this.editorNodeId = node.id;
    const restoreLabel = () => {
      this.editorNodeId = null;
      if (labelEl) labelEl.style.visibility = "";
      const currentLabel = this.nodeElements?.get(node.id)?.querySelector(".crisp-mind-node-label");
      if (currentLabel) currentLabel.style.visibility = "";
    };
    this.restoreEditorLabel = restoreLabel;
    this.options.onDeselect?.();
    input.setAttribute("aria-label", "节点文本");
    this.editor = input;
    this.container.appendChild(input);
    input.focus();
    input.select();

    let committed = false;
    const cleanup = () => {
      committed = true;
      restoreLabel();
      this.restoreEditorLabel = null;
      this.editor = null;
      this.commitEditor = null;
      if (input.parentNode) input.parentNode.removeChild(input);
      this.container.focus({ preventScroll: true });
    };

    const commit = (isExplicit = false) => {
      if (committed) return;
      let newText;
      try {
        newText = normalizeMindLinkText(input.value.trim() || "Topic", this.options.vaultName);
      } catch (error) {
        new Notice(error.message);
        if (isExplicit) {
          input.focus();
          return;
        }
        cleanup();
        this.render();
        return;
      }
      cleanup();
      node.data.text = newText;
      if (newText !== currentText) this.saveState();
      this.render();
    };

    this.commitEditor = () => commit(false);
    input.addEventListener("blur", () => commit(false));
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter") {
        commit(true);
      } else if (e.key === "Escape") {
        cleanup();
      }
    });
  }

  updateTransform() {
    this.options.onDeselect?.();
    this.viewportGroup.setAttribute(
      "transform",
      `translate(${this.translateX}, ${this.translateY}) scale(${this.scale})`
    );
  }

  listen(target, type, callback, options) {
    target.addEventListener(type, callback, options);
    this.disposers.push(() => target.removeEventListener(type, callback, options));
  }

  destroy() {
    this.disposers.forEach(dispose => dispose());
    this.disposers = [];
    this.isPanning = false;
    this.restoreEditorLabel?.();
    this.editor?.remove();
    this.dragHint?.remove();
    this.cancelDrag();
    this.nodeElements?.clear();
  }

  cancelDrag() {
    this.drag = null;
    this.nodesGroup?.querySelectorAll("[data-drop]").forEach(el => el.removeAttribute("data-drop"));
    if (this.dragHint) this.dragHint.style.display = "none";
  }

  async clipboardAction(action) {
    if (this.options.readOnly && action !== "copy") return;
    const id = this.selectedNodeId;
    try {
      if (action === "paste") {
        const text = await this.window.navigator.clipboard.readText();
        if (!this.pasteBranchText(text, id || this.docData.root.id)) new Notice("没有可粘贴的节点，或内容超过限制");
      } else {
        const text = this.copyBranchText(id); if (!text) return;
        await this.window.navigator.clipboard.writeText(text);
        // Await clipboard success before deleting, and don't delete a changed branch.
        if (action === "cut" && this.copyBranchText(id) === text) this.deleteNode(id);
        new Notice(action === "cut" ? "分支已剪切，可撤销" : "分支大纲已复制");
      }
    } catch (error) { new Notice(`剪贴板操作失败：${error.message}`); }
  }

  bindEvents() {
    this.listen(this.nodesGroup, "pointerdown", e => {
      if (this.options.readOnly || this.editor || e.button !== 0 || e.target.closest("[data-collapse]")) return;
      const element = e.target.closest("[data-node-id]");
      if (!element || element.dataset.nodeId === this.docData.root.id) return;
      this.drag = {id: element.dataset.nodeId, x: e.clientX, y: e.clientY, active: false};
    });
    this.listen(this.window, "pointermove", e => {
      const drag = this.drag; if (!drag) return;
      if (!drag.active && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
      drag.active = true; e.preventDefault(); this.options.onDeselect?.();
      const pane = this.container.getBoundingClientRect();
      const edge = 28;
      this.translateX += e.clientX < pane.left + edge ? 8 : e.clientX > pane.right - edge ? -8 : 0;
      this.translateY += e.clientY < pane.top + edge ? 8 : e.clientY > pane.bottom - edge ? -8 : 0;
      this.updateTransform();
      const targetEl = this.document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-node-id]");
      this.nodesGroup.querySelectorAll("[data-drop]").forEach(el => el.removeAttribute("data-drop"));
      drag.target = null;
      if (targetEl && this.nodesGroup.contains(targetEl)) {
        const target = this.findNode(targetEl.dataset.nodeId), moving = this.findNode(drag.id);
        if (target && moving && !this.findNode(target.id, moving)) {
          const box = targetEl.querySelector("rect").getBoundingClientRect();
          const ratio = (e.clientY - box.top) / box.height;
          drag.placement = target.id === this.docData.root.id ? "inside" : ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside";
          drag.target = target.id; targetEl.setAttribute("data-drop", drag.placement);
        }
      }
      if (!this.dragHint) { this.dragHint = this.document.createElement("div"); this.dragHint.className = "crisp-mind-drag-hint"; this.container.appendChild(this.dragHint); }
      this.dragHint.textContent = drag.target ? ({inside:"放入子主题",before:"插入前面",after:"插入后面"}[drag.placement]) + " · Esc 取消" : "拖到目标节点 · Esc 取消";
      this.dragHint.style.display = "block";
      this.dragHint.style.left = `${Math.max(8, Math.min(this.container.clientWidth - 200, e.clientX - pane.left + 18))}px`;
      this.dragHint.style.top = `${Math.max(8, Math.min(this.container.clientHeight - 40, e.clientY - pane.top + 18))}px`;
    });
    this.listen(this.window, "pointerup", () => {
      const drag = this.drag;
      if (drag?.active) {
        this.suppressClickUntil = Date.now() + 300;
        if (drag.target) this.moveNode(drag.id, drag.target, drag.placement);
      }
      this.cancelDrag();
    });
    this.listen(this.window, "pointercancel", () => this.cancelDrag());
    this.listen(this.window, "blur", () => { this.isPanning = false; this.cancelDrag(); });
    this.listen(this.window, "keydown", e => { if (e.key === "Escape" && this.drag) { e.preventDefault(); this.cancelDrag(); } });
    this.listen(this.container, "mousedown", (e) => {
      if (e.button === 0 && (e.target === this.svg || e.target === this.container)) {
        this.container.focus({ preventScroll: true });
        this.isPanning = true;
        this.startX = e.clientX - this.translateX;
        this.startY = e.clientY - this.translateY;
        this.selectedNodeId = null;
        this.render();
        if (this.options.onDeselect) this.options.onDeselect();
      }
    });

    this.listen(this.window, "mousemove", (e) => {
      if (!this.isPanning) return;
      this.translateX = e.clientX - this.startX;
      this.translateY = e.clientY - this.startY;
      this.updateTransform();
    });

    this.listen(this.window, "mouseup", () => {
      this.isPanning = false;
    });

    this.listen(this.container, "wheel", (e) => {
      if (this.editor || e.target.closest?.("button, input, .crisp-mind-node-island, .crisp-mind-floating-toolbar")) return;
      e.preventDefault(); e.stopPropagation();
      if (!e.ctrlKey && !e.metaKey) {
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.container.clientHeight : 1;
        this.translateX -= e.deltaX * unit; this.translateY -= e.deltaY * unit;
        this.updateTransform(); return;
      }
      const zoomFactor = Math.exp(-e.deltaY * 0.01);
      const newScale = Math.min(2.5, Math.max(0.05, this.scale * zoomFactor));

      const rect = this.container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      this.translateX = mouseX - (mouseX - this.translateX) * (newScale / this.scale);
      this.translateY = mouseY - (mouseY - this.translateY) * (newScale / this.scale);
      this.scale = newScale;

      this.updateTransform();
      if (this.options.onZoom) this.options.onZoom(this.scale);
    }, { passive: false });

    this.listen(this.container, "keydown", (e) => {
      if (e.isComposing || e.target.closest?.("input, textarea, select, button, [contenteditable=true]")) return;
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === "z" || e.key.toLowerCase() === "y")) {
        e.preventDefault();
        e.stopPropagation();
        (e.key.toLowerCase() === "y" || e.shiftKey) ? this.redo() : this.undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && ["c", "x", "v"].includes(e.key.toLowerCase())) {
        e.preventDefault(); e.stopPropagation(); void this.clipboardAction({c:"copy",x:"cut",v:"paste"}[e.key.toLowerCase()]); return;
      }
      if (e.key.startsWith("Arrow")) { e.preventDefault(); e.stopPropagation(); this.navigate(e.key); return; }
      if (!this.selectedNodeId || this.options.readOnly) return;
      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) { const parent = this.findParent(this.selectedNodeId); if (parent) this.selectNode(parent.id, true); }
        else this.addChildNode(this.selectedNodeId, true);
      } else if (e.key === "Enter") {
        e.preventDefault();
        this.addSiblingNode(this.selectedNodeId, true);
      } else if (e.key.toLowerCase() === "f" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault(); this.toggleCollapse();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        this.deleteNode(this.selectedNodeId);
      } else if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        const node = this.findNode(this.selectedNodeId);
        if (node) this.editNodeText(node);
      }
    });
  }

  resetZoom() {
    const bounds = this.getBounds();
    const width = this.container.clientWidth || 800, height = this.container.clientHeight || 600;
    this.scale = Math.max(0.05, Math.min(1.25, (width - 80) / bounds.width, (height - 160) / bounds.height));
    this.translateX = (width - bounds.width * this.scale) / 2 - bounds.x * this.scale;
    this.translateY = (height - bounds.height * this.scale) / 2 - bounds.y * this.scale;
    this.updateTransform();
    if (this.options.onZoom) this.options.onZoom(this.scale);
  }

  getBounds() {
    const nodes = [];
    const walk = n => { nodes.push(n); (n.children || []).forEach(walk); };
    this.visibleNodes().forEach(n => nodes.push(n));
    const x = Math.min(...nodes.map(n => n._x)), y = Math.min(...nodes.map(n => n._y));
    return {x, y, width: Math.max(...nodes.map(n => n._x + n._w)) - x, height: Math.max(...nodes.map(n => n._y + n._h)) - y};
  }

  exportSVG() {
    const svg = this.svg.cloneNode(true), bounds = this.getBounds();
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    svg.setAttribute("width", bounds.width + 64);
    svg.setAttribute("height", bounds.height + 64);
    svg.setAttribute("viewBox", `${bounds.x - 32} ${bounds.y - 32} ${bounds.width + 64} ${bounds.height + 64}`);
    svg.removeAttribute("class");
    svg.firstElementChild.removeAttribute("transform");

    const bgRect = this.document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bgRect.setAttribute("x", bounds.x - 32);
    bgRect.setAttribute("y", bounds.y - 32);
    bgRect.setAttribute("width", bounds.width + 64);
    bgRect.setAttribute("height", bounds.height + 64);
    const isDark = typeof document !== "undefined" && document.body?.classList?.contains
      ? document.body.classList.contains("theme-dark")
      : false;
    const bg = (this.theme.backgroundColor && this.theme.backgroundColor !== "transparent")
      ? this.theme.backgroundColor
      : (isDark ? "#1e1e2e" : "#ffffff");
    bgRect.setAttribute("fill", bg);
    svg.firstElementChild.insertBefore(bgRect, svg.firstElementChild.firstChild);

    svg.querySelectorAll("text").forEach(el => el.setAttribute("font-family", "Arial, sans-serif"));
    return svg.outerHTML;
  }
}

/* ==========================================================================
   Crisp Mind Edit View (TextFileView)
   ========================================================================== */

class CrispMindEditView extends TextFileView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.mindDoc = null;
    this.canvasController = null;
  }

  getViewType() {
    return VIEW_TYPE_CRISP_MIND;
  }

  getDisplayText() {
    return this.file ? this.file.basename : "Crisp Mind";
  }

  getIcon() {
    return CRISP_MIND_ICON_ID;
  }

  getViewData() {
    if (!this.mindDoc) return "";
    if (this.readOnly || !this.dirty) return this.originalData || "";
    return assembleMindMarkdown(this.mindDoc);
  }

  setViewData(data, clear) {
    if (this.pendingWrite === data) return;
    if (!clear && this.dirty && data !== this.originalData) {
      this.setSaveState("外部修改冲突：本地草稿已保留，请另存副本", true);
      return;
    }
    if (!clear && this.dirty && data === this.originalData) return;
    this.originalData = data;
    this.dirty = false;
    this.readOnly = !this.file?.path?.endsWith(".mind.md") && !this.file?.path?.endsWith(".mind");
    this.sourceWarning = this.readOnly ? null : inspectMindSource(data);
    if (this.sourceWarning) this.readOnly = true;
    this.saveError = null;
    // Only drop content to empty document if JSON itself is corrupt/unsafe.
    // For non-destructive warnings (like outline mismatch or extra body), keep parsed mindDoc visible in read-only mode.
    const isFatalCorrupt = this.sourceWarning && /损坏|超过安全/.test(this.sourceWarning);
    try {
      this.mindDoc = isFatalCorrupt ? parseMindMarkdown("") : parseMindMarkdown(data);
    } catch (_) {
      this.mindDoc = parseMindMarkdown("");
    }
    if (!this.canvasController) {
      this.initViewUI();
    } else {
      this.canvasController.destroy();
      this.canvasController = null;
      this.initViewUI();
    }
  }

  setSaveState(message, error = false) {
    this.saveError = error ? message : null;
    if (this.saveStatusEl) {
      this.saveStatusEl.textContent = message;
      this.saveStatusEl.classList.toggle("is-error", error);
      this.saveStatusEl.setAttribute("aria-live", error ? "assertive" : "polite");
    }
  }

  async writeSnapshot(content, reason, file = this.file) {
    const adapter = this.app.vault.adapter;
    const folder = `${this.app.vault.configDir || ".obsidian"}/plugins/crisp-mind/backups`;
    if (!(await adapter.exists(folder))) {
      try { await adapter.mkdir(folder); } catch (error) { if (!(await adapter.exists(folder))) throw error; }
    }
    const createdAt = new Date().toISOString();
    const path = `${folder}/${Date.now()}-${generateUid()}.json`;
    await adapter.write(path, JSON.stringify({version:1, sourcePath:file.path, createdAt, reason, content}));
    return path;
  }

  save() {
    // Serialise saves for this view; vault.process compares source atomically across views.
    this.saveQueue = (this.saveQueue || Promise.resolve()).then(async () => {
      if (!this.file || !this.dirty || this.readOnly || !this.mindDoc) return;
      const file = this.file, doc = this.mindDoc;
      const output = assembleMindMarkdown(doc), expected = this.originalData;
      if (output === expected) { this.dirty = false; this.setSaveState("已保存"); return; }
      this.setSaveState("保存中…");
      try {
        if (this.plugin.settings.autoBackup && this.lastSnapshotContent !== expected) {
          await this.writeSnapshot(expected, "before-save", file); this.lastSnapshotContent = expected;
        }
        this.pendingWrite = output;
        await this.app.vault.process(file, current => {
          if (current !== expected && current !== output) throw new Error("文件已被其他编辑器修改；请另存副本");
          return output;
        });
        if (this.file !== file || this.mindDoc !== doc) return;
        this.originalData = output;
        this.data = output;
        this.dirty = assembleMindMarkdown(this.mindDoc) !== output;
        this.setSaveState(this.dirty ? "待保存" : "已保存");
        if (this.dirty) this.requestSave();
      } catch (error) {
        let recovery = "";
        try { await this.writeSnapshot(output, "unsaved-draft", file); recovery = "；草稿已备份"; } catch (_) { recovery = "；备份失败，请立即另存副本"; }
        if (this.file !== file || this.mindDoc !== doc) { new Notice(`原导图保存失败${recovery}`, 8000); return; }
        this.setSaveState(`保存失败：${error.message}${recovery}`, true);
        new Notice(this.saveError, 8000);
      } finally { this.pendingWrite = null; }
    });
    return this.saveQueue;
  }

  async saveCopy(content = assembleMindMarkdown(this.mindDoc)) {
    const prefix = this.file?.parent?.path && this.file.parent.path !== "/" ? this.file.parent.path + "/" : "";
    const name = (this.file?.basename || "导图").replace(/\.mind$/, "") + " 恢复副本";
    let path = `${prefix}${name}.mind.md`, i = 2;
    while (this.app.vault.getAbstractFileByPath(path)) path = `${prefix}${name} ${i++}.mind.md`;
    try {
      const file = await this.app.vault.create(path, content);
      await this.plugin.openActiveFileAsMindMap(file);
      new Notice(`已保存副本：${path}`);
    } catch (error) { new Notice(`另存失败：${error.message}`, 8000); }
  }

  async showRecovery() {
    const folder = `${this.app.vault.configDir || ".obsidian"}/plugins/crisp-mind/backups`;
    const modal = new Modal(this.app); modal.titleEl.setText("恢复导图副本");
    modal.contentEl.createEl("p", {text:"选择快照创建独立副本。原文件保持不变。"});
    try {
      const adapter = this.app.vault.adapter;
      const entries = await adapter.exists(folder) ? (await adapter.list(folder)).files.sort().reverse() : [];
      let count = 0;
      for (const path of entries) {
        if (!path.endsWith(".json")) continue;
        let snapshot; try { snapshot = JSON.parse(await adapter.read(path)); } catch (_) { continue; }
        if (snapshot.sourcePath !== this.file?.path || typeof snapshot.content !== "string") continue;
        if (inspectMindSource(snapshot.content)) continue;
        const row = modal.contentEl.createDiv({cls:"crisp-mind-recovery-row"});
        row.createSpan({text: `${new Date(snapshot.createdAt).toLocaleString()} · ${snapshot.reason === "unsaved-draft" ? "未保存草稿" : "保存前快照"}`});
        row.createEl("button", {text:"恢复副本"}).addEventListener("click", () => { void this.saveCopy(snapshot.content); modal.close(); });
        if (++count >= 30) break;
      }
      if (!count) modal.contentEl.createEl("p", {text:"此文件暂无可恢复快照。"});
    } catch (error) { modal.contentEl.createEl("p", {text:`读取快照失败：${error.message}`}); }
    modal.open();
  }

  clear() {
    this.mindDoc = null;
    this.dirty = false;
    this.sourceWarning = null;
    if (this.canvasController) {
      this.canvasController.destroy();
      this.contentEl.innerHTML = "";
      this.canvasController = null;
    }
  }

  async onClose() {
    this.canvasController?.commitEditor?.();
    await this.save();
    this.canvasController?.destroy();
    await super.onClose();
  }

  initViewUI() {
    this.contentEl.innerHTML = "";
    this.contentEl.style.padding = "0";

    const container = this.contentEl.createDiv({ cls: "crisp-mind-view" });
    this.viewContainer = container;

    // Canvas Engine instance first
    this.canvasController = new CrispMindCanvas(container, this.mindDoc.data, {
      readOnly: this.readOnly,
      vaultName: this.app.vault.getName(),
      onChange: () => {
        if (this.readOnly) return;
        this.dirty = true;
        this.setSaveState("待保存");
        this.requestSave();
        this.notifyPulseContribution();
      },
      onContextMenu: (node, event) => this.showNodeMenu(node, event),
      onSelectNode: (node, screenCoord) => {
        this.renderNodeIsland(node, screenCoord);
      },
      onDeselect: () => {
        if (this.islandEl) this.islandEl.style.display = "none";
      },
      onZoom: (scale) => {
        if (this.zoomBadge) {
          this.zoomBadge.textContent = `${Math.round(scale * 100)}%`;
        }
      },
      onOpenLink: (linkTarget) => {
        void this.openLinkedNote(linkTarget);
      },
      onHoverLink: (e, linkTarget) => {
        this.app.workspace.trigger("hover-link", {
          event: e,
          source: VIEW_TYPE_CRISP_MIND,
          hoverParent: this.contentEl,
          targetEl: e.target,
          linktext: linkTarget
        });
      }
    });

    // Floating Pill Toolbar (mounted after canvas)
    this.toolbarEl = container.createDiv({
      cls: `crisp-mind-floating-toolbar ${this.plugin.settings.toolbarPosition === "top" ? "toolbar-top" : ""}`
    });

    // Action Island
    this.islandEl = container.createDiv({ cls: "crisp-mind-node-island" });
    this.islandEl.style.display = "none";

    this.renderToolbar();
    this.saveStatusEl = container.createDiv({cls:"crisp-mind-save-status"});
    this.saveStatusEl.setAttribute("role", "status");
    this.setSaveState(this.sourceWarning || (this.readOnly ? "只读大纲预览" : "已保存"), !!this.sourceWarning);
    if (this.readOnly) {
      const hint = container.createDiv({cls: "crisp-mind-hint"});
      hint.textContent = "大纲预览 · 原笔记保持不变";
    }
    this.canvasController.resetZoom();
  }

  showInteractionHelp() {
    const modal = new Modal(this.app);
    modal.titleEl.setText("导图操作帮助");
    for (const [action, keys] of [
      ["添加子主题", "Tab"], ["添加同级主题", "Enter"],
      ["编辑节点", "双击或空格"], ["折叠 / 展开", "F 或节点旁按钮"],
      ["移动选择", "方向键；Shift + Tab 回到父节点"],
      ["复制 / 剪切 / 粘贴分支", "⌘ / Ctrl + C、X、V"],
      ["撤销 / 重做", "⌘ / Ctrl + Z、Shift + Z"],
      ["调整层级与顺序", "拖到节点中部成为子主题；上部 / 下部插入同级"],
      ["平移画布", "滚动或拖拽空白处"],
      ["缩放画布", "触控板捏合或 ⌘ / Ctrl + 滚动"],
      ["取消编辑或拖拽", "Esc"]
    ]) {
      const row = modal.contentEl.createDiv({cls: "crisp-mind-help-row"});
      row.createSpan({text: action}); row.createSpan({text: keys});
    }
    modal.open();
  }

  renderToolbar() {
    this.toolbarEl.innerHTML = "";

    // Zoom badge
    this.zoomBadge = this.toolbarEl.createEl("button", { cls: "crisp-mind-zoom-badge", text: "100%", attr: {"aria-label": "适应画布"} });
    this.zoomBadge.addEventListener("click", () => this.canvasController.resetZoom());

    this.createToolbarDivider();

    this.createToolbarButton("maximize", "适应画布", () => this.canvasController.resetZoom());
    if (!this.readOnly) {
    this.createToolbarButton("undo-2", "撤销 (⌘Z)", () => this.canvasController.undo());
    this.createToolbarButton("redo-2", "重做 (⌘⇧Z)", () => this.canvasController.redo());
    // Add Child (Tab)
    this.createToolbarButton("plus-circle", "添加子主题 (Tab)", () => {
      this.canvasController.addChildNode();
    });

    // Add Sibling (Enter)
    this.createToolbarButton("list-plus", "添加同级主题 (Enter)", () => {
      this.canvasController.addSiblingNode();
    });

    // Delete Node (Del)
    this.createToolbarButton("trash-2", "删除节点 (Del)", () => {
      this.canvasController.deleteNode();
    });

    this.createToolbarDivider();

    }
    // Layout Switcher
    this.createToolbarButton("layout-grid", "切换布局（切换后可点击适应画布）", (e) => {
      const menu = new Menu();
      menu.addItem((i) => i.setTitle("逻辑结构图 (从左向右)").onClick(() => this.canvasController.setLayout("logicalStructure")));
      menu.addItem((i) => i.setTitle("经典思维导图 (双向发散)").onClick(() => this.canvasController.setLayout("mindMap")));
      menu.addItem((i) => i.setTitle("组织架构图 (自顶向下)").onClick(() => this.canvasController.setLayout("organizationStructure")));
      menu.addItem((i) => i.setTitle("目录组织图 (大纲树)").onClick(() => this.canvasController.setLayout("catalogOrganization")));
      menu.addItem((i) => i.setTitle("水平时间轴 (Timeline)").onClick(() => this.canvasController.setLayout("timeline")));
      menu.addItem((i) => i.setTitle("因果鱼骨图 (Fishbone)").onClick(() => this.canvasController.setLayout("fishbone")));
      menu.showAtMouseEvent(e);
    });

    // Theme Switcher
    this.createToolbarButton("palette", "切换 Crisp 质感调色盘", (e) => {
      const menu = new Menu();
      menu.addItem((i) => i.setTitle("Crisp Obsidian (系统自适应)").onClick(() => this.canvasController.setTheme("crisp-obsidian")));
      menu.addItem((i) => i.setTitle("Crisp Cupertino (经典灰蓝)").onClick(() => this.canvasController.setTheme("crisp-cupertino")));
      menu.addItem((i) => i.setTitle("Crisp Nord (极光深暗)").onClick(() => this.canvasController.setTheme("crisp-nord")));
      menu.addItem((i) => i.setTitle("Crisp Mono Editorial (当代编辑)").onClick(() => this.canvasController.setTheme("crisp-mono")));
      menu.addItem((i) => i.setTitle("Crisp Amber (温暖羊皮纸)").onClick(() => this.canvasController.setTheme("crisp-amber")));
      menu.showAtMouseEvent(e);
    });

    this.createToolbarDivider();

    // Extract to ANKS Topic Note
    if (!this.readOnly) this.createToolbarButton("external-link", "提取分支为同目录独立笔记", () => {
      this.extractCurrentNodeToTopic();
    });

    this.createToolbarButton("history", "快照与恢复", () => { void this.showRecovery(); });
    if (!this.readOnly) this.createToolbarButton("save", "保存 / 冲突处理", (e) => {
      const menu = new Menu();
      menu.addItem(i => i.setTitle("立即保存 / 重试").onClick(() => { void this.save(); }));
      menu.addItem(i => i.setTitle("另存为独立副本").onClick(() => { void this.saveCopy(); }));
      menu.showAtMouseEvent(e);
    });
    // Export Modal Trigger
    this.createToolbarButton("download", "导出思维导图 (PNG / PDF / SVG)", () => {
      new CrispMindExportModal(this.app, this).open();
    });

    // Operation Help & Shortcuts Modal Trigger
    this.createToolbarButton("help-circle", "导图快捷键与操作帮助", () => {
      this.showInteractionHelp();
    });
  }

  createToolbarButton(iconName, tooltip, onClick) {
    const btn = this.toolbarEl.createEl("button", { cls: "crisp-mind-btn" });
    setIcon(btn, iconName);
    btn.setAttribute("aria-label", tooltip);
    btn.addEventListener("click", onClick);
    return btn;
  }

  createToolbarDivider() {
    this.toolbarEl.createDiv({ cls: "crisp-mind-divider" });
  }

  showNodeMenu(node, event) {
    if (this.readOnly) return;
    const c = this.canvasController; c.selectedNodeId = node.id;
    const menu = new Menu();
    menu.addItem(i => i.setTitle("编辑文本").setIcon("pencil").onClick(() => c.editNodeText(c.findNode(node.id))));
    menu.addItem(i => i.setTitle("添加子主题 · Tab").setIcon("plus").onClick(() => c.addChildNode(node.id)));
    menu.addItem(i => i.setTitle("添加同级主题 · Enter").onClick(() => c.addSiblingNode(node.id)));
    if (node.children?.length) menu.addItem(i => i.setTitle(node.data.collapsed ? "展开分支 · F" : "折叠分支 · F").onClick(() => c.toggleCollapse(node.id)));
    menu.addItem(i => i.setTitle("设置 / 更换笔记链接").setIcon("link").onClick(() => this.editNodeLink(node.id)));
    menu.addSeparator();
    menu.addItem(i => i.setTitle("复制分支 · ⌘C").onClick(() => { void c.clipboardAction("copy"); }));
    if (node.id !== c.docData.root.id) menu.addItem(i => i.setTitle("剪切分支 · ⌘X").onClick(() => { void c.clipboardAction("cut"); }));
    menu.addItem(i => i.setTitle("粘贴为子主题 · ⌘V").onClick(() => { void c.clipboardAction("paste"); }));
    menu.addSeparator();
    if (node.id !== c.docData.root.id) menu.addItem(i => i.setTitle("删除分支 · 可撤销").setIcon("trash-2").onClick(() => c.deleteNode(node.id)));
    menu.showAtMouseEvent(event);
  }

  renderNodeIsland(node, screenCoord) {
    if (this.readOnly) return;
    this.islandEl.innerHTML = "";
    this.islandEl.style.display = "inline-flex";

    // Quick Add Child (+)
    const addChildBtn = this.islandEl.createEl("button", { cls: "crisp-mind-island-btn" });
    setIcon(addChildBtn.createSpan({ cls: "crisp-mind-action-icon" }), "plus");
    addChildBtn.createSpan({ text: "子主题" });
    addChildBtn.setAttribute("aria-label", "添加子主题 (Tab)");
    addChildBtn.addEventListener("click", () => {
      this.canvasController.addChildNode(node.id, true);
    });

    // Quick Add Sibling (Enter)
    if (node.id !== this.canvasController.docData.root.id) {
      const addSiblingBtn = this.islandEl.createEl("button", { cls: "crisp-mind-island-btn" });
      setIcon(addSiblingBtn.createSpan({ cls: "crisp-mind-action-icon" }), "corner-down-left");
      addSiblingBtn.createSpan({ text: "同级" });
      addSiblingBtn.setAttribute("aria-label", "添加同级主题 (Enter)");
      addSiblingBtn.addEventListener("click", () => {
        this.canvasController.addSiblingNode(node.id, true);
      });
    }

    // Toggle Todo [ ] / [x]
    const todoBtn = this.islandEl.createEl("button", { cls: "crisp-mind-island-btn" });
    const updateTodoButtonState = () => {
      const isDone = /^\[x\]\s/i.test(node.data.text);
      todoBtn.innerHTML = "";
      setIcon(todoBtn.createSpan({ cls: "crisp-mind-action-icon" }), isDone ? "square-check" : "square");
      todoBtn.createSpan({ text: isDone ? "已完成" : "待办" });
      todoBtn.setAttribute("aria-pressed", String(isDone));
      todoBtn.setAttribute("aria-label", isDone ? "标记为未完成" : "标记为已完成");
    };
    updateTodoButtonState();
    todoBtn.addEventListener("click", () => {
      if (/^\[x\]\s*/i.test(node.data.text)) {
        node.data.text = node.data.text.replace(/^\[x\]\s*/i, "[ ] ");
      } else if (/^\[ \]\s*/.test(node.data.text)) {
        node.data.text = node.data.text.replace(/^\[ \]\s*/, "[x] ");
      } else {
        node.data.text = `[ ] ${node.data.text}`;
      }
      updateTodoButtonState();
      this.canvasController.render();
      this.canvasController.saveState();
    });

    // Add Wikilink [[
    const linkBtn = this.islandEl.createEl("button", { cls: "crisp-mind-island-btn" });
    setIcon(linkBtn.createSpan({ cls: "crisp-mind-action-icon" }), "link");
    const link = mindNodeLink(node.data.text, this.app.vault.getName());
    linkBtn.createSpan({ text: link ? "打开笔记" : "链接" });
    linkBtn.setAttribute("aria-label", link ? `打开 ${link.target}` : "链接到笔记：搜索或粘贴 Obsidian 地址");
    linkBtn.addEventListener("click", () => {
      if (link) this.canvasController.options.onOpenLink(link.target);
      else this.editNodeLink(node.id);
    });

    // Quick Edit
    const editBtn = this.islandEl.createEl("button", { cls: "crisp-mind-island-btn" });
    setIcon(editBtn.createSpan({ cls: "crisp-mind-action-icon" }), "pencil");
    editBtn.createSpan({ text: "编辑" });
    editBtn.setAttribute("aria-label", "编辑文本 (Space)");
    editBtn.addEventListener("click", () => {
      this.canvasController.editNodeText(node);
    });

    const moreBtn = this.islandEl.createEl("button", { cls: "crisp-mind-island-btn", text: "更多" });
    moreBtn.setAttribute("aria-label", "分支操作：折叠、复制、粘贴、删除");
    moreBtn.addEventListener("click", e => this.showNodeMenu(this.canvasController.findNode(node.id), e));

    // Measure after labels are mounted; keep the entire toolbar inside its pane.
    const width = this.islandEl.offsetWidth || 340;
    const height = this.islandEl.offsetHeight || 36;
    const paneWidth = this.viewContainer.clientWidth;
    const paneHeight = this.viewContainer.clientHeight;
    let top = screenCoord.y - height - 10;
    if (top < 8) {
      top = screenCoord.y + ((node._h || 40) * this.canvasController.scale) + 10;
    }
    this.islandEl.style.left = `${Math.max(8, Math.min(paneWidth - width - 8, screenCoord.x - width / 2))}px`;
    this.islandEl.style.top = `${Math.max(8, Math.min(paneHeight - height - 8, top))}px`;
  }

  async openLinkedNote(target) {
    try {
      const hash = target.indexOf("#");
      const path = hash < 0 ? target : target.slice(0, hash);
      const file = this.app.metadataCache.getFirstLinkpathDest(path, this.file?.path || "");
      if (!file) { new Notice("找不到链接的笔记，请检查路径或重新设置链接"); return; }
      const leaf = this.app.workspace.getLeaf("tab");
      await leaf.openFile(file, {active: true, eState: hash < 0 ? {} : {subpath: target.slice(hash)}});
      await this.app.workspace.revealLeaf(leaf);
    } catch (error) { new Notice(`无法打开笔记：${error.message}`); }
  }

  editNodeLink(id) {
    this.promptWikilink(link => {
      const c = this.canvasController;
      c.transact(() => {
        const node = c.findNode(id); if (!node) return false;
        const previous = normalizeMindLinkText(node.data.text, this.app.vault.getName());
        node.data.text = /\[\[[^\]]+\]\]/.test(previous) ? previous.replace(/\[\[[^\]]+\]\]/, () => link) : `${previous} ${link}`;
      });
    });
  }

  promptWikilink(callback) {
    const modal = new Modal(this.app);
    modal.titleEl.setText("链接到笔记");
    modal.contentEl.createEl("p", {text:"选择当前仓库的笔记，或粘贴 obsidian://open 地址。添加后，点击节点下划线文字即可在新标签页打开。"});
    let value = "";
    new Setting(modal.contentEl).setName("笔记路径或 Obsidian 地址").addText(text => {
      text.setPlaceholder("obsidian://open?vault=…&file=…").onChange(input => value = input);
      text.inputEl.style.width = "100%";
    });
    const errorEl = modal.contentEl.createDiv({cls:"crisp-mind-link-error"}); errorEl.setAttribute("role", "alert");
    const apply = () => {
      try {
        let link = normalizeMindLinkText(value.trim(), this.app.vault.getName());
        if (!link) throw Error("请先输入地址或选择笔记");
        const target = mindNodeLink(link)?.target || link;
        const file = this.app.metadataCache.getFirstLinkpathDest(target.split("#")[0], this.file?.path || "");
        if (!file) throw Error("当前仓库找不到该笔记，请检查路径");
        if (!mindNodeLink(link)) link = `[[${target.replace(/\.md$/i, "")}|${file.basename}]]`;
        callback(link); modal.close();
      } catch (error) { errorEl.textContent = error.message; }
    };
    new Setting(modal.contentEl)
      .addButton(button => button.setButtonText("搜索笔记").onClick(() => {
        const owner = this;
        const picker = new (class extends FuzzySuggestModal {
          getItems() { return owner.app.vault.getMarkdownFiles(); }
          getItemText(file) { return file.path; }
          onChooseItem(file) { callback(`[[${file.path.replace(/\.md$/i, "")}|${file.basename}]]`); modal.close(); }
        })(this.app);
        picker.setPlaceholder("搜索笔记名称或路径"); picker.open();
      }))
      .addButton(button => button.setButtonText("添加链接").setCta().onClick(apply));
    modal.open();
  }

  async extractCurrentNodeToTopic() {
    const selectedId = this.canvasController.selectedNodeId;
    if (!selectedId) {
      new Notice("请先选中要提炼的分支节点");
      return;
    }
    const node = this.canvasController.findNode(selectedId);
    if (!node) return;

    const { title, content } = extractNodeToTopicContent(node);
    const folder = this.file?.parent?.path || "";
    const safeTitle = title.replace(/[\\/:*?"<>|#^\[\]\r\n]/g, " ").trim().slice(0, 120) || "未命名主题";
    const prefix = folder && folder !== "/" ? `${folder}/` : "";
    let targetPath = `${prefix}${safeTitle}.md`, suffix = 2;
    while (this.app.vault.getAbstractFileByPath(targetPath)) targetPath = `${prefix}${safeTitle} ${suffix++}.md`;

    try {
      const file = await this.app.vault.create(targetPath, content);
      node.data.text = this.app.fileManager.generateMarkdownLink(file, this.file.path);
      this.canvasController.render();
      this.canvasController.saveState();
      new Notice(`已成功提炼并沉淀为笔记：${targetPath}`);
    } catch (e) {
      new Notice(`提炼失败：${e.message}`);
    }
  }

  notifyPulseContribution() {
    if (!this.plugin.settings.enablePulseSync) return;
    try {
      const pulse = this.app.plugins?.plugins?.["crisp-pulse"];
      if (pulse && typeof pulse.trackActivity === "function") {
        pulse.trackActivity({ type: "mindmap", file: this.file?.path });
      }
    } catch (e) {}
  }
}

/* ==========================================================================
   Crisp Mind Exporter Subsystem (Zero-Dependency Retina PNG, PDF & SVG)
   ========================================================================== */

class CrispMindExporter {
  constructor(view) {
    this.view = view;
    this.controller = view?.canvasController;
  }

  getBoundingBox(padding = 40) {
    const root = this.controller?.docData?.root;
    if (!root) return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 880, height: 680, viewBox: "-40 -40 880 680", padding };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const walk = (node) => {
      if (!node) return;
      if (node._x != null && node._y != null) {
        minX = Math.min(minX, node._x);
        minY = Math.min(minY, node._y);
        maxX = Math.max(maxX, node._x + (node._w || 120));
        maxY = Math.max(maxY, node._y + (node._h || 40));
      }
      if (!node.data?.collapsed && node.children) {
        node.children.forEach(walk);
      }
    };
    walk(root);

    if (this.controller?.layout === "timeline" && this.controller._timelineAxis) {
      minX = Math.min(minX, this.controller._timelineAxis.startX);
      maxX = Math.max(maxX, this.controller._timelineAxis.endX);
      minY = Math.min(minY, this.controller._timelineAxis.y - 20);
      maxY = Math.max(maxY, this.controller._timelineAxis.y + 20);
    } else if (this.controller?.layout === "fishbone" && this.controller._fishboneAxis) {
      minX = Math.min(minX, this.controller._fishboneAxis.startX);
      maxX = Math.max(maxX, this.controller._fishboneAxis.endX);
      minY = Math.min(minY, this.controller._fishboneAxis.y - 20);
      maxY = Math.max(maxY, this.controller._fishboneAxis.y + 20);
    }

    if (!isFinite(minX)) {
      minX = 0; minY = 0; maxX = 800; maxY = 600;
    }

    const width = Math.ceil(maxX - minX + padding * 2);
    const height = Math.ceil(maxY - minY + padding * 2);
    const viewBox = `${Math.floor(minX - padding)} ${Math.floor(minY - padding)} ${width} ${height}`;
    return { minX, minY, maxX, maxY, width, height, viewBox, padding };
  }

  toSvg({ padding = 40, transparent = false } = {}) {
    const bbox = this.getBoundingBox(padding);
    const theme = this.controller?.theme || {};

    const linesHtml = this.controller?.linesGroup?.innerHTML || "";
    const nodesHtml = this.controller?.nodesGroup?.innerHTML || "";

    const bgRect = transparent
      ? ""
      : `<rect x="${bbox.minX - bbox.padding}" y="${bbox.minY - bbox.padding}" width="${bbox.width}" height="${bbox.height}" fill="${theme.backgroundColor || '#1e1e2e'}" />`;

    const svgString = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${bbox.viewBox}" width="${bbox.width}" height="${bbox.height}">
  <defs>
    <style>
      text { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
      .crisp-mind-node-label { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; }
      .is-task-completed { opacity: 0.55; }
    </style>
  </defs>
  ${bgRect}
  <g class="crisp-mind-export-lines">${linesHtml}</g>
  <g class="crisp-mind-export-nodes">${nodesHtml}</g>
</svg>`;

    return {
      svgString,
      width: bbox.width,
      height: bbox.height,
      bbox
    };
  }

  async toPng({ scale = 2, transparent = false, padding = 40 } = {}) {
    const { svgString, width, height } = this.toSvg({ padding, transparent });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");

    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    await new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve();
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(url);
        reject(new Error("SVG 渲染失败：" + err));
      };
      img.src = url;
    });

    const dataUrl = canvas.toDataURL("image/png");
    const arrayBuffer = await (await fetch(dataUrl)).arrayBuffer();
    return { dataUrl, arrayBuffer, width: canvas.width, height: canvas.height };
  }

  async toPdf({ padding = 40 } = {}) {
    const { svgString, width, height } = this.toSvg({ padding, transparent: false });
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = this.controller?.theme?.backgroundColor || "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const img = new Image();
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    await new Promise((resolve, reject) => {
      img.onload = () => {
        try {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          URL.revokeObjectURL(url);
          resolve();
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("SVG 转 PDF 栅格化失败"));
      };
      img.src = url;
    });

    const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.95);
    const base64Data = jpegDataUrl.replace(/^data:image\/jpeg;base64,/, "");
    const binaryJpeg = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    const ptWidth = Math.round(width * 0.75);
    const ptHeight = Math.round(height * 0.75);
    const arrayBuffer = CrispMindExporter.buildPdfBinary(binaryJpeg, canvas.width, canvas.height, ptWidth, ptHeight);
    return { arrayBuffer, ptWidth, ptHeight };
  }

  static buildPdfBinary(jpegBytes, imgPixelW, imgPixelH, ptWidth, ptHeight) {
    const Encoder = typeof TextEncoder !== "undefined" ? TextEncoder : (typeof globalThis !== "undefined" && globalThis.TextEncoder ? globalThis.TextEncoder : require("util").TextEncoder);
    const encoder = new Encoder();
    const chunks = [];
    const offsets = [];
    let currentOffset = 0;

    function writeStr(str) {
      const bytes = encoder.encode(str);
      chunks.push(bytes);
      currentOffset += bytes.length;
    }

    function writeBytes(bytes) {
      chunks.push(bytes);
      currentOffset += bytes.length;
    }

    writeStr("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");

    offsets.push(currentOffset);
    writeStr("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

    offsets.push(currentOffset);
    writeStr("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

    offsets.push(currentOffset);
    writeStr(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptWidth} ${ptHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`);

    offsets.push(currentOffset);
    writeStr(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgPixelW} /Height ${imgPixelH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`);
    writeBytes(jpegBytes);
    writeStr("\nendstream\nendobj\n");

    offsets.push(currentOffset);
    const content = `q\n${ptWidth} 0 0 ${ptHeight} 0 0 cm\n/Im0 Do\nQ\n`;
    writeStr(`5 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);

    const xrefOffset = currentOffset;
    writeStr(`xref\n0 6\n0000000000 65535 f \n`);
    for (const off of offsets) {
      writeStr(String(off).padStart(10, "0") + " 00000 n \n");
    }

    writeStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

    const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
    const out = new Uint8Array(totalLen);
    let pos = 0;
    for (const chunk of chunks) {
      out.set(chunk, pos);
      pos += chunk.length;
    }
    return out.buffer;
  }
}

class CrispMindExportModal extends Modal {
  constructor(app, view) {
    super(app);
    this.view = view;
    this.exporter = new CrispMindExporter(view);
    this.selectedFormat = "png"; // png | pdf | svg
    this.scale = 2;              // 1 | 2 | 3
    this.transparent = false;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.classList.add("crisp-mind-export-modal");

    contentEl.createEl("h3", { text: "导出思维导图", cls: "crisp-mind-modal__title" });
    contentEl.createEl("p", { cls: "crisp-mind-modal__desc", text: "选择导出格式与质量，直接保存到笔记库目录或下载到本地。" });

    const formatSetting = new Setting(contentEl)
      .setName("导出格式")
      .setDesc("支持高清位图图片、矢量排版文档或矢量图形代码。")
      .addDropdown(dd => {
        dd.addOption("png", "PNG 高清图片 (位图)")
          .addOption("pdf", "PDF 排版文档 (打印/阅读)")
          .addOption("svg", "SVG 矢量图形 (无损/设计)")
          .setValue(this.selectedFormat)
          .onChange(val => {
            this.selectedFormat = val;
            scaleSetting.settingEl.style.display = val === "png" ? "flex" : "none";
            transSetting.settingEl.style.display = val === "png" || val === "svg" ? "flex" : "none";
          });
      });

    const scaleSetting = new Setting(contentEl)
      .setName("渲染分辨率")
      .setDesc("输出图片的分辨率倍率。推荐 2x 兼顾锐利清晰与文件体积。")
      .addDropdown(dd => {
        dd.addOption("1", "1x (标清)")
          .addOption("2", "2x (高清 Retina 推荐)")
          .addOption("3", "3x (超清印刷级)")
          .setValue(String(this.scale))
          .onChange(val => { this.scale = Number(val); });
      });

    const transSetting = new Setting(contentEl)
      .setName("透明背景")
      .setDesc("导出为无背景透明图，便于贴入 Keynote、Notion 或公众号小红书排版。")
      .addToggle(toggle => {
        toggle.setValue(this.transparent).onChange(val => { this.transparent = val; });
      });

    const btnContainer = contentEl.createDiv({ cls: "crisp-mind-modal__actions" });

    const saveVaultBtn = btnContainer.createEl("button", { cls: "mod-cta", text: "保存至笔记库目录" });
    saveVaultBtn.addEventListener("click", async () => {
      saveVaultBtn.disabled = true;
      saveVaultBtn.textContent = "正在生成…";
      try {
        await this.handleExport("vault");
        this.close();
      } catch (err) {
        new Notice("导出失败：" + err.message);
        saveVaultBtn.disabled = false;
        saveVaultBtn.textContent = "保存至笔记库目录";
      }
    });

    const downloadBtn = btnContainer.createEl("button", { text: "直接下载到本地" });
    downloadBtn.addEventListener("click", async () => {
      downloadBtn.disabled = true;
      downloadBtn.textContent = "正在生成…";
      try {
        await this.handleExport("download");
        this.close();
      } catch (err) {
        new Notice("导出失败：" + err.message);
        downloadBtn.disabled = false;
        downloadBtn.textContent = "直接下载到本地";
      }
    });
  }

  async handleExport(destination) {
    const format = this.selectedFormat;
    const baseName = this.view.file ? this.view.file.basename : "crisp-mindmap";
    const fileName = `${baseName}.${format}`;
    let dataBuffer;
    let mimeType = "application/octet-stream";

    if (format === "png") {
      mimeType = "image/png";
      const res = await this.exporter.toPng({ scale: this.scale, transparent: this.transparent });
      dataBuffer = res.arrayBuffer;
    } else if (format === "pdf") {
      mimeType = "application/pdf";
      const res = await this.exporter.toPdf();
      dataBuffer = res.arrayBuffer;
    } else if (format === "svg") {
      mimeType = "image/svg+xml";
      const res = this.exporter.toSvg({ transparent: this.transparent });
      dataBuffer = new TextEncoder().encode(res.svgString).buffer;
    }

    if (destination === "vault") {
      const parentPath = this.view.file?.parent?.path || "";
      const targetPath = parentPath ? `${parentPath}/${fileName}` : fileName;
      const ab = dataBuffer instanceof ArrayBuffer ? dataBuffer : dataBuffer.buffer;
      await this.app.vault.adapter.writeBinary(targetPath, ab);
      new Notice(`导图已成功导出至：${targetPath}`);
    } else {
      const blob = new Blob([dataBuffer], { type: mimeType });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
      new Notice(`已开始下载：${fileName}`);
    }
  }

  onClose() {
    this.contentEl.empty();
  }
}

/* ==========================================================================
   Crisp Mind Plugin Main
   ========================================================================== */

class CrispMindPlugin extends Plugin {
  async onload() {
    await this.loadSettings();

    this.licenseManager = new CrispMindLicenseManager(this.app, this.settings);

    if (!this.settings.licenseCode) {
      const vaultLicense = discoverVaultCrispLicense(this.app);
      if (vaultLicense) {
        this.settings.licenseCode = vaultLicense;
        await this.saveSettings();
        console.log("Crisp Mind: 自动继承 Vault 中已激活的 Crisp Suite 授权");
      }
    }

    if (this.settings.licenseCode) {
      void this.licenseManager.validateCurrentLicense();
    }

    try {
      addIcon(CRISP_MIND_ICON_ID, CRISP_MIND_SVG);
      addIcon("crisp-mind-logo", CRISP_MIND_SVG);
    } catch (e) {
      console.warn("[Crisp Mind] 无法注册自定义图标:", e);
    }

    this.registerView(VIEW_TYPE_CRISP_MIND, (leaf) => new CrispMindEditView(leaf, this));

    try {
      this.registerExtensions(["mind"], VIEW_TYPE_CRISP_MIND);
    } catch (e) {}

    this.addRibbonIcon(CRISP_MIND_ICON_ID, "新建 Crisp Mind 思维导图", () => {
      this.createNewMindMap();
    });

    this.addCommand({
      id: "create-crisp-mind",
      name: "新建思维导图 (Create Crisp Mind)",
      callback: () => this.createNewMindMap()
    });

    this.addCommand({
      id: "open-as-crisp-mind",
      name: "以思维导图视图打开当前大纲笔记",
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        if (file && file.extension === "md") {
          if (!checking) {
            this.openActiveFileAsMindMap(file);
          }
          return true;
        }
        return false;
      }
    });

    this.registerEvent(
      this.app.workspace.on("css-change", () => {
        this.app.workspace.getLeavesOfType(VIEW_TYPE_CRISP_MIND).forEach((leaf) => {
          if (leaf.view?.canvasController) {
            leaf.view.canvasController.theme = getComputedThemeConfig(leaf.view.canvasController.docData.theme || "crisp-obsidian");
            leaf.view.canvasController.render();
          }
        });
      })
    );

    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        if (!file || !file.path?.endsWith(".mind.md")) return;
        const leaves = this.app.workspace.getLeavesOfType("markdown");
        for (const leaf of leaves) {
          if (leaf.view?.file?.path === file.path) {
            leaf.setViewState({
              type: VIEW_TYPE_CRISP_MIND,
              state: { file: file.path }
            });
            break;
          }
        }
      })
    );

    this.registerEvent(this.app.workspace.on("file-menu", (menu, file) => {
      if (file instanceof TFile && ["md", "mind"].includes(file.extension)) {
        menu.addItem(item => item.setTitle("用 Crisp Mind 打开").setIcon(CRISP_MIND_ICON_ID).onClick(() => this.openActiveFileAsMindMap(file)));
      }
    }));
    this.addSettingTab(new CrispMindSettingTab(this.app, this));
  }

  async createNewMindMap(folderPath = "") {
    const fileName = `未命名思维导图 ${new Date().toISOString().slice(0, 10)}.mind.md`;
    const basePath = folderPath ? `${folderPath}/${fileName}` : fileName;
    let fullPath = basePath, suffix = 2;
    while (this.app.vault.getAbstractFileByPath(fullPath)) fullPath = basePath.replace(/\.mind\.md$/, ` ${suffix++}.mind.md`);

    const defaultRoot = {
      id: generateUid(),
      data: { text: "中心主题" },
      children: [
        { id: generateUid(), data: { text: "主要分支 1" }, children: [] },
        { id: generateUid(), data: { text: "主要分支 2" }, children: [] }
      ]
    };

    const initialDoc = {
      title: "中心主题",
      frontmatter: "crisp-mind: true\n",
      data: {
        version: "1.0",
        layout: this.settings.defaultLayout,
        theme: this.settings.defaultTheme,
        root: defaultRoot
      }
    };

    const content = assembleMindMarkdown(initialDoc);
    const newFile = await this.app.vault.create(fullPath, content);
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({ type: VIEW_TYPE_CRISP_MIND, state: {file: newFile.path} });
    await this.app.workspace.revealLeaf(leaf);
    leaf.view.canvasController?.resetZoom();
  }

  async openActiveFileAsMindMap(file) {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_CRISP_MIND).find(leaf => leaf.view.file?.path === file.path);
    if (existing) { await this.app.workspace.revealLeaf(existing); return; }
    const leaf = this.app.workspace.getLeaf(true);
    await leaf.setViewState({
      type: VIEW_TYPE_CRISP_MIND,
      state: { file: file.path }
    });
    await this.app.workspace.revealLeaf(leaf);
    leaf.view.canvasController?.resetZoom();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

/* ==========================================================================
   Setting Tab & Attribution Notice
   ========================================================================== */

function renderAboutCard(container, pluginName, description, version = "1.2.0") {
  const doc = container.ownerDocument || (typeof window !== "undefined" ? window.document : null);
  if (!doc) return;
  const card = doc.createElement("section");
  card.className = "crisp-mind-about";

  const title = doc.createElement("h3");
  title.className = "crisp-mind-about__title";
  title.textContent = `关于 ${pluginName}`;

  const copy = doc.createElement("p");
  copy.className = "crisp-mind-about__description";
  copy.textContent = description;

  const meta = doc.createElement("div");
  meta.className = "crisp-mind-about__meta";

  const byline = doc.createElement("span");
  byline.className = "crisp-mind-about__author";
  const label = doc.createElement("span");
  label.textContent = "作者：";
  const author = doc.createElement("a");
  author.className = "crisp-mind-about__author-link";
  author.textContent = "小红书 letschips";
  author.href = "https://xhslink.cn/m/3MwtKu4822b";
  author.target = "_blank";
  author.rel = "noopener noreferrer";
  byline.append(label, author);

  const ver = doc.createElement("span");
  ver.className = "crisp-mind-about__version";
  ver.textContent = `版本：v${version}`;

  meta.append(byline, ver);
  card.append(title, copy, meta);
  container.append(card);
}

class CrispMindSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.licenseDraft = plugin.settings?.licenseCode || "";
    this.isCheckingLicense = false;
  }

  display() {
    const { containerEl } = this;
    containerEl.innerHTML = "";

    const headerEl = containerEl.createDiv({ cls: "crisp-mind-settings-header" });
    const logoEl = headerEl.createDiv({ cls: "crisp-mind-settings-logo" });
    logoEl.innerHTML = CRISP_MIND_SVG;
    headerEl.createEl("h2", { text: "Crisp Mind" });
    containerEl.createEl("p", {
      text: "专为 Obsidian 与思维创作者打造的本地优先、原生咬合式思维导图系统。",
      cls: "crisp-mind-settings-subhead"
    });

    const createGroup = (title, description, open = true) => {
      const details = containerEl.createEl("details", {
        cls: `crisp-mind-setting-card${open ? " is-open" : ""}`,
      });
      if (open) details.open = true;

      const summary = details.createEl("summary", {
        cls: "crisp-mind-setting-card__header",
      });

      const titleEl = summary.createDiv("crisp-mind-setting-card__title-group");
      titleEl.createDiv({ cls: "crisp-mind-setting-card__title", text: title });
      if (description) {
        titleEl.createDiv({ cls: "crisp-mind-setting-card__desc", text: description });
      }

      summary.createDiv({ cls: "crisp-mind-setting-card__chevron" });

      const contentWrapper = details.createDiv("crisp-mind-setting-card__content-wrapper");
      const body = contentWrapper.createDiv("crisp-mind-setting-card__body");

      summary.addEventListener("click", (evt) => {
        evt.preventDefault();
        if (details.open) {
          details.classList.remove("is-open");
          window.setTimeout(() => { details.open = false; }, 200);
        } else {
          details.open = true;
          window.requestAnimationFrame(() => {
            details.classList.add("is-open");
          });
        }
      });

      return body;
    };

    // Card 1: 导图偏好
    const prefGroup = createGroup(
      "导图偏好",
      "自定义思维导图的布局分支、配色主题与画布交互体验。",
      true
    );

    new Setting(prefGroup)
      .setName("默认导图布局")
      .setDesc("新建思维导图时采用的初始结构分支算法。")
      .addDropdown((dd) => {
        dd.addOption("logicalStructure", "逻辑结构图 (从左向右)")
          .addOption("mindMap", "经典思维导图 (双向发散)")
          .addOption("organizationStructure", "组织架构图 (自顶向下)")
          .addOption("catalogOrganization", "目录组织图 (大纲树)")
          .addOption("timeline", "水平时间轴 (Timeline)")
          .addOption("fishbone", "因果鱼骨图 (Fishbone)")
          .setValue(this.plugin.settings.defaultLayout)
          .onChange(async (val) => {
            this.plugin.settings.defaultLayout = val;
            await this.plugin.saveSettings();
          });
      });

    new Setting(prefGroup)
      .setName("默认调色盘主题")
      .setDesc("选择渲染思维导图节点线条的风格配色。默认跟随 Obsidian 当前主题变量。")
      .addDropdown((dd) => {
        dd.addOption("crisp-obsidian", "Crisp Obsidian (100% 同步当前主题变量)")
          .addOption("crisp-cupertino", "Crisp Cupertino (经典灰蓝冷色)")
          .addOption("crisp-nord", "Crisp Nord (极光深暗)")
          .addOption("crisp-mono", "Crisp Mono Editorial (当代编辑单色排版)")
          .addOption("crisp-amber", "Crisp Amber (温暖羊皮纸)")
          .setValue(this.plugin.settings.defaultTheme)
          .onChange(async (val) => {
            this.plugin.settings.defaultTheme = val;
            await this.plugin.saveSettings();
          });
      });

    new Setting(prefGroup)
      .setName("悬浮工具栏位置")
      .setDesc("选择悬浮胶囊工具栏停靠在画布的位置。")
      .addDropdown((dd) => {
        dd.addOption("bottom", "底部居中 (推荐)")
          .addOption("top", "顶部居中")
          .setValue(this.plugin.settings.toolbarPosition)
          .onChange(async (val) => {
            this.plugin.settings.toolbarPosition = val;
            await this.plugin.saveSettings();
          });
      });

    new Setting(prefGroup)
      .setName("自动安全快照备份")
      .setDesc("在保存前自动生成历史快照，防止误改并支持一键恢复副本。")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.autoBackup !== false).onChange(async (val) => {
          this.plugin.settings.autoBackup = val;
          await this.plugin.saveSettings();
        });
      });

    new Setting(prefGroup)
      .setName("Crisp Pulse 知识脉冲联动")
      .setDesc("开启后，每一次思维导图结构化构思与编辑均自动计入 Pulse 贡献度分析。")
      .addToggle((toggle) => {
        toggle.setValue(this.plugin.settings.enablePulseSync).onChange(async (val) => {
          this.plugin.settings.enablePulseSync = val;
          await this.plugin.saveSettings();
        });
      });

    // Card 2: 软件授权
    const licenseGroup = createGroup(
      "软件授权",
      "本地 Ed25519 签名验证与在线设备校验，支持离线使用；支持 Crisp Suite 系列授权。",
      true
    );

    const statusSetting = new Setting(licenseGroup)
      .setName("当前激活状态");

    const status = this.plugin.licenseManager ? this.plugin.licenseManager.getStatus() : { valid: false, reason: "未初始化" };
    if (status.valid && status.payload) {
      const owner = status.payload.userName || "Crisp 用户";
      const expiry = status.payload.expiresAt
        ? `，到期时间: ${String(status.payload.expiresAt).split("T")[0]}`
        : "";
      const verification = status.source === "offline" ? "离线验证" : "在线验证";
      statusSetting.setDesc(`✅ 已激活（${verification}，授权给: ${owner}${expiry}）`);
    } else if (this.plugin.settings.licenseCode) {
      statusSetting.setDesc(`❌ 未激活（${status.reason || "授权码无效"}）`);
    } else {
      statusSetting.setDesc("🔒 未激活（输入 Crisp Suite / Crisp Mind 授权码以激活完整功能）");
    }

    if (status.valid) {
      statusSetting.addButton((btn) =>
        btn
          .setButtonText("清除授权")
          .onClick(async () => {
            this.plugin.licenseManager?.clear();
            this.licenseDraft = "";
            await this.plugin.saveSettings();
            new Notice("Crisp Mind: 已清除当前授权码");
            this.display();
          })
      );
    }

    new Setting(licenseGroup)
      .setName("输入授权码")
      .setDesc("支持 Crisp Suite 系列通用激活码。自动识别并继承仓库中其他 Crisp 插件的已激活授权。")
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("粘贴 Crisp 授权码...")
          .setValue(this.licenseDraft || this.plugin.settings.licenseCode || "")
          .onChange((value) => {
            this.licenseDraft = value.trim();
          });
      })
      .addButton((btn) => {
        btn
          .setButtonText(this.isCheckingLicense ? "验证中..." : "激活 / 重新验证")
          .setCta()
          .setDisabled(this.isCheckingLicense)
          .onClick(async () => {
            const codeToVerify = this.licenseDraft || this.plugin.settings.licenseCode;
            if (!codeToVerify) {
              new Notice("请先输入授权码");
              return;
            }
            this.isCheckingLicense = true;
            this.display();
            try {
              const res = await this.plugin.licenseManager?.activate(codeToVerify);
              await this.plugin.saveSettings();
              if (res && res.valid) {
                new Notice(`🎉 Crisp Mind 激活成功！欢迎使用，${res.payload?.userName || "Crisp 用户"}`);
              } else {
                new Notice(`❌ 激活未通过: ${res?.reason || "未知原因"}`);
              }
            } catch (err) {
              new Notice(`激活异常: ${err.message}`);
            } finally {
              this.isCheckingLicense = false;
              this.display();
            }
          });
      });

    // Card 3: 关于
    renderAboutCard(
      containerEl,
      "Crisp Mind",
      "专为 Obsidian 与思维创作者打造的本地优先、原生咬合式思维导图系统。支持双向 Markdown 互转、多种图道布局与 Obsidian 双链沉浸跃迁。",
      this.plugin.manifest?.version || "1.2.0"
    );
  }
}

module.exports = CrispMindPlugin;
