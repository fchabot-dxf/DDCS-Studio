# DDCS Studio — Roadmap

## 🔁 ACTIVE LOOP QUEUE (advisor-reconciled 2026-07-31 — the live order; NEXT-SESSION.md carries the current act)

> # ⭐ THE LIVE QUEUE — advisor-reconciled 2026-08-22
> **This supersedes the 2026-07-31 reconciliation below**, which is ~3 weeks stale and describes work long
> since shipped. ⛔ Do NOT delete what follows it: it carries the PORTING arc ledger and the **attested V4.1
> firmware insights** (macro-parser mode `#122` / the `macro_` filename prefix; `ATAN[dy, dx]` requiring a
> comma) — those are evidence, not queue items, and they must survive any future tidy.
>
> ```
>   IN FLIGHT
>     OP CHIPS — the hover-revealed "✎ Edit" chip becomes a PERSISTENT icon-only op
>            list in the editor strip. Icon from entryIconHtml (the SAME resolver the
>            header buttons + Settings picker read); one contextmenu handler serves
>            right-click AND long-press.  spec: scratchpad/t-opchips.md
>            ⛔ REORDERING WAS CUT MID-TURN — the human read the ask as approving DRAG;
>              when it came back as menu items they retracted it. Not deferred: not built.
>
>   SHIPPED SINCE THE LAST RECONCILIATION (all released in V2026.08.22.4)
>     t2149  the menu split — logo owns the APP menu, filename owns the FILE menu   BACKLOG 9
>     t2151  ROLES S1 + S2 — role derived client-side, and workspace-RELATIVE
>     t2151/t2153  the editor focus ring: left edge, then the code-area-only ruling,
>            then the wide-mode right-edge break (the 3D pull-tab was painting over it)
>     t2153  BACKLOG 13 — the mobile toolbar: 44px floor on all six, row to the bottom
>     t2155  THE EDITOR STRIP — the top band becomes a declared box. Two mount points
>            (editorStripHost / editorCodeHost) replace five modules each inferring a
>            host from editor.parentElement. --editor-chip-inset DELETED; placeChip's
>            collision dodge DELETED; both proven dead, not assumed.
>     t2155  the 3D pull-tab joins the theme — and caught a live bug nobody reported:
>            studio's 4-value edge token inside a `border:` shorthand invalidated the
>            WHOLE declaration, so studio rendered no border at all.
>     t2156  save-as-wizard dropped every op but the first, SILENTLY. The two-lookup
>            divergence was real (getAllBlocks vs getTopBlocks, confirmed live) —
>            fixed by pairing record↔block BY ID, plus the human's op picker.
>
>   READY — ruled and specced, dispatch in this order
>     1  INSTALL THE 5 TRACED WORDMARKS — the artefacts EXIST (MARK-*-TRACED.svg, repo
>            root, ~47 KB total) and are not pasted in. Every mark today is a font
>            REQUEST Android declines. A paste, not a design task.        BACKLOG F5
>     2  F2   workspace: DELETE the name field, display the filename      BACKLOG F2
>     3  #4   lathe icons: centreline removed, draw polygon + face-probe,
>              re-judge the five at 16px FIRST                            BACKLOG 4
>     4  ROLES S3 — the arc the human chose, paused while the editor panel took over
>     5  #10  multi-op preview: show where the op sits                    BACKLOG 10
>     6  #14  two dead-code clusters in the editor chrome (tail-sized)    BACKLOG 14
>
>   ⏸ PARKED — raised, not ruled. Do NOT infer scope from these.
>     · reordering ops (and drag, which collides with the strip's own sideways scroll)
>     · does anything validate op ORDER? a probe must precede its WCS readers — unknown
>     · wizard PACKS — several wizards saved/shared as one unit; persistence unread
>     · version duplication: app-menu footer AND the About panel both show it  BACKLOG 9
>     · three doors to "open a saved thing": Open / Load… / Library → Projects BACKLOG 9
>     · font licensing for outlining Arial Black + Georgia (the 4 non-organic marks)
>     · organic: remove button + panel borders for a flatter modern look
>
>   ⭐ STANDING POLICY — human, 2026-08-22: "everyturn add a small item from backlog"
>     Each dispatch = the ARC step + ONE small backlog item as a TAIL.
>     ⛔ THE TAIL COMMITS SEPARATELY. A one-line tree removal must never share a diff with an arc
>       step — that is what keeps a review possible. (Precedent: the M6.rc tail on t2143.)
>     ⚠ THE TAIL RUNS AFTER the main task is done and green, never alongside it.
>     ⚠ IF THE TAIL IS RISKY OR TOUCHES THE SAME FILES as the arc step, it goes in its OWN turn
>       instead — the policy is to drain the board, not to manufacture entangled diffs.
>
>   PARKED — explicitly, by the human, 2026-08-22
>     F5   organic wordmark      mock-up first, "in time"
>     C    RECORD[] progress     "dont worry about that" — and its premise expires ~08-27
>     —    analytics branch      "analytic can wait"
> ```
>
> ⭐ **NOTE ON ITEM 1:** the SEAT B line at the end of the stale block below already carried
> *"workspace name=filename (its rename lands -> seat A's menu absence-lock flips by design)"*. That decision
> was made once, queued to a window that was never opened, and re-derived from scratch on 2026-08-22.
> ⚠ **Its second half is still live and is NOT in the BACKLOG spec:** the rename landing is supposed to flip
> a menu absence-lock in the other seat. Whoever builds F2 must find that lock and check it.

**THE MILL-PARAMETRIC ARC's WIZARD CONVERSIONS ARE DONE** (V2026.07.31.7, t1319→t1464): surfacing /
drill family / rect pocket emit parametric macro bodies end to end (live pendant knobs, one clearing
emitter shared by wizard + CAM, @work-declared trace caps, the too-small law); slot / non-rect /
contour / rest are DECLARED-PERMANENT literal boundaries with self-red-ing specs (ONE obstruction:
trig unverified — `V13_trig.nc` is the single decider — plus LIST-vs-FORMULA for ellipse/polygon);
middle is a probe (no clearing walk). Iron rule (round-trip 11, shrink-only) held the whole arc.
The queue now, in order:
1. **The improvement remainder** (in flight): SQRT loud-failure diagnose/V13-prep → the
   feature-canvas bottom-handle defect (user) → the mobile CAM-builder cleanup (user, moved from
   seat B) → true-arc helix → flake settle-hardening (6-member ledger) → the slot capability arc
   (scout first).
2. ✅ **Value-fidelity — CLOSED at t1520** (one day after this queue was last reconciled). The pinned 11
   round-trip diffs were traced to 3 root causes, all 3 fixed at the source, and the assert TIGHTENED from
   `<= 11` to `=== []` (`tests/value-fidelity-1520.spec.js`, still live, unreopened since). This line said
   "shrink" as if still in progress for who knows how long after it reached zero — corrected t2016 (found
   t2010).
3. **THE PORTING ARC (committed) — REFRAMED t1531: "MAKE THE EVIDENCE EXECUTABLE".** Measurement
   (scout t1530) inverted the premise: V4.1 is **already ported** (a full dialect, one of two
   `POST_VERIFIED` posts, 54 specs) — what is missing is the INSTRUMENT. The dialect's confirmations
   live in code comments, and prose does not go red: 0 of 91 tracked factory `.nc` macros are read by
   any spec. So the arc is S1 corpus-oracle → S2 spacing policy → S3 caps → S4 named unknowns → S5
   live round-trip (human-gated), then DM500 through the same stages; grbl-class = unroll.
   **Progress ledger: [`PORTING.md`](PORTING.md). Arc-as-data: `web/data/portingArc.js`.**
   - **DDCS V4.1 Firmware Execution Insights (Attested for V4.1 only by Yt Liu):**
     - *Macro Parser Mode (#122 / `macro_` prefix):* Standard G-code mode lacks loop stacks for `WHILE` and freezes on unspaced `IF` tokens. Unlocked by setting parameter `#122 = 1` or prefixing the filename with `macro` (e.g., `macro_test.nc`, matching factory `macroMillCylinder.nc`).
     - *Comma-Separated `ATAN[dy, dx]` Syntax:* `ATAN` on DDCS V4.1 strictly requires two arguments separated by a comma (e.g., `#190 = ATAN[1, 1]`, returning 45° in degrees).
Standing user backlog behind those (from t1046, still real): K-button wizard (Expert-only, #2037
nav library) · exe auto-update (branch pair exists — needs a real packaged-exe test) · Google
Drive reliable for other users (desktop OAuth live-untested).
4. **Wizards-as-Data Architecture & Layout Splitters:**
   - **Intention:** Provide declarative, block-driven wizard layouts (`split_horizontal`, `split_vertical`, `grid_container`, `tab_group`, `group_box`, `corner_grid_picker`, etc.) that allow custom wizard authoring in the Blocks tab without hardcoding HTML.
   - **Live Wizard View Drawer Integration:** The right-hand drawer in the Blocks tab serves as the single, full-height **Wizard View** (replacing standalone 3D/Gcode panels), continuously rendering a live 1:1 calculated Generator Modal preview as blocks change.
   - **Parity Principle & Status:** Every block-rendered visual container (`sim_3d_box`, `layout_2d_canvas`) MUST preserve 100% feature parity with the built-in 2-pane HTML — including `viz-split`, drag handles, and collapsible pane splitters via `makePanesCollapsible`. Built-in wizards (like `Corner`) remain baseline-protected on their native 2-pane renderer for full stability, while custom block-authored wizards utilize the new `split_horizontal` / `split_vertical` layout engine. Porting built-in wizards over to block templates is deferred to a future session.
SEAT B (../ddcs-studio-lane-b, window never yet opened): lathe-visual turn · THE 2D RETIREMENT ·
workspace name=filename (its rename lands → seat A's menu absence-lock flips by design).

## ⚠ POSSIBLY-STALE note (was "ONGOING, turn 101" — ~1350 turns old; VERIFY before acting)
An ancient fresh-advisor note claimed the single-axis boss preview anchors the probe START at the
WCS origin instead of the per-pass start ①. The probe/preview stack has been rebuilt many times
since (pass anchors t94/t107, marker-derived traverses, the machine-frame sim); treat as UNVERIFIED
history, not a live defect — re-measure in the real render before touching anything.

## 🔧 Session log (2026-07-18/20) — export-header L1 bug + spindle gap + Defender FP (all resolved)
Surfaced by inspecting a real surfacing program on the **CNC-FAIRY** controller pendant.
- **✅ FIXED + PUSHED (`917f8856`) — nested-paren title breaks line 1 on the DDCS M350.** `editorManager.buildProgram()` (the SHARED export/transfer path, every wizard) derived the file title from the program's first non-empty line; when that line wasn't already a clean `( comment )` — e.g. the `G90   ( absolute )` header — it used the raw line *including its parentheses* as the title, then wrapped it again → `(G90   ( absolute ))`. The controller rejects the nested `( )` with **`Unrecognized characters:L1[]`** (reproduced on the pendant). **Fix:** strip parens from the derived title before wrapping (`title.replace(/[()]/g,' ')…`). Filename derivation unchanged (`g90_absolute.nc` preserved); a proper `( descriptive )` header still passes through untouched. Verified with a standalone node check; pocket golden `goldenDiffs:0`. File: `web/ui/editorManager.js`.
- **✅ RESOLVED (V2026.07.19.1, on another PC) — the dead-spindle gap.** A cutting program could emit `M5` (spindle off) but never `M3` (spindle on) when RPM resolved to 0 (op carries no rpm AND no profile `defaultRpm`) — e.g. surfacing has no RPM field → it plunged with a dead spindle. Fixed the **per-cutting-op** way (exactly the recommended direction, NOT a blanket header change): `spindleHeadPatch` (`blocks/dataOps/spindleHead.js`, commit `3d0315c0`) makes the 6 cutting data-op twins (surfacing/drill/pocket/contour/bore/slot) inherit the live machine **Head** spindle at build; **tap + text opt out by construction** (tap's cycle owns M3/M4/M5 — the `rpm 0 → no M3` contract is preserved), a picked-tool RPM still wins. PLUS a **preflight dead-spindle guard** (`a2029e7c`) that flags a cutting program with no M3 and gates the send. Tests: `spindle-head-inherit-945`, `spindle-guard-947`. *(An earlier blanket `cuttingBlocks.headerBlock` default was tried here and REVERTED because it would break tapping — do NOT reintroduce it; the shared-header `rpm 0 → no M3` is the tapping contract.)*
- **✅ Defender false positive on `DDCS-Studio.exe` (Trojan:Win32/Sabsik.TE.A!ml) — diagnosed + mitigated.** ML/heuristic FP on the **unsigned, low-prevalence PyInstaller `--onefile`** release binary (download-reputation path). Verified NOT malicious: packaged source has no attacker-command capability — only `netstat`/`taskkill` for local port housekeeping, all network I/O is localhost / own OAuth+telemetry. Mitigation shipped in `build_fairy.ps1` (`c7d2f21f`): `--noupx` + an OPTIONAL Authenticode signing step (`-CertThumbprint`/`-PfxPath`). **User TODO:** report the FP at https://www.microsoft.com/wdsi/filesubmission ("clean", clears it cloud-wide in ~1–3 days) and get a code-signing cert (the durable fix). Optional further ML-reducer: switch `--onefile` → `--onedir`.
- **🧪 Test-env note (CNC-FAIRY):** the full Playwright suite would NOT run on this box — the browser-binary download **hangs on extraction** (`chrome-headless-shell`; the ~114 MB zip downloads fine, then the extractor wedges, likely AV scanning the 192 MB exe — same FP surface as above). Workaround that WORKED: let the download finish, kill the stuck installer, `unzip` the zip from `%TEMP%\playwright-download-*\` manually into `ms-playwright\chromium_headless_shell-1208\`, `touch INSTALLATION_COMPLETE`; smoke test then green (pocket golden `goldenDiffs:0`). **Full suite still to be run in a clean location.**

### 🔩 AT-THE-MACHINE — finish the DDCS fixed tool-setter (do these standing at CNC-FAIRY)
Full context in [`TOOL-SETTER.md`](TOOL-SETTER.md). Workflow is **NO ATC** — manual tool change, a **single slot T1 rewritten on every change**; **G54 Z0 = spoilboard, SACRED (never rewrite).** The working probe is **`G31 … P2 L1`** (factory `O502` watches mis-resolved `#1075/#1077` and drives through).
1. **Measure the ONE missing constant: setter touch-top height above the spoilboard** (the setter→spoilboard link, the reference that made the raw `TOOLSET.nc` come out ~60 mm wrong). If the setter sits ON the spoilboard = its thickness; else measure spoilboard-surface→setter-top with calipers. No spoilboard contact, no reference tool needed.
2. **Build the single-slot T1 macro:** probe `P2 L1` → compute the T1 offset from `[setter touch #1927] − [stored G54 Z0] − [the constant]` → write **only** T1's offset (`#1430`), **never** the WCS/G54 Z. Rewritten each manual tool change.
3. **Jog-verify before cutting:** set a tool, jog to G54 Z0, confirm the tip sits on the spoilboard. If it's off by ~2× the height, the offset **sign is flipped** — invert it. Do NOT run a program until this reads right (a wrong tool offset crashes).
4. **Optional but clean:** minimal `O502` edit — fixed-path `G31` `P#1075 L#1077` → `P2 L1` (backup at `S:/slib-g.nc.bak`) so the **factory** setter button also triggers.
5. **Parked (DDCS-support question):** short `G53` machine-coord moves crawl (tool-set approach slow when starting near the setter, fast when far); normal rapids fine; not accel/speed/jerk/`#571`.

### Follow-ups surfaced this session (not yet built)
- **✅ SHIPPED (V2026.08.04.1) — built-in wizards now always populate their `param_group` fields in the Blocks tab** (was: empty C-shaped `param_group` if you inserted from the CAM editor and then clicked the Blocks tab). `devMode.js` had injected the fields only on explicit "Customize as blocks" or palette drags, leaving the core template unpopulated. **Fix:** moved `materializeParamGroup(def)` down to `registerUserOp(def)` in `userOps.js`. Now, the `param_group` fields are dynamically generated into the wizard template exactly once at app registration time. `instantiate` therefore always clones a fully populated template, meaning `ddcsLoadBlockStack` seamlessly reveals the fields whenever the Blocks tab is opened. Idempotent design ensures custom wizards remain untouched.
- **Wizard Authoring UI Cleanup (`param_group` vs `devMode.js` checkboxes).** The system currently supports two authoring paths for wizard UI. The "new" way (S5.1) uses explicit `param_field` blocks inside a `param_group` at the top of the wizard, keeping execution blocks clean. However, `devMode.js` still injects the old "quick-expose" inline `knob [ ]` checkboxes on every numeric field of every block (e.g. `Surface Raster`). When users manually build a `param_group`, these injected checkboxes create massive visual clutter on the execution blocks. **TODO:** Add a mechanism in `devMode.js` (around line 358) to toggle off or suppress the inline `knob [ ]` checkboxes when a wizard uses explicit `param_group` authoring.
- **✅ SHIPPED (V2026.07.21.3) — cutting ops now honor the tool/form RPM** (was: ignored the tool table's RPM, used the machine Head). Built exactly as prescribed below: a socket-held `rpm` binding → progstart (blockIndex 0 / match:progstart for pocket) on all 6 cutting data-ops; the tool-pick fill already writes the tool's rpm to the field, so it now reaches `M3 S<rpm>`, and spindleHeadPatch yields to it (no-tool still falls back to the Head). Byte-identical when rpm==Head default. _(original analysis, for reference:)_ Picking a library tool copies its Ø/feed/plunge/**RPM** into the wizard fields (`toolFieldMap`), but the cutting **data-ops bind `feed` and NOT `rpm`** — `rpm` was left an unbound frontier (`surfacingData.js` etc.), so the tool's speed never reaches the program's spindle line; `spindleHeadPatch` (V2026.07.19.1) then fills it from the machine **Head defaultRpm**, and its "explicit rpm wins" guard never fires because the RPM never got in. **Net: ops spin at the Head RPM, ignoring the tool's RPM** (feed *does* track the tool). Confirmed in code (`blocks/dataOps/*Data.js`, `wizards/toolPicker.js`, `blocks/dataOps/spindleHead.js`). **Fix:** bind `rpm` as a single socket → progstart (`blockIndex 0, key 'rpm'`) in the cutting data-ops (surfacing/pocket/contour/bore/drill/slot/text); the tool/form rpm then wins, and no-tool still falls back to the Head (spindleHeadPatch yields to an explicit rpm). Re-anchors the emit goldens; **coordinate with the spindle subsystem the other PC just changed.**
- **✅ SHIPPED (V2026.07.20.5) — mill/probe export titles now derive from the op model** (was: junk `g90_absolute.nc`). `editorManager._firstOpTitle(code)` derives the title from the op MODEL (opLabelOf + WxH → "Surfacing 367x45"), gated on `proj.text===code`, single-file + op-agnostic (covers mill AND probe), no emit change. _(original:)_ The export title + filename come from the program's first non-empty line (`editorManager.buildProgram`), but mill ops lead with `G90 ( absolute )`, so a surfacing export becomes `g90_absolute.nc` with no meaningful name (at least surfacing; likely all mill ops). **Fix:** have each mill op emit a descriptive leading comment (e.g. `( Surfacing 367x45 )` / `( Pocket 80x60 )`) so `buildProgram` picks it up as a clean, meaningful title + filename (the paren-strip fix `917f8856` already guarantees it can't nest). Files: the wizard/data-op program headers (`programFraming.makeStart` / the framing emit) + per-op naming.


> The single canonical backlog. **Code-verified 2026-06-25** by a 95-agent pass (extract every item from the old
> planning docs → adversarially check each against the actual code → synthesize). Of 89 backlog items across the
> former docs, **52 were genuinely outstanding and 37 were already shipped** — the staleness that motivated
> collapsing many overlapping docs into just two.
>
> **Companion doc:** [`NEXT-SESSION.md`](NEXT-SESSION.md) — the live handoff (current state + the immediate next task).
> This file supersedes `NEXT-TASKS.md`, `docs/WIZARD-PLATFORM-VISION.md`, `CRAZY-IDEAS.md`, `FUSION-INTEGRATION.md`,
> and the `docs/` planning notes — all now under [`docs/archive/`](docs/archive/) (preserved, not deleted).

## How to read this
- **Tiers:** NEAR (do next) · MID · STRATEGIC (the vision endgame). **Effort:** S / M / L / XL.
- Every item was checked against the code. Items verified **already shipped are NOT listed** (they're in the archive).
- App code lives under the nested `DDCS-Studio/web/` (the git root has a doubled `DDCS-Studio/` dir); file paths below are relative to `DDCS-Studio/`.

---

## Recently Shipped (Session Updates)
- **BYO CLOUD — send a job over the internet through YOUR OWN Google Drive (2026-08-19, V2026.08.19.2-.6)**:
  the "anywhere" leg of the topology, PROVEN LIVE on the human's account (job written → claimed → read back →
  upserted → cleaned up), not by mocks. A stdlib-only `DriveBackend` — deliberately, because `r2.py` needs
  boto3 which the exe build EXCLUDES, so the R2 cloud path could never actually run in the shipped app. Plus:
  ONE account door (a header avatar) replacing two sign-ins that disagreed about their own shared credential;
  a CLIENT (phone / unwired PC) can now send with no gateway at all, writing straight into the Drive inbox the
  gateway polls; and sign-in itself — broken for EVERY user by an OAuth-block ordering bug — fixed for fresh
  AND existing installs, with Google's real reason now surfaced instead of a bare "Sign-in failed".
  ⛔ **One gateway on Drive is safe; a SECOND one is not yet** — two gateways share one inbox and the
  wrong-controller guard is inert while `machine_id` is unset. Namespacing the inbox per machine is the fix
  and is scoped in `ROLES-PLAN.md`. **Next: the PC ROLE system (gateway vs client)**, whose absence is what
  made a phone's Send button silently dead — see `ROLES-PLAN.md` and `BACKLOG.md`.

- **Tool-library / feeds / units arc + depth GUI (2026-07-21, V2026.07.21.1–.10)**: (1) **dual mm/inch + IPM display** — on the op forms (mm-native, byte-identical, the inch/IPM hint sits left of the input, 4-digit) AND the **tool-library editor** (Ø/length in inch, feeds in IPM) via ONE shared `ui/units.js` leaf (MM_PER_IN/toDisp/fromDisp, ~4 consumers, drift designed away). (2) a declared **tool catalog** (`data/toolCatalog.js`, 30 templates: flat/ball/tapered/vbit/surfacing/drill, imperial+metric) with an **＋Add-from-catalog** picker in the tool library. (3) the **cutting-op RPM** fix — a socket-held `rpm` binding → progstart on all 6 mill ops, so the tool/form rpm reaches `M3 S<rpm>` (was always the Head default; spindleHeadPatch yields to it). (4) the no-tool **cut-feed default → 2000** (surfacing/contour/pocket/slot + line/move/arc; bore/drill/plunge unchanged). (5) **soft-limit asymmetric per-end** box — envelopeCheck reads the real per-end #161-168 min/max (±9999 = unbounded sentinel), closing a machine-confirmed false-green. (6) **corner probe start-marker Z-drag** fixed — an X/Y drag no longer moves the sim start Z (sim-only, emit-safe, `!machineFrameTool` so homing's draggable Z persists). (7) the **in-form depth-ruler** (`.zd-ruler` in formWidgets) — a compact Z axis with `depthLevels()` pass ticks + draggable depth/stepdown grips beside the number fields (dual-unit hint preserved), tag `widget:'zdepth'` → any depth op inherits; replaced an explored layout cross-section (reverted). (8) "Modular" dropped from the window title. All byte-identical emit except the feed-default bump (goldens moved only the feed value).
- **The G53 safety arc (complete)**: every safe-height retract on every controller is machine-frame with an adjacent G90 (jump-proof, factory-grounded), a boot-seeded margin register with an unset-guard, and a corpus guard covering the wizard AND CAM-slot emits. Found and driven by real field crashes.
- **Pre-flight envelope check**: the editor badge reads the program's travel in the machine frame before anything runs — "line N exceeds Z+ by 3mm", honest amber when the placement isn't declared.
- **Honest Mach column**: the sim's machine numbers quote only a DECLARED WCS row (dash otherwise); an impossible positive Z on a top-homed machine is flagged as you type it.
- **The Library**: one door for Profiles · Projects (local + cloud) · Wizards, with the compact 9-row menu; select-then-load everywhere.
- **Time estimates** (editor chip + per-op), **drill patterns** (bolt circle / row / grid, single-hole default), **one-file backup** (preview-confirm restore + safety export), **setup sheet** (print-ready, honest rows), **depth entry everywhere** (plunge/ramp/helix on pocket, slot, contour, surfacing).
- **Suite structural diet**: the full gate 21min → ~11.5min reliably green (in-memory per-run server, workers=4, no asserts weakened).
- **Settings Auto-Save Visual Feedback**: Added a "Saved ✓" toast notification to indicate when settings are automatically saved to the active profile.
- **Profile Field Editing**: Added a "✎ Rename" button to the Library Profiles tab to easily rename the active profile.
- **Next up**: minimap removed in favor of a preview progress bar + a follow-execution editor toggle (ratified); then feeds & speeds and the rest of the 17-item backlog (NEXT-SESSION.md is the live queue).

## Controller Params — read, drift, and the write strategy (designed 2026-07-16)
One new surface + one standing law, detailed in **[PARAM-WRITE-STRATEGY.md](PARAM-WRITE-STRATEGY.md)**:
- **Gateway → Params**: the controller's own parameter tree (generated from its eng dictionary — never a hand-rolled list), with search, per-profile ★ favorites, and a live-vs-profile drift filter. Settings keeps the persisted snapshot (the record); Gateway is the operating room.
- **The write law**: programs never write controller state (scratch-var reads only); the boot macro belongs to the user; deliberate changes go through explicit, confirmed, history-visible channels only — either the controller's **own import** (Studio stages the native file, the machine applies it) or a **param macro** run-once job (factory-precedented: slib-g.nc writes #655 live).
- **Build gates on three at-the-machine experiments** (soft-limit enable ritual · restore/reboot behavior · macro-writability mapping discovery) — the machine testifies about itself before Studio grows a pen.

---

## Feature Ideas (Candidate Backlog)
- **SVG icon library**: Implement a comprehensive internal SVG library to replace inline icons and clean up UI components.
- **Per-point Z coordlist**: Allow users to specify discrete Z heights per coordinate point instead of a single depth per operation.
- **Sim intent v2**: Upgrade the simulation model to better capture operational intent and visualize toolpaths more accurately.
- **Community wizards**: Develop a platform or sharing mechanism for users to publish, discover, and install custom-built wizards from the broader community.
- **✅ SHIPPED (V2026.07.21.1 forms + .8 tool editor)** — **Dual mm/inch display on input fields** (user request 2026-07-20): show both units on select numeric inputs (e.g. a live "= 0.5 in" hint beside a mm field, or an inline unit toggle), so shop users who think in inches can read/enter values without converting. Scope to the fields where it matters (dimensions/feeds/clearances), not every input; the app is mm-native so this is a DISPLAY/convenience layer — no change to emitted G-code. **Includes dual FEED units — mm/min ⇄ IPM (inches/min)** on feed + plunge fields (feeds are the other axis machinists think in imperial), same live-hint/toggle treatment, same mm-native storage. Files: `web/ui/formWidgets.js` (the numeric widget + a length-vs-feed unit-kind so it converts ×25.4 for lengths and mm/min↔IPM for feeds), settings for a default-display-unit preference.
- **✅ SHIPPED (V2026.07.20.6, "Skim" mode)** — approach **B (whole-op G91)** was chosen (A/G92 rejected: G92 is unmodeled in the trace/envelope/opSimStarts reasoners → would misreport safety). `relativizeProgram` (rotateProgram.js) makes the whole op relative to the jog origin; the machine-frame G53 safe-Z retract stays absolute; a `skim` emit atom + twin via postInstantiate. — **Surfacing "current position = Z0" Z-mode — for QUICK-AND-DIRTY surfacing** (user idea 2026-07-20): a Z-reference option so surfacing (candidate: other mill ops too) treats the **CURRENT machine position as top-of-stock Z0** — the jog-down-to-touch-then-face workflow with **no WCS-Z set at all** (skip the setup ceremony; jog-and-go). This is explicitly the fast/rough facing path, not the precise-datum one. Two emit strategies the user identified: **(A) temporary Z zero** — emit `G92 Z0` (or the controller's set-work-Z) at op start so the current pos = Z0, run the op ABSOLUTE, then **CLEAR it** (`G92.1` / restore) at end so it can't leak into the next program; simple emit but `G92` is STATEFUL → verify DDCS M350 `G92` behavior + how it composes with the WCS and the machine-frame `G53` safe-Z retract. **(B) relative whole-op** — emit the op incremental (`G91`), every Z relative to the start, then restore `G90`; no persistent coord change, BUT the clearance/retract framing, multi-pass stepdown Z, and the absolute `G53` safe retract all assume absolute → bigger rework + riskier. **Recommend (A) with guaranteed clear-on-exit.** ⏸ **OPEN DECISION (deferred): approach A (G92 + clear) vs B (whole-op G91)** — decide before building. ⚠ Changes Z-datum semantics → the preflight envelope / honest-Mach / through-stock checks (machine/WCS-frame reasoners) must understand the mode or they'll misreport. Files: `surfacingWizard.js` + a Z-mode param, `programFraming.js`, the preflight checks.
- **✅ SHIPPED (V2026.07.21.10, in-form depth-ruler — PILOT POCKET)** — a compact `.zd-ruler` in the form: a vertical Z axis with `depthLevels()` pass ticks (one-source with the emitter) + draggable depth/stepdown grips beside the number fields (dual-unit hint preserved via numberWidget reuse); tag `widget:'zdepth'` → any depth op inherits. **Design journey:** explored a true cross-section in the layout canvas (V21.9, reverted) → the user chose the simpler in-form ruler (no per-op cross-section shape). **⏳ ROLLOUT PENDING:** only pocket is tagged; surfacing/contour/slot inherit by tagging their depth+stepdown bindings (tiny declarative change, reusable widget exists). — _(original idea:)_ a compact side/Z-profile diagram **two-way-bound to the `depth` + `stepdown` fields** — the single most-wanted piece. **The two fields stay the source of truth:** typing in a field live-redraws the diagram; dragging a handle in the diagram writes back to the field (same bound-widget pattern as the existing 2D canvas handles). The diagram shows the stock top, the total **Depth**, and the **Stepdown** levels as stacked pass lines, with a **live pass count**. For the ops where depth/stepdown matter (surfacing/pocket/contour/slot). Verified confusion (2026-07-20): the fields DO work, but the flat top-down preview + no inline count make them feel dead (changing stepdown alone when it ≥ depth shows nothing). Field NAMES are fine as-is (keep "depth"/"stepdown") — VISUAL layer, not a relabel. Simplest first slice = the live "→ N passes" readout beside the fields (Vectric pattern); the draggable Z-profile is the richer follow-on. Keeps the numeric fields; no emit change. Files: a new depth-profile canvas widget bound via the field-sync mechanism (`viz/canvasWidgets.js` gesture or `formWidgets.js`) + the mill views (`wizards/views/*View.js`).

- **Pause & confirm between passes** (user idea 2026-07-21): a reusable USER-COMPOSABLE block that halts the program and asks the operator to continue — emits an operator message (`#1505` on Expert) + `M0` (program stop); the operator inspects the finish / clears chips between passes and presses cycle-start to resume (or aborts = "no"). **Two entry points, one atom:** (1) a **standalone "Pause / Confirm" op** the user drops anywhere in any program (composition); universal fallback for non-Expert posts = bare `M0` + a comment. (2) a **"confirm every N passes"** field on surfacing (+ pocket/contour/slot) that auto-inserts the pause in the pass loop (N=1 → after each pass). The practical shop pattern (face → stop → inspect/clear → continue-or-bail). `M0` gives continue-or-abort; a richer **yes/no/skip** would use a `waitInput` on a physical button ([[io-automation-feature]] I/O class) — a later upgrade. Fits the wizards-as-data composition north star. Files: a new pause/confirm op atom + the multi-pass emit (surfacing pass loop / the fill kernel).

- **CAM Builder wizard** (TO BUILD — it's a WIZARD, not a from-scratch surface; own branch; Expert-only). **INPUT MODEL (user-corrected t1030):** you build a program the NORMAL way (insert ops into the editor), then the CAM Builder **IMPORTS that inserted program and EXTRAPOLATES the field-table + params from it** — it is a "turn this program into a reusable CAM slot" converter, NOT a compose-from-scratch surface. Feasible because an inserted program already round-trips to the op-stack via `( @DDCS )` markers, and the CAM generators already turn ops → parametric macros: `inserted program → (markers) → op stack → (CAM generators) → CAM slot + extracted table`. It FEEDS the existing Macros-tab CAM Pack Builder + file tree (the assembler/installer). The NEW bits: (1) import + walk the inserted program's ops, (2) an **expose/bake** flag per param (operator-knob → `#2600+` register, or frozen literal), (3) **Build → slot-confirm modal** (new cam-N vs overwrite). **Full code-grounded plan** (~70% already exists) in `DDCS-Studio/scratchpad/cam-builder-plan.md`: the reuse map, the `allocFieldsWith` expose/bake mechanism (all-exposed = byte-identical), the **enum-dropdown authoring table** (the #1 GUI element; the pendant eng table is NUMERIC-ONLY so Studio maps enum↔int + documents options in the label), 5 rulings, build slices S0–S4. Files: `probeToSlot.js`, `macrosApp.js`, `slotPack.js`, `millToSlot.js`, `programModel.js`.
- **Snapshot → icon / image export** (PLANNED, user t1046 — small, high-value polish). Grab the 3D preview / 2D feature canvas as a PNG via `canvas.toDataURL()`: (a) in the **CAM Builder** — a 📷 "use preview as icon" that downscales the snapshot to the pendant's **360×180 BMP** (reuse `autoIconBmp`/`bmpDataUrl` — a THIRD icon source beside auto-render + hand-draw, still editable after); lands in the CAM Builder's ICON step (right after S1d). Synergy with baked-choice slots: a baked "FL corner" slot previews exactly that → snapshot = an unmistakable icon. (b) in **wizards** — a 📷 "save image" that downloads the preview PNG to the local drive (in the exe, to a real path). WebGL grab needs `preserveDrawingBuffer` or a grab right after render. Small + contained.
- **CAM Table as a declared C-mouth — reorderable field blocks** (PLANNED, user t1072-73 — the "the wizard block declares its own pendant table" endgame; after the customize affordance + S5). Today the CAM slot's sidecar `.eng` field-table is DERIVED at build (classifier + the modal's expose/bake). **USER DESIGN:** a THIRD mouth on the custom-wizard block (beside Presentation + Execution) — a **CAM Table** mouth holding INDIVIDUAL field blocks, ONE PER op param: each **param-KEYED** (auto-appears when a param is added, vanishes when removed → mirrors the op) but **freely REORDERABLE** (drag → the field order IS the operator's pendant-FORM layout — the real reason for individual blocks over one dynamic-rows table). Each field block declares **expose/bake + the pendant NAME** (+ range/units); the classifier still guards (geometry params = Bake-only, greyed). **ONE-SOURCE:** the field blocks ARE the config; the `.eng` sidecar is EMITTED from them (exactly as the macro is emitted from the exec atoms) — ONLY the `#2600` slot NUMBERS (allocator, collision-free across the pack) + the emitted `.eng` are derived, never the config. The expose/bake **MODAL becomes a VIEW/editor** of these blocks (two views, one declaration — the wizards-as-data pattern). RULED Option 2 (individual blocks) over a single dynamic-rows table block (user t1073) BECAUSE drag-reordering the pendant fields is genuinely useful + natural with real blocks. Architect to spec: the param↔field-block auto-sync, drag-reorder→pendant-order, and the modal-as-view.
- **Block-native FORM params — populate `param_group` (the form-side twin of the CAM Table)** (PLANNED, user t1073 — one coherent brief with the CAM Table above). The Presentation-mouth `param_group` block is EMPTY on data-op twins because they carry their form fields in the **bindings**, not as `param` blocks (user noticed the "always empty, doubled 'group' label" block). **DON'T hide it — POPULATE it**, even on a built-in/twin op: generate the `param` blocks FROM the bindings so the form fields show + are editable as blocks. **ONE-SOURCE (the crux):** make the `param` BLOCK the field-declaration source (name/type/default/label/widget) and SLIM the binding to just the WIRING (`param → socket`) — today the binding carries both, so splitting it puts the field in exactly one place (no drift). Net symmetry: **FORM params = `param` blocks in `param_group`; PENDANT params = field blocks in the CAM Table mouth** — the wizard block fully declares both forms, block-native, one-source (the wizards-as-data north star). Also fix the doubled-label wording ("Parameter Group group X" → "Parameter Group: X"). A real refactor (each twin's bindings + render the form from the param blocks + round-trip) — architect specs it WITH the CAM Table as one piece.
- **Universal CAM** (BACKLOG — the ambitious one). Make EVERY wizard CAM-compatible, not just the CAM Builder. The concrete per-wizard work (user-framed t1030), in order of how much it costs:
  - **NUMBER fields (depth/width/feed/RPM) = FREE.** Already a number → maps straight to a `#2600+` register, nothing to do.
  - **CHOICE fields (corner/direction/strategy) = the real, unavoidable work.** The pendant eng table is NUMERIC-ONLY, so every enum option must be DECLARED an integer (`corner: front-left=1, back-left=2, back-right=3, front-right=4`) — a choice with no number literally can't be sent to the pendant. Cheap DATA (one number per option, one source feeding both the Studio dropdown and the pendant), but must be authored per wizard, one at a time. This is what the user means by "program the options with numerals."
  - **COMPLEX geometry (pocket raster/contour/surfacing) = the hard part.** The toolpath must be RECOMPUTED at runtime by a parametric-LOOP macro (à la millToSlot — "not a verbatim port"); you can't `#2600`-substitute an unrolled toolpath into a loop. Each complex op needs its own parametric-emit variant.
  So Universal CAM = number the choice-fields per wizard (declare enum↔int) + a parametric-emit variant per complex op. Only needed for a wizard the day you make THAT wizard CAM-able — not a big-bang rewrite; the app stays named-and-friendly (the numeric map is a side-note per op, not an internal conversion). Deferred — needs more design.
- **K-button wizard + action library** (PLANNED — user t1044, after the CAM Builder; the CAM Builder pattern pointed at K-buttons). A friendly GUI to author a controller **K-button** (a custom soft-button in the Macro tab that fires an action) — instead of hand-writing its macro, you pick an **action from a library**, fill a small param form, add a label + icon, and assign it to a K-key. **ARCHITECTURE (user-shaped t1044): the actions are BLOCKS — a NEW Blocks category.** Each action = a DECLARED atom (`jog`/`go-to-WCS`/`go-to-screen`/`home`/`run-macro-or-CAM-slot`/`send-M-code`/`toggle-output`) that surfaces as a block in the new "Actions" category ([[wire-blockly-roundtrip-new-features]] — every new atom is a block + emit + reverse-sync). A **K-button = a small block STACK** (one or a few action atoms) assigned to a K-key + icon. So it slots straight into the one-stack/many-views IR: the **wizard is the friendly door** (pick from the palette), **Blocks is the compose view** — two views of the ONE stack, exactly like the wizards-as-data twins. **REUSE (~70%, like the CAM Builder):** the icon editor, the param-form widgets, and crucially the actions ARE mostly EXISTING Studio atoms (jog/move, WCS, `setOutput` from the [[io-automation-feature]]) — the palette curates them; the Blocks round-trip + `opStacks` builders + emit + reverse-sync are inherited free. So the build ≈ (1) declare the action atoms (many wrap existing ops), (2) the new Actions Blocks category, (3) the K-key assignment + icon + the friendly wizard front-end, (4) emit the K-button macro + install to the controller. **Expert-ONLY** (user t1044 — K-buttons are an Expert controller feature, like CAM + I/O automation; gate the whole builder behind the Expert profile). A K-button is essentially a tiny CAM slot (a macro on a trigger — a K-key vs a slot number), so the CAM Builder machinery transfers. **GROUND-TRUTH FOUND (t1044, advisor) — the navigation library is a DECLARE, not a build:** the DDCS `#2037` virtual-button mechanism presses ANY of **201 panel functions** from a macro via `#2037 = 65536 + [KeyValue − 1000]` (+ `G4 P1` to let the screen settle) — `[CONFIRMED ON MACHINE 2026-06-10]` (FINDINGS.md:290-298). The COMPLETE 201-code table is already in the ddcs-expert skill: `references/Virtual_button_function_codes_COMPLETE.xlsx` + the readable `references/virtual-buttons-2037.md` (16 NAVIGATION screens — Monitor 1373 / Program 1374 / Param 1375 / IO 1376 / Probe 1323 / Work-Zero 1321 / Home 1322 / Manual 1326 / MDI 1348 / Coord-Set 1387… — plus jogging, feed/spindle overrides, G54–G59 1391-1396, Start/Pause/Reset). So the action library = ONE declared code table (from the xlsx) + ONE "virtual button" emit atom; a "navigate" block picks a screen → emits the formula. The physical-key binding half (how a K-key runs the macro: cfg K-value 0=run key-N.nc / 1-32=toggle OUT1-32 / >1000=function shortcut) is in `references/k-button-assignments.md` — read at plan time. NOTHING to source from the pendant. NOT started — concept + ground-truth captured; code-grounded build-plan when the CAM Builder lands.

---

## North star (the *why*) — total wizard control by the user

Every wizard becomes **data, interpreted** — not hand-coded JS. The moment a user can edit *any* wizard, the built-ins
lose their privilege: shipped ops become the **default library** — open, fork, override, delete, exactly like a user's
own. The app **self-hosts in its own wizard format**; "reset to factory" = reload the shipped definitions.

The value is one floor up from the primitives (no user out-designs the built-in edge-probe): it's in **composition**
(stringing ops into shop-specific jobs), **specialization** (collapsing a general op into a one-click recurring case),
**the long tail** (the machine/material/controller we can't ship for), and **distribution** (one expert authors,
thousands run). **Atoms = the controller's instruction set (fixed). Ops = compositions (user-authorable).** The honest
floor: the validator guarantees the **protocol** (won't break the controller), never the *meaning* of an unseen thing —
that semantics belongs to the author. Real-time loops (plasma THC) stay below the floor, delegated to the controller.
Full essay: [`docs/archive/WIZARD-PLATFORM-VISION.md`](docs/archive/WIZARD-PLATFORM-VISION.md).

### 📐 WHAT IS ACTUALLY DECLARED — the three legs, measured 2026-08-09 (advisor)

The north star says *every wizard becomes data*. Measured against the live registry, that is **two-thirds true**:

```
  EMIT     32/32 declared   a block stack + bindings; fork-parity-1593 forks all 32
                            twins byte-identically across a 152-flip structural sweep
  FORM     32/32 declared   param · type · default · label · section · widget ·
                            options · help — rendered generically by renderOpForm;
                            nobody writes form HTML per wizard
  PREVIEW   0/32 declared   hand-written renderers, each deciding independently what
                            frame it draws in, what a handle looks like, whether a
                            thing is drawn at all
```

**Every defect the user hit on 2026-08-09 lived in the third leg**, and the emit was correct through all of them.
The reason it went unnoticed: `preview-only, emit unaffected` was (correctly) a *safety* argument and slid into
meaning *needs no declaration and no gate* — and ~2450 tests assert emitted text and data structures while
essentially **none render anything**, so a preview defect cannot turn a test red. The only detector was the user.

**ARC A — PREVIEW AS DATA (next, being scoped).** One declared source per presentation fact, read by every
renderer in a pane. ⚠ **The make-or-break is the GATE, not the declarations**: the emit port had byte-identity as
its proof; the preview has no equivalent. If a preview-equivalent of byte-identity cannot be built cheaply, the
arc should not start — build the gate first. Known members: the coordinate frame (t1672/t1686 — two renderers in
one pane disagreeing), does-this-handle-drive-the-emit (t1684, `emits`/`teal`), handle affordances (t1680
`onEdit`, t1674 `noSnap`). Cheaper alternative if the full arc is refused: frame + emit-driving contract only.

**ARC B — VALIDATION AS DATA (after A).** Today every lint rule is hand-added per case, so a field is checked only
if someone remembered — the same shape as the four declared-but-unread findings in the t1678 census. Known
members already in the queue: `ifgoto` lhs/rhs unlinted (its own note says it *needs a declared
expression-bearing-but-string-defaulted discriminator*), an `IF`'s children never linted (the walk skips `cond`),
the shape-field typo hook (a typo skips silently), and t1668's real hazard — `' #500;M30 '` emits
`G0 X#500;M30` and `defaultSyntaxVerify` returns **valid**. Safety-adjacent: the failure mode is malformed G-code
passing the send gate. Shape: an atom DECLARES what its fields must satisfy; one validator reads it.

**ARC C — DIALECT AS DATA (with the porting arc).** Per-controller facts are discovered by hardware test and then
hand-written into each emit site. t1634 is the worked example: the Expert REJECTS the Fanuc slash form
`ATAN[a]/[b]`, the comma form is hardware-proven on both controllers, and the fix was two hand-edited emit sites.
`trigEvidence.js` already records that the ATAN form is *dialect-scoped* — the REASON is written down, the
DECLARATION is not. A second target multiplies every such fact. See also `PORTING.md`.

**Order is deliberate: A, then B, then C.** Three half-declared layers is worse than two finished and one not
started — 2026-08-09 is the evidence for what a half-declared layer costs.

### ⚑ Key reframe (code-verified): the "staged engine" is largely **already built**
The vision doc framed expressions/loops as future work. They ship today:
- **Stage 2 — expressions in the blanks:** `wizards/ops/expr.js` `evalExpr()` (recursive-descent, no `eval`), wired through `blockEmitter` `resolveValue/resolveBool`. Any value socket already takes `depth*2`-style expressions. ✅
- **Stage 3 — loops / control flow:** `count.js` (loop + live index, 100k cap), `iff.js`, `compare.js`, `array.js` (stamp, 4 patterns), `flow.js` (label/goto/ifgoto), `helix/stepdown/stepover/fill`. Far beyond "one loop." ✅
- **Raw-emit atom tier:** `macro.js` `rawBlock`/`mcodeBlock` + `assign.js` (`#N=expr`) — the "raw / you own the meaning" escape hatch. ✅ (What's missing is only the *visible label/contract* — see MID.)

**So what remains of "wizards-as-data" is Stages 4–6:** express ONE built-in *as a data definition* + assert
output-equivalence → port the rest one-by-one → self-host (forkable built-ins + reset-to-factory). See STRATEGIC.

---

## Wizard-maker — NEAR (do next)

### 1. ✅ SHIPPED (`ef0ee43`) — Track A icons: re-icon any wizard + line-art picker
Done. A shared `ic:<id>` registry (`web/ui/wizIcons.js`) backs both the bar and the picker; an `iconOverride`
(emoji or `ic:<id>`) wins over a built-in's default line-art; the icon button is ungated (built-ins re-iconable).
*Follow-up = MID "curated line-art SVG icon library" (a larger/new glyph set + folding in the header icons).*
The emoji icon picker shipped; this completes it. Smallest standalone win; substrate already in place.
- `commandDeck.js` `wizItemIcon`: check `iconOverride` **before** the unconditional `WIZ_ITEM_SVG[e.id]` return, so an override can win for the 8 SVG-iconed built-ins.
- Extract `HEADER_ICONS`+`WIZ_ITEM_SVG` into a shared `ic:<id>` registry; add `ic:`/SVG rows to `ICON_CHOICES` + render SVG in `openIconPicker` cells and the bar.
- Drop the `kind==='user'` gate (`wizardManagerPanel.js:291`) so built-in rows get an icon button. Keep `ic:` SVG trusted/curated (injected as raw HTML; labels are `_escHtml`'d).
- Files: `web/ui/commandDeck.js`, `web/ui/wizardManagerPanel.js`, `web/blocks/wizardLibrary.js`.

### 2. ✅ SHIPPED (`105c837`) — In-block ✎ editor for the coordinate-list positioner
Done. The editor core is `formWidgets.buildCoordEditor` (shared by the form widget + a new `openCoordEditor` modal);
dev-mode grows a ✎ pencil on `coordlist` blocks → `devMode.openCoordAuthor` reads/writes the `PTS` field + redraws.
*Still open (coupled): `extractParamBlocks` ignores coordlist pills, so coordlist can't yet become a saved wizard knob (needs NEAR #4's non-numeric param mechanism).*
The handoff's explicit next-up after V10.36; completes coordlist as a dual-surface authoring widget (matches region-pick).
- Mirror region-pick: `devMode.augment()/clearAugment()` branch for `coordlist` → pencil `FieldImage` → `openCoordAuthor(blk)`; read/write the **`pts` field** value (`{points,z}` JSON — *not* `block.data`, the one divergence) → `forceRerender()`.
- The rich editor only exists as an inline closure in `formWidgets.js` (`coordListWidget`) — **extract a standalone `openCoordEditor(initial,onSave)`** (region-pick already has a packaged editor; this doesn't). Add a coord-author spec.
- ⚠️ Coupled gap: `extractParamBlocks` (`userOps.js`) only converts `param`/`regionpick` pills — **coordlist can't become a saved wizard knob yet** (the `list` binding type exists but no authoring path emits it).
- Files: `web/blocks/devMode.js`, `web/wizards/ops/coordlist.js`, `web/ui/formWidgets.js`, `web/blocks/blockly/coordListField.js`.

### 3. ✅ FIXED — App-wide Merge/Replace/Cancel safety net
**The original "resolved-by-analysis" missed one path — now fixed.** The new-op insert path IS append-only
(confirmed), but `blocksApp.js` had an unguarded `replaceOp` call when changing header dropdowns
(CORNER/AXIS/FEATURETYPE) on typed op blocks in the Blocks tab — silently clobbering hand-edited children.
**Fix:** the Blocks-tab field-change listener now checks `isOpBlockEdited` and routes through `mergeOpBlocks`
(3-way merge, preserves injections) instead of the raw `replaceOp` (wholesale rebuild). The wizard edit path
was already guarded (`wizardManager.insert()` → `isOpBlockEdited` → `showBlockEditNotice`). Both `replaceOp`
callers are now safe.
- Files changed: `web/blocks/blocksApp.js` (import `isOpBlockEdited`, guard the field-change `replaceOp` call).

### 4. ✅ SHIPPED — Field-targeting / non-numeric param mechanism — **the load-bearing unlock**
Everything assumes a numeric value socket (valid-by-construction). This gates text/corner-grid knobs, enum/string region values, and (with a part drawing) spatial CAM feature-selection.
- Introduce a param kind that occupies an inline dropdown/text/corner-grid **field** (not a numeric socket); a Blockly field adapter that commits string/enum/code; `extractParamBlocks` emits `enum`/`string` bindings (drop hardcoded `type:'number'`); extend dev-mode `WIDGET_CHOICES`; emitter/marker round-trip for non-numeric commits.
- Form-side widgets (`textWidget`, `cornerGridWidget`, dropdown enum branch) already exist — could be **M** if scoped to enum-via-existing-dropdown first.
- Files: `web/wizards/ops/param.js`, `web/blocks/userOps.js`, `web/blocks/blockly/bridge.js`, `web/ui/formWidgets.js`, `web/blocks/devMode.js`.

### 5. ✅ SHIPPED (2026-06-26) — ONE Blocks mode · live block↔form round-trip · spatial-GUI producer seam
Three custom-op authoring wins landed together (on `main`, redeployed to pages.dev):
- **ONE Blocks mode** — the normal/dev split is dissolved; authoring is **always on** (quiet "knob" markers that light
  up when a value is exposed). One render path. `blocks/devMode.js`.
- **Live block↔form round-trip** — a `FORM [LIVE]` pane in the Blocks tab derives a custom op's form from its blocks
  (no save) and is **two-way**: edit a block → the form updates; edit the form → it writes surgically back to the block
  + the G-code/preview. Editing-context UI (breathing glow + "✎ Editing: <name>" chip) + **non-destructive save**
  (Save-as-new vs an explicit Update). The practical realisation of "a custom op IS its block stack, editable from
  either surface." `blocks/blocksApp.js`, `blocks/devMode.js`, `blocks/blockly/stackBridge.js`, `ui/formWidgets.js`.
- **Spatial-GUI PRODUCER seam** — "2D point/rect (numbers)" authoring → the custom-op preview is **drag-to-edit**
  (a number-role param group renders as paired `data-param` fields, NOT a form mini-canvas; the preview handle writes
  them). Completes the consumer seam (`8b268c6`); closes Gap #3 for the number-role path. `blocks/userOps.js`, `ui/formWidgets.js`.
- *Open (small):* **step 5** — a referential-integrity guard for when a removed knobbed block is referenced elsewhere
  (the corner `#1→#7/#8` case); deferred as edge-casey.

---

## Wizard-maker — MID

1. **[M] One diff at 3 surfaces — ✅ shipped (`5d348af`) then ⤴ SUPERSEDED by declare-edit (`2789c37`, 2026-06-26)** — MID #1 re-based the glow on a reconciler reconstruction (`RECONCILERS`→`BUILDERS`→diff), but that re-derivation IS inference and false-glowed on a blocks round-trip's representation drift (empty move sockets→`0` so `G0 X#9`→`G0 X#9 Y0 Z0`; `#var`→`variable` record). **Declare-edit replaced it:** glow/chip/merge-guard now read the user's RECORDED block edits (on the Blockly change event, `opEdits.js`), persisted in `.mjson`, so drift can never read as an edit; ~134 lines of inference removed. A *surfaced* edit now correctly trips the chip (without the reconciler a Replace would lose it). `opGlow.js`, `opEdits.js`, `blocksApp.js`.
2. **[M] Curated line-art SVG icon library + picker** — the other half of Track A (the glyph set + picker SVG-render path); shares the `wizItemIcon` precedence + `ic:<id>` registry with NEAR #1.
3. **[M] Region editor v1.x — poly/freeform point editing — ⏸ PARKED as low-leverage (2026-06-26)** — the region EDITOR is an *authoring* modal (wizard-maker side, used once to draw a clickable diagram), NOT in the operator/machining loop; and genuine straight-edged-polygon machining cases are rare (L/T pockets, hex stock). The common non-rect need is ROUND → a **circle region** (reuse `shapeStage`'s existing ellipse + bake to an N-gon) is the smaller, higher-value add if this is ever advanced. Runtime/bake already render polygons; only authoring is rect-only. `ui/regionEditor.js`, `ui/shapeStage.js`. (See the GUI-over-fields convention below.)
4. **[M] Per-point Z on the coordinate-list** — evolve `{x,y}`→`{x,y,z}` with a per-row Z input; migrate existing `{points,z:scalar}` state on load. `ui/formWidgets.js`, `ui/coordListSvg.js`, `wizards/ops/coordlist.js`.
5. **[L] Raw-emit atom tier — the *visible* contract** — atoms exist; the user-facing "raw / unsimulated / you own the meaning" label + a parameterized raw G/M template (named-param interpolation, round-trips) + surfacing the silent `GcodeSimulator` skip-counter as per-line "went dark in sim" annotations. `wizards/ops/macro.js`, `engine/GcodeSimulator.js`, `viz/createPreviewPanel.js`.
6. **✅ SHIPPED (2026-06-26) — Federated schema registry `[S]`** — `specOf(op) = SCHEMA[op] || USER_SCHEMA[op]` and `builderOf(op) = BUILDERS[op] || USER_BUILDERS[op]` are now real: built-in `BUILDERS`/`SCHEMA` stay PRISTINE; user ops register into separate `USER_*` layers (4 isolated tables — builder/spec/label/sim-intent; `USER_LABELS` was split out so a user-op delete can never drop a built-in label, fixing the documented `OP_LABELS` leak). All ~13 `BUILDERS[op]` read-sites (opSession ×8, programModel, userOpView, `_framed`) + the 4 opSchema helpers (paramFields/canonOf/revCanon/validate) route through the resolvers; precedence is built-in-first (user opTypes are `user_`-prefixed → disjoint). Substrate for Stage-6 reset-to-factory (= clear the user layer) + distribution-install validation. Tests: `federated-registry.spec.js` (pristine invariant + delete-clears-all-4 + built-in label survives a user delete), `user-ops.spec.js` (updated to the resolver API). *(Adversarially reviewed: MID #6 audited complete — no missed consumer.)* `blocks/opSchema.js`, `blocks/opBuilders.js`, `blocks/userOps.js`.
7. **[L] Sim intent v2** — widen `opSimContext` to `(opType, stock, profile)` returning declared geometry/envelope/magazine **data** so `gcodeViz3d` consumes plain data. Cheap sub-win (S): wire the Blocks preview to show the ATC envelope (`setForceMachine`). `viz/opSimContext.js`, `blocks/blocksApp.js`, `viz/gcodeViz3d.js`.
8. **[M] Homing — first-class `home` block + reconciler** — homing emits generic atoms with no semantic reverse-sync; add a homing block + a `RECONCILERS` entry so the op round-trips into its form. `wizards/homingWizard.js`, `blocks/opSession.js`, `wizards/views/homingView.js`.
9. **[M] Attachment-automation wrappers** — generalise the `placeOnStock` C-block into "run op WITH dust-shoe/coolant/vise": a wrapper block + a wrap emit-fold (output-on → child → output-off, optional `waitInput`) + presets. Document the 5 I/O patterns. `wizards/ops/placeOnStock.js`, `blocks/blockEmitter.js`, `wizards/ops/coolant.js`.
10. **[M] Fixture-backdrop canvas picker** — the likely **3rd concrete pick widget** (forces the deferred generic `pick` extraction). Build concrete on `regionPickSvg`'s backdrop support. Two new prerequisites: an **SVG sanitiser** for imported fixture art (`regionPickSvg.js` mounts raw `innerHTML` today) + a **coordinate map** (fixture↔viewBox). `ui/regionPickSvg.js`, `ui/regionEditor.js`.
11. **[L] CANVAS-WIDGET consolidation — Stage 2 COMPLETE; Stage 3 (declarable-as-data) is next.** A reusable canvas-HANDLE registry (`web/viz/canvasWidgets.js`, the canvas analogue of `formWidgets.js`): gesture types **point / length / scaleX / shear / rect / radial / projLength**, each owning place + drag + click-to-edit, behind `buildCanvasWidgets(decls, setFields) → {handles, onDrag, onEdit}`, so a view DECLARES its handles instead of hand-rolling the drag math (the duplication across every `*View.js`). FeatureCanvas keeps the drag PLUMBING (hit-test → world point) + move/size/corner/stock-snap; the registry just owns the param MATH. **✅ Stage 2 DONE (2026-06-27)** — every view with draggable canvas handles is migrated: **text** (Stage 1), **drill + surfacing** (`0fafda2`), **pocket** (`a6d8f91`), **slot** (`5e6ccae`), **contour** (`c192b36`). (`grep onDrag wizards/views` = exactly those 6 — "array/bore/circular" from the old sweep list are NOT separate canvas views: bore is a drill variant; the rest are probe/rotary views without FeatureCanvas handles.) The gestures added in Stage 2: **`rect`** (2D corner via a per-axis divisor: `1`=W/H · `cols-1`=grid pitch · `0.5`=half-extent radius · `0`=skip axis), **`radial`** (polar → radius + angle; the "rotate" fused with radius; omit `fieldA`=radius-only, omit `rScale`=pure rotate), **`projLength`** (perpendicular projection onto an axis → a symmetric clamped field; slot width). `onEdit` gained an optional `editMin` clamp. Each view gated **byte-identical**: exact-formula unit math (incl. a tilted-axis projLength) + REAL pointer drags (`canvas-widgets`/`{drill,pocket,slot,contour}-canvas` specs); pocket was done 2nd deliberately to discharge the sweep's "rect+radial cover pocket, no rework" claim BY CONSTRUCTION. **Stage 3** (IN PROGRESS — first increment `46c4195`): declarable-AS-DATA in the wizard maker — the custom-op Form+2D preview (`panelTypes.layoutSpecFromOp`) now DECLARES its handles and builds them with the SAME registry the built-in views use (Part A: `point`/`rect` via `buildCanvasWidgets`, `setFields → _writeParam`; behavior-preserving), and a NEW `ncircle` number-role family (2D circle · X/Y/Ø) is authorable end-to-end → the preview maps `{x,y,dia}` to `point` + a radius-only `radial`, so tagging three number params gives a draggable circle with a Ø ring, zero per-op code (Part B — the rule-of-three third shape). REUSE the binding/widget system, not a parallel one. Remaining: more declarable gestures pulled by real authoring need (`length`/`scaleX`/`shear`/`projLength` = one role family + one mapping each), surface the choice in the dev-mode expose flow, and OPTIONALLY migrate the `formWidgets` mini-canvases (the "spare parts"). `viz/canvasWidgets.js`, `wizards/views/*View.js`, `ui/formWidgets.js`, `blocks/userOps.js`, `wizards/ops/panelTypes.js`. (The deferred form-side `stepper` widget is a minor separate instance under STRATEGIC #1's generic-control-spec rule-of-three.)
12. **[L] `macrosApp.js` restructure + `probe.nc` builder + `@DDCS` lint** — split the 1338-line, 4-workflow file by workflow (modularize-first); build the `probe.nc` configurator (currently a title+hint stub); add a lint so Macros output participates in the `@DDCS` declared-intent schema. (`macros-tabs.spec.js` is stale — asserts the old flat-tab layout.) `web/ui/macrosApp.js`, `blocks/opSchema.js`.
13. **[S] Setup checklist — a real "user touched this" flag** — replace the defaults-heuristic so a user legitimately running default values doesn't see a false ⚠. `ui/setupChecklist.js`, `ui/stockEditor.js`, `ui/settingsPanel.js`.
14. **[S] Suppress/hide a factory (seeded) wizard — per-user visibility toggle** — a code-seeded ported op (`seedDefaultPortedUserOps`, create-or-update by `opType`) RESPAWNS on reload when a user deletes it, so a factory wizard can't be removed from the UI (only user-authored localStorage ops delete permanently). Add a per-user **suppressed** set the seed respects (skip re-seeding a suppressed `opType`) + a UI hide/show toggle. Realises the north-star "delete" for factory ops without editing code; pairs with MID #6's reset-to-factory (= clear the user layer). `web/app.js` (`seedDefaultPortedUserOps`), `web/blocks/userOps.js`. *(human t8 — surfaced by the "Corner (data)" dropdown dup.)*
14. **✅ SHIPPED — Learner library — toolbox TREE (⚛ Atoms · 📚 Snippets · 📦 Complete Programs)** (user request, 2026-06-26). Built as a 3-level tree: the ops categories nest under a collapsible **⚛ Atoms** parent; **📚 Snippets** + **📦 Complete Programs** are sibling collapsible groups, each holding themed sub-categories of curated compositions. Each composition is a `{type,params,children}` stack rendered as ONE draggable connected flyout block (`stackBridge.stackToFlyoutBlock` — merges atom defaults so an omitted socket isn't `F0`); `buildToolbox(extraCategories)` is caller-injected (blocksApp passes `learnerToolboxCategories()`) to dodge a bridge↔stackBridge eval cycle. Valid-by-construction (every entry emits clean G-code — `learner-library.spec`). Starter curation: Snippets {Spindle & Coolant, Motion, Probing}, Programs {Milling, Drilling, Probing} — incl. a probe `G31` snippet + a no-spindle Z-touch-off program; the ongoing work is curation. *(Original spec below.)* — two new toolbox groups of pre-composed, **drag-in** stacks for people learning G-code on DDCS: **Snippets** = *bare* stacks (reusable patterns — probe-and-retract, safe-Z lift, WCS preamble) that slot INTO a program; **Complete Programs** = *framed* stacks (small end-to-end examples that run/sim as-is). All **curated + validator-gated** (valid-by-construction, same guarantee as a built-in). Low-infra: a snippet/program IS just a stack — *bare vs framed* is the distinction `appendIntoProgram` already encodes — surfaced as toolbox entries (a new *presentation* of the existing stack concept, not a new kind of thing). Pairs with the shipped **hover-highlight** (drag in → hover blocks → watch the G-code light up) for a self-teaching loop; transparency is already covered by **expand** (op bodies are real stored atoms) + hover. The real work is **curation** (authoring good, minimal, well-commented examples ordered as a gentle curriculum), not code. Keep the category rail scannable (one rail entry per group, sub-group inside the flyout). Later symmetry: same save machinery gives "save selection as snippet" (bare) / "save program as example" (framed). **EXPLICIT NON-GOAL — do NOT build "decompose / explode an op into atoms":** the model says decompose only where structure is *stored* (op header → its child atoms = lossless) and NEVER where output is *computed* — toolpath atoms (`bore/contour/drill/line/slot`) and `array` repetition bake **lossy + irreversibly** (severs the parametric recalc), and probe routines are **safety-critical** (a casual edit on the #var-threaded sequence crashes the probe or writes a wrong WCS). Snippets/programs are *authored* stacks, never auto-exploded from a parametric op. Files: the Blockly toolbox/category registry (`blocks/blockly/*`) + a new curated stack library.

---

## Wizard-maker — STRATEGIC (the vision endgame)

1. **[L] Generic `pick` renderer + unified control spec** — ONE declarative control spec (`{graphic, interaction:{kind:'pick'|'handle', regions/handles}, value, param}`) + ONE generic `field_control` + ONE form-widget interpreter, re-expressing datum + region-pick as built-in specs. **Correctly deferred** — keep concrete until a 3rd pick case (the fixture-backdrop picker) forces it (rule of three). `blocks/blockly/bridge.js`, `ui/formWidgets.js`.
2. **✅ SHIPPED (Stage 4, 2026-06-26) — Wizards-as-data Stage 4 `[L]`** — **drill** is now expressed as a pure `{template, bindings}` data def (`blocks/dataOps/drillData.js`) consumed by `registerUserOp`/`instantiate` via the federated user layer, and the reusable **equivalence harness** exists (`blocks/dataOps/equivalence.js` `emitEquivalence(builderA, builderB, sweep)`). `drill-as-data.spec.js` proves it two ways: **emit-equivalence** (byte-identical to `drillStack` across a grid-at-origin/cut/skip/wcs sweep) + **structural binding-wiring** (every binding routes its param to the same socket `drillStack` uses — the only way to validate the params emit can't reach). **Key finding — drill is ~90% data-expressible** (the per-hole loop lives in the `array` emit fold, so the template is a static 4-block tree). Frontier blockers: **(2, was PRIMARY) live bbox — ✅ SOLVED in Stage 5** (declared per-atom `extent` + live place fold; drill is now FULLY placement-portable — off-origin / circle/line/rect / stock-attach all byte-identical — see #3); **(1) method swap** — `helical` needs a `bore` child (block-type change, not a value) — still open; **(3) fan-out param** — `clearance` feeds 2 sockets (1 binding = 1 socket) — still open. `blocks/dataOps/*`, `blocks/userOps.js`.
3. **[XL] Wizards-as-data Stage 5 — IN PROGRESS** — port the rest of the built-ins to data, one-by-one, each gated by output-equivalence + binding-wiring (reuse `dataOps/equivalence.js`); never batch. Shipped: **`atc_warmup`** (now BYTE-IDENTICAL — its interpolated operator text was made static, `45c6c2c`), the **placement-bbox fix** (below), and **`surfacing` / `slot` / `text`** (ports #3–5, all byte-identical: `8b43c19` / `38b2260` / `b4ef8ee` — each RESTRUCTURED the source per the reframe, not the format: a flat atom / form-computed `stepover` / region-local-at-0 / a leaf `extent()`; frontiers held unbound). Next: **`contour`** (the last of the original trio — its design agent failed mid-run; surfacing-shaped, needs a dedicated flat atom). NOTE: `slot`/`text` gained a leaf `extent()` (live placement bbox) + a `scanlineFill` runaway-row cap (glow-safety); `text` also got `width`/`slant` customization (`7c4007e`) + a font-registry SEAM (`font` bound socket; TTF/V-carve PARKED).
   - **✅ 2026-06-27 REFRAME — the 'CORRECTION / format-extensions / geometry-attachment' sub-bullets below are SUPERSEDED.** Surfacing's "blockers" (nested geometry, computed `so`, mapped `strategy`, fan-out `originX`) were resolved by **RESTRUCTURING the wizard** — a dedicated flat `surfacefill` atom, the FORM precomputes tool·% (flat `stepover` socket), `strategy` taken directly, and the region defined LOCALLY at (0,0) so PlaceOnStock owns the position (`offX=originX`, 1 clean socket, byte-identical because `placementShift` anchors the bbox min-corner). The data-def FORMAT was NOT extended (no nested-path/computed/fan-out binding machinery — it stays dumb). Only a TRUE 2-socket fan-out (`clearance`) stays unbound, like drill #3. **AND the "Blockly bridge infinite-recursion" was a MISDIAGNOSIS** — it was the value-GLOW (`opGlow._localizeValue`) perturbing a flat geometry param to its ~1e6 sentinel → toolpath overflow (fixed: a `try/catch` bail in opGlow + a KERNEL cap for the helical-`bore` HANG variant that `try/catch` can't catch). ⇒ design rule for the remaining ports: [[glow-safety-childless-multiplier]]; flatten the source, keep the format dumb.
   - **⚑ Frontier-coverage map (all 19 remaining built-ins classified, 2026-06-26):** `atc_warmup` was the ONLY "free" (pure/cosmetic-only) port — **every other op hits a FUNCTIONAL blocker.** Unportable (conditional structure dominates): `pocket`, `middle`, `corner`, `circular`, `rotary_center`, `comm`, `homing`, `atc_change/test/table`. Blocker leverage (ops gated): conditional-STRUCTURE 13 · computed-ADDRESS/value 14 · computed-TEXT 15 (cosmetic) · ifgoto-var 8 · fan-out 6 · placement-bbox 5 · loop 4 · conditional-TYPE 2.
   - **⚠️ CORRECTION (2026-06-26) — the map OVER-RATED `surfacing`/`contour`.** It called them "blocked by nothing but placement-bbox" — WRONG. Investigating the surfacing port revealed it conflated "static SHAPE" with "cleanly BINDABLE." Even with the placement-bbox fix in hand, `surfacing` can't be a data-def: its geometry `w`/`h` are NESTED inside `stepover.params.region` (the flat `(blockIndex,key)` binding model can't reach `region.w`); the stepover value is COMPUTED (`so = toolDia·stepoverPct/100`); `strategy` is MAPPED (`raster?'parallel':'concentric'`); and `originX`/`clearance` FAN OUT to two sockets each. So a surfacing data-def can't even vary the footprint → the placement fix is undemonstrable there. `contour` is the same (region nested in the `contour` atom + an offset path). **So `drill` was the only cleanly-portable PLACEMENT op** (its pattern points are directly bindable AND == the footprint). **No more "easy ports" exist** — `surfacing`/`contour` need the SAME format extensions as the probe/ATC family.
   - **⇒ The real remaining Stage-5/6 work is data-def FORMAT extensions (binding feasibility), not more ports:** (i) **nested-path binding** (`key:'region.w'` — reach a param inside a child/reporter); (ii) **computed/derived bindings** (`so = f(toolDia, stepoverPct)`); (iii) **fan-out** (one param → many sockets); (iv) **conditional STRUCTURE/TYPE** (JS branches/loops → block-IR `iff`/`count`/`expr`). The placement-bbox solution (declared per-atom `extent` + a `liveFootprint` opt-in on placeOnStock so shared atoms like `stepover` don't regress pocket) is DESIGNED + proven on drill; land it for surfacing/contour only AFTER (i)-(iii) make them portable (until then it's a no-op there).
   - **⇒ USER REFRAME (2026-06-27) — RESTRUCTURE the awkward wizards; do NOT extend the format to fit them.** Existing wizard internals are NOT sacred — the user is fine rebuilding awkwardly-built ops to align with the north star. So instead of 4 engine-level binding extensions, **flatten each wizard to fit the simple `(blockIndex,key)` model**: nested → lift geometry to a top-level flat param; computed → let the **FORM** do the `tool·%` math and store a flat value; fan-out → one-param-one-socket. **~3 of the 4 "extensions" evaporate** this way; only genuine BRANCHING may still need `iff`/`count` atoms or a split into wizard variants. Keep the **byte-identical** equivalence gate where the legacy output is fine; relax to "equivalent toolpath" only *deliberately*, per-wizard (you lose the automated gate when you do). Keep the data-def format DUMB on purpose — that's the point. **DIRECTIVE (general): the worker agent should ASK the user whether a wizard/builder can be CHANGED to align with the north star, rather than building machinery to preserve a structure the user doesn't care about.** See memory [[restructure-source-not-abstraction]].
   - **⇒ GEOMETRY-ATTACHMENT MODEL (decided 2026-06-27, after the surfacing attempt).** Flattening surfacing PROVED byte-identical (`surfacing-as-data` == `surfacingStack` across a footprint+stock-attach sweep — the emit/data-def side is sound). BUT the *mechanism* — putting flat geometry on the **SHARED `stepover` atom** — was too invasive and was **reverted**: it cluttered pocket/slot, broke the Blocks value-token learner, and **infinite-recursed the Blockly bridge** on round-trip (geometry value-sockets + an empty `region` reporter socket). **Decision: simple fixed-shape toolpath ops (surfacing, contour) get a DEDICATED flat-geometry atom** — `surfacefill` (flat `shape/x/y/w/h` + cut params, **NO region socket**, reusing the existing clearing/fill kernels); **arbitrary-shape ops (pocket/slot) keep the region REPORTER.** A dedicated atom IS restructuring the source (atoms-not-sacred) while keeping the data-def format DUMB — and it's the **family pattern**, not a one-off (contour follows it). **REJECTED (B):** extend `flattenBlocks` to reach reporter-socket children = the nested-path *format* extension the directive forbids (and leaves geometry in the awkward reporter). The validated finding survives the revert: flatten + form-math + live placement = byte-identical portability; only the geometry's *home* changed. **✅ RESOLVED — the "Blockly bridge infinite-recursion" was a MISDIAGNOSIS** (NOT a bridge/reporter-socket bug — don't chase it). It was the value-GLOW perturbing the now-flat geometry param to its ~1e6 sentinel → a 137k-row toolpath → `out.push(...bigArray)` overflow; the original Region *pill* hid `w/h` from the glow. Fixed generally in `opGlow._localizeValue` (bail on a throwing perturbation). See [[glow-safety-childless-multiplier]]. The dedicated `surfacefill` atom decision below still stands + shipped (`8b43c19`).
   - **✅ FUNCTIONAL blocker (a) — placement bbox — SOLVED (the north-star fix, 2026-06-26).** The frozen `placeOnStock` bbox snapshot was a DUPLICATE of derivable geometry (principle #4 "duplication is the enemy"). Fix: each geometry atom DECLARES its own `extent(params)` (`drill`/`bore` = a point; `array` = pattern-points ⊕ child extent, measuring exactly what it stamps), and the place fold recomputes the bbox LIVE (`blockEmitter.liveExtent` → `placeShiftFromParams` override), falling back to the snapshot for un-migrated atoms. Declared-not-inferred (#3), one-source (#4), pure-data (#5) — beats the derive-hook (a function isn't data) and infer-from-emitted-motion (#3 violation). **`drill` is now fully placement-portable** (off-origin/circle/line/rect/stock-attach byte-identical; the latent circle-`x0` placement bug fixed too). **Migration = give each placement op's geometry atom an `extent`** — next: `surfacing`/`contour` (then fully portable), then `slot`/`text`. Files: `wizards/ops/{drill,bore,array,placement}.js`, `blocks/blockEmitter.js`.
   - **Remaining FUNCTIONAL blockers (the real Stage-5/6 lift):** **(b) conditional STRUCTURE + block-TYPE** (gates the probe/ATC/comm/homing family — needs each op's JS branches/loops rewritten into block-IR `iff`/`count`/`expr` atoms so the stack is static-shape) and **computed ADDRESS/value** (#var arithmetic → `expr`/`assign` atoms); **(c) one-param-→-many-sockets** fan-out. **COSMETIC (deferrable): (d) computed annotation TEXT** (`stripAnnotations` proves functional equivalence; a comment-interpolation feature, or just accept frozen text). `blocks/opBuilders.js`, `wizards/probeBlocks.js`, `wizards/atcChangeWizard.js`.
4. **[XL] Wizards-as-data Stage 6 — self-host** — built-ins become the forkable default library (Edit/fork on built-in rows; a definition-level `resetToFactory` re-registering shipped defs). Gated on Stage 5 + the federated registry. `blocks/wizardLibrary.js`, `blocks/devMode.js`, `wizardManager.js`.
5. **[L] Community `.wizard` library** — browse/install panel; the `.wizard` codec + validate-on-install already hold for local import, so what's missing is the index/catalog format, a network fetch layer, the browse UI, and bundling the op def alongside the `.nc`. `blocks/wizardLibrary.js`, `ui/wizardManagerPanel.js`.
6. **[XL] Plasma/laser modality suite** — process-atom vocabulary (pierce, lead-in/out, power ramp, beam/arc on-off, kerf-comp) as profile-aware leaf ops + a Plasma/Laser wizard group + per-head config + making `head.type` actually branch codegen & sim. Keep hard-real-time THC delegated to the controller. Largely community-authorable once the vocabulary exists. `wizards/ops/cnc.js`, `ui/settingsPanel.js`, `blocks/programFraming.js`.
7. **[L] Dedicated Squaring wizard (gated on Y2)** — generalise the per-axis G31 seek to per-**motor** independent seeks; decouple→seek→re-couple dual-Y (`#988–#992`); a Y2 Machine-tab config as the unlock. Optional probe-verify/correct. `wizards/homingWizard.js`, `blocks/opBuilders.js`.
8. **[L] Parametric-canvas view-migration** — extract a pure `(params↔picture)` atom from `FeatureCanvas` and lift ONE production view (recommend **drillView**) onto it, behavior-preserving, gated on output-equivalence **and** the real rendered 2D symptom. The deferred big refactor — do ONE view against a released baseline. `viz/featureCanvas.js`, `wizards/views/drillView.js`.
9. **[XL] Region primitive → spatial CAM feature-selection** — *(GATED, do NOT build now)* generalise backdrop→part/stock and region→feature so clicking part geometry commits a feature/op. The enabling decision (region = an extracted shared-drawing primitive, not an iconEditor layer) is already satisfied (`shapeStage`). Blocked on the field-targeting param mechanism (NEAR #4).
10. **[L] Audit other native subs (O502 probe, ATC) for G31 decomposition** — extend the homing Native-vs-decomposed method picker to other decomposable native subs (O502 is confirmed G31-decomposable). Carries the same UNVERIFIED-on-hardware burden. `wizards/ops/probe.js`, `wizards/edgeWizard.js`.

---

## Non-wizard backlog

- **[XL] Fusion 360 integration** — launch/focus Studio from inside Fusion (CAM workspace). Three entry points scoped: a Python add-in button, a post-process hook (JSON sidecar + open Studio), and a CAM custom command "Send to DDCS Studio" (preferred). Open: desktop exe vs web app; pass stock/WCS or raw `.nc`; own repo vs `ddcs-vscode-extension/` sibling. Detail: [`docs/archive/FUSION-INTEGRATION.md`](docs/archive/FUSION-INTEGRATION.md).
- **[L] L1/L2 cross-controller translator** — per-controller address columns in the dict; best-effort read of foreign post markers (Fusion op headers) as declarations. Same shape as the `watch.js` variable-map gap.
- **[M] Gateway gaps** (architecture is fine) — `merge.js` is a stub (multi-tool merge: combine single-tool programs + T/M6 + safe retract between each); `watch.js` variable map half-done (#100–499 confirmed, #500+ per-controller pending). Cloud path deferred.
- **Separate sim tracks** (each its own project, not Head-tab fields) — **VFD/spindle sim** (RPM ramp, spin-up/down timing → gives Max-RPM/Spin-down meaning), **plasma/laser head sim** (pierce/THC/arc-OK), **ballscrews + steps** (steps/mm, backlash → positional fidelity).
- **[S] SVG copy of the app icon** — vector recreation of `ddcs.ico` for scalable in-app use (blocked on viewing the ICO).
- **Repo-root scratch cleanup** — untracked icon experiments (`ddcs-opt1..4.ico`, `*-preview.png`) to remove once the icon is finalized.

---

## Gaps — surfaced by verification, tracked in no prior doc

1. **coordlist can't become a wizard knob** — `extractParamBlocks` ignores `coordlist` pills (only `param`/`regionpick`); the `list` binding type exists but no authoring path emits it. (Folded into NEAR #2.)
2. **coordlist drives no G-code** — the block emits nothing; the intended consumer op (stamp children at the listed XY points) doesn't exist yet.
3. **xy-pad/rect pickers are form-only by decision** — inside a block they degrade to plain number fields. ✅ *Partly addressed (NEAR #5):* the **number-role** authoring path now renders paired `data-param` fields + a drag-to-edit preview; the in-block mini-canvas seam itself stays open/unused.
4. **Selection-model theming is seam-deep** — `paintRegions`/`paintCornerGrid` hardcode colours; the `rp-region`/corner-grid CSS hooks have **no rules consuming them** and no shared `--pick-sel` token, so a theme can't restyle both pickers from one token (the stated goal).
5. **Save-states history is volatile** — lost on reload until the deferred IndexedDB autosave ring + recovery-on-load lands; `projectStore.js` is a named-project VFS, not an autosave ring.
6. **3D start-marker ruby is a fixed `SphereGeometry(3)`** — doesn't track `probeDims.ballDia` like the now-wired probe body. Minor visual-consistency gap.
7. **`macros-tabs.spec.js` is stale** — asserts a flat 3-tab bar; the UI is a sidebar + 7-panel tree. (Left red deliberately, pending the macrosApp restructure.)
8. **No test for the prereq-prompt UI** despite a `window.__ddcsForceWizPrereq` hook existing for exactly that.
9. **Test-coverage gaps** — no `profileStore` round-trip test; `wizard-library.spec.js` codec case omits `panel`/`sim`.
10. **`filltext.align` is still free text** — the one enum atom field not yet a dropdown (value set unconfirmed, left as text). The rest (`dir`/`flow`/`arc`/`end`/`direction`/`order`/`strategy`) were registered in `bridge.SELECTS` → dropdowns (2026-06-26), so a one-letter typo can no longer silently mis-emit (was: coolant `mist`→`mis`→M9).
11. **✅ RESOLVED — VERIFIED NOT REPRODUCIBLE on current code + regression test (`e3f1afe`, 2026-06-27).** Drove the user's EXACT repro at runtime — Save-as-wizard fork "Tool Length" (`atc_length`) → insert → hover — and the chip APPEARS (`✎ Tool Length Copy`); `builderOf` is defined, `commitActiveOp` returns true, it commits AS an `'op'` block. Also a plain custom op + an op-after-built-in: chip works. **The hypothesised mechanism CAN'T fire:** the premise "probe/ATC families fall back to a plain text insert" is a STALE comment — the wizard-to-blocks port gave EVERY built-in a builder (`less: []` across all 21 types incl. `atc_length`), and forking captures the stack → `createWizard`→`createUserOp` registers one, so `builderOf` is never undefined. The user's dead "Tool Length (copy)" is almost certainly a LEGACY localStorage def (forked under an older builder-less build) OR the older DEPLOYED build (the 13 fixing commits are local until pushed). Regression test `custom-op-chip.spec.js` locks the working behavior (the gap that let this stay "confirmed-but-unreproducible"). The defensive "wrap a builder-less op as 'op'" fix was deliberately NOT added (no builder-less op exists to wrap; revisit only if a real legacy def surfaces one). *(Original diagnosis below, kept for reference.)* The headline custom-wizard loop — *make a custom wiz → insert it → hover its emitted G-code in the editor → ✎ Edit → its form opens* — is **dead**: no chip appears on a custom op's lines (a parameterless "inserts as-is" fork reproduced it). Every gate READS as wired — `canEdit(user_*)`→true (`wizardManager.js:251`); `openForEdit`→`userOpView`/`#wiz_user` seeded; `commitActiveOp` uses `builderOf` (not the old `BUILDERS[op.type]`); `recordOp` runs on open via `open()`→`update()`; `findOpInStack` is op-type-agnostic (finds any `b.type==='op'`). So the break is **RUNTIME, narrowed by elimination to the commit path**: `wizardManager.insert()` does `commitActiveOp() || commitDecodedCode(code)` — if `commitActiveOp()` returns **false** for a fresh custom op, the fallback `commitDecodedCode` decodes the raw G-code into **loose atoms with NO `'op'` wrapper** → `findOpInStack` finds no op → no chip (the code still shows in Blocks + round-trips, just isn't an editable op). **Decisive 1-run trace:** log `commitActiveOp()`'s return (+ `getLastOp()`) for a just-opened custom op; if false → fix why (a `getLastOp`/`builderOf` registration-timing issue) so custom ops commit AS an `'op'` block. This is the user's explicit goal, **not previously a planned item.** Files: `wizardManager.js` (insert), `blocks/opSession.js` (commitActiveOp/commitDecodedCode), `wizards/views/userOpView.js`, `blocks/programModel.js` (opAtLine), `ui/editorOpHover.js`.
12. **✅ FIXED (`a22d252`, 2026-06-27) — a hand-built block stack is form-editable too.** Verified the symptom + the Gate-5 op-wrapper dependency at runtime FIRST (an op-wrapped stack derived a def but the guard hid it; a BARE atom stack derived null). Fix = two surgical parts: **(a)** `authoringBody(ws)` — the authoring body is the op's children when wrapped, ELSE the bare top-level atom chain (synthetic opType-less opRec); `collectAuthoring` + `writeAuthoredValue` both route through it, so derive/save/writeback work on a bare hand-built stack (no program mutation); **(b)** the `renderLiveForm` guard now shows while editing a saved wizard OR whenever the stack exposes knobs (`def.bindings.length > 0`) — no knobs + not editing → still hidden. Regression `hand-built-form.spec.js` (bare stack + knob → form shows + writes back `px 30→99`; no-knob → hidden); op-wrapped authoring/save unbroken (suite 334 green). *(Original spec below.)* The live-form pane WAS gated at `blocks/blocksApp.js:326` — `if (!editingWizardType()) { pane.hidden = true; return; }` — so it renders ONLY while editing an **already-saved** custom op; a fresh hand-built stack (never saved) gets no form. The **engine is general and already built**: `deriveAuthoredDef` (`blocks/devMode.js:130` — *"the form is a pure function of the blocks; save is just persistence"*) + surgical two-way `writeAuthoredValue`. So this is a **COMPLETION of FORM [LIVE] (NEAR #5), not a new feature.** **Change:** widen the guard to show whenever the stack has exposed knobs (`def.bindings.length > 0`), not just `editingWizardType()`. **⚠ Gate-5 verify FIRST (don't trust the static read — see Gap #11):** the deriver/writeback assume an **op wrapper** (`deriveAuthoredDef` → `a.opRec.children`; `writeAuthoredValue:156` hunts an `'op'` block) — a bare pile of atoms may derive nothing, so the real change is **widen-guard + ensure a fresh hand-built stack is wrapped as an op** (or make `collectAuthoring` handle a bare stack). Add a test: a fresh hand-built stack shows + edits its form. Through the sieve: safety/declare/one-source/valid-by-construction all ✓ (it's the "one stack, many views" north-star); only the op-wrapper dependency needs a runtime check. **Pairs with #11** — #11 = the editor-hover surface, #12 = the Blocks-tab form surface; together they make "edit any custom/hand-built op via a form" real. Files: `blocks/blocksApp.js` (~326), `blocks/devMode.js`. **🧭 ADVISOR VERDICT (2026-06-27): PASS** — verified the diff + `hand-built-form.spec.js`. `authoringBody` (synthetic opType-less opRec, **no program mutation**) is the right call over wrap-as-op; the `flattenBlocks(children)`↔`preorderAtoms(first)` index-alignment the worker flagged is confirmed green by the writeback test for the **common case (one connected bare chain)**. **Greenlit follow-up (NOT a blocker):** add a regression for a **nested-DO atom inside a bare stack** (a hand-dropped `count`/`iff` with children, no op wrapper) — advisor + worker *independently* flagged this as the one uncovered alignment edge; also guard/document the **multiple-disconnected-top-chains** case (`children` spans all top atoms, `first` = the 1st chain head only → possible misalignment). Nested-DO test passes → #12 airtight; fails → a real find.
13. **🔴 Knob exposure doesn't survive a round-trip — found by the USER trying #12 (2026-06-27).** Tick a value's "knob" on a hand-built stack → FORM [LIVE] shows (#12 works) → but ANY reprojection (switch tab / edit / editor⇄blocks sync) **resets the knob** → no exposed knobs → the form vanishes. So #12 is correct in isolation but the END-TO-END flow is broken: a knob can't STAY exposed, so the live form never persists. **Root cause (the code admits it):** the exposure lives in live-only Blockly dev fields (`EXPOSE_`/`PNAME_`/`WIDGET_`/`XMARK_`), which `devMode.js:16` notes *"aren't in `fieldsOf(def)`, so `stackBridge.toRecord`"* drops them — so `workspaceToStack`→`stackToWorkspace` rebuilds the block WITHOUT them. **Fix:** serialize the exposure dev-fields into the block's `data` (which DOES round-trip — `stackBridge.js:101`/`:218`) so `toRecord` captures them + `stackToWorkspace` restores them; the knob (and the form) then persist. **Verify-first:** reproduce expose→reproject→reset, then add a regression that exposes a knob, **reprojects**, and asserts the knob + form survive (the #12 test missed exactly this — no reprojection between expose and assert). **Blocks #12's real value** (the form is useless if the knob won't stick). Files: `blocks/devMode.js`, `blocks/blockly/stackBridge.js`. **🧭 ADVISOR VERDICT (#13, 2026-06-27): PASS (`0233c72`)** — exposure mirrored to `data._expose` (out of params → never emitted, but round-trips); the regression `knob-persist.spec.js` drives the REAL gesture — tick knob → leave Blocks & return (a true reprojection) → asserts knob+name+widget+derived form all survive (the step #12 missed). Diff+test verified; suite-run trusted to worker (green+clean tree). Prerequisite DONE → worker cleared for the group-block build.
14. **✅ DELIVERED (2026-06-27) — the editable button on a HAND-BUILT stack (the "group feature"); closes #11/#12/#13.** A hand-built block stack is now editable via a form, reached by the editor chip — **both paths**: **(a) explicit** — right-click any atom in a loose run → "Group" → the run wraps into a `group` op → ✎ chip → edit form (`b2394e7` inc 1 · `04c4871` inc 3 · `8de09a6` inc 2); **(b) automatic** — a PURE hand-built stack (no real ops) auto-shows the ✎ chip on hover with NO gesture, **no mutation on render**, wrapping only on the edit-click (`c8f6890` AUTO). The form derives from the group's STORED children `_expose` (off-records `devMode.deriveGroupDef`, NOT live `deriveAuthoredDef(ws)`); edits write back surgically (`setGroupChildParams`, bypassing builder-only `replaceOp`); survives a reprojection. The single-run-vs-mixed scope is ONE declared model guard (`autoGroupRunAtLine` returns null if any real op exists). Tests: `group-chip`/`group-gesture`/`group-edit`/`group-auto` specs. **✅ Canvas-role group knobs — DONE too (2026-06-27, `94d2d6c`+`fd3e941`):** number-role 2D knobs (point/rect as x/y fields) already worked (locked with a test, A); and 2D knobs are now DRAG-editable on a `form2d` 2D-preview pane (`deriveGroupDef`→`panel:'form2d'`, reusing custom-op `renderLayout2D` + `layoutSpecFromOp` handles — 7 lines of source, B). Real-pointer-drag test. **The group feature is fully complete + polished.** **✅ Test-view sweep (2026-06-28, `35ad42c`+`048b493`):** all 6 group specs now drive the real `showApp('studio')` view (not the hidden `'editor'` shell) — verify-real-symptom complete at the test level; no visibility bug surfaced. *(Built by the advisor↔worker pair — the group feature + canvas-role over the file-listener loop, the test-view sweep over the turn-marker handoff.)*
15. **✅ DELIVERED (2026-06-28, `b4de899`) — a hand-built/custom group form includes the FRAMING blocks (parity with built-ins).** `groupLooseAtoms` spans the adjacent `progstart`/`progend` into the group (run-finder UNTOUCHED → byte-identical emit, gesture undisturbed); `deriveGroupDef` auto-surfaces `rpm`(spindle)/`clearance`/`retractZ` (framing has no `_expose`); writeback via `setGroupChildParams`. Human confirmed the curated set is right — the rest of the framing params (`dir`/`spinUp`/`park`/`end`) stay editable in Blocks, not the form. Test: `group-framing.spec.js`. *(Original spec:)* A built-in op's stack INCLUDES `progstart`…`progend` as children ([surfacingData.js:40-41](DDCS-Studio/web/blocks/dataOps/surfacingData.js#L40-L41)), so its form exposes spindle/clearance/retract; a hand-built group EXCLUDES them (`_isLooseTop` walls off framing, [programModel.js:59](DDCS-Studio/web/blocks/programModel.js#L59)) → the user's OWN op is more limited than a shipped one (violates "built-ins have no privilege"). Fix: let a group span the framing so its form derives `rpm`(spindle)/`clearance`/`retractZ` as knobs. Framing-presence is the USER's to manage (delete Program Start/End for a multi-op stack — **no guardrail**). Verify-first: framing blocks reach the form differently (progstart/progend leaves with `fields`, not `_expose`d atoms) → confirm `deriveGroupDef` surfaces them. *(Surfaced by the user 2026-06-28; active in NEXT-SESSION.)*

---

## V4.1 ADVANCED MACHINING — five firmware-native features Studio does not know about

**Captured 2026-08-22** from three photos of the real controller (`images/4.1 advance machining1 (1)/`).
⇒ **DEFERRED, deliberately.** *(human, same day: "the advanced machining is another arc, not doing it now.")*
Filed here rather than in `BACKLOG.md` because that file takes only one-sitting work, and this is an arc.

```
  Advanced machining submenu   (V4.1, under the CONT screen)
    • Advanced Startup
    • Array machining              rows × cols × spacing, + rotation PER CELL
    • Sequence machining           an arbitrary origin LIST read from template.txt
    • Milling plane machining
    • Milling cylindrical machining
```

**Array machining** — fields: Array Rows, Array Columns, Row spacing, Column spacing, Rotation angle,
Rotation Center X, Rotation Center Y. On-screen note, verbatim:
*"The rotation setting is used for each cell, not the entire array!"*

**Sequence machining** — the significant one. Its node table columns are
`No. | Origin-X | Origin-Y | Origin-Z | Origin-A | Rotate-angle | R-Center-X | R-Center-Y`,
and its own on-screen message reads:
*"The template file for serial machining is **template.txt** in the system directory; please write the
template file in the order of the fields in the list above."*

### ⭐ Why this matters to Studio — three reasons, in order of weight

1. **⚠ IT ROTATES NATIVELY, AND THAT CONTRADICTS A STANDING PREMISE.** Both features take a rotation angle
   AND a rotation centre. The alignment work was DEFERRED on the belief that these controllers have no
   usable rotation (no `G68` on the Expert; Studio rotates geometry itself by `#1512` instead). That premise
   was established for the **Expert** — this is the **V4.1**, and it plainly rotates. **Re-test before any
   further alignment planning assumes otherwise.**
2. **It is a DECLARED, FILE-DRIVEN feature.** `template.txt` is a plain text table Studio could WRITE; the
   controller then runs one program at N origins. That is the declare-don't-hand-roll shape exactly, and it
   is the rare case where the *controller* provides the declared seam.
3. **It would replace UNROLLING.** Studio currently expands patterns into repeated G-code. The V4.1 does this
   natively, so an emitted program could stay ONE part with the array living in data beside it — smaller
   files, and a pattern that stays editable instead of being baked into the bytes.

### ⛔ HARDWARE-GATED — do not build against the photos

Every one of these is unknown until someone runs it on the V4.1:
- `template.txt`'s exact **delimiter and number format** (the fields are only described as "in the order of
  the list above").
- Whether **`Origin-A`** addresses the rotary axis, and what it means on a 3-axis machine.
- Whether the rotation **composes with an active WCS**, or replaces it.
- Where "the system directory" is, and whether the gateway can write there at all — it may not be on the
  share Studio already reaches.
- What **Advanced Startup**, **Milling plane** and **Milling cylindrical** actually do — never opened.

⚠ Related, and already known: `AUDIT: WHICH GATEWAY TABS A V4.1 (AND A V3) CAN ACTUALLY USE` in `BACKLOG.md`
tracks what a V4.1 can reach today. This arc would ADD to that surface, not fit inside it.


## Parked / speculative (from `CRAZY-IDEAS.md` — no commitment to build)

Several have already been **promoted** above (plasma/laser suite → STRATEGIC #6; community library → STRATEGIC #5;
region→spatial-CAM → STRATEGIC #9). The rest, parked:
- **Live control panel — software knobs via gateway** — gateway writes user registers (#100–#110) mid-program; the macro reads them between moves; Studio shows sliders mapping 1:1 to registers. Enables welding correction, plasma height, feed scaling. (**Studio-as-welding-HMI** is one instance.)
- **Surface digitizing → terrain** — a 20×20 probe grid (400 G31, results in #56–#455) → point cloud → mesh. Feeds **adaptive toolpath Z-correction** and **rotary wrap compensation** (per-angle radius map). *(CNC gaps: probe base must be block-ported; a grid probe needs an indexed probe-array. Concept-only — do not build the behavior unless asked.)*
- **Machine as a CMM / metrology** — flatness/squareness/parallelism reports from the probe-array pipeline.
- **`@DDCS:cam` beacon navigator + depth-map viz** — section jump-list + stacked depth/tool timeline read straight from `@DDCS:cam` markers (no G-code parsing).
- **Post-processor as a Studio plugin** — run the `.cps` post logic in JS to preview exact output before sending.
- **Persistent job memory** — a structured per-job record (file/WCS/tools/probe results/corrections) linked to the profile.
- **Alignment correction via rotation** — rotate emitted XY by the measured fence angle (#1512) in Studio (controller-agnostic, no G68).

Full text: [`docs/archive/CRAZY-IDEAS.md`](docs/archive/CRAZY-IDEAS.md).

---

## Conventions / traps (don't relearn the hard way)

- **Blockly v13 Class-B render trap** — a valid block model isn't drawn until the async render queue runs. Load via `serialization.workspaces.load` (`ddcsLoadBlockStack`) and always add a render-guard (`block.getHeightWidth().height > 0`), not just an emit assertion. See the `blockly` skill + `web/vendor/blockly/API-NOTES.md`.
- **Valid by construction** — a user op is compliant only if `BUILDERS(op.params) == op.children`. GUI param pills must resolve to numbers in `instantiate` so committed ops stay clean (pills live only in the def template).
- **Restructure the source to fit a simple model — don't grow the abstraction to fit awkward code; ASK first.** When a port/refactor toward the north star is blocked by existing structure (a wizard built in an awkward way), the right move is usually to **rebuild the source cleanly**, NOT to extend the format/engine to accommodate it. Keep the data-def format dumb / valid-by-construction; push parametric complexity into the wizard's **FORM**, not the engine. **The worker agent should ASK the user whether the code can change to align with the north star, rather than treating the existing structure as fixed.** (Origin: Stage-5 surfacing — 4 proposed binding-format extensions mostly evaporate by flattening the wizard.) See memory [[restructure-source-not-abstraction]].
- **GUI over fields — split by param TYPE (spatial-GUI placement, decided 2026-06-26)** — default to a visual picker over a text field, but the editing surface depends on what the param IS: a **discrete pick that fits a tile** (datum/corner, region zone) → a small SVG control that DUAL-RENDERS as a form widget + a Blockly `field_*` (`cornerGridSvg`/`regionPickSvg`) — stays in the form, shows inline on the block; a **continuous position** → drag the **interactive PREVIEW canvas** (`FeatureCanvas`), value as plain numbers on the block + a form mirror — **never** a mini-canvas inside a form row (redundant with the preview). The block stores the *value*, so canvas-first never hurts block round-trip (numbers round-trip regardless). The unused `xy-pad`/`coord-list`/`rect` form mini-canvases are spare parts, not the pattern to grow. **GREENLIT next step:** make ONE preview canvas WRITE BACK (drag a feature → params + form mirror) — **drill wizard** as the template (the interactive companion to STRATEGIC #8).
- **Verify the real symptom at runtime** — a green tsc/emit ≠ a working app; reproduce the user's exact symptom (right viewport, real rendered output).
- **Repo layout** — git root has a doubled `DDCS-Studio/` dir; the npm project + app code is under `DDCS-Studio/DDCS-Studio/`. `node_modules` is gitignored (run `npm ci` + `npx playwright install chromium` in a fresh checkout). Running the suite churns tracked `tests/_*.png` screenshots — `git restore` them before a release commit.
- **Release flow** — `npm run bump-version` bumps the `.ver` chip in `web/index.html` (the source of truth); pushing that change to `main` triggers `desktop-release.yml`, which builds the exe and **creates the `v<chip>` tag + GitHub release itself** (idempotent). Don't tag locally; push the bump commit as the tip.
- **One stack, many presentations — the transparency axis** (mental model, 2026-06-26) — every authorable thing is the SAME stack IR at a different *fold × parameterization*: **atom** (one primitive) → **op** (composed, *opaque*: header + knobs, body folded — for *doing*) → **snippet** (composed, *transparent*: bare atoms — for *learning*) → **program** (framed, complete) → **wizard** (parameterized + form). Different *windows on one truth*, not different kinds of thing. A new presentation (e.g. the learner library, MID #14) is a *view*, not new machinery. The op header is just a *label + parametric regenerator*; its regenerator role is the half-abstraction that breeds the round-trip bugs — lean on *form (parameterize)* + *transparent atoms (truth)* instead.
- **Decompose where structure is STORED, never where it's COMPUTED** (governs MID #14 + any "explode op" idea) — an op header wraps *real stored child blocks* → revealing/decomposing it is lossless. But a **toolpath atom** (`bore/contour/drill/line/slot`) or an **`array`'s repetition** *computes* its output at emit → exploding it **bakes the formula into dead literal moves**: irreversible, unwieldy, severs the parametric recalc. The **fold-floor = wherever authored structure ends** (a `move`'s X/Y/Z are *words on one line*, not sub-atoms; a toolpath's passes are *arithmetic*, not blocks; and a dialect can move the floor — `waitinput` is one native `M66` on grbl but a 3-line WHILE/DO/END macro on Expert). A **probe** is *stored-but-safety-critical* (a careless edit on the #var-threaded sequence crashes the probe or writes a wrong WCS) → decompose-to-**READ** is great for learners, decompose-to-**EDIT** needs guardrails. ⇒ snippets/programs are *authored* stacks, never auto-exploded from a parametric op.
- **Declare edits, don't infer them** (the round-trip integrity principle — superseded MID #1) — know what the user changed by **RECORDING** it on the Blockly change event (`opEdits.js`, persisted in `.mjson`), never by re-deriving the op (`reconcile → BUILDERS → diff`) and diffing against live: *re-derivation IS inference* and false-positives on any round-trip representation drift (empty sockets→`0`, `#var`→`variable` record). Companion: the live **form↔block round-trip writes SURGICALLY** to the bound socket (`writeAuthoredValue`) and **never regenerates** the stack — the form is a *pure view* of the blocks (blocks = the one truth); a regenerate is exactly what reintroduces the drift/clobber. ("Like the Matrix": form, blocks, and G-code are live windows on one underlying stack.)

---

## TEST TO RUN — two PCs on one shop network (2026-08-13)

**The setup:** PC #1 is wired to the CNC (it would run the **gateway**); PC #2 is on the same network with
no machine connection (it would run the **console**). This is the *Local-network / Direct* mode already
described in `bridge/bridge-app/CONFIGS.md`.

**Why it is a TEST and not a feature request — nobody has tried it.** The pieces look present:
- `web/ui/gateway/views/admin.js` has a free-text **address box**, so a custom base URL *can* be entered.
- In the **native app** the browser mixed-content rule does not apply (no HTTPS page), so an
  `http://<LAN-IP>:<port>` base is not blocked the way it is in a hosted browser tab.

**What is NOT in place, and is why it probably fails today:**
1. **Discovery is loopback-only** — `service.js`'s `DEFAULT_LOCAL_BASE` is `http://127.0.0.1:<port>` and
   the scan walks `127.0.0.1` on the registered ports. From PC #2 it finds nothing on PC #1 and says
   nothing, because it never looks off-box.
2. **The UI never offers the LAN case** — the address placeholder reads
   *"https://your-service.example/ (Cloudflare / self-host)"* and the hint says *"Same PC: point at
   http://127.0.0.1:&lt;port&gt;"*. Cloud or same-PC; the shop's actual topology is unmentioned.
3. **⚠ THE DECIDING UNKNOWN — what does the gateway BIND to?** If it listens on `127.0.0.1` it will
   refuse PC #2 no matter what address is typed; it must bind `0.0.0.0` to answer another host. CORS is
   written for `localhost` and would likely need the LAN origin too. **Check this first — it decides
   whether the rest is a one-line change or already works.**

**THE TEST:** on PC #2's native app, enter `http://<PC-1 IP>:<port>` in the Gateway → Admin address box
and attempt a status read. Record: does the gateway answer at all (bind), is it refused by CORS, or does
it work? ⚠ **Read-only first** ([[live-cnc-readonly-when-away]]) — a status/DRO read, never a send, until
this path is understood.

**⚠ CONSTRAINT — LAN IS AN OPTION, NEVER THE PATH (user, 2026-08-13):** *"this is an example of an option
to give user and not to make it the only path."* The shop's network is the USER'S circumstance, not ours to
prescribe. Same-PC · LAN · cloud · USB stick are all situations people already have; Studio works in
whichever one they are standing in. **Whatever gets built here must not become the blessed route** — the
one-PC owner with the machine sitting right there must never face an address box to reach it, and the
same-PC path must stay the zero-configuration default it is today.
This is the [[hardcoded personal values]] failure one level up: a personal *value* restricts what MACHINE
you can have; a single connection path restricts what SHOP you can have. It is the LIKELIER mistake here
precisely because the LAN case is the user's own — build it, watch it work, and it quietly becomes the
path everyone is assumed to be on.

**Constraint on any fix:** the user is **not a network admin**. Any answer requiring port forwarding,
certificates, static IPs or firewall surgery is the wrong answer — it should be "type the other PC's
address" or better, "the console finds it."

---

## Archived (under `docs/archive/`)
Collapsed here on 2026-06-25 to end the planning-doc sprawl: `NEXT-TASKS.md`, `WIZARD-PLATFORM-VISION.md`,
`CRAZY-IDEAS.md`, `FUSION-INTEGRATION.md`, `SESSION-2026-06-10.md`, and the `docs/` planning/research notes
(`RICH-WIDGETS-AND-ICONS`, `ATC_INTEGRATION_PLAN`, `ROTARY-PLAN`, `SETTINGS-*`, `SIMULATION-NOTES`,
`PROBE-CONFIG-SOURCE`, `CONTROLLER_TASKS`, `MULTI-OP-STACKING`, `BLOCKS-TAB`, `CAM-MENU-RESEARCH`,
`ARCHITECTURE-MULTIUSER`, `MONOREPO_PLAN`, `COMBINED-APP-PLAN`, `BENCH-CHECKLIST`, `VERIFY-AT-MACHINE`,
`TOWER-LIGHT-EVAL`, `REMINDERS`, `SETTINGS-TABS-NOTES`, `addstudiotransfer`, `addstudioverify`,
`probe-preview-frame-issues`). Their actionable content lives above; the files remain for reference.


### Stitching several .nc programs into one job — the retired Merge tab's intent

**2026-08-24.** The gateway carried a **Merge** tab from an early design: *combine several single-tool programs
into ONE job, ordered by tool, with a tool change (T / M6) and a safe retract inserted between each, under a
single program frame.* It was **never wired** — its own module header said "STUB … placeholder UI + intent
only", and its Merge button was constructed permanently `disabled`. It was deleted at t2241.

**Why it went, and why the intent is kept here rather than in the UI:**

- Its description is a description of a **multi-op program**, which Studio now builds directly. The tab was
  offering, as a gateway feature, the thing the wizard stack already does.
- A disabled button captioned "coming soon" is an unasked affordance, and it was occupying a slot in a strip
  being fought onto one phone row. Removing it took the gateway from seven tabs to five.

**⭐ Where it belongs if it is ever wanted — the human's own ruling** *("we can do that later in editor")*:
**in the EDITOR**, as text-level work on a program you can see. Not as a gateway surface. That distinction is
the useful part of this entry: merging G-code is editing, and the gateway's job is moving jobs to a machine,
not composing them.

**⚠ The one case multi-op does NOT cover:** stitching `.nc` files that Studio did not author — programs posted
elsewhere, or files already sitting on the controller. Multi-op composes ops *within* Studio. That gap is real
but thin: two-sided and externally-posted work goes through Fusion for this shop, and nobody has asked for it.


### ⭐ THE NODE VOCABULARY HAS TWO HOMES — measured t2263

**The wizards-as-data arc's remaining cost, established by experiment rather than estimate.**

t2261 rendered an ATC twin from its declaration alone and diffed it against the hand-written shell: everything
matched except one thing, the **code-preview panel**, which all 15 shells hardcode outside the declaration.
So the gap looked like one missing node type.

**t2263 found it is one missing node type in TWO PLACES.** Every `traverse()`-known type ALSO needs a matching
Blockly block file under `wizards/ops/` (~28 tiny per-type files feeding `defineBlocksWithJsonArray`). Declare
a type in one home and not the other and Blockly throws `Invalid block definition for type: …`.

⚠⚠ **And the failure is not local.** That exception ABORTS THE WHOLE RENDER of the Customize route — at
t2263 it broke an unrelated field (`tolerance`) purely by sequencing, in two test files that had nothing to do
with the change. **A half-declared node type is not a missing feature; it is a crash that takes unrelated
fields down with it.**

⇒ So the vocabulary is itself a two-homes structure — the same shape this project has met repeatedly
(a helper in 4 copies, a boot wait in 16 files, sub-tab CSS in 3 homes, a tab token duplicated under two
names). Whatever else the arc does, **adding a node type means adding it twice, and nothing enforces the pair.**

⚠ Worth considering, not yet ruled: whether the two halves can be generated from one declaration, or at
minimum whether a test can assert that every `traverse()` type has a `wizards/ops/` twin. That check does not
exist today, which is why t2263 found this by a Blockly exception in unrelated tests rather than directly.

⭐ Also recorded: a PRIOR attempt at this exact concept (`code_preview_panel`) existed and was pruned as
unused in the same commit that introduced `renderUiTree`. It was found and read before the new one was
designed — the shapes differ, and the new one is informed by an actual survey of what the 15 shells vary by
(label, and a compliance tag with four distinct values, both now declared fields rather than assumptions).


### ⚠ REFRAME t2265 — the TREE render path is dormant app-wide, and that is mostly fine

Following the vocabulary finding above, one more measurement changes what the arc's remaining cost actually is.

**OBSERVED:** `hasTreeLayout` demands a real `split_horizontal` / `split_vertical` node, and **ZERO of the 32
twins declare one** (verified by grep, independently). So the tree-rendered live *form* preview is **dormant
for the whole app**, not for ATC specifically. The only live consumer of `uiChildren`'s full structure today is
the **Blocks-tab canvas**.

⭐ **And that is mostly correct rather than a gap.** A pre-existing `blocksApp.js` comment records this as
already verified: the FLAT path is complete for anything without a genuine split need, with zero exceptions
across Corner, WCS, ATC-Length and Surfacing. The flat path still renders the form **from the declared
bindings** — label, help, section, type, default, gate. It simply does not consult `uiChildren`'s *structure*,
which only matters when a wizard genuinely needs a split layout. **None do.**

⚠ **This also corrects t2263's own closing finding, honestly:** ATC Check's live code preview was never
missing. The flat-path shell (`#wiz_user`) carries its own hardcoded `preview-block` independent of
`uiChildren`. The `code_preview` node type was still worth declaring — the DECLARATION was genuinely
incomplete without it — but it was not fixing a user-visible absence, and saying otherwise would overstate it.

⇒ **Ruled: ATC Check should NOT be made to satisfy `hasTreeLayout`.** It has no split-layout need and forcing
one to reach a code path would be artificial — satisfying a gate rather than answering the question the gate
asks.

⭐ **So the open question for the arc is now narrower and sharper than "render from the declaration":**
what does a hand-written shell still provide that the declaration cannot? Known so far: the `preview-block`
and the `.wiz-box` chrome around it. That list — not the render path — is what remains between 32 twins and
retiring 15 hand-written shells.



### ⇒ THE ARC'S OWN DOC IS THE SOURCE OF TRUTH

The measured state of wizards-as-data — parity evidence, the dual-vocabulary hazard, the remaining cost, and
the **reproduce-do-not-harmonise** discipline — lives in
[`wizards_as_data_transition_plan.md`](wizards_as_data_transition_plan.md), beside the owner's own
done-condition. The entries above are the findings as they were made; that file is where the current state is
kept. ⚠ Update it there, not here, or the two drift — which is the exact defect this project keeps meeting.

### THE ARC'S COST, MEASURED — t2267 (survey of all 15 hardcoded shells)

**The question:** what does a hand-written wizard shell still provide that the declaration cannot? This is the
last thing standing between 32 twins and retiring 15 shells. Answered by reading all 15 in full, not sampling.

**⭐ THE ANSWER IS SHORT — and it is for ALL 32 twins, not per twin.**

**(a) ALREADY EXPRESSIBLE — the node exists and nobody used it**
- **The settings button.** `form_action_btn` matches ATC's own exactly (`action: 'atcSetup'`). Nothing to build.
- ⭐⭐ **Sibling-value conditional sub-panels** — the pattern-type switches in drill / pocket / contour / slot,
  and comm's type cascade. This looked like the single biggest gap in the survey. `whenGuard.js` was checked
  FIRST and already does it: `guard`/`whenOk` evaluates against resolved params **and already recurses into
  `uiChildren`**. ⇒ **The largest correction in the survey cut the largest apparent gap to zero.**

**(b) NEEDS A NEW NODE TYPE — two, and both small**
- **Static top-of-form usage text.** 13 of 15 shells carry one and **no node declares free text at all.**
  ⚠ And it exists under two unreconciled class names — `.wiz-usage` versus ATC's own `.settings-hint`.
- **The Path Anchor picker.** 6 of 15 (the mill ops). No `wizards/ops/` file for it either, so it needs
  **both halves** — see the dual-vocabulary finding above.

**(c) NOT DECLARABLE TODAY — two genuinely hard ones**
- **The comm-screen mockup.** Not a 3D or 2D toolpath view; no existing node's shape is close.
- **Computed / dynamic text.** Comm's type-dependent usage paragraph, WCS's runtime-set compliant tag, comm's
  dynamic hints. **Every text param today is a static string.** This is a capability gap, not a missing node.

**⚠ AND THE 15 SHELLS ARE NOT CONSISTENT WITH EACH OTHER** — which is a finding in its own right, because a
declaration would have to reproduce whichever behaviour is *correct*, and nobody has said which:
- comm and wcs abandon the shared `.wiz-2pane` structure entirely
- ATC's hint class differs from the other nine
- the compliant tag has **four** distinct forms

⇒ **This is the same uncoordinated per-shell drift that let the ATC resize bug sit unnoticed** (six ATC bodies
missing the `.viz-split` wrapper every other built-in had). The shells drift because each is written by hand.
That is the arc's own argument, restated as measurement rather than principle.
