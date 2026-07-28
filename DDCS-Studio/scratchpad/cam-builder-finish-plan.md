# CAM Builder — Completion Plan (v1 → fully-fledged)
Branch `feat/cam-builder`. Read-only architecture pass (advisor t1048). Companion to `cam-builder-plan.md` + `cam-builder-s1-proposal.md`.

## ✅ RULINGS (advisor t1048 — decided before the slices dispatch)
- **F1a = SEED ALL AT ONCE (user t1048).** Opening Build-CAM-slot on a program imports ALL CAM-able ops in program order, each its own table section, with per-op remove + reorder (reuse the ▲▼ op-card controls). Matches "import a whole program → one slot." (F1b = program order + reuse reorder.)
- **⚠ REMOVE the manual "Seed from program op" dropdown (user t1048).** The user finds re-selecting an INSERTED op from a dropdown not useful/redundant. Seeding happens ONLY two ways: (a) the **op-card door** — right-click the op you made → Build CAM slot (direct); (b) **auto-import** ALL CAM-able ops when the builder opens without a specific op (the "seed all at once"). NO in-modal dropdown of inserted ops. "Add more" = a LIBRARY/CATALOG picker of op TYPES (the existing `addOpClusterHtml` compose-from-scratch cluster — a real pick), NOT a re-select of program ops. This also SUBSUMES the S-B empty-state dead-end (there is no greyed inserted-op dropdown to dead-end on; a program with no CAM-able ops just shows the supported-ops message).
- **F4a = synthesize probe stock+start LOCALLY** in the two CAM preview builders (no global `settings.stock` mutation). F4b = derive the box from `maxProbe`/`travel`, fall back to fixed 120×120×25.
- **F2a = snapshot the 2D top-view canvas** (`.pp-2d`; WebGL `toDataURL` needs `preserveDrawingBuffer` which the app doesn't set). F2b = default `autoIconBmp(name, firstOp.method)`, snapshot/draw overrides.
- **F5a = replace the picker when 0 CAM-able, inline "N of M not CAM-able" note when some; F5b = surface per-op reasons** (the strings already exist).
- **F3b = block Build on hard errors (min>max / empty required), warn on soft (def out of range).**
- Slice order stands: **S-A probe-fix → S-B empty-state → S-C multi-op(+group-by-op) → S-D validation/hints → S-E icon.** All AFTER the twin-recognition FIX #1 lands.

## Dependency (handled separately — do NOT plan)
The **data-op-twin recognition + seeding** fix (real programs use `user_*_data` twins that `camTypeOf` doesn't recognize) is in flight with the worker (FIX #1, t1049). Assume it lands: `camTypeOf`/`seedFromOp` (`opCamMap.js:98,134`) will resolve twin ops. Slices C (multi-op) and E (empty-state) touch seeding and inherit it — noted inline.

---

## Gap 4 — PROBE-PREVIEW fix  *(diagnosed first; it gates icon-snapshot and is the smallest ship)*

**Ground.** The CAM previews call the panel bare:
- `cbmSimulate` — `createPreviewPanel(host, { getGcode, createVarStore })` (`macrosApp.js:1248`).
- `simulateSlot` — same, `macrosApp.js:1363`.

The wizard preview instead supplies op context: `createPreviewPanel(host, { getGcode, getStart, getStartHints, getStock, getTool, … })` (`wizardManager.js:497-518`, fed by `preview3D(gcode, cont, start, startHints, simStock, tool)` L484).

Inside the panel:
- `previewStock()` = `opts.getStock?.() || stockForViz()` (`createPreviewPanel.js:155`); `stockForViz()` returns null unless global `settings.stock.show` (L58).
- `getStartPos()` = `curStart || opts.getStart?.() || viz.starts[0] || null` (L540).
- A probe macro is **incremental** (`G91`, `cornerSlot` `probeToSlot.js:156`) → `curAnchor` start-relative (L665-671). Probe produces **no carve** → "no cuts → plain stock box, build NOTHING" (L243) and `setSimMode('probe')` = **translucent** stock (L728).

**Root cause (the code even warns about it).** With no `getStart` and no `getStock`, the incremental probe traces **from the origin — which sits on the would-be stock face — and clamps its first probe to zero** (verbatim the scenario at `createPreviewPanel.js:631-632`). Result: path collapses to ~zero extent, no stock box, translucent probe mode over a black canvas → empty/black. Pocket/mill emit **absolute** cutting paths (`millToSlot.js`) that self-frame the 2D grid + toolpath regardless of stock → they "look fine."

**Reuse-map.** Nothing new in the engine — the `getStock`/`getStart` opts hooks already exist and are honored (L155, L540). `simulateSlot` already detects the probe (`isProbe = /\bG31\b/.test(macro)`, L1349) and even prints a Stock hint (L1350).

**Concrete change.** In `cbmSimulate` and `simulateSlot`, when `isProbe`, pass:
- `getStock: () => DEFAULT_PROBE_STOCK` — a synthetic top-datum box (e.g. 120×120×25) so the probe has a surface to clamp to and a box to draw;
- `getStart: () => ({ x: -offset, y: -offset, z: +clearance })` — start above/beside the datum so the incremental probe travels toward the stock instead of from zero.
This mirrors exactly what `preview3D` feeds. Non-probe slots keep passing neither (byte-identical to today).

**Forks.**
- **F4a [RECOMMEND A]** — synthesize the default probe stock+start locally in the two CAM preview builders. Cheapest, self-contained, no global mutation. *(B)* auto-enable the global `settings.stock` — broader, mutates shared state, leaks into every panel. *(C)* add a viz "datum marker" primitive — engine work out of proportion.
- **F4b** — default stock size: a fixed 120×120×25 vs derive from the slot's `maxProbe`/`travel` field defaults so the box scales with the macro. Recommend derive (a probe with `maxProbe=100` needs a box it can actually reach), fall back to fixed when fields are baked away.

---

## Gap 5 — EMPTY-STATE

**Ground.** `mountAuthoringSurface` builds the seed picker (`macrosApp.js:1150-1155`). It handles the **zero-ops** case ("No CAM-able ops … add a pocket / probe / drill op first", L1155). It does **not** handle **ops-present-but-none-CAM-able**: each unsupported op renders as `<option disabled>… — not CAM-able</option>` (L1152) → a dropdown of greyed rows behind a "— pick an op —" placeholder = a silent dead-end. The op-card door (`seedLocked`) on an unsupported op just `dlgNotice`s and leaves an empty table (`cbmSeedFromOp` L1227).

**Reuse-map.** `SUPPORTED_OPTYPES` + `OP_LABEL` (`opCamMap.js:28`, `macrosApp.js:1003`) already name what's supported. `seedFromOp(op).unsupported` (L1152, computed per option) already yields an **actionable reason string** per op.

**Concrete change.** When `_cbmOps.length > 0` but every `seedFromOp` is `unsupported`, replace the picker with an empty-state panel: (1) a one-line "CAM Builder supports: Pocket, Surface, Probe corner/edge, Slot, Drill, Probe centre." from `OP_LABEL`; (2) a short list of the program's present ops with their `unsupported` reason. Keep the existing zero-ops hint. When *some* are CAM-able, show the picker as today plus a small "N of M ops aren't CAM-able" note.

**Forks.**
- **F5a [RECOMMEND]** — replace the picker when 0 CAM-able; inline banner when some. *(alt)* always a banner above the picker (less disruptive, but leaves the dead dropdown).
- **F5b** — surface per-op reasons (recommend yes; the strings already exist and are actionable) vs a generic message.
- **Dependency note:** the twin-fix shrinks this set (many `user_*_data` twins become supported), but the empty-state is still needed for genuinely-unsupported programs (contour-only, polygon pockets).

---

## Gap 1 — MULTI-OP slots  *(the core "fully-fledged" gain)*

**Ground — the slot layer is already multi-op.** `buildSlotFromOps(slot)` loops `slot.ops[]`, allocates params **around** siblings, tags `f._op = oi`, concatenates bodies with `\n\n`, joins names with ` + ` (`macrosApp.js:1038-1060`). The per-slot editor already ships a full multi-op UI: op cards with reorder ▲▼ / duplicate ⧉ / delete ✕ / type+variant selects (`opCardsHtml` L1085), and an "＋ Add op" generator cluster (`addOpClusterHtml` L1105, `addop` handler L1399). So composition, param-packing, and card editing **exist and work**.

**The gap is the NEW authoring modal, which is hard-wired to ONE op.** `_authoring` holds a single `{opType,camType,variant,fields,values,exposed,baked}` (L1112). `cbmOpManifest()` returns one op (L1117); `cbmPreviewSlot()`/`cbmBuild()` emit `ops: [cbmOpManifest()]` (L1118, L1256). The seed picker selects **one** program op (L1150-1155). The user's model — *import a whole program (several ops) → one slot* — can't be expressed.

**Reuse-map.** `buildSlotFromOps` already composes N ops; `slot.ops` is already an array; the manifest shape is settled. No generator or `slotPack` change.

**Concrete change.**
1. `_authoring.ops = [{ opType,camType,variant,fields,values,exposed,baked, name }]` (array replaces the single-op fields on `_authoring`).
2. Seed step becomes "add op(s) from program": default = seed **all** CAM-able ops from `ddcsGetBlockProgram()` in program order (filter via `seedFromOp` — twin-fix dependency), with per-op remove + an "add more" picker. The op-card door pre-seeds just its one op (unchanged UX).
3. Field table renders **grouped by op** (Gap 3) — tag each seeded field with its op index the way `buildSlotFromOps` tags `f._op` (L1047).
4. `cbmBuild` emits `ops: _authoring.ops.map(toManifest)`; `buildSlotFromOps` does the rest (already handles multi-op).

**Forks.**
- **F1a [RECOMMEND]** — seed **all** CAM-able program ops at once (matches "import a whole program"), with per-op remove + add-more. *(alt)* add ops one-at-a-time from the picker (simpler modal state, more clicks, less "import a program"). *(alt)* multi-select checklist (middle ground).
- **F1b** — op order: follow program order and allow reorder by **reusing the existing ▲▼ op-card controls** (`opCardsHtml` L1092-1093) inside the modal, vs a fixed program order. Recommend program order + reuse reorder.
- **Dependency:** the twin-fix is what makes a real imported program's ops seed instead of "not CAM-able."

---

## Gap 3 — TABLE GUI polish  *(rides on Gap 1's group-by-op)*

**Ground.** `renderCbmTable` (`macrosApp.js:1120`) renders one **flat** table: `Param | Value | On the pendant? | Pendant slot`. Enum → dropdown (L1128), else numeric input (L1130); guard params show a Bake-disabled tip (L1134); an enum change forces a **full** `renderCbmTable()` re-render (L1187). The modal has **no validation** before Build; the per-slot path has `slotPack.validatePack` (L1265).

**Concrete polish (ranked by "fully-fledged" gain).**
1. **Group by op** — a section-header row per op (`f._op`), essential once Gap 1 lands. Reuse the `_op` tagging.
2. **Units + range hints** — the modal shows label only; add muted `units` and `min~max` per row (the seeded fields already carry `units/min/max`, `probeToSlot.js:33-47`).
3. **Inline validation gating Build** — run `slotPack.validatePack(cbmPreviewSlot())` (or a per-row `min ≤ def ≤ max` check) and surface errors inline + disable the Build button on error. Also validate **baked numeric** values against range.
4. **Enum UX** — show the pendant's numbered options (0..N) in the exposed "Pendant slot" cell too; replace the focus-losing full re-render (L1187) with a targeted row update.
5. **Bulk toggles** — "expose all / bake all defaults" per op section (defer — lower value).

**Forks.**
- **F3a [RECOMMEND]** — ship group-by-op + units/range hints + inline validation first; defer bulk toggles + targeted-row-update as polish.
- **F3b** — validation strictness: block Build on any range error vs warn-only. Recommend block on hard errors (min>max, empty required), warn on soft (def out of range).

---

## Gap 2 — ICON step  *(depends on a working preview — Gap 4)*

**Ground — the pipeline exists, the modal has no icon step.** Per-slot editor offers 🎨 Create/Edit (`openIconEditor(existing, cb)`, `macrosApp.js:1396`), 🖼 Import BMP (`importCamIcon` L1304), palette SVG (`svgToCamIcon` L1319), auto-seeds a labelled icon on first "Add op" (`autoIconBmp(name, method)` L1416). Encoders: `autoIconBmp` (`autoIcon.js:44`) and `bmpDataUrl(W,H,rgba)` (`bmp.js:38`) → 360×180 24-bit BMP from canvas `getImageData`. **The new authoring modal writes no icon at all** (`cbmBuild` L1256 sets only `slot.ops`/`slot.name`).

**Snapshot-as-icon — reuse-map + a real gotcha.** The panel exposes the 3D WebGL canvas as `viz.renderer.domElement` (`createPreviewPanel.js:821`) and a 2D canvas `.pp-2d` (L93). **Gotcha (grounded): no `preserveDrawingBuffer` anywhere in `web/viz` or `web/engine`** — a WebGL `toDataURL()` returns blank unless read synchronously right after a render. `svgToCamIcon` (L1327-1330) already shows the exact downscale recipe: fill black → `drawImage` letterboxed into 360×180 → `bmpDataUrl(360,180, ctx.getImageData(...).data)`.

**Concrete change.** Add an icon step to the modal with three buttons — **📸 Snapshot preview / 🎨 Draw (`openIconEditor`) / Auto (`autoIconBmp`)** — writing `_authoring.icon`, which `cbmBuild` copies to `slot.icon`. Snapshot: draw the chosen source canvas onto an offscreen 360×180 (black bg, letterbox, per `svgToCamIcon`), then `bmpDataUrl`. Default = `autoIconBmp(slot.name, firstOp.method)` so a Built slot is never blank.

**Forks.**
- **F2a [RECOMMEND]** — snapshot from the **2D top-view canvas** (`.pp-2d`, plain 2D context → `toDataURL` always works, and line-art reads better at 360×180). *(alt)* snapshot the 3D renderer — needs `preserveDrawingBuffer:true` (or a forced render + immediate read); richer but a viz change with perf cost.
- **F2b** — multi-op icon label: default `autoIconBmp(slot.name, firstOp.method)` vs author-picked. Recommend default-to-first-op + let snapshot/draw override.

---

## Out of scope (flag only)
Broad **contour / polygon-pocket / ellipse-pocket / single-hole-drill / middle single-axis** coverage = the **Universal-CAM track** (parametric generators). `camTypeOf` already returns `{unsupported}` for these (`opCamMap.js:109,113,120,123`). Not planned here; the empty-state (Gap 5) is how they surface meanwhile.

---

## Prioritized slice order (max "fully-fledged" gain first)
- **S-A · Probe-preview fix (Gap 4).** Smallest, highest-visibility, engine-free (2 call sites, reuse `getStock`/`getStart`). Also *unblocks* the icon-snapshot. **Ship first.**
- **S-B · Empty-state (Gap 5).** Small; kills the confusing dead-end. Pairs with the twin-fix landing. **Ship second.**
- **S-C · Multi-op authoring (Gap 1).** The headline capability (program → one slot). `_authoring.ops[]` + all-CAM-able seeding + `ops.map(toManifest)`; `buildSlotFromOps` already composes. Depends on twin-fix for real programs.
- **S-D · Table polish (Gap 3).** Group-by-op coupled to S-C (ship together); then inline validation + units/range hints.
- **S-E · Icon step (Gap 2).** Snapshot (2D canvas) + Draw + Auto in the modal. Depends on S-A for a trustworthy snapshot. **Ship last.**

### Critical files
- `DDCS-Studio/web/ui/macrosApp.js` (authoring modal `_authoring`/`cbmSimulate`/`cbmBuild`/`renderCbmTable` L1108-1260; `simulateSlot` L1342; icon handlers L1291-1338)
- `DDCS-Studio/web/viz/createPreviewPanel.js` (`getStock`/`getStart`/`previewStock` L155/540; probe anchor + empty-path L631-671,728; canvases L93/821)
- `DDCS-Studio/web/data/opCamMap.js` (`seedFromOp`/`camTypeOf`/`SUPPORTED_OPTYPES`/`ENUM_OPTIONS`)
- `DDCS-Studio/web/data/autoIcon.js` + `web/data/bmp.js` (icon encode/downscale for the snapshot step)
- `DDCS-Studio/web/wizardManager.js` (L484-521 — the reference `getStock`/`getStart` wiring the probe fix mirrors)
