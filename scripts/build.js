// Bundle src/index.js into a single browser ES module: dist/ascii-scribe.js
import { build } from 'esbuild';
import { statSync } from 'node:fs';

const out = 'dist/ascii-scribe.js';
try {
  await build({
    entryPoints: ['src/index.js'],
    bundle: true,
    format: 'esm',
    minify: true,
    target: 'es2020',
    platform: 'browser',
    banner: {
      js:
        '/*! ascii-scribe | MIT (c) 2026 ascii-scribe contributors | bundles figlet.js (MIT, (c) Patrick Gillespie) and FIGlet fonts ' +
        '(BSD-3-Clause, (c) Glenn Chappell, Ian Chai, John Cowan, Christiaan Keet, Claudio Matsuoka and others) | ' +
        'full texts: https://cdn.jsdelivr.net/gh/yPin9/ascii-scribe/THIRD_PARTY_LICENSES.md */',
    },
    outfile: out,
    logLevel: 'error',
  });
  console.log(`build ok: ${out} (${(statSync(out).size / 1024).toFixed(1)} KiB)`);
} catch {
  process.exit(1);
}
