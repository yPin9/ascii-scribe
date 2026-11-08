import { test } from 'node:test';
import assert from 'node:assert/strict';
import figlet from 'figlet';
import { FONTS, registerFonts } from '../src/fonts.js';
import {
  inkCells,
  finalFrame,
  strokeMetrics,
  inkComponents,
  scanOrderings,
  scanOrder,
  choppedScan,
  pooledContinuity,
  CONTINUITY_MIN,
} from './helpers/metrics.js';
import { mulberry32, randomString, randomStrings, resolveSeed, CHARSET } from './helpers/random.js';

const art = figlet.textSync('Hi', { font: 'Standard' });
const perCellScan = () => inkCells(art).map((cell) => [cell]); // every cell its own stroke, scan order

function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

test('finalFrame: revealing every ink cell once reproduces the art', () => {
  const r = finalFrame(art, perCellScan());
  assert.equal(r.frame, art);
  assert.equal(r.matches, true);
});

test('finalFrame: missing, duplicate and blank cells are reported', () => {
  const cells = inkCells(art);
  const missing = finalFrame(art, [cells.slice(1)]);
  assert.equal(missing.matches, false);
  assert.deepEqual(missing.missing, [cells[0]]);

  const dup = finalFrame(art, [[...cells, cells[0]]]);
  assert.equal(dup.matches, false);
  assert.equal(dup.duplicates.length, 1);

  assert.equal(art[0], ' ');
  const blank = finalFrame(art, [[...cells, [0, 0]]]);
  assert.equal(blank.matches, false);
  assert.equal(blank.outOfInk.length, 1);
});

test('strokeMetrics: one-cell strokes fool adjacency but get continuity 0', () => {
  // scanSimilarity is measured on within-stroke pairs; one-cell strokes have none (0 by definition),
  // so this shortcut is caught by continuity instead.
  const m = strokeMetrics(art, perCellScan());
  assert.equal(m.adjacency, 1);
  assert.equal(m.pairs, 0);
  assert.equal(m.continuity, 0);
  assert.equal(m.scanSimilarity, 0);
});

test('strokeMetrics: one stroke in scan order is not fully adjacent (row jumps)', () => {
  const m = strokeMetrics(art, [inkCells(art)]);
  assert.ok(m.adjacency < 1);
  assert.equal(m.scanSimilarity, 1);
});

test('strokeMetrics: shuffled single stroke scores low adjacency and low scan similarity', () => {
  const m = strokeMetrics(art, [shuffle(inkCells(art), mulberry32(1))]);
  assert.ok(m.adjacency < 0.5, `adjacency ${m.adjacency}`);
  assert.ok(m.scanSimilarity < 0.3, `scan ${m.scanSimilarity}`);
});

test('strokeMetrics: a traced vertical line is fully adjacent and continuous', () => {
  const tiny = '|\n|\n|';
  const m = strokeMetrics(tiny, [[[0, 0], [1, 0], [2, 0]]]);
  assert.equal(m.adjacency, 1);
  assert.equal(m.continuity, 1);
  assert.equal(m.scanSimilarity, 1); // a single column is also scan order: scanSimilarity is only a hint
});

test('scanOrderings: 16 distinct orderings, each a permutation of the ink cells', () => {
  const orderings = scanOrderings();
  assert.equal(orderings.length, 16);
  assert.equal(new Set(orderings.map((o) => o.name)).size, 16);
  const cells = inkCells(art).map(String).sort();
  const seen = new Set();
  for (const o of orderings) {
    const order = scanOrder(art, o);
    assert.deepEqual(order.map(String).sort(), cells);
    seen.add(order.map(String).join(';'));
  }
  assert.ok(seen.size >= 8, `only ${seen.size} different sequences`);
});

test('chopped scans in every direction get perfect adjacency and frame, but scanSimilarity 1 exposes them', () => {
  registerFonts(figlet);
  const seed = resolveSeed();
  const strings = randomStrings(seed, 15);
  for (const o of scanOrderings()) {
    for (const font of FONTS) {
      for (const s of strings) {
        const sArt = figlet.textSync(s, { font });
        const strokes = choppedScan(sArt, o);
        const m = strokeMetrics(sArt, strokes);
        const ctx = `seed=${seed} ordering=${o.name} font=${font} text=${JSON.stringify(s)}`;
        assert.equal(finalFrame(sArt, strokes).matches, true, ctx);
        assert.equal(m.adjacency, 1, ctx);
        if (m.cells > 1) assert.equal(m.scanSimilarity, 1, ctx);
      }
    }
  }
});

test('reversing strokes, shuffling stroke order or both does not hide a chopped scan', () => {
  registerFonts(figlet);
  const seed = resolveSeed();
  const rand = mulberry32(seed);
  const strings = randomStrings(seed, 15);
  for (const o of scanOrderings()) {
    for (const font of FONTS) {
      for (const s of strings) {
        const sArt = figlet.textSync(s, { font });
        const chopped = choppedScan(sArt, o);
        const variants = {
          everyOtherReversed: chopped.map((st, i) => (i % 2 ? st.slice().reverse() : st)),
          randomlyReversed: chopped.map((st) => (rand() < 0.5 ? st.slice().reverse() : st)),
          shuffledOrder: shuffle(chopped, rand),
          shuffledAndReversed: shuffle(chopped, rand).map((st) => (rand() < 0.5 ? st.slice().reverse() : st)),
        };
        for (const [name, strokes] of Object.entries(variants)) {
          const m = strokeMetrics(sArt, strokes);
          const ctx = `seed=${seed} ordering=${o.name} variant=${name} font=${font} text=${JSON.stringify(s)}`;
          assert.equal(finalFrame(sArt, strokes).matches, true, ctx);
          if (m.pairs > 0) assert.equal(m.scanSimilarity, 1, ctx);
        }
      }
    }
  }
});

test('row and plain column chopped scans stay below CONTINUITY_MIN pooled; column snakes do not', () => {
  // Documents why continuity alone is not a sufficient gate: column-snake chopping reaches ~0.77.
  registerFonts(figlet);
  const seed = resolveSeed();
  const strings = randomStrings(seed, 20);
  for (const o of scanOrderings()) {
    const results = [];
    for (const font of FONTS) for (const s of strings) {
      const sArt = figlet.textSync(s, { font });
      results.push(strokeMetrics(sArt, choppedScan(sArt, o)));
    }
    const pooled = pooledContinuity(results);
    if (!(o.name.startsWith('col') && o.name.includes('snake'))) {
      assert.ok(pooled < CONTINUITY_MIN, `seed=${seed} ${o.name} pooled continuity ${pooled.toFixed(3)}`);
    }
  }
});

test('pooledContinuity sums pairs instead of averaging ratios', () => {
  const a = { adjacentPairs: 1, maxPairs: 1 };
  const b = { adjacentPairs: 0, maxPairs: 9 };
  assert.equal(pooledContinuity([a, b]), 0.1);
  assert.equal(pooledContinuity([]), 1);
});

test('inkComponents counts separated parts and joins diagonals', () => {
  assert.equal(inkComponents('| |'), 2);
  assert.equal(inkComponents('/\n \\'), 1);
});

test('random strings: seeded, mixed classes, varying length, no edge spaces', () => {
  assert.deepEqual(randomStrings(42, 5), randomStrings(42, 5));
  assert.notDeepEqual(randomStrings(42, 5), randomStrings(43, 5));
  const many = randomStrings(7, 500);
  const joined = many.join('');
  assert.match(joined, /[A-Z]/);
  assert.match(joined, /[a-z]/);
  assert.match(joined, /[0-9]/);
  assert.match(joined, /[^A-Za-z0-9 ]/);
  assert.match(joined, / /);
  assert.ok(new Set(many.map((s) => s.length)).size > 5);
  for (const s of many) {
    assert.equal(s, s.trim());
    for (const ch of s) assert.ok(ch === ' ' || CHARSET.includes(ch));
  }
  assert.equal(randomString(mulberry32(3), { minLen: 4, maxLen: 4 }).length, 4);
});
