// <ascii-scribe> in a real headless browser. The expected art comes from a separate figlet.textSync() call in Node
// (figlet loads the .flf files itself; this file never calls registerFonts), and the actual art is read from the
// element's DOM text.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import figlet from 'figlet';
import { FONTS } from '../src/fonts.js';
import { deriveStrokes } from '../src/strokes.js';
import { letterStarts } from '../src/letters.js';
import { randomStrings, resolveSeed } from './helpers/random.js';
import { bundle, launch, openPage } from './helpers/browser.js';

const seed = resolveSeed();
const tag = `(SCRIBE_SEED=${seed})`;
const expected = (text, font) => figlet.textSync(text, { font });

let browser;
let js;
before(async () => {
  js = await bundle();
  browser = await launch();
});
after(async () => browser?.close());

/** Mount an element; record every event with the DOM text at that moment, and every rendered frame. */
async function mount(page, attrs) {
  await page.evaluate((attrs) => {
    const el = document.createElement('ascii-scribe');
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    const pre = el.shadowRoot.querySelector('pre');
    window.__events = [];
    window.__frames = [];
    new MutationObserver(() => window.__frames.push(pre.textContent)).observe(pre, { childList: true, characterData: true, subtree: true });
    for (const what of ['written', 'erased']) {
      el.addEventListener(`ascii-scribe:${what}`, (e) =>
        window.__events.push({
          what,
          ...e.detail,
          art: pre.textContent,
          preScroll: pre.scrollWidth,
          preClient: pre.clientWidth,
          preRight: pre.getBoundingClientRect().right,
          hostRight: el.getBoundingClientRect().right,
          docScroll: document.documentElement.scrollWidth,
        }),
      );
    }
    document.body.append(el);
  }, attrs);
}
const events = (page) => page.evaluate(() => window.__events);
const waitEvents = (page, n) => page.waitForFunction((n) => window.__events.length >= n, n, { timeout: 30000 });

test(`DOM text when a sentence is written equals an independent figlet.textSync(), every font ${tag}`, async () => {
  const strings = randomStrings(seed, 4);
  const { page, context, errors } = await openPage(browser, js);
  for (const font of FONTS) {
    await page.evaluate(() => document.body.replaceChildren());
    await mount(page, { font, strings: JSON.stringify(strings), speed: '1000000', lift: '0', pause: '0', loop: 'false' });
    await page.waitForFunction((n) => window.__events.filter((e) => e.what === 'written').length >= n, strings.length, {
      timeout: 30000,
    });
    const written = (await events(page)).filter((e) => e.what === 'written');
    written.forEach((e, i) => {
      assert.equal(e.text, strings[i], `${font} ${tag}`);
      assert.equal(e.art, expected(strings[i], font), `${font} text=${JSON.stringify(strings[i])} ${tag}`);
    });
  }
  assert.deepEqual(errors, []);
  await context.close();
});

const inkSet = (art) => {
  const s = new Set();
  art.split('\n').forEach((line, r) => [...line].forEach((ch, c) => ch !== ' ' && s.add(`${r},${c}`)));
  return s;
};
const subset = (a, b) => [...a].every((x) => b.has(x));

/** Writing order the engine derives (computed here in Node, from the independent figlet render). */
const engineOrder = (text, font) => {
  const render = (t) => expected(t, font);
  return deriveStrokes(render(text), { letterStarts: letterStarts(render, text) }).flat().map(([r, c]) => `${r},${c}`);
};

test('frames follow the engine stroke order while writing; erasing walks back through it in reverse', async () => {
  for (const [text, font] of [['Hi!', 'Small'], ['S&@', 'Standard'], ['x/y', 'Slant']]) {
    const { page, context } = await openPage(browser, js);
    await mount(page, { font, strings: JSON.stringify([text]), speed: '45', pause: '100' });
    await page.waitForFunction(() => window.__events.some((e) => e.what === 'erased'), null, { timeout: 30000 });
    // Glow-only redraws repeat the same text: keep only frames whose text changed.
    const frames = (await page.evaluate(() => window.__frames)).filter((f, i, a) => i === 0 || f !== a[i - 1]);
    await context.close();
    const art = expected(text, font);
    const full = frames.indexOf(art);
    assert.ok(full > 0, `${text}: never fully written`);
    const write = frames.slice(0, full + 1).map(inkSet);
    const erase = frames.slice(full + 1).map(inkSet);
    // Fine-grained enough to mean something: most single cells got their own frame.
    assert.ok(write.length >= inkSet(art).size * 0.5, `${text}: only ${write.length} write frames`);
    for (let i = 1; i < write.length; i++) assert.ok(subset(write[i - 1], write[i]) && write[i].size > write[i - 1].size);
    // Every write frame shows exactly the first k cells of the engine's order (not a scan, not another order).
    const order = engineOrder(text, font);
    for (const w of write) {
      assert.deepEqual(w, new Set(order.slice(0, w.size)), `${text}: write frame of ${w.size} cells is not an engine prefix`);
    }
    for (let i = 1; i < erase.length; i++) assert.ok(subset(erase[i], erase[i - 1]) && erase[i].size < erase[i - 1].size);
    assert.equal(erase.at(-1).size, 0, `${text}: not fully erased`);
    // Every erase frame lies between two consecutive write frames: erasing = writing in reverse.
    for (const e of erase) {
      const below = write.filter((w) => w.size <= e.size).at(-1) ?? new Set();
      const above = write.find((w) => w.size >= e.size);
      assert.ok(subset(below, e) && subset(e, above), `${text}: erase frame of ${e.size} cells is not a write prefix`);
    }
  }
});

// Every frame of every sentence must show a prefix of the engine's order (writing grows it, erasing shrinks it),
// under the defaults and every documented attribute setting: no font attribute (default Standard), plain-text
// strings, a single sentence, defaults watched into the second loop, a pause, slow and fast speeds, phone width,
// loop="false". Random strings; where a font is set, all 7 fonts run side by side in one page.
// Writing must also be gradual: during the write phase there must be at least WRITE_FRAME_RATIO of the frames
// the speed allows (cells ÷ cells-per-frame at 60 fps), so a sentence cannot pop in at once.
// (Decision 2026-11-08: black-box tests cover defaults and documented attribute settings; contrived sabotage
// conditioned on other internal state is ruled out by reading the code.)
const LONG = 'Ab3 {x}/|_~';
const WRITE_FRAME_RATIO = 0.5;
const DEFAULT_SPEED = 32; // README / element.js default (base pace; easing and lifts only add frames)
const CONFIGS = [
  { name: 'defaults, no font attribute (loop, pause 1500, speed 32, ease, tip)', attrs: {}, noFont: true, rounds: 2, n: 1, maxLen: 6 },
  { name: 'defaults with each font', attrs: {}, rounds: 2, n: 1, maxLen: 3 },
  { name: 'plain-text strings (one sentence, not JSON), no font', attrs: {}, noFont: true, plain: true, rounds: 2 },
  { name: 'single sentence, every font', attrs: { speed: '200', pause: '200', lift: '20', ease: 'false' }, rounds: 2, n: 1, maxLen: 8 },
  { name: 'pause + loop, short lift', attrs: { pause: '300', speed: '400', lift: '40' }, rounds: 2, n: 2, long: true },
  { name: 'slow, even pace, no tip', attrs: { speed: '40', loop: 'false', ease: 'false', tip: 'false', lift: '0' }, rounds: 1, n: 2, maxLen: 3 },
  { name: 'fast, no loop', attrs: { speed: '900', pause: '0', loop: 'false', lift: '0' }, rounds: 1, n: 5, long: true },
  { name: 'phone width 360px, loop', attrs: { speed: '500', pause: '100', lift: '0' }, rounds: 2, n: 2, long: true, viewport: { width: 360, height: 900 } },
];

for (const [k, cfg] of CONFIGS.entries()) {
  test(`every frame is a prefix of the engine order, writing is gradual: ${cfg.name} ${tag}`, async () => {
    let strings;
    let attr;
    if (cfg.plain) {
      // Starts with a letter, so it is never valid JSON: the element must treat it as one sentence.
      strings = [`x${randomStrings(seed + 7 + k, 1, { maxLen: 8 })[0]}`];
      attr = strings[0];
    } else {
      strings = [...randomStrings(seed + 7 + k, cfg.n, cfg.maxLen ? { maxLen: cfg.maxLen } : undefined), ...(cfg.long ? [LONG] : [])];
      attr = JSON.stringify(strings);
    }
    const fonts = cfg.noFont ? [null] : FONTS;
    const speed = Number(cfg.attrs.speed ?? DEFAULT_SPEED);
    const { page, context, errors } = await openPage(browser, js, { viewport: cfg.viewport });
    await page.evaluate(({ fonts, attrs, attr }) => {
      window.__logs = {};
      fonts.forEach((font, id) => {
        const el = document.createElement('ascii-scribe');
        if (font !== null) el.setAttribute('font', font);
        el.setAttribute('strings', attr);
        for (const [a, v] of Object.entries(attrs)) el.setAttribute(a, v);
        const pre = el.shadowRoot.querySelector('pre');
        const log = (window.__logs[id] = []);
        const mo = new MutationObserver(() => log.push(pre.textContent));
        mo.observe(pre, { childList: true, characterData: true, subtree: true });
        // Events fire synchronously, mutation records arrive later as a microtask: flush them first, so the frame
        // that completed a sentence is logged before its 'written' event.
        for (const what of ['written', 'erased']) {
          el.addEventListener(`ascii-scribe:${what}`, (e) => {
            if (mo.takeRecords().length) log.push(pre.textContent);
            log.push({ what, index: e.detail.index });
          });
        }
        document.body.append(el);
      });
    }, { fonts, attrs: cfg.attrs, attr });
    // Wait until every element has written sentence 0 `rounds` times (loops) or written every sentence (no loop).
    await page.waitForFunction(
      ({ count, rounds, total }) =>
        Array.from({ length: count }, (_, id) => window.__logs[id]).every((log) => {
          const w = log.filter((x) => x.what === 'written');
          return rounds > 1 ? w.filter((x) => x.index === 0).length >= rounds : w.length >= total;
        }),
      { count: fonts.length, rounds: cfg.rounds, total: strings.length },
      { timeout: 120000, polling: 100 },
    );
    const logs = await page.evaluate(() => window.__logs);
    for (const [id, font] of fonts.entries()) {
      const usedFont = font ?? 'Standard';
      const orders = strings.map((t) => engineOrder(t, usedFont));
      const writeFrames = new Array(strings.length).fill(0);
      const written = new Array(strings.length).fill(false);
      let index = 0;
      let writing = true;
      let prev = 0;
      for (const item of logs[id]) {
        if (typeof item !== 'string') {
          if (item.what === 'written') {
            written[item.index] = true;
            writing = false;
          } else {
            index = (item.index + 1) % strings.length; // later frames: next sentence
            writing = true;
            prev = 0;
          }
          continue;
        }
        const ink = inkSet(item);
        const ctx = `${cfg.name} font=${usedFont} text=${JSON.stringify(strings[index])} ${tag}`;
        assert.deepEqual(ink, new Set(orders[index].slice(0, ink.size)), `${ctx}: frame of ${ink.size} cells is not an engine prefix`);
        // Count only frames that add ink during the first time each sentence is written.
        if (writing && !written[index] && ink.size > prev) writeFrames[index]++;
        if (writing) prev = ink.size;
      }
      writeFrames.forEach((n, i) => {
        const cells = orders[i].length;
        const possible = cells / Math.max(1, speed / 60);
        const need = Math.max(1, Math.min(cells, Math.floor(possible * WRITE_FRAME_RATIO)));
        assert.ok(
          n >= need,
          `${cfg.name} font=${usedFont} text=${JSON.stringify(strings[i])}: ${n} write frames for ${cells} cells, need ${need} ${tag}`,
        );
      });
    }
    assert.deepEqual(errors, []);
    await context.close();
  });
}

// Pen tip: fresh cells glow (spans) while writing; the glow fades completely; the text never changes because of it.
test('pen tip glows while writing, fades out completely, and never alters the text', async () => {
  const { page, context } = await openPage(browser, js);
  await page.evaluate(() => {
    window.__html = [];
    for (const [id, tip] of [['on', null], ['off', 'false']]) {
      const el = document.createElement('ascii-scribe');
      el.id = id;
      el.setAttribute('strings', '["S&@"]');
      el.setAttribute('speed', '60');
      el.setAttribute('lift', '60');
      el.setAttribute('loop', 'false');
      el.addEventListener('ascii-scribe:written', () => (window.__done = (window.__done || 0) + 1));
      if (tip) el.setAttribute('tip', tip);
      const pre = el.shadowRoot.querySelector('pre');
      new MutationObserver(() => window.__html.push({ id, html: pre.innerHTML, text: pre.textContent })).observe(pre, {
        childList: true,
        characterData: true,
        subtree: true,
      });
      document.body.append(el);
    }
  });
  await page.waitForFunction(() => ['on', 'off'].every((id) => window.__html.some((f) => f.id === id && f.text.replace(/\s/g, '').length > 0)));
  await page.waitForFunction(() => window.__done === 2, null, { timeout: 30000 });
  await page.waitForTimeout(700); // the glow fades within 420ms
  const frames = await page.evaluate(() => window.__html);
  const final = await page.evaluate(() => ['on', 'off'].map((id) => document.getElementById(id).shadowRoot.querySelector('pre').innerHTML));
  await context.close();
  const art = expected('S&@', 'Standard');
  const escape = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const on = frames.filter((f) => f.id === 'on');
  const off = frames.filter((f) => f.id === 'off');
  assert.ok(on.filter((f) => /class="t0"/.test(f.html)).length >= 5, 'tip on: newest cells should glow');
  assert.ok(on.some((f) => /class="t1"/.test(f.html)) && on.some((f) => /class="t2"/.test(f.html)), 'tip on: glow should fade in steps');
  assert.ok(off.every((f) => !/<span/.test(f.html)), 'tip="false": no glow');
  assert.deepEqual(final, [escape(art), escape(art)], 'after the fade both show exactly the art, no spans left');
  // Glow spans wrap single cells only: stripping them gives the same text as textContent.
  for (const f of on) assert.equal(f.html.replace(/<span class="t[012]">(.*?)<\/span>/g, '$1'), escape(f.text));
});

test('reduced motion: no glow either', async () => {
  const { page, context } = await openPage(browser, js, { reducedMotion: 'reduce' });
  await mount(page, { strings: '["S&@"]' });
  await page.waitForTimeout(300);
  const html = await page.evaluate(() => document.querySelector('ascii-scribe').shadowRoot.querySelector('pre').innerHTML);
  assert.doesNotMatch(html, /<span/);
  await context.close();
});

test('several sentences cycle: write, erase, next, and loop back to the first', async () => {
  const { page, context } = await openPage(browser, js);
  await mount(page, { strings: '["ab", "cd"]', speed: '1000000', lift: '0', pause: '0' });
  await waitEvents(page, 5);
  const ev = (await events(page)).slice(0, 5).map((e) => `${e.what}:${e.text}`);
  assert.deepEqual(ev, ['written:ab', 'erased:ab', 'written:cd', 'erased:cd', 'written:ab']);
  await context.close();
});

test('loop="false" stops with the last sentence on screen', async () => {
  const { page, context } = await openPage(browser, js);
  await mount(page, { strings: '["ab", "cd"]', speed: '1000000', lift: '0', pause: '0', loop: 'false' });
  await waitEvents(page, 3);
  await page.waitForTimeout(400);
  const ev = (await events(page)).map((e) => `${e.what}:${e.text}`);
  assert.deepEqual(ev, ['written:ab', 'erased:ab', 'written:cd']);
  const text = await page.evaluate(() => document.querySelector('ascii-scribe').shadowRoot.querySelector('pre').textContent);
  assert.equal(text, expected('cd', 'Standard'));
  await context.close();
});

test('prefers-reduced-motion: the full text at once, no animation', async () => {
  const { page, context } = await openPage(browser, js, { reducedMotion: 'reduce' });
  await mount(page, { strings: '["pwn", "rev"]', font: 'Slant' });
  const read = () => page.evaluate(() => document.querySelector('ascii-scribe').shadowRoot.querySelector('pre').textContent);
  assert.equal(await read(), expected('pwn', 'Slant'));
  await page.waitForTimeout(500);
  assert.equal(await read(), expected('pwn', 'Slant'));
  // At most the one frame that put the complete text on screen; nothing animated.
  const frames = await page.evaluate(() => window.__frames);
  assert.ok(frames.length <= 1 && frames.every((f) => f === expected('pwn', 'Slant')), `${frames.length} frames`);
  await context.close();
});

test('accessibility: aria-label is the original text, the art is aria-hidden', async () => {
  const { page, context } = await openPage(browser, js);
  await mount(page, { strings: '["pwn", "LLVM pass"]' });
  const a = await page.evaluate(() => {
    const el = document.querySelector('ascii-scribe');
    return { label: el.getAttribute('aria-label'), role: el.getAttribute('role'), hidden: el.shadowRoot.querySelector('pre').getAttribute('aria-hidden') };
  });
  assert.deepEqual(a, { label: 'pwn / LLVM pass', role: 'img', hidden: 'true' });
  const snap = await page.locator('ascii-scribe').ariaSnapshot();
  assert.match(snap, /img "pwn \/ LLVM pass"/);
  assert.doesNotMatch(snap, /[|_\\]{2}/, 'ASCII art leaked into the accessibility tree');
  await context.close();
});

test('360px wide: long sentences shrink to fit, no horizontal scroll, nothing clipped', async () => {
  for (const font of FONTS) {
    const { page, context } = await openPage(browser, js, { viewport: { width: 360, height: 640 } });
    await mount(page, { font, strings: '["reverse engineering", "LLVM", "pwn"]', speed: '1000000', lift: '0', pause: '0', loop: 'false' });
    await page.waitForFunction(() => window.__events.filter((e) => e.what === 'written').length >= 3, null, { timeout: 30000 });
    for (const e of (await events(page)).filter((x) => x.what === 'written')) {
      const ctx = `${font} ${e.text}`;
      assert.ok(e.docScroll <= 360, `${ctx}: page scrolls to ${e.docScroll}px`);
      assert.ok(e.preScroll <= e.preClient, `${ctx}: art clipped (${e.preScroll} > ${e.preClient})`);
      assert.ok(e.preRight <= e.hostRight + 0.5, `${ctx}: art overflows the element`);
    }
    await context.close();
  }
});

test('page CSS cannot restyle the art (Shadow DOM + reset inherited properties)', async () => {
  const hostile = `<style>
    * { letter-spacing: 7px !important; word-spacing: 9px !important; text-transform: uppercase !important;
        font-family: serif !important; line-height: 3 !important; white-space: normal !important;
        text-align: center !important; font-weight: 900 !important; font-style: italic !important; }
    pre { background: red; padding: 20px; border: 5px solid; margin: 30px; font-size: 50px; }
    body { tab-size: 2; text-indent: 40px; }
  </style>`;
  const measure = async (head) => {
    const { page, context } = await openPage(browser, js, { head });
    await mount(page, { strings: '["Bulma?"]', font: 'Big', speed: '1000000', lift: '0', loop: 'false' });
    await waitEvents(page, 1);
    const r = await page.evaluate(() => {
      const pre = document.querySelector('ascii-scribe').shadowRoot.querySelector('pre');
      const s = getComputedStyle(pre);
      const b = pre.getBoundingClientRect();
      return {
        text: pre.textContent,
        width: b.width,
        height: b.height,
        style: [s.letterSpacing, s.wordSpacing, s.textTransform, s.whiteSpace, s.textAlign, s.fontWeight, s.fontStyle, s.paddingLeft, s.borderLeftWidth, s.marginLeft, s.backgroundColor, s.textIndent],
        serif: s.fontFamily.includes('serif') && !s.fontFamily.includes('monospace'),
      };
    });
    await context.close();
    return r;
  };
  const clean = await measure('');
  const attacked = await measure(hostile);
  assert.equal(attacked.text, expected('Bulma?', 'Big'));
  assert.deepEqual(attacked.style, clean.style);
  assert.equal(attacked.serif, false);
  assert.ok(Math.abs(attacked.width - clean.width) < 0.5, `width ${attacked.width} vs ${clean.width}`);
  assert.ok(Math.abs(attacked.height - clean.height) < 0.5, `height ${attacked.height} vs ${clean.height}`);
});

test('changing attributes restarts with the new sentences and font; unknown font falls back to Standard', async () => {
  const { page, context } = await openPage(browser, js);
  await mount(page, { strings: '["ab"]', speed: '1000000', lift: '0', loop: 'false' });
  await waitEvents(page, 1);
  await page.evaluate(() => {
    window.__events = [];
    const el = document.querySelector('ascii-scribe');
    el.setAttribute('font', 'Shadow');
    el.setAttribute('strings', '["xyz"]');
  });
  await waitEvents(page, 1);
  let e = (await events(page)).at(-1);
  assert.equal(e.art, expected('xyz', 'Shadow'));
  await page.evaluate(() => {
    window.__events = [];
    document.querySelector('ascii-scribe').setAttribute('font', 'NoSuchFont');
  });
  await waitEvents(page, 1);
  e = (await events(page)).at(-1);
  assert.equal(e.art, expected('xyz', 'Standard'));
  await context.close();
});
