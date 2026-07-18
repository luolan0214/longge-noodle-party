import test from 'node:test';
import assert from 'node:assert/strict';
import { createBackgroundMusic } from '../js/bgm.js';

function createAudioFixture({ enabled = true, active = true, state = 'running' } = {}) {
  const oscillators = [];
  const gains = [];
  const timers = new Map();
  let nextTimer = 1;
  let contexts = 0;
  let closes = 0;

  class AudioContext {
    constructor() {
      contexts += 1;
      this.currentTime = 10;
      this.destination = {};
      this.state = state;
    }

    createOscillator() {
      const oscillator = {
        type: 'sine',
        frequency: { setValueAtTime() {} },
        connect() {},
        start() {},
        stop() {},
      };
      oscillators.push(oscillator);
      return oscillator;
    }

    createGain() {
      const gain = {
        gain: {
          value: 1,
          cancelScheduledValues() {},
          setValueAtTime() {},
          linearRampToValueAtTime() {},
          exponentialRampToValueAtTime() {},
          setTargetAtTime() {},
        },
        connect() {},
        disconnect() {},
      };
      gains.push(gain);
      return gain;
    }

    createBiquadFilter() {
      return {
        type: '',
        frequency: { setValueAtTime() {} },
        Q: { setValueAtTime() {} },
        connect() {},
      };
    }

    resume() {
      this.state = 'running';
      return Promise.resolve();
    }

    close() {
      closes += 1;
      this.state = 'closed';
      return Promise.resolve();
    }
  }

  const window = {
    AudioContext,
    navigator: { userActivation: { isActive: active } },
    setTimeout(callback, delay) {
      const id = nextTimer++;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
  };

  return {
    window,
    getEnabled: () => enabled,
    oscillators,
    gains,
    timers,
    get contexts() { return contexts; },
    get closes() { return closes; },
  };
}

test('background music never creates audio before sound is enabled and user activated', async () => {
  const disabled = createAudioFixture({ enabled: false });
  const inactive = createAudioFixture({ active: false });

  assert.equal(await createBackgroundMusic(disabled).start(), false);
  assert.equal(await createBackgroundMusic(inactive).start(), false);
  assert.equal(disabled.contexts, 0);
  assert.equal(inactive.contexts, 0);
});

test('background music schedules one warm lofi loop and repeated start is idempotent', async () => {
  const fixture = createAudioFixture();
  const music = createBackgroundMusic(fixture);

  assert.equal(await music.start(), true);
  assert.equal(music.isPlaying(), true);
  assert.equal(fixture.contexts, 1);
  assert.ok(fixture.oscillators.length >= 20, 'expected chords, bass, and melody voices');
  assert.ok(fixture.oscillators.some(({ type }) => type === 'triangle'));
  assert.ok(fixture.oscillators.some(({ type }) => type === 'sine'));
  assert.equal(fixture.timers.size, 1);

  const voiceCount = fixture.oscillators.length;
  assert.equal(await music.start(), true);
  assert.equal(fixture.oscillators.length, voiceCount);
  assert.equal(fixture.timers.size, 1);
});

test('background music stops immediately and destroy releases its AudioContext', async () => {
  const fixture = createAudioFixture();
  const music = createBackgroundMusic(fixture);

  await music.start();
  assert.equal(music.stop(), true);
  assert.equal(music.isPlaying(), false);
  assert.equal(fixture.timers.size, 0);
  assert.equal(music.stop(), false);

  assert.equal(await music.destroy(), true);
  assert.equal(fixture.closes, 1);
  assert.equal(await music.destroy(), false);
});

