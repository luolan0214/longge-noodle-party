import { characters, micLines } from './content.js';

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function progress(value) {
  const numeric = Number(value);
  return clamp(Number.isFinite(numeric) ? numeric : 0, 0, 100);
}

export function randomChoiceNoRepeat(items, previous, random = Math.random) {
  if (!items.length) return undefined;
  const choices = items.length > 1 ? items.filter((item) => item !== previous) : items;
  const index = clamp(Math.floor(random() * choices.length), 0, choices.length - 1);
  return choices[index];
}

export function createSoundPlayer({ window, getEnabled = () => true } = {}) {
  let context;
  const lastPlayedAt = new Map();
  const effects = {
    doorbell: [880, 0.09],
    stamp: [620, 0.06],
    camera: [1180, 0.1],
  };

  function startTone(effect) {
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const [frequency, duration] = effects[effect] ?? effects.stamp;
      const start = context.currentTime;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(0.055, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
      return true;
    } catch {
      return false;
    }
  }

  return (effect = 'stamp') => {
    if (!getEnabled()) return false;
    const activation = window?.navigator?.userActivation;
    if (activation && !activation.isActive) return false;
    const AudioContext = window?.AudioContext ?? window?.webkitAudioContext;
    if (!AudioContext) return false;

    const now = (window?.performance?.now?.() ?? Date.now()) / 1000;
    const lastPlayed = lastPlayedAt.get(effect);
    if (lastPlayed !== undefined && now - lastPlayed < 0.08) return false;

    try {
      context ??= new AudioContext();
      lastPlayedAt.set(effect, now);
      if (context.state === 'suspended') {
        if (typeof context.resume !== 'function') return false;
        const resumed = context.resume();
        if (resumed?.then) {
          Promise.resolve(resumed)
            .then(() => {
              if (context.state !== 'suspended') startTone(effect);
            })
            .catch(() => {});
          return true;
        }
        if (context.state === 'suspended') return false;
      }
      return startTone(effect);
    } catch {
      return false;
    }
  };
}

export function createInteractions({
  root = globalThis.document,
  onComplete = () => {},
  showToast = () => {},
  playSound = () => {},
  random = Math.random,
} = {}) {
  const door = root?.querySelector?.('.cover__door');
  const doorbell = root?.querySelector?.('[data-action="doorbell"]');
  const hosts = [...(root?.querySelectorAll?.('.cover__door img') ?? [])];
  const snack = root?.querySelector?.('.snack-game');
  const toppingGroup = root?.querySelector?.('.noodle-game__toppings');
  const toppings = [...(root?.querySelectorAll?.('[data-topping]') ?? [])];
  const bowl = root?.querySelector?.('[data-action="noodle-bowl"]');
  const mealContainer = bowl?.parentElement ?? toppingGroup?.parentElement;
  const cameraPreview = root?.querySelector?.('.camera-game__preview');
  const cameraPhoto = root?.querySelector?.('[data-camera-photo]');
  const watermelonButton = root?.querySelector?.('[data-action="slice-watermelon"]');
  const watermelonGroup = root?.querySelector?.('.watermelon-game__slices');
  const watermelonSlices = [...(root?.querySelectorAll?.('[data-watermelon-slice]') ?? [])];
  const micButton = root?.querySelector?.('[data-action="pass-mic"]');
  const micBubble = root?.querySelector?.('[data-mic-bubble]');
  const micScene = micButton?.closest?.('[data-part-id]');
  const initialMicCopy = micBubble?.textContent ?? '';
  const moonTrack = root?.querySelector?.('[data-moon-track]');
  const moonRange = root?.querySelector?.('[data-moon-range]');
  const moonScene = moonTrack?.closest?.('[data-part-id]');
  const doorLight = root?.querySelector?.('[data-action="door-light"]');
  const doorLightMessage = root?.querySelector?.('[data-door-light-message]');
  const completed = new Set();
  const timers = new Set();
  let doorTimer;
  let cameraTimer;
  let micTimer;
  let bowlClicks = 0;
  let bowlSurpriseShown = false;
  let photoReady = false;
  let previousCharacter;
  let previousMicLine;
  let activeMoonPointer;
  let mounted = false;

  function schedule(callback, delay) {
    const timer = globalThis.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timer?.unref?.();
    timers.add(timer);
    return timer;
  }

  function clearTimer(timer) {
    if (timer === undefined) return;
    globalThis.clearTimeout(timer);
    timers.delete(timer);
  }

  function completeOnce(partId) {
    if (completed.has(partId)) return false;
    completed.add(partId);
    onComplete(partId);
    return true;
  }

  function ringDoorbell() {
    clearTimer(doorTimer);
    door?.classList.add('is-ringing');
    doorbell?.classList.add('is-ringing');
    hosts.forEach((host) => host.classList.add('is-peeking'));
    showToast('欢迎来吃面！');
    playSound('doorbell');
    doorTimer = schedule(() => {
      door?.classList.remove('is-ringing');
      doorbell?.classList.remove('is-ringing');
      hosts.forEach((host) => host.classList.remove('is-peeking'));
      doorTimer = undefined;
    }, 720);
  }

  function openSnack() {
    if (snack?.classList.contains('is-open')) return;
    snack?.classList.add('is-open');
    const decorations = [
      ['🍬', '8%', '4%'],
      ['🍿', '30%', '-12%'],
      ['🥤', '54%', '2%'],
      ['🍪', '80%', '-6%'],
      ['🍎', '14%', '70%'],
      ['🥜', '56%', '76%'],
      ['🍭', '86%', '62%'],
    ];
    decorations.forEach(([copy, left, top]) => {
      const sticker = root?.createElement?.('span');
      if (!sticker) return;
      sticker.classList.add('snack-game__pop', 'is-popping');
      sticker.setAttribute('aria-hidden', 'true');
      sticker.style?.setProperty?.('--snack-left', left);
      sticker.style?.setProperty?.('--snack-top', top);
      sticker.textContent = copy;
      snack?.append?.(sticker);
    });
    if (completeOnce('part-01')) playSound('stamp');
  }

  function updateToppings(target) {
    const selected = target.getAttribute('aria-pressed') !== 'true';
    target.setAttribute('aria-pressed', String(selected));
    target.classList.toggle('is-added', selected);
    const count = toppings.filter((button) => button.getAttribute('aria-pressed') === 'true').length;
    const ready = count === toppings.length && count > 0;
    if (bowl) bowl.dataset.toppingCount = String(count);
    toppingGroup?.classList.toggle('is-ready', ready);
    bowl?.classList.toggle('is-ready', ready);
    bowl?.classList.toggle('is-steaming', ready);

    if (!ready) return;
    if (!mealContainer?.querySelector?.('.noodle-game__steam') && root?.createElement) {
      const steam = root.createElement('span');
      steam.classList.add('noodle-game__steam');
      steam.setAttribute('aria-hidden', 'true');
      steam.textContent = '♥';
      mealContainer.append?.(steam);
    }
    if (completeOnce('part-02')) playSound('stamp');
  }

  function tapBowl() {
    bowlClicks += 1;
    if (bowlClicks < 3 || bowlSurpriseShown) return;
    bowlSurpriseShown = true;
    showToast('偷偷多加一勺炸酱');
    playSound('stamp');
  }

  function takePhoto() {
    clearTimer(cameraTimer);
    photoReady = true;
    cameraPreview?.classList.add('is-flashing');
    if (cameraPhoto) {
      cameraPhoto.src = 'assets/characters/group-photo.png';
      cameraPhoto.hidden = false;
      cameraPhoto.classList.add('is-ejected');
    }
    completeOnce('part-03');
    playSound('camera');
    cameraTimer = schedule(() => {
      cameraPreview?.classList.remove('is-flashing');
      cameraTimer = undefined;
    }, 380);
  }

  function retakePhoto() {
    clearTimer(cameraTimer);
    cameraTimer = undefined;
    photoReady = false;
    cameraPreview?.classList.remove('is-flashing');
    cameraPhoto?.classList.remove('is-ejected');
    if (cameraPhoto) cameraPhoto.hidden = true;
  }

  function savePhoto() {
    if (!photoReady || !cameraPhoto) {
      showToast('先拍一张合影吧');
      return;
    }
    const userAgent = root?.defaultView?.navigator?.userAgent ?? '';
    if (/iPad|iPhone|iPod/i.test(userAgent)) {
      showToast('请长按合影保存到相册');
      return;
    }

    try {
      const link = root?.createElement?.('a');
      if (!link || !('download' in link) || !root?.body?.append) {
        showToast('请长按合影保存到相册');
        return;
      }
      link.href = cameraPhoto.src || cameraPhoto.getAttribute?.('src');
      link.download = '周六面聚会合影.png';
      root.body.append(link);
      link.click?.();
      link.remove?.();
      showToast('合影已保存');
    } catch {
      showToast('请长按合影保存到相册');
    }
  }

  function sliceWatermelon() {
    if (watermelonButton?.disabled || watermelonGroup?.classList.contains('is-sliced')) return;
    watermelonButton?.classList.add('is-sliced', 'is-slicing');
    watermelonGroup?.classList.add('is-sliced');
    if (watermelonButton) {
      watermelonButton.disabled = true;
      watermelonButton.setAttribute('aria-disabled', 'true');
    }
    watermelonSlices.forEach((slice, index) => {
      slice.classList.add('is-taken');
      slice.dataset.takeOrder = String(index + 1);
    });
    if (completeOnce('part-04')) playSound('stamp');
  }

  function passMic() {
    clearTimer(micTimer);
    const character = randomChoiceNoRepeat(characters, previousCharacter, random);
    const line = randomChoiceNoRepeat(micLines, previousMicLine, random);
    if (!character || !line) return;
    previousCharacter = character;
    previousMicLine = line;
    micButton?.classList.add('is-passing');
    micBubble?.classList.add('is-speaking');
    micScene?.classList.add('has-mic');
    if (micScene) {
      micScene.dataset.character = character.id;
      micScene.dataset.accent = character.accent;
      micScene.style?.setProperty?.('--mic-accent', character.accent);
    }
    if (micBubble) micBubble.textContent = `${character.name}：${line}`;
    if (completeOnce('part-05')) playSound('stamp');
    micTimer = schedule(() => {
      micButton?.classList.remove('is-passing');
      micBubble?.classList.remove('is-speaking');
      micTimer = undefined;
    }, 560);
  }

  function setMoonProgress(value) {
    const next = progress(value);
    if (moonRange) moonRange.value = String(next);
    if (moonTrack) {
      moonTrack.dataset.progress = String(next);
      moonTrack.style?.setProperty?.('--moon-progress', `${next}%`);
      moonTrack.classList.toggle('is-rising', next > 0 && next < 80);
    }
    const night = next >= 80;
    moonTrack?.classList.toggle('is-night', night);
    moonScene?.classList.toggle('is-night', night);
    if (night && completeOnce('part-06')) playSound('stamp');
  }

  function setMoonFromPointer(event) {
    const bounds = moonTrack?.getBoundingClientRect?.();
    if (!bounds?.width) return;
    setMoonProgress(((event.clientX - bounds.left) / bounds.width) * 100);
  }

  function handleMoonInput(event) {
    setMoonProgress(event.currentTarget?.value ?? moonRange?.value);
  }

  function handleMoonPointerDown(event) {
    if (event.target === moonRange) return;
    activeMoonPointer = event.pointerId;
    try { moonTrack?.setPointerCapture?.(event.pointerId); } catch { /* Optional API. */ }
    setMoonFromPointer(event);
  }

  function handleMoonPointerMove(event) {
    if (activeMoonPointer !== event.pointerId) return;
    setMoonFromPointer(event);
  }

  function handleMoonPointerEnd(event) {
    if (activeMoonPointer !== event.pointerId) return;
    try { moonTrack?.releasePointerCapture?.(event.pointerId); } catch { /* Optional API. */ }
    activeMoonPointer = undefined;
  }

  function toggleDoorLight() {
    const lit = doorLight?.getAttribute('aria-pressed') !== 'true';
    doorLight?.setAttribute('aria-pressed', String(lit));
    doorLight?.classList.toggle('is-lit', lit);
    doorLightMessage?.classList.toggle('is-visible', lit);
    if (lit) playSound('stamp');
  }

  function handleClick(event) {
    const target = event.target?.closest?.('[data-action], [data-topping]');
    const action = target?.dataset?.action;
    if (target?.dataset?.topping) updateToppings(target);
    if (action === 'doorbell') ringDoorbell();
    if (action === 'open-snack-bag') openSnack();
    if (action === 'noodle-bowl') tapBowl();
    if (action === 'camera-shutter') takePhoto();
    if (action === 'retake-photo') retakePhoto();
    if (action === 'save-photo') savePhoto();
    if (action === 'slice-watermelon') sliceWatermelon();
    if (action === 'pass-mic') passMic();
    if (action === 'moon-keyboard-step') setMoonProgress(100);
    if (action === 'door-light') toggleDoorLight();
  }

  return {
    mount() {
      if (mounted || !root?.addEventListener) return;
      mounted = true;
      root.addEventListener('click', handleClick);
      moonRange?.addEventListener?.('input', handleMoonInput);
      moonTrack?.addEventListener?.('pointerdown', handleMoonPointerDown);
      moonTrack?.addEventListener?.('pointermove', handleMoonPointerMove);
      moonTrack?.addEventListener?.('pointerup', handleMoonPointerEnd);
      moonTrack?.addEventListener?.('pointercancel', handleMoonPointerEnd);
    },
    reset() {
      timers.forEach((timer) => globalThis.clearTimeout(timer));
      timers.clear();
      doorTimer = undefined;
      cameraTimer = undefined;
      micTimer = undefined;
      bowlClicks = 0;
      bowlSurpriseShown = false;
      photoReady = false;
      previousCharacter = undefined;
      previousMicLine = undefined;
      if (activeMoonPointer !== undefined) {
        try { moonTrack?.releasePointerCapture?.(activeMoonPointer); } catch { /* Optional API. */ }
      }
      activeMoonPointer = undefined;
      completed.clear();
      door?.classList.remove('is-ringing');
      doorbell?.classList.remove('is-ringing');
      hosts.forEach((host) => host.classList.remove('is-peeking'));
      snack?.classList.remove('is-open');
      snack?.querySelectorAll?.('.snack-game__pop').forEach((sticker) => sticker.remove?.());
      toppings.forEach((button) => {
        button.setAttribute('aria-pressed', 'false');
        button.classList.remove('is-added');
      });
      toppingGroup?.classList.remove('is-ready');
      bowl?.classList.remove('is-ready', 'is-steaming');
      if (bowl) bowl.dataset.toppingCount = '0';
      mealContainer?.querySelector?.('.noodle-game__steam')?.remove?.();
      cameraPreview?.classList.remove('is-flashing');
      cameraPhoto?.classList.remove('is-ejected');
      if (cameraPhoto) cameraPhoto.hidden = true;
      watermelonButton?.classList.remove('is-sliced', 'is-slicing');
      if (watermelonButton) {
        watermelonButton.disabled = false;
        watermelonButton.removeAttribute('aria-disabled');
      }
      watermelonGroup?.classList.remove('is-sliced');
      watermelonSlices.forEach((slice) => {
        slice.classList.remove('is-taken');
        delete slice.dataset.takeOrder;
      });
      micButton?.classList.remove('is-passing');
      micBubble?.classList.remove('is-speaking');
      micScene?.classList.remove('has-mic');
      if (micScene) {
        delete micScene.dataset.character;
        delete micScene.dataset.accent;
        micScene.style?.removeProperty?.('--mic-accent');
      }
      if (micBubble) micBubble.textContent = initialMicCopy;
      if (moonRange) moonRange.value = '0';
      if (moonTrack) {
        moonTrack.dataset.progress = '0';
        moonTrack.style?.removeProperty?.('--moon-progress');
        moonTrack.classList.remove('is-rising', 'is-night');
      }
      moonScene?.classList.remove('is-night');
      doorLight?.setAttribute('aria-pressed', 'false');
      doorLight?.classList.remove('is-lit');
      doorLightMessage?.classList.remove('is-visible');
    },
    destroy() {
      if (mounted) {
        root?.removeEventListener?.('click', handleClick);
        moonRange?.removeEventListener?.('input', handleMoonInput);
        moonTrack?.removeEventListener?.('pointerdown', handleMoonPointerDown);
        moonTrack?.removeEventListener?.('pointermove', handleMoonPointerMove);
        moonTrack?.removeEventListener?.('pointerup', handleMoonPointerEnd);
        moonTrack?.removeEventListener?.('pointercancel', handleMoonPointerEnd);
      }
      mounted = false;
      this.reset();
    },
  };
}
