# t2353 — THE 3D PANE ONLY SHRINKS: visualMaxHeight is SELF-REFERENTIAL in the tree

## The owner's symptom, verbatim and complete
"the 3d preview, it feels like it can only reduce size, the feature canvas seems to work ok, but 3d prev,
reduces whether i pull up or down" — on the FLIPPED drill; classic wizards fine. Earlier report, same bug:
"going up slowly if i go down on the middle one" — the slow creep.

## THE MECHANISM — advisor-traced, marked INFERRED until you log it

`paneAccordion.js:210 visualMaxHeight`: `host = visual.parentElement`, returns
`floor(hb.bottom - vb.top - below)`.

```
CLASSIC  parent = .wiz-2pane, independently sized → max is a real ceiling ABOVE current. Fine.
TREE     parent = the split_horizontal pane wrapper, whose height is CONTENT-DRIVEN by the
         visual itself (its only child, flex:1 1 100%) →  hb.bottom ≈ vb.top + CURRENT height
         ⇒ max ≈ CURRENT. Growing clamps to current. Shrinking RATIFIES itself: the parent
         follows the visual down, so next frame's ceiling is lower. floor() bleeds ≤1px/frame.
         ⇒ a RATCHET: either drag direction only goes down.
```

Why it presents as "3D only": the middle handle's math holds the BOTTOM pane at startBottomHeight by
design, so the entire clamped loss lands on the TOP pane = preview3d. The 2D canvas is genuinely fine.

Why the t2349 harness missed it: the stationary-pointer test logged `visual.top` (my wrong hypothesis's
variable) — nobody logged `visualMaxHeight` per frame. ⚠ And `applyMove` still calls `visualMaxHeight(visual)`
PER FRAME — the one layout read the t2345/t2349 hoists missed, reading exactly what the previous frame's
write changed.

## VERIFY FIRST — one log
Per rAF flush during a synthetic tree-mode drag: log `visualMaxHeight(visual)` and the visual's rect height.
CONFIRMED if max tracks current height downward (ratchet) instead of sitting fixed above it.
Then the same log on a CLASSIC shell as the control — max should be stable while height varies.

## THE FIX — two layers, do both
1. **Hoist the clamp**: capture `dragMaxHeight = visualMaxHeight(visual)` ONCE at pointerdown (both
   handlers — addPaneSplitter AND addVisualSizer share the per-frame call), use it in applyMove/onUp.
   Room-available-at-drag-start is the correct semantic for a drag, same argument as every t2345/t2349
   hoist. This alone kills the per-frame feedback.
2. **Fix the ceiling's meaning in the tree**: at drag start in tree mode the captured max must be the room
   the SPLIT PANE could give the visual (its own parent's available height), not the visual's current
   extent echoed back. Establish what the right host to measure is in the tree hierarchy (the .ui-split-pane's
   own parent? the stacked container?) — REPORT the choice with the hierarchy observed, don't guess it in.
   ⚠ If (2) turns out ambiguous, ship (1) alone — it removes the ratchet; growth may still clamp at
   current in the tree, which is the smaller residual symptom. Say plainly which shipped.

⛔ Do NOT touch the classic path's behaviour: same captured-at-pointerdown max is fine there (its max is
stable anyway — prove byte-identical clamp results on a classic drag).
⛔ Preserve t2345 (no per-frame layout reads — this REMOVES the last one) and t2349 (delta math) and t2347
(no min-height floor).

## VERIFY AFTER
The tree-mode drag must GROW the 3D pane when dragged toward growth, shrink when dragged toward shrink,
and hold under a stationary pointer — assert all three in a test, at 412px stacked AND desktop. Plus the
classic control unchanged. FULL SUITE, failed count attributable, triaged against HEAD.

## ⭐ OWNER DETAIL, added mid-spec: "on touch it slightly increases size then just reduces"

Two components, and the fix must close BOTH:
1. **A DISCONTINUITY AT FIRST TOUCH** — the first explicit-height write does not equal the true rendered
   height. The captured total is topQuantity + startBottomHeight, but the real content stack is
   section-label + 3D pane + THE 8px SPLITTER BAR ITSELF + 2D pane + any gaps/margins. Every fixed term
   missing from (or double-counted in) that sum appears as a jump the moment the first write lands.
   ⚠ This is the same class as your own t2349 self-caught label-height bug — audit ALL the fixed terms
   this time, in the TREE hierarchy specifically.
2. **THEN the ratchet** (the self-referential max, above) grinds it down.

⭐⭐ ACCEPTANCE CRITERION, from the owner's own observation: **touching the splitter WITHOUT moving must not
change any pane's rendered height by even 1px** — assert it (pointerdown, one rAF flush with pendingY at
startY, measure). That single test catches every fixed-term bookkeeping error at once, in both modes.
