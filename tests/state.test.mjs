import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PART_IDS,
  completePart,
  createInitialState,
  decodeState,
  encodeState,
  openPart,
  toggleSound,
} from '../js/state.js';

test('initial state opens and views only the first invitation part', () => {
  assert.deepEqual(PART_IDS, [
    'part-01',
    'part-02',
    'part-03',
    'part-04',
    'part-05',
    'part-06',
  ]);
  assert.deepEqual(createInitialState(), {
    openPartId: 'part-01',
    viewed: ['part-01'],
    completed: [],
    photoUnlocked: false,
    soundOn: false,
  });
});

test('opening a part keeps one part open without mutating the input', () => {
  const state = createInitialState();
  const next = openPart(state, 'part-03');

  assert.notStrictEqual(next, state);
  assert.equal(next.openPartId, 'part-03');
  assert.deepEqual(next.viewed, ['part-01', 'part-03']);
  assert.deepEqual(state, createInitialState());
});

test('opening every part unlocks the group photo without duplicate views', () => {
  const state = PART_IDS.reduce(openPart, createInitialState());
  const reopened = openPart(state, 'part-06');

  assert.deepEqual(state.viewed, PART_IDS);
  assert.equal(state.photoUnlocked, true);
  assert.deepEqual(reopened.viewed, PART_IDS);
});

test('opening an unknown part safely returns the original state', () => {
  const state = createInitialState();

  assert.strictEqual(openPart(state, 'part-99'), state);
});

test('completing a part is immutable and de-duplicates completions', () => {
  const state = createInitialState();
  const completed = completePart(state, 'part-02');
  const repeated = completePart(completed, 'part-02');

  assert.notStrictEqual(completed, state);
  assert.deepEqual(completed.completed, ['part-02']);
  assert.deepEqual(repeated.completed, ['part-02']);
  assert.deepEqual(state.completed, []);
});

test('completing an unknown part safely returns the original state', () => {
  const state = createInitialState();

  assert.strictEqual(completePart(state, 'part-99'), state);
});

test('toggling sound returns a new state with sound reversed', () => {
  const state = createInitialState();
  const on = toggleSound(state);
  const off = toggleSound(on);

  assert.notStrictEqual(on, state);
  assert.equal(on.soundOn, true);
  assert.equal(off.soundOn, false);
  assert.equal(state.soundOn, false);
});

test('encoding serializes only the public state fields', () => {
  const state = {
    ...createInitialState(),
    internalNote: 'do not persist',
  };

  assert.deepEqual(JSON.parse(encodeState(state)), createInitialState());
});

test('decoding damaged JSON safely falls back to the initial state', () => {
  assert.deepEqual(decodeState('{not valid JSON'), createInitialState());
  assert.deepEqual(decodeState('null'), createInitialState());
});

test('decoding filters polluted IDs, de-duplicates arrays, and recomputes unlock', () => {
  const raw = JSON.stringify({
    openPartId: 'part-99',
    viewed: [...PART_IDS, 'part-06', 'part-99', null],
    completed: ['part-02', 'part-02', 'part-99', 3],
    photoUnlocked: false,
    soundOn: 'yes',
    injected: 'discard me',
  });

  assert.deepEqual(decodeState(raw), {
    openPartId: 'part-01',
    viewed: PART_IDS,
    completed: ['part-02'],
    photoUnlocked: true,
    soundOn: false,
  });
});

test('decoding does not trust a forged photo unlock flag', () => {
  const raw = JSON.stringify({
    openPartId: 'part-02',
    viewed: ['part-02'],
    completed: 'part-02',
    photoUnlocked: true,
    soundOn: true,
  });

  assert.deepEqual(decodeState(raw), {
    openPartId: 'part-02',
    viewed: ['part-02'],
    completed: [],
    photoUnlocked: false,
    soundOn: true,
  });
});
