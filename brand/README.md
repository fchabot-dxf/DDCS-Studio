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

## Status (t2161)

✅ **normal / studio / futuristic / steampunk — INSTALLED in `index.html`, and VALIDATED.** `trace-wordmark.py`
was actually run against `wordmarks.json` for these four (fontTools happened to be available) and produced
output **byte-identical** to the shipped `MARK-*-TRACED.svg` files — real proof the declaration + interpreter
correctly reproduce the approved artifacts, not just a plausible-looking script. That run caught two real bugs
in the interpreter first (documented in its own header): `penx` pre-scaled (collapsed letter spacing near zero)
and a layer's `dx` applied twice (baked into the geometry *and* the wrapping `<g transform>`). Both fixed;
neither is present in the shipped SVGs, which were hand-verified visually before this validation even started.

⛔ **organic — NOT installed. `brand/MARK-ORGANIC-TRACED.svg`'s traced 'D' glyph is broken.** Its inner counter
path is a ~2-unit stray fragment instead of tracing the letter's actual hole, so the mark visibly reads "DOCS"
— confirmed by rendering the raw SVG file standalone (outside the app, outside this repo's index.html splice
entirely) and by inspecting the path data directly. The C and S glyphs in the same file trace correctly, so
this is a defect in extracting this one glyph, not the pipeline as a whole — but it is a broken company
wordmark, and it does not ship on that basis. `index.html`'s `mark-organic` symbol is UNTOUCHED — still the
original Georgia-italic `<text>` render, `textLength` and all — pending a fixed re-trace.

`trace-wordmark.py`'s Google Fonts fetch path (the only path organic uses) was never actually run this turn —
no network access in that session. Before trusting a regenerated organic mark: run it, then verify the OUTPUT
the same way t2161 caught the bug — render the SVG standalone at real size and read the letters, don't just
diff coordinates. See `trace-wordmark.py --check` for a coarse automated version of the same check (flags any
glyph whose transformed bbox looks suspiciously small).

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
