// Generates the app icon, splash and favicons from vector sources.
//
// The mark: a loaded barbell seen end-on is a stack of plates, and stacking
// them taller is the whole idea of progressive overload. Three plates rise left
// to right in the accent, with an arrowhead on the last one.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, 'assets');
fs.mkdirSync(OUT, { recursive: true });

const INK = '#0B0C0E';
const VOLT = '#C8F031';

function mark({ bg = INK, fg = VOLT, inset = 0 } = {}) {
  const k = (1024 - inset * 2) / 1024;
  const t = (v) => (inset + v * k).toFixed(2);
  const w = (v) => (v * k).toFixed(2);
  // Three plates on a common baseline, rising left to right, with an
  // arrowhead floating clear of the tallest.
  const base = 860;
  const PW = 150;
  const GAP = 52;
  const x0 = (1024 - (PW * 3 + GAP * 2)) / 2;
  const heights = [230, 390, 550];
  const bars = heights
    .map((h, i) => `<rect x="${t(x0 + i * (PW + GAP))}" y="${t(base - h)}" width="${w(PW)}" height="${w(h)}" rx="${w(40)}" fill="${fg}" opacity="${[0.5, 0.75, 1][i]}"/>`)
    .join('');
  const ax = x0 + 2 * (PW + GAP) + PW / 2;
  const top = base - heights[2];
  const arrow = `<path d="M${t(ax - 105)} ${t(top - 60)} L${t(ax)} ${t(top - 160)} L${t(ax + 105)} ${t(top - 60)}" fill="none" stroke="${fg}" stroke-width="${w(58)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${bg === 'none' ? '' : `<rect width="1024" height="1024" fill="${bg}"/>`}
  ${bars}
  ${arrow}
</svg>`;
}

/** Splash: the mark, smaller, centred on the app background. */
function splash() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="none"/>
  <g transform="translate(212,212) scale(0.586)">
    ${mark({ bg: 'none' }).replace(/<\/?svg[^>]*>/g, '')}
  </g>
</svg>`;
}

async function write(name, svg, size) {
  const file = path.join(OUT, name);
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(file);
  const kb = (fs.statSync(file).size / 1024).toFixed(1);
  console.log(`  ${name.padEnd(32)} ${size}x${size}  ${kb} KB`);
}

console.log('assets:');
await write('icon.png', mark(), 1024);
await write('favicon.png', mark(), 96);
await write('splash.png', splash(), 1024);
// Android adaptive icon: the foreground is padded so the system mask cannot
// clip the mark, and the background is a flat plate.
await write('android-icon-foreground.png', mark({ bg: 'none', inset: 190 }), 1024);
await write(
  'android-icon-background.png',
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${INK}"/></svg>`,
  1024,
);
await write(
  'android-icon-monochrome.png',
  mark({ bg: 'none', fg: '#FFFFFF', inset: 190 }),
  1024,
);
console.log('done');
