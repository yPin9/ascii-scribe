// Judge-side "glyph direction consistency" metric (independent of src/; do not import engine code here).
//
// Each line-drawing glyph connects to neighbours only in certain directions. A within-stroke step a -> b with
// displacement d is *consistent* if a connects towards d or b connects back towards -d. Steps where both ends are
// non-line glyphs (letters, '#', '@', ...) carry no direction information and are not counted.

const N = [-1, 0], S = [1, 0], E = [0, 1], W = [0, -1];
const NE = [-1, 1], NW = [-1, -1], SE = [1, 1], SW = [1, -1];

/** Directions each line glyph connects towards. '_' sits at the bottom of its cell, so it also meets cells below. */
export const GLYPH_DIRECTIONS = {
  '|': [N, S],
  '_': [E, W, SE, SW],
  '-': [E, W],
  '=': [E, W],
  '/': [NE, SW],
  '\\': [NW, SE],
  '(': [N, S, NE, SE],
  ')': [N, S, NW, SW],
  '<': [NE, SE],
  '>': [NW, SW],
};

const has = (dirs, [dr, dc]) => dirs.some(([r, c]) => r === dr && c === dc);

/** Is the step from cell a (glyph ga) to cell b (glyph gb) consistent? null when neither glyph has a direction. */
export function stepConsistent(ga, gb, a, b) {
  const da = GLYPH_DIRECTIONS[ga];
  const db = GLYPH_DIRECTIONS[gb];
  if (!da && !db) return null;
  const d = [b[0] - a[0], b[1] - a[1]];
  const back = [-d[0], -d[1]];
  return Boolean((da && has(da, d)) || (db && has(db, back)));
}

/** Counts for one art + stroke list. */
export function directionCounts(art, strokes) {
  const rows = art.split('\n');
  let counted = 0;
  let consistent = 0;
  for (const stroke of strokes) {
    for (let i = 1; i < stroke.length; i++) {
      const a = stroke[i - 1];
      const b = stroke[i];
      const ok = stepConsistent(rows[a[0]][a[1]], rows[b[0]][b[1]], a, b);
      if (ok === null) continue;
      counted++;
      if (ok) consistent++;
    }
  }
  return { counted, consistent, ratio: counted === 0 ? 1 : consistent / counted };
}

/** Direction consistency pooled over many directionCounts results. */
export function pooledDirection(results) {
  const num = results.reduce((s, r) => s + r.consistent, 0);
  const den = results.reduce((s, r) => s + r.counted, 0);
  return den === 0 ? 1 : num / den;
}
