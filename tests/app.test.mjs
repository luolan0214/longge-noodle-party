import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  STORAGE_KEY,
  buildMapUrl,
  copyText,
  createInvitationController,
  createShareData,
  initInvitation,
  loadState,
  removeState,
  saveState,
  shareInvitation,
} from '../js/app.js';
import { createInitialState } from '../js/state.js';
import { bindAccordion, renderState, showToast } from '../js/ui.js';

const address = '北京市昌平区风雅园一区 15 号楼 1 单元 303';
const protectedNames = [
  [0x8427, 0x7136],
  [0x6f47, 0x7136],
  [0x8096, 0x7136],
].map((points) => String.fromCodePoint(...points));

class FakeClassList {
  constructor(...names) {
    this.names = new Set(names);
  }

  toggle(name, force) {
    if (force) this.names.add(name);
    else this.names.delete(name);
  }

  add(...names) {
    names.forEach((name) => this.names.add(name));
  }

  remove(...names) {
    names.forEach((name) => this.names.delete(name));
  }

  contains(name) {
    return this.names.has(name);
  }
}

function fakeElement(properties = {}) {
  const attributes = new Map();
  const listeners = new Map();

  return {
    classList: new FakeClassList(),
    hidden: false,
    textContent: '',
    ...properties,
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    addEventListener(name, listener) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
    },
    removeEventListener(name, listener) { listeners.get(name)?.delete(listener); },
    dispatch(name, event = {}) {
      const results = [...(listeners.get(name) ?? [])]
        .map((listener) => listener({ currentTarget: this, preventDefault() {}, ...event }));
      if (results.length <= 1) return results[0];
      return Promise.all(results);
    },
    listenerCount(name) { return listeners.get(name)?.size ?? 0; },
  };
}

function installEventTarget(target) {
  const listeners = new Map();
  target.addEventListener = (name, listener) => {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(listener);
  };
  target.removeEventListener = (name, listener) => listeners.get(name)?.delete(listener);
  target.emit = (name, event = {}) => {
    const results = [...(listeners.get(name) ?? [])].map((listener) => listener(event));
    return results.length <= 1 ? results[0] : Promise.all(results);
  };
  target.listenerCount = (name) => listeners.get(name)?.size ?? 0;
  return target;
}

function createUiFixture() {
  const makeArticle = (partId, stampCopy) => {
    const toggle = fakeElement();
    const panel = fakeElement();
    const stamp = fakeElement({ textContent: stampCopy });
    const article = fakeElement({
      dataset: { partId },
      scrollCalls: [],
      querySelector(selector) {
        return {
          '.plan-card__toggle': toggle,
          '.plan-card__panel': panel,
          '[data-stamp]': stamp,
        }[selector] ?? null;
      },
      scrollIntoView(options) { this.scrollCalls.push(options); },
    });
    return { article, toggle, panel, stamp };
  };
  const parts = [
    makeArticle('part-01', '顺利会师'),
    makeArticle('part-02', '香迷糊了'),
  ];
  const lockCopy = fakeElement();
  const photo = fakeElement();
  const photoSection = fakeElement({
    querySelector(selector) {
      return selector === '.group-photo__lock' ? lockCopy : selector === 'img' ? photo : null;
    },
  });
  const soundLabel = fakeElement();
  const soundButton = fakeElement({
    querySelector: (selector) => selector === 'span' ? soundLabel : null,
  });
  const toast = fakeElement();
  const root = {
    querySelectorAll: (selector) => selector === '[data-part-id]' ? parts.map(({ article }) => article) : [],
    querySelector(selector) {
      return {
        '[data-photo-lock]': photoSection,
        '[data-action="toggle-sound"]': soundButton,
      }[selector] ?? null;
    },
    getElementById: (id) => id === 'toast' ? toast : null,
  };

  return { root, parts, photoSection, lockCopy, photo, soundButton, soundLabel, toast };
}

test('buildMapUrl replaces query with the complete address through URLSearchParams', () => {
  const result = buildMapUrl('https://www.google.com/maps/search/?api=1&query=old', address);
  const url = new URL(result);

  assert.equal(url.origin, 'https://www.google.com');
  assert.equal(url.pathname, '/maps/search/');
  assert.equal(url.searchParams.get('api'), '1');
  assert.equal(url.searchParams.get('query'), address);
  assert.equal([...url.searchParams.getAll('query')].length, 1);
});

test('share data has the public title and never includes the private address or protected names', () => {
  const url = 'https://example.test/invitation/';
  const data = createShareData(url);
  const publicShareCopy = JSON.stringify(data);

  assert.deepEqual(data, {
    title: '周日来家里吃面吧！',
    text: '周日一起吃面，打开邀请函看看吧！',
    url,
  });
  assert.equal(publicShareCopy.includes(address), false);
  protectedNames.forEach((name) => assert.equal(publicShareCopy.includes(name), false));
});

test('storage helpers round-trip encoded state with the versioned key', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const state = { ...createInitialState(), soundOn: true };

  assert.equal(STORAGE_KEY, 'longge-party-progress-v1');
  assert.equal(saveState(state, storage), true);
  assert.deepEqual(loadState(storage), state);
  assert.equal(removeState(storage), true);
  assert.deepEqual(loadState(storage), createInitialState());
});

test('storage read, write, and remove failures degrade silently and notify the caller', () => {
  const errors = [];
  const storage = {
    getItem: () => { throw new Error('blocked read'); },
    setItem: () => { throw new Error('blocked write'); },
    removeItem: () => { throw new Error('blocked remove'); },
  };

  assert.deepEqual(loadState(storage, (error) => errors.push(error.message)), createInitialState());
  assert.equal(saveState(createInitialState(), storage, (error) => errors.push(error.message)), false);
  assert.equal(removeState(storage, (error) => errors.push(error.message)), false);
  assert.deepEqual(errors, ['blocked read', 'blocked write', 'blocked remove']);
});

test('copyText uses the async clipboard when available', async () => {
  const copied = [];
  const clipboard = { writeText: async (value) => copied.push(value) };

  assert.equal(await copyText('完整文本', { clipboard }), true);
  assert.deepEqual(copied, ['完整文本']);
});

test('copyText falls back to a hidden textarea and removes it afterward', async () => {
  const events = [];
  const textarea = {
    value: '',
    style: {},
    setAttribute: (name, value) => events.push(['attribute', name, value]),
    select: () => events.push(['select']),
    remove: () => events.push(['remove']),
  };
  const document = {
    body: { append: (element) => events.push(['append', element]) },
    createElement: (tagName) => {
      assert.equal(tagName, 'textarea');
      return textarea;
    },
    execCommand: (command) => {
      events.push(['command', command]);
      return true;
    },
  };
  const clipboard = { writeText: async () => { throw new Error('denied'); } };

  assert.equal(await copyText('备用复制', { clipboard, document }), true);
  assert.equal(textarea.value, '备用复制');
  assert.equal(textarea.style.position, 'fixed');
  assert.deepEqual(events.at(-1), ['remove']);
});

test('copyText returns false when neither clipboard path can copy', async () => {
  const document = {
    body: { append() {} },
    createElement: () => ({ style: {}, setAttribute() {}, select() {}, remove() {} }),
    execCommand: () => false,
  };

  assert.equal(await copyText('x', { document }), false);
});

test('shareInvitation uses native share and treats cancellation as handled', async () => {
  const shared = [];
  const data = createShareData('https://example.test/');

  assert.equal(await shareInvitation(data, {
    share: async (value) => shared.push(value),
  }), 'shared');
  assert.deepEqual(shared, [data]);

  assert.equal(await shareInvitation(data, {
    share: async () => { throw Object.assign(new Error('cancelled'), { name: 'AbortError' }); },
  }), 'aborted');
});

test('shareInvitation copies the current URL when native sharing is unavailable or fails', async () => {
  const copied = [];
  const data = createShareData('https://example.test/current');
  const copy = async (value) => {
    copied.push(value);
    return true;
  };

  assert.equal(await shareInvitation(data, { copy }), 'copied');
  assert.equal(await shareInvitation(data, {
    share: async () => { throw new Error('share failed'); },
    copy,
  }), 'copied');
  assert.deepEqual(copied, [data.url, data.url]);
});

test('controller persists and renders navigation, completion, and sound state', () => {
  const rendered = [];
  const persisted = [];
  const sounds = [];
  const controller = createInvitationController({
    initialState: createInitialState(),
    render: (state) => rendered.push(state),
    persist: (state) => persisted.push(state),
    soundPlayer: (effect) => sounds.push(effect),
  });

  controller.open('part-03');
  controller.complete('part-03');
  assert.equal(controller.playSound('camera'), false);
  controller.toggleSound();
  assert.equal(controller.playSound('camera'), true);

  assert.deepEqual(controller.getState(), {
    openPartId: 'part-03',
    viewed: ['part-01', 'part-03'],
    completed: ['part-03'],
    photoUnlocked: false,
    soundOn: true,
  });
  assert.equal(rendered.length, 4);
  assert.equal(persisted.length, 3);
  assert.deepEqual(sounds, ['camera']);
});

test('controller reset clears persistence, restores state, and announces reset', () => {
  let clears = 0;
  let resets = 0;
  const rendered = [];
  const controller = createInvitationController({
    initialState: { ...createInitialState(), completed: ['part-01'] },
    render: (state) => rendered.push(state),
    clear: () => { clears += 1; },
    onReset: () => { resets += 1; },
  });

  controller.reset();

  assert.deepEqual(controller.getState(), createInitialState());
  assert.equal(clears, 1);
  assert.equal(resets, 1);
  assert.deepEqual(rendered.at(-1), createInitialState());
});

test('renderState keeps exactly one panel open and exposes viewed/completed stamp state', () => {
  const fixture = createUiFixture();
  const state = {
    ...createInitialState(),
    openPartId: 'part-02',
    viewed: ['part-01', 'part-02'],
    completed: ['part-01'],
  };

  renderState(state, fixture.root);

  const [first, second] = fixture.parts;
  assert.equal(first.article.classList.contains('is-viewed'), true);
  assert.equal(first.article.classList.contains('is-completed'), true);
  assert.equal(first.panel.hidden, true);
  assert.equal(first.toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(first.stamp.getAttribute('aria-label'), '已完成：顺利会师');
  assert.equal(first.stamp.getAttribute('data-completed'), 'true');

  assert.equal(second.article.classList.contains('is-viewed'), true);
  assert.equal(second.article.classList.contains('is-completed'), false);
  assert.equal(second.panel.hidden, false);
  assert.equal(second.toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(second.stamp.getAttribute('aria-label'), '已翻阅：香迷糊了');
  assert.equal(second.stamp.getAttribute('data-completed'), 'false');
});

test('renderState synchronizes locked photo and muted sound controls', () => {
  const fixture = createUiFixture();

  renderState(createInitialState(), fixture.root);

  assert.equal(fixture.photoSection.classList.contains('locked'), true);
  assert.equal(fixture.photoSection.classList.contains('unlocked'), false);
  assert.equal(fixture.lockCopy.hidden, false);
  assert.equal(fixture.photo.hidden, true);
  assert.equal(fixture.soundButton.getAttribute('aria-pressed'), 'false');
  assert.equal(fixture.soundButton.getAttribute('aria-label'), '开启声音');
  assert.equal(fixture.soundLabel.textContent, '声音关');
});

test('renderState reveals unlocked photo and enabled sound controls', () => {
  const fixture = createUiFixture();
  const state = {
    ...createInitialState(),
    photoUnlocked: true,
    soundOn: true,
  };

  renderState(state, fixture.root);

  assert.equal(fixture.photoSection.classList.contains('locked'), false);
  assert.equal(fixture.photoSection.classList.contains('unlocked'), true);
  assert.equal(fixture.lockCopy.hidden, true);
  assert.equal(fixture.photo.hidden, false);
  assert.equal(fixture.soundButton.getAttribute('aria-pressed'), 'true');
  assert.equal(fixture.soundButton.getAttribute('aria-label'), '关闭声音');
  assert.equal(fixture.soundLabel.textContent, '声音开');
});

test('bindAccordion opens from native button clicks and scrolls smoothly when motion is allowed', () => {
  const fixture = createUiFixture();
  const opened = [];
  const unbind = bindAccordion(
    (partId) => opened.push(partId),
    fixture.root,
    { matchMedia: () => ({ matches: false }) },
  );

  fixture.parts[1].toggle.dispatch('click');

  assert.deepEqual(opened, ['part-02']);
  assert.deepEqual(fixture.parts[1].article.scrollCalls, [{ block: 'nearest', behavior: 'smooth' }]);
  unbind();
});

test('bindAccordion avoids smooth scrolling for reduced motion', () => {
  const fixture = createUiFixture();
  bindAccordion(
    () => {},
    fixture.root,
    { matchMedia: () => ({ matches: true }) },
  );

  fixture.parts[0].toggle.dispatch('click');

  assert.deepEqual(fixture.parts[0].article.scrollCalls, [{ block: 'nearest', behavior: 'auto' }]);
});

test('bindAccordion does not scroll when the requested panel was already open', () => {
  const fixture = createUiFixture();
  bindAccordion(
    () => false,
    fixture.root,
    { matchMedia: () => ({ matches: false }) },
  );

  fixture.parts[0].toggle.dispatch('click');

  assert.deepEqual(fixture.parts[0].article.scrollCalls, []);
});

test('showToast writes status copy and clears it after the timeout', () => {
  const fixture = createUiFixture();
  let scheduled;
  const timers = {
    clearTimeout() {},
    setTimeout(callback, delay) {
      scheduled = callback;
      assert.equal(delay, 2600);
      return 1;
    },
  };

  showToast('已复制', fixture.root, timers);
  assert.equal(fixture.toast.textContent, '已复制');

  scheduled();
  assert.equal(fixture.toast.textContent, '');
});

test('initInvitation wires map, persistence, controls, and the public completion API', async () => {
  const fixture = createUiFixture();
  const copied = [];
  const shared = [];
  const stored = new Map();
  const removed = [];
  const documentEvents = new Map();
  const dispatched = [];
  const addressElement = fakeElement({ textContent: address });
  const mapLink = fakeElement({ href: 'https://www.google.com/maps/search/?api=1&query=old' });
  const copyButton = fakeElement();
  const shareButton = fakeElement();
  const replayButton = fakeElement();
  const snack = fakeElement();
  const snackButton = fakeElement({
    dataset: { action: 'open-snack-bag' },
    closest: () => snackButton,
  });
  const originalQuerySelector = fixture.root.querySelector.bind(fixture.root);
  const selectors = {
    '#party-address': addressElement,
    '.address-card__actions a': mapLink,
    '[data-action="copy-address"]': copyButton,
    '[data-action="share"]': shareButton,
    '[data-action="replay"]': replayButton,
    '[data-action="toggle-sound"]': fixture.soundButton,
    '.snack-game': snack,
  };
  fixture.root.querySelector = (selector) => selectors[selector] ?? originalQuerySelector(selector);
  fixture.root.addEventListener = (name, listener) => documentEvents.set(name, listener);
  fixture.root.dispatchEvent = (event) => dispatched.push(event.type);
  fixture.root.documentElement = fakeElement();
  fixture.root.createElement = () => fakeElement({ style: {}, select() {}, remove() {} });
  fixture.root.body = { append() {} };
  fixture.root.execCommand = () => true;

  class CustomEvent {
    constructor(type, options) {
      this.type = type;
      this.detail = options?.detail;
    }
  }

  const window = {
    location: { href: 'https://example.test/invitation/?from=friend' },
    localStorage: {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
      removeItem: (key) => {
        stored.delete(key);
        removed.push(key);
      },
    },
    navigator: {
      clipboard: { writeText: async (value) => copied.push(value) },
      share: async (data) => shared.push(data),
    },
    matchMedia: () => ({ matches: false }),
    CustomEvent,
  };

  const controller = initInvitation({ document: fixture.root, window });

  assert.equal(new URL(mapLink.href).searchParams.get('query'), address);
  assert.strictEqual(window.partyInvitation, controller);
  assert.deepEqual(controller.getState(), createInitialState());

  documentEvents.get('click')({ target: snackButton });
  assert.deepEqual(controller.getState().completed, ['part-01']);
  assert.equal(snack.classList.contains('is-open'), true);
  assert.ok(stored.has(STORAGE_KEY));

  fixture.parts[1].toggle.dispatch('click');
  assert.equal(controller.getState().openPartId, 'part-02');
  assert.ok(stored.has(STORAGE_KEY));

  documentEvents.get('party:complete')({ detail: { partId: 'part-02' } });
  assert.deepEqual(controller.getState().completed, ['part-01', 'part-02']);

  await copyButton.dispatch('click');
  assert.deepEqual(copied, [address]);
  assert.equal(fixture.toast.textContent, '地址已复制');

  await shareButton.dispatch('click');
  assert.equal(shared[0].url, window.location.href);
  assert.equal(JSON.stringify(shared[0]).includes(address), false);

  fixture.soundButton.dispatch('click');
  assert.equal(controller.getState().soundOn, true);

  replayButton.dispatch('click');
  assert.deepEqual(controller.getState(), createInitialState());
  assert.equal(snack.classList.contains('is-open'), false);
  assert.deepEqual(removed, [STORAGE_KEY]);
  assert.deepEqual(dispatched, ['party:reset']);
});

test('initInvitation reports blocked storage only once while keeping controls usable', () => {
  const fixture = createUiFixture();
  const originalQuerySelector = fixture.root.querySelector.bind(fixture.root);
  fixture.root.querySelector = (selector) => selector === '[data-action="toggle-sound"]'
    ? fixture.soundButton
    : originalQuerySelector(selector);
  fixture.root.addEventListener = () => {};
  fixture.root.dispatchEvent = () => {};
  fixture.root.documentElement = fakeElement();
  const window = {
    location: { href: 'https://example.test/' },
    get localStorage() { throw new Error('blocked'); },
    navigator: {},
    matchMedia: () => ({ matches: true }),
    CustomEvent: class { constructor(type) { this.type = type; } },
  };

  const controller = initInvitation({ document: fixture.root, window });
  assert.equal(fixture.toast.textContent, '无法保存进度，但不影响本次使用');

  controller.open('part-02');
  controller.complete('part-02');
  assert.equal(fixture.toast.textContent, '无法保存进度，但不影响本次使用');
  assert.equal(controller.getState().openPartId, 'part-02');
});

test('reinitializing destroys previous bindings so one click updates only once', () => {
  const fixture = createUiFixture();
  installEventTarget(fixture.root);
  fixture.root.dispatchEvent = () => {};
  fixture.root.documentElement = fakeElement();
  let writes = 0;
  const window = {
    location: { href: 'https://example.test/' },
    localStorage: {
      getItem: () => null,
      setItem: () => { writes += 1; },
      removeItem() {},
    },
    navigator: {},
    matchMedia: () => ({ matches: false }),
    CustomEvent: class { constructor(type) { this.type = type; } },
  };

  const first = initInvitation({ document: fixture.root, window });
  const second = initInvitation({ document: fixture.root, window });

  assert.equal(typeof first.destroy, 'function');
  assert.strictEqual(window.partyInvitation, second);
  assert.equal(fixture.root.listenerCount('click'), 1);
  assert.equal(fixture.root.listenerCount('party:complete'), 1);
  assert.equal(fixture.parts[1].toggle.listenerCount('click'), 1);
  assert.equal(fixture.soundButton.listenerCount('click'), 1);

  fixture.parts[1].toggle.dispatch('click');
  assert.equal(writes, 1);
  assert.equal(fixture.parts[1].article.scrollCalls.length, 1);
});

test('destroy removes invitation listeners and prevents later DOM events from updating state', () => {
  const fixture = createUiFixture();
  installEventTarget(fixture.root);
  fixture.root.dispatchEvent = () => {};
  fixture.root.documentElement = fakeElement();
  let writes = 0;
  const window = {
    location: { href: 'https://example.test/' },
    localStorage: {
      getItem: () => null,
      setItem: () => { writes += 1; },
      removeItem() {},
    },
    navigator: {},
    matchMedia: () => ({ matches: false }),
    CustomEvent: class { constructor(type) { this.type = type; } },
  };
  const controller = initInvitation({ document: fixture.root, window });
  const stateBeforeDestroy = controller.getState();

  assert.equal(typeof controller.destroy, 'function');
  assert.equal(controller.destroy(), true);
  assert.equal(controller.destroy(), false);
  assert.equal(fixture.root.listenerCount('click'), 0);
  assert.equal(fixture.root.listenerCount('party:complete'), 0);
  assert.equal(fixture.parts[1].toggle.listenerCount('click'), 0);
  assert.equal(fixture.soundButton.listenerCount('click'), 0);

  fixture.parts[1].toggle.dispatch('click');
  fixture.soundButton.dispatch('click');
  fixture.root.emit('party:complete', { detail: { partId: 'part-02' } });
  assert.strictEqual(controller.getState(), stateBeforeDestroy);
  assert.equal(writes, 0);
  assert.equal(window.partyInvitation, undefined);
});

test('HTML enables progressive enhancement early while keeping no-JS panels readable', async () => {
  const [html, appSource] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../js/app.js', import.meta.url), 'utf8'),
  ]);
  const moduleIndex = html.indexOf('<script type="module" src="js/app.js"></script>');
  const enhancementIndex = html.indexOf("document.documentElement.classList.add('js')");

  assert.ok(enhancementIndex >= 0 && enhancementIndex < moduleIndex);
  assert.equal((html.match(/class="plan-card__panel" hidden/g) ?? []).length, 0);
  assert.match(html, /<script type="module" src="js\/app\.js"><\/script>/);
  assert.doesNotMatch(html, /data-action="toggle-sound"[^>]*>\s*🔇/);
  assert.match(appSource, /DOMContentLoaded/);
  assert.doesNotMatch(appSource, /(?:src|href)\s*=\s*["']\//);
  protectedNames.forEach((name) => {
    assert.equal(html.includes(name), false);
    assert.equal(appSource.includes(name), false);
  });
});
