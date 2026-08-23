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
| `fonts/Fredoka[wdth,wght].ttf` + `fonts/OFL-Fredoka.txt` | organic's vendored source font (see Provenance, below) — kept because it's a variable font pinned to a fixed instance at trace time; not something a live fetch alone can reproduce identically. |

⛔ **The candidate-face comparison page is not kept** *(human, 2026-08-22: "dont keep the rejected face")*.
Sixteen faces were rendered side by side on the organic tokens to choose Sniglet; the fifteen that lost are
not working material, they are a decision already made — except Sniglet itself didn't survive contact with its
own published font file (below), so the runner-up from that same comparison, Fredoka, is what actually ships.

## Status (t2161 → t2163 → t2165 — all five now installed and validated)

✅ **normal / studio / futuristic / steampunk — VALIDATED.** `trace-wordmark.py` was actually run against
`wordmarks.json` for these four (fontTools happened to be available) and produced output **byte-identical** to
the shipped `MARK-*-TRACED.svg` files — real proof the declaration + interpreter correctly reproduce the
approved artifacts, not just a plausible-looking script. That run caught two real bugs in the interpreter first
(documented in its own header): `penx` pre-scaled (collapsed letter spacing near zero) and a layer's `dx`
applied twice (baked into the geometry *and* the wrapping `<g transform>`). Both fixed; neither is present in
the shipped SVGs, which were hand-verified visually before this validation even started.

✅ **organic — SHIPPED, as Fredoka Bold (700), not the human's original Sniglet choice.** The full story, because
it took three turns to get here and the reasoning is worth keeping:
- **t2161**: traced from Sniglet ExtraBold (the human's actual pick). The shipped SVG visibly read "DOCS" — the
  'D' glyph's inner counter traced as a ~2-unit stray fragment instead of the letter's actual hole. Caught by
  rendering the raw file standalone, outside the app, and reading the letters — not by a coordinate check.
- **t2163**: root-caused it. Re-fetched Sniglet ExtraBold live (a "no network" conclusion from t2161 turned out
  to be a URL-matching bug, since fixed) and read its `glyf` table directly: the 'D' counter is a genuine
  ~79×79-unit fragment against a ~610×723 outer contour (under 13% of the width) — in BOTH the API-subsetted
  webfont and the full un-subsetted one (rules out subsetting). Sniglet REGULAR (400)'s 'D', checked the same
  way, has a normal ~61%-width counter — so the defect is specific to weight 800.
- **t2165**: checked whether it's a Google-serving artifact by fetching Sniglet ExtraBold from its canonical
  upstream OFL source on `github.com/google/fonts` directly — **identical, byte-for-byte contour data.** Not
  Google's copy; the defect is in the font as currently published, full stop. Per the advisor's call, fell back
  to **Fredoka Bold (700)** — the runner-up from the original comparison (NOT Sniglet 400, which is the right
  face but too light a weight to stand beside the other four marks). Fredoka's 'D'/'C'/'S' all traced with
  correctly-proportioned counters/openings (~40% width for the 'D', a normal figure), verified the same way
  every time in this series: rendered standalone and read, not inferred from a diff. Installed in `index.html`.

⭐ **Method, stated once since it recurs:** before trusting ANY regenerated mark — this one, or a re-trace of any
other mark after a future font update — run `trace-wordmark.py`, then verify the OUTPUT by rendering the SVG
standalone at real size and READING the letters. `--check` prints a coarse automated bbox heuristic but is not a
substitute for actually looking (it produced noisy, unreliable numbers for Fredoka's own curve-heavy paths and
was ignored in favour of the real check). Never hand-author or approximate a glyph's path data to route around a
font defect — the entire outcome of the Sniglet saga was possible only because the failure was diagnosed instead
of patched around.

## organic's parameters (Fredoka Bold, current)
*(also declared in `wordmarks.json`'s `marks.organic` — this table is the human-readable version)*

```
  face        Fredoka Bold (700)   vendored (brand/fonts/), a variable font pinned to wght=700, wdth=100
  slant       9 degrees            sheared (a family-lean constant, kept from the Sniglet design — matches
                                    futuristic/normal's own lean, independent of which face fills this slot)
  fit         targetWidth          plain fit-to-146-units, no blend (~2.26x wordmark, ~1.84x tagline stretch;
                                    rendered legibly and correctly-proportioned on inspection — no bespoke
                                    blend ratio was invented the way Sniglet's 68/32 was; see the note below)
  colours     wordmark #d9a03c, tagline #a08d69   (unchanged from the Sniglet design)
  precision   1 decimal            0.07% error on a 150-unit box; 66% smaller than full float
  treatment   NONE — flat          one fill per line, same structure as mark-normal
```

⚠ **The 68/32 stretch/tracking blend was a Sniglet-specific judgement call, not reused here.** It existed to
protect Sniglet's particularly round bowls from a 2.09× full stretch. Fredoka's own full stretch (`fit:
targetWidth`, no blend) was tried first as the simplest option requiring no new invented parameter, and it read
correctly and legibly at both diagnostic and real header size — so no blend was added. If a future look decides
Fredoka reads too stretched at some size, a blend (like organic's own Sniglet-era one) is the next thing to try,
re-derived from Fredoka's own natural metrics — not a reason this was skipped by oversight.

## Provenance — Fredoka Bold (`fonts/Fredoka[wdth,wght].ttf`)

Fetched from `github.com/google/fonts`' canonical `ofl/fredoka/` directory (the same repository organic's
Sniglet attempt was cross-checked against), not the live Google Fonts serving API — vendored because it's a
**variable font** (axes `wght` 300–700, `wdth` 75–125) and `trace-wordmark.py` needs to pin it to a fixed
instance (`wght=700, wdth=100`, the published "Bold" named instance) at trace time; a live API fetch alone
doesn't give the same reproducible starting artifact a vendored file does. OFL-licensed (SIL Open Font License
1.1), copyright 2016 The Fredoka Project Authors — full text in `fonts/OFL-Fredoka.txt`, fetched alongside it
from the same repository. Designer: Milena Brandao / Hafontia.

## ⛔ Rejected — built as live specimens, then declined. Do not reintroduce.

raised / engraved three-layer stack · halo (outside stroke) · glow (`feGaussianBlur`) · grain fill ·
carved gradient · plate rule.
⭐ The design work did not produce an effect; it produced the confidence to have none.
