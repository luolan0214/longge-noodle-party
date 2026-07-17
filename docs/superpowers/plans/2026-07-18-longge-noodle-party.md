# 龙哥炸酱面聚会邀请函 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一张可部署到 GitHub Pages、以手机为主、包含六位统一手绘角色和六段互动流程的龙哥炸酱面聚会邀请函。

**Architecture:** 使用无构建步骤的原生 HTML、CSS 与 ES Modules。静态文案和人物配置集中在 `js/content.js`，可测试状态机放在 `js/state.js`，DOM 渲染与浏览器能力分别放在 `js/ui.js` 和 `js/app.js`；互动完成度保存在 `localStorage`，即使 JavaScript 失效，HTML 仍保留日期、地址和完整流程文案。

**Tech Stack:** HTML5、CSS3、原生 JavaScript ES Modules、Node.js 内置测试运行器、PNG/WebP/SVG 静态素材、GitHub Pages

---

## 文件结构

- `index.html`：语义化页面骨架、无 JavaScript 降级内容、SEO/Open Graph 元信息。
- `styles/tokens.css`：颜色、字体、间距、阴影、响应式尺寸等设计令牌。
- `styles/base.css`：重置、纸张背景、排版、无障碍基础状态。
- `styles/components.css`：封面、人物贴纸、地址卡、折叠卡、印章、Toast 和分享区样式。
- `styles/animations.css`：门铃、贴纸落下、配菜入碗、相机、切西瓜、递麦、月升和减少动态降级。
- `js/content.js`：六位角色、地址、时间、六个环节和随机台词的唯一事实源。
- `js/state.js`：纯函数状态机、本地存储序列化、折叠/翻阅/完成/解锁规则。
- `js/ui.js`：按内容配置渲染角色与环节、更新 ARIA、印章、合影锁和 Toast。
- `js/interactions.js`：六个环节的具体互动控制器和声音反馈。
- `js/app.js`：初始化、事件编排、分享、复制地址、地图链接、重玩。
- `tests/content.test.mjs`：隐私、人物关系、日期、地址和地图参数测试。
- `tests/state.test.mjs`：折叠状态、翻阅/完成、合影解锁、持久化测试。
- `tests/static.test.mjs`：HTML 降级内容、相对资源路径、可访问性关键标记测试。
- `assets/characters/*.png`：六位透明背景统一手绘角色和六人合影。
- `assets/og/party-preview.jpg`：1200×630 分享预览图。
- `assets/icons/*.svg`：自绘地图、复制、分享、声音、快门等图标。
- `README.md`：本地预览、测试与 GitHub Pages 发布说明。

### Task 1: 建立静态项目骨架和内容契约

**Files:**
- Create: `package.json`
- Create: `js/content.js`
- Create: `tests/content.test.mjs`
- Create: `.gitignore`

- [ ] **Step 1: 写内容契约失败测试**

在 `tests/content.test.mjs` 中导入 `characters`、`eventDetails`、`parts`，断言：日期为 `2026-07-19`；普通到场为 `15:00–16:00`；地址完整；角色数量为 6；前四位 `guest`、后两位 `host`；第三位公开名只能是 `AI Native 连续创业者`；六个 PART 编号连续；所有可见字符串中不包含三个受保护姓名写法。

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { characters, eventDetails, parts } from '../js/content.js';

const forbiddenNames = [
  '\u8427\u7136',
  '\u6f47\u7136',
  '\u8096\u7136',
];

test('event and character contract is complete and private', () => {
  assert.equal(eventDetails.date, '2026-07-19');
  assert.equal(eventDetails.generalArrival, '15:00–16:00');
  assert.equal(eventDetails.address, '北京市昌平区风雅园一区 15 号楼 1 单元 303');
  assert.equal(characters.length, 6);
  assert.deepEqual(characters.map(({ role }) => role), ['guest', 'guest', 'guest', 'guest', 'host', 'host']);
  assert.equal(characters[2].name, 'AI Native 连续创业者');
  assert.deepEqual(parts.map(({ id }) => id), ['part-01', 'part-02', 'part-03', 'part-04', 'part-05', 'part-06']);

  const publicCopy = JSON.stringify({ characters, eventDetails, parts });
  forbiddenNames.forEach((name) => assert.equal(publicCopy.includes(name), false));
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/content.test.mjs`

Expected: FAIL，错误为无法找到 `js/content.js`。

- [ ] **Step 3: 添加零依赖项目配置与完整内容数据**

创建 `package.json`，仅声明 ES Module 和测试命令，不引入运行时或构建依赖：

```json
{
  "name": "longge-noodle-party",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.mjs",
    "serve": "python3 -m http.server 4173"
  }
}
```

在 `js/content.js` 中导出完整的 `eventDetails`、六个 `characters`、六个 `parts` 和 `micLines`。人物对象固定使用 `id/name/role/arrival/image/accent` 字段；环节对象使用 `id/number/title/teaser/stamp` 字段。禁止在注释、测试夹具或变量名中保存真实姓名。

- [ ] **Step 4: 运行测试并确认通过**

Run: `npm test`

Expected: PASS，1 个测试通过。

- [ ] **Step 5: 提交内容契约**

```bash
git add package.json .gitignore js/content.js tests/content.test.mjs
git commit -m "feat: define invitation content contract"
```

### Task 2: 实现可测试的邀请函状态机

**Files:**
- Create: `js/state.js`
- Create: `tests/state.test.mjs`

- [ ] **Step 1: 写状态机失败测试**

覆盖四条核心规则：默认展开第一趴；展开新面板会关闭旧面板并记录 `viewed`；互动完成加入 `completed`；六趴全部翻阅后 `photoUnlocked === true`。再覆盖损坏 localStorage JSON 会安全回退初始状态。

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, openPart, completePart, decodeState } from '../js/state.js';

test('opening all parts unlocks the group photo', () => {
  let state = createInitialState();
  for (const id of ['part-01', 'part-02', 'part-03', 'part-04', 'part-05', 'part-06']) {
    state = openPart(state, id);
  }
  assert.equal(state.openPartId, 'part-06');
  assert.equal(state.viewed.length, 6);
  assert.equal(state.photoUnlocked, true);
});

test('completion and corrupted storage are handled', () => {
  const completed = completePart(createInitialState(), 'part-02');
  assert.deepEqual(completed.completed, ['part-02']);
  assert.deepEqual(decodeState('{broken'), createInitialState());
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/state.test.mjs`

Expected: FAIL，错误为无法找到 `js/state.js`。

- [ ] **Step 3: 实现不可变纯函数状态机**

实现并导出：

```js
export const PART_IDS = ['part-01', 'part-02', 'part-03', 'part-04', 'part-05', 'part-06'];
export function createInitialState() { /* openPartId/viewed/completed/photoUnlocked/soundOn */ }
export function openPart(state, partId) { /* 校验 id、去重、解锁 */ }
export function completePart(state, partId) { /* 校验 id、去重 */ }
export function toggleSound(state) { /* 返回新对象 */ }
export function encodeState(state) { /* 只序列化公开字段 */ }
export function decodeState(raw) { /* try/catch + 字段白名单 + 回退 */ }
```

`createInitialState()` 将第一趴加入 `viewed`，但不加入 `completed`；`photoUnlocked` 仅依赖六个 `viewed`，不强迫完成小游戏。

- [ ] **Step 4: 运行测试并确认通过**

Run: `npm test`

Expected: PASS，内容契约和状态机测试全部通过。

- [ ] **Step 5: 提交状态机**

```bash
git add js/state.js tests/state.test.mjs
git commit -m "feat: add invitation progress state machine"
```

### Task 3: 生成并整理统一画风的人物资产

**Files:**
- Create: `assets/source/character-sheet.png`
- Create: `assets/characters/noodle-cat.png`
- Create: `assets/characters/product-bear.png`
- Create: `assets/characters/native-ghosts.png`
- Create: `assets/characters/ops-fluffy.png`
- Create: `assets/characters/blogger-dog.png`
- Create: `assets/characters/home-chef.png`
- Create: `assets/characters/group-photo.png`
- Create: `assets/og/party-preview.jpg`

- [ ] **Step 1: 使用 imagegen skill 和六张参考图生成统一角色设定图**

生成时采用规格文档第 5 节的通用提示词、逐角色识别点和负向规则。先制作同一张 3×2 角色设定图以锁定风格；图 3 必须是三个小幽灵，图 1–4 视觉归属客人、图 5–6 视觉归属主人，不在图片中生成任何文字。

- [ ] **Step 2: 逐张生成透明背景角色贴纸**

以设定图作为风格参考，分别导出完整角色 PNG。逐张检查：透明背景、无裁切、无水印、无文字、关键配饰正确、同一描边粗细和同一光线方向。

- [ ] **Step 3: 生成六人合影和分享预览图**

合影保持六个角色数量和位置清晰；预览图使用 1200×630，标题只写 `周日来家里吃面吧！` 与 `龙哥炸酱面 · 好友聚会`，不包含地址门牌和受保护姓名。

- [ ] **Step 4: 做资源尺寸和隐私检查**

Run: `file assets/characters/*.png assets/og/party-preview.jpg`

Expected: 七张角色 PNG 和一张 JPEG 均可识别；分享图尺寸为 1200×630。人工检查所有图像中无意外文字和多余角色。

- [ ] **Step 5: 提交角色资产**

```bash
git add assets/source assets/characters assets/og
git commit -m "feat: add illustrated party character assets"
```

### Task 4: 构建可降级的语义页面骨架

**Files:**
- Create: `index.html`
- Create: `tests/static.test.mjs`

- [ ] **Step 1: 写静态页面失败测试**

读取 `index.html` 字符串并断言：语言为中文；存在日期、完整地址、六个 `<article>`、Google Maps 外链、`og:image` 相对路径、`noscript` 提示；所有本地 `src/href` 不以 `/` 开头；全文不含三个受保护姓名写法。

- [ ] **Step 2: 运行测试并确认失败**

Run: `node --test tests/static.test.mjs`

Expected: FAIL，错误为找不到 `index.html`。

- [ ] **Step 3: 编写完整 HTML 骨架**

页面依次包含：顶部工具、门铃封面、到场阵容、时间便签、地址卡、`TODAY'S PLAN` 六篇文章、隐藏合影、结尾与 `aria-live` Toast。每个折叠按钮使用 `aria-expanded`/`aria-controls`，面板使用 `role="region"`；HTML 内直接写入关键文案，JS 只增强交互。

地图链接格式固定为：

```html
<a href="https://www.google.com/maps/search/?api=1&amp;query=%E5%8C%97%E4%BA%AC%E5%B8%82%E6%98%8C%E5%B9%B3%E5%8C%BA%E9%A3%8E%E9%9B%85%E5%9B%AD%E4%B8%80%E5%8C%BA%2015%20%E5%8F%B7%E6%A5%BC%201%20%E5%8D%95%E5%85%83%20303" target="_blank" rel="noreferrer">Google 地图导航</a>
```

- [ ] **Step 4: 运行静态和全部单测**

Run: `npm test`

Expected: PASS，所有测试通过。

- [ ] **Step 5: 提交语义页面**

```bash
git add index.html tests/static.test.mjs
git commit -m "feat: add accessible invitation document"
```

### Task 5: 落地手账视觉系统与响应式布局

**Files:**
- Create: `styles/tokens.css`
- Create: `styles/base.css`
- Create: `styles/components.css`
- Create: `styles/animations.css`
- Create: `assets/icons/map.svg`
- Create: `assets/icons/copy.svg`
- Create: `assets/icons/share.svg`
- Create: `assets/icons/sound.svg`

- [ ] **Step 1: 写设计令牌和基础纸张样式**

将规格色值定义为 CSS 自定义属性；使用纯 CSS 多层径向渐变制造低对比纸纤维，主体最大宽度 `430px`，最小触摸目标 `44px`，正文最小字号 `16px`。

- [ ] **Step 2: 编写封面、人物、地址和折叠卡组件**

使用不规则边框、伪元素胶带、轻微旋转、白色贴纸描边和纸张阴影。保证地址卡与导航按钮在首屏后半段清晰可见，折叠标题在关闭状态仍显示编号、标题与预告。

- [ ] **Step 3: 编写六个互动场景和隐藏合影布局**

每个互动场景使用独立命名空间类名，如 `.noodle-game__topping`、`.camera-game__shutter`、`.moon-game__track`，避免跨组件耦合；印章分 `viewed` 与 `completed` 两种视觉状态。

- [ ] **Step 4: 添加动画与减少动态降级**

所有动画集中在 `animations.css`，单次持续时间不超过 900ms，不加入永久循环。添加：

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 5: 本地预览并检查 375px 与桌面布局**

Run: `npm run serve`

Expected: `http://localhost:4173` 可打开；375px 下无横向滚动，桌面端手账主体居中，全部按钮焦点态可见。

- [ ] **Step 6: 提交视觉系统**

```bash
git add styles assets/icons
git commit -m "feat: style the scrapbook invitation"
```

### Task 6: 实现折叠、分享、导航和持久化

**Files:**
- Create: `js/ui.js`
- Create: `js/app.js`
- Modify: `index.html`

- [ ] **Step 1: 在 UI 模块实现单开折叠与 ARIA 同步**

导出 `renderState(state)`、`bindAccordion(onOpen)`、`showToast(message)`。`renderState` 同步按钮 `aria-expanded`、面板 `hidden`、翻阅印章、完成印章和合影锁；打开新面板后使用 `scrollIntoView({ block: 'nearest' })`，减少动态模式下不使用平滑滚动。

- [ ] **Step 2: 在 app 模块接入状态持久化和重玩**

使用键名 `longge-party-progress-v1`。每次状态变化后 `localStorage.setItem`；读写失败只影响进度保存，不阻断页面。`重新玩一遍` 清空键并恢复初始状态，但不弹浏览器确认框。

- [ ] **Step 3: 实现地图、复制与分享降级**

- 地图链接使用 `URL`/`searchParams` 生成，并设置完整地址为 `query`。
- 复制优先 `navigator.clipboard.writeText`，失败时选中隐藏 textarea 并调用 `document.execCommand('copy')`。
- 分享优先 `navigator.share`；不支持或非用户取消错误时复制当前 URL。
- 所有结果通过中文 Toast 通知，不用 `alert()`。

- [ ] **Step 4: 加载内容模块并完成初始化**

`app.js` 在 `DOMContentLoaded` 后绑定事件；给 `<html>` 添加 `.js`，让无 JS 时展开全部内容，有 JS 时才启用折叠隐藏。

- [ ] **Step 5: 运行自动测试和浏览器键盘检查**

Run: `npm test`

Expected: PASS。手动用 Tab/Enter/Space 操作六个折叠标题、复制、分享、声音和重玩；同时只能展开一个面板。

- [ ] **Step 6: 提交核心网页行为**

```bash
git add index.html js/ui.js js/app.js
git commit -m "feat: add invitation navigation and sharing"
```

### Task 7: 实现六趴小游戏与声音反馈

**Files:**
- Create: `js/interactions.js`
- Modify: `js/app.js`
- Modify: `styles/components.css`
- Modify: `styles/animations.css`

- [ ] **Step 1: 建立统一互动控制器接口**

`createInteractions({ onComplete, showToast, playSound })` 返回 `mount()` 与 `reset()`。每个小游戏仅能通过 `onComplete(partId)` 改写全局完成状态，不能直接访问 localStorage。

- [ ] **Step 2: 实现 PART 01–02**

- 零食袋点击后为容器添加 `.is-open` 并生成最多 8 个带 `aria-hidden="true"` 的零食贴纸；第一次触发完成 PART 01。
- 配菜按钮逐项切换 `aria-pressed="true"` 并把对应配菜放入面碗；四项齐全完成 PART 02。
- 面碗独立计数三连击；第三次显示“偷偷多加一勺炸酱”彩蛋，不影响完成条件。

- [ ] **Step 3: 实现 PART 03–04**

- 快门点击触发一次闪光和照片吐出；`保存合影` 创建指向 `assets/characters/group-photo.png` 的下载链接，iOS 无法下载时提示长按保存。
- 西瓜点击一次切为六瓣，角色按 CSS 延迟拿走水果；完成后按钮禁用但保留场景最终状态。

- [ ] **Step 4: 实现 PART 05–06**

- 递麦时从六位角色与 `micLines` 中随机选择，避免连续重复同一角色或同一句；气泡使用 `aria-live="polite"`。
- 月亮支持 Pointer Events 拖动，也提供一个可键盘点击的 `让月亮升起` 按钮；到达 80% 或点击按钮后进入夜景并完成 PART 06。
- 门灯点击切换 `.is-lit` 并显示 `下次还来吃面！`。

- [ ] **Step 5: 添加无音频文件依赖的短反馈音**

用 Web Audio API 生成 50–120ms 的低音量提示音；只有 `soundOn` 且 `AudioContext` 由用户手势恢复后播放。门铃、盖章、快门各有不同频率包络；API 不支持时静默降级。

- [ ] **Step 6: 验证重置、重复操作和触摸行为**

手动完成六趴、刷新页面验证印章保持、点击 `重新玩一遍` 验证全部互动恢复。快速重复点击不得生成无限 DOM 节点或重叠音频；触摸拖月亮时页面垂直滚动不被永久锁死。

- [ ] **Step 7: 提交互动玩法**

```bash
git add js/interactions.js js/app.js styles/components.css styles/animations.css
git commit -m "feat: add six interactive party moments"
```

### Task 8: 完成隐私、质量与 GitHub Pages 验证

**Files:**
- Create: `README.md`
- Modify: `index.html`
- Modify: files found by verification only when required

- [ ] **Step 1: 编写本地使用和部署说明**

README 包含：`npm test`、`npm run serve`、新建 GitHub 仓库、添加 remote、推送 `main`、在 Settings → Pages 选择 `Deploy from a branch / main / root`，以及最终 URL 形式 `https://<user>.github.io/<repo>/`。

- [ ] **Step 2: 运行全部自动检查**

Run: `npm test`

Expected: 所有测试 PASS。

Run: `node --input-type=module -e "import fs from 'node:fs'; import path from 'node:path'; const banned=[['8427','7136'],['6f47','7136'],['8096','7136']].map(x=>x.map(c=>String.fromCodePoint(parseInt(c,16))).join('')); const roots=['index.html','js','styles','tests','README.md']; const files=[]; const walk=p=>{if(!fs.existsSync(p))return; const s=fs.statSync(p); if(s.isDirectory())for(const n of fs.readdirSync(p))walk(path.join(p,n)); else files.push(p)}; roots.forEach(walk); const hits=files.filter(f=>banned.some(n=>fs.readFileSync(f,'utf8').includes(n))); if(hits.length){console.error(hits);process.exit(1)}"`

Expected: 无输出。

Run: `rg -n '(src|href)="/' index.html styles js`

Expected: 无输出，确保 GitHub Pages 子路径兼容。

- [ ] **Step 3: 检查页面资源与 HTTP 响应**

启动 `npm run serve` 后运行：

```bash
curl -I http://localhost:4173/
curl -I http://localhost:4173/assets/characters/group-photo.png
curl -I http://localhost:4173/assets/og/party-preview.jpg
```

Expected: 三个请求均为 `HTTP/1.0 200 OK` 或 `HTTP/1.1 200 OK`。

- [ ] **Step 4: 做最终浏览器验收**

在 375×812、430×932 和桌面宽度检查：无横向滚动；Google Maps 查询完整；复制/分享降级有效；六趴单开；翻阅六趴解锁合影；声音默认关闭；减少动态模式可用；刷新保留状态；重玩清空状态；图片无裁切或错位；所有关键文字对比清晰。

- [ ] **Step 5: 检查 Git 状态并提交发布文档**

```bash
git add README.md index.html
git commit -m "docs: add GitHub Pages publishing guide"
git status --short
```

Expected: 提交成功，`git status --short` 无输出。

- [ ] **Step 6: 等待 GitHub 仓库信息后发布**

本地成品完成不自动获得远程仓库权限。获得用户对创建公开仓库与推送的明确授权后，执行：

```bash
gh repo create longge-noodle-party --public --source=. --remote=origin --push
```

随后启用 Pages 并访问最终链接，确认根页面和静态资源均为 200。
