# Reminders / known issues to revisit

Running list of things noticed mid-work that we deliberately deferred. Newest on top.

---

## Project system — save macros durably (2026-06-15)
*Status: TODO.*

A "project" system to save generated macros/programs DURABLY (today the program is ephemeral — editor +
localStorage). Save the high-level STACK (ops + params — the single source of truth, so it re-posts to any
dialect and round-trips blocks↔editor), NOT just the emitted text. Needs: named projects, save / load / list /
rename / delete, persistence (localStorage first; later sync to the gateway / cloud storage — ties to
[[gateway-cloud-architecture]] BYO-storage). Consider: a project holds one or more macros/ops + metadata (name,
date, target post/profile, stock); exports `.nc` on demand. The op-container program (programModel stack) is the
thing to serialize. Pairs with the Gateway Send/Merge tabs (load a saved macro → send / merge).

## Audit LinuxCNC (rs274ngc) for features our EXISTING wizards don't surface (2026-06-15)
*Status: TODO. Scope: EXISTING wizards only — no new wizard categories.*

Go through LinuxCNC / rs274ngc capabilities and find ones our current wizards COULD expose but don't — limited
to features that map onto EXISTING wizards (probe, wcs, drill, pocket, slot, surfacing, text, circular, rotary,
alignment, ATC), not new wizard types. Candidates to check: probe variants (G38.2/.3/.4/.5 — toward/away,
error/no-error), G10 L2/L20 WCS set, G64 path-blend tolerance, canned drill cycles (G81/82/83/85), G41/42 cutter
comp, o-word sub/loop flow (ties to #1 oword), tool-length G43/G43.1, polar/rotary helpers. Source:
`bridge/controllers/linuxcnc/assets/linuxcnc-src/` (+ docs). For each: does it improve an existing wizard's
output on the rs274ngc post, and is it worth a field/option? Output = a short "add X to wizard Y" list.

## Gateway tab + cloud/service architecture (2026-06-15)
*Status: Gateway tab DONE; cloud direction decided in principle; OAuth + dual-client awaiting a user decision.*

Built the in-Studio GATEWAY tab (face of the bridge) — Studio-workflow sub-tabs **Status · Send · Merge ·
Tracking · Files · Jobs · Console** (`ui/gatewayPanel.js` + `ui/gateway/views/*`, ported from the fairy console
"for functions, adapted to our style"). Merge = a STUB (multi-tool job merge — combine single-tool programs into
one job w/ tool changes). The tab now ALWAYS opens (was chicken-and-egg: gated behind a download popover +
auto-kicked when no gateway answered, yet the Service picker that *connects* one lives inside it); uses the
normal `.tab` style (the LED is the only cue). Retired duplicate views (submit→send, queue+history→jobs).

Optional SERVICE flow (`ui/gateway/service.js` + a picker in the Console tab): local-first / autonomous by
default; optionally point at a service URL+token (sets `ddcs_api`/`ddcs_token` that makeClient reads); one-click
"use local gateway" (`http://127.0.0.1:8765`).

DECISIONS (memory [[gateway-cloud-architecture]]): goal = USER AUTONOMY, replace the dev's Worker (keep it now as
ONE optional service). Local-first prevents no function (local is the MORE capable mode; only remote needs a
service). The hosted page CAN use a local gateway like the exe — same-PC via `http://127.0.0.1` (mixed-content
exempt; the gateway already sends CORS); LAN-IP / remote need HTTPS or a tunnel. Local+cloud already coexist at
the DAEMON level (the R2 relay).

OPEN (need a user decision before building):
- **OAuth for cloud storage** → lives in the WORKER (`functions/api/`); provider backends (gdrive/dropbox) behind
  `bridge/bridge-app/fairy/backend/`. Pending: RELAY (cloud holds files) vs **BYO-storage** (user's Drive = the
  bucket; recommended). Then stub `/api/oauth/google/{start,callback}` + a `gdrive` backend + a "Connect cloud
  storage" row in Console.
- **Dual local+cloud at once** → pending; recommended "Auto local+cloud" (configure both URLs, prefer local for
  control, fall back to cloud, LED shows the active one). Today the UI is single-target.
- **Multi-tool merge** → implement the Merge stub.
- End state: two deployables (Studio desktop = UI + embedded gateway; Cloudflare = cloud `/api` + storage),
  remove the standalone fairy app.

## Post field-gating: grey, don't hide (#2, 2026-06-15)
*Status: first slice DONE (probe P/L/Q); ATC-off-grbl next.*
`ui/postGating.js` GREYS (disable + `.cap-off` opacity — NOT hide, so layout stays put) wizard fields whose
capability the active post lacks; the explanation is TOOLTIP-ONLY (set on the field, original title stashed/
restored). `probePort` gates the G31 P/L/Q fields (`*_port/_level/_q`, `circ/rc/rcl _q`). Next: `toolTable` to
gate ATC fields on grbl. Runs at init + on `ddcs:settings-changed`. Memory [[post-field-gating]].

## Op-form editing — DONE (2026-06-15), supersedes the rollout TODO in the op-containers section below
Editor-only (user: "don't edit form from block"). Hover an op in the editor → highlight + ✎ chip; right-click →
context menu Edit/Duplicate/Delete (shared `ui/opContextMenu.js`). A central `PARAM_FIELDS` map in
`wizardManager.js` seeds the form from `op.params` (single source of truth — "a snapshot is inference") for ALL
ops (drill has a custom `setForm` for pattern variants; `atc_length` is Settings-driven → not editable). Insert
rebuilds in place (`opStacks.replaceOp`, keeps id); `duplicateOp`/`deleteOp` back the menu. Pulsing accent glow
while editing an existing op. (The "view.setForm rollout" TODO further down is now COMPLETE.)

## #5 native V4.1/DM500 datum path — DEFERRED (2026-06-15)
The probe stacks hardcode the Expert WCS-register-write flow (`#578` active-WCS, `[805+[#72*5]]` base, read
trigger `#1925`, write `#[#70+off]`). V4.1/DM500 use a STRUCTURALLY different model (`G90 G92 <axis> <value>` =
declare a WORK coord at the probed point; Expert stores a MACHINE coord) — so it's NOT a mechanical atom-swap;
needs a `setdatum` macro-atom each dialect expands natively. User: "hardcoded WCS is fine for now" + "needs
[hardware] testing." The dialects already expose `proberead`/`setworkoffset`/`readActiveWcs` atoms for when done.

## Op-containers — keep the op record, gate the emit per post (IN PROGRESS)
*Started 2026-06-15. Status: emit core DONE; wiring is the focused next build.*

Goal (user): switching post should "replace the code with its caps" — a loaded op re-emits in full on a
capable post, or as a single marker comment on a post that can't run it (e.g. a probe/ATC macro on grbl —
no #vars), with the op ALWAYS kept in the stack. Plus: the op-container carries `opType`+`params`, so it
becomes the home for OP-FORM EDITING (select an op → seed its wizard form from `params` → re-run builder →
swap children) and REPLACES the geometry-reverse RECONCILERS.

Op-container shape: `{ id, type:'op', opType, label, requires:['vars'|'flow'…], params, children }`.

DONE: gating is PER LINE (more honest than hiding a whole op — "it might leave a lone move but that's macro
building"). The op-container is TRANSPARENT at emit (just emits its children, structure/record only); a final
`applyCapGating(T, dialect)` pass in `emitMapped` comments out the lines the active post can't run — on
`vars:false`/`flow:none` posts (grbl) any `#var`/flow line → `( gated: … )`; posts that run #vars+flow (DDCS/
V4.1/DM500/LinuxCNC/grblHAL) gate nothing (output unchanged). Verified: DDCS = 44 live #var lines; grbl = 0
uncommented #var lines (38 gated comments), op kept. Blocks view: `applyOpGating` puts a ⚠ on an op that has
gated lines (no greying — per-line gate is partial). The op-container itself is kept for record/group/edit.

DONE (commits b874cb3, 2a6d4c1):
1. ✅ Accumulation: `opStacks.commitActiveOp` + `buildActiveOpStack` wrap each op in an op-container; `requires`
   derived (assign/probe/proberead/readmachine/setworkoffset/tooloffset/machinemove → 'vars'; ifgoto/goto/label
   → 'flow'; cutting → []). `params` stored. `find()` recurses into containers so reconcilers still work.
2. ✅ Blockly round-trip: `bridge.js` defines an `op` GROUP block (LABEL field + DO mouth); `stackBridge.js`
   round-trips opType/requires/params via the block's serialized `data` + LABEL + DO children (no flatten).
   field_label_serializable confirmed in the vendored Blockly. ⚠ STILL NEEDS IN-BROWSER VERIFICATION (Blockly is
   browser-only; Node verified emit/accumulate/reconcile but not the actual Blocks-tab render/round-trip).
3. ✅ Reconcile: recursive `find()` locates inner blocks through containers (verified: 11 fields). Reading
   `params` DIRECTLY from the container (to retire the geometry-reverse RECONCILERS) is still TODO.

DONE (commit e940ec9) — op-form editing FROM THE EDITOR, params = single truth (NO snapshot — "a snapshot is
inference"):
4. ✅ Framework: hover an op in the editor → highlight its lines + a floating "✎ Edit" chip (ui/editorOpHover.js,
   via programModel opAtLine/linesForOp); click → wizardManager.openForEdit(opId) → seed the form from the op's
   `params` (view.setForm) → on insert opStacks.replaceOp rebuilds the op in place (same id). Verified in Node.
5. ✅ Glow: `.wiz-box.editing` accent glow when editing an existing op (vs new).

TODO (op-form editing rollout):
- `view.setForm(params)` exists only for CORNER so far (the proof). Add it to the other views (inverse of each
  view's `update()` reads) — until then their edit chip is 🔒/disabled (canEdit() gates it). Mechanical per-view.
- Browser-verify the hover/chip/glow + seeding (browser-only; Node verified the map + replaceOp).
- Once setForm covers a view, its geometry-reverse RECONCILER can retire (params are read direct).
- Op atoms shouldn't be hand-edited as loose blocks (params would desync) — edit via the wizard. Consider
  locking op-container children in Blockly.

Interim safety net already shipped: the post-selector capability LINT (⚠ #hdrPostWarn, ui/headerPost.js) warns
when a loaded program uses caps the active post lacks, so you don't silently get non-runnable G-code today.

## Queued UI/product tasks (2026-06-14, batched while porting probes)
*Status: TODO, not started.*

- **2D preview shows nothing** — the `.pp-2d` canvas in `createPreviewPanel` may not be rendering the route (toolpath2d). Investigate (likely a regression from the shared-panel work).
- **Add 4 standard tools to the tool library** — `settings.atc.tools[]` is empty by default (`SETTINGS_DEFAULTS.atc.tools`); seed 4 common tools (e.g. 6 mm + 3.175 mm flat endmills, 6 mm ball, 60° V-bit) so the library/Mill wizards aren't empty. Note existing localStorage keeps its (empty) tools — decide whether to seed when empty.
- **Remove the profile chip from generators** — `wizProfile` `<select>` in the shared wizard header (`index.html` line ~161, wired in `wizardManager.js` syncProfileChip / drag-exempt). Move the controller-profile choice OUT of every generator.
- **Add a profile selector to the app header** — surface the active controller profile globally in the header (pairs with the removal above). The post-processor + profile selectors live in Settings → Profile today.
- **Remove the theme selector from the header** — the `🎨 styleBtn` (`index.html` line ~106, `window.toggleStyle`). Theme also lives in Settings → Appearance.
- **Settings → Appearance: drop "Keyboard drawer height"** — `set_kbd_height` range is useless; remove the control (and its wiring).

---

## Wizard atom stacks hardcode Expert system vars (not native for V4.1 / DM500)
*Noted 2026-06-14. Status: TODO (user-requested: "all wizards native across the 3 DDCS dialects via atom blocks").*

The ported probe wizards (edge/middle/corner) emit NATIVE only for the *line forms* the dialect swaps — probe move (`dialect.probeMove`), IF operator words, dwell units, GOTO/label. But the STACK STRUCTURE hardcodes Expert magic vars: status `#1920/#1921/#1922`, trigger `#1925-1927`, active-WCS `#578`, base `#70=[805+[#72*5]]` (Expert stride-5), DRO `#882/#883`. Under V4.1/DM500 these are WRONG (DM500 has no status var and reads DRO `#864-866`, WCS stride differs, etc.). So a DM500-posted macro is a hybrid: DM500 probe form + Expert status/trigger/WCS vars.

There ARE dialect-aware atoms for exactly this — `probecheck`/`proberead`/`readmachine` (ops/measure.js → dialect.probeStatus/probeRead/readMachine), `setworkoffset` (ops/setworkoffset.js → dialect.setWorkOffset), `readActiveWcs`. **The fix is to rewrite each wizard's `<name>Stack` to use those native atoms instead of hardcoded `assign`/`ifgoto` with Expert numbers**, so emit is native for all 3 posts. Caveat the user noted: some ops (comm/HMI) have no V3/V4 equivalent — those dialects return `[]` for hmiPrompt/hmiToast, so handle the empty-form case gracefully (skip, don't emit a broken line). Verify each wizard × {expert, v41, dm500} traces clean.

## DM500 probe simulation — DONE (2026-06-14)
*Status: FIXED + verified (Expert + V4.1 + DM500 all trace clean). Unverified on real DM500 hardware (none owned).*

Two fixes landed:
1. **First-probe-zero / "only see the retract":** incremental probe macros traced from the origin (which sits on the stock's min faces) clamped their FIRST probe to zero length. Fix: the engine takes a `stockOffset` (operator start in stock coords, threaded from the wizard's `inferStart` via `traceToolpath({start})` + the live engine in `createPreviewPanel.play`) used ONLY for the probe-vs-stock ray test (route stays origin-relative, so the viz marker offset isn't double-counted); and a probe starting on the entry face (tmin≈0) now uses the far surface (tmax) so the move is visible.
2. **DM500 move-until-input:** the engine recognizes the `M101 … G01 … M102` cycle (`probe.nc`/`defprobe.nc`) — `M101` arms `_probeArmed`, the next `G01` is treated as a probe (clamps to the stock like G31), `M102` disarms. The condition evaluator already normalizes the WORD operators (EQ/NE/LT/GT). Verified: edge/middle/corner under all 3 posts give identical probe moves; a raw `M101/G01 Z-100/M102` touches the stock top.

---

## Start inferences need a unified owner (currently tracked ad hoc)
*Noted 2026-06-14. Status: IDEA / deferred.*

The inferred op/spindle START (where an op begins — used to offset the preview path + as the program's spindle start) is passed through too many disconnected channels:
- `inferStart()` per wizard (computes the hint),
- `host.__start` (wizard preview) → the shared panel's `getStart` opt → `GcodeViz3D.starts[]` (draggable marker),
- `window.__pendingSpindleStart` + `window.ddcsSetSpindleStart`/`ddcsGetSpindleStart` (carry the dragged start from the wizard preview into the Studio main preview on insert).

It works but it's brittle and easy to desync. A start should have ONE owner, set or dragged in the preview, and read consistently by every surface — rather than copied between globals and per-host fields.

**Crucially it must PERSIST across a round-trip (blocks ↔ editor ↔ Studio) and across manual code edits.** Today the start is an *ephemeral preview hint* — the moment the program is re-projected (round-trip) or hand-edited, the inferred/dragged start is gone, because it lives nowhere in the program data. It needs to be part of the program/op (e.g., a start marker the emit writes and the parser/engine preserves), so editing the code or going blocks→editor→blocks keeps the same start. Revisit when the preview-panel mounts settle (the panel centralizes the marker via `getStart`; extend that to a persisted, single source).

---

## Material-removal sim: solid stock the toolpath carves into
*Noted 2026-06-14. Status: IDEA / deferred.*

Make the preview stock a **solid** (mesh/voxel), and have the toolpath actually **remove material** as it runs — so you see the cut result, not just lines over a translucent box. Big 3D feature: a voxel grid (or CSG subtraction along the swept tool volume) carved as the engine steps. Pairs with stock-lives-in-the-preview (the stock is now a sim property in `createPreviewPanel`, `PREVIEW_STOCK`) and with the engine-driven trail (the same `setToolPosition` steps could drive the carve). Start simple (voxel occupancy under the tool radius along each feed move); upgrade to a proper swept-volume boolean later.

---

## Fills (and all wrapper ops): delimit the region in the projected G-code
*Noted 2026-06-14. Status: IDEA / deferred.*

A fill currently emits a START marker (`( concentric fill z=… )`) then N expanded passes with nothing closing them. Add a matching CLOSE marker (`( fill zigzag close )` or similar) and/or **indent** the expanded lines, so the high-level op's extent is visible — and foldable — in the editor. Same idea as using indentation as a UX bridge across the lossy high-level↔leaf boundary. Should apply to every wrapper kind (fill / array / stepdown / loop / cond), not just fills. Forward-only cosmetics: must stay round-trip-safe (the parser already strips trailing comments; any indentation must be ignored on decode).

---

## Decode is a STANDBY — never flatten a high-level op through its own emitted text
*Noted 2026-06-14. Status: TO VERIFY / FIX.*

**The model (correct, already true):** there is ONE projection, `emitMapped(stack)` (blocks/blockModel.js), shared by every surface — wizards (`generate()` → `emitMapped(stack).text`), the editor (`programModel.js`), and the Blocks tab. Same stack ⇒ identical G-code, by construction.

**Decode is the reverse and only a fallback.** `parseGcodeToStack` / `reconcileGcodeToStack` (blocks/gcodeToStack.js) turn *text into a stack*. They exist only for text that has **no stack behind it**: hand-written, pasted, or foreign G-code. They flatten everything to LEAF atoms — a Fill/Array/StepDown becomes its raw expanded moves (lossy: the parametric op's params can't be recovered from its 150 expanded lines).

**The bug we saw:** a wizard-generated program (high-level: ProgramStart + Array/StepDown/Fill) showed different comments/structure after a "round trip" to the Blocks tab — structure markers and cosmetic header comments changed. That happens **only if the pipeline re-derives the stack from the emitted text** instead of using the stack it already has. The wizard already preserves the real stack: `generate()` calls `recordOp('drill', params)` etc., so the Blocks tab can rebuild the *same* high-level stack from params. So decode should NOT be running in the wizard→editor→Blocks flow.

**Principle:** the in-memory high-level stack is the shared core. Decode only when there is genuinely no stack (foreign/hand-edited text). `reconcileGcodeToStack` already returns `null` for non-all-leaf stacks (good — manual edits don't flatten a high-level program). 

**To do:** confirm the wizard *insert/apply* path sets the high-level stack into `programModel` (setStack) rather than only inserting text and letting the editor-input reconcile re-derive it. If a fill/array still flattens on tab switch, that's where to fix it — propagate the recorded stack, don't decode the text.

**Confirmed repro (2026-06-14):** insert two wizard ops back-to-back, open Blocks → only the SECOND shows. `wizardManager.insert()` appends *text* to the editor and `recordOp()` keeps only the LAST op; `showBlocks` then does `setStack(buildActiveOpStack(), 'load')`, replacing the whole program with that one op. The editor has both; Blocks shows one.

**The M30 trap (same root cause):** each wizard emits a *complete framed program* (Program Start … M30). Two inserts concatenate to `…M30… <2nd program>` — an M30 mid-file. The engine trace AND a real DDCS controller STOP at the first M30, so the 2nd op never previews or runs (the Blocks parser still makes blocks for it, but they're dead). So even "show both" isn't right while inserts are whole programs.

**Real fix:** a program is ONE frame (single Program Start … M30) with multiple OPS between. Wizard insert should append the op's high-level blocks into the one program's stack (between Start and End), not concatenate a second framed program. Then: model accumulates ops, editor projects them, Blocks shows all, and there's one M30 at the end.

**RESOLVED (2026-06-14, commit b7e3967):** `opStacks.commitActiveOp()` does exactly this — first op brings the frame, later ops slot their BARE blocks before `progend`; `wizardManager.insert()` calls it; `showBlocks` renders the accumulated program (was replacing it with just the last op). Validated: drill+pocket → `[progstart, array, stepdown, progend]`. **Caveat:** only ops WITH a block builder (surfacing/pocket/slot/drill/wcs/edge/comm/middle) accumulate as blocks; ops without one (corner/alignment/ATC — not block-ported) still text-insert and do NOT accumulate, and can be lost if a builder-op is inserted after them (the text isn't in the stack). Fix = port those ops to builders (see the per-op gaps below).

**Related cosmetic (same theme):** equivalent ops emit different comments — ProgramStart op `( spindle on )` / `( spin-up dwell )` / `( clearance )` vs leaf `spindle`/`move` ops `( spindle CW )` (per-move `( cut )`/`( travel )` already removed). Align these so a decoded program is comment-identical to its high-level original.
