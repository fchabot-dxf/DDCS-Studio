# FAIRY MEMORY DUMP — the gateway seat's project memory, verbatim

**Produced on `CNC-FAIRY` (the Toughbook wired to the DDCS Expert), 2026-08-25**, per
[`FAIRY-MEMORY-DUMP-INSTRUCTION.md`](FAIRY-MEMORY-DUMP-INSTRUCTION.md).

## TOTAL: 7 memories

⚠ **The instruction was written expecting a store comparable to Studio's 165. It is 7.** That is not a
truncated dump — it is the whole store, and the size gap is itself a finding: this seat has been used for
hardware and bench work, not for accumulating project convention. Expect the useful output to be
**UNIQUE-TO-FAIRY** and **CONTRADICTION**, not overlap.

## ⚠ REDACTION — one, and what it was

`multi-pc-agent-setup` stated the shared git identity as a name-plus-email pair. The **email address is
replaced** with `[REDACTED — the owner's git account email]`. The load-bearing fact (one identity shared
across every PC, so `git log` cannot tell the machines apart) is untouched. Nothing else was redacted:
`192.168.0.99`, `N:`/`S:` and the `CNC-FAIRY` hostname all already appear throughout the repo's own docs.

⛔ Nothing was tidied, merged, corrected or dropped. Where a memory looks stale to me, it is dumped **as it
stands** and the suspicion is recorded at the bottom of this file, not applied to the text.

---

### cnc-toolsetter-and-ddcs-quirks
type: reference
description: "The physical CNC's fixed tool-setter fix (REAL bug = rapid descent, not the signal) + hard-won DDCS Expert V1.1 gotchas"

The DDCS Expert V1.1 controller (hostname **CNC-FAIRY**, shares `N:`=CNCDISK / `S:`=SYSDISK over `\\192.168.0.99`). Hard-won facts — check before touching the machine.

**Fixed tool-setter — SOLVED 2026-07-31 (took a full session; this is the CORRECTED diagnosis):**
- **THE REAL BUG: factory O502 rapid-descended `G53 Z#637` THROUGH the setter *before any G31 ran*.** A rapid ignores the probe input, so the tool drove straight through and no finger-press stopped it — it looked like a dead signal for the whole session, but the signal was fine all along. **Fix: DELETE the `G53Z#637` line** so the G31 probes the entire descent from the safe Z (`#641`) and stops on touch (like standalone CALIBRATE). **Tell:** drive-through at RAPID speed = approach bug; at PROBE (slow) speed = signal bug. Ask which speed FIRST next time.
- Signal was **factory-correct** — keep it FACTORY. O502 fixed path: `G31 … P#26 L#28` with `#26=#1075`, `#28=#1077`. **`#1075`=Fixed-probe input port = 2 (IN02)**, `#1076`=enable, `#1077`=level. Hardcoding `#28 = 1` (bare literal) tripped a DDCS **"syntax error!"** — yet `#26 = 2` on the line above parsed fine (unexplained parser quirk). Don't hardcode; set the config vars instead.
- `#1430` = Tool 1 Z-length offset (block #1430-#1449; `#[1430+tool−1]`) — a tool-table value via H1/G43, WCS-independent, so writing it never touches G54 Z0.
- **Reference model:** `CALIBRATE.nc` (run once after zeroing G54 Z0 on the spoilboard, any tool) stores `#2500 = [setter touch #1927] − [that tool's #1430]` (persistent #2500-#2599). Every tool: `#1430 = [touch] − #2500`. N18 write edited to `= [#31 - #2500]`.
- **Speed (factory crawls):** `#632`=150 (1st probe), `#631`=5 touches, and O502's re-probe loop base `#20=#500` (=10 mm/min) halving to 5/2.5/1.25. Fixed to: `#632=800`, `#631=2` (fast find + 1 accurate re-probe), and edited O502 `#20=#500` → `#20=160` (→ ~80 mm/min re-probe = CALIBRATE). `#632`/`#631` are GLOBAL (float64 `setting`, revert on reboot) → **sysstart re-applies them each boot**; they also affect the FLOATING probe (verify it still zeros).
- **Rotary/crawl (SEPARATE issue):** approach XY move `G53X#10Y#11A#13B#14C#15` crawls when B is unhomed (coordinated move dragged by the unhomed rotary). Stripped to `G53X#10Y#11`; sysstart also zeros B in place (`#884=0`+`#1519=1`, no homing move).
- **Whole working recipe = the restore routine:** DDCS-Studio `bridge/controllers/expert-m350/…/RESTORE-CUSTOM-MACROS/` → `patch-slib-g.py` (4 slib-g edits: strip rotary 408, **DELETE descent 409**, #2500 on N18, re-probe base #20=160), `SETPROBE.nc` + `sysstart.nc` (config: #1075=2,#1077=1,#632=800,#631=2). Floating/first-fixed O502 paths untouched. Pristine slib-g backup = `S:/slib-g.nc.bak2`.
- **G54 Z0 = SPOILBOARD, SACRED.** Order: zero G54 Z0 on spoilboard → CALIBRATE → Fixed Probe per tool. Verify: jog to Z0, tip on spoilboard; off by ~2× ⇒ flip the `#2500` sign. K-buttons "just light up" = assignment lost in the flash (re-assign in Settings→Key Settings); everyday tool setter = the on-screen **Fixed Probe** button (no assignment needed). See [[ddcs-macro-writing-rules]] (never `G53 G1`).

**DDCS Expert quirks that bit us:**
- `G53` needs a **variable**, not a literal: `#101=0 / G53 Z#101` (never `G53 Z0`).
- Comments **cannot nest parens** — `( … ( … ) )` throws "bracket/Unrecognized characters" (also the app export bug fixed in `917f8856`).
- Arithmetic needs **brackets**: `#102 = [#100+5]`; a literal in a motion word can error — put it in a var first.
- **`M115` (home-all) at boot FAILS** — it enters factory O501 homing with `#1` (axis index) dirty → "Macro address does not exist: `#[1920+#1]`". Home **per-axis** with `M98P501X<n>` (the `X`-arg sets `#1`). sysstart uses per-axis, not M115.
- The **`setting` file is a float64 array** (8 bytes/param). Slot = param−500 for ≥500 (e.g. #632→slot 132, #635→135, #637→137). `camsetting` = #1000-1499 (slot = #var−1000). Reads can be unreliable — verify at the machine.

---

### ddcs-firmware-downloads
type: reference
description: DDCS manufacturer download/list page — resource for grounding DM500 (V3) setting-file layout from a real dump

DDCS (ddcnc.com) manufacturer downloads/lists page the user pointed at for **grounding the DM500
(V3) `setting` file layout**, which is currently ungrounded (values N/A — see
[[var-read-address-systems]] and the dumpImport.js DM500 caveat):

  http://www.ddcnc.com/?m=home&c=Lists&a=index&tid=106&lang=en

Use when we reach the **V3 iteration** of the address-map unification (Expert + V4.1 done first,
then V3). The DM500 `setting` binary is NOT the index=offset·8 layout Expert/V4.1 use, so DM500
geometry resolves field NAMES by-eng but VALUES stay N/A until a real dump confirms the layout.
This page is where firmware/manuals/dumps may be obtained to do that grounding.

**Web-search findings (2026-08-18) — no downloadable DM500 dump on the open web:**
- ddcnc.com + bbs.ddcnc.com have **expired SSL / refuse HTTPS** (WebFetch forces HTTPS → unreachable;
  a browser over HTTP with cert-accept can still reach them). The forum has a DM500 firmware thread
  "M150_DM500 Upgrade file download" (bbs.ddcnc.com/forum.php?tid=168) but I couldn't connect.
- Every GitHub "DM500" hit is the unrelated **Dreambox set-top box**, not the CNC controller.
- **The real grounding path (from the DM500 user manual, manualslib.com/manual/1518486):** a DM500
  does a **USB parameter backup → a file named `Setting` in the USB ROOT** (not `.set`; capital S).
  Firmware update file is named **`INSTALL`**. Parameters are index-numbered; indices seen in the
  manual: **69, 116, 390-393, 400-403, 408-411, 423** (DM500's OWN numbering — different from Expert).
  DDCS V2.x used a TEXT `setting.set`; the DM500/V3 format is unconfirmed (text vs binary) until a
  real `Setting` file is decoded.

**UPDATE (2026-08-18) — the dump was ALREADY IN THE REPO.** `bridge/controllers/dm500/` holds a real
`setting` (170000 B = 21250 f64) + `install/eng` (311 params). No external dump was needed. Full
findings + the DM500 geometry role→eng-index MAP are now in `bridge/controllers/dm500/FINDINGS.md`
(the map is BUILT: active WCS #16, home dir #64-67, home speed #56-59, soft-limits #375-382, pulse
#34-38, etc.).

**CRACKED + GROUNDED + WIRED (2026-08-18, commit d0fe7eaa).** The DM500 setting is a SELF-DESCRIBING
record format `[float32 value][name string\0]` — NOT the flat f64 array Expert/V4.1 use (that gave
garbage because those "f64s" are ASCII names). Decode = for each eng `-s1` name, find `name\0` in the
bytes, read the little-endian float32 at `pos-4`. Verified 244/244 params in-range. `dumpImport.js`
`parseDm500ByName()` now grounds the DM500 envelope (in-repo capture: X/Y ±400, Z ±20, pulse 640, home
speed 1600, active WCS G54, G0 3000, spindle 24000). Gated by dump-import-golden + dump-import-ui.
Remaining: the WCS G54-G59 offset TABLE isn't stored as named records here → WCS stays N/A (honest
partial); envelope/home-dir/rapid ARE grounded. Full detail: `bridge/controllers/dm500/FINDINGS.md`,
[[var-read-address-systems]]. No external dump was ever needed — it was in-repo all along.

---

### ddcs-macro-writing-rules
type: feedback
description: "How the user wants DDCS G-code macros written (hard rules, some paid for in broken tools)"

Writing DDCS macros for CNC-FAIRY. Follow exactly:

- **Comments DESCRIBE what a line does — never flag, warn, or editorialize in the code.** No "NO G53 G1", no "known-good", no step numbers as commentary. Safety notes go in chat, not the macro.
- **Never double/nested parentheses in a comment** — `( … ( … ) )` throws a DDCS bracket error and rejects the line. Keep comments flat.
- **Never `G53 G1`** — it does NOT lift/position correctly on this DDCS and **crashed the tool into the table** (broke a bit, 2026-07-23). Use a plain `G53` rapid for machine-coordinate moves (`G53 Z#var`). `G53` also needs a variable, never a literal.
- **Don't guess DDCS syntax** — use the [[cnc-toolsetter-and-ddcs-quirks]] facts and the `ddcs-expert` skill's documented patterns (`CORE_TRUTH.md`, `gcodeSyntax.md`) before writing. Repeated guessing (nested parens, `G53 G1`) has cost real hardware.
- **Never hand over an autonomous-move macro that contains an unverified motion command.** Verify each move alone (MDI / one-liner, slow feed, tiny distance, hand on E-stop) before combining or speeding up.

**Why:** a `G53 G1` "speed-up" I inserted on a guess drove the tool down into the table instead of lifting. The user is (rightly) done with guesses — macros must be correct by the documented rules, not by assumption.

---

### feedback-scope-discipline
type: feedback
description: "user wants scope kept small on things they call minor/don't-care; over-investigating a \"doesn't matter\" remark is a correction, not a compliment"

When the user says something "doesn't really matter" / "just make it an honest stub/dead end" / similar
low-stakes framing, treat that as a real scope ceiling — not an invitation to fully investigate and build a
feature around it. Caught 2026-08-18: user said "im not using beacons," then "honestly it doesnt really
matter we can just make them honest stub dead end" — I traced the whole poller/history/position-cursor
architecture and built a new API route + UI stub + 3 test files. User's actual response: "honestly dont put
too much effort in this i dont even understand what your doing."

**Why:** the user is not always tracking the technical depth of what gets built, especially for backlog/
someday items they've explicitly deprioritized. A big, well-tested change for a thing they called minor
reads as ignoring their signal, not as thoroughness.

**How to apply:** when a request carries "doesn't matter" / "dead end" / "just make it honest" framing,
default to the SMALLEST change that satisfies the literal ask (often just clearer wording/labeling, not new
plumbing) and check in before expanding scope — especially before adding new API surface, new files, or
multiple test suites. If real investigation turns up something substantive (like the position-tracking gap
did here), summarize the finding in plain language FIRST and let the user decide whether it's worth building,
rather than building it and explaining after. See [[var-read-address-systems]] for a case where deep
investigation WAS wanted (t2073) — the difference is the user drove that one forward step by step; this one
was volunteered.

---

### multi-pc-agent-setup
type: project
description: User runs DDCS-Studio across multiple PCs (incl. CNC-FAIRY) with a shared git identity; wants agent coordination

The user develops DDCS-Studio across **multiple PCs** with the **same git identity** (`[REDACTED — the owner's git account email]`), so `git log` cannot currently tell which machine made a commit. One of those machines is the **Fairy tablet at the DDCS CNC controller** — its hostname is `CNC-FAIRY` (this is the box Claude Code often runs on; it mounts the controller's `\\192.168.0.99\CNCDISK` as `N:` and `SYSDISK` as `S:`).

On a single PC there can be **several agents at once** (e.g. an *advisor* doing read-only planning/review and a *worker* doing edits/commits). The user wants a way for agents to **see which machine/agent is working and avoid colliding**.

**Design direction discussed (2026-07-17):** identity = `host/role/session`; publish *intent* (read-only vs writing) + claimed paths, not just presence. Two tiers: (1) **local lockfile** for same-PC worker↔worker collisions (fast, no network); (2) **pushed heartbeat/presence branch** (`agents/<host>-<role>-<session>.json`, timestamped, stale entries ignored) for cross-PC visibility — advisory only, since git is not a real-time mutex and Fairy may be offline. Per-PC working branches (`work/<host>`) were floated as the most reliable structural avoidance. Not yet implemented.

---

### var-read-address-systems
type: project
description: "DDCS param reads use TWO address systems over one file; macro numbers are per-controller; unify on a declared address map, not one call"

The bridge reads controller parameters through **two address systems over the same on-disk file**, and that duplication caused the t2067 "WCS 000" bug:

- **Macro-number space** — `#805`, `#578`, `#1430`. What G-code writes; what the var-read (`ops.py _var_value`/`read_vars`) speaks. Translates with fixed offsets: setting `n−500`, camsetting `n−1000`, uservar `n−100`.
- **Param-index space** — `setting[305]`, base `#305`, active `#78`. The file's native index; what the geometry mapper (`_map_geometry_to_profile`) reads directly.

`#805` and `setting[305]` are the **same slot**; the `−500` is the bridge between the systems. The bug: that `−500` was encoded **independently twice** (var-read did `n−500`; the mapper hardcodes `_WCS_BASE=305`), the var-read forgot it → read `setting[805]`=0 while the mapper stayed correct. Two systems, one translation written twice → they drifted.

**Key facts established (2026-08-18):**
- The var-read is **ours**, not a controller call-code: `_read_setting_params` does `open(SYSDISK/setting,'rb')` + `struct.unpack('<Nd')` — the controller hands an unlabeled float64 blob; ALL addressing (`#805`→index) is our Python. (The only real controller call-codes are the **Modbus** registers 7080/7260/10002 = live position/state, NOT part of the pull.)
- **Everything the pull reads is a disk-file snapshot, not live** — WCS/tools/ATC all decode `setting`/`camsetting`. "Live var-read" is a misnomer.
- **Macro numbers are per-controller, NOT universal.** `#805=WCS-G54-X` is an Expert fact. On **V4.1 the WCS isn't in `setting` at all** — it lives in a separate `coord1` coordinate-system file, meanings come from `eng` by name. So there is no V4.1 `#805` to unify onto. The universal key is the **semantic role** ("active WCS X"), which is what the profile mapper already is.

**Direction agreed with user (brainstorm, not yet built):** do NOT fold everything into the var-read ("one call" would break V4.1 + lose semantics). Instead unify the **address knowledge** into ONE declared per-controller map `role → {file, index/block, stride}`; both the profile mapper and the var-read resolve through it (var-read = the Expert-only, G-code-facing view). Also drop the **redundant WCS var-read fallback** in the pull (same file as the mapper, can't add anything) so WCS has a single source — see [[cnc-toolsetter-and-ddcs-quirks]] for the setting-file slot map.

---

### wizards-as-data-port
type: project
description: "DDCS Studio is mid-port of its wizards to a \"data\" representation; ops have TWO build paths that must stay in sync"

DDCS Studio (the desktop app in `DDCS-Studio/DDCS-Studio/web/`) is **on the verge of / mid-port of "wizards as data"** — moving op wizards from imperative builders to a declared DATA representation (data-ops + a cutting "twin"). As of 2026-08-08 this is the active direction.

**Practical consequence (learned the hard way on the t1620 skim fix):** a surfacing/skim op is built by **TWO parallel paths that must stay in sync** —
- **built-in path:** `web/blocks/programFraming.js` `makeSkim` (via `surfacingStack`), and
- **data-twin path:** `web/blocks/dataOps/skimStructure.js` `applySkimStructure` → `swapPlaceToSkim`.

A structural fix usually has to be applied to **BOTH**. The skim "renders nothing in the sim" bug (flow-label collision: `skimErr/skimOk` fell back to 93/94, already taken by the raster row-walk, so the post-plunge `GOTO` hit the skim-OK label and the sweep never ran) needed the `zMode:'skim'` stamp on the absorbing child in **both** `makeSkim` and `swapPlaceToSkim`. The `surfacing-skim-982` node test only exercises the built-in path, so it went green after the first edit even though the twin was still broken — check both.

**Node test tier is browser-free** (`tests/node/*.test.mjs`): `page.evaluate` runs in-process, imports resolve to `web/`. Run with `node --import ./tests/node/support/register.mjs --test tests/node/<file>.test.mjs` — no dev server/browser needed. The `.spec.js` tier is Playwright (needs the browser). See [[cnc-toolsetter-and-ddcs-quirks]] for the machine side.

**Status (2026-08-08):** the t1620 skim RENDER fix shipped — commit `af391806`, node tier 99/0, logged in `WORK-LOG.md` under `## t1620`. Playwright/golden tier NOT yet re-run for it — do a `npm test` before calling skim fully shipped. **Deferred follow-up (NOT built):** the skim start-position GUI (human wanted skim to use the probe-wizard start-position picker) — sim-only, zero emit change: a `surfacing` provider in `web/wizards/opSimStarts.js`, a draggable in `web/wizards/surfacingView.js`, seed `#790/#791/#792` via `previewVarSeed`. Full plan is in the WORK-LOG t1620 entry's "What this does NOT cover".

---

## ⚠ WHAT I ALREADY SUSPECT — flagged while dumping, NOT applied to the text above

Recorded here because §"what the analysis will look for" asks for it. **These are the dumping seat's
suspicions, not corrections.** Every memory above is untouched.

**① ⭐ THE ONE THAT IS ACTIVELY DANGEROUS — `var-read-address-systems` overstates the Modbus registers.**
It says, flatly: *"The only real controller call-codes are the **Modbus** registers 7080/7260/10002 = live
position/state."* Two problems, both measured since it was written (2026-08-18):
* Those registers have **never once answered.** On 2026-08-20 this seat ran a raw FC03 probe at the real
  Expert: the controller replied **exactly one byte, `0x00`, to all three** — the signature of no slave
  answering at all. See `controllers/expert-m350/FINDINGS.md` → *"Live position polling — FIRST REAL ATTEMPT"*.
* The map's own source is second-hand (foinnc/M3X-M350-IoT-Bridge) and **explicitly unattested**, and the
  OEM's `M350-Modbus Manual_V1_1.pdf` was checked page by page and does **not** contain a slave-mode
  register map at all — it documents only the controller-as-master direction.
⇒ A memory calling them "the only real controller call-codes" reads as settled ground truth for something
that has never transacted. **This is exactly the shape the instruction warns about: trusted without
re-derivation.** Fairy is the authority here and Fairy's own bench says otherwise.

**② `cnc-toolsetter-and-ddcs-quirks` states the `setting` format unqualified.** *"The `setting` file is a
float64 array (8 bytes/param)"* — true for **Expert and V4.1 only**. `ddcs-firmware-downloads` records that
the DM500/V3 is a completely different self-describing `[float32][name\0]` record format, and that reading it
as f64 *"gave garbage because those f64s are ASCII names."* The two memories do not contradict each other,
but the first is written as universal and will be recalled as universal.

**③ `wizards-as-data-port` is a status memory dated 2026-08-08 and the arc has moved enormously since**
(the t2255–t2287 run alone). Its *"as of 2026-08-08 this is the active direction"* and its deferred-follow-up
list are the most likely stale entries in this store. ⇒ **Studio is the authority on this one, not Fairy.**

**④ `multi-pc-agent-setup` says the coordination design is *"not yet implemented"*** — but the ROLES arc
(S1/S2/S3, t2145/t2151/t2173) has since shipped client-side role derivation and a Status tab that states
client-or-gateway. Possibly superseded rather than pending; worth checking rather than assuming either way.

**⑤ Overlap candidates, for the "move it into the repo" split:** `ddcs-macro-writing-rules` and
`feedback-scope-discipline` are both about **how the human wants work done**, which the instruction places on
the *seat preference* side of the split — but the macro rules are **machine ground truth paid for in a broken
bit** (`G53 G1` crashed the tool into the table) and arguably belong in the repo where every seat reads them,
not in one seat's memory.

**⑥ A description-as-index datapoint, since the instruction raised it.** The failure it describes — the word
"fairy" missing from a description — **does not repeat here**: `multi-pc-agent-setup` names `CNC-FAIRY` in
its description. But `cnc-toolsetter-and-ddcs-quirks` is the single richest hardware memory in this store and
its description says only *"The physical CNC's..."* — no hostname, no `192.168.0.99`, no "Expert M350" model
string beyond "DDCS Expert V1.1". A recall keyed on the machine's name or address would not find it.
