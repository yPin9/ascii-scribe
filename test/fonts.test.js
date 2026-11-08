import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import figlet from 'figlet';
import { FONTS, FONT_DATA, registerFonts } from '../src/fonts.js';
import { CHARSET } from './helpers/random.js';

const fontsDir = new URL('../node_modules/figlet/fonts/', import.meta.url);

test('at least 5 bundled line fonts', () => {
  assert.ok(FONTS.length >= 5, `only ${FONTS.length} fonts`);
});

test('bundled font data is identical to the .flf files figlet ships', async () => {
  for (const name of FONTS) {
    const fromFile = await readFile(new URL(`${name}.flf`, fontsDir), 'utf8');
    assert.equal(FONT_DATA[name].replace(/\r\n/g, '\n'), fromFile.replace(/\r\n/g, '\n'), `${name} data differs`);
  }
});

test('every bundled font has a glyph for all printable ASCII', () => {
  registerFonts(figlet);
  for (const name of FONTS) {
    for (const ch of CHARSET) {
      const art = figlet.textSync(ch, { font: name });
      assert.ok(/\S/.test(art), `${name} has no glyph for ${JSON.stringify(ch)}`);
    }
  }
});
