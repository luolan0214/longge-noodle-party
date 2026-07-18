import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const styleNames = ['tokens', 'base', 'components', 'animations'];

async function read(relativePath) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

test('scrapbook stylesheets expose the required design system', async () => {
  const [tokens, base, components, animations] = await Promise.all(
    styleNames.map((name) => read(`styles/${name}.css`)),
  );

  for (const color of ['#FFF8E8', '#663C2A', '#E85D4A', '#F5C84C', '#83A95C', '#F5B8C1']) {
    assert.ok(tokens.toUpperCase().includes(color), `missing color token ${color}`);
  }
  assert.match(tokens, /--(?:content|max)-width\s*:\s*430px/i);
  assert.match(tokens, /--(?:touch|min-touch)\s*:\s*44px/i);
  assert.match(base, /box-sizing\s*:\s*border-box/i);
  assert.match(base, /focus-visible/i);
  assert.match(components, /\.plan-card__panel/);
  assert.match(components, /\.group-photo/);
  assert.match(components, /\.toast/);
  assert.match(animations, /prefers-reduced-motion\s*:\s*reduce/i);
  assert.doesNotMatch(animations, /animation(?:-iteration-count)?[^;]*(?:infinite|Infinity)/i);
});

test('hand-drawn utility icons are local standalone SVG artwork', async () => {
  for (const name of ['map', 'copy', 'share', 'sound']) {
    const svg = await read(`assets/icons/${name}.svg`);
    assert.match(svg, /^<svg\b/);
    assert.match(svg, /#663C2A/i);
    assert.doesNotMatch(svg, /(?:href|src)=["'](?:https?:|\/\/)/i);
  }
});

test('stamp styling distinguishes fallback, viewed, and completed states', async () => {
  const [html, components, animations] = await Promise.all([
    read('index.html'),
    read('styles/components.css'),
    read('styles/animations.css'),
  ]);

  assert.match(html, /<p class="stamp" data-stamp>\S+/);
  assert.match(components, /\.js\s+\.stamp\s*\{[^}]*opacity\s*:/s);
  assert.match(
    components,
    /\.js\s+\.plan-card\.is-viewed:not\(\.is-completed\)\s+\.stamp::before\s*\{[^}]*content\s*:\s*[“"']已翻阅\s*·\s*[”"']/s,
  );
  assert.match(
    components,
    /\.js\s+\.plan-card\.is-completed\s+\.stamp::before\s*\{[^}]*content\s*:\s*[“"']✓\s+[”"']/s,
  );
  assert.match(
    components,
    /\.js\s+\.plan-card\.is-completed\s+\.stamp\s*\{[^}]*color\s*:\s*var\(--color-accent-text\)[^}]*rotate\s*:/s,
  );
  assert.doesNotMatch(animations, /\.plan-card\.is-viewed\s+\.stamp\s*\{[^}]*animation\s*:\s*stamp-pop/s);
});

test('small accent text and selected toppings use AA contrast colors', async () => {
  const [tokens, components] = await Promise.all([
    read('styles/tokens.css'),
    read('styles/components.css'),
  ]);
  const token = (name) => tokens.match(new RegExp(`--${name}\\s*:\\s*(#[0-9a-f]{6})`, 'i'))?.[1];
  const luminance = (hex) => {
    const [red, green, blue] = hex.match(/[0-9a-f]{2}/gi)
      .map((channel) => Number.parseInt(channel, 16) / 255)
      .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
    return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
  };
  const contrast = (foreground, background) => {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
  };
  const accentText = token('color-accent-text');
  const paper = token('color-paper');
  const white = token('color-white');
  const cucumberDeep = token('color-cucumber-deep');

  assert.ok(accentText && paper && white && cucumberDeep, 'missing AA contrast color token');
  assert.ok(contrast(accentText, paper) >= 4.5);
  assert.ok(contrast(white, cucumberDeep) >= 4.5);
  for (const selector of [
    '.cover__eyebrow',
    '.roster figcaption span',
    '.plan-card__toggle > span:first-child',
    '.js .plan-card.is-completed .stamp',
  ]) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(components, new RegExp(`${escaped}\\s*\\{[^}]*color\\s*:\\s*var\\(--color-accent-text\\)`, 's'));
  }
  assert.match(
    components,
    /\.noodle-game__toppings button\[aria-pressed="true"\]\s*\{(?=[^}]*background\s*:\s*var\(--color-cucumber-deep\))(?=[^}]*color\s*:\s*var\(--color-white\))[^}]*\}/s,
  );
});

test('sound control uses the local hand-drawn icon without replacing its label', async () => {
  const components = await read('styles/components.css');

  assert.match(
    components,
    /\.top-tools button\[data-action="toggle-sound"\]\s*\{[^}]*background-image\s*:\s*url\("\.\.\/assets\/icons\/sound\.svg"\)/s,
  );
});

test('interaction styles target every runtime state class', async () => {
  const [components, animations] = await Promise.all([
    read('styles/components.css'),
    read('styles/animations.css'),
  ]);
  const styles = `${components}\n${animations}`;

  for (const state of [
    'is-ringing', 'is-peeking', 'is-open', 'is-ready', 'is-flashing',
    'is-ejected', 'is-sliced', 'has-mic', 'is-night', 'is-lit',
  ]) {
    assert.match(styles, new RegExp(`\\.${state}\\b`), `missing runtime style for ${state}`);
  }
  assert.match(components, /\.moon-game__track\s*\{[^}]*touch-action\s*:\s*pan-y/s);
  assert.match(animations, /watermelon-take/);
});

test('night state animates farewell guests and hosts without overflowing the scene', async () => {
  const [components, animations] = await Promise.all([
    read('styles/components.css'),
    read('styles/animations.css'),
  ]);

  assert.match(components, /\.farewell-scene\s*\{(?=[^}]*max-width\s*:\s*100%)(?=[^}]*min-width\s*:\s*0)[^}]*\}/s);
  assert.match(components, /\.farewell-scene__guests\s*\{[^}]*grid-template-columns\s*:\s*repeat\(4\s*,\s*minmax\(0\s*,\s*1fr\)\)/s);
  assert.match(animations, /\.plan-card\.is-night\s+\.farewell-scene__guest\s+img\s*\{[^}]*animation\s*:\s*guest-farewell[^}]*\}/s);
  assert.match(animations, /\.plan-card\.is-night\s+\.farewell-scene__host\s+img\s*\{[^}]*animation\s*:\s*host-goodbye[^}]*\}/s);
});

test('ringing door reveals one-shot welcome steam with reduced-motion coverage', async () => {
  const [components, animations] = await Promise.all([
    read('styles/components.css'),
    read('styles/animations.css'),
  ]);

  assert.match(components, /\.welcome-steam\s*\{[^}]*opacity\s*:\s*0[^}]*\}/s);
  assert.match(
    animations,
    /\.cover__door\.is-ringing\s+\.welcome-steam\s*\{[^}]*animation\s*:\s*welcome-steam-rise\s+(?:[1-8]\d{0,2}|900)ms[^}]*\}/s,
  );
  assert.doesNotMatch(animations, /welcome-steam-rise[^;}]*\binfinite\b/i);
  assert.match(animations, /@media\s*\(prefers-reduced-motion\s*:\s*reduce\)/i);
});
