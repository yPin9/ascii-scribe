// Line-type figlet fonts bundled with ascii-scribe.
// All come from the official FIGlet distribution (BSD-3-Clause); see THIRD_PARTY_LICENSES.md.
import standard from 'figlet/importable-fonts/Standard.js';
import big from 'figlet/importable-fonts/Big.js';
import slant from 'figlet/importable-fonts/Slant.js';
import small from 'figlet/importable-fonts/Small.js';
import smallSlant from 'figlet/importable-fonts/Small Slant.js';
import shadow from 'figlet/importable-fonts/Shadow.js';
import script from 'figlet/importable-fonts/Script.js';

export const FONT_DATA = {
  Standard: standard,
  Big: big,
  Slant: slant,
  Small: small,
  'Small Slant': smallSlant,
  Shadow: shadow,
  Script: script,
};

export const FONTS = Object.keys(FONT_DATA);
export const DEFAULT_FONT = 'Standard';

/** Register the bundled fonts with a figlet instance (idempotent). */
export function registerFonts(figlet) {
  for (const [name, data] of Object.entries(FONT_DATA)) figlet.parseFont(name, data);
  return figlet;
}
