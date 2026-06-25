# NEXT SESSION — Binding Rebuild (handoff)

> ## ✅ THE BINDING REBUILD IS DONE (steps 1–4 shipped to `main`)
> The wizard form-field binding is now **unified into the dictionary**. `PARAM_FIELDS` is gone; the field id
> lives ON each DICT param (`DICT[op][param].field`), and consumers read it via `paramFields(opType)`. The
> protocol validator structurally prevents drift (`BIND_ORPHANS` empty). Verified the live edit path end-to-end.
> **What's left = optional cleanup + the queued features below.** See "DONE" + "What's next".
>
> ## 🔴 GOLDEN RULE (still applies)
> **Run BOTH after EVERY change, before committing:**
> ```
> cd DDCS-Studio && npx playwright test --reporter=line            # full suite  (baseline: 229 pass, 1 known-fail)
> npx playwright test tests/protocol-validator.spec.js              # the protocol guard
> ```
> **The existing tests ARE the contract.** The one real error two sessions ago came from deleting a subsystem
> *without running the suite* — it broke 14 tests (reverted). Do not repeat it. Dev server runs on `localhost:3211`.

---

## Baseline — already shipped + pushed to `main`
A **self-describing-G-code format/parser system**: a program's ops carry `( @DDCS:1 {…} )` marker comments, so a
saved `.nc` round-trips back into high-level ops. **Declare, never infer.**

| commit | what |
|---|---|
| `f1f51a6` | **B1** `web/blocks/opDictionary.js` — the op dictionary (`DICT`) + the `( @DDCS:1 {…} )` marker codec (`markerLine`/`parseMarker`) + per-param `canon` rename map |
| `215147e` | **B2** `programModel.serializeWithMarkers()` — self-describing export; the live editor stays clean |
| `7b413d9` | **B3** `opStacks.importMarkedNc()` + `opFromMarker()` — read markers → reconstruct ops |
| `5580086` | **egress** — `editorManager.buildProgram()` emits markers on export/transfer; `commandDeck.loadGcodeFile()` reconstructs a marked `.nc` |
| `2d5371a` | **dict expansion** — all 21 ops in `DICT`, canon renames applied |
| `d636dc7` | **B4** override-diff glow — `collectInjectedIds` flags injected atoms **and** value-edited matched blocks |
| `6a0a105` | **B5 (partial)** — removed `isOpBlockEdited`'s broken form-safe reconciler check (field-id↔param adapter gap; it was a dead no-op) |
| `a6a4040` | **protocol VALIDATOR** `tests/protocol-validator.spec.js` — caught `circular`'s missing dict entry on first run |
| `a7ad0c5` | **rebuild step 1** — `PARAM_FIELDS` exported; validator now guards "every op has a form-field binding (or is exempt)" |
| `bd45abf` | **rebuild step 2 (move)** — `PARAM_FIELDS` co-located into `opDictionary.js` as `FIELDS`; wizardManager re-exports it (pure data move) |
| `8dcb8b0` | **rebuild step 2 (reconcile)** — validator asserts `FIELDS ⊆ DICT`; reconciled every drift (rpm on cutting ops; originX/originY on slot+text; qStop on the 6 probe ops; syncA/slave on edge; orient on atc_change; atc_table lengths/pockets → includeLengths/includePockets). Truth = view params-reader + `<name>Stack` reads (13-agent map + spot-checks) |
| `58b85d3` | **rebuild steps 3–4** — field folded ONTO each dict param (`DICT[op][param].field`); `paramFields(op)` replaces `PARAM_FIELDS`; `_seedForm`/`canEdit` read the dict; `BIND_ORPHANS` guard replaces the now-structural `FIELDS⊆DICT` check; live edit path verified end-to-end |

Clean baseline = **~229 passed, 1 failed** (the 1 is always one of the two known-bad below).

---

## The architecture — the rules (from `docs/MULTI-OP-STACKING.md`)
**`op.params` is the source of truth. G-code is a one-way projection. Never invert it.**
The BANNED "inference" = recovering high-level intent **from opaque motion lines**. That is the *only* banned thing.

### ⚠️ The trap that bit me last session — read this twice
- **`RECONCILERS` (in `opStacks.js`) read DECLARED params off the STRUCTURED BLOCK MODEL** (`offX` stored on the
  PlaceOnStock block; ATC tolerance on the atom). **That is DECLARATION, not inference.** They are a **tested,
  legitimate** reverse-sync feature (≈14 tests: `place-on-stock-block`, `slot-array`, `atc-roundtrip`, …).
  **DO NOT DELETE THEM.** I conflated "reads block params" with "infers from motion," deleted them, broke 14
  tests, and reverted.
- Rule of thumb: **reading the structured block model = declaration (fine). Recovering intent from emitted
  motion text = inference (banned).** `gcodeToStack` reads motion but only for *leaf* atoms (`G1 X10` declares
  its own X) — never high-level intent. That's fine.

---

## DONE — the form-field binding is unified into the dictionary
The param→form binding used to live in **two places that could drift** (`PARAM_FIELDS` forward + `RECONCILERS`
reverse). The forward binding is now **one declared source of truth on the dict**:
- The field id is a property of each dict param: **`DICT[op][param].field`** (folded in from a compact authoring
  column `FIELD_BIND` at module load, in `opDictionary.js`).
- `paramFields(opType)` (in `opDictionary.js`) returns the `{ param → field id }` map, derived from the dict —
  the **replacement for `PARAM_FIELDS`**. `wizardManager._seedForm()` + `canEdit()` read it.
- A binding whose param isn't catalogued can't attach → it lands in **`BIND_ORPHANS`**, which the protocol
  validator asserts is empty. So the field map **cannot drift** from the dictionary — it lives ON it.
- The reconciliation (step 2) used the truth = **what each view's params-reader emits + each `<name>Stack`
  reads** (verified with a 13-agent map + manual spot-checks). Notable resolutions: `qStop` is emitted by every
  probe view but no builder consumes it yet (`twoPassProbe` hard-codes `Q=1`) — declared in the dict anyway
  because `op.params` carries it (source of truth); `slot`/`text` placement keys are `originX`/`originY` (the
  PlaceOnStock child-block layer is `offX`/`offY`, a different layer); `atc_table` was a stale-FIELDS rename.

### Step 5 (reverse-sync `RECONCILERS`) — ASSESSED + DEFERRED (optional, unfavorable)
`RECONCILERS` (`opStacks.js`) map **block-atom params → form-field ids** (e.g. `sf_depth ← stepdown.to`), and emit
a **mix** of (a) op-param-bound fields and (b) pattern/derived fields with *no* flat binding (`sl_dia`, `sl_count`,
`d_cols`, un-derived `stepover%`). Migrating them to "produce `op.params` → map via the dict" only covers (a);
(b) stays hardcoded — and `drill`'s reconciler can't use `paramFields` at all (drill is binding-exempt). So it's a
partial, messy decouple of 14-tested reverse-sync code for modest gain. **Left as-is on purpose. Don't delete it.**
(The reconcilers reading the structured block model = DECLARATION, not the banned inference — see the trap above.)

### Exemptions (ops with no `.field` binding — the validator still exempts these)
`drill` (custom `view.setForm` for pattern variants), `atc_length` (Settings-driven, no per-op fields),
`homing` (no form-field map).

---

## Key files
- `web/blocks/opDictionary.js` — `DICT` (type + `addr` + `canon` + now `.field`), `FIELD_BIND` (the authoring
  column folded onto `DICT`), `BIND_ORPHANS`, `paramFields(op)`, codec, `validate`. **The single source of truth.**
- `web/blocks/opStacks.js` — `BUILDERS` (exported), `RECONCILERS` (**keep** — block→form reverse sync), `makeOp`,
  `opFromMarker`, `importMarkedNc`, `collectInjectedIds` (override-diff), `editedLinesForOp` (glow).
- `web/blocks/programModel.js` — stack-as-truth, the line→op map (`proj.map` = per-line block ancestry, built in
  `blockModel.js`'s `emit`: `own = [...anc, block.id]`), `serializeWithMarkers`.
- `web/wizardManager.js` — imports `paramFields`; `_seedForm` + `canEdit` read the dict binding; `openForEdit`
  (seeds from `op.params` — the correct forward path), `pullFromBlocks` (reverse-sync via RECONCILERS, **keep**).
- `tests/protocol-validator.spec.js` — the guard: DICT entry + binding (`.field`) + `BIND_ORPHANS` empty + canon
  unique + marker round-trip. **Extend it as you add ops/features.**
- `docs/MULTI-OP-STACKING.md` + `docs/BLOCKS-TAB.md` — the architecture (declare vs infer).

---

## Known-failing tests — IGNORE (pre-existing, not yours)
- `macros-tabs.spec.js` — stale (asserts an old flat-tab macros layout; UI is a tree now).
- `middle-animator.spec.js` — flaky animation timing; passes in isolation.

---

## Other queued work (after the binding rebuild)
- **USER wizard-maker** — let a user parametrize a block stack → a *compliant* custom op; the validator validates
  it by construction. (Separate product feature; builds on the unified binding + validator.)
- **Word-level glow** — the override-diff glow is block/line-level today; word-level needs a char-diff within the
  differing line (inject a glow span at a char range in `formatGCode`'s overlay — the fiddly part).
- **Probe `op.params` completeness** — a *freshly-inserted* probe op glows (false positive) because
  `BUILDERS(op.params) ≠ op.children` (op.params doesn't fully capture the probe config / `sources`). The rebuild
  (making op.params the complete source) fixes it; add a "**`BUILDERS(op.params)` reproduces `op.children`**"
  (params-completeness) check to the validator to catch it.
- **L1/L2** — per-controller address columns in the dict (the cross-controller translator); best-effort read of
  foreign post markers (e.g. Fusion op headers) as declarations.
