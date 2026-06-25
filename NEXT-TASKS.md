# DDCS Studio — Next Tasks

Working backlog as of 2026-06-23. Shipped this session: **v10.27** (theme-consistent browser tabs, wizard-bar
grouping, theme chips, BLOCKS preview/G-code divider, editable 3D-probe dimensions diagram, Align→Transform) and
**v10.28** (Homing wizard + Settings→Hardware→Machine homing config). Suite green (228).

Also this session (uncut, on `main`): **central back-navigation** (`ui/navReturn.js`) — the Setup checklist now
round-trips: a "Set" deep-links into Settings / the Stock popover and **every** exit (Done/✕/Esc/scrim/click-outside)
walks back to the checklist. Stock "Set" also opens the 3D preview drawer in the editor region first. Gateway "Set"
now goes to the Settings → Controller → **Gateway tab** (where you point at the controller), not the live Console.

---

## Strategy — modal exits + state save-states (THE linked system)

Return paths, OK/Cancel, and save-states are one design seen from three sides — but **OK/Cancel is NOT universal.**
Modals come in two kinds, and each declares which it is:

- **Commit-only ("always OK")** — applies LIVE, every exit commits + returns. No Cancel, no snapshot (there's no
  prior state to roll back to). → **Stock** (drag a dim, the 3D updates; closing keeps it), and the live-preview
  popovers. A "Cancel" here would be fake. *This is already how Stock behaves — done.*
- **Transactional (OK/Cancel)** — snapshot on open; Cancel reverts to it, OK keeps it; both pop the return path.
  Only for modals where changes should NOT land until confirmed. None exist yet; add when a case actually needs it.

The three sides:
- **Return path** = where a modal sends you on exit (done: `navReturn`, token-matched, depth-1, leak-safe; all
  current exits walk it back — consistent across Settings + Stock).
- **OK / Cancel** = *how* you leave — but only transactional modals have a real Cancel. Commit-only modals = always OK.
- **Save-state** = the on-open snapshot that makes a transactional Cancel mean something. A per-modal snapshot IS a
  save-state, so **building the first transactional Cancel = building the first save-state.**

Deferred (not minimal): when a transactional modal is actually needed, snapshot its slice on open + restore on Cancel,
then generalise that same snapshot into document-level autosave (serializeProject ring in IndexedDB + recovery-on-load
— see the deferred save-states note below). `navReturn.activeReturn()` exposes the live return label if we ever want a
"‹ back to X" chip (skipped for now — big modals cover what's behind anyway, which is fine).

## In flight (on branches — review → merge)

- **Just-in-time "add a part" prompt** — branch `feat/wizard-prereq` (agent building).
  When a wizard needs hardware that isn't configured (probe wizards → a probe input; ATC wizards → an ATC), prompt
  **"Add it / Open anyway"** at the chokepoint (`wizardManager`/`openWiz`). Non-obligatory (Open anyway proceeds),
  but warns the wizard won't work well without it. → Review emitted UX + the detection, then merge.

## To build

- **System Hooks UI (Macros App)**: The Macros App was just reorganized into a dialect-dynamic, physical `SYSDISK/` tree layout, granulating the abstract "System Hooks" into actual target files (`sysstart.nc`, `T.nc`, `error.nc`, `probe.nc`).  *(Done this session)*
  - **`sysstart.nc` (Boot Hook)**: Relocate the Homing wizard UI from the Global Settings panel into the Macros `sysstart.nc` builder. Add an "Additional Boot G-code" raw text editor beneath the checkboxes so users can append `G54` restores or I/O pins after homing.
  - **Remaining Hook Builders**: Design and build dedicated UI configurators for **`T.nc` (Tool Change)**, **`error.nc` (Alarm Hook)**, and **`probe.nc` (Native Probing)**.
  - **Global Sync & Deploy (Gateway)**: Add a global "Load from Controller" and "Deploy to Controller" mechanism to the Macros app, leveraging the existing Gateway SMB connection. 
    - **Selective Syncing:** When triggered, present a checklist of available files (e.g., `[x] slib-m.nc`, `[ ] sysstart.nc`, `[x] key-N.nc`). This allows the user to surgically choose which files to pull (parse into the UI) or push (overwrite on the controller) without clobbering files they intentionally want to isolate.
    - **Conflict Resolution:** For files being pulled, implement a "Merge, Replace, or Cancel" safety notice if the imported data conflicts with macros already authored in Studio.
    - *Note: Retain the local per-file "Push" buttons in each panel for rapid, single-file testing.*

- **[x] Save-states / Undo-Redo module (COMPLETED).** A program-level history with block-edit awareness:
  - **[x] Snapshot granularity** — on **Insert** (coarse, per op commit/replace) **+ on each block edit** (granular;
    block edits commit immediately). **NOT on form edits** (verified in `wizardManager.js`: field listeners →
    `update()` → live preview only; the program/op commits only in `insert()`; `close()`/Esc/click-out just hides.
    So form edit + Cancel already discards — op.params is the untouched snapshot. No per-keystroke snapshots.)
  - **[x] Undo / Redo buttons** navigate the history (snapshot = the program block stack via
    `ddcsGetBlockProgram`/`ddcsLoadBlockStack`; an `applying` guard + the existing `muteChanges` avoid self-loops).
  - **[x] "Blocks edited" indication**: 
    - **Removed**: The `✦` symbol from the editor chip and the full-column vertical line.
    - **[x] "glow the exact edit" — DONE** (commits `078fba6` + `6d25832`). Both cases now precise:
      1. **Custom whole-line atom** (an M8, a Probe sub) → injected → whole-line glow (`.op-block-edited`). ✓
      2. **Editing the VALUE of a param from a block** → `opGlow.editedRangesForOp` char-diffs the leaf atom's
         clean-rebuild line vs its live line → glows just the changed **token** (`.word-edited` span via
         `editorOpHover.wrapRange`). ✓ Forward-only (BUILDERS(op.params) baseline, no inference — supersedes the
         RECONCILERS-baseline design sketched below). Tests: `tests/word-glow.spec.js`.
    - *(original design notes below — kept for context; the implemented approach diffs forward emits, not reverse-synced params.)*
    - **It's feasible, not "impossible".** `UIUtils.formatGCode` ([ui/uiUtils.js:106](DDCS-Studio/web/ui/uiUtils.js#L106))
      already wraps tokens in spans (M-codes, axis letters, comments, G31), so per-word highlighting is a CSS class on a
      token span. The hard part is knowing *which* token an edit produced — not the rendering.
    - **To build (the right design): a per-op DIFF, not line lists.** Glow exactly the changed **character ranges**
      in `#editor-highlight`, where the diff is **actual emit vs the form's BEST reconstruction** of the edited op:
      1. Reverse-sync the edited block stack back into params (`RECONCILERS[opType]`), then rebuild (`BUILDERS[opType]`)
         and emit → this baseline = "everything the form CAN express, applied."
      2. Diff that baseline against the actual block-edited emit.
      3. The residue (chars present in actual but not in the form's reconstruction) is **by definition exactly what the
         form cannot edit** → glow only that. **Critical adjustment: do NOT glow form-representable diffs.** A surfaced
         param changed in a block (e.g. Depth) gets absorbed into the baseline → baseline == actual → no glow. A custom
         atom (M8) or an UNSURFACED param value survives the diff → glows (whole line for the atom, single token/word
         for the value).
      - One mechanism, no block-vs-token branching, no line classification. The granularity (word vs line) is just how
        big the residual diff happens to be.
      - **Caveat — precision rides on reverse-sync coverage.** Missing/partial reconcilers (e.g. pocket's derived
        `stepover` is intentionally not reversed) leave those surfaced params unabsorbed → they over-glow. Fails SAFE
        (never hides a real divergence), but is the thing to watch; completeness of `RECONCILERS` = precision of the glow.
      - Implementation note: `RECONCILERS` return form-field ids → values; `BUILDERS` take a params object — needs the
        small field-id↔param-key adapter the wizards already use when reading the form.
      - This SUPERSEDES the `unsupportedLinesForOp` / `editedLinesForOp` idea — note `editorOpHover.js` currently
        *references* `window.ddcsEditedLinesForOp` but it's unimplemented in `opStacks.js`, so the glow silently falls
        back to the whole op (the "all 26 lines glow" behaviour).
      - **WHY (north star): never regenerate code in a way that silently erases block-only functions.** The glow, the
        chip, and the **Merge/Replace/Cancel** notice are the SAME diff at three surfaces: glow = WHERE the
        form-unrepresentable edits are; chip/`isOpBlockEdited` = WHETHER any exist; notice = the GATE that stops Replace
        from clobbering them. Glow ⟺ chip ⟺ notice must all mean exactly one thing: "the form would erase this."
      - **Consistency fix to land with it:** `isOpBlockEdited` currently diffs against the ORIGINAL `op.params`, so it
        also flags *surfaced* edits (false alarm — fires the notice when nothing is actually at risk). Re-base it on the
        SAME reverse-synced reconstruction as the glow, so all three agree: highlight/warn ⟺ Replace would lose something.
  - **[x] Merge / Replace / Cancel** notice at `insert()` when the op was block-edited: Merge (keep block stack) /
    Replace (rebuild from form via `replaceOp`/`commitActiveOp`) / Cancel (back to form, nothing inserted).
  - **[x] Module file `blocks/saveStates.js`**; hooks at `WizardManager.insert` + the `blocksApp` reproject; later:
    `serializeProject` ring in IndexedDB + recovery-on-load.

- **Homing wizard: propose Native vs G31 (granular) seek.** Two methods the wizard offers:
  - **Native (`M98 P501`):** minimal — axis + order; the controller does seek/back-off/direction/speed from its own
    Pr. Safest, opaque.
  - **G31 raw seek (granular):** emit the seek explicitly — `G91 G31 X.. F#[607+N] P#[1045+N*3] L#[1047+N*3]` +
    back-off (inverted `L[1-..]`) + slow re-seek + set `#[880+N]`/`#[1515+N]` — which is *exactly* how `slib-g.nc`
    implements the system subs (verified). This (a) exposes the granular settings (seek speed, back-off, re-seek,
    **direction**, port, level), (b) is transparent + engine-**simulatable** (real G31 moves, not the proxy), and
    (c) is the one place the home **direction** genuinely matters — so direction returns as a **G31-method-only
    field**, not a global one (consistent with dropping the global Dir). The existing 'seek' method (currently
    `M98 P503`) is the natural home — reframe it to emit raw G31. **DECISION: build the FULL faithful version (C)** —
    re-derive the controller's real seek from `slib-g.nc`: direction (`#612` → `±` distance), fast `G31 … K0 Q0`,
    **not-found → reverse + re-seek** (`IF #[1920+N]<=2`), a **7-read debounce** loop on the input (`#[1520+…]` vs
    threshold `#[1910+N]`), back-off-until-release (`G31 … L[1-level] Q1`), **halve-speed multi-pass**. The point is
    to allow *unconventional* uses. Mark it **UNVERIFIED — verify on hardware**; **native `M98 P501` stays the
    default + robust path**. Granular params (port/level/speed/dir/debounce/passes) live on the **block atoms**, NOT
    the wizard form (form stays a lean method-picker); a few may later surface in probing wizards, but most are
    block-level. Emit it **atom-decomposed** so the Blocks view
    exposes each step: because it's an editable sequence (not an opaque `M98` call), users can interleave
    `(MSG, …)` toasts / comm / M-codes between steps — but they do that **in the Blocks view or editor
    themselves**; NO dedicated insert-UI (the real `fndzero.nc` already uses `(MSG, …)`).

- **Insert-time "Merge or Replace" notice (general wizard↔blocks safety net).** When a wizard would insert/regenerate
  an op that's been hand-edited in blocks (a `blockEdited` flag, set by the Blocks change listener on the first edit
  the form can't represent), prompt: **Merge** (keep the block-edited stack — preserves block-only params + interleaved
  `(MSG,…)`/comm) vs **Replace** (regenerate fresh from the form, discarding block edits). User-in-control fix for the
  regenerate-clobber; makes block-editing safe for every wizard (and is what lets homing's interleaved comms survive).
  **APP-WIDE + CENTRALISED**: implement ONCE — one `blockEdited` flag set by the shared Blocks change listener, one
  Merge/Replace notice at the single shared insert/regenerate chokepoint (`WizardManager`/apply path) that every
  wizard already routes through. Covers ALL forms uniformly (homing, probing, pocket, ATC, …), never duplicated
  per-wizard. Binary version first (block-version vs form-version); field-level merge later. Foundational — build
  before/with C. **Three-way**: Merge / Replace / **Cancel** (back to the form, nothing inserted — lets the user
  bail and go edit the block directly instead).

- **Transactional snapshot = a real Cancel (the deferred save-state, now MOTIVATED).** Today no wizard is
  transactional: there's no snapshot-on-open, so a form **Cancel** doesn't reliably discard edits (the program only
  changes on Insert, but `op.values` can remember field edits — no clean revert). The Merge/Replace **Cancel** and
  the form **Cancel** want the SAME mechanism: snapshot the op/form state on open → restore it on any Cancel (form
  or notice). Build it once → both Cancels become real. Verify the exact current quirk first. This is the "first
  transactional Cancel = first save-state" from the strategy section, no longer deferred.

- **Dedicated Squaring wizard (gated on Y2) — built on the G31 seek.** Two complementary paths:
  - **Switch-based auto-square (primary):** decouple the dual-Y motors (`#988–#992` sync-toggle), G31-seek each to
    its OWN home switch independently (reusing the G31 granular seek above), then re-couple — the two switches
    define square. This is the real "auto-squaring" that was deferred ("squaring done manually"); the per-motor
    G31 seek is exactly the primitive it needs (native `M98 P501` can't seek the motors independently). So build
    the G31 method first — squaring composes on top of it.
  - **Probe-based verify/correct (optional):** probe a square reference at ≥2 X → measure the residual skew (ΔY
    across X) → report/apply a Y2 home-offset correction. Gantry square is MECHANICAL (no G68); correction = one
    motor's home offset (distinct from workpiece-rotation alignment, [[alignment-real-correction]]).
  Lives in the probe/setup group, unlocked when a Y2 is configured. OPEN: (a) where "Y2" lives — a dual-Y config on
  the Machine tab that's the unlock AND drives the homing slave-sync (`slaveFollows`); (b) does Studio WRITE the
  correction via the gateway (a deliberate setup write — allowed, unlike the read-only machine-facts rule) or just
  report it.

- **Head tab → just "normal forms for a spindle" (no Add gate).** Decided: a spindle/router is the *default*
  (every machine has one), so don't gate it behind "Add head" or a read-only sample — show the editable spindle
  form directly. (The read-only-sample + Add/Remove pattern is for genuinely optional subsystems like ATC, which
  already has it; Input/Output are always-present pin tables, not add/remove.)
  - **What the Head fields actually do to G-code today** (traced): only THREE are wired — **Default RPM** (seeds
    the `S` word when an op gives none), **Direction** (`M3`/`M4` on spindle-on), **Spin-up dwell** (dwell after
    spindle-on). They reach codegen because every cutting wizard view passes `spindle: s.spindle` into program
    framing (`makeStart` → progstart; `cuttingBlocks`).
  - **Dead fields** (stored, ZERO consumers outside the form): **Max RPM** (nothing clamps `S`), **Spin-down
    dwell** (no dwell before `M5`), **Head type** spindle/plasma/laser (no generator branches on it; plasma/laser
    are pure UI stubs). None of the Head settings drive any *simulation* — they only shape emitted text.
  - **Spindle attachments → link Head ↔ Input/Output.** The spindle's real-world peripherals are the natural
    content for this tab, and each is an I/O attachment (so Head should deep-link to the Input/Output pin rows it
    owns, like the probe/ATC tabs do):
    - **Coolant — M7/M8/M9.** Flood (M8) / mist (M7) on, M9 off → a coolant output pin + the M-codes in programs.
    - **Spindle water cooling.** A pump output, plus (ideally) a **flow-sensor input as an interlock** — refuse to
      spin / fault if no coolant flow. This is a genuine spindle attachment spanning Head + Input/Output.
    - **Spindle enable / at-speed / fault** — enable output, at-speed + fault inputs (the VFD handshake; ties into
      the VFD sim track below).
    Open: how much lives on the Head form vs. just linking out to Input/Output.

- **Separate sim tracks (each its own project — NOT Head-tab fields).** The things that would give the dead
  fields meaning are whole other simulations, none built:
  - **VFD / spindle sim** — real RPM ramp, spin-up/down timing actually simulated, direction, maybe load/torque.
    This is what would make Max RPM + Spin-down mean something.
  - **Plasma / laser heads** — own configs (pierce height/delay, THC, arc-OK; power %, PWM/M-code). What `head.type`
    is reserved for.
  - **Ballscrews + steps (motion fidelity)** — steps/mm, screw pitch, microstepping → positional resolution,
    backlash. A motion-accuracy layer independent of the spindle one.

- **SVG copy of the app icon** — vector recreation of `ddcs.ico` (dark rounded badge, gold "DDCS / CNC MACRO
  STUDIO" wordmark + glyph) for scalable in-app use. *Blocked on viewing the icon:* ICO is binary; view the
  preview PNG or extract a frame, then recreate as SVG (glow via an SVG filter).

## Awaiting input (can't proceed without it)

- **BLOCKS + GATEWAY tabs "show a little"** — need a specific: a thin line? a gap? a colour mismatch? and which
  theme? My probe + screenshots show those tabs structurally identical to STUDIO/MACROS (panel below, flush, feet
  render), so I can't target the defect blind.

## Follow-ups / deferred

- **G31 granular seek — BUILT (e82c363), VERIFY ON HARDWARE before relying on it.** Faithful re-derivation of
  `O501` (slib-g.nc) as transparent raw G31, opt-in method; native `M98 P501` stays default; code + emitted macro
  flagged UNVERIFIED. Inferred (NOT dump-confirmed) semantics to verify: `#[1920+N]` (read as >2 = hard-limit-struck
  guard), `#[1900+N]` (per-axis input-register base for the debounce pick), `#[1910+N]` (expected debounce level,
  distinct from the G31 `L` `#[1047+N*3]`), the 7-read / `<4`-majority debounce (assumes boolean input reads), and
  the `K`/`Q` G31 params (mirrored from O501, undocumented in the dump). Two deliberate divergences: the trailing
  `G53` return-to-reference (O501 ~251-298, needs `#622-626`/`#735`) is omitted; datum is zeroed (`#[880+N]=0`)
  rather than `#[735+N]`.

- **Investigate (later): other native subs that are G31/raw-decomposable.** Homing's `M98 P501/P503` are
  implemented as `G31` P/L seeks in `slib-g.nc` — so they can be re-emitted transparently (granular + simulatable +
  interleavable). Audit Studio's other native-sub usage (probing `M98 P502`, ATC, etc.) against `slib-g.nc` /
  `slib-m.nc` for subs that decompose the same way → candidates for the same Native-vs-decomposed wizard-method
  treatment as the homing G31 method.

- **Machine facts come from the controller eng — and don't change the macro** (decided 2026-06-24). Motor polarity,
  signed travel/soft-limits, and home direction are all controller **Pr values**, readable via pull-from-controller.
  They do NOT alter the emitted macro: G-code is logical-frame (the controller maps ± to motors) and native homing
  `M98 P501 X<N>` delegates direction/speed/port to the controller. So they're a **sim + profile** concern, not
  codegen — signed travel → real machine-frame render; home direction → correct homing *animation* + the non-native
  switch-seek variant. **Pull them, don't author them for the macro.** Layered model: (0) motor polarity [install
  Pr] → (1) signed travel [envelope] → (2) home direction [derived/read] → (3) homing routine + soft-limit enable
  [Controller → Homing]. The Homing-tab per-axis Dir field is a sim/switch-seek hint only — native ignores it.
  *(Done this session: the homing config moved from Hardware → Machine to a **Controller → Homing** tab.)*

- **Homing — Blockly reverse-sync.** `homingStack` round-trips structurally (renders as generic comment/assign/raw
  atoms) but has no dedicated semantic "home" block + reconciler. Add a first-class Homing block.
- **Probe sim dims → 3D render.** The editable 3D-probe dimensions persist + draw the 2D diagram, but aren't wired
  into the actual 3D probe render (it's on the shared tool-profile path used by the ATC rack — do it deliberately).
- **Profile export/import to a file.** So "Local" is a durable, portable save (matching how `.mjson` projects work)
  rather than only `localStorage`.
- **Setup checklist — real "configured" flag.** Envelope + stock currently show ⚠ by comparing to shipped defaults
  (300×300×120 / 100×80×20 boss), so a user legitimately running those exact values sees a false ⚠. A genuine
  "user touched this" flag would be more robust.
- **Repo-root scratch cleanup.** `ddcs-opt1..4.ico`, `opt1..4-preview.png`, `ddcs-icon-preview.png`,
  `options-sheet.png` are untracked icon experiments — remove once the icon is finalized.

## Onboarding — decided (no upfront nag)

The shape we converged on, for reference:
- **Defaults work out of the box** — 3-axis, spindle, a controller are sensible defaults; nothing to announce.
- **Just-in-time** — push the user to add a part exactly when a wizard needs it (the `feat/wizard-prereq` work).
- **On-demand** — the Setup checklist stays in the header quick-menu for a "where am I" overview.
- **First-run nudge = a momentary BUBBLE, not a modal** (revised 2026-06-23). On load (when a required item is unset
  and the user hasn't dismissed), a small 10-second dismissible bubble appears bottom-right ("Setup health check —
  N/M ready"); clicking it opens the full checklist. No blocking modal auto-open. `showSetupBubble` in
  ui/setupChecklist.js; skipped under automation. *Still open:* the checklist's ⚠ uses a defaults-heuristic, so a
  user legitimately running the exact default values sees a false ⚠ — a real "user touched this" flag is the proper
  fix (see Follow-ups).
