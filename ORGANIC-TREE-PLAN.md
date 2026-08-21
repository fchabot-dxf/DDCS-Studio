# ORGANIC → TREE — the retheme

**Approved by the human 2026-08-21.** See it live (three palettes, switchable, in a mock of the real UI):
https://claude.ai/code/artifact/b199b4b0-43ab-4024-b932-a63872991fe2

⭐ **Ship the `grove` variant** (human-selected in the mock, 2026-08-21) — a **green band over brown grounds**.
Green above, brown below, amber for anything interactive. `bark` and `canopy` remain in the artifact as the
single-material alternatives.

---

## Why

Organic has had **two identities** since it was written. Its theme chip is leaf green `#86b562` and its
motion is described in-source as *"humanist soft — SPRING: a slow UNFOLD from the top hinge"* — but the
palette is **anatomical**. The source's own comments, verbatim:

`--bg` *visceral dark body* · `--panel` *sinew / bone-shadow* · `--accent` *coral / **arterial*** ·
`--text` *bone* · `--text-dim` *aged bone* · `--border` *sinew seam* · `--success` *muscle green* ·
`--danger` *arterial*

Human: *"i think i want a more wood and tree theme for organic, so green brown and a amber"*, and separately
that the coral accent is *"out of place"*. It is not a bad shade — it is `arterial`, doing exactly what it
was designed to do in a theme being read as botanical.

---

## The tokens — `[data-theme="organic"]`, styles.css:3598

| token | from | to | is now |
|---|---|---|---|
| **`--band-bg`** | **`#bf6850`** | **`#25301a`** | ⭐⭐ **THE CANOPY.** The single biggest change — see §band |
| `--bg` | `#15110d` | **`#14110b`** | forest floor — stays BROWN |
| `--panel` | `#241c15` | **`#211a11`** | bark shadow — stays BROWN |
| `--panel2` | `#2f261c` | **`#2d2417`** | bark |
| `--border` | `#5a4836` | **`#5c4a30`** | bark seam |
| `--accent` | `#d97a5c` | **`#d9a03c`** | ⭐ SAP AMBER — was *coral / arterial* |
| `--text` | `#e9dcc4` | **`#ece0c6`** | sapwood — was *bone* |
| `--text-main` | `#f8eed8` | **`#f8f0da`** | |
| `--text-dim` | `#9d8a6b` | **`#a08d69`** | weathered — was *aged bone* |
| `--success` | `#8aa15a` | **`#4f9d5d`** | a REAL green — see the semantic rule |
| `--block-edited` | `#e6a24a` | **`#e6c04a`** | pale gold |
| `--danger` | `#c0473a` | **`#cf4436`** | a REAL red — see the semantic rule |
| `--edit-glow-rgb` (line ~1122) | `217,122,92` | **`217,160,60`** | ⛔ **MUST move with the accent** |

⛔ **`--edit-glow-rgb` is the one that gets forgotten.** It is the same coral in RGB and it drives the
character/window pulse — change the accent alone and **the pink survives in the animation**, which is where
it is most visible.

### Three colours, three jobs — green ABOVE, brown BELOW
```
  ┌─ --band-bg  #25301a ─────────┐   GREEN    the canopy across the top
  │  Wizard  Blocks  Editor      │
  ├──────────────────────────────┤
  │  --bg      #14110b           │   BROWN    forest floor
  │  --border  #5c4a30           │   BROWN    bark seams
  │  --accent  #d9a03c           │   AMBER    sap — anything interactive
  └──────────────────────────────┘
```
An earlier draft had brown grounds and no green in the theme's own identity at all — green appeared only as
`--success`, which belongs to the *status* layer. That is brown-and-amber wearing a leaf badge: the exact
problem this retheme exists to fix.

### §band — `--band-bg` is the change that matters most
⭐ It paints the header bar, the settings head AND the Blocks topbar (`styles.css:373-376`) — a stripe across
the whole top of the app, not a small accent. **If organic reads pink today, this is most of why** — more so
than the accent.

⚠ **It is an override of a previous human ruling, not a bug fix.** `styles.css:364-365` records t2071:
*"i remember coral was the original color, lets…"*. The human has now seen the green band in the mock and
selected it deliberately. Do not treat the old comment as authority; do not "restore" the coral.

⚠ **The green is WARM on purpose.** `#25301a` is **hue 90°** (moss). The first draft used `#1c3021` at
**135°**, which the human immediately called *"too teal/blue"* — that is the hue where blue overtakes red.
⛔ **If you adjust it, stay at or below ~95°.** Above that it drifts back to teal and stops reading as
foliage. Warmer options rejected-but-available: `#2a3318` (82°), `#303618` (73°, olive).

---

## ⛔ THE SEMANTIC RULE — the wood is CHROME only

*(Human: "and of course the other normal colours for visual language.")*

The tree palette owns **grounds, borders, text, accent**. The **status** colours keep the meanings everyone
already has, and are NOT harmonised into the theme:

- ⛔ **Green means success.** An earlier draft made `--block-edited` a "new growth" green to free amber for
  the accent. Wrong — a green edit-marker competes with success for the one meaning nobody should have to
  learn. `--success` is now a *proper* green, not a moss that reads as foliage decoration.
- ⛔ **Red stays red.** It was tempting to brown `--danger` into "heartwood rot" so it harmonised. **A danger
  colour that has been tastefully blended into the theme is a danger colour that stopped doing its job.**
- **Amber does double duty on purpose** — accent (interactive) vs `--block-edited` (state). Same family,
  never the same role, and amber means "attention / changed" universally too. If they read too close, push
  `--block-edited` lighter; that is the free knob.

⚠ **Worth checking on screen:** `--success #4f9d5d` and the green band are both green. They are far apart in
value (a bright chip against a dark band) and rarely adjacent, but if a `delivered` chip ever sits ON the
band it must still read. **If it sinks, brighten the success green — do not darken or brown the band.** The
semantic colour must not lose to the theme.

---

## What does NOT change

- ⛔ **The theme chip** (`styles.css:750`, leaf green radial) — it was right all along; the palette is what
  moved to meet it.
- ⛔ **The geometry.** `--tab-radius: 16px`, the flare, and the slow SPRING unfold stay exactly as they are.
  That geometry is *soft*, not anatomical, and soft is as true of a tree as of a body.
- The other four themes. This is organic only.

---

## Done when

1. The tokens above are changed, `--edit-glow-rgb` included.
2. Nothing outside `[data-theme="organic"]` and its `--edit-glow-rgb` line is touched.
3. A screenshot of a wizard + the Blocks tab in organic (the Blocks topbar is band-coloured, so it shows the canopy), so the human can judge it in the real app rather
   than in a mock — ⚠ **especially the `delivered`/success chip against the green ground.**
4. ⚠ The human said *"i might tweak it more after"* — so keep the palette as ONE contiguous, commented token
   block that can be edited in one place. Do not scatter these values.
