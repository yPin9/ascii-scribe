import { test } from 'node:test';
import assert from 'node:assert/strict';
import figlet from 'figlet';
import { VERSION } from '../src/index.js';

test('entry module loads', () => {
  assert.equal(typeof VERSION, 'string');
});

test('figlet renders text synchronously', () => {
  const art = figlet.textSync('Hi', { font: 'Standard' });
  assert.match(art, /\|/);
});
