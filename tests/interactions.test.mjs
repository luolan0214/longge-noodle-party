import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clamp,
  createInteractions,
  createSoundPlayer,
  progress,
  randomChoiceNoRepeat,
} from '../js/interactions.js';

class FakeClassList {
  constructor() { this.names = new Set(); }
  add(...names) { names.forEach((name) => this.names.add(name)); }
  remove(...names) { names.forEach((name) => this.names.delete(name)); }
  contains(name) { return this.names.has(name); }
  toggle(name, force) {
    const add = force === undefined ? !this.names.has(name) : force;
    if (add) this.names.add(name);
    else this.names.delete(name);
    return add;
  }
}

function fakeElement({ action, topping, children = [], parentElement = null } = {}) {
  const attributes = new Map();
  const listeners = new Map();
  const element = {
    classList: new FakeClassList(),
    dataset: { ...(action ? { action } : {}), ...(topping ? { topping } : {}) },
    children,
    parentElement,
    style: { setProperty() {}, removeProperty() {} },
    hidden: false,
    disabled: false,
    textContent: '',
    clickCount: 0,
    click() { this.clickCount += 1; },
    value: '0',
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name) { listeners.delete(name); },
    dispatch(name, event = {}) { listeners.get(name)?.({ currentTarget: this, ...event }); },
    getBoundingClientRect() { return { left: 0, width: 100 }; },
    setPointerCapture(pointerId) { this.capturedPointer = pointerId; },
    releasePointerCapture(pointerId) { if (this.capturedPointer === pointerId) delete this.capturedPointer; },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    removeAttribute(name) { attributes.delete(name); },
    append(child) { child.parentElement = this; this.children.push(child); },
    remove() {
      if (!this.parentElement) return;
      const index = this.parentElement.children.indexOf(this);
      if (index >= 0) this.parentElement.children.splice(index, 1);
    },
    matches(selector) {
      if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
      if (selector === '[data-part-id]') return Boolean(this.dataset.partId);
      return false;
    },
    querySelector(selector) { return this.children.find((child) => child.matches(selector)) ?? null; },
    querySelectorAll(selector) { return this.children.filter((child) => child.matches(selector)); },
    closest(selector) {
      if (selector === '[data-action], [data-topping]' && (action || topping)) return this;
      if (this.matches(selector)) return this;
      return this.parentElement?.closest?.(selector) ?? null;
    },
  };
  children.forEach((child) => { child.parentElement = element; });
  return element;
}

function createArrivalFixture() {
  const listeners = new Map();
  const completed = [];
  const toasts = [];
  const sounds = [];
  const door = fakeElement();
  const doorbell = fakeElement({ action: 'doorbell' });
  const hosts = [fakeElement(), fakeElement()];
  const snackItems = [fakeElement(), fakeElement(), fakeElement()];
  const snack = fakeElement({ children: snackItems });
  const snackButton = fakeElement({ action: 'open-snack-bag' });
  const mealArticle = fakeElement();
  mealArticle.dataset.partId = 'part-02';
  const toppingGroup = fakeElement({ parentElement: mealArticle });
  const toppings = ['cucumber', 'carrot', 'sprouts', 'sauce'].map((name) => {
    const button = fakeElement({ topping: name, parentElement: toppingGroup });
    button.setAttribute('aria-pressed', 'false');
    return button;
  });
  const bowl = fakeElement({ action: 'noodle-bowl', parentElement: mealArticle });
  mealArticle.children.push(toppingGroup, bowl);
  const cameraPreview = fakeElement();
  const cameraPhoto = fakeElement();
  cameraPhoto.hidden = true;
  cameraPhoto.src = 'assets/characters/group-photo.png';
  const shutter = fakeElement({ action: 'camera-shutter' });
  const retake = fakeElement({ action: 'retake-photo' });
  const save = fakeElement({ action: 'save-photo' });
  const watermelonButton = fakeElement({ action: 'slice-watermelon' });
  const watermelonSlices = Array.from({ length: 6 }, () => fakeElement());
  const watermelonGroup = fakeElement({ children: watermelonSlices });
  const micArticle = fakeElement();
  micArticle.dataset.partId = 'part-05';
  const micButton = fakeElement({ action: 'pass-mic', parentElement: micArticle });
  const micBubble = fakeElement();
  micBubble.textContent = '这个可以说吗？';
  const moonArticle = fakeElement();
  moonArticle.dataset.partId = 'part-06';
  const moonTrack = fakeElement({ parentElement: moonArticle });
  const moonRange = fakeElement({ parentElement: moonTrack });
  const moonStep = fakeElement({ action: 'moon-keyboard-step', parentElement: moonArticle });
  const doorLight = fakeElement({ action: 'door-light', parentElement: moonArticle });
  doorLight.setAttribute('aria-pressed', 'false');
  const doorMessage = fakeElement({ parentElement: moonArticle });
  doorMessage.textContent = '下次还来吃面！';
  const body = fakeElement();
  const downloadLinks = [];
  const selectors = new Map([
    ['.cover__door', door],
    ['[data-action="doorbell"]', doorbell],
    ['.snack-game', snack],
    ['[data-action="open-snack-bag"]', snackButton],
    ['.noodle-game__toppings', toppingGroup],
    ['[data-action="noodle-bowl"]', bowl],
    ['.camera-game__preview', cameraPreview],
    ['[data-camera-photo]', cameraPhoto],
    ['[data-action="slice-watermelon"]', watermelonButton],
    ['.watermelon-game__slices', watermelonGroup],
    ['[data-action="pass-mic"]', micButton],
    ['[data-mic-bubble]', micBubble],
    ['[data-moon-track]', moonTrack],
    ['[data-moon-range]', moonRange],
    ['[data-action="door-light"]', doorLight],
    ['[data-door-light-message]', doorMessage],
  ]);
  const root = {
    querySelector: (selector) => selectors.get(selector) ?? null,
    querySelectorAll: (selector) => {
      if (selector === '.cover__door img') return hosts;
      if (selector === '[data-topping]') return toppings;
      if (selector === '[data-watermelon-slice]') return watermelonSlices;
      return [];
    },
    body,
    defaultView: { navigator: { userAgent: 'Desktop Browser' } },
    createElement: (tagName) => {
      const element = fakeElement();
      if (tagName === 'a') {
        element.download = '';
        downloadLinks.push(element);
      }
      return element;
    },
    addEventListener(name, listener) { listeners.set(name, listener); },
    removeEventListener(name) { listeners.delete(name); },
    click(target) { listeners.get('click')?.({ target }); },
    listenerCount: () => listeners.size,
  };
  const interactions = createInteractions({
    root,
    onComplete: (partId) => completed.push(partId),
    showToast: (message) => toasts.push(message),
    playSound: (effect) => sounds.push(effect),
    random: () => 0,
  });

  return {
    root, interactions, completed, toasts, sounds, door, doorbell, hosts,
    snack, snackButton, mealArticle, toppingGroup, toppings, bowl,
    cameraPreview, cameraPhoto, shutter, retake, save, body, downloadLinks,
    watermelonButton, watermelonGroup, watermelonSlices,
    micArticle, micButton, micBubble,
    moonArticle, moonTrack, moonRange, moonStep, doorLight, doorMessage,
  };
}

test('numeric helpers clamp moon progress to a finite percentage', () => {
  assert.equal(clamp(-3, 0, 100), 0);
  assert.equal(clamp(120, 0, 100), 100);
  assert.equal(progress('42'), 42);
  assert.equal(progress(Number.NaN), 0);
});

test('randomChoiceNoRepeat avoids the previous choice even with the same random value', () => {
  const choices = ['a', 'b', 'c'];
  const first = randomChoiceNoRepeat(choices, null, () => 0);
  const second = randomChoiceNoRepeat(choices, first, () => 0);

  assert.equal(first, 'a');
  assert.equal(second, 'b');
  assert.equal(randomChoiceNoRepeat(['only'], 'only', () => 0), 'only');
});

test('disabled sound does not construct an AudioContext', () => {
  let contexts = 0;
  const play = createSoundPlayer({
    window: { AudioContext: class { constructor() { contexts += 1; } } },
    getEnabled: () => false,
  });

  assert.equal(play('doorbell'), false);
  assert.equal(contexts, 0);
});

test('sound requires current user activation even after an earlier gesture', () => {
  let contexts = 0;
  const play = createSoundPlayer({
    window: {
      AudioContext: class { constructor() { contexts += 1; } },
      navigator: { userActivation: { isActive: false, hasBeenActive: true } },
    },
    getEnabled: () => true,
  });

  assert.equal(play('stamp'), false);
  assert.equal(contexts, 0);
});

test('suspended sound context resumes before creating its oscillator', async () => {
  let context;
  let resumeCalls = 0;
  let oscillators = 0;
  class AudioContext {
    constructor() {
      context = this;
      this.state = 'suspended';
      this.currentTime = 2;
      this.destination = {};
    }

    resume() {
      resumeCalls += 1;
      return Promise.resolve().then(() => { this.state = 'running'; });
    }

    createOscillator() {
      oscillators += 1;
      return {
        frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {},
      };
    }

    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {},
      };
    }
  }
  const play = createSoundPlayer({
    window: {
      AudioContext,
      navigator: { userActivation: { isActive: true } },
    },
    getEnabled: () => true,
  });

  assert.equal(play('doorbell'), true);
  assert.equal(resumeCalls, 1);
  assert.equal(oscillators, 0);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(context.state, 'running');
  assert.equal(oscillators, 1);
});

test('sound silently ignores a rejected context resume', async () => {
  let oscillators = 0;
  class AudioContext {
    constructor() {
      this.state = 'suspended';
      this.currentTime = 1;
      this.destination = {};
    }

    resume() { return Promise.reject(new Error('blocked')); }
    createOscillator() { oscillators += 1; return {}; }
  }
  const play = createSoundPlayer({
    window: {
      AudioContext,
      navigator: { userActivation: { isActive: true } },
    },
    getEnabled: () => true,
  });

  assert.doesNotThrow(() => play('stamp'));
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(oscillators, 0);
});

test('sound throttles the same effect within 80 milliseconds', () => {
  let now = 1000;
  let oscillators = 0;
  class AudioContext {
    constructor() { this.currentTime = 3; this.destination = {}; }
    createOscillator() {
      oscillators += 1;
      return {
        frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {},
      };
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {},
      };
    }
  }
  const play = createSoundPlayer({
    window: {
      AudioContext,
      performance: { now: () => now },
      navigator: { userActivation: { isActive: true } },
    },
    getEnabled: () => true,
  });

  assert.equal(play('doorbell'), true);
  now += 40;
  assert.equal(play('doorbell'), false);
  now += 41;
  assert.equal(play('doorbell'), true);
  assert.equal(oscillators, 2);
});

test('enabled sound reuses one AudioContext and gives effects distinct short tones', () => {
  let contexts = 0;
  const frequencies = [];
  const stops = [];
  class AudioContext {
    constructor() {
      contexts += 1;
      this.currentTime = 4;
      this.destination = {};
    }

    createOscillator() {
      return {
        frequency: { setValueAtTime: (value) => frequencies.push(value) },
        connect() {},
        start() {},
        stop: (time) => stops.push(time),
      };
    }

    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
      };
    }
  }
  const play = createSoundPlayer({ window: { AudioContext }, getEnabled: () => true });

  assert.equal(play('doorbell'), true);
  assert.equal(play('stamp'), true);
  assert.equal(play('camera'), true);
  assert.equal(contexts, 1);
  assert.equal(new Set(frequencies).size, 3);
  assert.ok(stops.every((time) => time >= 4.05 && time <= 4.12));
});

test('mount is idempotent and doorbell gives bounded welcome feedback', () => {
  const fixture = createArrivalFixture();
  fixture.interactions.mount();
  fixture.interactions.mount();
  const childCount = fixture.snack.children.length;

  fixture.root.click(fixture.doorbell);
  fixture.root.click(fixture.doorbell);

  assert.equal(fixture.root.listenerCount(), 1);
  assert.equal(fixture.door.classList.contains('is-ringing'), true);
  assert.equal(fixture.doorbell.classList.contains('is-ringing'), true);
  assert.equal(fixture.hosts.every((host) => host.classList.contains('is-peeking')), true);
  assert.deepEqual(fixture.toasts, ['欢迎来吃面！', '欢迎来吃面！']);
  assert.deepEqual(fixture.sounds, ['doorbell', 'doorbell']);
  assert.equal(fixture.snack.children.length, childCount);
});

test('opening the snack bag creates bounded decorative stickers once and reset removes them', () => {
  const fixture = createArrivalFixture();
  fixture.interactions.mount();
  const childCount = fixture.snack.children.length;

  fixture.root.click(fixture.snackButton);
  const stickers = fixture.snack.querySelectorAll('.snack-game__pop');
  assert.ok(stickers.length >= 6 && stickers.length <= 8);
  assert.equal(stickers.every((sticker) => sticker.getAttribute('aria-hidden') === 'true'), true);
  assert.equal(fixture.snack.children.length, childCount + stickers.length);
  fixture.root.click(fixture.snackButton);

  assert.equal(fixture.snack.classList.contains('is-open'), true);
  assert.equal(fixture.snack.querySelectorAll('.snack-game__pop').length, stickers.length);
  assert.deepEqual(fixture.completed, ['part-01']);
  assert.deepEqual(fixture.sounds, ['stamp']);

  fixture.interactions.reset();
  assert.equal(fixture.snack.classList.contains('is-open'), false);
  assert.equal(fixture.door.classList.contains('is-ringing'), false);
  assert.equal(fixture.hosts.some((host) => host.classList.contains('is-peeking')), false);
  assert.equal(fixture.snack.querySelectorAll('.snack-game__pop').length, 0);
  assert.equal(fixture.snack.children.length, childCount);

  fixture.root.click(fixture.snackButton);
  assert.deepEqual(fixture.completed, ['part-01', 'part-01']);
});

test('four toppings complete part 02 once and keep one steam heart', () => {
  const fixture = createArrivalFixture();
  fixture.interactions.mount();

  fixture.toppings.forEach((button) => fixture.root.click(button));
  fixture.root.click(fixture.toppings.at(-1));
  fixture.root.click(fixture.toppings.at(-1));

  assert.deepEqual(fixture.completed, ['part-02']);
  assert.equal(fixture.toppingGroup.classList.contains('is-ready'), true);
  assert.equal(fixture.bowl.classList.contains('is-ready'), true);
  assert.equal(fixture.bowl.dataset.toppingCount, '4');
  assert.equal(fixture.mealArticle.querySelectorAll('.noodle-game__steam').length, 1);
});

test('the noodle bowl three-click easter egg runs once and reset clears the meal', () => {
  const fixture = createArrivalFixture();
  fixture.interactions.mount();

  for (let index = 0; index < 7; index += 1) fixture.root.click(fixture.bowl);
  fixture.root.click(fixture.toppings[0]);
  fixture.interactions.reset();

  assert.equal(fixture.toasts.filter((copy) => copy === '偷偷多加一勺炸酱').length, 1);
  assert.equal(fixture.toppings[0].getAttribute('aria-pressed'), 'false');
  assert.equal(fixture.bowl.dataset.toppingCount, '0');
  assert.equal(fixture.toppingGroup.classList.contains('is-ready'), false);
  assert.equal(fixture.mealArticle.querySelectorAll('.noodle-game__steam').length, 0);
});

test('camera can retake visual feedback without repeating part 03 completion', () => {
  const fixture = createArrivalFixture();
  fixture.interactions.mount();

  fixture.root.click(fixture.shutter);
  assert.equal(fixture.cameraPreview.classList.contains('is-flashing'), true);
  assert.equal(fixture.cameraPhoto.classList.contains('is-ejected'), true);
  assert.equal(fixture.cameraPhoto.hidden, false);
  assert.equal(fixture.cameraPhoto.src, 'assets/characters/group-photo.png');

  fixture.root.click(fixture.retake);
  assert.equal(fixture.cameraPhoto.hidden, true);
  assert.equal(fixture.cameraPhoto.classList.contains('is-ejected'), false);
  fixture.root.click(fixture.shutter);

  assert.deepEqual(fixture.completed, ['part-03']);
  assert.deepEqual(fixture.sounds, ['camera', 'camera']);
});

test('saving a ready camera photo uses a temporary downloadable link', () => {
  const fixture = createArrivalFixture();
  fixture.interactions.mount();
  fixture.root.click(fixture.shutter);

  assert.doesNotThrow(() => fixture.root.click(fixture.save));
  assert.equal(fixture.downloadLinks.length, 1);
  assert.equal(fixture.downloadLinks[0].href, 'assets/characters/group-photo.png');
  assert.equal(fixture.downloadLinks[0].download, '周六面聚会合影.png');
  assert.equal(fixture.downloadLinks[0].clickCount, 1);
  assert.equal(fixture.body.children.length, 0);
});

test('iOS photo saving falls back to a long-press hint without throwing', () => {
  const fixture = createArrivalFixture();
  fixture.root.defaultView.navigator.userAgent = 'iPhone';
  fixture.interactions.mount();
  fixture.root.click(fixture.shutter);

  assert.doesNotThrow(() => fixture.root.click(fixture.save));
  assert.equal(fixture.downloadLinks.length, 0);
  assert.equal(fixture.toasts.at(-1), '请长按合影保存到相册');
});

test('watermelon slices once into six staggered pieces and reset restores it', () => {
  const fixture = createArrivalFixture();
  fixture.interactions.mount();

  fixture.root.click(fixture.watermelonButton);
  fixture.root.click(fixture.watermelonButton);

  assert.deepEqual(fixture.completed, ['part-04']);
  assert.equal(fixture.watermelonButton.disabled, true);
  assert.equal(fixture.watermelonButton.getAttribute('aria-disabled'), 'true');
  assert.equal(fixture.watermelonGroup.classList.contains('is-sliced'), true);
  assert.equal(fixture.watermelonSlices.every((slice) => slice.classList.contains('is-taken')), true);
  assert.deepEqual(fixture.watermelonSlices.map((slice) => slice.dataset.takeOrder), ['1', '2', '3', '4', '5', '6']);

  fixture.interactions.reset();
  assert.equal(fixture.watermelonButton.disabled, false);
  assert.equal(fixture.watermelonButton.getAttribute('aria-disabled'), null);
  assert.equal(fixture.watermelonGroup.classList.contains('is-sliced'), false);
  assert.equal(fixture.watermelonSlices.some((slice) => slice.classList.contains('is-taken')), false);
});

test('microphone avoids consecutive character and line repeats then reset clears the scene', () => {
  const fixture = createArrivalFixture();
  fixture.interactions.mount();

  fixture.root.click(fixture.micButton);
  const firstCharacter = fixture.micArticle.dataset.character;
  const firstLine = fixture.micBubble.textContent;
  fixture.root.click(fixture.micButton);

  assert.notEqual(fixture.micArticle.dataset.character, firstCharacter);
  assert.notEqual(fixture.micBubble.textContent, firstLine);
  assert.ok(fixture.micArticle.dataset.accent);
  assert.equal(fixture.micArticle.classList.contains('has-mic'), true);
  assert.equal(fixture.micBubble.classList.contains('is-speaking'), true);
  assert.deepEqual(fixture.completed, ['part-05']);

  fixture.interactions.reset();
  assert.equal(fixture.micArticle.dataset.character, undefined);
  assert.equal(fixture.micArticle.dataset.accent, undefined);
  assert.equal(fixture.micArticle.classList.contains('has-mic'), false);
  assert.equal(fixture.micBubble.textContent, '这个可以说吗？');
});

test('keyboard moon control reaches night and door light toggles independently', () => {
  const fixture = createArrivalFixture();
  fixture.interactions.mount();

  fixture.root.click(fixture.moonStep);
  fixture.root.click(fixture.doorLight);

  assert.equal(fixture.moonRange.value, '100');
  assert.equal(fixture.moonTrack.dataset.progress, '100');
  assert.equal(fixture.moonTrack.classList.contains('is-night'), true);
  assert.equal(fixture.moonArticle.classList.contains('is-night'), true);
  assert.deepEqual(fixture.completed, ['part-06']);
  assert.equal(fixture.doorLight.getAttribute('aria-pressed'), 'true');
  assert.equal(fixture.doorLight.classList.contains('is-lit'), true);
  assert.equal(fixture.doorMessage.classList.contains('is-visible'), true);

  fixture.interactions.reset();
  assert.equal(fixture.moonRange.value, '0');
  assert.equal(fixture.moonTrack.classList.contains('is-night'), false);
  assert.equal(fixture.doorLight.getAttribute('aria-pressed'), 'false');
  assert.equal(fixture.doorLight.classList.contains('is-lit'), false);
});

test('pointer moon drag clamps progress without preventing vertical touch scrolling', () => {
  const fixture = createArrivalFixture();
  fixture.interactions.mount();
  let prevented = 0;

  fixture.moonTrack.dispatch('pointerdown', {
    pointerId: 7,
    clientX: 180,
    preventDefault() { prevented += 1; },
  });
  fixture.moonTrack.dispatch('pointerup', { pointerId: 7 });

  assert.equal(fixture.moonRange.value, '100');
  assert.equal(fixture.moonTrack.dataset.progress, '100');
  assert.equal(prevented, 0);
  assert.equal(fixture.moonTrack.capturedPointer, undefined);
  assert.deepEqual(fixture.completed, ['part-06']);
});

test('reset safely releases an in-progress moon pointer capture', () => {
  const fixture = createArrivalFixture();
  fixture.interactions.mount();
  fixture.moonTrack.dispatch('pointerdown', { pointerId: 9, clientX: 40 });

  assert.equal(fixture.moonTrack.capturedPointer, 9);
  fixture.interactions.reset();

  assert.equal(fixture.moonTrack.capturedPointer, undefined);
  assert.equal(fixture.moonRange.value, '0');
});
