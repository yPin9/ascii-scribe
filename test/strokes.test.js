// Property tests for the stroke-order engine on random strings × every bundled font.
// Thresholds decided by the user after seeing the data (decisions.md, 2026-11-08, ug8.2):
//   direction: engine ≥ best character-blind baseline that also passes continuity + 0.05, and above every baseline
//   scanSimilarity (pooled, pair-weighted) ≤ 0.70
// Reproduce a failure with SCRIBE_SEED=<seed>.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import figlet from 'figlet';
import { FONTS, registerFonts } from '../src/fonts.js';
import { deriveStrokes } from '../src/strokes.js';
import { letterStarts } from '../src/letters.js';
import { finalFrame, strokeMetrics, pooledContinuity, ADJACENCY_MIN, CONTINUITY_MIN } from './helpers/metrics.js';
import { directionCounts, pooledDirection } from './helpers/direction.js';
import { runBaselines } from './helpers/baselines.js';
import { mulberry32, randomStrings, resolveSeed } from './helpers/random.js';

const DIRECTION_MARGIN = 0.05;
const SCAN_SIMILARITY_MAX = 0.7;
const COUNT = 200;

registerFonts(figlet);
const seed = resolveSeed();
const tag = `(SCRIBE_SEED=${seed})`;

const derive = (text, font, art) =>
  deriveStrokes(art, { letterStarts: letterStarts((t) => figlet.textSync(t, { font }), text) });

const pooledScan = (ms) => {
  const den = ms.reduce((s, m) => s + m.pairs, 0);
  return den === 0 ? 0 : ms.reduce((s, m) => s + m.scanSimilarity * m.pairs, 0) / den;
};

// Run the corpus once; every test below reads from it.
const rand = mulberry32(seed);
const strings = randomStrings(seed, COUNT);
const engine = { metrics: [], dirs: [], failures: [] };
const baselines = {};
for (const font of FONTS) {
  for (const text of strings) {
    const art = figlet.textSync(text, { font });
    const strokes = derive(text, font, art);
    const m = strokeMetrics(art, strokes);
    const frame = finalFrame(art, strokes);
    engine.metrics.push(m);
    engine.dirs.push(directionCounts(art, strokes));
    if (!frame.matches || m.adjacency < ADJACENCY_MIN) {
      engine.failures.push({ text, font, matches: frame.matches, adjacency: m.adjacency });
    }
    for (const [name, bs] of Object.entries(runBaselines(art, rand))) {
      const b = (baselines[name] ??= { metrics: [], dirs: [] });
      b.metrics.push(strokeMetrics(art, bs));
      b.dirs.push(directionCounts(art, bs));
    }
  }
}
const engineDirection = pooledDirection(engine.dirs);
const engineContinuity = pooledContinuity(engine.metrics);
const engineScan = pooledScan(engine.metrics);
const baselineRows = Object.entries(baselines).map(([name, b]) => ({
  name,
  direction: pooledDirection(b.dirs),
  continuity: pooledContinuity(b.metrics),
  scan: pooledScan(b.metrics),
}));
const bestContinuous = baselineRows
  .filter((b) => b.continuity >= CONTINUITY_MIN)
  .reduce((a, b) => (b.direction > a.direction ? b : a), { name: 'none', direction: 0 });
const bestOverall = baselineRows.reduce((a, b) => (b.direction > a.direction ? b : a));
const fmt = (x) => x.toFixed(3);

test(`final frame is exact and every stroke is adjacent ${tag}`, () => {
  const n = engine.metrics.length;
  assert.equal(n, COUNT * FONTS.length);
  assert.deepEqual(engine.failures.slice(0, 5), [], `${engine.failures.length}/${n} renders failed ${tag}`);
});

test(`pooled continuity ≥ ${CONTINUITY_MIN} ${tag}`, () => {
  assert.ok(engineContinuity >= CONTINUITY_MIN, `continuity ${fmt(engineContinuity)} ${tag}`);
});

test(`direction beats character-blind baselines ${tag}`, () => {
  const msg =
    `engine ${fmt(engineDirection)}; best continuous baseline ${bestContinuous.name} ${fmt(bestContinuous.direction)}; ` +
    `best overall ${bestOverall.name} ${fmt(bestOverall.direction)} ${tag}`;
  assert.ok(engineDirection >= bestContinuous.direction + DIRECTION_MARGIN, msg);
  assert.ok(engineDirection > bestOverall.direction, msg);
});

test(`pooled scan similarity ≤ ${SCAN_SIMILARITY_MAX} ${tag}`, () => {
  assert.ok(engineScan <= SCAN_SIMILARITY_MAX, `scanSimilarity ${fmt(engineScan)} ${tag}`);
});

// Counterexamples: pretend each baseline IS the engine and run it through the same gates, compared against the
// other baselines. None may pass.
test(`no character-blind baseline would pass the engine gates (band, diagonal, merged, greedy, scans) ${tag}`, () => {
  for (const family of ['band', 'diagonal', 'merged', 'greedy', 'chopped']) {
    assert.ok(baselineRows.some((b) => b.name.includes(family)), `baseline family ${family} missing`);
  }
  const passing = baselineRows.filter((cheat) => {
    const others = baselineRows.filter((b) => b !== cheat);
    const bestC = Math.max(0, ...others.filter((b) => b.continuity >= CONTINUITY_MIN).map((b) => b.direction));
    const bestO = Math.max(...others.map((b) => b.direction));
    return (
      cheat.continuity >= CONTINUITY_MIN &&
      cheat.scan <= SCAN_SIMILARITY_MAX &&
      cheat.direction >= bestC + DIRECTION_MARGIN &&
      cheat.direction > bestO
    );
  });
  assert.deepEqual(passing.map((b) => b.name), [], tag);
});

test('engine has no character-keyed stroke-order data', async () => {
  const src = await readFile(new URL('../src/strokes.js', import.meta.url), 'utf8');
  // Glyph geometry keys are line-drawing punctuation only; letters/digits must never be keys.
  assert.doesNotMatch(src, /['"][A-Za-z0-9]['"]\s*:/);
  // No font-specific branches (font names appearing as string literals).
  assert.ok(!/['"`](Standard|Big|Slant|Small|Small Slant|Shadow|Script)['"`]/.test(src), 'font name in engine');
});
