import test from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readText = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

function filesUnder(relativeDirectory, extension) {
  const directory = path.join(root, relativeDirectory);
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return filesUnder(relativePath, extension);
    return entry.isFile() && relativePath.endsWith(extension) ? [relativePath] : [];
  });
}

function jpegDimensions(buffer) {
  assert.deepEqual([...buffer.subarray(0, 2)], [0xff, 0xd8], 'JPEG SOI signature is invalid');
  const startOfFrameMarkers = new Set([
    0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
    0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
  ]);
  let offset = 2;

  while (offset < buffer.length) {
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    assert.ok(offset + 1 < buffer.length, 'JPEG segment is truncated');
    const length = buffer.readUInt16BE(offset);
    assert.ok(length >= 2 && offset + length <= buffer.length, 'JPEG segment length is invalid');
    if (startOfFrameMarkers.has(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5),
      };
    }
    offset += length;
  }

  assert.fail('JPEG has no supported SOF marker');
}

test('release sources include the publishing guide and contain no private names or placeholders', () => {
  const protectedNames = [
    [0x8427, 0x7136],
    [0x6f47, 0x7136],
    [0x8096, 0x7136],
  ].map((codePoints) => String.fromCodePoint(...codePoints));
  const sourceFiles = [
    'index.html',
    ...filesUnder('js', '.js'),
    ...filesUnder('styles', '.css'),
  ];

  assert.ok(existsSync(path.join(root, 'README.md')), 'README.md is required for release');
  sourceFiles.push('README.md');

  sourceFiles.forEach((relativePath) => {
    const contents = readText(relativePath);
    protectedNames.forEach((name) => {
      assert.equal(contents.includes(name), false, `${relativePath} contains a protected name`);
    });
    assert.doesNotMatch(contents, /\b(?:TODO|TBD|PLACEHOLDER)\b/i, `${relativePath} contains a placeholder`);
  });
});

test('every local HTML src and href is relative and resolves to an existing file', () => {
  const html = readText('index.html');
  const references = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)].map((match) => match[1]);
  const localReferences = references.filter((reference) => (
    !/^(?:https?:|mailto:|#|\/\/)/i.test(reference)
  ));

  assert.ok(localReferences.length > 0, 'expected local HTML references');
  localReferences.forEach((reference) => {
    assert.equal(path.isAbsolute(reference), false, `${reference} must be relative`);
    const pathname = decodeURIComponent(reference.split(/[?#]/, 1)[0]);
    assert.ok(statSync(path.resolve(root, pathname)).isFile(), `${reference} does not resolve to a file`);
  });
});

test('every CSS asset URL stays under assets and resolves', () => {
  filesUnder('styles', '.css').forEach((relativePath) => {
    const contents = readText(relativePath);
    const urls = [...contents.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map((match) => match[1]);
    urls.forEach((reference) => {
      assert.match(reference, /^\.\.\/assets\//, `${relativePath}: ${reference} must use ../assets/`);
      assert.ok(existsSync(path.resolve(root, path.dirname(relativePath), reference)), `${relativePath}: ${reference} is missing`);
    });
  });
});

test('every relative JavaScript import resolves', () => {
  filesUnder('js', '.js').forEach((relativePath) => {
    const contents = readText(relativePath);
    const imports = [
      ...contents.matchAll(/\b(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["'](\.[^"']+)["']/g),
    ].map((match) => match[1]);
    imports.forEach((reference) => {
      assert.ok(existsSync(path.resolve(root, path.dirname(relativePath), reference)), `${relativePath}: ${reference} is missing`);
    });
  });
});

test('package.json has no runtime or development dependencies', () => {
  const packageJson = JSON.parse(readText('package.json'));
  assert.equal(packageJson.dependencies, undefined);
  assert.equal(packageJson.devDependencies, undefined);
});

test('release raster assets have valid signatures and exact dimensions', () => {
  const png = readFileSync(path.join(root, 'assets/characters/group-photo.png'));
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(png.subarray(12, 16).toString('ascii'), 'IHDR');
  assert.deepEqual({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) }, { width: 1200, height: 800 });

  const jpeg = readFileSync(path.join(root, 'assets/og/party-preview.jpg'));
  assert.deepEqual(jpegDimensions(jpeg), { width: 1200, height: 630 });
});

test('production SVG assets are inert, self-contained SVG documents', () => {
  const svgFiles = filesUnder('assets', '.svg').filter((relativePath) => !relativePath.startsWith(`assets${path.sep}source${path.sep}`));
  assert.ok(svgFiles.length > 0, 'expected production SVG assets');
  svgFiles.forEach((relativePath) => {
    const contents = readText(relativePath);
    assert.match(contents, /^\s*<svg\b/i, `${relativePath} must start with <svg>`);
    assert.doesNotMatch(contents, /<(?:script|foreignObject)\b/i, `${relativePath} contains active content`);
    assert.doesNotMatch(contents, /\bonload\s*=/i, `${relativePath} contains onload`);
    assert.doesNotMatch(contents, /\b(?:href|src)\s*=\s*["']https?:\/\//i, `${relativePath} contains an HTTP external reference`);
    assert.doesNotMatch(contents, /url\(\s*["']?https?:\/\//i, `${relativePath} contains an HTTP external URL`);
  });
});

test('map link and all shipped interaction controls are present', () => {
  const html = readText('index.html');
  const address = html.match(/<address\b[^>]*id=["']party-address["'][^>]*>([^<]+)<\/address>/i)?.[1].trim();
  const mapHref = html.match(/href=["'](https:\/\/www\.google\.com\/maps\/search\/\?[^"']+)["']/i)?.[1].replaceAll('&amp;', '&');
  assert.ok(address, 'complete party address is missing');
  assert.ok(mapHref, 'Google Maps link is missing');
  const mapUrl = new URL(mapHref);
  assert.equal(mapUrl.searchParams.get('api'), '1');
  assert.equal(mapUrl.searchParams.get('query'), address);
  assert.equal(mapUrl.searchParams.getAll('query').length, 1);

  const shippedActions = [
    'doorbell', 'copy-address', 'share', 'toggle-sound', 'replay',
    'open-snack-bag', 'camera-shutter', 'slice-watermelon', 'pass-mic',
    'moon-keyboard-step', 'door-light',
  ];
  shippedActions.forEach((action) => {
    assert.match(html, new RegExp(`data-action=["']${action}["']`), `missing data-action=${action}`);
  });

  const toppings = [...html.matchAll(/\bdata-topping=["']([^"']+)["']/g)].map((match) => match[1]);
  assert.deepEqual(toppings, ['cucumber', 'carrot', 'sprouts', 'sauce']);
  assert.match(html, /<input\b(?=[^>]*\btype=["']range["'])(?=[^>]*\bdata-moon-range\b)[^>]*>/i);
});
