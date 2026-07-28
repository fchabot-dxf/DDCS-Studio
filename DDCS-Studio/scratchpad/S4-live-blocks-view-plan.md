# S4 — Live-Blocks View for CAM slots (design pass, t1143)

**Status:** DESIGN ONLY (no build). Grounded in the real Edit/Blocks-load code on `feat/ddcs-workspace`.
**Reframe (dispatch):** when **Editing a UNIVERSAL or SUBSTACK slot**, ALSO load its *reconstructed op* into the
**Blocks tab** as a LIVE view (the exact authoring surface the user builds programs in). **GENERATOR slots STAY
parametric in the modal** — never reconstruct a generator-at-defaults (lossy: a generator is a JS routine, not a block
stack; its defaults would throw away the tuned values).

---

## 1. What already exists (grounding — the machinery is ~90% built)

The whole S4 mechanism already ships as **`editWizardDef`** (the op-menu "🧩 Customize as blocks" action). S4 is
mostly *pointing that existing path at a CAM slot* instead of at a placed op.

```
  THE EXISTING op -> Blocks path  (blocks/devMode.js editWizardDef, opContextMenu.js "Customize as blocks")

  editWizardDef(opType):
    def   = listUserOps().find(opType)              # the registered user-op def  (getUserDef)
    maybeMaterializeCamTable(def) / ParamGroup(def) # opt-in: pendant fields -> cam_field / param_field blocks
    { template, recognized } = wrapRecognizedForFork(def)   # twin -> opunit-wrapped fork (keeps the standard LIVE)
    opC   = makeOp(opType, defaultParams(def), template)    # def template -> a real OP BLOCK (with children)
    showApp('blocks')                               # switch to the Blocks tab
    await (ddcsLoadBlockStack && __blkws ready)      # up to 80x50ms
    _editingWizard = opType ; refreshEditingChrome()# glow edge + "✎ Editing: <name>" chip
    ddcsLoadBlockStack([opC])                        # <-- LOADS the op into Blocks (REPLACES the program)
```

Key facts I verified against the code:

- **`ddcsLoadBlockStack(stack)`** replaces the Blocks program via `programModel.setStack(stack, origin)`. Every program
  change is snapshotted by **`saveStates`** (origin != 'refresh') — so a load **is already undo-able** (a partial
  fork-C safety net; there is NO confirm today).
- **Slot -> op reconstruction is a solved problem** and is *declared, not inferred*:
  - A **universal** slot's manifest is `{ type:'universal', opType, defV, values, exposed, baked }` — it **references
    the op def** (`getUserDef(opType)`); `manifestToAuthOp` re-hydrates from that def. So the "reconstructed op" is
    literally `makeOp(opType, defaultParams(getUserDef(opType)), template)` — the same call `editWizardDef` makes.
  - A **substack** slot walks `walkParts(def.children)` (subStackToSlot.js): `opunit` boundary -> standard sub-unit
    stays LIVE (its generator), loose atoms -> custom. The def carries the opunit blocks, so `makeOp` reconstructs it.
- **Round-trip (Blocks -> slot) is one-source by construction.** The slot points at the def by `opType`; a def edit
  bumps **`defV`** and **`defVStale(stamped, current)`** (the ONE declared rule, userOps.js:683) flags every stale
  consumer (programModel, subStackToSlot already use it). So *edit the op in Blocks -> Save (defV++) -> rebuild the slot
  from the new def* needs **no second converter** — `buildSlotFromOps` already reads `getUserDef`.
- The modal is **already a block view**: S4a made the modal render/write the op's `cam_field` block records
  ("the modal as a VIEW of the cam_field blocks"). So modal and Blocks are two views of **the same block source** —
  coexistence is natural, not a merge of two truths.

```
   camTypeOf(op)  ->  which surface?

   surfacing/corner/edge/slot/pocket(rect)/cpocket/drill/bore   =>  {camType}    GENERATOR  -> modal only (parametric)
   pocket(polygon)/anything non-generator                       =>  {universal}  UNIVERSAL  -> modal + BLOCKS view
   a custom op with an opunit boundary                           =>  substack     SUBSTACK   -> modal + BLOCKS view
```

---

## 2. The four forks — resolved (recommendation + the deciding gate)

### Fork C — destructive active-program load  ★ the one real safety item
Loading the slot into Blocks **replaces the user's current program**. Today `editWizardDef` already does this with no
confirm (only the `saveStates` undo net). For a CAM slot Edit the user is mid-authoring-a-program far more often, so a
silent wipe is a real foot-gun.

- **Recommendation:** a **dirty/non-empty guard** — before `ddcsLoadBlockStack`, if the program is non-empty AND dirty
  since its last save state, take a **`saveStates.snapshot('before-cam-edit')`** and show a confirm:
  *"Editing this slot opens it in Blocks and replaces the current program. Your program is saved to Undo."* One-click
  proceed; Cancel keeps the modal-only Edit.
- **Deciding gate:** G1 (safety/data-loss) of the decision sieve — a data-loss path must be guarded, no trade-off.
  Reuse `saveStates` (the snapshot already exists) — don't hand-roll a second stash. *This same guard should also back
  the existing `editWizardDef` (it has the identical latent wipe) — one shared guard, two callers.*

### Coexistence — modal (expose/bake pendant) vs Blocks (structural deep-edit)
Both are views of the same `cam_field`/op block source (S4a). They answer different questions: the **modal** = *which
params become #2600 knobs* (expose/bake, the pendant); **Blocks** = *the op's structure* (add/remove/re-order atoms).

- **Recommendation:** **Blocks is the deep-edit surface; the modal is the pendant.** On Editing a universal/substack
  slot, **close the modal and open Blocks** (one active surface — not two overlapping editors fighting for the same
  source). Expose/bake stays reachable **in Blocks** (the `cam_field` blocks already carry expose/bake — that is what
  S4a wired), so nothing is lost by leaving the modal. Generator slots keep the modal (they have no Blocks view).
- **Deciding gate:** G3 (one source, no drift) — two live editors over one source is a drift/confusion risk; pick one
  active surface. **Residue for the user:** do they want the modal to *stay open beside* Blocks as a quick pendant, or
  fully hand off to Blocks? (see §4 Q2.)

### Multi-op — a composed slot -> concat the reconstructed ops
A slot can hold several ops (`slot.ops` is an array). `editWizardDef` loads `[opC]` (one op); the generalization is
`ddcsLoadBlockStack([opC1, opC2, ...])` — reconstruct each manifest op and concat into one Blocks stack.

- **Recommendation:** reconstruct **each** universal/substack manifest via the same `makeOp` call and load the concat.
  This is the natural payoff of "one stack, many views" — the composed slot IS a program.
- **Known limit (already documented, not new):** the *slot BODY* framing-normalization (each part emits its own
  progstart..M30) is a separate slice — but that is about the emitted macro, **not** the Blocks view. Concatenating op
  BLOCKS in the canvas is unaffected (each op is just a block in the stack). `composeParts` (slotPack.js) already
  normalizes the executable body. **Mixed slots** (a generator op + a universal op in one slot): the generator part has
  no Blocks view — recommend loading only the universal/substack ops into Blocks and leaving generator parts to the
  modal (surface this if it occurs; see §4 Q3).
- **Deciding gate:** G4 (valid-by-construction) — reuse the one `makeOp` path per op; no new engine.

### Round-trip — edit in Blocks -> back to slot.ops on Update
Because the slot references the def by `opType`+`defV`, the round-trip is **already one-source**:

```
  edit op structure in Blocks  ->  Save (devMode)  ->  def stored, defV++  ->  slot manifest {opType, defV_old}
        ->  defVStale(defV_old, defV_new) = true  ->  buildSlotFromOps(slot) re-reads getUserDef  ->  slot rebuilt
```

- **Recommendation:** **do NOT add a Blocks->slot converter.** On "Update", (1) ensure the edited op def is saved
  (defV bumps), (2) call the existing `buildSlotFromOps(slot)` which already re-derives fields/body from `getUserDef`
  via `subStackToSlot`/`stackToSlot`. The manifest's `exposed`/`baked` overlay (the modal's pendant choices) is
  preserved; only structure flows from the def. Wire the slot's "Update" to this def-save + rebuild.
- **Deciding gate:** G2 (declare, never infer) + G3 (one source) — the def is the source; a parallel converter would
  duplicate it. **Open detail (surface):** when the structure changes, some stored `exposed`/`baked` keys may no longer
  exist — reconcile by intersecting the overlay with the new field set (drop orphans), and this is where `defVStale`
  should trigger a "fields changed" note in the slot (the mechanism already exists for programs).

---

## 3. Proposed slices (smallest-first, each independently verifiable)

1. **S4-1 — the shared destructive-load guard.** Extract the dirty/non-empty confirm + `saveStates.snapshot` and route
   BOTH `editWizardDef` and the new CAM-slot path through it. *Verify:* a dirty program + Edit -> confirm shown, snapshot
   taken, Undo restores; empty/clean program -> no prompt. (Fixes a latent `editWizardDef` wipe too — value on its own.)
2. **S4-2 — Edit a UNIVERSAL slot -> Blocks (single op).** In `editCamSlot`, if the slot is a single universal op,
   route to the `editWizardDef`-style load (`makeOp` + `ddcsLoadBlockStack([opC])` + editing chrome) instead of the
   modal. *Verify:* Edit a universal slot -> the exact op stack renders in Blocks; the modal does not also open.
3. **S4-3 — round-trip on Update.** Wire the Blocks "Update this slot" action: save def (defV++) -> `buildSlotFromOps`.
   *Verify:* edit a value/atom in Blocks -> Update -> re-open the slot -> the change persisted; emit reflects it.
4. **S4-4 — SUBSTACK slots.** Extend S4-2 to opunit-composed defs (the `walkParts` path) — the standard sub-unit stays
   a LIVE loop in the reconstructed op. *Verify:* a substack slot round-trips; the standard part stays parametric.
5. **S4-5 — multi-op concat.** Reconstruct + load `[opC1, opC2, ...]` for composed universal/substack slots; mixed
   (generator+universal) slots load only the block-able ops (note the rest). *Verify:* a 2-op composed slot loads both.

Generator slots are **untouched** throughout (modal stays their only surface).

---

## 4. Genuine forks to surface to the user (design decisions, not gate-decided)

- **Q1 (entry gesture):** does the slot's **✎ Edit** button itself route universal/substack -> Blocks (one Edit, smart
  target)? Or a **separate** "⧉ Edit in Blocks" action beside "✎ Edit" (modal expose/bake) so the user picks the depth?
  *(Recommend: one smart ✎ Edit -> Blocks for universal/substack, with expose/bake living in Blocks; simplest mental
  model. But a two-button split preserves a fast modal-only tweak.)*
- **Q2 (coexistence):** fully hand off to Blocks (recommended, one active surface), or keep the modal open **beside**
  Blocks as a live pendant?
- **Q3 (mixed slots):** for a slot mixing a generator op and a universal op — load only the universal into Blocks +
  keep the generator in the modal (recommended), or defer mixed slots entirely until §3 S4-5?

---

## 5. One-line takeaway
S4 is **not new machinery** — it is `editWizardDef` pointed at a CAM slot, plus **one** shared destructive-load guard
(G1), plus the *already one-source* def<->slot round-trip. The only genuine design choices are the entry gesture and how
much the modal lingers (Q1/Q2). Generators stay parametric — correct and lossless.
