/**
 * Captures App Store screenshots from the running web build.
 *
 *   1. node --experimental-strip-types scripts/make-demo.mjs
 *      (writes six months of training to .scratch/demo-db.json; copy it to
 *      public/demo-db.json so the dev server serves it)
 *   2. start the dev server:  npx expo start --web --port 8099
 *   3. node scripts/make-screenshots.mjs
 *
 * Every shot is the real app in a real state: the history is loaded through
 * the same importer users run, and the workout shots are driven with actual
 * taps and typing — the PR trophy in shot 2 is the app reacting to a set it
 * has just been given, not a mock-up.
 */
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const BASE = 'http://localhost:8099';
const OUT = 'store/screenshots';

// 6.9 inch and 6.5 inch iPhones. The app is iPhone-only (supportsTablet is
// false), so no iPad set is required.
const DEVICES = [
  { name: '6.9', width: 1320, height: 2868, css: [440, 956], scale: 3, radius: 0.075 },
  { name: '6.5', width: 1242, height: 2688, css: [414, 896], scale: 3, radius: 0.075 },
];

const BG = '#0B0C0E';
const INK = '#F4F5F6';
const VOLT = '#C8F031';
const SUB = 'No account. No ads. Nothing locked.';

const seed = `(async () => {
  const t = await fetch('/demo-db.json').then((r) => r.text());
  localStorage.setItem('overload.db', t);
  localStorage.removeItem('overload.active');
})()`;

const tid = (id) => `[data-testid="${id}"]`;

const SHOTS = [
  {
    id: '1',
    headline: ['Know exactly what', 'to lift next'],
    async run(page) {
      await click(page, tid('tab-train'));
      await click(page, tid('routine-Push'));
      await click(page, tid('check-0-0'));
      await settle(page, 1500);
    },
  },
  {
    id: '2',
    headline: ['Records the moment', 'you set them'],
    async run(page) {
      await click(page, tid('tab-train'));
      await click(page, tid('routine-Push'));
      await click(page, tid('check-0-0'));
      await type(page, tid('in-a-0-1'), '85');
      await type(page, tid('in-b-0-1'), '5');
      await click(page, tid('check-0-1'), 300);
    },
  },
  {
    id: '3',
    headline: ['Every chart.', 'Nothing locked.'],
    async run(page) {
      await click(page, tid('tab-exercises'));
      await type(page, tid('exercise-search'), 'squat barbell');
      await click(page, tid('ex-squat-barbell'), 1200);
    },
  },
  {
    id: '4',
    headline: ['Spots a stall', 'before you do'],
    async run(page) {
      await page.evaluate(() => {
        // Scroll the Today screen down to the overload board.
        const el = [...document.querySelectorAll('div')].find((d) => d.scrollHeight > d.clientHeight + 200 && getComputedStyle(d).overflowY !== 'visible');
        if (el) el.scrollTop = 470;
      });
      await settle(page, 600);
    },
  },
  {
    id: '5',
    headline: ['Every muscle,', 'every week'],
    async run(page) {
      await click(page, tid('tab-progress'), 1000);
    },
  },
];

async function settle(page, ms = 550) {
  await new Promise((r) => setTimeout(r, ms));
}

async function click(page, selector, wait = 550) {
  await page.waitForSelector(selector, { timeout: 15000 });
  await page.click(selector);
  await settle(page, wait);
}

async function type(page, selector, text) {
  await page.waitForSelector(selector, { timeout: 15000 });
  await page.click(selector);
  await page.type(selector, text, { delay: 18 });
  await settle(page, 700);
  // Drop the caret so the shot is not captured mid-blink.
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  await settle(page, 250);
}

function captionSvg(width, headline) {
  const lines = headline;
  const size = Math.round(width * 0.062);
  const lead = Math.round(size * 1.2);
  const top = Math.round(width * 0.16);
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const font = 'Helvetica Neue, Helvetica, Arial, sans-serif';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${Math.round(width * 0.62)}">
    <rect width="100%" height="100%" fill="${BG}"/>
    ${lines
      .map(
        (l, i) =>
          `<text x="50%" y="${top + i * lead}" text-anchor="middle" fill="${i === lines.length - 1 ? VOLT : INK}" font-family="${font}" font-size="${size}" font-weight="800" letter-spacing="-1.4">${esc(l)}</text>`,
      )
      .join('')}
    <text x="50%" y="${top + lines.length * lead + Math.round(size * 0.5)}" text-anchor="middle" fill="#A3A9B1" font-family="${font}" font-size="${Math.round(size * 0.4)}" font-weight="500">${esc(SUB)}</text>
  </svg>`;
}

function chromePath() {
  return (
    process.env.CHROME_PATH ||
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  );
}

mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: chromePath(),
  headless: 'new',
  args: ['--force-device-scale-factor=1', '--hide-scrollbars'],
});

try {
  for (const device of DEVICES) {
    const page = await browser.newPage();
    await page.setViewport({
      width: device.css[0],
      height: device.css[1],
      deviceScaleFactor: device.scale,
      isMobile: true,
      hasTouch: true,
    });

    for (const shot of SHOTS) {
      // Reseed before every shot so each one starts from the same library.
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.evaluate(seed);
      await page.goto(BASE, { waitUntil: 'networkidle0' });
      await page.waitForSelector(tid('tab-today'), { timeout: 30000 });
      await page.evaluate(() => {
        // Chrome paints a focus ring iOS never draws.
        const style = document.createElement('style');
        style.textContent = '*{outline:none !important;caret-color:transparent !important;}';
        document.head.appendChild(style);
      });
      await settle(page, 900);
      await shot.run(page);

      const appShot = await page.screenshot({ type: 'png' });

      const capHeight = Math.round(device.height * 0.19);
      const caption = await sharp(Buffer.from(captionSvg(device.width, shot.headline)))
        .resize(device.width, capHeight, { fit: 'cover', position: 'top' })
        .png()
        .toBuffer();

      // Size the phone screen so the whole thing fits under the caption. Picking
      // a width by eye overflowed the canvas and cropped the compose button off
      // the bottom of every shot.
      const margin = Math.round(device.height * 0.02);
      const maxByHeight = Math.floor(((device.height - capHeight - margin) * device.css[0]) / device.css[1]);
      const screenWidth = Math.min(Math.round(device.width * 0.86), maxByHeight);
      const screen = await sharp(appShot).resize({ width: screenWidth }).png().toBuffer();
      const meta = await sharp(screen).metadata();
      const rounded = await sharp(screen)
        .composite([
          {
            input: Buffer.from(
              `<svg width="${meta.width}" height="${meta.height}"><rect width="${meta.width}" height="${meta.height}" rx="${Math.round(meta.width * device.radius)}" fill="#fff"/></svg>`,
            ),
            blend: 'dest-in',
          },
        ])
        .png()
        .toBuffer();

      const file = `${OUT}/${device.name}-${shot.id}.png`;
      await sharp({
        create: { width: device.width, height: device.height, channels: 4, background: BG },
      })
        .composite([
          { input: caption, top: 0, left: 0 },
          { input: rounded, top: capHeight, left: Math.round((device.width - screenWidth) / 2) },
        ])
        .flatten({ background: BG })
        .png()
        .toFile(file);
      console.log(`wrote ${file}`);
    }
    await page.close();
  }
} finally {
  await browser.close();
}
