// Letter boundaries in figlet output. figlet squeezes ("smushes") neighbouring letters together, so the grid alone
// does not say where one letter ends. Rendering every prefix of the text and measuring its width does:
// letter i owns the columns [width(text[0..i)), width(text[0..i+1))).

const widthOf = (art) => Math.max(0, ...art.split('\n').map((l) => l.length));

/**
 * @param {(text: string) => string} render renders text with the same font/options as the full art
 * @param {string} text
 * @returns {number[]} start column of each character's letter (non-decreasing; equal starts = zero-width)
 */
export function letterStarts(render, text) {
  const chars = Array.from(text);
  const starts = [];
  let prev = 0;
  for (let i = 0; i < chars.length; i++) {
    starts.push(prev);
    prev = Math.max(prev, widthOf(render(chars.slice(0, i + 1).join(''))));
  }
  return starts;
}

/** Map a column to the index of the letter that owns it. */
export function letterAt(starts, col) {
  let lo = 0;
  let hi = starts.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (starts[mid] <= col) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}
