// "Character-blind" baselines: ways to produce a plausible-looking stroke order using only WHERE the ink is,
// never WHAT the glyph is. Every strategy receives a mask (every ink cell replaced by '#'), so it cannot read
// glyphs even by accident. A real engine must beat the best of these on glyph direction consistency.
//
// When a new character-blind shortcut is discovered, add it to STRATEGIES (decision 2026-11-08).

import { inkCells, scanOrderings, choppedScan } from './metrics.js';

export const toMask = (art) => art.replace(/[^ \n]/g, '#');

const key = ([r, c]) => `${r},${c}`;
const adjacent = ([r1, c1], [r2, c2]) => Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2)) === 1;

function shuffle(arr, rand) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const randomlyReverse = (strokes, rand) => strokes.map((s) => (rand() < 0.5 ? s.slice().reverse() : s));

/** Cut an ordered list of cells into strokes at every non-adjacent step. */
function chop(order) {
  const strokes = [];
  for (const cell of order) {
    const cur = strokes[strokes.length - 1];
    if (cur && adjacent(cur[cur.length - 1], cell)) cur.push(cell);
    else strokes.push([cell]);
  }
  return strokes;
}

/** 8-connected components of the mask, each as a list of cells. */
function components(mask) {
  const cells = inkCells(mask);
  const ink = new Set(cells.map(key));
  const seen = new Set();
  const out = [];
  for (const start of cells) {
    if (seen.has(key(start))) continue;
    const comp = [];
    const stack = [start];
    seen.add(key(start));
    while (stack.length) {
      const cell = stack.pop();
      comp.push(cell);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const n = [cell[0] + dr, cell[1] + dc];
          if ((dr || dc) && ink.has(key(n)) && !seen.has(key(n))) {
            seen.add(key(n));
            stack.push(n);
          }
        }
      }
    }
    out.push(comp);
  }
  return out;
}

const withinStrokeAdjacentPairs = (strokes) =>
  strokes.reduce((s, st) => s + st.slice(1).filter((c, i) => adjacent(st[i], c)).length, 0);

/** For each component, apply every ordering, keep the one with most adjacent pairs after chopping. */
function bestPerComponent(mask, orderings) {
  const strokes = [];
  for (const comp of components(mask)) {
    let best = null;
    let bestScore = -1;
    for (const compare of orderings) {
      const s = chop(comp.slice().sort(compare));
      const score = withinStrokeAdjacentPairs(s);
      if (score > bestScore) {
        bestScore = score;
        best = s;
      }
    }
    strokes.push(...best);
  }
  return strokes;
}

/** Diagonal sweeps: lines r+c (or r-c) = k, visited forward/backward, read straight or zigzag. 8 orderings. */
function diagonalOrderings() {
  const out = [];
  for (const anti of [false, true]) {
    for (const lineDir of [1, -1]) {
      for (const zigzag of [false, true]) {
        out.push((a, b) => {
          const la = anti ? a[0] - a[1] : a[0] + a[1];
          const lb = anti ? b[0] - b[1] : b[0] + b[1];
          if (la !== lb) return (la - lb) * lineDir;
          const dir = zigzag && Math.abs(la) % 2 === 1 ? -1 : 1;
          return (a[0] - b[0]) * dir;
        });
      }
    }
  }
  return out;
}

/** Band scan: columns (or rows) grouped into bands of width w; snake by rows inside each band. */
function bandOrdering(w, vertical) {
  return (a, b) => {
    const [pa, qa] = vertical ? [a[1], a[0]] : a; // pa = coordinate cut into bands, qa = sweep coordinate
    const [pb, qb] = vertical ? [b[1], b[0]] : b;
    const ba = Math.floor(pa / w);
    const bb = Math.floor(pb / w);
    if (ba !== bb) return ba - bb;
    if (qa !== qb) return qa - qb;
    const dir = qa % 2 === 0 ? 1 : -1;
    return (pa - pb) * dir;
  };
}

/** Repeatedly join strokes whose endpoints are adjacent (reversing as needed). */
function mergeEndpoints(strokes) {
  const list = strokes.map((s) => s.slice());
  let merged = true;
  while (merged) {
    merged = false;
    outer: for (let i = 0; i < list.length; i++) {
      for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        const a = list[i];
        const b = list[j];
        let joined = null;
        if (adjacent(a[a.length - 1], b[0])) joined = a.concat(b);
        else if (adjacent(a[a.length - 1], b[b.length - 1])) joined = a.concat(b.slice().reverse());
        else if (adjacent(a[0], b[0])) joined = a.slice().reverse().concat(b);
        if (joined) {
          list[i] = joined;
          list.splice(j, 1);
          merged = true;
          break outer;
        }
      }
    }
  }
  return list;
}

const NEIGHBOUR_ORDERS = [
  [[1, 0], [0, 1], [1, 1], [1, -1], [0, -1], [-1, 0], [-1, 1], [-1, -1]],
  [[0, 1], [1, 0], [1, 1], [-1, 1], [1, -1], [0, -1], [-1, 0], [-1, -1]],
  [[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [0, 1], [0, -1], [-1, 0]],
];

/** Greedy walk along unvisited neighbours (fixed preference, or "keep going straight" first). */
function greedyWalk(mask, prefs, keepStraight) {
  const cells = inkCells(mask);
  const ink = new Set(cells.map(key));
  const seen = new Set();
  const strokes = [];
  for (const start of cells) {
    if (seen.has(key(start))) continue;
    const stroke = [start];
    seen.add(key(start));
    let cur = start;
    let last = null;
    for (;;) {
      const order = keepStraight && last ? [last, ...prefs.filter((d) => d[0] !== last[0] || d[1] !== last[1])] : prefs;
      const step = order.find(([dr, dc]) => {
        const k = `${cur[0] + dr},${cur[1] + dc}`;
        return ink.has(k) && !seen.has(k);
      });
      if (!step) break;
      cur = [cur[0] + step[0], cur[1] + step[1]];
      seen.add(key(cur));
      stroke.push(cur);
      last = step;
    }
    strokes.push(stroke);
  }
  return strokes;
}

/** name -> (mask, rand) => strokes. All take the mask only. */
export const STRATEGIES = {};
for (const o of scanOrderings()) {
  STRATEGIES[`chopped ${o.name}`] = (mask) => choppedScan(mask, o);
  STRATEGIES[`chopped ${o.name} reversed`] = (mask, rand) => randomlyReverse(choppedScan(mask, o), rand);
  STRATEGIES[`chopped ${o.name} shuffled`] = (mask, rand) => randomlyReverse(shuffle(choppedScan(mask, o), rand), rand);
  STRATEGIES[`merged ${o.name}`] = (mask) => mergeEndpoints(choppedScan(mask, o));
}
STRATEGIES['best scan per component'] = (mask) => bestPerComponent(mask, scanOrderings().map((o) => o.compare));
STRATEGIES['diagonal per component'] = (mask, rand) => randomlyReverse(bestPerComponent(mask, diagonalOrderings()), rand);
STRATEGIES['merged diagonal per component'] = (mask) => mergeEndpoints(bestPerComponent(mask, diagonalOrderings()));
for (const w of [2, 3]) {
  for (const vertical of [true, false]) {
    const name = `band ${w} ${vertical ? 'columns' : 'rows'}`;
    STRATEGIES[name] = (mask, rand) => randomlyReverse(chop(inkCells(mask).sort(bandOrdering(w, vertical))), rand);
    STRATEGIES[`merged ${name}`] = (mask) => mergeEndpoints(chop(inkCells(mask).sort(bandOrdering(w, vertical))));
  }
}
NEIGHBOUR_ORDERS.forEach((prefs, i) => {
  STRATEGIES[`greedy walk ${i}`] = (mask) => greedyWalk(mask, prefs, false);
  STRATEGIES[`greedy walk ${i} straight`] = (mask) => greedyWalk(mask, prefs, true);
  STRATEGIES[`merged greedy walk ${i} straight`] = (mask) => mergeEndpoints(greedyWalk(mask, prefs, true));
});

/** Run every strategy on the mask of `art`. */
export function runBaselines(art, rand) {
  const mask = toMask(art);
  const out = {};
  for (const [name, fn] of Object.entries(STRATEGIES)) out[name] = fn(mask, rand);
  return out;
}

