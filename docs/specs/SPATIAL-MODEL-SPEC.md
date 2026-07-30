# Declared Spatial Model — safe-Z frame + rotary bar

**Status:** DESIGN LOCKED (human sign-off, turn 148). Build pending — incremental, release each.
**Origin:** the rotary-fit "probe through the stock" turned out to be a safe-Z **value** the user set (not a bug) — the user
adjusts it and it resolves. But it surfaced two real declare-not-infer gaps. This is the **seed of item 4** (the unified
travel/START model).

## Principle
Declaration = **unambiguous SEMANTIC + ONE source.** It is **NOT** auto-deriving or guaranteeing the user's inputs.
- The user **OWNS values** (the safe-Z number, the bar Ø) — their judgment, and that's fine. [[dont-declare-away-user-responsibility]]
- The system declares the **SEMANTIC** (what a value MEANS) and reads it from **one source**, so the sim and the macro never
  disagree — and it stops **GUESSING** what the user already told it. [[declare-never-infer]]

Split every candidate: **SYSTEM gap** (inference / ambiguity → fix it) vs **USER value** (their judgment → give a clean control).

## A · safe-Z FRAME  (general — EVERY wizard with a safe-Z)
**Scope:** safe-Z lives in essentially every wizard (edge · corner · middle · rotary · …). So this is **NOT** a rotary add-on —
it's **ONE declared primitive (value + frame) that all wizards SHARE**, declared once, read by every consumer. Re-implementing
it per wizard is the anti-pattern; declare the concept once like the probe-surface block. [[probe-surface-block-generalises-probing]]
Rollout is **wizard-by-wizard**, each staying byte-identical on `relative` (same proof method as the probe-surface migration) —
and it pays down the existing per-wizard safe-Z duplication as it goes.
**Today:** the macro ALWAYS treats `#17` (safe-Z) as a RELATIVE drop. No way to declare otherwise.
**Model:**
- `safeZ.value` — **USER owns** (the number). Unchanged.
- `safeZ.frame` — **DECLARED** field, a per-field toggle:
  - `relative` — **DEFAULT** (status quo: a clearance distance above the surface — "stay 20 above whatever's there"). A legit,
    common want — NOT the bug. The bug was *always*-relative-with-no-choice.
  - `machine` — absolute machine Z (clear EVERYTHING at one known height — clamps, tall fixtures).
  - `wcs` — **future** (absolute in the work frame). The field ADMITS it; build the conversion only when someone needs it
    (rule-of-three on the *machinery*; declare-liberally on the *field*).
- **READ from one source** by BOTH the sim render and the emitted macro, so "machine 480" or "relative 20" means the same in both.

**UI:** a small frame toggle on every safe-Z field. [[prefer-gui-over-fields]] [[spatial-gui-form-vs-canvas]]
**Emit:** `relative` → the current `−#17` drop (byte-identical to today); `machine` → an absolute move to the declared machine Z.
**Round-trip:** the frame surfaces as a block field + emit + reverse-sync. [[wire-blockly-roundtrip-new-features]]

> **⚠ This is an EMIT declaration, not a sim-only one — it carries heavier rigor.** Unlike `opSimStarts` / the radiuscomp disc
> (sim-side only, never in the editor text — [[sim-declarations-sim-side-not-editor-text]]), the frame changes the real G-code →
> what the MACHINE does. So it MUST be a first-class **declared param + block field + round-trip**, and:
> - `relative` stays **byte-identical** to today's macro (prove via `stripAnnotations`) — zero regression.
> - `machine` must emit the **DDCS-correct absolute-machine move** — verify against the M350 dump (likely a G53 / machine-coordinate
>   move; confirm the Expert + V4.1 convention), NEVER invented. [[ddcs-ground-truth-reference]] The machine-Z height itself is a
>   machine fact (profile/eng), not pushed arbitrarily into the macro. [[machine-facts-vs-macro]]

## A.2 · safe-Z SOURCE  (controller register | custom)  — ❌ INVESTIGATED + DROPPED (t156)
**The radius-comp parallel does NOT transfer.** The scout (1b, `09cca90`) found the controllers register a safe-Z **NAME** but
NOT a usable **source**, and four ground-truth conflicts kill it:
1. **safe-Z is already DELIBERATELY Studio-side** — `controllerProfiles.js`: *"…SAFE Z … deliberately absent — they stay
   Studio-side."* (+ `PROBE-CONFIG-SOURCE.md`: safe-Z = user-convention). A controller-source overrides an existing decision.
2. **profile-inconsistent** — Expert cfg `#69` = "Z-axis safe height" ✓, but DM500 maps `#69` = "Thickness of tool sensor". Not the
   same register across profiles. [[controller-profiles]]
3. **frame ≠ G53** — the Expert 3D-probe dump's "Move to safe height" is `G90 G00 Z[#113]` (WORK-absolute, a LOCAL var, NOT `#69`);
   DM500 `#2049` is used in ARITHMETIC (`#3=#574−#2049`) → a RELATIVE lift. So "controller → `G53 Z#<register>`" is invented.
4. **never macro-referenced** — Expert macros use local `#113`, never `#69`. The register NAME is real; the USAGE isn't.

⇒ **The register NAME existing ≠ a usable source.** I (advisor) over-validated by grepping the dump for the name without checking
USAGE / the existing decision; the scout caught it before any code. [[ddcs-ground-truth-reference]] [[verify-real-symptom-not-just-test]]
**DECISION (human t156): DROP 1b.** safe-Z stays Studio-side (the user's value) + the FRAME (A, shipped) is the real enhancement.
*If the user later wants "set safe-Z once, don't re-enter" — that's a **Studio-side global default**, NOT a controller register.*

## B · rotary BAR  (rotary-specific — the sim READS, stops guessing)
**Today** (`web/viz/opSimStarts.js` `rotary_center`): the sim INFERS the bar — `R = min(stockY, stockZ)/2`, axis `= −R`
(a "top-at-0" convention). It reverse-engineers geometry from a bounding box.
**Model (shape blessed t160: 2A + top-at-0):**
- The rotary STOCK declares an **optional `stock.diameter`** (the true OD) — **a STOCK-EDITOR property** (2A). The sim, the collision,
  and the known wizard all **READ** it; **NO wizard-mutates-stock** (2B — the wizard persisting its typed Ø back to the stock —
  rejected: coupling + a params→stock path). One source: the stock owns its own geometry.
- `cylinderOf` + `opSimStarts` read `stock.diameter ?? min(cross)/2` — **declared-first, fallback to the box** → the DEFAULT
  (unset / bar=box) renders + collides IDENTICALLY to today (no regression); a bar ≠ box (Ø50 in 76×76 → R=25) makes sim + collision agree.
- `height-of-center` (axis Z): **keep TOP-AT-0** (axis `= −R`); the datum ("Z zero at centreline") stays **macro-only**. A datum-relative
  preview frame is the separate **machine-frame sim** concern, out of scope here. [[machine-frame-sim-spec]] [[personalised-sim-from-dump]]
- The KNOWN macro reads the declared Ø (pulled, as today). The FIT MEASURES (consumes none) — the sim renders the nominal
  (`stock.diameter ?? box`) so the FIT touches land on a real cylinder. [[custom-op-sim-intent-infer-vs-declare]]

## C · How this seeds item 4
Item 4 (TRAVEL-GUI / the unified travel/START model) is this move GENERALIZED: every *"where does the tool go / where is the
geometry"* — height-of-center, safe-Z plane, START pos, travel — a **declared reference**, not inferred from a box or a
convention. **safe-Z frame (A)** is the first reusable primitive; **the bar (B)** is the first "sim reads the declared geometry" case.

## Build increments  (release each)
1. **safe-Z frame — declare + read (A).** The `safeZ.frame` field (`relative` | `machine`) + emit honoring it + sim honoring it
   + the UI toggle + Blockly round-trip. `relative` MUST be byte-identical to today (no regression). `machine` = the new path.
   - **1a ✅ DONE (`fb6e3ab`, V10.43):** the frame param + emit helper + round-trip, FINAL retract/park, on the rotary. relative byte-identical, machine=G53.
   - **1b ❌ DROPPED (t156):** the controller-SOURCE — no usable register (see A.2). safe-Z stays Studio-side.
   - **1c (NEXT):** roll the FRAME out — a shared frame-toggle widget + adopt it across the remaining wizards' final-park (byte-identical each).
2. **rotary bar — sim reads, not infers (B).** Replace `R = min(sy,sz)/2` + `−R` with reads of the declared bar (Ø + derived
   height-of-center). Render unchanged for the square-stock default; correct for a bar ≠ box.
3. **(later)** inter-move machine-frame · the `wcs` frame value; generalize the declared-reference pattern → item 4 proper.

## Verify
- **A:** a probe op with `frame=relative` emits + sims EXACTLY as today (byte-identical via `stripAnnotations`); `frame=machine`
  retracts to the declared machine Z in BOTH emit + sim.
- **B:** the rotary sim renders the DECLARED bar; for Ø ≠ box the probe + the cylinder agree (no false through-stock).
- Full suite green; release each increment. [[release-version-often]]
