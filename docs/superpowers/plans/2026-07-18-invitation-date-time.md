# Invitation Date and Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将邀请函日期统一为 2026 年 7 月 18 日（周六），并将大部队到场时间统一为 16:00–17:00，同时保持特别来宾和背景音乐不变。

**Architecture:** 保持现有静态 HTML 与 `js/content.js` 双重内容来源，不引入新的抽象。先更新公开内容测试并确认其针对旧文案失败，再最小化修改页面、数据、分享文案、合影文件名、README 与分享预览资产。

**Tech Stack:** HTML5、原生 JavaScript ES Modules、SVG/JPEG、Node.js 内置测试运行器

---

### Task 1: 用测试锁定新日期、星期和到场时间

**Files:**
- Modify: `tests/static.test.mjs:4-50`
- Modify: `tests/content.test.mjs:12-48`
- Modify: `tests/app.test.mjs:150-161`
- Modify: `tests/interactions.test.mjs:460-468`

- [ ] **Step 1: 更新静态页面与分享预览断言**

在 `tests/static.test.mjs` 中读取 `party-preview.svg`，把公开文案期望值改为周六与新时间，并增加旧文案缺席断言：

```js
const previewSvg = await readFile(new URL('../assets/og/party-preview.svg', import.meta.url), 'utf8').catch(() => '');

for (const copy of [
  '周六来家里吃面吧！',
  '龙哥炸酱面 · 好友聚会',
  '2026.07.18 周六',
  "TODAY'S GUEST LIST",
  '今日主人组 · 已就位 ✓',
  '大部队：16:00–17:00',
  'AI Native 连续创业者：17:00 特别登场',
  address,
  'Google 地图导航',
  '复制地址',
]) {
  assert.ok(html.includes(copy), `missing public copy: ${copy}`);
}

assert.doesNotMatch(html, /2026\.07\.19|2026-07-19|周日|15:00–16:00/);
assert.ok(previewSvg.includes('周六来家里吃面吧！'));
assert.equal(previewSvg.includes('周日'), false);
```

- [ ] **Step 2: 更新内容模型断言**

在 `tests/content.test.mjs` 中更新活动字段，并锁定四位客人的到场时间顺序：

```js
assert.equal(eventDetails.title, '周六来家里吃面吧！');
assert.equal(eventDetails.date, '2026-07-18');
assert.equal(eventDetails.dateDisplay, '2026.07.18 周六');
assert.equal(eventDetails.generalArrival, '16:00–17:00');
assert.equal(eventDetails.nativeArrival, '17:00 特别登场');

assert.deepEqual(
  characters.slice(0, 4).map(({ arrival }) => arrival),
  ['16:00–17:00', '16:00–17:00', '17:00 特别登场', '16:00–17:00'],
);
```

- [ ] **Step 3: 更新分享与合影文件名断言**

在 `tests/app.test.mjs` 和 `tests/interactions.test.mjs` 中分别更新：

```js
assert.deepEqual(data, {
  title: '周六来家里吃面吧！',
  text: '周六一起吃面，打开邀请函看看吧！',
  url: 'https://example.com/party',
});

assert.equal(fixture.downloadLinks[0].download, '周六面聚会合影.png');
```

- [ ] **Step 4: 运行目标测试并确认 RED**

Run: `node --test tests/static.test.mjs tests/content.test.mjs tests/app.test.mjs tests/interactions.test.mjs`

Expected: FAIL；失败信息应指向旧的周日、`2026-07-19` 或 `15:00–16:00` 内容，而不是语法错误。

- [ ] **Step 5: 提交失败测试**

```bash
git add tests/static.test.mjs tests/content.test.mjs tests/app.test.mjs tests/interactions.test.mjs
git commit -m "test: 锁定周六聚会日期与到场时间"
```

### Task 2: 更新页面、内容数据与衍生文案

**Files:**
- Modify: `index.html:6-10,31-32,49-61,80,208`
- Modify: `js/content.js:3-44`
- Modify: `js/app.js:22-27`
- Modify: `js/interactions.js:252-264`
- Modify: `README.md:1-10`
- Modify: `assets/og/party-preview.svg:21`

- [ ] **Step 1: 更新 HTML 公开信息**

将 `index.html` 中的公开信息统一为：

```html
<title>周六面聚会邀请</title>
<meta name="description" content="2026 年 7 月 18 日，来家里吃龙哥炸酱面，和朋友一起过个热闹周六。">
<meta property="og:title" content="周六来家里吃面吧！">
<meta property="og:description" content="龙哥炸酱面 · 好友聚会，2026.07.18 周六。">
<h1 id="invitation-title">周六来家里吃面吧！</h1>
<time datetime="2026-07-18">2026.07.18 周六</time>
```

三位普通来宾使用 `<span>16:00–17:00</span>`，到场时间卡使用 `<strong>大部队：16:00–17:00</strong>`，合影标题使用 `<h2 id="group-photo-title">周六合影</h2>`。特别来宾仍为 `17:00 特别登场`。

- [ ] **Step 2: 更新 JavaScript 内容数据**

将 `js/content.js` 的活动字段改为：

```js
export const eventDetails = {
  title: '周六来家里吃面吧！',
  date: '2026-07-18',
  dateDisplay: '2026.07.18 周六',
  generalArrival: '16:00–17:00',
  nativeArrival: '17:00 特别登场',
  address,
  mapQuery: address,
  mapUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`,
};
```

并把 `noodle-cat`、`product-bear`、`ops-fluffy` 的 `arrival` 改为 `16:00–17:00`，保持 `native-ghosts` 不变。

- [ ] **Step 3: 更新分享、下载和说明文案**

将 `js/app.js` 分享文本改为：

```js
text: '周六一起吃面，打开邀请函看看吧！',
```

将 `js/interactions.js` 下载文件名改为：

```js
link.download = '周六面聚会合影.png';
```

将 `README.md` 标题改为 `# 周六面聚会互动邀请函`，并把功能说明里的“周日”同步为“周六”。

- [ ] **Step 4: 更新 SVG 分享预览文案**

将 `assets/og/party-preview.svg` 的主标题改为：

```svg
<text x="82" y="160" fill="#663C2A" font-family="ui-rounded, 'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif" font-size="66" font-weight="900" letter-spacing="2">周六来家里吃面吧！</text>
```

- [ ] **Step 5: 运行目标测试并确认 GREEN**

Run: `node --test tests/static.test.mjs tests/content.test.mjs tests/app.test.mjs tests/interactions.test.mjs`

Expected: 所有目标测试 PASS，0 failures。

- [ ] **Step 6: 提交文本与数据实现**

```bash
git add index.html js/content.js js/app.js js/interactions.js README.md assets/og/party-preview.svg
git commit -m "feat: 更新聚会日期与到场时间"
```

### Task 3: 重建分享预览位图并完成全量验证

**Files:**
- Modify: `assets/og/party-preview.jpg`
- Verify: `tests/release.test.mjs`

- [ ] **Step 1: 从更新后的 SVG 生成 1200×630 PNG 缓存**

Run: `qlmanage -t -s 1200 -o /tmp assets/og/party-preview.svg`

Expected: 生成 `/tmp/party-preview.svg.png`。

- [ ] **Step 2: 转换为项目 JPEG 并核对尺寸**

```bash
sips -s format jpeg /tmp/party-preview.svg.png --out assets/og/party-preview.jpg
sips -g pixelWidth -g pixelHeight assets/og/party-preview.jpg
```

Expected: `pixelWidth: 1200`、`pixelHeight: 630`。

- [ ] **Step 3: 扫描旧文案**

Run: `rg -n "2026-07-19|2026\.07\.19|2026 年 7 月 19 日|周日|15:00–16:00" index.html js README.md assets/og/party-preview.svg tests`

Expected: 无匹配。

- [ ] **Step 4: 运行完整测试**

Run: `npm test`

Expected: 全部测试 PASS，0 failures。

- [ ] **Step 5: 检查最终差异并提交位图**

```bash
git diff --check
git status --short
git add assets/og/party-preview.jpg
git commit -m "chore: 重建周六聚会分享预览图"
```

Expected: 只包含本计划列出的变更，提交后工作区干净。
