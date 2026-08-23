# Brand — the wordmark working material

Everything needed to change the DDCS Studio wordmark again without re-deriving it from scratch.
*(kept at the human's request, 2026-08-22: "we will change the logo sometimes so if we can keep any working
material it would help")*

## What's here

| file | what it is |
|---|---|
| `wordmarks.json` | the DECLARATION — every font/size/slant/colour/layer constant, one entry per mark. The source of truth; regenerate a mark from this, never hand-edit a `MARK-*-TRACED.svg`'s path data. |
| `trace-wordmark.py` | a DUMB INTERPRETER of `wordmarks.json` — holds no constants of its own. `python trace-wordmark.py <mark>` or `--all`. |
| `MARK-{NORMAL,STUDIO,FUTURISTIC,STEAMPUNK,ORGANIC}-TRACED.svg` | the finished `<symbol>` blocks, pasted into `DDCS-Studio/web/index.html`. |

⛔ **The candidate-face comparison page is not kept** *(human, 2026-08-22: "dont keep the rejected face")*.
Sixteen faces were rendered side by side on the organic tokens to choose Sniglet; the fifteen that lost are
not working material, they are a decision already made. Only the chosen face and its parameters survive, below.

## Status (t2161, root-caused t2163)

✅ **normal / studio / futuristic / steampunk — INSTALLED in `index.html`, and VALIDATED.** `trace-wordmark.py`
was actually run against `wordmarks.json` for these four (fontTools happened to be available) and produced
output **byte-identical** to the shipped `MARK-*-TRACED.svg` files — real proof the declaration + interpreter
correctly reproduce the approved artifacts, not just a plausible-looking script. That run caught two real bugs
in the interpreter first (documented in its own header): `penx` pre-scaled (collapsed letter spacing near zero)
and a layer's `dx` applied twice (baked into the geometry *and* the wrapping `<g transform>`). Both fixed;
neither is present in the shipped SVGs, which were hand-verified visually before this validation even started.

⛔ **organic — NOT installed. Root cause found (t2163): Sniglet ExtraBold's own published 'D' glyph is broken,
not this pipeline.** t2161 found the shipped `MARK-ORGANIC-TRACED.svg` visibly reads "DOCS" (a ~2-unit stray
counter fragment instead of the letter's actual hole) but couldn't reach the Google Fonts fetch to test further
(a false "no network" conclusion — the real blocker was a URL-matching bug, since fixed). t2163 re-ran the fetch
for real and got the IDENTICAL broken 'D' back, so went one level deeper: read Sniglet's own `glyf` table
directly. **Weight 800 (ExtraBold, this mark's declared weight)'s 'D' has a genuinely tiny counter — ~79×79
units against a ~610×723 outer contour, under 13% of the width — in BOTH the API-subsetted webfont and the full
un-subsetted one** (ruling out subsetting as the cause). **Weight 400 (Regular)'s 'D', fetched and inspected
the same way, has a normal ~61%-width counter.** So: `fontTools` is extracting exactly what the font file
contains; this is a defect in the currently-published Sniglet 800 webfont itself, specific to that one weight,
and there is nothing in `wordmarks.json` or `trace-wordmark.py` that can fix it — a different declared weight or
face is a DESIGN decision, not this folder's to make. `index.html`'s `mark-organic` symbol stays UNTOUCHED
(original Georgia-italic `<text>` render, `textLength` and all) — the correct state to remain in until that
decision is made, not a failure to resolve.

Before trusting ANY future regenerated mark (organic once its font question is settled, or a re-trace of any
other mark after a font update): run `trace-wordmark.py`, then verify the OUTPUT the way both t2161 and t2163
did — render the SVG standalone at real size and READ the letters, never just diff coordinates or trust a clean
run. `--check` prints a coarse automated version of the same idea (flags a suspiciously small glyph bbox) but is
not a substitute for actually looking; it caught nothing extra here that reading the rendered letters hadn't
already caught first.

## The organic mark's parameters
*(also declared in `wordmarks.json`'s `marks.organic` — this table is the human-readable version)*

```
  face        Sniglet 800          both lines outlined — no font at runtime
  slant       9 degrees            sheared (Sniglet ships no italic); matches Nunito's natural angle
  fill width  146 units            68% glyph stretch / 32% added tracking
    wordmark    glyph 1.7406x   tracking 0.312em   #d9a03c
    tagline     glyph 1.3922x   tracking 0.134em   #a08d69
  precision   1 decimal            0.07% error on a 150-unit box; 66% smaller than full float
  treatment   NONE — flat          one fill per line
```

⭐ **Why the 68/32 blend exists:** the old `textLength` attribute stretched glyphs about **2×**
(Sniglet natural 69.9 → 146 = 2.09×). The blend brings that to **1.74×** and lets letter-spacing carry the
rest — 22% less distortion of the bowls, which is the whole reason Sniglet was chosen.

## ⛔ Rejected — built as live specimens, then declined. Do not reintroduce.

raised / engraved three-layer stack · halo (outside stroke) · glow (`feGaussianBlur`) · grain fill ·
carved gradient · plate rule.
⭐ The design work did not produce an effect; it produced the confidence to have none.
