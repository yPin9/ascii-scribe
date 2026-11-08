import { test } from 'node:test';
import assert from 'node:assert/strict';
import figlet from 'figlet';
import { FONTS, registerFonts } from '../src/fonts.js';
import { plan, visibleAt, Grid, parseStrings, LIFT_STEPS, timeline, easeFactor, countUpTo } from '../src/scribe.js';
import { deriveStrokes } from '../src/strokes.js';
import { letterStarts } from '../src/letters.js';
import { inkCells } from './helpers/metrics.js';
import { randomStrings, resolveSeed } from './helpers/random.js';

registerFonts(figlet);
const seed = resolveSeed();

test(`plan visits every ink cell once; writing all steps gives the art, erasing in reverse gives blank (SCRIBE_SEED=${seed})`, () => {
  for (const font of FONTS) {
    const render = (t) => figlet.textSync(t, { font });
    for (const text of randomStrings(seed, 20)) {
      const ctx = `seed=${seed} font=${font} text=${JSON.stringify(text)}`;
      const p = plan(render, text);
      assert.equal(p.art, render(text), ctx);
      assert.equal(p.steps.length, inkCells(p.art).length, ctx);
      assert.equal(new Set(p.steps.map((s) => `${s.r},${s.c}`)).size, p.steps.length, ctx);
      const g = new Grid(p.rows);
      const blank = g.toString();
      p.steps.forEach((s) => g.show(s));
      assert.equal(g.toString(), p.art, ctx);
      p.steps.slice().reverse().forEach((s) => g.hide(s));
      assert.equal(g.toString(), blank, ctx);
      assert.equal(blank.replace(/[ \n]/g, ''), '', ctx);
      for (let i = 1; i < p.steps.length; i++) {
        const d = p.steps[i].at - p.steps[i - 1].at;
        assert.ok(d === 1 || d === 1 + LIFT_STEPS, ctx);
      }
    }
  }
});

test('visibleAt counts steps whose time has come', () => {
  const steps = [{ at: 0 }, { at: 1 }, { at: 5 }];
  assert.equal(visibleAt(steps, 0), 1);
  assert.equal(visibleAt(steps, 0.99), 1);
  assert.equal(visibleAt(steps, 1), 2);
  assert.equal(visibleAt(steps, 4.9), 2);
  assert.equal(visibleAt(steps, 99), 3);
  assert.equal(visibleAt([], 99), 0);
});

test('parseStrings: JSON array, JSON string, plain text, empty', () => {
  assert.deepEqual(parseStrings('["pwn", "reverse", ""]'), ['pwn', 'reverse']);
  assert.deepEqual(parseStrings('"hello"'), ['hello']);
  assert.deepEqual(parseStrings('hello world'), ['hello world']);
  assert.deepEqual(parseStrings('[1, 2]'), ['1', '2']);
  assert.deepEqual(parseStrings(''), []);
  assert.deepEqual(parseStrings(null), []);
});

// The component must play exactly what the engine derived: same cells, same order, pen lifts at stroke starts.
test(`plan steps follow deriveStrokes exactly, every font (SCRIBE_SEED=${seed})`, () => {
  for (const font of FONTS) {
    const render = (t) => figlet.textSync(t, { font });
    for (const text of randomStrings(seed + 1, 30)) {
      const ctx = `seed=${seed} font=${font} text=${JSON.stringify(text)}`;
      const art = render(text);
      const strokes = deriveStrokes(art, { letterStarts: letterStarts(render, text) });
      const p = plan(render, text);
      assert.deepEqual(p.steps.map((s) => [s.r, s.c]), strokes.flat(), ctx);
      const lifts = [];
      p.steps.forEach((s, i) => i > 0 && s.at - p.steps[i - 1].at > 1 && lifts.push(i));
      const starts = [];
      strokes.reduce((n, st, i) => (i > 0 && starts.push(n), n + st.length), 0);
      assert.deepEqual(lifts, starts, ctx);
    }
  }
});

test(`plan marks strokes exactly as deriveStrokes splits them (SCRIBE_SEED=${seed})`, () => {
  for (const font of FONTS) {
    const render = (t) => figlet.textSync(t, { font });
    for (const text of randomStrings(seed + 2, 15)) {
      const strokes = deriveStrokes(render(text), { letterStarts: letterStarts(render, text) });
      const p = plan(render, text);
      assert.deepEqual(p.steps.map((s) => s.stroke), strokes.flatMap((st, i) => st.map(() => i)), `${font} ${JSON.stringify(text)}`);
    }
  }
});

test('timeline: even pace, pen lifts, and slow-ends/fast-middle easing', () => {
  const steps = [0, 0, 0, 0, 0, 1, 2, 2, 2].map((stroke) => ({ stroke }));
  const even = timeline(steps, { speed: 10 });
  assert.deepEqual(even, [0, 100, 200, 300, 400, 500, 600, 700, 800]);
  const lifted = timeline(steps, { speed: 10, lift: 250 });
  assert.deepEqual(lifted, [0, 100, 200, 300, 400, 750, 1100, 1200, 1300]);
  const eased = timeline(steps, { speed: 10, ease: true });
  const gaps = eased.slice(1).map((t, i) => t - eased[i]);
  // First stroke (5 cells): first and last gaps longer than the middle ones.
  assert.ok(gaps[0] > gaps[1] && gaps[1] > 0 && gaps[3] > gaps[2], `gaps ${gaps}`);
  assert.equal(gaps[0], 100 * easeFactor(0));
  assert.ok(easeFactor(0) > 1.8 && easeFactor(1) > 1.8 && easeFactor(0.5) < 0.6);
  // Monotonic, starts at 0, one entry per step.
  for (const t of [even, lifted, eased]) {
    assert.equal(t.length, steps.length);
    assert.equal(t[0], 0);
    t.slice(1).forEach((x, i) => assert.ok(x >= t[i]));
  }
  assert.deepEqual(timeline([], { speed: 10 }), []);
});

test('countUpTo counts sorted times ≤ t', () => {
  assert.equal(countUpTo([0, 100, 100, 250], -1), 0);
  assert.equal(countUpTo([0, 100, 100, 250], 0), 1);
  assert.equal(countUpTo([0, 100, 100, 250], 100), 3);
  assert.equal(countUpTo([0, 100, 100, 250], 999), 4);
});
