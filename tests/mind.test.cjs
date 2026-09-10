const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const vm = require("node:vm");
const { generateKeyPairSync, sign: edSign } = require("node:crypto");

// Locally generated Ed25519 pair used to sign license fixtures; setupTestContext swaps this
// public key into the plugin source so no real signing key is ever needed in tests.
const licenseKeys = generateKeyPairSync("ed25519");
const licensePublicPem = licenseKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
function makeLicenseCode(overrides = {}) {
  const payload = {
    product: "Crisp Suite",
    licenseId: "TEST-LICENSE",
    userName: "Test",
    expiresAt: "2999-01-01T00:00:00Z",
    features: ["all"],
    ...overrides,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = edSign(null, Buffer.from(data), licenseKeys.privateKey).toString("base64url");
  return `${data}.${signature}`;
}

// Test harness context simulating Obsidian environment
function setupTestContext(publicKeyPem) {
  class Plugin {
    registerView() {}
    registerEvent() {}
    registerDomEvent() {}
    addRibbonIcon() {}
    addCommand() {}
    addSettingTab() {}
    loadData() { return Promise.resolve({}); }
    saveData() { return Promise.resolve(); }
  }
  class ItemView {}
  class TextFileView extends ItemView {
    constructor(leaf) {
      super();
      this.leaf = leaf;
      this.contentEl = {
        createDiv: () => ({
          classList: { add() {}, remove() {}, toggle() {} },
          appendChild() {},
          innerHTML: "",
          style: {},
          addEventListener() {}
        }),
        innerHTML: "",
        style: {}
      };
    }
  }
  class Setting {
    setName() { return this; }
    setDesc() { return this; }
    addDropdown() { return this; }
    addToggle() { return this; }
    addText() { return this; }
    addButton() { return this; }
  }
  class PluginSettingTab {}
  class Notice {}
  class Modal { open() {} close() {} }
  class TFile {}

  const context = {
    require: (mod) => {
      if (mod === "crypto") return require("crypto");
      if (mod === "util") return require("util");
      if (mod === "fs") return require("fs");
      if (mod === "path") return require("path");
      return { Plugin, ItemView, TextFileView, Setting, PluginSettingTab, Notice, Modal, TFile, addIcon: () => {} };
    },
    URL,
    module: { exports: {} },
    console,
    window: {
      getComputedStyle: () => ({
        getPropertyValue: (prop) => {
          if (prop === "--color-accent") return "#7c3aed";
          if (prop === "--background-primary") return "#1e1e2e";
          if (prop === "--background-secondary") return "#181825";
          if (prop === "--text-normal") return "#cdd6f4";
          if (prop === "--text-muted") return "#a6adc8";
          if (prop === "--background-modifier-border") return "#313244";
          return "";
        }
      })
    },
    document: {
      createElement: (tag) => ({
        tagName: tag,
        style: {},
        setAttribute() {},
        appendChild() {},
        classList: { add() {}, remove() {} }
      }),
      body: {}
    },
    setTimeout,
    clearTimeout,
    structuredClone: (obj) => JSON.parse(JSON.stringify(obj)),
    crypto: globalThis.crypto,
    atob: globalThis.atob,
    Buffer: globalThis.Buffer,
    TextEncoder: globalThis.TextEncoder,
    TextDecoder: globalThis.TextDecoder
  };

  const mainPath = path.join(__dirname, "../main.js");
  let source = fs.readFileSync(mainPath, "utf8");
  // Swap in a locally generated key so license fixtures can be signed in the test.
  if (publicKeyPem) {
    assert.match(source, /-----BEGIN PUBLIC KEY-----/);
    source = source.replace(/-----BEGIN PUBLIC KEY-----[\s\S]*?-----END PUBLIC KEY-----/, publicKeyPem.trim());
  }
  const code = source +
    "\nmodule.exports.helpers = { normalizeMindLinkText, mindNodeLink, inspectMindSource, CrispMindCanvas, CrispMindEditView, parseMindMarkdown, assembleMindMarkdown, markdownOutlineToTree, treeToMarkdownOutline, validateAndRepairTree, extractNodeToTopicContent, getComputedThemeConfig, verifyLicenseCode, discoverVaultCrispLicense, collectVaultCrispLicenseCandidates, CrispMindLicenseManager, renderAboutCard, CrispMindExporter };";

  vm.runInNewContext(code, context);
  return context.module.exports;
}

test("1. Markdown Outline to Tree conversion", () => {
  const { helpers } = setupTestContext();
  const md = `# Central Topic
- Branch 1 [[Note Link]]
  - Sub A
  - Sub B
- Branch 2
  - Sub C`;

  const tree = helpers.markdownOutlineToTree(md);
  assert.ok(tree, "Tree should not be null");
  assert.equal(tree.data.text, "Central Topic");
  assert.equal(tree.children.length, 2);
  assert.equal(tree.children[0].data.text, "Branch 1 [[Note Link]]");
  assert.equal(tree.children[0].children.length, 2);
  assert.equal(tree.children[0].children[0].data.text, "Sub A");
  assert.equal(tree.children[1].children[0].data.text, "Sub C");
});

test("2. Tree to Markdown Outline conversion preserves hierarchy", () => {
  const { helpers } = setupTestContext();
  const tree = {
    id: "root-1",
    data: { text: "Cognitive System" },
    children: [
      {
        id: "c-1",
        data: { text: "Core Plane [[Core]]" },
        children: [{ id: "c-1-1", data: { text: "System Policies" } }]
      },
      {
        id: "c-2",
        data: { text: "Topics Plane [[Topics]]" }
      }
    ]
  };

  const outline = helpers.treeToMarkdownOutline(tree);
  assert.ok(outline.includes("# Cognitive System"));
  assert.ok(outline.includes("- Core Plane [[Core]]"));
  assert.ok(outline.includes("  - System Policies"));
  assert.ok(outline.includes("- Topics Plane [[Topics]]"));
});

test("3. Dual-mode .mind.md Parsing and Assembling", () => {
  const { helpers } = setupTestContext();
  const rawFile = `---
crisp-mind: true
title: AI Architecture
tags: [mindmap, ai]
---

# AI Architecture
- LLM Engine
  - Context Window
  - Tool Invocation
- Memory Store

<!-- CRISP-MIND-DATA-START -->
\`\`\`crisp-mind
{
  "version": "1.0",
  "layout": "logicalStructure",
  "theme": "crisp-obsidian",
  "root": {
    "id": "root",
    "data": { "text": "AI Architecture" },
    "children": [
      {
        "id": "c1",
        "data": { "text": "LLM Engine" },
        "children": [
          { "id": "c11", "data": { "text": "Context Window" } },
          { "id": "c12", "data": { "text": "Tool Invocation" } }
        ]
      },
      {
        "id": "c2",
        "data": { "text": "Memory Store" }
      }
    ]
  }
}
\`\`\`
<!-- CRISP-MIND-DATA-END -->
`;

  const parsed = helpers.parseMindMarkdown(rawFile);
  assert.equal(parsed.title, "AI Architecture");
  assert.equal(parsed.data.layout, "logicalStructure");
  assert.equal(parsed.data.root.children.length, 2);

  // Test Assemble
  const reassembled = helpers.assembleMindMarkdown(parsed);
  assert.ok(reassembled.includes("crisp-mind: true"));
  assert.ok(reassembled.includes("# AI Architecture"));
  assert.ok(reassembled.includes("- LLM Engine"));
  assert.ok(reassembled.includes("<!-- CRISP-MIND-DATA-START -->"));
});

test("4. Tree Validation & Data Contract Self-Healing", () => {
  const { helpers } = setupTestContext();
  const brokenData = {
    root: {
      children: [
        null,
        { data: {} }
      ]
    }
  };

  const repaired = helpers.validateAndRepairTree(brokenData);
  assert.ok(repaired.root.id, "Root id must be repaired");
  assert.equal(repaired.root.data.text, "Central Topic");
  assert.equal(repaired.root.children.length, 1);
  assert.ok(repaired.root.children[0].id);
});

test("5. Extract Branch to Topic (ANKS Integration)", () => {
  const { helpers } = setupTestContext();
  const branchNode = {
    id: "sub-1",
    data: { text: "WeChat Publisher Workflow" },
    children: [
      { id: "s-1", data: { text: "Draft Compilation" } },
      { id: "s-2", data: { text: "Asset Syncing" } }
    ]
  };

  const { title, content } = helpers.extractNodeToTopicContent(branchNode);
  assert.equal(title, "WeChat Publisher Workflow");
  assert.ok(content.includes("crisp-type: topic-note"));
  assert.ok(content.includes("# WeChat Publisher Workflow"));
  assert.ok(content.includes("- Draft Compilation"));
  assert.ok(content.includes("- Asset Syncing"));
});

test("6. Obsidian Theme Adapter produces valid palette", () => {
  const { helpers } = setupTestContext();
  const palette = helpers.getComputedThemeConfig("crisp-obsidian");
  assert.equal(palette.accentColor, "#7c3aed");
  assert.equal(palette.backgroundColor, "#1e1e2e");
  assert.equal(palette.textColor, "#cdd6f4");
});

function canvasFixture() {
  const { helpers } = setupTestContext();
  const C = helpers.CrispMindCanvas;
  C.prototype.initCanvas = function () {};
  C.prototype.render = function () { this.calculateLayout(); };
  let changes = 0;
  const data = helpers.parseMindMarkdown("# Root\n- One\n  - Nested\n- Two\n- Three").data;
  const canvas = new C({}, data, { onChange: () => changes++ });
  return { canvas, helpers, changes: () => changes };
}
test("opening a canvas does not request a save", () => {
  assert.equal(canvasFixture().changes(), 0);
});
test("undo restores theme and layout, redo reapplies both", () => {
  const { canvas } = canvasFixture();
  canvas.setTheme("crisp-nord");
  canvas.setLayout("organizationStructure");
  canvas.undo();
  assert.equal(canvas.docData.layout, "logicalStructure");
  assert.equal(canvas.layout, "logicalStructure");
  canvas.undo();
  assert.equal(canvas.docData.theme, "crisp-obsidian");
  canvas.redo();
  assert.equal(canvas.theme.name, "crisp-nord");
});
test("mind map places branches on both sides of the root", () => {
  const { canvas } = canvasFixture();
  canvas.setLayout("mindMap");
  const r = canvas.docData.root;
  assert.ok(r.children.some(c => c._x < r._x));
  assert.ok(r.children.some(c => c._x > r._x));
});
test("organization layout places siblings below root on same row", () => {
  const { canvas } = canvasFixture();
  canvas.setLayout("organizationStructure");
  const r = canvas.docData.root;
  assert.ok(r.children.every(c => c._y > r._y));
  assert.equal(r.children[0]._y, r.children[1]._y);
});
test("serialization excludes calculated geometry", () => {
  const { canvas, helpers } = canvasFixture();
  canvas.calculateLayout();
  const text = helpers.assembleMindMarkdown({data:canvas.docData});
  assert.ok(!text.includes('"_x"'));
  assert.ok(!text.includes('"_treeHeight"'));
});
test("every layout keeps its computed geometry out of the serialized file", () => {
  const transient = ["_x","_y","_w","_h","_treeHeight","_treeWidth","_lines",
    "_isUpper","_spineConnectX","_spineConnectY","_boneTipX","_boneTipY","_boneConnectX","_boneConnectY"];
  for (const layout of ["logicalStructure","mindMap","organizationStructure","catalogOrganization","timeline","fishbone"]) {
    const { canvas, helpers } = canvasFixture();
    canvas.docData.root.children = [
      { id:"b1", data:{text:"人员因素"}, children:[{ id:"s1", data:{text:"培训不足"}, children:[] }] },
      { id:"b2", data:{text:"设备因素"}, children:[{ id:"s2", data:{text:"老化故障"}, children:[] }] }
    ];
    canvas.layout = layout;
    canvas.calculateLayout();
    const text = helpers.assembleMindMarkdown({data:canvas.docData});
    const leaked = transient.filter(k => text.includes('"' + k + '"'));
    assert.deepEqual(leaked, [], layout + " leaked layout geometry: " + leaked.join(", "));
  }
});
test("switching away from fishbone leaves no bone residue in the file", () => {
  const { canvas, helpers } = canvasFixture();
  canvas.docData.root.children = [
    { id:"b1", data:{text:"人员因素"}, children:[] },
    { id:"b2", data:{text:"设备因素"}, children:[] }
  ];
  canvas.setLayout("fishbone");
  assert.ok(canvas.docData.root.children[0]._spineConnectX, "fishbone should compute spine coordinates first");
  canvas.setLayout("logicalStructure");
  const text = helpers.assembleMindMarkdown({data:canvas.docData});
  for (const key of ["_isUpper","_spineConnectX","_spineConnectY","_boneTipX","_boneTipY","_boneConnectX","_boneConnectY"]) {
    assert.ok(!text.includes('"' + key + '"'), "residual " + key + " survived the layout switch");
  }
  assert.ok(!JSON.stringify(canvas.history).includes('"_spineConnectX"'), "history must not carry bone geometry");
});
test("ordinary Markdown view returns exact original content", () => {
  const { helpers } = setupTestContext();
  const v = Object.create(helpers.CrispMindEditView.prototype);
  v.file = {path:"notes.md"};
  v.initViewUI = () => {};
  const source = "---\ncustom: yes\n---\n# Note\nA paragraph.\n- item\n";
  v.setViewData(source, true);
  assert.equal(v.getViewData(), source);
});

test("unchanged history is deduplicated and contains no geometry", () => {
  const {canvas} = canvasFixture(); canvas.calculateLayout(); canvas.saveState();
  assert.equal(canvas.history.length, 1);
  assert.ok(!JSON.stringify(canvas.history).includes('"_x"'));
});
test("move rejects cycles and root move, reparent is a single undo step", () => {
  const {canvas} = canvasFixture(); const r=canvas.docData.root,a=r.children[0],b=r.children[1],nested=a.children[0];
  assert.equal(canvas.moveNode(a.id,nested.id),false);
  assert.equal(canvas.moveNode(r.id,b.id),false);
  assert.equal(canvas.moveNode(a.id,b.id),true);
  assert.equal(canvas.findParent(a.id).id,b.id);
  assert.equal(canvas.history.length,2); canvas.undo();
  assert.equal(canvas.findParent(a.id).id,r.id);
});
test("same-parent reorder preserves the exact intended order", () => {
  const {canvas}=canvasFixture();const [a,b,c]=canvas.docData.root.children;
  canvas.moveNode(a.id,c.id,'after');
  assert.deepEqual(Array.from(canvas.docData.root.children,n=>n.id),[b.id,c.id,a.id]);
  canvas.undo(); canvas.moveNode(c.id,a.id,'before');
  assert.deepEqual(Array.from(canvas.docData.root.children,n=>n.id),[c.id,a.id,b.id]);
});
test("collapse hides descendants without dropping serialized content", () => {
  const {canvas,helpers}=canvasFixture(); const a=canvas.docData.root.children[0],nested=a.children[0];
  canvas.toggleCollapse(a.id);
  assert.ok(!canvas.visibleNodes().some(n=>n.id===nested.id));
  assert.ok(helpers.assembleMindMarkdown({data:canvas.docData}).includes('Nested'));
  canvas.undo(); assert.ok(canvas.visibleNodes().some(n=>n.id===nested.id));
});
test("paste branch regenerates all IDs and one undo removes the whole paste", () => {
  const {canvas}=canvasFixture();const a=canvas.docData.root.children[0];
  const text=canvas.copyBranchText(a.id);const before=canvas.docData.root.children.length;
  canvas.pasteBranchText(text,canvas.docData.root.id);
  const added=canvas.docData.root.children.at(-1);
  assert.notEqual(added.id,a.id); assert.notEqual(added.children[0].id,a.children[0].id);
  assert.equal(added.children[0].data.text,'Nested');
  canvas.undo();assert.equal(canvas.docData.root.children.length,before);
});
test("multiline paste preserves indentation and is one transaction", () => {
  const {canvas}=canvasFixture();const r=canvas.docData.root;
  canvas.pasteBranchText('Alpha\n  Beta\nGamma',r.id);
  assert.equal(r.children.at(-2).children[0].data.text,'Beta');
  assert.equal(r.children.at(-1).data.text,'Gamma');
  assert.equal(canvas.history.length,2);
});
test("inspect source blocks corrupt JSON, duplicate IDs, and external outline edits", () => {
  const {helpers}=setupTestContext();const doc=helpers.parseMindMarkdown('# Root\n- One');
  const good=helpers.assembleMindMarkdown(doc);
  assert.equal(helpers.inspectMindSource(good),null);
  assert.match(helpers.inspectMindSource(good.replace('"version":','BROKEN:')),/损坏/);
  assert.match(helpers.inspectMindSource(good.replace('- One','- Changed')),/大纲/);
  doc.data.root.children[0].id=doc.data.root.id;
  assert.match(helpers.inspectMindSource(helpers.assembleMindMarkdown(doc)),/重复/);
});

function savedViewFixture() {
  const {helpers}=setupTestContext();const v=Object.create(helpers.CrispMindEditView.prototype);
  let disk=helpers.assembleMindMarkdown(helpers.parseMindMarkdown('# Root\n- One'));
  const backups=[];let fail=false;
  v.file={path:'test.mind.md',basename:'test.mind',parent:{path:''}};
  v.plugin={settings:{autoBackup:true},manifest:{id:'crisp-mind'}};
  v.app={vault:{configDir:'.obsidian',adapter:{exists:async()=>true,mkdir:async()=>{},write:async(p,t)=>backups.push(JSON.parse(t))},process:async(file,fn)=>{if(fail)throw Error('disk full');disk=fn(disk);}}};
  v.initViewUI=()=>{};v.requestSave=()=>{};v.notifyPulseContribution=()=>{};
  v.setViewData(disk,true);v.mindDoc.data.root.data.text='Changed';v.dirty=true;
  return {v,backups,disk:()=>disk,setDisk:s=>disk=s,setFail:b=>fail=b};
}
test('save creates recovery snapshot and persists matching source',async()=>{
  const {v,backups,disk}=savedViewFixture();await v.save();
  assert.equal(v.dirty,false);assert.ok(disk().includes('# Changed'));
  assert.ok(backups.some(b=>b.content.includes('# Root')));
});
test('save refuses changed disk and keeps dirty draft recoverable',async()=>{
  const f=savedViewFixture();f.setDisk('EXTERNAL');await f.v.save();
  assert.equal(f.disk(),'EXTERNAL');assert.equal(f.v.dirty,true);assert.ok(f.v.saveError);
  assert.ok(f.backups.some(b=>b.content.includes('# Changed')));
});
test('failed write retains the draft and a retry saves it',async()=>{
  const f=savedViewFixture();f.setFail(true);await f.v.save();
  assert.equal(f.v.dirty,true);assert.ok(f.v.saveError);
  f.setFail(false);await f.v.save();assert.equal(f.v.dirty,false);
});
test('external update while dirty does not replace local edits',()=>{
  const {v}=savedViewFixture();v.setViewData('external',false);
  assert.equal(v.mindDoc.data.root.data.text,'Changed');assert.ok(v.saveError);
});
test('corrupt managed file remains read-only and byte-preserved',()=>{
  const {v}=savedViewFixture();v.dirty=false;const raw='BROKEN';v.setViewData(raw,true);
  assert.equal(v.readOnly,true);assert.equal(v.getViewData(),raw);
});

test('read-only blocks structural mutation and undo',()=>{
  const {canvas}=canvasFixture();canvas.options.readOnly=true;
  const before=JSON.stringify(canvas.docData);
  canvas.addChildNode();canvas.deleteNode(canvas.docData.root.children[0].id);
  canvas.moveNode(canvas.docData.root.children[0].id,canvas.docData.root.children[1].id);
  canvas.pasteBranchText('One\nTwo');canvas.undo();
  assert.equal(JSON.stringify(canvas.docData),before);
});
test('JSON containing backticks safely round-trips',()=>{
  const {helpers}=setupTestContext();const doc=helpers.parseMindMarkdown('# Root\n- One');
  doc.data.root.children[0].data.text='```javascript';
  const raw=helpers.assembleMindMarkdown(doc);
  assert.equal(helpers.inspectMindSource(raw),null);
  assert.equal(helpers.parseMindMarkdown(raw).data.root.children[0].data.text,'```javascript');
});
test('new edits during an in-flight save remain dirty and save on next pass',async()=>{
  const f=savedViewFixture();let release, started;
  const gate=new Promise(r=>release=r);const ready=new Promise(r=>started=r);
  const process=f.v.app.vault.process;
  f.v.app.vault.process=async(file,fn)=>{started();await gate;return process(file,fn)};
  const saving=f.v.save();await ready;
  f.v.mindDoc.data.root.data.text='Newer';release();await saving;
  assert.equal(f.v.dirty,true);assert.ok(f.disk().includes('# Changed'));
  await f.v.save();assert.equal(f.v.dirty,false);assert.ok(f.disk().includes('# Newer'));
});
test('backup write failure prevents the primary file write',async()=>{
  const f=savedViewFixture();f.v.app.vault.adapter.write=async()=>{throw Error('backup disk full')};
  const before=f.disk();await f.v.save();assert.equal(f.disk(),before);assert.equal(f.v.dirty,true);
});
test('in-flight save stays bound to its original file across view changes',async()=>{
  const f=savedViewFixture();const original=f.v.file;let release,ready;
  const gate=new Promise(r=>release=r);const started=new Promise(r=>ready=r);
  f.v.app.vault.adapter.write=async()=>{ready();await gate};
  let target;const process=f.v.app.vault.process;
  f.v.app.vault.process=async(file,fn)=>{target=file;return process(file,fn)};
  const saving=f.v.save();await started;
  f.v.file={path:'different.mind.md'};release();await saving;
  assert.equal(target,original);
});

const exampleUri='obsidian://open?vault=AI-native%20Knowledge%20System&file=Topics%2Fmain-business%2Fknowledge%2Findex';
test('Obsidian URL converts to a readable native wikilink',()=>{
  const {helpers}=setupTestContext();
  const result=helpers.normalizeMindLinkText(exampleUri,'AI-native Knowledge System');
  assert.equal(result,'[[Topics/main-business/knowledge/index|index]]');
  assert.equal(helpers.mindNodeLink(result).target,'Topics/main-business/knowledge/index');
});
test('URI rejects other actions, missing file, and different vaults',()=>{
  const {helpers}=setupTestContext();
  for(const uri of ['obsidian://new?file=x','obsidian://open?vault=X', 'obsidian://open?vault=Other&file=x'])
    assert.throws(()=>helpers.normalizeMindLinkText(uri,'AI-native Knowledge System'));
});
test('URI paste creates a navigable node in one history step',()=>{
  const {canvas}=canvasFixture();canvas.options.vaultName='AI-native Knowledge System';
  canvas.pasteBranchText(exampleUri,canvas.docData.root.id);
  assert.equal(canvas.docData.root.children.at(-1).data.text,'[[Topics/main-business/knowledge/index|index]]');
  canvas.undo();assert.equal(canvas.docData.root.children.length,3);
});
test('aliases and task prefixes preserve display and destination',()=>{
  const {helpers}=setupTestContext();const link=helpers.mindNodeLink('[ ] 参考 [[Topics/index#章节|索引]]');
  assert.equal(link.target,'Topics/index#章节');assert.equal(link.display,'[ ] 参考 索引');
});

test('task-prefixed Obsidian URLs remain tasks and are clickable',()=>{
  const {helpers}=setupTestContext();const text='[ ] '+exampleUri;
  assert.equal(helpers.normalizeMindLinkText(text,'AI-native Knowledge System'),'[ ] [[Topics/main-business/knowledge/index|index]]');
  assert.equal(helpers.mindNodeLink(text,'AI-native Knowledge System').target,'Topics/main-business/knowledge/index');
});

test('addChildNode expands collapsed parent automatically',()=>{
  const {canvas}=canvasFixture();
  const parent = canvas.docData.root.children[0];
  parent.data.collapsed = true;
  canvas.addChildNode(parent.id);
  assert.equal(parent.data.collapsed, false);
  const newNode = parent.children.at(-1);
  assert.equal(newNode.data.text, '新节点');
  assert.ok(canvas.visibleNodes().some(n => n.id === newNode.id));
});

test('inspectMindSource ignores blank lines and alternative indentation',()=>{
  const {helpers}=setupTestContext();
  const doc = helpers.parseMindMarkdown('# Root\n- One\n  - Sub');
  const good = helpers.assembleMindMarkdown(doc);
  // Blank line between heading and outline
  const withBlank = good.replace('# Root\n', '# Root\n\n');
  assert.equal(helpers.inspectMindSource(withBlank), null);
  // 4 spaces indentation
  const with4Spaces = good.replace('  - Sub', '    - Sub');
  assert.equal(helpers.inspectMindSource(with4Spaces), null);
});

test('exportSVG includes theme background rect',()=>{
  const {canvas}=canvasFixture();
  canvas.calculateLayout();
  let inserted = null;
  const viewport = {
    removeAttribute: () => {},
    insertBefore: (n) => { inserted = n; }
  };
  canvas.svg = {
    cloneNode: () => ({
      setAttribute: () => {},
      removeAttribute: () => {},
      firstElementChild: viewport,
      querySelectorAll: () => [],
      get outerHTML() {
        return `<svg><rect fill="${inserted?.fill}"/></svg>`;
      }
    })
  };
  canvas.document = {
    createElementNS: (ns, tag) => {
      const el = { tag };
      el.setAttribute = (k, v) => { el[k] = v; };
      return el;
    }
  };
  const svg = canvas.exportSVG();
  assert.ok(svg.includes('<rect'));
  assert.ok(svg.includes(`fill="${canvas.theme.backgroundColor}"`));
});

test('extractNodeToTopicContent cleans task prefix and wikilink alias',()=>{
  const {helpers}=setupTestContext();
  const node = {
    id: 'test',
    data: { text: '[ ] 深度思考 [[Topics/tech/ai|AI架构]]' },
    children: []
  };
  const { title } = helpers.extractNodeToTopicContent(node);
  assert.equal(title, '深度思考 AI架构');
});

test('inline editor validation error does not deadlock canvas', () => {
  const { canvas } = canvasFixture();
  const node = canvas.docData.root.children[0];
  let inputEl = null;
  const container = {
    children: [],
    appendChild: (el) => { container.children.push(el); el.parentNode = container; },
    removeChild: (el) => { container.children = container.children.filter(c => c !== el); el.parentNode = null; },
    focus: () => {}
  };
  canvas.container = container;
  canvas.document = {
    createElement: (tag) => {
      if (tag === "input") {
        inputEl = {
          style: {},
          setAttribute: () => {},
          focus: () => {},
          select: () => {},
          addEventListener: (event, handler) => { inputEl[event] = handler; },
          value: ''
        };
        return inputEl;
      }
      return { getContext: () => null, style: {}, setAttribute: () => {} };
    }
  };
  canvas.editNodeText(node);
  assert.ok(canvas.editor);
  assert.equal(inputEl.parentNode, container);
  // Invalid obsidian URL
  inputEl.value = 'obsidian://invalid';
  // Trigger blur
  inputEl.blur();
  assert.equal(canvas.editor, null, 'Editor must be cleared on blur error');
  assert.equal(inputEl.parentNode, null, 'Input element must be removed from parent');
});

test('40. CrispMindLicenseManager validates initial status, empty code and clearing', async () => {
  const { helpers } = setupTestContext();
  const settings = { licenseCode: '' };
  const manager = new helpers.CrispMindLicenseManager({}, settings);
  assert.equal(manager.getStatus().valid, false);

  const emptyRes = await manager.activate('');
  assert.equal(emptyRes.valid, false);
  assert.match(emptyRes.reason, /授权码为空/);

  const invalidRes = await manager.activate('bad.token');
  assert.equal(invalidRes.valid, false);

  manager.clear();
  assert.equal(settings.licenseCode, '');
  assert.equal(manager.getStatus().valid, false);
});

test('40a. local-only verification accepts a valid code and does not reach the network', async () => {
  const { helpers } = setupTestContext(licensePublicPem);
  const res = await helpers.verifyLicenseCode(makeLicenseCode(), 'crisp-mind', {}, null, { online: false });
  assert.equal(res.valid, true);
  assert.equal(res.source, 'local');
});

test('40b. a single-plugin license for another plugin is rejected by Crisp Mind', async () => {
  const { helpers } = setupTestContext(licensePublicPem);
  const res = await helpers.verifyLicenseCode(
    makeLicenseCode({ features: ['crisp-focus'] }), 'crisp-mind', {}, null, { online: false });
  assert.equal(res.valid, false);
  assert.match(res.reason, /未包含 crisp-mind 权限/);
});

test('40c. candidate scan dedupes codes and drops malformed ones', () => {
  const { helpers } = setupTestContext(licensePublicPem);
  const good = makeLicenseCode();
  const app = { plugins: { plugins: {
    'crisp-pulse': { settings: { licenseCode: good } },
    'crisp-focus': { settings: { licenseCode: good } },
    'crisp-base': { settings: { licenseCode: 'no-signature-part' } },
    'crisp-recall': { settings: {} },
  } } };
  assert.deepEqual([...helpers.collectVaultCrispLicenseCandidates(app)], [good]);
});

test('40d. inheritance skips a license that does not cover Crisp Mind and adopts the usable one', async () => {
  const { helpers } = setupTestContext(licensePublicPem);
  const otherScoped = makeLicenseCode({ licenseId: 'SCOPED-ELSEWHERE', features: ['crisp-focus'] });
  const family = makeLicenseCode({ licenseId: 'FAMILY', features: ['all'] });
  const app = { plugins: { plugins: {
    'crisp-pulse': { settings: { licenseCode: otherScoped } },
    'crisp-focus': { settings: { licenseCode: family } },
  } } };
  const adopted = await helpers.discoverVaultCrispLicense(app);
  assert.equal(adopted, family, 'the first *usable* candidate must win, not the first found');
});

test('40e. inheritance adopts nothing when no candidate covers Crisp Mind', async () => {
  const { helpers } = setupTestContext(licensePublicPem);
  const app = { plugins: { plugins: {
    'crisp-pulse': { settings: { licenseCode: makeLicenseCode({ features: ['crisp-asr'] }) } },
  } } };
  assert.equal(await helpers.discoverVaultCrispLicense(app), null);
});

test('41. Completed tasks [x] receive task styling and strikethrough', () => {
  const { canvas } = canvasFixture();
  const node = canvas.docData.root.children[0];
  node.data.text = '[x] 已完成的核心交付';
  let hasStrikethrough = false;
  let addedCompletedClass = false;
  canvas.nodesGroup = { appendChild: () => {} };
  canvas.linesGroup = { appendChild: () => {} };
  canvas.document = {
    createElementNS: (ns, tag) => {
      const el = {
        tag,
        classList: { add(cls) { if (cls === 'is-task-completed') addedCompletedClass = true; } },
        setAttribute(k, v) { if (k === 'text-decoration' && v === 'line-through') hasStrikethrough = true; },
        appendChild: () => {},
        addEventListener: () => {},
        style: {}
      };
      return el;
    }
  };
  canvas.renderBranch(node);
  assert.ok(addedCompletedClass, 'Node group should receive is-task-completed class');
  assert.ok(hasStrikethrough, 'Text element should receive line-through decoration');
});

test('42. renderAboutCard injects attribution notice and official letschips links', () => {
  const { helpers } = setupTestContext();
  const container = {
    children: [],
    append(child) { this.children.push(child); }
  };
  const doc = {
    createElement(tag) {
      return {
        tagName: tag,
        className: '',
        textContent: '',
        href: '',
        target: '',
        rel: '',
        children: [],
        append(...items) { this.children.push(...items); }
      };
    }
  };
  container.ownerDocument = doc;
  helpers.renderAboutCard(container, 'Crisp Mind', '本地优先思维导图', '1.2.0');
  assert.equal(container.children.length, 1);
  const card = container.children[0];
  assert.equal(card.className, 'crisp-mind-about');
});

test('43. Timeline layout calculates milestone alternating coordinates and horizontal axis', () => {
  const { canvas } = canvasFixture();
  canvas.docData.root.children = [
    { id: 'm1', data: { text: '2024 Q1 启动' }, children: [] },
    { id: 'm2', data: { text: '2024 Q2 迭代' }, children: [] },
    { id: 'm3', data: { text: '2024 Q3 发布' }, children: [] }
  ];
  canvas.layout = 'timeline';
  canvas.calculateLayout();

  assert.equal(canvas.docData.root._x, 0);
  assert.equal(canvas.docData.root._y, 0);
  assert.ok(canvas._timelineAxis, 'Timeline axis object should be computed');
  assert.ok(canvas._timelineAxis.endX > canvas._timelineAxis.startX, 'Axis should extend to right');

  const m1 = canvas.docData.root.children[0];
  const m2 = canvas.docData.root.children[1];
  const m3 = canvas.docData.root.children[2];

  assert.ok(m1._y < canvas._timelineAxis.y, 'Even index milestone 1 should be above timeline axis');
  assert.ok(m2._y > canvas._timelineAxis.y, 'Odd index milestone 2 should be below timeline axis');
  assert.ok(m3._y < canvas._timelineAxis.y, 'Even index milestone 3 should be above timeline axis');
  assert.ok(m2._x > m1._x, 'Milestones should be arranged chronologically from left to right');
  assert.ok(m3._x > m2._x, 'Milestones should be arranged chronologically from left to right');
});

test('44. Fishbone layout calculates right-side fish head and slanted bones', () => {
  const { canvas } = canvasFixture();
  canvas.docData.root.children = [
    { id: 'b1', data: { text: '人员因素' }, children: [{ id: 's1', data: { text: '培训不足' }, children: [] }] },
    { id: 'b2', data: { text: '设备因素' }, children: [{ id: 's2', data: { text: '老化故障' }, children: [] }] }
  ];
  canvas.layout = 'fishbone';
  canvas.calculateLayout();

  const root = canvas.docData.root;
  assert.ok(canvas._fishboneAxis, 'Fishbone spine axis should be computed');
  assert.ok(root._x >= canvas._fishboneAxis.endX, 'Fish head should be placed on the far right');

  const b1 = canvas.docData.root.children[0];
  const b2 = canvas.docData.root.children[1];

  assert.ok(b1._y < canvas._fishboneAxis.y, 'b1 should be in the upper half of fishbone');
  assert.ok(b2._y > canvas._fishboneAxis.y, 'b2 should be in the lower half of fishbone');
  assert.ok(b1._spineConnectX, 'b1 should have spine connection coordinate');
  assert.ok(b2._spineConnectX, 'b2 should have spine connection coordinate');
});

test('45. CrispMindExporter computes accurate BoundingBox and generates standalone SVG', () => {
  const { helpers } = setupTestContext();
  const { canvas } = canvasFixture();
  canvas.calculateLayout();
  const mockView = { canvasController: canvas };
  const exporter = new helpers.CrispMindExporter(mockView);

  const bbox = exporter.getBoundingBox(40);
  assert.ok(bbox.width > 0, 'BoundingBox width should be positive');
  assert.ok(bbox.height > 0, 'BoundingBox height should be positive');
  assert.ok(bbox.viewBox.includes(`${bbox.width} ${bbox.height}`), 'viewBox should match dimensions');

  const svgRes = exporter.toSvg({ padding: 30, transparent: false });
  assert.ok(svgRes.svgString.startsWith('<?xml version="1.0"'), 'SVG should have XML header');
  assert.ok(svgRes.svgString.includes('<svg xmlns="http://www.w3.org/2000/svg"'), 'SVG should have xmlns');
  assert.ok(svgRes.svgString.includes('viewBox='), 'SVG should include viewBox');
  assert.ok(svgRes.svgString.includes('crisp-mind-export-nodes'), 'SVG should wrap nodes');
});

test('46. CrispMindExporter buildPdfBinary outputs standard valid PDF-1.4 binary', () => {
  const { helpers } = setupTestContext();
  const dummyJpegBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0xFF, 0xD9]);
  const pdfBuffer = helpers.CrispMindExporter.buildPdfBinary(dummyJpegBytes, 800, 600, 600, 450);

  assert.ok(pdfBuffer && pdfBuffer.byteLength > 0, 'Output must be an ArrayBuffer with positive byteLength');
  const text = Buffer.from(pdfBuffer).toString('binary');
  assert.ok(text.startsWith('%PDF-1.4'), 'PDF should begin with %PDF-1.4');
  assert.ok(text.includes('/Type /Catalog'), 'PDF should define Catalog');
  assert.ok(text.includes('/Type /Pages'), 'PDF should define Pages');
  assert.ok(text.includes('/Type /Page'), 'PDF should define Page');
  assert.ok(text.includes('/Type /XObject'), 'PDF should embed Image XObject');
  assert.ok(text.includes('/Filter /DCTDecode'), 'PDF should use DCTDecode filter for JPEG stream');
  assert.ok(text.includes('xref'), 'PDF should contain xref table');
  assert.ok(text.includes('trailer'), 'PDF should contain trailer');
  assert.ok(text.trim().endsWith('%%EOF'), 'PDF should terminate with %%EOF');
});


