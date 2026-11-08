// Real-browser harness: bundles src/index.js in memory and serves it from a fake origin to a headless Chromium.
// Browser: $CHROME_PATH, else a locally installed Chrome / Edge / Chromium. No browser = the test fails (not skips).

import { existsSync } from 'node:fs';
import { build } from 'esbuild';
import { chromium } from 'playwright-core';

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

export const ORIGIN = 'http://scribe.test';

export async function bundle() {
  const out = await build({
    entryPoints: [new URL('../../src/index.js', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')],
    bundle: true,
    format: 'esm',
    target: 'es2020',
    platform: 'browser',
    write: false,
    logLevel: 'error',
  });
  return out.outputFiles[0].text;
}

export async function launch() {
  const executablePath = CANDIDATES.find((p) => existsSync(p));
  if (!executablePath) throw new Error('no Chromium-based browser found; set CHROME_PATH');
  return chromium.launch({ executablePath, headless: true });
}

/**
 * Open a page whose body is `body` (HTML) with the bundle loaded as a module.
 * @param {import('playwright-core').Browser} browser
 */
export async function openPage(browser, js, { body = '', head = '', viewport, reducedMotion } = {}) {
  const context = await browser.newContext({ viewport: viewport ?? { width: 1000, height: 700 }, reducedMotion });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e));
  await page.route(`${ORIGIN}/**`, (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/ascii-scribe.js') return route.fulfill({ body: js, contentType: 'text/javascript' });
    return route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${head}<script type="module" src="/ascii-scribe.js"></script></head><body>${body}</body></html>`,
    });
  });
  await page.goto(`${ORIGIN}/`);
  await page.waitForFunction(() => customElements.get('ascii-scribe'));
  return { page, context, errors };
}
