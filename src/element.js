// <ascii-scribe>: writes figlet ASCII art stroke by stroke, pauses, erases it in reverse, moves to the next string.
//
// Attributes
//   strings  JSON array of sentences (or one plain sentence)
//   font     one of FONTS (default Standard)
//   speed    base pace in cells per second (default 32; erasing runs 3× faster)
//   pause    ms the finished sentence stays on screen (default 1500)
//   lift     ms the pen pauses when it lifts between strokes (default 320)
//   ease     slow at the start and end of each stroke, fast in the middle (default); ease="false" = even pace
//   tip      freshly written cells glow and fade, like wet ink (default); tip="false" = no glow
//   loop     cycle forever (default); loop="false" stops after the last sentence is written
// CSS: --ascii-scribe-tip sets the glow colour (default #fff); ::part(art) styles the art.
// Events (bubble, composed): ascii-scribe:written / ascii-scribe:erased, detail { index, text }

import figlet from 'figlet';
import { registerFonts, FONTS, DEFAULT_FONT } from './fonts.js';
import { plan, timeline, countUpTo, Grid, parseStrings } from './scribe.js';

registerFonts(figlet);

const DEFAULTS = { speed: 32, pause: 1500, lift: 320 };
const ERASE_SPEEDUP = 3;
const GLOW_MS = [90, 220, 420]; // age thresholds of the three glow levels (newest first)
const GAP_MS = 350; // blank time between erasing one sentence and writing the next
const LINE_HEIGHT = 1.15;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", "Courier New", monospace';

// Inherited properties are reset explicitly: page CSS cannot select into the shadow root, but inheritance crosses it.
const STYLE = `
:host { display: block; position: relative; max-width: 100%; overflow: hidden; }
:host([hidden]) { display: none; }
pre, .probe {
  font-family: ${MONO}; font-style: normal; font-weight: 400; font-variant: normal; font-kerning: none;
  font-feature-settings: normal; letter-spacing: 0; word-spacing: 0; text-transform: none; text-indent: 0;
  text-shadow: none; text-align: left; white-space: pre; tab-size: 8; line-height: ${LINE_HEIGHT};
}
pre {
  display: block; margin: 0; padding: 0; border: 0; border-radius: 0; background: none; box-shadow: none;
  color: inherit; overflow: hidden; width: max-content; max-width: 100%;
}
.t0 { color: var(--ascii-scribe-tip, #fff); text-shadow: 0 0 .35em var(--ascii-scribe-tip, #fff), 0 0 .7em var(--ascii-scribe-tip, #fff); }
.t1 { color: color-mix(in srgb, var(--ascii-scribe-tip, #fff) 60%, currentColor); text-shadow: 0 0 .25em var(--ascii-scribe-tip, #fff); }
.t2 { color: color-mix(in srgb, var(--ascii-scribe-tip, #fff) 25%, currentColor); }
.probe { position: absolute; left: 0; top: 0; visibility: hidden; font-size: 100px; pointer-events: none; }
`;

const renderer = (font) => (text) => figlet.textSync(text, { font });

// Importable outside a browser (e.g. Node tests): the class then exists but is never defined as an element.
const Base = typeof HTMLElement === 'undefined' ? class {} : HTMLElement;

export class AsciiScribe extends Base {
  static get observedAttributes() {
    return ['strings', 'font', 'speed', 'pause', 'lift', 'ease', 'tip', 'loop'];
  }

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>${STYLE}</style><pre part="art" aria-hidden="true"></pre><span class="probe" aria-hidden="true">${'M'.repeat(20)}</span>`;
    this._pre = root.querySelector('pre');
    this._probe = root.querySelector('.probe');
    this._raf = 0;
    this._plans = [];
    this._motion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
    this._onMotion = () => this._restart();
    this._resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this._fit()) : null;
  }

  get font() {
    const f = this.getAttribute('font');
    return FONTS.includes(f) ? f : DEFAULT_FONT;
  }
  get strings() {
    return parseStrings(this.getAttribute('strings'));
  }
  get speed() {
    return positive(this.getAttribute('speed'), DEFAULTS.speed);
  }
  get pause() {
    return nonNegative(this.getAttribute('pause'), DEFAULTS.pause);
  }
  get lift() {
    return nonNegative(this.getAttribute('lift'), DEFAULTS.lift);
  }
  get ease() {
    return this.getAttribute('ease') !== 'false';
  }
  get tip() {
    return this.getAttribute('tip') !== 'false';
  }
  get loop() {
    return this.getAttribute('loop') !== 'false';
  }

  connectedCallback() {
    this._motion?.addEventListener?.('change', this._onMotion);
    this._resize?.observe(this);
    this._restart();
  }

  disconnectedCallback() {
    this._motion?.removeEventListener?.('change', this._onMotion);
    this._resize?.disconnect();
    cancelAnimationFrame(this._raf);
  }

  attributeChangedCallback() {
    if (this.isConnected) this._restart();
  }

  _restart() {
    cancelAnimationFrame(this._raf);
    const strings = this.strings;
    const render = renderer(this.font);
    this._plans = strings.map((s) => plan(render, s));
    if (!this.hasAttribute('role')) this.setAttribute('role', 'img');
    this.setAttribute('aria-label', strings.join(' / '));
    this._fit();
    if (this._plans.length === 0) {
      this._pre.textContent = '';
      return;
    }
    if (this._motion?.matches) {
      // Reduced motion: the first sentence, complete, no animation.
      this._pre.textContent = this._plans[0].art;
      return;
    }
    this._index = 0;
    this._begin('write', performance.now());
    this._raf = requestAnimationFrame((t) => this._tick(t));
  }

  _begin(phase, now) {
    this._phase = phase;
    this._t0 = now;
    if (phase === 'write') {
      const p = this._plans[this._index];
      this._grid = new Grid(p.rows);
      this._times = timeline(p.steps, { speed: this.speed, lift: this.lift, ease: this.ease });
      this._shownAt = new Array(p.steps.length).fill(-Infinity); // when each step actually appeared (ms)
      this._shown = 0;
      this._glowing = false;
      this._draw(now);
    }
  }

  _tick(now) {
    const p = this._plans[this._index];
    const dt = Math.max(0, now - this._t0);
    const steps = p.steps;
    if (this._phase === 'write') {
      const n = countUpTo(this._times, dt);
      if (n > this._shown) {
        for (let i = this._shown; i < n; i++) {
          this._grid.show(steps[i]);
          this._shownAt[i] = now;
        }
        this._shown = n;
        this._draw(now);
      } else if (this._glowing) this._draw(now);
      if (this._shown === steps.length) {
        this._emit('written');
        // Last sentence without loop: keep drawing until the glow has faded, then stop.
        this._begin(!this.loop && this._index === this._plans.length - 1 ? 'done' : 'pause', now);
      }
    } else if (this._phase === 'pause' || this._phase === 'done') {
      if (this._glowing) this._draw(now); // let the last cells fade
      if (this._phase === 'done' && !this._glowing) return;
      if (this._phase === 'pause' && dt >= this.pause) this._begin('erase', now);
    } else if (this._phase === 'erase') {
      // Exact reverse of the writing order (no glow while erasing).
      const keep = Math.max(0, steps.length - Math.floor((dt * this.speed * ERASE_SPEEDUP) / 1000));
      if (keep < this._shown) {
        for (let i = this._shown - 1; i >= keep; i--) this._grid.hide(steps[i]);
        this._shown = keep;
        this._draw(now, false);
      }
      if (this._shown === 0) {
        this._emit('erased');
        this._begin('gap', now);
      }
    } else if (dt >= GAP_MS) {
      this._index = (this._index + 1) % this._plans.length;
      this._begin('write', now);
    }
    this._raf = requestAnimationFrame((t) => this._tick(t));
  }

  /** Render the grid; with the pen tip on, wrap recently written cells in glow spans (text content unchanged). */
  _draw(now, glow = this.tip) {
    const recent = [];
    if (glow) {
      for (let i = this._shown - 1; i >= 0; i--) {
        const age = now - this._shownAt[i];
        if (age >= GLOW_MS[2]) break; // steps appear in order, so older ones have faded too
        recent.push([i, age < GLOW_MS[0] ? 't0' : age < GLOW_MS[1] ? 't1' : 't2']);
      }
    }
    this._glowing = recent.length > 0;
    if (!this._glowing) {
      this._pre.textContent = this._grid.toString();
      return;
    }
    const cells = this._grid.cells.map((row) => row.map(escapeHtml));
    for (const [i, cls] of recent) {
      const s = this._plans[this._index].steps[i];
      cells[s.r][s.c] = `<span class="${cls}">${cells[s.r][s.c]}</span>`;
    }
    this._pre.innerHTML = cells.map((row) => row.join('')).join('\n');
  }

  _emit(what) {
    const p = this._plans[this._index];
    this.dispatchEvent(
      new CustomEvent(`ascii-scribe:${what}`, { bubbles: true, composed: true, detail: { index: this._index, text: p.text } }),
    );
  }

  /** Shrink the font so the widest sentence fits the element; reserve the tallest sentence's height. */
  _fit() {
    const cols = Math.max(0, ...this._plans.flatMap((p) => p.rows.map((l) => l.length)));
    const lines = Math.max(0, ...this._plans.map((p) => p.rows.length));
    const base = parseFloat(getComputedStyle(this).fontSize) || 16;
    const charW = this._probe.getBoundingClientRect().width / 20 / 100; // width of one cell per px of font size
    const avail = this.clientWidth;
    let size = base;
    // 1px spare: glow spans split the text into runs whose widths round slightly differently.
    if (cols > 0 && charW > 0 && avail > 1) size = Math.min(base, (avail - 1) / (cols * charW));
    size = Math.floor(size * 100) / 100;
    this._pre.style.fontSize = `${size}px`;
    this._pre.style.height = `${lines * LINE_HEIGHT * size}px`;
  }
}

function escapeHtml(ch) {
  return ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '&' ? '&amp;' : ch;
}
function positive(v, fallback) {
  const n = Number(v);
  return v !== null && Number.isFinite(n) && n > 0 ? n : fallback;
}
function nonNegative(v, fallback) {
  const n = Number(v);
  return v !== null && v !== '' && Number.isFinite(n) && n >= 0 ? n : fallback;
}
