# Brand — the wordmark working material

Everything needed to change the DDCS Studio wordmark again without re-deriving it from scratch.
*(kept at the human's request, 2026-08-22: "we will change the logo sometimes so if we can keep any working
material it would help")*

## What's here

| file | what it is |
|---|---|
| `MARK-{NORMAL,STUDIO,FUTURISTIC,STEAMPUNK,ORGANIC}-TRACED.svg` | the five finished `<symbol>` blocks, ready to paste into `DDCS-Studio/web/index.html` |
| `wordmark-specimens.html` | the live comparison page — 16 candidate faces rendered on the organic theme's own tokens, which is how Sniglet was chosen over Nunito and Fredoka |

## ⛔ What is MISSING, and is the reason this folder exists

**There is no generator script.** The five SVGs above were produced by a pipeline that was written, run, and
lost with its session. All that survived is prose in [`../BACKLOG.md`](../BACKLOG.md) under F5 — and prose is
not working material. Changing the logo today means re-deriving the pipeline from a description of it.

⇒ **The next turn that touches these marks writes `trace-wordmark.py` here.** Recipe, from F5:

1. Fetch the Google Fonts WOFF2 subset with `&text=DDCS%20CNC%20MACRO%20STUDIO` and a **modern** User-Agent.
   - ⚠ An old UA gets you **EOT** instead of WOFF2.
   - ⚠ Omitting `&text=` gets you a **Cyrillic** subset with no `D` in it. Both of these actually happened.
2. Read glyph contours with `fontTools` + `brotli` (both pure-python installs).
3. Per glyph: `translate(0, baseline)` → shear → `scale(size/upem * xs, -size/upem)`, then lay out.
4. ⛔ **The shear sign is NEGATIVE.** The y-flip in `scale(…, -s)` runs first, so a positive shear leans the
   letters the wrong way. This shipped wrong once and the human caught it.
   **Assert it:** transform a point at cap height and check the x delta is positive.

Those four traps are the entire reason a script beats a description: each one is a silent wrong answer, not
an error.

## The organic mark's parameters

The other four marks are traced **as-is** from the fonts they already requested. Organic is a redesign:

```
face        Sniglet 800        both lines outlined — no font at runtime
slant       9 degrees          sheared (Sniglet ships no italic); matches Nunito's natural angle
fill width  146 units          68% glyph stretch / 32% added tracking
  wordmark    glyph 1.7406x   tracking 0.312em   #d9a03c
  tagline     glyph 1.3922x   tracking 0.134em   #a08d69
precision   1 decimal          0.07% error on a 150-unit box; 66% smaller than full float
treatment   NONE — flat        one fill per line
```

⭐ **Why the 68/32 blend exists:** the old `textLength` attribute stretched glyphs about **2×**
(Sniglet natural 69.9 → 146 = 2.09×). The blend brings that to **1.74×** and lets letter-spacing carry the
rest — 22% less distortion of the bowls, which is the whole reason Sniglet was chosen.

## ⛔ Rejected — built as live specimens, then declined. Do not reintroduce.

raised / engraved three-layer stack · halo (outside stroke) · glow (`feGaussianBlur`) · grain fill ·
carved gradient · plate rule.

⭐ The design work did not produce an effect; it produced the confidence to have none.
