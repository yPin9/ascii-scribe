// Seeded random test strings. Seed comes from SCRIBE_SEED, otherwise it changes every run;
// tests must print the seed so a failing run can be reproduced.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Printable ASCII without space (space is added separately so strings do not start/end with it).
export const CHARSET = Array.from({ length: 126 - 33 + 1 }, (_, i) => String.fromCharCode(33 + i)).join('');

export function resolveSeed() {
  const env = process.env.SCRIBE_SEED;
  if (env !== undefined && env !== '') return Number(env) >>> 0;
  return (Date.now() ^ (Math.random() * 0x100000000)) >>> 0;
}

/** One random string: letters, digits and symbols mixed, length minLen..maxLen, may contain inner spaces. */
export function randomString(rand, { minLen = 1, maxLen = 12, spaceRate = 0.1 } = {}) {
  const len = minLen + Math.floor(rand() * (maxLen - minLen + 1));
  let s = '';
  for (let i = 0; i < len; i++) {
    const inner = i > 0 && i < len - 1;
    s += inner && rand() < spaceRate ? ' ' : CHARSET[Math.floor(rand() * CHARSET.length)];
  }
  return s;
}

export function randomStrings(seed, count, opts) {
  const rand = mulberry32(seed);
  return Array.from({ length: count }, () => randomString(rand, opts));
}
