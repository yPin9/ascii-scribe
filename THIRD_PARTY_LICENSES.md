# Third-party licenses

`dist/ascii-scribe.js` bundles the following third-party code and data.

## figlet.js

- Source: https://github.com/patorjk/figlet.js (npm `figlet@1.12.0`)
- License: MIT — Copyright (C) 2014-present Patrick Gillespie and other contributors

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```

## FIGlet fonts

Bundled fonts (data taken unchanged from `figlet/importable-fonts/`, verified byte-identical to the `.flf` files by `test/fonts.test.js`):

| Font | FIGlet file | Header credit |
|---|---|---|
| Standard | standard.flf | Glenn Chappell & Ian Chai 3/93; John Cowan; Paul Burton; modified May 20, 2012 by patorjk (added the 0xCA0 character) |
| Big | big.flf | Glenn Chappell 4/93; Bruce Jakeway; Paul Burton |
| Slant | slant.flf | Glenn Chappell 3/93; Paul Burton |
| Small | small.flf | Glenn Chappell 4/93; Paul Burton |
| Small Slant | smslant.flf | Glenn Chappell 6/93; Paul Burton |
| Shadow | shadow.flf | Glenn Chappell 6/93; Paul Burton; modified June 17, 2007 by patorjk (widened the space character) |
| Script | script.flf | Glenn Chappell 4/93 |

**Why redistribution is allowed**: all seven fonts are part of the official FIGlet distribution
(https://github.com/cmatsuoka/figlet/tree/master/fonts), which is released under the BSD 3-Clause license.
Debian ships them in `main` under `Files: *` → BSD-3-clause
(https://metadata.ftp-master.debian.org/changelogs/main/f/figlet/unstable_copyright).
The font headers additionally grant: "Permission is hereby given to modify this font, as long as the modifier's
name is placed on a comment line." The figlet.js copies of Standard and Shadow carry such modifier lines
(patorjk, see table); ascii-scribe bundles them as-is and does not modify any font.

FIGlet license (BSD 3-Clause):

```
Copyright (C) 1991, 1993, 1994 Glenn Chappell and Ian Chai
Copyright (C) 1996, 1997, 1998, 1999, 2000, 2001 John Cowan
Copyright (C) 2002 Christiaan Keet
Copyright (C) 2011 Claudio Matsuoka
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions
are met:

1. Redistributions of source code must retain the above copyright
   notice, this list of conditions and the following disclaimer.
2. Redistributions in binary form must reproduce the above copyright
   notice, this list of conditions and the following disclaimer in the
   documentation and/or other materials provided with the distribution.
3. Neither the name of the copyright holders nor the names of their
   contributors may be used to endorse or promote products derived
   from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
"AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
COPYRIGHT HOLDERS OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT,
INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS
OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE
USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

Not bundled: other fonts shipped in the `figlet` npm package come from many authors with unclear licenses
and must not be added without checking their headers.
