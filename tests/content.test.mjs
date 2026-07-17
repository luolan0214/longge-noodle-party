import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { characters, eventDetails, micLines, parts } from '../js/content.js';

const forbiddenNames = [
  [0x8427, 0x7136],
  [0x6f47, 0x7136],
  [0x8096, 0x7136],
].map((codePoints) => String.fromCodePoint(...codePoints));

test('event details expose the confirmed invitation information', () => {
  assert.equal(eventDetails.title, '周日来家里吃面吧！');
  assert.equal(eventDetails.date, '2026-07-19');
  assert.equal(eventDetails.dateDisplay, '2026.07.19 周日');
  assert.equal(eventDetails.generalArrival, '15:00–16:00');
  assert.equal(eventDetails.nativeArrival, '17:00 特别登场');
  assert.equal(eventDetails.address, '北京市昌平区风雅园一区 15 号楼 1 单元 303');
  assert.equal(eventDetails.mapQuery, eventDetails.address);
  assert.equal(
    eventDetails.mapUrl,
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(eventDetails.address)}`,
  );
});

test('character roster uses the six public identities in guest and host order', () => {
  assert.equal(characters.length, 6);
  assert.deepEqual(
    characters.map(({ role }) => role),
    ['guest', 'guest', 'guest', 'guest', 'host', 'host'],
  );
  assert.equal(characters[2].name, 'AI Native 连续创业者');
  assert.deepEqual(
    characters.map((character) => Object.keys(character)),
    Array.from({ length: 6 }, () => ['id', 'name', 'role', 'arrival', 'image', 'accent']),
  );
});

test('illustrated character and sharing assets use local-only SVG files', async () => {
  assert.deepEqual(
    characters.map(({ image }) => image),
    [
      'assets/characters/noodle-cat.svg',
      'assets/characters/product-bear.svg',
      'assets/characters/native-ghosts.svg',
      'assets/characters/ops-fluffy.svg',
      'assets/characters/blogger-dog.svg',
      'assets/characters/home-chef.svg',
    ],
  );

  const assetPaths = [
    ...characters.map(({ image }) => image),
    'assets/characters/group-photo.svg',
    'assets/og/party-preview.svg',
    'assets/source/character-sheet.svg',
  ];

  await Promise.all(assetPaths.map(async (assetPath) => {
    const assetUrl = new URL(`../${assetPath}`, import.meta.url);
    const source = await readFile(fileURLToPath(assetUrl), 'utf8');

    assert.match(source, /^<svg\b/);
    assert.doesNotMatch(source, /(?:href|src)=["'](?:https?:|\/\/)/i);
  }));
});

test('sharing preview includes a real JPEG export', async () => {
  const assetUrl = new URL('../assets/og/party-preview.jpg', import.meta.url);
  const assetPath = fileURLToPath(assetUrl);
  const assetStats = await stat(assetPath);
  const signature = await readFile(assetPath, { encoding: null });

  assert.equal(assetStats.isFile(), true);
  assert.deepEqual([...signature.subarray(0, 3)], [0xff, 0xd8, 0xff]);
});

test('plan contains the six confirmed parts with continuous identifiers', () => {
  assert.deepEqual(
    parts.map(({ id }) => id),
    ['part-01', 'part-02', 'part-03', 'part-04', 'part-05', 'part-06'],
  );
  assert.deepEqual(
    parts.map(({ number }) => number),
    ['01', '02', '03', '04', '05', '06'],
  );
  assert.deepEqual(
    parts.map(({ title }) => title),
    ['到家集合', '龙哥开饭', '咔嚓留念', '水果时间', '麦克风时间', '快乐散场'],
  );
  assert.deepEqual(
    parts.map((part) => Object.keys(part)),
    Array.from({ length: 6 }, () => ['id', 'number', 'title', 'teaser', 'stamp']),
  );
});

test('microphone copy contains the five confirmed lines', () => {
  assert.deepEqual(micLines, [
    '这个可以说吗？',
    '展开讲讲！',
    '今天不许端水！',
    '掌声在哪里？',
    '刚才那段掐了别播！',
  ]);
});

test('public invitation content excludes protected private names', () => {
  const publicCopy = JSON.stringify({ characters, eventDetails, micLines, parts });

  forbiddenNames.forEach((name) => assert.equal(publicCopy.includes(name), false));
});
