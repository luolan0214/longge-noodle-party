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
