const toastTimers = new WeakMap();

export function renderState(state, root = globalThis.document) {
  root?.querySelectorAll?.('[data-part-id]').forEach((article) => {
    const partId = article.dataset.partId;
    const viewed = state.viewed.includes(partId);
    const completed = state.completed.includes(partId);
    const open = state.openPartId === partId;
    const toggle = article.querySelector('.plan-card__toggle');
    const panel = article.querySelector('.plan-card__panel');
    const stamp = article.querySelector('[data-stamp]');

    article.classList.toggle('is-viewed', viewed);
    article.classList.toggle('is-completed', completed);
    toggle?.setAttribute('aria-expanded', String(open));
    if (panel) panel.hidden = !open;

    if (stamp) {
      const status = completed ? '已完成' : viewed ? '已翻阅' : '未翻阅';
      stamp.setAttribute('data-completed', String(completed));
      stamp.setAttribute('aria-label', `${status}：${stamp.textContent.trim()}`);
    }
  });

  const groupPhoto = root?.querySelector?.('[data-photo-lock]');
  if (groupPhoto) {
    const unlocked = state.photoUnlocked;
    const lockCopy = groupPhoto.querySelector('.group-photo__lock');
    const image = groupPhoto.querySelector('img');

    groupPhoto.classList.toggle('locked', !unlocked);
    groupPhoto.classList.toggle('unlocked', unlocked);
    groupPhoto.setAttribute('aria-label', unlocked ? '聚会合影已解锁' : '聚会合影尚未解锁');
    if (lockCopy) lockCopy.hidden = unlocked;
    if (image) image.hidden = !unlocked;
  }

  const soundButton = root?.querySelector?.('[data-action="toggle-sound"]');
  if (soundButton) {
    soundButton.setAttribute('aria-pressed', String(state.soundOn));
    soundButton.setAttribute('aria-label', state.soundOn ? '关闭声音' : '开启声音');
    const label = soundButton.querySelector('span');
    if (label) label.textContent = state.soundOn ? '声音开' : '声音关';
  }
}

export function bindAccordion(onOpen, root = globalThis.document, dependencies = {}) {
  const matchMedia = dependencies.matchMedia ?? globalThis.matchMedia;
  const bindings = [];

  root?.querySelectorAll?.('[data-part-id]').forEach((article) => {
    const toggle = article.querySelector('.plan-card__toggle');
    if (!toggle) return;

    const handleClick = () => {
      const opened = onOpen(article.dataset.partId);
      if (opened === false) return;
      const reduceMotion = matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
      article.scrollIntoView?.({
        block: 'nearest',
        behavior: reduceMotion ? 'auto' : 'smooth',
      });
    };

    toggle.addEventListener('click', handleClick);
    bindings.push([toggle, handleClick]);
  });

  return () => {
    bindings.forEach(([toggle, handleClick]) => toggle.removeEventListener('click', handleClick));
  };
}

export function showToast(message, root = globalThis.document, timers = globalThis) {
  const toast = root?.getElementById?.('toast');
  if (!toast) return;

  const previousTimer = toastTimers.get(toast);
  if (previousTimer !== undefined) timers.clearTimeout(previousTimer);

  toast.textContent = message;
  const timer = timers.setTimeout(() => {
    toast.textContent = '';
    toastTimers.delete(toast);
  }, 2600);
  timer?.unref?.();
  toastTimers.set(toast, timer);
}
