# NEXT SESSION — Binding Rebuild (handoff)

> **You're picking up a large, well-scoped refactor that has a *live safety net*.** Read this top to bottom,
> run the suite to confirm the baseline, then proceed **one small step at a time**. The previous session built
> an entire self-describing-G-code format/parser system; your job is to unify the wizard form-field binding
> into it.
>
> ## 🔴 GOLDEN RULE
> **Run BOTH after EVERY change, before committing:**
> ```
> cd DDCS-Studio && npx playwright test --reporter=line            # full suite
> npx playwright test tests/protocol-validator.spec.js              # the protocol guard
> ```
> **The existing tests ARE the contract.** The one real error last session came from deleting a subsystem
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

## THE TASK — unify the form-field binding into the dictionary
The param↔form binding lives in **two places that can drift**:
- `PARAM_FIELDS` (`wizardManager.js`, now exported) — **forward**: param → form-field id, per op.
- `RECONCILERS` (`opStacks.js`) — **reverse**: field ← block.

**Goal: one declared source of truth = the dictionary.**

### Steps — each one: *change → run suite + validator → commit*
1. **Co-locate** `PARAM_FIELDS` into `opDictionary.js` (move the const, `export const FIELDS = …`; in
   `wizardManager.js` replace it with `import { FIELDS as PARAM_FIELDS } from './blocks/opDictionary.js'` so the
   two usages at lines ~266/274 stay unchanged). Pure data move, **no behavior change** — suite must stay green.
2. **Extend the validator** to assert `FIELDS[op]` keys ⊆ `DICT[op]` keys. This surfaces the **real mismatches
   to reconcile** — for each, open the op's `<name>Stack` builder + its `wizards/views/<name>View.js` to decide
   the true name:
   - `atc_table`: FIELDS `lengths`/`pockets` vs DICT `includeLengths`/`includePockets` (check `atcTableStack`).
   - `surfacing`: FIELDS has `rpm` (`sf_rpm`) but DICT has none — does `surfacingStack` read `params.rpm`?
     (probably a vestigial form field → drop it, or add to the dict).
   - `atc_change`: FIELDS has `orient` (`atc_change_orient`) but DICT has none (check `atcChangeStack`).
   - `corner`: FIELDS `probeZ`→`c_probe_z_first` vs DICT `probeZ` + `probeZFirst` — align.

   **⚠️ Systematic, not just these four.** The probe ops (`edge`, `corner`, `alignment`, `middle`, `circular`,
   `rotary_clock`, `rotary_center`) differ *wholesale*: the FORM (`PARAM_FIELDS`) carries `qStop`/`syncA`/`slave`,
   while the DICT (built from the emitters) carries `port`/`level`/`sources`/`radius`. Those are **different
   params** (Q-stop enable vs probe input port / trigger level), not renames. For each, open the `<name>Stack`
   builder and check **what it actually reads from `op.params`** — *that* is the truth; align both the form
   binding and the dict to it. The validator extension (FIELDS ⊆ DICT) lists the **full** set — don't assume
   it's only the examples above. (This is also why a fresh probe op false-glows: see "Probe op.params
   completeness" below — same root cause, op.params isn't yet the complete source.)
3. **Merge the field id into the dict per param** — extend the `N/Enum/Str/Bool/Struct` helpers to take a
   `field` arg (e.g. `N(addr, canon, field)`), or add a `field` property. Then **switch
   `wizardManager._seedForm()`** to read the dict's field binding instead of `PARAM_FIELDS`.
4. **Delete `PARAM_FIELDS`** (now in the dict). Validator + suite green.
5. *(lower priority)* the reverse-sync `RECONCILERS`: **KEEP it working** (14 tests). Optionally migrate it to
   read declared block params via the dict's binding instead of the hand-written per-op maps — but **do not break
   the tests**, and remember the underiving (e.g. `stepover%` from the absolute step) is still *declaration*
   (reading a declared block value + math), not the banned inference.

### Exemptions (ops with no `PARAM_FIELDS` binding — keep the validator exempting these)
`drill` (custom `view.setForm` for pattern variants), `atc_length` (Settings-driven, no per-op fields),
`homing` (no form-field map).

---

## Key files
- `web/blocks/opDictionary.js` — `DICT` (type + `addr` + `canon`), codec, `validate`. **The destination.**
- `web/blocks/opStacks.js` — `BUILDERS` (exported), `RECONCILERS` (**keep**), `makeOp`, `opFromMarker`,
  `importMarkedNc`, `collectInjectedIds` (override-diff), `editedLinesForOp` (glow).
- `web/blocks/programModel.js` — stack-as-truth, the line→op map (`proj.map` = per-line block ancestry, built in
  `blockModel.js`'s `emit`: `own = [...anc, block.id]`), `serializeWithMarkers`.
- `web/wizardManager.js` — `PARAM_FIELDS` (exported), `_seedForm`, `openForEdit` (seeds from `op.params` — the
  correct forward path), `pullFromBlocks` (reverse-sync, **keep**).
- `tests/protocol-validator.spec.js` — the guard. **Extend it as you migrate.**
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
