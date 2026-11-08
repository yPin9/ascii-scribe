// Metrics for judging a stroke order against the figlet art it reveals.
// A "stroke order" is an array of strokes; each stroke is an array of [row, col] cells, revealed in order.

/** Split figlet output into rows. */
export function toRows(art) {
  return art.split('\n');
}

/** All non-space cells of the art as [row, col], in row-major (scan) order. */
export function inkCells(art) {
  const cells = [];
  toRows(art).forEach((line, r) => {
    for (let c = 0; c < line.length; c++) if (line[c] !== ' ') cells.push([r, c]);
  });
  return cells;
}

const key = ([r, c]) => `${r},${c}`;

/**
 * Rebuild the final frame from the strokes: start from the art with every cell blanked,
 * then put back only the revealed cells. Also reports coverage problems.
 */
export function finalFrame(art, strokes) {
  const rows = toRows(art);
  const grid = rows.map((line) => Array.from(line, () => ' '));
  const seen = new Set();
  const duplicates = [];
  const outOfInk = [];
  for (const stroke of strokes) {
    for (const cell of stroke) {
      const [r, c] = cell;
      const k = key(cell);
      if (seen.has(k)) duplicates.push(cell);
      seen.add(k);
      const ch = rows[r]?.[c];
      if (ch === undefined || ch === ' ') {
        outOfInk.push(cell);
        continue;
      }
      grid[r][c] = ch;
    }
  }
  const missing = inkCells(art).filter((cell) => !seen.has(key(cell)));
  const frame = grid.map((g) => g.join('')).join('\n');
  return {
    frame,
    matches: frame === art && duplicates.length === 0 && outOfInk.length === 0,
    missing,
    duplicates,
    outOfInk,
  };
}

const adjacent = ([r1, c1], [r2, c2]) => Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2)) === 1;

/** Number of 8-connected components among the ink cells (a lower bound on the number of strokes). */
export function inkComponents(art) {
  const cells = inkCells(art);
  const ink = new Set(cells.map(key));
  const seen = new Set();
  let count = 0;
  for (const start of cells) {
    if (seen.has(key(start))) continue;
    count++;
    const stack = [start];
    seen.add(key(start));
    while (stack.length) {
      const [r, c] = stack.pop();
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const k = `${r + dr},${c + dc}`;
          if ((dr || dc) && ink.has(k) && !seen.has(k)) {
            seen.add(k);
            stack.push([r + dr, c + dc]);
          }
        }
      }
    }
  }
  return count;
}

/** Success criterion 3: within-stroke adjacency, per string. */
export const ADJACENCY_MIN = 0.9;
/**
 * Continuity floor, pooled over a test corpus (user decision 2026-11-08). Single strings may legitimately
 * score anything (a lone "|" is 1.0), so compare pooledContinuity(), not per-string values.
 */
export const CONTINUITY_MIN = 0.75;

/**
 * Every "scan" ordering of a grid: sweep lines are rows or columns, visited forward or backward, and each line is
 * read forward, backward, or alternating (snake / boustrophedon) starting either way. 2 x 2 x 4 = 16 orderings.
 * Returns comparators over [row, col].
 */
export function scanOrderings() {
  const out = [];
  for (const major of ['row', 'col']) {
    for (const lineDir of [1, -1]) {
      for (const inner of ['fwd', 'bwd', 'snakeFwd', 'snakeBwd']) {
        const name = `${major}${lineDir > 0 ? '+' : '-'}/${inner}`;
        out.push({
          name,
          compare: (a, b) => {
            const [la, ia] = major === 'row' ? a : [a[1], a[0]];
            const [lb, ib] = major === 'row' ? b : [b[1], b[0]];
            if (la !== lb) return (la - lb) * lineDir;
            let dir = inner === 'fwd' || inner === 'snakeFwd' ? 1 : -1;
            if (inner.startsWith('snake') && Math.abs(la) % 2 === 1) dir = -dir;
            return (ia - ib) * dir;
          },
        });
      }
    }
  }
  return out;
}

/** Order the art's ink cells by one scan ordering. */
export function scanOrder(art, ordering) {
  return inkCells(art).sort(ordering.compare);
}

/**
 * Stroke quality numbers.
 * - adjacency: within each stroke, share of consecutive pairs that are 8-neighbours (criterion 3, >= ADJACENCY_MIN).
 *   On its own this is gamed by cutting any order into strokes at every non-adjacent step, hence:
 * - continuity: adjacent within-stroke pairs / (ink cells - ink components). 1.0 means every component was drawn
 *   as one unbroken path; one-cell strokes score 0. Gate it pooled over a corpus (pooledContinuity).
 * - scanSimilarity: for each of the 16 scan orderings, the share of within-stroke consecutive pairs whose two
 *   cells are neighbours in that ordering (|index difference| = 1, either direction); the maximum is reported,
 *   with the ordering's name. Direction-free and per stroke, so reversing strokes or reordering them does not
 *   hide a chopped scan (it still scores 1.0). Strokes with no pairs give 0 (that case is caught by continuity).
 *   Known gap: local scans inside narrow bands are not caught; ug8.2 adds a glyph-direction metric for that.
 */
export function strokeMetrics(art, strokes) {
  let pairs = 0;
  let adjacentPairs = 0;
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.length; i++) {
      pairs++;
      if (adjacent(stroke[i - 1], stroke[i])) adjacentPairs++;
    }
  }
  const cells = inkCells(art);
  const components = inkComponents(art);
  const maxPairs = cells.length - components;

  let scanSimilarity = 0;
  let scanOrdering = null;
  if (pairs > 0) {
    for (const ordering of scanOrderings()) {
      const index = new Map(scanOrder(art, ordering).map((cell, i) => [key(cell), i]));
      let steps = 0;
      for (const stroke of strokes) {
        for (let i = 1; i < stroke.length; i++) {
          if (Math.abs(index.get(key(stroke[i])) - index.get(key(stroke[i - 1]))) === 1) steps++;
        }
      }
      const sim = steps / pairs;
      if (sim > scanSimilarity) {
        scanSimilarity = sim;
        scanOrdering = ordering.name;
      }
    }
  }

  return {
    cells: cells.length,
    strokes: strokes.length,
    components,
    pairs,
    adjacentPairs,
    maxPairs,
    adjacency: pairs === 0 ? 1 : adjacentPairs / pairs,
    continuity: maxPairs === 0 ? 1 : adjacentPairs / maxPairs,
    scanSimilarity,
    scanOrdering,
  };
}

/** Continuity pooled over many results of strokeMetrics: sum of adjacent pairs / sum of max pairs. */
export function pooledContinuity(results) {
  const num = results.reduce((s, m) => s + m.adjacentPairs, 0);
  const den = results.reduce((s, m) => s + m.maxPairs, 0);
  return den === 0 ? 1 : num / den;
}

/**
 * Baseline shortcut: take a scan order and start a new stroke at every non-adjacent step. Scores adjacency 1.0
 * and a perfect final frame, so a real stroke engine must be distinguishable from it (continuity, scanSimilarity).
 */
export function choppedScan(art, ordering) {
  const strokes = [];
  for (const cell of scanOrder(art, ordering)) {
    const cur = strokes[strokes.length - 1];
    if (cur && adjacent(cur[cur.length - 1], cell)) cur.push(cell);
    else strokes.push([cell]);
  }
  return strokes;
}
