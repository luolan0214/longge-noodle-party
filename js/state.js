export const PART_IDS = Object.freeze([
  'part-01',
  'part-02',
  'part-03',
  'part-04',
  'part-05',
  'part-06',
]);

const PART_ID_SET = new Set(PART_IDS);

export function createInitialState() {
  return {
    openPartId: PART_IDS[0],
    viewed: [PART_IDS[0]],
    completed: [],
    photoUnlocked: false,
    soundOn: false,
  };
}

export function openPart(state, partId) {
  if (!PART_ID_SET.has(partId)) {
    return state;
  }

  const viewed = [...new Set([...state.viewed, partId])];

  return {
    ...state,
    openPartId: partId,
    viewed,
    photoUnlocked: viewed.length === PART_IDS.length,
  };
}

export function completePart(state, partId) {
  if (!PART_ID_SET.has(partId)) {
    return state;
  }

  return {
    ...state,
    completed: [...new Set([...state.completed, partId])],
  };
}

export function toggleSound(state) {
  return {
    ...state,
    soundOn: !state.soundOn,
  };
}

export function encodeState(state) {
  const {
    openPartId,
    viewed,
    completed,
    photoUnlocked,
    soundOn,
  } = state;

  return JSON.stringify({
    openPartId,
    viewed,
    completed,
    photoUnlocked,
    soundOn,
  });
}

export function decodeState(raw) {
  try {
    const parsed = JSON.parse(raw);

    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return createInitialState();
    }

    const openPartId = PART_ID_SET.has(parsed.openPartId)
      ? parsed.openPartId
      : PART_IDS[0];
    const viewed = Array.isArray(parsed.viewed)
      ? [...new Set(parsed.viewed.filter((partId) => PART_ID_SET.has(partId)))]
      : [];
    const completed = Array.isArray(parsed.completed)
      ? [...new Set(parsed.completed.filter((partId) => PART_ID_SET.has(partId)))]
      : [];

    if (!viewed.includes(openPartId)) {
      viewed.unshift(openPartId);
    }

    return {
      openPartId,
      viewed,
      completed,
      photoUnlocked: viewed.length === PART_IDS.length,
      soundOn: typeof parsed.soundOn === 'boolean' ? parsed.soundOn : false,
    };
  } catch {
    return createInitialState();
  }
}
