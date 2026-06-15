# Reminders / known issues to revisit

Running list of things noticed mid-work that we deliberately deferred. Newest on top.

---

## Session follow-ups — new task list (2026-06-15)
*Open work surfaced late in the session.*

UX:
- **Mobile Blocks tab** (IN PROGRESS): on mobile the Projected-G-code + Preview panels cover the Blockly canvas.
  Target: Blockly canvas FULL + **Preview as a bottom drawer** (toggle) + G-code hidden/elsewhere. Responsive
  `@media` on `#blocks-app` (currently `grid 1fr/380px`; `.right` = `.pv` 320px + `.gcode`). Bottom-sheet over
  `.blk-ws`.
- **Setup-UI port dropdown** (exe): pick the port in Settings → Network / Console, writing config `"port"`
  (choices limited to PORTS 8765-8769). Backend already honors it (`fairy_gateway._preferred_port`).
- **Blocks mobile preview drawer polish**: (a) when BOTH the palette (left drawer) and the preview (bottom
  drawer) are open, the preview should COVER the palette/sidebar (z-order: preview above palette). (b) the preview
  drawer needs a DRAGGABLE resize handle to set its height — mirror the `.viz3d-drawer .viz3d-resize` grip
  pattern (portrait: grip on the drawer's top edge, `ns-resize`).

IDEA / EXPLORE:
- **Post-processor as a Blockly project too?** (user idea, 2026-06-15). The post-processor = the dialect/emit
  system (`wizards/dialects/*`: per-controller emit forms + `caps`). Could a post be AUTHORED/edited visually as a
  Blockly project — compose how each atom maps to G-code per controller as blocks — so users build custom
  controller posts without code? Ties into [[blockly-composition-view]], [[wizard-to-blocks-bidirectional]] and the
  grbl/Mach3/UCCNC porting work (PORTING-GRBL-MACH3.md). Open question; scope before building.
- **EXE update-check (EXE ONLY)**: the downloaded exe goes stale; the web build auto-deploys on CF (a reload is
  enough there → web excluded, and it shouldn't poll GitHub). Plan: (1) bake the app version into the exe at build
  (`build_fairy.ps1` stamps a `version` constant / bundled `version.txt`); (2) on launch (or via Gateway tab) query
  GitHub Releases `api.github.com/repos/fchabot-dxf/DDCS-Studio/releases/latest`, compare `tag_name` to the baked
  version; (3) if newer → notify in the Studio UI (banner/toast) with a Download link to the release asset + the
  "last commit comments" (release body, or recent `…/commits` messages). Gate behind a desktop flag
  (`window.ddcsDesktop` / served-by-gateway) so the web build never runs it.

Cloud:
- **Drive folder picker**: let the user choose WHERE the app folder lives (Google **Picker API** — `drive.file`
  only sees app-created files, so the Picker grants access to a chosen existing folder). Today it auto-creates
  "DDCS Studio" at Drive root (movable, tracked by id).
- **Dropbox + OneDrive adapters** (`cloudVolume.getAdapter` stubbed for them; PKCE login built; Google done).
- **Exe OAuth**: GIS-in-WebView2 likely blocked (`disallowed_useragent`) → register a **Desktop** OAuth client +
  **system-browser loopback** in `fairy_gateway.py`. (Web confirmed working on desktop + iOS after propagation.)
- **iOS GIS**: works now; consider redirect-mode for mobile-popup robustness (LOW).

Atom-stack logic audit (2026-06-15) — HIGH already fixed (middle two-axis WCS swap; atan two-operand `atan[a]/[b]`
across DDCS/LinuxCNC). Remaining:
- **MED** — footer PARK branch emits two `#…=…` assignments on ONE line (`cuttingBlocks.js` / `ops/program.js`
  footer, park=true path) → split into two lines.
- **MED** — snippet-op ACCUMULATION: concatenating two probe/ATC snippets gives duplicate `N1`/`N2` labels + a
  mid-program `M30` (strands the 2nd op; a GOTO can hit the wrong `N`). Renumber labels / strip interior `M30` on
  accumulate (`opStacks.appendIntoProgram`). See [[decode-is-standby]].
- **LOW** — alignment `MSG('Drift=%.3f…')` printf specifiers aren't substituted by hmiToast → shows literal
  `%.3f`. Embed `#vars` like the other wizards.
- **verify-on-hardware** — DDCS `atan[a]/[b]` acceptance (required on LinuxCNC per interp_read.cc; DDCS Fanuc-style
  assumed, no dump example).

## Desktop exe: port fallback + cloud-OAuth JS origins (2026-06-15)
*Status: fallback DONE in `fairy_gateway.py` (needs a rebuild to ship in the exe); Setup-UI port dropdown = follow-up.*

The exe serves Studio from `http://127.0.0.1:<port>`. `_pick_port()` binds the first FREE port in
`PORTS = [8765, 8766, 8767, 8768, 8769]` (so it launches even if 8765 is taken), reuse-detects a running gateway
(single-instance), and honors a user-chosen port from `~/.ddcs-bridge/config.json` `"port"` (only if within PORTS).

**OAuth implication — each port is a distinct origin**, so ALL must be registered as Google **Authorized
JavaScript origins** (Client ID = the BYO Drive SPA client, see [[gateway-cloud-architecture]]):
```
https://ddcs-studio.pages.dev    (hosted)
http://127.0.0.1:8765 … :8769    (exe fallback range)
http://127.0.0.1:5501            (dev live-preview, optional)
```
Don't allow ports outside PORTS (cloud login would break — origin not registered). One Client ID covers web +
preview + exe. **Redirect URIs stay empty** (GIS token model uses JS origins).

Follow-ups: (1) a port dropdown in Settings → Network / gateway Console (Setup) writing config `"port"` (choices
limited to PORTS) so users pick via UI; (2) rebuild + re-publish the exe to ship the fallback + the baked-in
client ID; (3) embedded-webview OAuth caveat still open — WebView2 may be blocked by Google → system-browser
loopback fallback in `fairy_gateway.py` (test the exe).

## Audit the exe build + maybe build-on-commit (2026-06-15)
*Status: TODO.*

Audit that the app still packages into a working Windows `.exe` (pywebview + PyInstaller — see memory
[[desktop-packaging-pywebview]]; entry around `bridge/bridge-app/desktop.py` + the build script/spec): the web
root (`DDCS-Studio/web`) + the bridge/gateway bundle in, the app launches, the Gateway tab works. As the app
grew this session (gateway views, the project VFS, new ui/ modules), confirm nothing broke the bundle — new
files included, relative import paths, assets/vendored Blockly + three.js all packaged.

**Build on every git commit — CONSIDER but probably NOT per-commit:** PyInstaller takes minutes and the exe is a
large binary that must not live in git. Better triggers: a CI build on push/tag (GitHub Actions — already used
for the macOS build), a pre-push hook, or a `make exe` the user runs. Decide: per-commit (heavy) vs CI-on-push
(recommended) vs on-tag release. Whatever the trigger, it should produce a FRESH exe from the current tree and
smoke-test that it launches.

## Project system — save macros durably (2026-06-15)
*Status: TODO. Filetype DECIDED; picker location DECIDED.*

A "project" system to save generated macros/programs DURABLY (today the program is ephemeral — editor +
localStorage). Save the high-level STACK (ops + params — the single source of truth, so it re-posts to any
dialect and round-trips blocks↔editor), NOT just the emitted text.

**FILE FORMAT (decided 2026-06-15): `.mjson` — a branded extension, JSON inside.** Content = the op-stack +
params + metadata: `{ kind:"ddcs.project"|"ddcs.macro", v, name, post, profile, stock, stack:[…op-containers…] }`.
Lossless, editable, re-postable to any dialect, round-trips blocks↔editor. Serialize the programModel stack
(`window.ddcsGetBlockProgram` / `ddcsLoadBlockStack`). Export `.nc` on demand for the controller (terminal/lossy —
never re-imported as a project).

**STORAGE PICKER — CLOUD + LOCAL, surfaced in the STUDIO and BLOCKS tabs (not just Gateway Console).** A compact
chip (e.g. "☁/💾 Local ▾") + Save / Open, reusing the `service.js` seam: LOCAL = browser/desktop/gateway disk;
CLOUD = R2 / OAuth'd Drive when a service is connected (ties to [[gateway-cloud-architecture]] BYO-storage).

Needs: named projects/macros, save / load / list / rename / delete. Pairs with the Gateway Send/Merge tabs (load
a saved `.mjson` → send / merge).

**DONE (first slice, 2026-06-15):** `.mjson` save/open of the op-stack (`blocks/macroFile.js`) + a header
💾 chip · ⤓ Save · 📂 Open (`ui/macroBar.js`, global header → Studio + Blocks). Round-trip verified.

**EVOLUTION (decided 2026-06-15): a full PROJECT MANAGER modal over a virtual filesystem (VFS) — PROJECTS ONLY.**
User idea: a "virtual disk" → the right concept is a VFS / unified library: ONE browse modal over project VOLUMES
(backends), each a small interface (`list / read / write / delete / rename`). The VFS holds `.mjson` PROJECTS ONLY:
- 💾 Local — browser IndexedDB/localStorage (the named `.mjson` list)
- ☁ Cloud — R2 / Drive when a service is connected (ties to [[gateway-cloud-architecture]] BYO-storage)

**EXCLUDE CNCDISK** (user, 2026-06-15): the controller disk is for `.nc` files, not projects — it stays separate
in the Gateway Files tab, NOT a VFS volume. The crossover is one-way: a project → export `.nc` → Gateway Send
(not a VFS copy). So the modal: browse / open / save-as / rename / delete `.mjson` projects across Local + Cloud.
Absorbs the "named macro list" sub-task. Build incrementally: modal + Local volume first (IndexedDB on top of
`.mjson`), then mount Cloud when the storage backend lands.

## Audit LinuxCNC (rs274ngc) for features our EXISTING wizards don't surface (2026-06-15)
*Status: AUDIT DONE 2026-06-15 — findings below are candidate tasks. Scope: existing wizards only.*

Grounded in MACHINE-PRIMITIVES-MAP §8 + `wizards/dialects/rs274ngc.js`. "Add X to wizard Y":

HIGH value:
- **Probe wizards (edge/middle/corner/circular/alignment): `G38.3` no-error probe + read `#5070`.** Today the
  fail path on rs274 just ALARMs (`probeStatus`→`[]`; #1's balancer drops the dead branch). `G38.3` probes
  without erroring → branch on `#5070` (`o<n> if [#5070 EQ 0]`) = a real in-program fail handler.
  **⚠ BIGGER THAN IT LOOKS (found 2026-06-15):** the probe stacks use a GOTO-to-fail-label pattern with REUSED
  label numbers (e.g. edge: both probes `CK(1)` → label 1). A clean #5070 handler needs UNIQUE o-word numbers,
  but `probeStatus(axis,label)` only has the reused label → a naive version emits duplicate `o1 if/endif` =
  INVALID o-words, WORSE than today (today safely ALARMs via G38.2). So this is the STRUCTURED-FLOW EMITTER job
  (allocate unique o-word numbers + restructure the GOTO-fail into real if-blocks + plumb G38.3), not a dialect
  tweak. Current alarm-on-miss is SAFE; this is a UX upgrade. DEFER to the structured-flow project.
- **Confirm / comm wizard: `M0`/`M1` pause + `(MSG,…)`. ✅ DONE 2026-06-15 (commit d973cab).** rs274 `hmiPrompt`
  → `(MSG,msg)`+`M0`; `confirmBlock` cancel-jump gated on a new `dialect.hmiCancelVar` (Expert `#1505`), so M0/
  Centroid prompts don't get a bogus `IF #1505==0 GOTO`. Confirms no longer vanish on LinuxCNC/grblHAL.

MEDIUM — ✅ DONE 2026-06-15 as granular ATOMS (commit 6ec0d6f, `ops/cnc.js`; atom-block-only, not auto-wired into
wizards yet; verified per dialect in Node):
- **#3 `pathMode` atom** — `G64 P<tol>` blend / `G61` exact-stop (grbl folds; DDCS emits — TO CONFIRM on hw).
- **#4 `drillCycle` atom** — native `G81/G82(+P)/G83(+Q)/G85`; `cancelCycle` = `G80` (grbl folds).
- **#5 `outPin` / `waitInput` atoms** — `M62-65` / `M66 P L Q`→`#5399` (DDCS folds to "use an M-Code atom").
Follow-ups: auto-wire drillCycle into the Drill wizard on rs274; wire outPin/waitInput into the ATC wizards via
the HAL port map; `G98/G99` retract mode on drillCycle.

LOW / niche: WCS `G10 L2` + `G92` modes (we only do L20); drill rigid tap `G33.1` (needs encoder); probe
`G38.4/.5` (probe away); tool `G43/G43.1` length offset; rotary `G93` inverse-time; cutter comp `G41/G42` (big).

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

DECIDED 2026-06-15: **BYO-storage is the direction; keep RELAY too (for now) — they COEXIST as two backends
behind one `list/read/write/delete` interface.** The Project Manager ☁ Cloud volume = "pick a provider":
Relay (R2 via the Worker, zero-setup default) or Google Drive (BYO, opt-in "Connect Google Drive"); 💾 Local
unchanged. Show them as SEPARATE volumes (never merge) so it's clear where a project lives. The Worker hosts BOTH
the relay storage AND the BYO OAuth (OAuth must live there — only safe place for the client secret + redirect),
so keeping relay is free. To build:
1. A project-storage backend INTERFACE (Local IndexedDB done; add Relay + Drive impls).
2. Worker endpoints — relay: R2 put/get/list `.mjson`; BYO: `/api/oauth/google/{start,callback}` + a `gdrive`
   backend (Drive API). NEEDS the user's Google OAuth client ID/secret (register an app in Google Cloud Console).
3. Project Manager ☁ Cloud volume UI: provider picker + "Connect Google Drive".

UPDATE 2026-06-15: **R2 + the Worker are FROZEN — no further dev; leave as-is.** So BYO does NOT route through the
Worker. Use browser-direct **PKCE** OAuth (public client, NO secret): the browser logs into Google/Dropbox/OneDrive
itself, the token returns to the browser, which reads/writes the user's OWN cloud directly — no server. Relay
(R2+Worker) stays as the frozen optional fallback. To do: rewire `cloudAccount.connect()` from "call the Worker
`/api/oauth`" to PKCE-with-the-provider (each needs a public client ID + a redirect URI; Dropbox/OneDrive PKCE is
clean, Google needs care / Identity Services). The cloud UI (multi-provider login, modal+popup, Local/Cloud tabs)
stays as built. `CLOUD_OAUTH_BASE` / the Worker-OAuth scaffold idea is dropped for BYO.

CLOUD STORAGE BACKEND (next slice, `ui/cloud/*`): per-provider list/read/write/delete of `.mjson` under an APP
FOLDER. **Track the folder by its provider FILE ID (stable across move/rename) — NOT by name/path** — so moving
or renaming it in the user's Drive does NOT create a duplicate (the app follows the ID). On connect/init: stored
ID → use it; else SEARCH the app's own files (drive.file scope sees only what the app created) for the folder by
name → re-adopt if found, else create at root. "Decide where the folder lives" = the user moves it anywhere in
their Drive (followed by ID); plus an optional "Choose folder" action (paste a folder link/ID, or the Google
Picker) to re-point. Token (PKCE) is in localStorage (`ddcs_cloud_token`/`_refresh`); refresh on 401. Dropbox =
App-folder scope; OneDrive = app folder via Graph. Then wire the drawer's ☁ Cloud tab to browse this volume.

STILL OPEN: dual local+cloud at once for the GATEWAY control channel (separate from project storage) — recommended
"Auto local+cloud" (both URLs, prefer local, fall back to cloud).
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
