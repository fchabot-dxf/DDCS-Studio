# Porting DDCS Studio to other controllers (grbl · Mach3 · Mach4 · UCCNC)

> Working notes for retargeting DDCS Studio — a full-fledged **macro studio** for
> DDCS controllers (wizards that author macros + G-code) — to other controllers.
> Architecture findings, lose/gain tradeoffs, the target comparison, and the
> (now-gathered) reference dumps.

## TL;DR

- DDCS Studio is a **macro studio** → the port targets controllers that *have* a
  macro system: **UCCNC** (C# macros), **Mach4** (Lua), **Mach3** (VBScript) — plus
  **grbl/grblHAL** as the easy, large-install-base streamer.
- The app is **already layered**: only the "smart" wizards (probe/ATC/WCS/comm) are
  DDCS-locked; toolpath/geometry is controller-agnostic, and a `words.js` + `dialect.js`
  "post profile" seam already exists for dialect swapping.
- **Best destinations:** **UCCNC** and **Mach4** — modern, macro-capable, keep the
  smart wizards as native macros. **Mach3** works but is legacy/sunset → use as
  reference, not destination. **grbl** = easy (flat G-code already emitted); its
  probe/ATC relocate host-side into the bridge. (LinuxCNC = strongest technical fit
  if open-source is acceptable.)
- **Status 2026-06-13:** real source dumps for all four gathered under
  `bridge/controllers/*/assets/`. Next phase = decode var tables + G/M codes →
  map DDCS→target → translate wizards (vertical slice first).

## The app is already layered for this

Three tiers; only the top is DDCS-specific.

1. **Toolpath / geometry math** — `DDCS-Studio/web/wizards/ops/`, `clearing.js`,
   `strokeFont.js`. Pure geometry solved in JS, emitted as flat `G0/G1/G2/G3`.
   **Controller-agnostic already.** Covers the daily CAM: drill, pocket, slot,
   surfacing, text/engrave. Drilling is flattened to explicit moves (no G81/82/83).

2. **A deliberate "post profile" seam** —
   - `DDCS-Studio/web/wizards/words.js` — *lexical*: spacing, `padGM` (G0 vs G00),
     separator, EOL (`\n` vs `\r\n`), comment style, per-line `transform` hook.
   - `DDCS-Studio/web/wizards/dialect.js` — *grammatical*: IF/GOTO form, `G53`
     form (`g53Rapid`), WCS base addressing (stride-5 DDCS rule vs FANUC stride-20).
   - Defaults reproduce current DDCS output byte-for-byte, but the switch points
     already exist. Comments literally call this "the editable post profile."

3. **The "smart" wizards** — probe / ATC / WCS / comm. The only DDCS-locked layer.
   Embed DDCS `#variables` (`#1920` probe status, `#1925` result, `#805+` WCS,
   `#1504` target tool), DDCS M-codes (M154/M155 drawbar, M300–302 sensors,
   M162/163 dust cover), and `IF #x!=2 GOTO1` flow control.

The bridge (`bridge/`) is a separate relay (cloud-poll → SMB drop to the Expert).
It is **loosely coupled to G-code content** — it ships `.nc` files, doesn't parse
them. A new target needs a new transport backend (e.g. USB serial for grbl), but
the bridge doesn't care about dialect.

## Target landscape — 4 candidates

| | Macro lang | Probe (in-prog result) | ATC / tool table | Dev status | Hardware |
|---|---|---|---|---|---|
| **UCCNC** | **C#** | `G31` → `Getvar(5061)` | `M6`/`M31` + tool table | active (CNCdrive) | CNCdrive boards only |
| **Mach4** | **Lua** | `G31` → `#vars` | `M6` macro + tool table | active ("future direction") | plugin-based (ESS etc.) |
| **Mach3** | VBScript | `G31` → `#vars` | `M6` macro | **sunset** (Mach4 successor) | parallel / ESS / UC100 |
| **grbl / grblHAL** | none / C plugins | `G38.2`, host reads `[PRB:]` | none / grblHAL plugins | active (open) | ESP32 / 32-bit |

**Pick:** **UCCNC** is the lowest-friction *destination* for a macro-studio dev — C#
macros (you think in that family), full `G31`/ATC/tool-table, cheap reliable hardware.
**Mach4** is the equal alternative if you want hardware freedom (Lua + many motion
devices). **Mach3** = reference corpus only. **grbl** = the easy win (milling already
ports; probe/ATC go host-side). Per-target detail: `bridge/controllers/<id>/FINDINGS.md`.

## Reference dumps gathered (real source, in repo)

All four targets now have **actual source** (not just docs) under `bridge/controllers/*/assets/`:

| Target | Dump | Kind |
|---|---|---|
| **grbl** | full firmware C source (`gcode.c`, `probe.c`, `motion_control.c`…) | open firmware |
| **UCCNC** | 43 real C# macros — `M6`, `M3`, ATC/probe suite `M200xx` (`HTM_ATC`) | macro source |
| **Mach3** | `.m1s` VBScript — `M6Start/End` + 27 probe macros `M901–927` (`ProbeWizard`) | macro source |
| **Mach4** | `.lua` — StoryTechShop probe/screen scripts | macro source |
| (docs) | Mach3 137-pg + Mach4 33-pg + UCCNC 127-pg reference PDFs | API reference |

Plus the **DDCS source side** (already owned): native `.nc` macro library + disk
captures under `bridge/controllers/{dm500,v4.1,expert-m350}/`.

## ATC Rosetta stone — UCCNC `M6.txt` ↔ `atcChangeWizard`

The stock UCCNC `M6.txt` (in `uccnc/assets/HTM_ATC/Profiles/Macro_HTM/`) maps ~1:1
onto the DDCS ATC wizard — the clearest proof the translation is mechanical, not a rewrite:

| DDCS Studio (`atcChangeWizard`) | UCCNC `M6.txt` (C#) |
|---|---|
| drawbar `M154/M155` | `exec.Setoutpin/Clroutpin(drawbarPort, drawbarPin)` |
| pocket X/Y/Z tables `#1330/#1350/#1370` | `rackX + (slot-1)*stepRack`, `rackY`, `rackZ` |
| G53 park/retract | `exec.Code("G00 G53 Z"+safeZ)` |
| target/current tool `#1504/#1300` | `exec.Getnewtool()` / `exec.Getcurrenttool()` |
| sensor waits `M300–302` | `CheckSlot()` LED-poll + debounce |
| dust cover / air | `exec.Setoutpin(airPort, airPin)` |

## grbl vs the macro controllers — opposite kinds of port

**Mach3 — architectural cousin of DDCS.**
Macro controller: `#variables`, `G31` probing (same probe word as DDCS), canned
cycles, tool tables, `G10 L2` work offsets. Port is mostly **dialect translation**
— exactly what tier 2 was built for. Catch: Mach3 has **no native IF/GOTO/WHILE**
in the part program; that logic lives in **VBScript M-macros**. So probe/ATC
wizards become "part program calls M-macro; macro does the branching."

**grbl — opposite of DDCS.**
Dumb, fast streaming interpreter. **No `#vars`, no expressions, no IF/GOTO, no
subroutines, no macros, no canned cycles.** Cannot run tier 3 on the controller.
To keep probing/ATC you move the logic **host-side** (bridge/sender): stream
`G38.2`, read the `[PRB:]` result back over serial, decide next move in JS, stream
it. Plain milling is trivial (already flat). grbl *does* support `G10 L20` /
`G54–G59` work offsets and `G38.2` probing — so WCS is actually possible (the app
currently avoids G10 by choice).

## Lose / gain

| Capability | Mach3 | grbl |
|---|---|---|
| Toolpath wizards (drill/pocket/slot/surfacing/text) | keep, dialect-translated | keep, near-zero change |
| Probing | keep — `G31`, results in `#vars` | keep, but logic moves host-side (`G38.2` + read-back) |
| ATC / tool change | keep — M6 + VBScript macro + tool table | DIY host-side, no on-controller tool table |
| WCS setting | keep — `G10 L2` | possible via `G10 L20` (would add; app avoids G10 today) |
| Comm/display prompts (`#1505`) | via macro / screen-set | none on controller; prompts move to the app |
| You *gain* | mature PC DRO/UI, real canned cycles, huge install base | dirt-cheap HW (ESP32/Arduino), simplest streaming, big hobby community |
| You *lose* | it's legacy (XP-era, parallel-port; Mach4 is the successor) | the whole on-controller intelligence model; Studio becomes a live streamer |

## Macros on grbl — relocated, not lost

grbl firmware has **no macro engine** (no `#vars`, expressions, `IF/GOTO`, subs,
canned cycles). A DDCS-style self-contained `.nc` macro can't run on the controller.
But the macro *concept* splits in two:

- **Pre-expanded macros** (peck drill, bolt circles, pockets, canned cycles) →
  **kept for free.** Studio already emits these as flat `G0/G1/G2/G3`; grbl runs
  them directly. The "macro" always lived in Studio, not the controller.
- **Interactive macros** (probe-then-branch, ATC, tool length) → **relocated to the
  host** (bridge/sender): stream a move, read grbl's serial response, decide, stream
  the next. This is exactly how grbl senders (CNCjs, gSender, bCNC, UGS) implement
  their "macro" buttons.

If you want true *on-controller* macros, that's Mach3 (VBScript) or LinuxCNC
(`O`-word subs + `#vars`) — not grbl, grblHAL, or FluidNC.

## Probing on grbl — yes, with host-side logic

grbl has a dedicated probe pin and the full `G38.x` family:

| Word | Motion | On no-contact |
|---|---|---|
| `G38.2` | toward part, stop on contact | ALARM (safe default) |
| `G38.3` | toward, stop on contact | no error |
| `G38.4` | away, stop on loss of contact | ALARM |
| `G38.5` | away, stop on loss of contact | no error |

After each probe grbl pushes `[PRB:x,y,z:success]` over serial (success `1`/`0`).
That flag is the equivalent of the DDCS `IF #1920!=2` status check; `G38.2`'s
ALARM-on-no-contact is the error path.

**Catch:** grbl has no in-program probe variables and no `IF/GOTO`, so the program
can't branch on the result — the **host** reads `[PRB:]` and drives the next step.
The two-pass probe from `probeBlocks.js` becomes a bridge routine:

```
host → G38.2 Z-10 F200      (fast)
grbl → [PRB:..:1]           host checks flag, aborts if 0
host → G0 Z1                retract
host → G38.2 Z-2 F50        (slow re-probe)
grbl → [PRB:..:1]           host reads Z
host → G10 L20 P1 Z<thk>    set work zero from the reading
```

Common probing (touch-plate Z-zero, edge/corner find, autolevel height maps) is
already solved host-side by CNCjs / gSender / bCNC / UGS — the bridge would do the
same. Net: probe wizards survive the grbl port, compiled to a host routine instead
of a controller macro.

## Effort buckets

- **Cheap / high-leverage (do first, any target):** add a `dialect` field to the
  controller profiles (`DDCS-Studio/web/shared/js/profiles/controllerProfiles.js`)
  and have it drive `words.fmt` + `dialect.rules`. This alone makes all of tier 1
  emit for a new controller.
- **Mach3:** dialect mapping (IF→VBScript M-macro, `#var` families, `G10 L2` WCS,
  M6 macro). Medium; high feature retention.
- **grbl:** a "flatten everything, no on-controller logic" emitter + host-side
  probe/ATC state machines in the bridge; hide/disable wizards grbl can't express.
  Trivial milling; substantial smart-wizard relocation.

## Status & next phase

- ✅ **Targets:** grbl/grblHAL, Mach3, Mach4, UCCNC (macro-capable + the easy streamer).
- ✅ **Dumps gathered:** real source for all four in `bridge/controllers/*/assets/` (above).
- ✅ **DDCS source side:** native `.nc` macro library + disk captures already in repo.
- ⏭ **Decode** — var tables + G/M-code sets per target (UCCNC/Mach3/Mach4 are documented;
  DDCS is ~80% in `default_vars*.js` + the native `.nc` macros). Static work, no runtime.
- 🔜 **Map the machine primitives FIRST (before any wizard)** — the wizards ride on a
  small HAL of primitives (probe move/trigger/OK, work-offset write, machine-pos read,
  output/input pins, operator prompt, flow). Mapped once per controller in
  `bridge/controllers/MACHINE-PRIMITIVES-MAP.md` (rows 1–6 already grounded from the real
  dumps). This is also the **machine/ports/IO config** model distribution needs.
- ⏭ **Translate** — once the primitives bind, each wizard is *mechanical substitution*
  over them. **First vertical slice: corner probe → UCCNC** (widest DDCS→target gap,
  best reference on hand → de-risks the whole port).
- ⏭ **Wire** — add a `dialect` field to `controllerProfiles.js` driving `words.fmt` +
  `dialect.rules`; generate the Studio-side descriptor from confirmed findings.

Open decision: **why port** (cheaper HW / second machine / reach more users) still tilts
UCCNC-vs-Mach4 via hardware lock-in tolerance. LinuxCNC remains the strongest *technical*
fit (in-program `#vars`, `O`-word subs, `IF/WHILE/GOTO`, `G38.x` results, `M6` remap) if
open-source is on the table.

## Key files

- `DDCS-Studio/web/wizards/words.js` — lexical post layer (the back door).
- `DDCS-Studio/web/wizards/dialect.js` — grammatical post layer (IF/GOTO/G53/WCS).
- `DDCS-Studio/web/wizards/ops/` — controller-agnostic toolpath geometry.
- `DDCS-Studio/web/wizards/clearing.js` — flat pocket clearing (no #vars/canned cycles).
- `DDCS-Studio/web/wizards/probeBlocks.js` — DDCS `#1920+`/`G31`/IF-GOTO probing.
- `DDCS-Studio/web/wizards/atcChangeWizard.js` — DDCS ATC (M154/155, M300–302, #1504).
- `DDCS-Studio/web/shared/js/profiles/controllerProfiles.js` — profiles (metadata
  only today; the place to add a `dialect` switch).
- `bridge/` — transport relay, loosely coupled to dialect.

### Target reference dumps (gathered)
- `bridge/controllers/grbl/` — `FINDINGS.md` + `assets/grbl-firmware-src/` (firmware C) + commands ref.
- `bridge/controllers/uccnc/` — `FINDINGS.md` + `assets/HTM_ATC/` (C# macros incl. `M6.txt`) + macros PDF.
- `bridge/controllers/mach3/` — `FINDINGS.md` + `assets/ProbeWizard/` & `manual_tool_change/` (`.m1s`) + macro PDF.
- `bridge/controllers/mach4/` — `FINDINGS.md` + `assets/StoryTechShop_Mach4/` (`.lua`) + scripting PDF.
