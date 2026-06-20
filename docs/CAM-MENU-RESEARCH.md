# CAM Menu — Research & Ideas

Research into the DDCS Expert firmware "CAM" page, the community macro packs built on it,
and how DDCS-Studio can target it as a deployment platform.

Sources: firmware backup 2025-12-31 (ddcs-expert skill references), repo folder `CAM menu/`,
DDCS Expert Facebook group posts (Paul Okrill, Vasily Savelev, Brad Goldbeck, Al Tie),
production `macro_cam10.nc` (Surface Touch).

---

## 1. What the CAM page actually is

The firmware "CAM" function is **not a CAM system** — it is a **parameterized macro launcher**
(an internal wizard):

- `CAM.nc` contains a single line: `G#2038` — it dispatches whatever the menu selected.
- Each slot N runs `macro_camN.nc` (parameter #968: "0–9999: cam0–cam9999.nc").
- Each slot shows a bitmap (`camN.bmp`) and a parameter form.
- Form values are stored persistently in `camsetting` and passed to the macro at runtime
  via mirror variables: **form field `#1100+k` → runtime `#2600+k`**.

### Factory slots (from firmware backup)

Conversational teach-in blocks plus Chinese door-machine templates — *not* probing or pocketing:

| Slot | Function |
|------|----------|
| cam0 | G00 point-to-point move |
| cam1 | G01 straight line |
| cam2 | G02/G03 three-point arc |
| cam3–cam6 | INPUT wait, OUTPUT, GOTO, G04 dwell |
| cam8 | Raster facing/slot cycle (rectangle, stepover W, depth D) |
| cam11, cam12 | 执手孔 / 开口槽 — door handle-hole and lock-mortise templates |

Other relevant built-in firmware features (not CAM-page related but adjacent):
- G73/G83 peck-drilling canned cycles (retraction = Pr124 / #624, eng param #224).
- Fixed/floating tool probe (params #133–#140, signals #575/#578).
- ATC framework: T.nc dialect, M102, M150–M181 actuators, M300–M307 sensor waits.

---

## 2. Decoded slot format (the deployable bundle)

A complete CAM slot = **4 things**:

### 2.1 The macro — `CAM/macro_camN.nc`

Reads form values from the `#2600+` mirrors at runtime (never bakes literals):

```gcode
#1=#2600   ;max stroke Z        ← form field #1100
#2=#2601   ;Probe length        ← form field #1101
#17=[#2602-54]*5  ;WCS offset   ← form field #1102
```

### 2.2 The icon — `camN.bmp`

- 360×180, 24-bit BMP (factory examples; rows stored bottom-up as standard BMP).
- Community style: flat line art, yellow/cyan/green on black, short title text.
- **At this size/LCD the icon is identification only — it cannot carry instructions.**

### 2.3 The form — entries in the `eng` (and `chs`) language file

One line per parameter:

```
#1101 -p0 -a3 =-111.09 -t1 -s1"Probe Z Offset" -s2" " -m30 -min=-199.999 -max=0
```

| Token | Meaning |
|-------|---------|
| `#11xx` | Parameter number (allocated from #1100–#1499, need not be contiguous per slot) |
| `=val` | Default value |
| `-t0/-t1` | Display type (integer-ish vs decimal — observed pattern) |
| `-s1"…"` | Label shown in the Note column |
| `-s2"…"` | Units suffix |
| `-mGG` | **Group = slot number + 20** (cam10→m30 … cam21→m41) — this binds a param to a slot's form |
| `-min/-max` | Input range (shown as `[lo~hi]` on screen) |

"Result" parameters are also form entries — the macro writes measured values back so they
display on the form (e.g. "Result X hole 1", "Average diameter").

### 2.4 Install procedure (community-verified, Paul Okrill)

1. FAT32 USB stick with `CAM/` folder (+ `install/` for V1 or `psys/` for V2 packs).
2. Power off → insert USB → power on, wait for restart.
3. F2 → Program → F1 (select U-disk) → cursor on CAM folder → **F4 (copy to local)**.
4. Macros **must run from internal storage** — running from USB silently does nothing
   (this is the #1 community failure mode; see Brad Goldbeck's "Start does nothing" thread).
5. Optional K-key shortcut to the CAM page: parameter 210–252 = **1399**.

⚠️ Community packs ship a **full replacement `eng`/`msg1`** — installing one overwrites
language-file customizations. A proper installer should *merge* parameter entries instead.

---

## 3. Community packs (in repo: `CAM menu/`)

| Pack | Author | Contents |
|------|--------|----------|
| cam10–13 | Paul Okrill | Surface Touch, Internal Center, External Center, Edge/Corner. Source: github.com/foinnc/M350/releases (updated 2026-04-10). V1 + V2 variants. |
| CAM10–CAM21 | Vasily Savelev | Extends Paul's set: +Inner Corner, Edge Probe, Angle Measurement, Hole 1 Center, Hole 2 Center + Angle, Hole Diameter, Boss Width, Slot Width. Tested Expert v1.1, controller sw 2025-06-19. |
| Cam13_Corner_Average | Brad Goldbeck | Corner finding with multi-touch averaging. |
| Cam17_slot | Al Tie | Slotting macro. |

### Limitations of the community packs (= Studio's openings)

- Hardcoded for **YunKia V6 probe on IN03** (`#16=3` in every macro).
- **No dual-gantry sync** (our machine needs Y `#806` + A `#808` written together).
- No simulation/verification path — debugged live on the machine.
- Sparse form usage: "(reserved)" fields, blank units, no guidance messages in most macros.
- Distribution = .rar files in Facebook comments; install errors are common.

---

## 4. Overlap analysis: Studio vs CAM menu

**Factory firmware:** no meaningful overlap. Its CAM page ships motion/IO blocks and door
templates; Studio's 14 wizards (7 probing/setup, 5 ATC, WCS, comms) cover ground the
factory firmware doesn't touch.

**Community packs:** real overlap — cam10–cam21 is effectively an *on-controller probing
wizard suite* covering much of what Studio's corner/edge/middle/circular/alignment wizards
generate. Key difference in model:

| | Studio wizard (today) | CAM slot |
|---|---|---|
| Parameter entry | Web form, values **baked into generated G-code** | Controller form, read at **runtime** |
| Change a value | Regenerate in Studio + retransfer | Edit on controller, press Start |
| Verification | Simulator + 3D preview before running | None — live on the machine |
| Customization | Per-machine (probe port, dual gantry) | Hardcoded |

Conclusion: Studio's static-output model partially *competes* with the controller's internal
wizard. Re-targeting generators at CAM slots makes them *stack* instead:
**Studio = author/simulate/verify/deploy; controller = daily parameter entry + execution.**

Studio's durable moats either way: simulation before touching metal, dual-gantry support,
configurable probe setup, ATC + rotary suites, and authoring quality.

---

## 5. Feature idea: "Export as CAM slot"  `[ARCHIVED 2026-06-12 — demoted in §5b; not on the roadmap, kept for rationale]`

One-click export from any wizard producing the complete bundle:

1. **Parameterized macro** — emit config reads as `#30=#2600` instead of `#30=3`.
   Include runtime guidance (the channel that actually helps at the machine):
   - Confirmation popup echoing parsed params: `#1505=1(Probe: Search=%.1f - Continue?)`
   - Step progress: `#1505=-5000(Step 1/3: Probing Z...)`
   - Explicit error messages on every `#1921/#1922` check (never a silent stop).
   - Machine-correct details: user's probe port, dual-gantry `#806`+`#808` sync, no-G10 WCS writes.
2. **Auto-generated icon** — render from the existing structured SVGs
   (`web/assets/svg/cornerViz.svg`, `middleViz.svg`, `edgeViz.svg`, `alignViz.svg`):
   - Same id-group selection logic the 2D animators already use
     (e.g. show `corner_BL` + `corner_BL_XY_*` paths for the configured variant).
   - Hide animation-only layers; apply DDCS restyle (black bg, ≤3 colors, thick strokes).
   - Rasterize SVG → canvas at 360×180 → encode 24-bit BMP in plain JS (~40 lines).
   - The icon then shows the *actual configured operation* (right corner, right directions).
   - **Not** a 3D-viewer screenshot — illegible at this size; 3D stays PC-side.
3. **Form definition** — generate `eng`/`chs` lines from the wizard's existing parameter
   metadata (label, units, default, min/max), with `-m = slot + 20`.
   Installer must **merge into the existing eng file**, not replace it.
4. **USB package** — write the controller's expected folder layout (`CAM/` + language files)
   with install instructions (the F2/F1/F4 procedure) included as a README.

### Slot allocation

- cam0–cam9: leave alone (factory blocks).
- cam10–cam21: occupied by community conventions — either adopt them (export *improved*
  versions of the same operations to the same slots) or start Studio exports at cam22+.
- Parameter numbers: scan target eng file for used `#11xx` and allocate free ones.

### Hard interface constraints (decided the strategy below)

- **One slot = one macro + ONE static bitmap + one form group.** The icon cannot react to
  form values and the macro cannot swap it at runtime (runtime channels are text only:
  `#1503` status, `#1505` popups, `#2070` input).
- Variant-rich operations (e.g. corner FL/FR/BL/BR) therefore need either a **legend icon
  + enum parameter** (community convention — Brad's cam13 "corner 1–4") or one slot per
  variant (better visuals, 4× the parameter cost).
- **The real budget is the parameter pool, not slots:** all forms share `#1100–#1499` =
  **400 fields total** (~55 operations at ~7 fields). Untested whether two `-m` groups may
  reference the same `#11xx` numbers.
- Form is dumb: no conditional fields, no validation beyond min/max, ~8 rows practical.

### Why nobody built this before (the gap Studio fills)

- Digital Dream treats the CAM page as an OEM hook (door-machine market); no docs, no tooling.
- Community = machinists without a toolchain: Paint-drawn BMPs, hand-edited undocumented
  language files, reboot-to-test iteration. Macros got the effort; visuals/UX never could.
- Studio uniquely has all the ingredients already: parameter model, structured SVG diagrams,
  simulator, and (now) the decoded format. This may be the app's most shareable feature
  for the DDCS community.

---

## 5b. VERDICT (2026-06-12): CAM-slot export demoted — `#2070` prompts preferred

After weighing the constraints in §5, the CAM page buys exactly one thing Studio lacks
(editing a few numbers at the controller) and charges heavily for it: eng merge/install,
400-field shared pool, ≤8 dumb form rows, one static bitmap, text-only feedback. Most of
Studio's catalog (ATC, WCS, commissioning, warmup) is set-once and doesn't qualify anyway.

**Preferred pattern for machine-side reparameterization — already proven on our own
machine (`3D PROBE G55.nc`, K-6):**

```gcode
IF #110!=0 GOTO10                       ; configured? skip setup
#2070=110(Enter probe ball radius...)   ; ask once → persistent var
N10
#1505=1(Probe: R=%.2f - Continue?)      ; echo config, confirm each run
```

`#2070` input dialogs + persistent user vars + a confirmation popup. ~80% of the CAM page's
value at ~10% of the cost: one `.nc` file, no eng edits, no bitmaps, no parameter pool,
K-key bindable (param 210–252).

**Decisions (revised 2026-06-12 — three tracks):**
1. **Studio's own wizards** → `#2070` + persistent-var + confirm pattern ("ask on
   controller" checkbox per parameter); everything else baked. Unchanged.
2. **Our machine** → optional personal probe pack via SMB push (gated on BENCH §5
   hot-reload results). Unchanged.
3. **Product track — "CAM pack builder" for macro AUTHORS** (the reframe that revives
   this): not exporting Studio's wizards to unknown machines, but tooling the existing
   community workflow. Target user = the pack authors (Okrill/Savelev/Goldbeck/Tie class),
   who own their machines and their support burden. Studio automates the miserable parts:
   - form-field designer → generates eng lines, auto-allocates `#11xx`/`-m` with
     **collision detection against installed/known packs** (impossible by hand today);
   - icon tool (draw/import/SVG template → 360×180 BMP);
   - **simulate before publish** (would have caught the cam13 X-only dead path pre-share);
   - USB pack exporter (CAM/ + eng merge + install README).
   Distribution stays the community's own channel (zip on the FB group).
   This track revives the shelved open questions in §7 (BMP constraints, `-t` flags,
   max form rows) — a builder needs them answered.

   **Risk & sequencing (2026-06-12):** unproven that authors prefer the CAM menu —
   macros circulate via ≥4 channels (file browser, K-keys, button hooks like
   `fndzero.nc`/T.nc, CAM menu), and the CAM menu may be the minority. Therefore the
   builder is **channel-agnostic**: the certain value is author → simulate → package;
   output formats ship in order (1) plain `.nc`, (2) K-key binding + README,
   (3) CAM slot bundle — (3) only after demand is validated (count pack-vs-plain shares
   in the FB group, or just ask the known authors before building the eng/BMP tooling).
- Vehicle-independent improvements from §6 (portable probe config, release-edge averaging,
  guarded G31, error taxonomy, `#1503` narration) go into the generators regardless.

---

## 5c. SMB deployment path (no USB) — partial rehabilitation for OUR machine

The Expert exposes its disks over SMB from the CNC-FAIRY gateway PC
(`\\192.168.0.99\CNCDISK` + `SYSDISK`, guest=root, read/write proven — see
`bridge/TRANSPORT_DECISION.md`). `SYSDISK` = the `nand1-1` system area where CAM macros,
bitmaps, `eng`, and `camsetting` live. So deployment to our machine can be a push over
the cable, not the community USB ritual. Per-file dynamics (expected, bench-verify §below):

| File | Firmware reads it | Dynamic w/o reboot? |
|---|---|---|
| `macro_camN.nc` | At launch (re-read each Start) | Almost certainly yes |
| `camN.bmp` | CAM page render or boot cache | Unknown — easy test |
| `eng` (labels/defaults/ranges) | Parsed at startup | Probably reboot; try language-toggle re-parse trick |
| `camsetting` | Firmware-owned values | **Never write it** |

Cautions: SYSDISK writes are system-partition writes — snapshot every file before
replacing; keep the firmware backup current; malformed `eng` could plausibly break boot.
All tests attended-only (live-CNC ground rule). Community distribution still = USB pack.

---

## 5d. REVIVED 2026-06-19 — building the CAM Pack Builder (track 3)

Decision: **build it.** Rationale changed since §5b: the Macros tab (custom M-codes + K-buttons)
and the **SMB sysfile push** (`/api/sysfile`, whitelisted + backed-up write/append) now exist, so
the macro-authoring + deployment plumbing is already paid for. The CAM Pack Builder reuses them; the
only genuinely new work is the **form-field designer + `#11xx`/`-m` collision detection**, the **icon
encoder**, and the **`eng` merge** — and the first of those is the impossible-by-hand killer feature.

Scope = §5b track 3 (tool the community authors; channel-agnostic), phased so the unblocked value
ships first and the open questions (§7) only gate the later phases:

- **Phase 1 (unblocked):** pack model + form-field designer with **`#11xx` auto-allocation +
  in-pack collision detection** + the macro **`#1100+k`→`#2600+k` mirror wiring** + **simulate**
  (reuse the sim) + **plain-`.nc` export**. Needs none of the §7 open questions.
- **Phase 2:** icon tool — draw / import / SVG-template (`cornerViz.svg` …) → 360×180 24-bit BMP.
- **Phase 3:** `eng` **merge** (never replace) + full `CAM/` bundle + USB packager / SMB push;
  gated on the §7 answers (BMP bit-depth, `-t/-p/-a` semantics, max rows, `#11xx` sharing, V1/V2) —
  resolve via one attended bench test or the FB "CAM Function instructions" doc.

Collision detection scope grows by phase: Phase 1 = within the pack; later = against the known
community packs (cam10–21) + factory usage (needs a small known-param database).

Implementation: `web/data/camPack.js` (pure logic — eng lines, allocation, collision, macro/eng
export) + a **CAM Builder** Settings tab. `camsetting` is **never written** (firmware-owned).

---

## 6. Techniques worth adopting (from `Cam13_Corner_Average`, Brad Goldbeck)

The strongest macro in the collection — patterns Studio's generators should absorb:

- **Machine-portable probe config** — read controller settings instead of hardcoding:
  `P#1078` (floating probe port), `L#1080` (level), `F#632` (probe speed), `#631` (averaging
  count). The macro inherits whatever the operator configured; no per-machine forks.
- **Release-edge averaging** — after the fast touch, scan slowly *away* with the trigger
  level inverted (`L[1-#1080] Q1`) and record where the probe *releases* (`#1925/#1926`);
  re-touch and repeat `#631` times, average the sum. Trigger-on-release at constant slow
  speed is highly repeatable and averages out noise.
- **G31 as guarded move** — clearance traverses and Z plunges done as `G31 … Q1` with a
  collision check, instead of blind G0/G1.
- **Differentiated error handling** — per-axis result vars (`#1920/#1921/#1922`) decoded as:
  `>2` limit reached, `==2` on a shouldn't-touch move = collision, `==0` = edge not found —
  each with its own popup and Z retract.
- **Status-bar narration** — `#1503 = 1(…)` before every motion phase, non-blocking.
- Confirms the mirror mapping: documented fields `#2616–#2622` = Vasily's eng `#1116–#1122`
  (cam13, group m33).

Cautionary bugs found in it (Studio's simulator/generators should prevent these classes):
1. X-only mode dead path — `IF #2618==0 GOTO15` exits before N10 zeroing ever runs.
2. No dual-gantry sync — writes Y offset (`#[806+#13]`) but never A (`#808`); would desync
   our Ultimate Bee gantry. Do not run unmodified on the dual-Y machine.
3. Unchecked release scans — no `#192x` check after the inverted-level scan; a non-release
   sums a stale position into the average.
4. Hardcoded F10 slow speed / 5 mm clearance (should be form fields or machine params).

---

## 7. Open questions / next steps

Live items (per verdict §5b):
- [ ] Add "ask on controller" (`#2070` + persistent var + confirm) mode to the probing
      wizard generators; allocate a persistent-var convention per wizard.
- [ ] Fold §6 techniques into generators: probe config from `#1078/#1080/#632/#631`,
      release-edge averaging option, guarded G31 moves, error taxonomy, `#1503` narration.
- [ ] Bench (attended, snapshot-first — see BENCH-CHECKLIST §5): macro hot-reload over
      SMB, BMP reload on CAM page re-entry, eng reload via language toggle vs reboot.

Shelved with the CAM-slot export (answer only if it's revived):
- [ ] Exact BMP constraints (bit depth, other sizes).
- [ ] `-t0/-t1` semantics and remaining eng flags (`-p`, `-a`).
- [ ] Max form rows per slot (scrolling? observed up to 8).
- [ ] Can two `-m` groups share the same `#11xx` numbers (would defuse the 400-field pool)?
- [ ] Macro writing `#11xx` directly for result display vs `#2600+` (packs suggest the
      form param write works).
- [ ] V1 vs V2 pack differences (`install/` vs `psys/`).
- [ ] Get the original "CAM Function instructions" doc from the FB group into the
      ddcs-expert skill references.
- [ ] Slot allocation policy (adopt community cam10–21 vs start at cam22+).

---

## 8. Build log + roadmap forks (2026-06-20)

The CAM Pack Builder (§5d) is built out. State:

### Shipped (all Simulate-verified — `DDCS-Studio/tests/cam-slot-sim.spec.js`)
- **Generators:** `data/opToSlot.js` (drill/bore × circle/grid/line/rect, + standalone slot),
  `data/probeToSlot.js` (corner, edge, inside-centre [rect pocket OR round bore], boss-centre,
  alignment), `data/millToSlot.js` (rect pocket, surface/face). Wired into the CAM builder Add-op.
- **`data/camMacroKit.js`** — shared emitters: `twoPassProbe`/`probeSave`, `wcsBase`, `writeAxis`
  (`#[805+(wcs-1)*5+ax]`), `rasterClear`, `spindleOn`/`spindleOff`/`SPINDLE_FIELD`.
- **▶ Simulate** per-slot modal — the sim engine now executes full DDCS macros (`WHILE/DO/END`,
  inline `IF…THEN`, trig coords). Seeds `#2600+` from field defaults. THE verification backbone.
- **Bug fixes (found while porting):** invalid named M-code → inline cut; edge wizard missing
  stylus-radius comp; sim two-operand `ATAN[a]/[b]` (atan2).
- **Spindle:** cutting slots manage the spindle: `M3 S[#rpm]` (BRACKETED var, per `key-7.nc`
  `M03 S[#140]`) + `G04 P2000` (~2s spin-up; **P is MILLISECONDS** on Expert — factory `slib-g.nc`
  has `G04 P100 //100ms` + many `P2000`) … `M5`. NB: `key-7.nc`'s author misread P as seconds.

### Controller-side access (how the operator reaches it — research doc §2.4 expanded)
- CAM page opened by a **K-key bound to function code 1399** (`Pr210–252`). Tap slot → form → Start.
- Slots only appear after `CAM/` is copied to **internal** storage (F2→Program→F1→F4); USB-run
  does nothing. Studio packs start at **cam22+**. eng lines must be **merged** (not replace).

### Roadmap forks
- **Spindle in CAM slots [DECIDED, verify on machine]:** included because `key-7.nc` proves
  self-contained op macros drive the spindle; safe either way (M3 only sets speed; editable line).
  Genuinely unverifiable from the dump: whether the CAM menu pre-starts the spindle.
- **(retracted) "wizard dwell bug":** investigated `makeStart`'s `G04 P2000`; it is CORRECT —
  G04 P is **ms** on Expert (factory `slib-g.nc` `G04 P100 //100ms`). Lesson: a factory file
  outranks a community macro (`key-7.nc` misread P as seconds).
- **In progress:** auto-icon (render 360×180 BMP from op type, §5 idea 2), Probe-Z/tool-touch slot.
- **Open variants:** circle pocket + spiral strategy; ramp/helical pocket lead-in.
- **Later:** install path (#5 — eng-merge testable now, SMB push per §5c); alignment real-correction
  (no G68; write `#763`/Pr263 Z-rot "in 3D toolpath mode", OR Studio rotates the program by #1512).
- **Field-count friction:** probe/cutting slots run 9–14 fields; the form is ~8 rows practical (§5).
  Mitigated by ordering job-params first; auto-icon + trimming defaults help.
