# K-button Wizard — build plan (architect pass, mirrors cam-builder-plan.md)

## Headline
~75% already exists. The install path is 100% built (`key-N.nc` write + Deploy modal), ~85% of the
action atoms already exist as Blocks primitives, and the authoring modal + icon + preview + round-trip
machinery are the CAM Builder's, reused verbatim. Genuinely NEW = **one atom (navigate-to-screen `#2037`)
+ its 201-code data table**, a thin **"Actions" palette/category**, and the **K-button wizard shell**
(action palette → assign-to-K-key) built on the CAM authoring modal shape. A K-button is a small block
STACK of action atoms → `emitMapped` → `key-N.nc` body → the EXISTING K-button record + install path.

## Architecture facts — what maps where (do NOT conflate the two IRs; same split as the CAM plan Q#7)
- **Blocks atom stack** (`blocks/programModel.js` `getStack` → `blockEmitter.emitMapped`) = the RIGHT IR here.
  A K-button macro is short + UNROLLED (press #2037, toggle a pin, M98 a slot) — no parametric `#2600` loop,
  so unlike CAM this is a plain atom-stack emit, NOT a slot manifest.
- **K-button record** already exists: `getSettings().macros[]` entry `{ name, trigger:{kind:'kbutton', key:N}, body }`
  (`ui/macrosApp.js:379-380` findKbtn/ensureKbtn; body→file at `:375` macroFileText kbutton branch → wraps as
  `( save as key-N.nc … K{k} button )` + body + `M30`). The wizard writes THIS record, adding an authored
  `actions[]` (the atom stack, the source of truth — the K-button twin of CAM's `slot.ops`).
- Emit contract: `emitMapped(stack, activeDialectOpts())` (the sysstart panel already does exactly this at
  `ui/macrosApp.js:570`); every action atom is profile-aware via its `gate`/`emit(p,dx,dy,dialect)`.

## The action library = a DECLARED table (like CAM's OPTYPE_TO_CAM / SECOND_CTL)
Each library entry = { friendly label, icon hint, atom `type`, param defaults, (opt) enum picker }. It maps a
friendly action → an EXISTING Blocks atom (or the one new nav atom). Grounded — these atoms already exist:

| Action (friendly)          | Atom `type`            | Where declared                                       | Status |
|----------------------------|------------------------|------------------------------------------------------|--------|
| Navigate to screen (#2037) | `navscreen` NEW        | build it (see below)                                 | **NEW** |
| Toggle output (OUT/pin)    | `outpin`               | `wizards/ops/cnc.js:56-77` (M50-91 Expert / M62-65)  | reuse |
| Wait for input             | `waitinput`            | `wizards/ops/cnc.js:79-99`                           | reuse |
| Run macro / CAM slot       | `call` (M98 P)         | `wizards/ops/more.js:36-40`                          | reuse |
| Send M-code                | `mcode`                | `wizards/ops/macro.js:39-43`                         | reuse |
| WCS switch G54–G59         | `wcs`                  | `wizards/ops/wcs.js:2-18`                            | reuse |
| Home (G28)                 | `home`                 | `wizards/ops/more.js:27-34`                          | reuse |
| Jog / go-to (G0/G1, G53)   | `move` / `machinemove` | `wizards/ops/macro.js:12-31`                         | reuse |
| Dwell                      | `dwell` (G04)          | `wizards/ops/dwell.js:5-10`                          | reuse |
| Raw G-code escape          | `raw`                  | `wizards/ops/macro.js:45-49`                         | reuse |
| Goto / label / if-goto     | `goto`/`label`/`ifgoto`| `wizards/ops/flow.js:8-27`                           | reuse |

So exactly ONE new atom is required. Everything else is a curated ENTRY in the action-library table that
points at an existing `BLOCKS[type]` (`wizards/ops/index.js:111`).

## The ONE new atom — navigate-to-screen (`#2037`)
- Atom def, same shape as `outPinBlock` (`cnc.js:56`): `{ type:'navscreen', label:'Navigate', kind:'leaf',
  category:'Actions', defaults:{ key:1348, dwell:1 }, fields:['key','dwell'],
  gate:(d)=> isDDCS(d) && d.caps?.inputRead ? null : 'virtual buttons are DDCS-Expert only',
  emit:(p)=> ['#2037 = 65536 + ['+key+' - 1000]', 'G4 P'+dwell] }`.
- Use the **CONFIRMED formula** `#2037 = 65536 + [KeyValue − 1000]` (virtual-buttons-2037.md;
  `bridge/controllers/expert-m350/FINDINGS.md:291-293` CONFIRMED ON MACHINE 2026-06-10, MDI=KeyValue 1348).
  WARNING: `k-button-assignments.md` shows legacy raw codes (`#2037 = 1261` MDI, `1260` Coordinate) — those are
  SUPERSEDED by the formula; do NOT emit the raw-1261 form. The `#2037` register is confirmed in
  `web/Variables-ENG…csv:2039`.
- **The 201-code table = DATA** (new `web/data/virtualButtons.js`): `[{ key, label, category, nav:true|… }]`
  transcribed from `Virtual_button_function_codes_COMPLETE.xlsx` / virtual-buttons-2037.md categories
  (Navigation 16, Functional 12, Jogging 18, Feed/Speed 16, Spindle 9, Program 10, Advanced/WCS/Tool 20+).
  The nav library is a DECLARE — ONE atom + this table, exactly like the CAM plan's nav-as-data stance.

## Actions category in Blocks
- Add `'Actions'` to `CATEGORIES` (`wizards/ops/index.js:107`) and push `navScreenBlock` into `PALETTE`
  (`:87-102`). A block declares its own `category` (single source of truth), so the toolbox buckets it
  automatically. The REUSED atoms keep their current categories (moving them would churn the palette) — the
  K-button WIZARD surfaces them via the action-library table, not by re-homing them (fork D3).

## Round-trip / reverse-sync (imitate the CAM + marker patterns)
- Store `actions[]` (the atom stack) on the K-button macro record = the source of truth (CAM's `slot.ops`
  analogue; `ui/macrosApp.js:1256` shows the manifest-on-record shape).
- For a full re-import of a pulled `key-N.nc`, reuse the self-describing marker codec:
  `serializeWithMarkers` / `importMarkedNc` (`blocks/programModel.js:96-178`) + `markerLine`/`parseMarker`
  (`blocks/opSchema.js:219-240`). A K-button as a single "op" would need a SCHEMA entry (`opSchema.js:43`) +
  a BUILDER (`opBuilders.js:34-40`, `makeOp` `:96`) OR — lighter — register it through the federated USER
  layer (`registerUserBuilder`/`registerUserSpec`, `opBuilders.js:53-61`, `opSchema.js:196`). See fork D5.
- Today's pull already extracts K-button name+body from `key-N.nc` (`macrosApp.js:667-683`); markers add the
  action stack on top. v1 can round-trip the BODY (existing) + keep `actions[]` locally (fork D5).

## Physical K-key binding + install
- **Macro file** — 100% reuse. `pushKbutton(k,m)` → `makeClient().writeSysfile('key-'+k+'.nc', body, 'write')`
  with `.bak` backup (`macrosApp.js:393-400`); Deploy modal already lists `key-1..7.nc` and pushes/deletes
  them (`:838-845`, SYNC_FILES `:632`, confirm handler `:902-922`). `client.js:59` = the only write API.
- **K-VALUE parameter** — the binding "which physical key runs what" (`k-button-assignments.md`: K-value
  `0`=run key-N.nc, `1-32`=toggle OUT1-32, `>1000`=function shortcut; CAM README `macrosApp.js:1494` cites
  "function code 1399, parameter range Pr210-252"). **There is NO gateway parameter-write API** — `client.js`
  exposes only `writeSysfile`. So v1 relies on the DEFAULT K-value=0 (the key simply runs `key-N.nc`, which is
  what we write) and DOCUMENTS any non-default K-value (function-shortcut / OUT-toggle) in a README, exactly
  like the CAM install README (`macrosApp.js:1487-1497`). A param-write path is a follow-up (fork D4).
- Bonus reuse: `ext_button.nc` / `extnc*-N.nc` (release/short/long press) exist too (`FINDINGS.md:337-338`) —
  same write path, out of v1 scope.

## The friendly wizard front-end (reuse the CAM authoring modal shape)
The CAM modal `openCamAuthoring(seedOp)` (`macrosApp.js:1193-1204`, exposed `window.ddcsOpenCamAuthoring` `:1483`)
is the template — same overlay shell, listeners, inline preview and a "build to which N" modal. Remap each part:
- **Picker** (`mountAuthoringSurface` `:1145`, seed `<select>`): swap "seed from program op" → an **ACTION
  PALETTE** (the action-library table) — pick 1..n actions to append to `actions[]`.
- **Table** (`renderCbmTable` `:1120`): swap the expose/bake field table → the **action list** (add / reorder /
  dup / delete — reuse the op-card idiom `opCardsHtml` `:1085-1102`) with per-action params (nav-screen picker
  grouped 16-nav-first, pin number, M-code, WCS enum…).
- **Label + icon**: `#cbm_name` (`:1160`) → K-button label; icon via `openIconEditor`/`autoIconBmp`/`bmpDataUrl`
  (`macrosApp.js:1396`, `:1416`, `data/autoIcon.js`, `data/bmp.js`) — icon is Studio-side identity (fork D6).
- **Inline preview**: `cbmSimulate` (`:1240-1250`) runs `createPreviewPanel` over the emitted body — here
  `getGcode: () => emitMapped(actionStack, activeDialectOpts()).text` (a straight atom emit, no `#2600` seed).
- **Build**: `cbmBuildModal` (`:1205-1223`) "which slot" → "**assign to which K-key (K1–K7)**" (reuse
  `nextSlotNum` idea → first free K; `renderKbuttons` `:428-444` shows K1-7 occupancy). Build → upsert the
  `getSettings().macros` kbutton record (`ensureKbtn` `:380`) + `saveSettings()` → the existing K-panel + Deploy
  path take over.

## Reuse map (do NOT rebuild)
key-N.nc write + backup (`pushKbutton :393`) · Deploy/Pull modal incl key-1..7 (`:736-935`) · the K-button
record + `macroFileText` kbutton branch (`:375-380`) · `renderKbuttons` panel (`:149-155`,`:428-444`) ·
the whole authoring-modal shell + listeners + build-dest modal + inline `createPreviewPanel` preview
(`cbm*` `:1108-1260`) · `emitMapped`/`activeDialectOpts` · the Blocks atom IR (PALETTE/CATEGORIES/BLOCKS
`ops/index.js`) + every reused action atom · marker round-trip (`programModel.js` + `opSchema.js`) · icon
pipeline (`autoIconBmp`/`openIconEditor`/`bmpDataUrl`) · CAM-style install README (`:1487-1497`).

## NEW (build this)
1. `web/data/virtualButtons.js` — the 201-code table (data only), nav-16 flagged + categories.
2. `navScreenBlock` atom (`wizards/ops/cnc.js` sibling or new `ops/navscreen.js`) + register in PALETTE +
   add `'Actions'` to CATEGORIES (`ops/index.js:87,102,107`).
3. `web/data/kbuttonActions.js` — the DECLARED action-library table (friendly label → atom type + defaults +
   picker), the K-button twin of `opCamMap.js`.
4. The K-button wizard shell — a REUSE/fork of `openCamAuthoring`: action-palette picker, action list
   (reorder/dup/del), label+icon, inline emit preview, assign-to-K-key build modal.
5. A K-BUTTON panel entry point (the trigger, mirroring `cam_build_slot` button `:1479-1480`) — see fork D1.
6. (opt) marker/SCHEMA/BUILDER (or USER-layer register) for full key-N.nc round-trip (fork D5).
7. (opt) install README addition documenting non-default K-value setup (fork D4).

## Build order (slices — each reviewable, byte-safe where noted)
- **S0** `web/data/virtualButtons.js` + `web/data/kbuttonActions.js` — pure data + a table assert (no UI,
  byte-safe: nothing imports them yet).
- **S1** `navScreenBlock` atom + PALETTE/CATEGORIES registration; verify emit `#2037 = 65536 + [key-1000]` /
  `G4 P` per active post, Expert-gated. (Adds one block; existing categories byte-identical.)
- **S2** K-button wizard shell (single action): pick ONE action → label → assign K-key → upsert macro record
  → the existing Deploy path installs it. Reuses `openCamAuthoring` shell verbatim.
- **S3** multi-action stack (action cards reorder/dup/del, `opCardsHtml` idiom) + inline emit preview
  (`createPreviewPanel`).
- **S4** icon (autoIcon/iconEditor) + validation (Expert-only guard, K1-7 occupancy).
- **S5** (opt) round-trip marker + install README for the K-value binding.
Expert-only throughout (the `gate` on navScreen + the panel visibility).

## DECISIONS NEEDED (human rulings — framed as legit options + a recommendation)
- **D1 — Wizard placement.** (a) A new "K-BUTTONS" builder button on the existing K-button panel
  (`macros_panel_kbtn` `:149-155`) opening the modal, keeping the raw-body editor as the fallback;
  (b) a top-level entry like CAM's `cam_build_slot`; (c) a Blocks-tab launch. **Rec: (a)** — the K-panel is the
  one home for K-buttons (mirrors the CAM "in-panel" rec), and the raw editor stays for power users.
- **D2 — Single vs multi action for v1.** (a) single action per K-button; (b) a short stack. **Rec: ship S2
  single first, S3 multi right after** — the stack model costs little (it IS the atom stack) and matches real
  K-button macros (dwell after a #2037 press, M3 then park, etc.).
- **D3 — Actions category = new atoms vs curated view.** (a) add ONLY the new nav atom to an 'Actions'
  category and surface the reused atoms via the wizard's action-library table (no re-homing);
  (b) also move wcs/home/call/… into 'Actions'. **Rec: (a)** — byte-safe, no palette churn; the wizard is the
  curated surface (a block has one `category`).
- **D4 — Install / K-value write.** (a) v1 = write `key-N.nc` only (K-value default 0 runs it) + README for any
  non-default binding; (b) add a controller parameter-write path (needs a new gateway API — none exists at
  `client.js`). **Rec: (a)** now, (b) as a scoped follow-up once a param-write endpoint exists.
- **D5 — Round-trip fidelity.** (a) body-only pull (works today `:667-683`) + keep `actions[]` locally;
  (b) embed `@DDCS` markers in key-N.nc for full action re-import (SCHEMA+BUILDER or USER-layer register).
  **Rec: (a) for v1**, (b) when authored K-buttons need to survive a controller round-trip.
- **D6 — Icon default + role.** Physical K1-7 keys show no controller icon, so the icon is Studio-side
  identity. (a) auto-label via `autoIconBmp(name,'kbutton')`; (b) author picks; (c) drop icons for v1.
  **Rec: (a)** auto by label, editable via the icon editor — consistent with CAM, zero blank cards.
- **D7 — Nav-screen picker shape.** (a) flat 201-list; (b) **16 nav screens first**, then an "all functions"
  expander grouped by category. **Rec: (b)** — the 16 navigation codes are the 90% case; the long tail stays
  reachable but out of the way.

## Critical files
- `DDCS-Studio/web/ui/macrosApp.js` — K-button record + `pushKbutton`/Deploy install (`:375-400,:838-935`) and
  the `cbm*` authoring modal to fork (`:1108-1260`, opener `:1483`).
- `DDCS-Studio/web/wizards/ops/index.js` — PALETTE + CATEGORIES + BLOCKS registry (`:87-111`) — add 'Actions' +
  the nav atom.
- `DDCS-Studio/web/wizards/ops/cnc.js` — `outPinBlock`/`waitInputBlock` (`:56-99`) = the atom-def template +
  reused output/input actions.
- `DDCS-Studio/web/blocks/opSchema.js` + `DDCS-Studio/web/blocks/programModel.js` — marker round-trip
  (`opSchema.js:219-240`, `programModel.js:96-178`) for optional key-N.nc re-import.
- NEW: `DDCS-Studio/web/data/virtualButtons.js` (201-code table) + `DDCS-Studio/web/data/kbuttonActions.js`
  (action-library declare, the `data/opCamMap.js` twin).
