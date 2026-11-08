import { AsciiScribe } from './element.js';

export const VERSION = '0.0.0';
export { AsciiScribe };
export { FONTS } from './fonts.js';

if (typeof customElements !== 'undefined' && !customElements.get('ascii-scribe')) {
  customElements.define('ascii-scribe', AsciiScribe);
}
