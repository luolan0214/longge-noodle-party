import { eventDetails } from './content.js';
import { createInteractions, createSoundPlayer } from './interactions.js';
import {
  completePart,
  createInitialState,
  decodeState,
  encodeState,
  openPart,
  toggleSound as toggleSoundState,
} from './state.js';
import { bindAccordion, renderState, showToast } from './ui.js';

export const STORAGE_KEY = 'longge-party-progress-v1';

export function buildMapUrl(baseUrl, address) {
  const url = new URL(baseUrl);
  url.searchParams.set('query', address);
  return url.toString();
}

export function createShareData(url) {
  return {
    title: eventDetails.title,
    text: '周日一起吃面，打开邀请函看看吧！',
    url,
  };
}

export function loadState(storage, onError = () => {}) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    return raw === null || raw === undefined ? createInitialState() : decodeState(raw);
  } catch (error) {
    onError(error);
    return createInitialState();
  }
}

export function saveState(state, storage, onError = () => {}) {
  try {
    storage?.setItem(STORAGE_KEY, encodeState(state));
    return Boolean(storage);
  } catch (error) {
    onError(error);
    return false;
  }
}

export function removeState(storage, onError = () => {}) {
  try {
    storage?.removeItem(STORAGE_KEY);
    return Boolean(storage);
  } catch (error) {
    onError(error);
    return false;
  }
}

export async function copyText(text, dependencies = {}) {
  const { clipboard, document } = dependencies;

  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      // Continue to the selection-based fallback.
    }
  }

  if (!document?.body || !document.createElement || !document.execCommand) {
    return false;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.inset = '0 auto auto -9999px';
  document.body.append(textarea);

  try {
    textarea.select();
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

export async function shareInvitation(data, dependencies = {}) {
  const { share, copy = async () => false } = dependencies;

  if (share) {
    try {
      await share(data);
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') {
        return 'aborted';
      }
    }
  }

  return await copy(data.url) ? 'copied' : 'failed';
}

export function createInvitationController(dependencies = {}) {
  const {
    initialState = createInitialState(),
    render = () => {},
    persist = () => {},
    clear = () => {},
    onReset = () => {},
    soundPlayer = () => {},
  } = dependencies;
  let state = initialState;

  function update(nextState) {
    state = nextState;
    persist(state);
    render(state);
    return state;
  }

  const controller = {
    open(partId) {
      return update(openPart(state, partId));
    },
    complete(partId) {
      return update(completePart(state, partId));
    },
    toggleSound() {
      return update(toggleSoundState(state));
    },
    getState() {
      return state;
    },
    reset() {
      state = createInitialState();
      clear();
      render(state);
      onReset();
      return state;
    },
    playSound(...args) {
      if (!state.soundOn) {
        return false;
      }
      soundPlayer(...args);
      return true;
    },
  };

  render(state);
  return controller;
}

export function initInvitation(dependencies = {}) {
  const document = dependencies.document ?? globalThis.document;
  const window = dependencies.window ?? globalThis.window;
  if (!document || !window) return null;

  let storage;
  let storageWarningShown = false;
  const warnStorageOnce = () => {
    if (storageWarningShown) return;
    storageWarningShown = true;
    showToast('无法保存进度，但不影响本次使用', document);
  };

  try {
    storage = window.localStorage;
  } catch (error) {
    warnStorageOnce(error);
  }

  const initialState = storage ? loadState(storage, warnStorageOnce) : createInitialState();
  let interactions;
  let soundEffect = () => false;
  const controller = createInvitationController({
    initialState,
    render: (state) => renderState(state, document),
    persist: (state) => {
      if (storage) saveState(state, storage, warnStorageOnce);
    },
    clear: () => {
      if (storage) removeState(storage, warnStorageOnce);
    },
    onReset: () => {
      interactions?.reset();
      document.dispatchEvent?.(new window.CustomEvent('party:reset'));
    },
    soundPlayer: (effect) => soundEffect(effect),
  });

  soundEffect = createSoundPlayer({
    window,
    getEnabled: () => controller.getState().soundOn,
  });
  interactions = createInteractions({
    root: document,
    onComplete: (partId) => controller.complete(partId),
    showToast: (message) => showToast(message, document),
    playSound: (effect) => controller.playSound(effect),
  });
  interactions.mount();

  bindAccordion(
    (partId) => {
      const isNewPanel = controller.getState().openPartId !== partId;
      controller.open(partId);
      return isNewPanel;
    },
    document,
    { matchMedia: window.matchMedia?.bind(window) },
  );

  const addressElement = document.querySelector('#party-address');
  const address = addressElement?.textContent.trim() ?? eventDetails.address;
  const mapLink = document.querySelector('.address-card__actions a');
  if (mapLink) mapLink.href = buildMapUrl(mapLink.href || eventDetails.mapUrl, address);

  const copy = (text) => copyText(text, {
    clipboard: window.navigator?.clipboard,
    document,
  });
  document.querySelector('[data-action="copy-address"]')?.addEventListener('click', async () => {
    const copied = await copy(address);
    showToast(copied ? '地址已复制' : '复制失败，请手动复制地址', document);
  });

  document.querySelector('[data-action="share"]')?.addEventListener('click', async () => {
    const result = await shareInvitation(createShareData(window.location.href), {
      share: window.navigator?.share?.bind(window.navigator),
      copy,
    });
    const messages = {
      shared: '邀请已分享',
      copied: '分享不可用，链接已复制',
      failed: '分享失败，请复制浏览器地址',
    };
    if (messages[result]) showToast(messages[result], document);
  });

  document.querySelector('[data-action="toggle-sound"]')?.addEventListener('click', () => {
    controller.toggleSound();
  });
  document.querySelector('[data-action="replay"]')?.addEventListener('click', () => {
    controller.reset();
  });
  document.addEventListener?.('party:complete', (event) => {
    controller.complete(event.detail?.partId);
  });

  window.partyInvitation = controller;
  return controller;
}

if (globalThis.document && globalThis.window) {
  const start = () => initInvitation({ document: globalThis.document, window: globalThis.window });
  if (globalThis.document.readyState === 'loading') {
    globalThis.document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
