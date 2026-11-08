// Stroke-order engine: derives a pen-like reveal order from figlet output.
//
// No per-letter data. Each line-drawing character is modelled as a line segment inside its cell (cell (r, c)
// spans x = c..c+1, y = r..r+1, y pointing down): "|" runs top-middle to bottom-middle, "_" lies on the bottom
// edge, "/" goes bottom-left to top-right, and so on. Other characters (letters, "#", "@", ...) are blobs that
// fill their cell. A simulated pen enters a segment at one end and leaves from the other; it may continue only
// into a neighbouring cell whose ink starts near the pen. When nothing is near, the pen lifts: a new stroke.
// Strokes start at free ends and move left to right, like handwriting.

import { letterAt } from './letters.js';

/** Segment endpoints [[x1, y1], [x2, y2]] inside a unit cell. */
const SEGMENTS = {
  '|': [[0.5, 0], [0.5, 1]],
  '_': [[0, 1], [1, 1]],
  '-': [[0, 0.5], [1, 0.5]],
  '=': [[0, 0.5], [1, 0.5]],
  '~': [[0, 0.5], [1, 0.5]],
  '/': [[0, 1], [1, 0]],
  '\\': [[0, 0], [1, 1]],
  '(': [[0.75, 0], [0.75, 1]],
  ')': [[0.25, 0], [0.25, 1]],
  '[': [[0.5, 0], [0.5, 1]],
  ']': [[0.5, 0], [0.5, 1]],
  '<': [[1, 0], [1, 1]],
  '>': [[0, 0], [0, 1]],
  '`': [[0.3, 0], [0.7, 0.5]],
  "'": [[0.5, 0], [0.5, 0.5]],
  ',': [[0.6, 0.6], [0.3, 1]],
  '.': [[0.5, 0.9], [0.5, 0.9]],
};

/** How far (in cell widths) the next ink may start from the pen and still be the same stroke. */
const REACH = 0.5 + 1e-9;

const key = (r, c) => `${r},${c}`;
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Distance from point p to the cell box of (r, c); 0 if inside or on the border. */
function distToCell(p, r, c) {
  const dx = Math.max(c - p[0], 0, p[0] - (c + 1));
  const dy = Math.max(r - p[1], 0, p[1] - (r + 1));
  return Math.hypot(dx, dy);
}

/**
 * @param {string} art figlet output
 * @param {{ letterStarts?: number[] }} [options] start column of each letter (see letters.js). With it, the pen
 *   never crosses from one letter into another and letters are written in order; without it the whole art is
 *   treated as one letter.
 * @returns {Array<Array<[number, number]>>} strokes; each stroke is an ordered list of [row, col] ink cells
 */
export function deriveStrokes(art, { letterStarts: starts = [0] } = {}) {
  const rows = art.split('\n');
  const cells = [];
  rows.forEach((line, r) => {
    for (let c = 0; c < line.length; c++) if (line[c] !== ' ') cells.push([r, c]);
  });
  const letterOfCol = (c) => letterAt(starts, c);
  const isInk = (r, c) => r >= 0 && r < rows.length && c >= 0 && c < rows[r].length && rows[r][c] !== ' ';

  /** Global endpoints of the segment at (r, c), or null for a blob. */
  const ends = (r, c) => {
    const seg = SEGMENTS[rows[r][c]];
    return seg ? seg.map(([x, y]) => [c + x, r + y]) : null;
  };

  const visited = new Set();

  /**
   * Ways the pen can continue from cell (r, c) when it sits at `pen` (a point, or null when the current cell is
   * a blob). Each option: target cell, distance, and where the pen will be afterwards.
   */
  function options(r, c, pen) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if ((!dr && !dc) || !isInk(nr, nc) || visited.has(key(nr, nc))) continue;
        if (letterOfCol(nc) !== letterOfCol(c)) continue;
        const e = ends(nr, nc);
        let d;
        let nextPen;
        if (e) {
          const da = pen ? dist(pen, e[0]) : distToCell(e[0], r, c);
          const db = pen ? dist(pen, e[1]) : distToCell(e[1], r, c);
          d = Math.min(da, db);
          nextPen = da <= db ? e[1] : e[0]; // enter at the near end, leave from the far end
        } else {
          d = pen ? distToCell(pen, nr, nc) : 0;
          nextPen = null;
        }
        if (d <= REACH) out.push({ r: nr, c: nc, d, pen: nextPen, dir: [dr, dc] });
      }
    }
    return out;
  }

  /** Can anything unvisited be reached from this end of the segment? (Used to start strokes at free ends.) */
  const reachableFrom = (r, c, point) => options(r, c, point).length;

  // Letters in order; inside a letter, left to right, top to bottom.
  const byColumn = cells
    .slice()
    .sort((a, b) => letterOfCol(a[1]) - letterOfCol(b[1]) || a[1] - b[1] || a[0] - b[0]);
  const strokes = [];

  while (visited.size < cells.length) {
    // Leftmost unvisited cell of the current letter; among unvisited cells of that letter in its column and the
    // next, prefer one with a free end.
    const first = byColumn.find(([r, c]) => !visited.has(key(r, c)));
    const letter = letterOfCol(first[1]);
    const candidates = byColumn.filter(
      ([r, c]) => !visited.has(key(r, c)) && letterOfCol(c) === letter && c <= first[1] + 1,
    );
    let start = first;
    let pen = null;
    let bestScore = Infinity;
    for (const [r, c] of candidates) {
      const e = ends(r, c);
      if (!e) continue;
      // Free end = an endpoint from which nothing continues; start there and leave from the other end.
      const freeA = reachableFrom(r, c, e[0]) === 0;
      const freeB = reachableFrom(r, c, e[1]) === 0;
      const score = (freeA || freeB ? 0 : 1) * 1000 + c * 10 + r;
      if (score < bestScore) {
        bestScore = score;
        start = [r, c];
        // Start at the free end (or the upper / left end), so the pen sits at the other one.
        const startAtA = freeA || (!freeB && (e[0][1] < e[1][1] || (e[0][1] === e[1][1] && e[0][0] <= e[1][0])));
        pen = startAtA ? e[1] : e[0];
      }
    }
    if (!ends(start[0], start[1])) pen = null;

    const stroke = [start];
    visited.add(key(start[0], start[1]));
    let [r, c] = start;
    let last = null;
    for (;;) {
      const opts = options(r, c, pen);
      if (opts.length === 0) break;
      opts.sort((x, y) => {
        if (Math.abs(x.d - y.d) > 1e-9) return x.d - y.d;
        const sx = last && x.dir[0] === last[0] && x.dir[1] === last[1] ? 1 : 0;
        const sy = last && y.dir[0] === last[0] && y.dir[1] === last[1] ? 1 : 0;
        return sy - sx;
      });
      const next = opts[0];
      visited.add(key(next.r, next.c));
      stroke.push([next.r, next.c]);
      pen = next.pen;
      last = next.dir;
      r = next.r;
      c = next.c;
    }
    strokes.push(stroke);
  }
  return strokes;
}
