# ascii-scribe

Writes text as figlet ASCII art **stroke by stroke**, pauses, erases it in reverse, and moves on to the next string.
Stroke order is derived automatically from the figlet output — no hand-authored per-letter stroke data.

Status: in development. See `.norn/ideas/ascii-scribe.md` for the goal and success criteria.

```html
<script type="module" src="https://cdn.jsdelivr.net/gh/yPin9/ascii-scribe@<version>/dist/ascii-scribe.js"></script>
<ascii-scribe font="Standard" strings='["pwn", "reverse"]'></ascii-scribe>
```
