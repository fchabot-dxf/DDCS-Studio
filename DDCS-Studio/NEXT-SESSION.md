
# ═══ t1950 — 🛑 BLOCKER: regroupOps made the canvas round-trip LOSSY. Release is held. ═══

**My full gate on `57f0f854`: 2538 passed, 26 skipped, 29 flaky, 12 FAILED** (the last valid gate had 2).
I isolated two of them — **they reproduce, this is not load contention:**

```
  guard-roundtrip-1595  "no block is lost through the canvas"
      Expected: 54   Received: 52      <- two blocks EATEN by the round-trip
```

## THE CAUSE — and my review flagged the claim before the gate confirmed it.
`regroupOps` calls `collapseImportTerminators`, which **strips every `endprogram` from anywhere in the tree
(recursing into `.children`) and re-appends only the LAST one at top level.** Wiring that into
`workspaceToStack` put it on EVERY Blockly edit. An op that legitimately carries its own terminator inside its
body — **corner does, by original design** (`stripEndprogram`'s own comment says so) — gets it torn out and
hoisted on the next edit. Hence the Homing+Corner cluster: `marker-rebuild-1848` ×2,
`option-b-slice2-positioning-1872`, `option-b-slice3-live-visibility-1874` ×3, `cam-multiop-edit-blocks-s45`,
`fork-parity-1593`, `guard-roundtrip-1595` ×2.

**Your doc comment asserts the opposite:** *"can only change which ops share a wrapper, never what emits."* The
wrapper half is true; the terminator half is false, and the gate just proved it. **Correct the claim as part
of the fix** — a comment promising a safety the code doesn't provide is the defect, not a side note.

## THE FIX — separate the two concerns; do NOT weaken the shape rule.
1. **The SHAPE rule is shared and stays shared:** flatten any wrapper, then regroup. Both `addOperation` and
   `workspaceToStack` want exactly that.
2. **The TERMINATOR rule is NOT universal.** Deduping terminators is right when SPLICING a new op into an
   already-framed program (`addOperation`) and when concatenating framed programs (`importMarkedNc`). It is
   **wrong on a workspace read-back**, where every block the user placed must survive verbatim. Apply it where
   a terminator conflict can actually arise — not in the shared shape pipeline.
   ⚠ **This is a SEPARATION, not a second shape rule.** If you end up with two functions that both decide
   wrapping, STOP and tell me — that is the thing we just spent three turns deleting.
3. **ASSERT LOSSLESSNESS IN YOUR OWN SPECS**, not only in `guard-roundtrip-1595`: a workspace round-trip
   through `workspaceToStack` returns the same block COUNT and the same tree, including any `endprogram` a
   user placed or an op body carries. That assertion is what was missing.
4. **`probe-input-select-revival-1888` is on the known-chronic-flake list** — verify it in isolation before
   attributing it to this. Do not fold a flake into the fix's story, and do not dismiss it without checking.

## ⚠ AND THE GATE-SCOPING LESSON IS MINE, NOT YOURS.
Your scoped gate (12/12 + 19/19 + 118/118) was exactly what I named, and it could not have caught this — **I
named a feature-scoped gate for a change landing in a UNIVERSAL choke point.** Every Blockly edit goes through
`workspaceToStack`. New rule, and I am writing it into the dispatch template: **when a change lands in a
choke point every edit passes through, the gate includes the ROUND-TRIP and PARITY specs
(`guard-roundtrip-1595`, `fork-parity-1593`, `marker-rebuild-1848`, `option-b-*`), not just the feature's own.**

⚠ Gate for THIS turn: all 12 failing tests by name + your own specs + node tier. The machine is yours; I run
the full suite again after this lands. Nothing releases until it is clean.
