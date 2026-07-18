import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8').catch(() => '');
const address = '北京市昌平区风雅园一区 15 号楼 1 单元 303';
const forbiddenNames = [
  [0x8427, 0x7136],
  [0x6f47, 0x7136],
  [0x8096, 0x7136],
].map((codePoints) => String.fromCodePoint(...codePoints));

function openingTagWith(attribute, value) {
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<[^>]+\\b${attribute}=["']${escapedValue}["'][^>]*>`, 'i');
}

test('document declares Chinese metadata and relative Open Graph artwork', () => {
  assert.match(html, /<html\b[^>]*\blang=["']zh-CN["']/i);
  assert.match(html, /<meta\b[^>]*\bcharset=["']utf-8["']/i);
  assert.match(html, /<meta\b[^>]*\bname=["']viewport["'][^>]*\bcontent=["'][^"']*width=device-width/i);
  assert.ok(html.includes('<title>周日面聚会邀请</title>'));
  assert.match(html, openingTagWith('name', 'description'));
  assert.match(html, openingTagWith('name', 'theme-color'));

  for (const property of ['og:title', 'og:description', 'og:type']) {
    assert.match(html, openingTagWith('property', property));
  }
  assert.match(
    html,
    /<meta\b(?=[^>]*\bproperty=["']og:image["'])(?=[^>]*\bcontent=["']assets\/og\/party-preview\.jpg["'])[^>]*>/i,
  );
});

test('cover, roster, arrival notes, and address remain readable without JavaScript', () => {
  for (const copy of [
    '周日来家里吃面吧！',
    '龙哥炸酱面 · 好友聚会',
    '2026.07.19 周日',
    "TODAY'S GUEST LIST",
    '今日主人组 · 已就位 ✓',
    '大部队：15:00–16:00',
    'AI Native 连续创业者：17:00 特别登场',
    address,
    'Google 地图导航',
    '复制地址',
  ]) {
    assert.ok(html.includes(copy), `missing public copy: ${copy}`);
  }

  assert.match(html, /<button\b[^>]*\bdata-action=["']toggle-sound["'][^>]*>/i);
  assert.match(html, /<button\b[^>]*\bdata-action=["']share["'][^>]*>/i);
  assert.match(html, /<button\b[^>]*\bdata-action=["']doorbell["'][^>]*>/i);
  assert.equal((html.match(/\bdata-roster-role=["']guest["']/gi) ?? []).length, 4);
  assert.equal((html.match(/\bdata-roster-role=["']host["']/gi) ?? []).length, 2);
});

test('map link contains the exact encoded address and safe external-link attributes', () => {
  const mapUrl = `https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(address)}`;
  const mapTag = html.match(/<a\b[^>]*>Google 地图导航<\/a>/i)?.[0] ?? '';

  assert.ok(mapTag.includes(`href="${mapUrl}"`));
  assert.match(mapTag, /\btarget=["']_blank["']/i);
  assert.match(mapTag, /\brel=["']noreferrer["']/i);
});

test('plan provides exactly six accessible, fully visible fallback articles', () => {
  const articles = html.match(/<article\b[\s\S]*?<\/article>/gi) ?? [];
  assert.equal(articles.length, 6);

  articles.forEach((article, index) => {
    const number = String(index + 1).padStart(2, '0');
    const partId = `part-${number}`;
    const buttonId = `${partId}-button`;
    const panelId = `${partId}-panel`;

    assert.match(article, openingTagWith('data-part-id', partId));
    assert.match(
      article,
      new RegExp(`<button\\b(?=[^>]*\\bid=["']${buttonId}["'])(?=[^>]*\\baria-expanded=["'](?:true|false)["'])(?=[^>]*\\baria-controls=["']${panelId}["'])[^>]*>`, 'i'),
    );
    assert.match(
      article,
      new RegExp(`<[^>]+\\b(?:id=["']${panelId}["'][^>]*\\brole=["']region["']|role=["']region["'][^>]*\\bid=["']${panelId}["'])[^>]*\\baria-labelledby=["']${buttonId}["'][^>]*>`, 'i'),
    );
    assert.doesNotMatch(article, new RegExp(`<[^>]+\\bid=["']${panelId}["'][^>]*\\bhidden(?:\\s|=|>)`, 'i'));
  });

  articles.forEach((article) => assert.match(article, /aria-expanded=["']true["']/i));
});

test('plan uses all six confirmed titles in order', () => {
  const articles = html.match(/<article\b[\s\S]*?<\/article>/gi) ?? [];
  const titles = ['到家集合', '龙哥开饭', '咔嚓留念', '水果时间', '麦克风时间', '快乐散场'];

  assert.equal(articles.length, titles.length);
  titles.forEach((title, index) => {
    const number = String(index + 1).padStart(2, '0');
    assert.ok(articles[index].includes(`PART ${number} · ${title}`), `missing PART ${number} title: ${title}`);
  });
});

test('all six confirmed plan scenes and stamp copy are present', () => {
  for (const copy of [
    '放下包包，先随便坐！', '零食袋', '糖果罐', '饮料', '水果篮',
    '食材和零食都准备好啦，大家带着嘴来就好！', '顺利会师',
    '今日主角：龙哥牌炸酱面', '黄瓜丝', '胡萝卜丝', '豆芽', '炸酱', '面碗', '香迷糊了',
    '吃面不拍照，等于没吃到！', '保存合影', '再拍一张', '今日份回忆',
    '饭后水果，给胃留个甜甜的结尾。', '水果自由',
    '吐槽大会 × 家庭脱口秀', '递麦', '全场最佳',
    '吃饱了，也笑累了。', '下次还来吃面！', '平安到家',
  ]) {
    assert.ok(html.includes(copy), `missing plan copy: ${copy}`);
  }

  assert.equal((html.match(/\bdata-topping=/g) ?? []).length, 4);
  assert.equal((html.match(/\bdata-photo-character=/g) ?? []).length, 6);
  assert.match(
    html,
    /<img\b(?=[^>]*\bdata-camera-photo\b)(?=[^>]*\bsrc=["']assets\/characters\/group-photo\.png["'])[^>]*>/i,
  );
  assert.equal((html.match(/\bdata-watermelon-slice=/g) ?? []).length, 6);
  assert.match(html, /<[^>]+\bdata-mic-bubble[^>]*\baria-live=["']polite["'][^>]*>/i);
  assert.match(html, /<input\b[^>]*\btype=["']range["'][^>]*>/i);
  assert.match(html, openingTagWith('data-moon-track', ''));
  assert.match(html, /<button\b[^>]*\bdata-action=["']moon-keyboard-step["'][^>]*>/i);
  assert.match(html, /<button\b[^>]*\bdata-action=["']door-light["'][^>]*>/i);
});

test('locked group-photo ending uses the production image and complete copy', () => {
  assert.match(
    html,
    /<img\b(?=[^>]*\bsrc=["']assets\/characters\/group-photo\.png["'])(?=[^>]*\balt=["'][^"']+["'])[^>]*>/i,
  );
  for (const copy of [
    '六个环节全部翻阅后解锁合影',
    '普通的一顿饭，因为是我们，就变成了值得保存的一天。',
    '明天见，不见不散！',
    '重新玩一遍',
  ]) {
    assert.ok(html.includes(copy), `missing ending copy: ${copy}`);
  }
});

test('critical accessibility and no-script fallbacks are explicit', () => {
  assert.match(html, /<main\b[^>]*\bid=["']main-content["']/i);
  assert.match(html, /<nav\b[^>]*\baria-label=["'][^"']+["']/i);
  assert.match(html, /<noscript>[\s\S]*互动功能不可用[\s\S]*邀请信息仍可阅读[\s\S]*<\/noscript>/i);
  assert.match(html, /<[^>]+\bid=["']toast["'][^>]*\baria-live=["']polite["'][^>]*>/i);

  const images = html.match(/<img\b[^>]*>/gi) ?? [];
  assert.ok(images.length >= 13);
  images.forEach((image) => assert.match(image, /\balt=["'][^"']+["']/i));
});

test('document IDs are unique and ARIA ID references resolve', () => {
  const ids = [...html.matchAll(/<[^>]+\sid=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);
  const idSet = new Set(ids);

  assert.equal(idSet.size, ids.length, 'document IDs must be unique');
  for (const attribute of ['aria-controls', 'aria-labelledby']) {
    const references = [...html.matchAll(new RegExp(`\\b${attribute}=["']([^"']+)["']`, 'gi'))]
      .flatMap((match) => match[1].trim().split(/\s+/));
    references.forEach((reference) => {
      assert.ok(idSet.has(reference), `${attribute} references missing ID: ${reference}`);
    });
  }
});

test('generic containers with accessible names expose a group role', () => {
  const namedDivs = html.match(/<div\b(?=[^>]*\baria-label=["'][^"']+["'])[^>]*>/gi) ?? [];

  assert.ok(namedDivs.length > 0);
  namedDivs.forEach((tag) => assert.match(tag, /\brole=["']group["']/i));
});

test('local resources are subpath-safe and source excludes protected names', () => {
  const resourceUrls = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)].map((match) => match[1]);
  const localUrls = resourceUrls.filter((url) => !/^(?:https?:|\/\/|#|mailto:|tel:|data:)/i.test(url));

  assert.ok(localUrls.length > 0);
  localUrls.forEach((url) => assert.equal(url.startsWith('/'), false, `root-relative resource: ${url}`));
  forbiddenNames.forEach((name) => assert.equal(html.includes(name), false));
});
