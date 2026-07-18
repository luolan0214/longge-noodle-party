const TEMPO = 76;
const BEAT_SECONDS = 60 / TEMPO;
const LOOP_SECONDS = BEAT_SECONDS * 16;

const CHORDS = [
  [60, 64, 67, 71], // Cmaj7
  [57, 60, 64, 67], // Am7
  [53, 57, 60, 64], // Fmaj7
  [55, 59, 62, 64], // G6
];
const BASS = [36, 33, 29, 31];
const MELODY = [76, 74, 71, 69, 67, 69, 71, 74];

function midiToFrequency(note) {
  return 440 * (2 ** ((note - 69) / 12));
}

export function createBackgroundMusic({ window, getEnabled = () => true } = {}) {
  let context;
  let master;
  let loopTimer;
  let playing = false;
  let destroyed = false;
  let nextLoopStart = 0;

  const setTimer = window?.setTimeout?.bind(window) ?? globalThis.setTimeout;
  const clearTimer = window?.clearTimeout?.bind(window) ?? globalThis.clearTimeout;

  function createVoice(note, start, duration, type, volume, destination) {
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    const end = start + duration;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(midiToFrequency(note), start);
    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.linearRampToValueAtTime(volume, start + Math.min(0.08, duration / 4));
    envelope.gain.setTargetAtTime(volume * 0.72, start + 0.12, 0.35);
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(envelope);
    envelope.connect(destination);
    oscillator.start(start);
    oscillator.stop(end + 0.02);
  }

  function scheduleLoop(start) {
    if (!playing || !context || !master) return;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1650, start);
    filter.Q.setValueAtTime(0.7, start);
    filter.connect(master);

    CHORDS.forEach((chord, chordIndex) => {
      const chordStart = start + (chordIndex * 4 * BEAT_SECONDS);
      chord.forEach((note) => {
        createVoice(note, chordStart, (4 * BEAT_SECONDS) - 0.08, 'triangle', 0.026, filter);
      });

      for (let pulse = 0; pulse < 2; pulse += 1) {
        createVoice(
          BASS[chordIndex],
          chordStart + (pulse * 2 * BEAT_SECONDS),
          1.6 * BEAT_SECONDS,
          'sine',
          0.042,
          filter,
        );
      }
    });

    MELODY.forEach((note, index) => {
      const melodyStart = start + ((index * 2 + 0.5) * BEAT_SECONDS);
      createVoice(note, melodyStart, 0.72 * BEAT_SECONDS, 'triangle', 0.018, filter);
    });

    nextLoopStart = start + LOOP_SECONDS;
    loopTimer = setTimer(() => {
      loopTimer = undefined;
      scheduleLoop(nextLoopStart);
    }, Math.max(0, (LOOP_SECONDS - 0.65) * 1000));
    loopTimer?.unref?.();
  }

  async function start() {
    if (destroyed || !getEnabled()) return false;
    if (playing) return true;
    const activation = window?.navigator?.userActivation;
    if (activation && !activation.isActive) return false;
    const AudioContext = window?.AudioContext ?? window?.webkitAudioContext;
    if (!AudioContext) return false;

    try {
      context ??= new AudioContext();
      if (context.state === 'suspended') {
        if (typeof context.resume !== 'function') return false;
        await context.resume();
        if (context.state === 'suspended') return false;
      }

      master = context.createGain();
      master.gain.setValueAtTime(0.0001, context.currentTime);
      master.gain.linearRampToValueAtTime(0.82, context.currentTime + 0.45);
      master.connect(context.destination);
      playing = true;
      scheduleLoop(context.currentTime + 0.05);
      return true;
    } catch {
      playing = false;
      return false;
    }
  }

  function stop() {
    if (!playing) return false;
    playing = false;
    if (loopTimer !== undefined) {
      clearTimer(loopTimer);
      loopTimer = undefined;
    }
    if (master && context) {
      try {
        master.gain.cancelScheduledValues(context.currentTime);
        master.gain.setValueAtTime(0.0001, context.currentTime);
      } catch {
        // Audio may already have been released by the browser.
      }
    }
    master = undefined;
    return true;
  }

  async function destroy() {
    if (destroyed) return false;
    destroyed = true;
    stop();
    if (context?.close) {
      try {
        await context.close();
      } catch {
        // Closing audio is best-effort during page teardown.
      }
    }
    context = undefined;
    return true;
  }

  return {
    start,
    stop,
    destroy,
    isPlaying: () => playing,
  };
}

