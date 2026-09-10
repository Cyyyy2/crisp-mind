# Crisp Mind

> **Your thought graphs, natively woven.**  
> Local-first, Obsidian-native mind mapping engine with bi-directional Markdown and knowledge graph integration.

Part of the **Crisp Series** for Obsidian by [letschips](https://github.com/letschips).

[![Obsidian](https://img.shields.io/badge/Obsidian-v1.6.0%2B-blue.svg)](https://obsidian.md)
[![Platform](https://img.shields.io/badge/Platform-Desktop%20Only-lightgrey.svg)](manifest.json)
[![License](https://img.shields.io/badge/license-Proprietary-red.svg)](LICENSE)
[![Crisp Suite](https://img.shields.io/badge/Crisp-Suite-orange.svg)](https://github.com/letschips)

---

## ✨ Features / 核心特性

- 🧠 **Obsidian-Native Editorial Aesthetic**: 100% 同步 Obsidian 系统与主题 CSS 变量（明暗自适应、重绘保护），拒绝厚重外来前端框架依赖，零运行时依赖。
- 📐 **6 Multi-Dimensional Layouts**:
  - **逻辑结构图 (Logical Structure)**: 经典左右单向与双向结构推演。
  - **思维导图 (Mind Map)**: 核心主题居中，分支智能双向辐射。
  - **组织结构图 (Organization Structure)**: 自顶向下树状分层结构。
  - **目录组织图 (Catalog Organization)**: 纵向大纲缩进层级。
  - **时间轴 (Timeline)**: 里程碑节点上下交替错落，直观呈现阶段规划与演进历史。
  - **鱼骨图 / 因果图 (Fishbone / Ishikawa)**: 工业级根因分析图，斜骨与支骨自适应无碰撞布局算法，自带鱼头指示。
- 🎨 **5 Crisp Curated Palettes**: 内置 `Crisp Obsidian`（跟随当前主题）、`Crisp Cupertino`（灰蓝）、`Crisp Mono Editorial`（当代编辑排版）、`Crisp Nord`（极光深暗）、`Crisp Amber Warm`（羊皮纸暖色）。
- ⌨️ **Fluid Keyboard-First Workflow**: 全键盘高频流转，`Tab` 插入子主题、`Enter` 插入同级主题、`Space` 就地编辑、`Delete` 删除分支、`Cmd/Ctrl + Z / Shift + Z` 极速撤销与重做。
- 🏝️ **Floating Pill & Node Island**: 极简悬浮毛玻璃胶囊菜单，集成布局、配色、高保真导出与原生操作指南；节点就近浮岛快速添加待办与双链。
- 📤 **High-Fidelity Multi-Format Export**:
  - **矢量 SVG**: 精准计算全局包围盒，原生支持深浅主题背景与高精度矢量曲线。
  - **2x 高清 PNG**: Retina 级超清位图渲染，自动采用纯净背景，便于分享至社交媒体与排版平台。
  - **高清 PDF**: 生成符合 PDF-1.4 格式的标准 PDF 文档（2x 高清光栅化封装，非矢量），保留真实排版与清晰度，适合长效打印与归档交流。
- 🔗 **Markdown Outline & Bi-Directional Linking**: 首创 `.mind.md` 混合存储架构，前半部分为纯文本大纲，尾部隔离数据存储。原生支持 Obsidian 全局搜索、快捷切换（Quick Switcher）与反向链接网络。
- 🛡️ **100% Local-First & Snapshot Protection**: 所有数据运算与渲染均在本地完成，破坏性改动前自动写入快照防丢，无外部网络依赖。
- 🔑 **Crisp Suite Ecosystem Synergy**: 基于 Ed25519 非对称公钥密码学实现本地验证，一次激活全套受惠，自动识别并继承同一设备内其它 Crisp 插件的正版授权。

---

## 🚀 Quick Start / 快速开始

1. 打开命令面板 (`Cmd/Ctrl + P`)，输入并运行：
   - `Crisp Mind: 新建思维导图`：快速创建新的 `.mind.md` 文件并进入导图视图。
   - `Crisp Mind: 以思维导图视图打开当前大纲笔记`：将库内任意现有大纲转为思维导图伴随视图。
2. 在文件列表中右键任意 `.mind.md` 文件，选择 **用 Crisp Mind 打开**。
3. 点击画布底部浮动工具栏最右侧的 **帮助图标 (`?`)**，即可查看完整快捷键与操作手势。

---

## ⌨️ Shortcuts / 常用快捷键

| 操作 | 快捷键 / 方法 |
| :--- | :--- |
| **新建子主题** | `Tab` 或 点击节点浮岛「子主题」 |
| **新建同级主题** | `Enter` |
| **编辑文本** | 双击节点 或 选中后按 `Space` / `F2` |
| **删除节点及子分支** | `Delete` / `Backspace` |
| **折叠 / 展开分支** | 节点旁折叠小红点 / 数量圆标，或按 `F` |
| **撤销 / 重做** | `Cmd/Ctrl + Z` / `Cmd/Ctrl + Shift + Z` |
| **画布平移与缩放** | 鼠标滚轮平移，`Cmd/Ctrl + 滚轮` 或触控板捏合缩放 |
| **适应画布居中** | 点击浮动工具栏第一个定位图标，或快捷键居中 |

---

## 📦 Installation / 安装方式

### 方法一：通过 BRAT 安装 (推荐)
1. 安装并启用社区插件 **[Obsidian42 - BRAT](https://github.com/TfTHacker/obsidian42-brat)**。
2. 进入 Obsidian **设置 → BRAT → Add Beta plugin**。
3. 填入 `letschips/crisp-mind` 并点击 **Add Plugin**。
4. 在“第三方插件”列表中启用 **Crisp Mind**。

### 方法二：手动安装
1. 从 [GitHub Releases](https://github.com/letschips/crisp-mind/releases) 下载最新的 `main.js`、`manifest.json` 与 `styles.css`。
2. 在您的 Obsidian 库插件目录中创建文件夹：
   `<VaultFolder>/.obsidian/plugins/crisp-mind/`
3. 将下载的 3 个文件复制到该文件夹下。
4. 在 Obsidian 设置中重新加载插件并启用 **Crisp Mind**。

---

## ⚙️ Activation / 授权激活

Crisp Mind 是 **Crisp 插件套件** 的成员之一。
- 若您已在同一设备中激活过其它 Crisp 插件（如 Crisp Pulse、Crisp Focus、Crisp Visual 等），Crisp Mind 将**自动识别并继承授权**，无需重复配置。
- 您也可以进入 **设置 → Crisp Mind** 手动输入正版激活码进行验证。

---

## 🔒 Privacy & Local-First Policy / 隐私与本地优先政策

- **100% 纯本地离线**：所有思维导图解析、节点测量、矢量排版与导出渲染均在您本地设备运行，没有任何笔记内容、大纲或个人数据上传云端。
- **透明密码学校验**：仅在激活或手动验证时与官方授权接口进行轻量签名核验，支持无网断网离线缓存与秒级冷启动。

---

## 📄 License

[Crisp Proprietary License](LICENSE) © 2026 [letschips](https://github.com/letschips). All rights reserved.
