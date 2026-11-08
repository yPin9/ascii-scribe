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
    outfile: out,
    logLevel: 'error',
  });
  console.log(`build ok: ${out} (${(statSync(out).size / 1024).toFixed(1)} KiB)`);
} catch {
  process.exit(1);
}
