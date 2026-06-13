# Multi-Op Stacking — Design & Rationale

Status: **proposed** (not yet built). Some calls below are firm (forced by the
architecture); some are my recommendations and **not yet ratified** — those are tagged
`[CONTESTED]` and collected at the end.

> The Blocks tab has a working prototype + verified engine — see [BLOCKS-TAB.md](BLOCKS-TAB.md).
> This doc stays the architecture/rationale; the feature/implementation lives there.

Context: today Studio generates one operation at a time. There is no concept of a
multi-op job. This doc records the intended feature and *why* it's shaped the way it
is, so the decisions don't get re-litigated later.

---

## What machinists actually do (the demand)

Machinists assemble jobs from reusable, proven pieces — a bolt circle, a face pass, a
pocket, an engrave. On a real VMC this is routine. On DDCS it's increasingly the same:
the Expert / V4.1 support tool magazines, auto tool-length measurement, and `M6 Txx`,
and cheap ISO20/BT30 pneumatic-drawbar spindles mean **a large slice of DDCS users run
a real ATC**. So "drill → chamfer → pocket → engrave, four tools, one program" is a
normal thing to want.

But the install base is **split**: ATC users *and* manual-touchoff users, often the
same controller model with a different spindle. So stacking can't assume one or the
other — the seam between two ops has to be emitted per the user's machine config.

## The product wedge

Not "let users paste programs end-to-end" — a text editor already does that, and it's a
footgun. The value is **handling the seams the hand-stacker gets wrong**:

- tool change → automatic (`M6 Txx` + length offset) **or** manual pause (`M0`/`M5` +
  re-touchoff), depending on the machine profile;
- forced safe-Z retract between ops (the classic crash point);
- coherent WCS / Z-zero and tool-length offset carried across the stack.

Get that right and stacking stops being the risky thing experienced users avoid and
becomes the thing that makes Studio safe.

---

## Mental models behind the design

Three reference tools, each contributing a different layer:

- **Grasshopper → the truth-engine.** The definition (graph) is truth, the baked
  geometry is disposable output; change an upstream value and everything downstream
  recomputes live. That *is* this design: params are truth, code/viz are projections.
  The correspondence runs all the way down — **detach-to-raw is literally "bake."**
- **Tinkercad Codeblocks → the Blocks tab's UX.** A vertical stack of command blocks,
  each with input fields, executed top-to-bottom with a step-by-step animated build.
  This is the right model for the stacked/parametric authoring tab (see below). Crucial
  fix: regular Tinkercad's drag-shapes workplane is **order-independent**, which breaks
  for milling; Codeblocks is **inherently ordered**, and sequential execution *is* the
  cut order. The paradigm fits because machining is sequential.
- **Tinkercad (workplane) → optional spatial direct-manipulation.** Drag features onto
  the stock, handles = params. Not the primary surface, but composes as an optional
  draggable preview linked to the blocks (drag a feature → edits the block's X/Y).

**Keep the stack LINEAR — don't build a node graph.** A job runs in sequence on one
spindle; it's linear *by physics*. (The only "non-linear" move is reorder-by-tool to
cut tool changes — an optimization on a linear list, not a branch.)

---

## Core principle: op records are the source of truth

**The op param object is truth. G-code is a one-way projection. Never invert it.**

`params → G-code` is many-to-one and dialect-flavored. Re-deriving tool, WCS,
entry/exit Z, and cycle intent *from* motion lines (which may be hand-edited, commented,
or full of DDCS quirks) is not just lossy — it's **destructive**: a bad inference emits
wrong *motion* on a machine with a spinning tool. The blast radius is a crash. Same
reason Fusion keeps its operation tree and treats the posted `.nc` as disposable.

> Rule: nothing ever parses emitted G-code back into op params.

### Why multi-op *specifically* needs the params kept

In single-op an op is **terminal** — `params → gcode → done`. The params are disposable
the instant you emit. In multi-op an op is a **member of a sequence**, and four things
start consuming its params:

1. **Seams** — the transition between op N and N+1 (tool change, safe-Z retract) is
   computed by comparing the two ops' params. *Cannot* be computed from the G-code text.
2. **State carry** — the emit is a fold threading machine state (tool in spindle, WCS,
   last safe Z) through the stack; each op reads it on entry, updates it on exit.
3. **Re-emit on any change** — the whole-job G-code is *derived*; reorder / change a
   depth / swap a tool regenerates everything downstream via `params → gcode`.
4. **Editing** — a stacked op is still editable; the editor edits params, so they must
   exist.

The only way to stack *without* keeping params is to recover them from emitted G-code —
the banned, crash-risk inference. Keeping params is what lets multi-op exist at all.

---

## The op model

- **Op record** = `{ type, params, toolRef, wcs, entryZ, exitZ }`. Editors edit *this*
  and emit G-code from it — never the reverse.
- **Tool is a reference, not a copy** — ops point into a tool table, which resolves
  against the controller profile (Expert / V4.1 / V3). ATC-vs-manual and length-offset
  behavior lives at *that* layer, not duplicated per op.
- **Job** = ordered list of op records + carried machine state.
- **Emit is a fold over the list** that returns **`lines + a line→source map`** (not
  just a string). Each op emits its body *plus the seam*; each line is tagged with what
  produced it (op id / seam / job header). The map powers the code view (below).

---

## Declared vs. inferred — the real axis (manual ≠ raw)

Earlier framing split ops into "param (interactive)" vs "raw (opaque, dead)." That was
too binary. **Manual code is not the same as raw code.** The real axis is **declared
structure vs. inferred structure**, and hand-authored code can carry *declared*
structure:

- **Banned (inference):** take finished opaque code, *guess* what its values mean, drive
  motion from the guess.
- **Fine (declaration):** code that *declares its own handles* — named variables,
  template tokens, marked regions — and the UI binds to those. Structure is asserted by
  the author, present in the source, never recovered. No guessing, full interactivity.

So interactivity comes from **declared** structure, never **inferred** structure.
"Raw/opaque" is just the **zero-declaration floor** of a gradient:

- **Full param** — all structure declared via form/blocks, code 100% projected.
- **Templated / variable manual** — hand-written code with declared parameters (tokens,
  or controller `#` variables); UI binds to them. DDCS's own `#` variables are a perfect
  native declaration mechanism (`Set X to 50` ≈ `#100 = 50`).
- **Preset + manual override** — parametric frame with declared injection slots; custom
  code lives in the slots, frame stays live.
- **Fully raw** — opaque text + envelope. The floor, not the only manual option.

**Region ownership is the cost.** When the frame regenerates, it must not clobber the
user's hand edits. Clean rule: a hand-edit stays interactive *if it can be expressed as
a declared override*; an edit that can't is the one that drops that region to opaque.
detach-to-raw is therefore **not the only way to go manual** — you can go manual and
stay live; only the genuinely free-hand bits go dark.

### Raw / pasted ops

Don't parse pasted G-code and don't block it. Make it a `raw` op: opaque body + a **thin
declared envelope** `{ toolRef, entryZ, exitZ, wcs }` the *user asserts*. Because the
stacker only ever needs the **envelope**, param ops and raw ops present the same
interface — **one stacker serves the parametric user and the manualist, no forked
codepath.** Envelope assists may *read* a body to *suggest* envelope values, but only as
a proposal the user confirms (suggest, never silently infer).

---

## The three tabs are overlapping representations (not a capability ladder)

The authoring surfaces are the **same engine in different tabs** — a tab is a lens over
the one reactive store. An earlier draft called this a strict "expressiveness ladder
(form ⊂ blocks ⊂ manual)" where forms couldn't hold expressions. **That was wrong:**
Fusion-class forms support variables and expressions in fields routinely (`grandeur
coté/4 − épaisseur/2`, named user parameters) — it is *not* a blocker, and expressions
are *not* the line between forms and blocks. The three tabs have **largely overlapping
parametric capability**; they differ in *what they make primary* and *how approachable*
they are:

| Tab | Primary artifact | Parametric capability | Native-only zone |
| --- | ---------------- | --------------------- | ---------------- |
| **STUDIO** (form) | the op's parameters (property sheet) | variables, **expressions**, arrays as pattern-features | — |
| **Blocks** (Codeblocks) | the procedure (a visible script) | same, **+ visible/arbitrary control flow** (loops, nesting, exposed index) | arbitrary control flow |
| **Manual** (code) | the G-code text | declared handles; raw text | raw free-hand text |

It's not a subset chain. All three do variables, expressions, and standard arrays. The
Blocks tab "looks more capable" than STUDIO not because forms lack expressions, but
because blocks make the **procedure and its control flow the visible, manipulable
object** — the loop is a block you grab, not a pattern dialog buried in a tree. That's a
**representation/altitude** difference, not a capability ceiling.

### What this means for moving between tabs

- **The job (op stack) and the params transport** — one document, and for the common
  parametric cases (scalars, expressions, variables, a standard array) the tabs are
  **interchangeable — flip freely.**
- **Two narrow zones are genuinely native to one tab** (everything else round-trips):
  1. **Raw free-hand text → manual-native.** Forced by no-inference: showing it
     parametrically in a form/blocks tab would mean parsing G-code back into params.
  2. **Arbitrary/visible control flow → blocks-native.** A form represents the *common*
     single-array case as a pattern-feature, but not arbitrary nested loops / an exposed
     index. Demoting such an op to a form means flattening it to a fixed feature or
     marking it "edit in Blocks."
- **A tab still *shows* foreign ops as opaque, reorderable placeholders** — seams,
  ordering, and in-process stock depend on them being present; hide them and the
  stock/seam viz would lie.

This corrects both the over-clean "synchronized lenses, flip freely" *and* the
over-strict "expressiveness ladder": the truth is **mostly interchangeable, with two
narrow native zones.**

---

## The Blocks tab (Codeblocks-for-G-code)

A vertical stack of operation blocks with inline fields, executed in sequence to project
the G-code and **animate the in-process stock carve**. The reference paradigm (a
Tinkercad Codeblocks *modeling* program — note: it builds a solid, it is **not** a CNC
job, it just shows the paradigm):

```
Set grandeur coté = 50                          ← input variable
Set épaisseur   = 4                             ← input variable
Set longueur slot = grandeur coté/4 − épaisseur/2   ← DERIVED variable (a formula)
Add box  W=grandeur coté  L=grandeur coté  H=épaisseur     ← the plate
Add box  W=longueur slot  L=épaisseur  H=épaisseur         ← one slot
Move  X = grandeur coté/2 − longueur slot/2               ← position it
Count with i from 1 to 4:                                  ← array / loop
    Copy ; Rotate 90·i around Z                            ←   wraps a sub-stack
Create Group
```

Change `grandeur coté` and the plate, the derived slot length, *and* all four slot
positions update together — "interactive parametric," live. What it proves about the
design:

- **Input vs. derived params is real and visible** — `longueur slot` is `Set … to
  <formula>`, not a typed number. Serialize the inputs; compute the rest.
- **Array = a container block wrapping ops**, driven by a loop variable (`90·i`) — the
  "array-as-modifier," confirmed.
- **Fields can be expressions** referencing shared variables — the parametric backbone.
  Needs a small **parameters panel** (`Set` blocks) plus expressions in any op field.

**What the Blocks tab needs:** variables + expressions, op blocks, container/array
blocks, fields-on-blocks (with **progressive disclosure** — essentials inline, advanced
one expand away, since a milling op has more fields than a Codeblocks shape), and a live
**in-process-stock playback** (press play, watch each op carve in order, current block
highlighted — seam/safety made visible).

**The one honest CNC adaptation:** Codeblocks builds *solids* (CSG); these blocks emit
*toolpaths* (subtractive + machine moves). The control flow — variables, expressions,
`Count` loops, transforms, group — transfers ~1:1. The **leaf blocks change meaning**:
"Add box" becomes "machine this feature," each op gains a tool/depth/feeds layer, and a
full-stock box reads as **stock**, not an op. Read the example as CNC and it already is
one: *"stock 50×50×4; cut one through-slot (derived length); array it 4× at 90°."*

---

## The editor: live parametric tracking

One reactive store (ordered op records + job state); every panel is `f(params, jobState)`
recomputed on change. Dynamic tracking is just making the projection continuous.

- **Cross-op reactivity is the new thing** — editing op 2 can change the seam at 2→3,
  the carried machine state op 3+ inherit, and the emitted code downstream. A field in
  op 3's panel can change because you edited op 2.
- **Split input vs derived, hard** — inputs = edited/serialized/truth; derived (passes,
  cycle time, inherited entry-Z, seams) = recomputed, shown read-only. Serialize inputs,
  recompute the rest.
- **You don't reopen the wizard** `[CONTESTED]` — wizard and inline inspector are both
  views over the op record. Scalar tweaks → inline; structural changes (type, geometry)
  → wizard. Requires the wizard to **bind to the op record directly**, not keep private
  form state.
- **Don't over-build the recompute** — a job is 2–8 ops; recompute the whole projection
  on change (milliseconds). Fine-grained invalidation is premature optimization.

---

## The code view

Hangs entirely off the emit fold returning `lines + line→source map`.

- **Read-only provenance mirror for param ops** — editing it directly is the banned
  inference; you edit params, it re-projects. Only a **raw** op's body is editable text.
- **detach-to-raw** = the escape hatch ("bake") for hand-tweaking a param op's output.
- **Distinguish ops, cheapest first:** (1) **comment banners in the file** —
  `(--- OP 2: Pocket Ø6, G54 ---)` — trivial, DDCS-native, *survives export*;
  (2) **shared per-op color** across code gutter / 2D canvas / 3D viz / stack, from the
  Fusion-coloured legend; (3) **linked bidirectional selection** (free once the map
  exists); (4) **folding**.
- **Seams visually distinct** — they're the crash-relevant joins; drawing the eye to
  them *is* the safety value made visible.

---

## The Manual tab

Code-forward lens + palette + suggestions. Per "declared vs inferred" above, manual code
is **interactive when it declares handles** (variables / tokens / regions), not just raw
text. Palette primitives — keyhole slot, array (as a modifier), profile/contour (mind
DDCS cutter-comp quirks).

- **Parametric-until-you-touch-the-text** `[CONTESTED]` — palette ops are live
  parametric by default; first hand-edit auto-detaches that op to raw (one-time confirm).
- **Live lint/validation as the headline assist** `[CONTESTED]` — catch rapid-into-stock,
  feed-before-spindle-on, missing/unbalanced M-codes, a Z0 rapid, *before it runs*.
  Snippets/autocomplete are table stakes.

---

## Workflow: disposable session, not a project system `[CONTESTED]`

A project system (save/load/browse named jobs) is **not** required for multi-op, and
building it now is speculative. Source-of-truth and persistence are orthogonal — op
records must live during the session, but needn't be saved/browsed/reopened.

**Natural flow:** stack ops → emit → push to DDCS slot (or download `.nc`) → walk away.

**Persists (machine-level):** controller profile (already, in `bridge/controllers/`),
**tool library** (the one to get right — re-entering tools every session is the friction
that would make disposable feel cheap). **Disposable (job-level):** the op stack.

Two cheap safety touches: **autosave to `localStorage`** (crash insurance, zero UI), and
optional **Export/Import session** as JSON of the *op records* (serializes params, not
G-code — consistent with no-inference). Disposable session = project system minus the
management UI; grow into a real project layer only if demand appears.

---

## The refactor barrier (bounded)

Wizards move from `form → gcode string` to `form → op record → gcode`, plus:
- a **job layer** (ordered list + fold emitter returning `lines + line→source map`);
- a **reactive store** the panels subscribe to;
- the wizard **binding to the op record directly**.

Everything else — blocks tab, manual tab, code view, linked selection, lint — is
downstream of that one shape change.

---

## Open questions

1. **Does a persistent tool library already exist, or is it part of the lift?** The only
   place "disposable" has a genuine seam.
2. **Does the emitter return a flat string, or could it return per-op segments with
   source tags?** The one change the code view (and blocks tab) hang off of.
3. **Are the current per-op wizards already reactive**, or do they generate on submit?

## Contested calls (my recommendations — not yet ratified)

These are *opinions*, not architecture-forced. Flagged so they don't pose as settled:

- **Disposable session, no project system.** Pushed hard; user floated wanting "project"
  and hasn't agreed to disposable-only.
- **Parametric-until-you-touch-the-text** auto-detach — my synthesis of the manual/blocks
  idea, not endorsed.
- **Linear stack, no node graph** — likely right, but the user invoked Grasshopper;
  confirm they don't want more graph.
- **"Don't reopen the wizard" / inline-inspector primacy** — user said reopen "maybe."
- **Lint as the headline manual assist** — my emphasis.

> Architecture-forced (NOT contested): params-as-truth, no inference from G-code,
> multi-op needs params kept. Two narrow zones are native to one tab (raw hand-text →
> manual; arbitrary control flow → blocks); **otherwise the tabs are interchangeable —
> forms do expressions fine, so flip freely for the common parametric cases.**
