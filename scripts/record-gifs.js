// Record README GIFs of the real built component (dist/ascii-scribe.js) in headless Chrome.
// The page clock is virtual: every frame advances exactly 1000/FPS ms, so GIFs are smooth and reproducible.
//   npm run gifs        → docs/*.gif
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { PNG } from 'pngjs';
import gifenc from 'gifenc';

const { GIFEncoder, quantize, applyPalette } = gifenc;
const FPS = 15;
const STEP = 1000 / FPS;
const root = new URL('..', import.meta.url);
const js = await readFile(new URL('dist/ascii-scribe.js', root), 'utf8');

const BROWSERS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

// Virtual clock: performance.now / requestAnimationFrame only move when the recorder calls __advance(ms).
const CLOCK = `(() => {
  let now = 0; let queue = [];
  performance.now = () => now;
  window.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
  window.cancelAnimationFrame = () => {};
  window.__advance = (ms) => { now += ms; const q = queue; queue = []; for (const cb of q) cb(now); };
  window.__events = [];
  addEventListener('ascii-scribe:written', (e) => __events.push('written:' + e.detail.index), true);
  addEventListener('ascii-scribe:erased', (e) => __events.push('erased:' + e.detail.index), true);
})();`;

const PAGE = (body, width) => `<!doctype html><html><head><meta charset="utf-8">
<style>
  html, body { margin: 0; background: #0d1117; }
  #stage { width: ${width}px; padding: 18px 20px; box-sizing: border-box; color: #7ee787; font: 13px system-ui, sans-serif; }
  ascii-scribe { color: #7ee787; }
  .label { color: #8b949e; margin: 10px 0 2px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; }
</style></head><body><div id="stage">${body}</div></body></html>`;

const SHOTS = [
  {
    file: 'hero.gif',
    width: 720,
    body: `<ascii-scribe style="font-size:20px" strings='["ascii-scribe", "S&amp;@ 42?"]'></ascii-scribe>`,
    until: (ev) => ev.includes('written:1'),
    tail: 1500,
  },
  {
    file: 'fonts.gif',
    width: 640,
    body: `<div>${['Standard', 'Big', 'Slant', 'Small', 'Small Slant', 'Shadow', 'Script']
      .map((f) => `<div><div class="label">${f}</div><ascii-scribe style="font-size:11px" font="${f}" loop="false" strings='["ascii-scribe"]'></ascii-scribe></div>`)
      .join('')}</div>`,
    until: (ev) => ev.filter((e) => e === 'written:0').length >= 7,
    tail: 1500,
  },
  {
    file: 'symbols.gif',
    width: 760,
    body: `<ascii-scribe style="font-size:18px" font="Big" loop="false" strings='["ascii-scribe"]'></ascii-scribe>`,
    until: (ev) => ev.includes('written:0'),
    tail: 1500,
  },
];

const executablePath = BROWSERS.find((p) => existsSync(p));
if (!executablePath) throw new Error('no Chromium-based browser found; set CHROME_PATH');
const browser = await chromium.launch({ executablePath });
await mkdir(new URL('docs/', root), { recursive: true });

for (const shot of SHOTS) {
  const page = await browser.newPage({ viewport: { width: shot.width, height: 800 }, deviceScaleFactor: 1 });
  await page.addInitScript(CLOCK);
  await page.route('http://gif.test/**', (route) =>
    route.request().url().endsWith('.js')
      ? route.fulfill({ body: js, contentType: 'text/javascript' })
      : route.fulfill({ body: PAGE(shot.body, shot.width), contentType: 'text/html' }),
  );
  await page.goto('http://gif.test/');
  await page.addScriptTag({ url: 'http://gif.test/ascii-scribe.js', type: 'module' });
  await page.waitForFunction(() => customElements.get('ascii-scribe'));
  const stage = page.locator('#stage');

  const gif = GIFEncoder();
  let last = null;
  let lastDelay = 0;
  let frames = 0;
  let doneAt = null;
  const flush = () => {
    if (!last) return;
    const palette = quantize(last.data, 128, { format: 'rgb565' });
    gif.writeFrame(applyPalette(last.data, palette, 'rgb565'), last.width, last.height, { palette, delay: lastDelay });
    frames++;
  };
  for (let t = 0; t < 120000; t += STEP) {
    await page.evaluate((ms) => window.__advance(ms), STEP);
    const png = PNG.sync.read(await stage.screenshot());
    const same = last && png.width === last.width && png.height === last.height && Buffer.compare(png.data, last.data) === 0;
    if (same) lastDelay += STEP; // merge identical frames into one longer frame
    else {
      flush();
      last = png;
      lastDelay = STEP;
    }
    const ev = await page.evaluate(() => window.__events);
    if (doneAt === null && shot.until(ev)) doneAt = t;
    if (doneAt !== null && t - doneAt >= shot.tail) break;
  }
  flush();
  gif.finish();
  const out = new URL(`docs/${shot.file}`, root);
  await writeFile(out, gif.bytes());
  console.log(`${shot.file}: ${frames} frames, ${(gif.bytes().length / 1024).toFixed(0)} KiB`);
  await page.close();
}
await browser.close();
