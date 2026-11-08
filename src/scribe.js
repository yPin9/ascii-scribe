// DOM-free core: turn a string into a writing plan, and a character grid that is revealed / erased step by step.

import { deriveStrokes } from './strokes.js';
import { letterStarts } from './letters.js';

/** Extra time (in cell-steps) the pen takes when it lifts and starts a new stroke. */
export const LIFT_STEPS = 3;

/**
 * @param {(text: string) => string} render figlet renderer for one font
 * @param {string} text
 * @returns {{ text: string, art: string, rows: string[], steps: Array<{r: number, c: number, ch: string, at: number,
 *   stroke: number, first: boolean, last: boolean}> }} steps in writing order; `at` = when the step appears, in
 *   cell-steps from the start (pen lifts add LIFT_STEPS); `stroke` = index of its stroke
 */
export function plan(render, text) {
  const art = render(text);
  const rows = art.split('\n');
  const strokes = deriveStrokes(art, { letterStarts: letterStarts(render, text) });
  const steps = [];
  let t = 0;
  strokes.forEach((stroke, si) => {
    stroke.forEach(([r, c], i) => {
      if (i === 0 && si > 0) t += LIFT_STEPS;
      steps.push({ r, c, ch: rows[r][c], at: t, stroke: si, first: i === 0, last: i === stroke.length - 1 });
      t += 1;
    });
  });
  return { text, art, rows, steps };
}

/**
 * When each step appears, in ms after writing starts. A pen lift waits `lift` ms. With `ease`, the pen moves slowly
 * at the start and end of a stroke and fast in the middle (each cell takes 0.55×–1.85× the base time).
 * @param {Array<{stroke: number}>} steps
 * @param {{ speed: number, lift?: number, ease?: boolean }} options speed = cells per second (base pace)
 * @returns {number[]} non-decreasing ms, one per step; the first step is at 0
 */
export function timeline(steps, { speed, lift = 0, ease = false }) {
  const base = 1000 / speed;
  const out = new Array(steps.length);
  let t = 0;
  for (let i = 0; i < steps.length; ) {
    let j = i + 1;
    while (j < steps.length && steps[j].stroke === steps[i].stroke) j++;
    if (i > 0) t += lift;
    const len = j - i;
    for (let k = 0; k < len; k++) {
      out[i + k] = t;
      t += base * (ease && len > 2 ? easeFactor(k / (len - 1)) : 1);
    }
    i = j;
  }
  return out;
}

/** Time factor at position x (0..1) along a stroke: slow ends, fast middle. */
export const easeFactor = (x) => 0.55 + 1.3 * (2 * x - 1) ** 2;

/** Number of entries of the sorted array `times` that are ≤ t. */
export function countUpTo(times, t) {
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Number of steps visible `units` cell-steps after writing started. */
export function visibleAt(steps, units) {
  let lo = 0;
  let hi = steps.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (steps[mid].at <= units) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Character grid with the exact shape of the art (same line lengths, spaces kept). */
export class Grid {
  constructor(rows) {
    this.cells = rows.map((line) => Array.from(line, () => ' '));
  }
  show(step) {
    this.cells[step.r][step.c] = step.ch;
  }
  hide(step) {
    this.cells[step.r][step.c] = ' ';
  }
  toString() {
    return this.cells.map((row) => row.join('')).join('\n');
  }
}

/**
 * Parse the `strings` attribute: a JSON array of strings, or (if it is not JSON) one plain string.
 * @param {string | null} value
 * @returns {string[]}
 */
export function parseStrings(value) {
  if (value == null || value.trim() === '') return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String).filter((s) => s.length > 0);
    if (typeof parsed === 'string') return parsed ? [parsed] : [];
  } catch {
    // not JSON: a single sentence
  }
  return [value];
}
