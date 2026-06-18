# grbl — Port Findings (candidate target, NOT owned yet)

**Unit:** none yet — grbl runs on Arduino/ESP32-class hardware (desktop CNC, 3018, diode
lasers). **Scope:** facts about grbl as a *target* for DDCS Studio output. Everything here is
from grbl docs/spec/source — **nothing tested on hardware we own.**
**Studio-side emitter analysis:** [`../PORTING-GRBL-MACH3.md`](../PORTING-GRBL-MACH3.md).

> Tags: `[CONFIRMED via docs]` documented/spec behavior · `[TO TEST]` needs our hardware ·
> `[HYPOTHESIS]` unverified guess · `[ANALYSIS]` derived from reading Studio's code.

---

## What grbl is, relative to DDCS
- A **streaming interpreter**. No on-controller program logic — the *sender/host* holds all the
  intelligence and feeds lines over serial. The opposite of DDCS's on-controller macro model.
  `[CONFIRMED via docs]`
- **Variants matter** (pick before committing): classic **grbl 1.1** (8-bit AVR/Uno),
  **grblHAL** (32-bit, more I/O, plugins), **FluidNC** (ESP32, SD-card exec, WebUI, WiFi).
  None add a `#var`/`IF`/`GOTO` macro language. `[CONFIRMED via docs]`

## G-code support (grbl 1.1)
- **Supported:** `G0 G1 G2 G3 G4 G10L2 G10L20 G17/18/19 G20/21 G28 G30 G53 G54–G59 G61 G80
  G90 G91 G92 G93/94 G38.2–G38.5 G43.1 G49`; `M0 M1 M2 M30 M3 M4 M5 M7 M8 M9`. `[CONFIRMED via docs]`
- **NOT supported:** `#variables`, expressions/math, `IF/GOTO/WHILE`, `M98/M99` subroutines,
  macros, canned cycles (`G81/G82/G83`), `G43` (only `G43.1`). `M6` is parsed but there's no
  auto-tool-change. `[CONFIRMED via docs]`

## Capability matrix (caps keys per the porting doc)
| cap | grbl | note |
|---|---|---|
| onControllerMacros | ❌ | logic lives in the host |
| variables (`#`) | ❌ | none in the part program |
| flowControl | `host` | no `IF/GOTO` on-board |
| probeWord | `G38.2` | + `G38.3/4/5` |
| inProgramProbeResult | ❌ | result pushed as `[PRB:x,y,z:ok]` over serial; host reads |
| cannedCycles | ❌ | **Studio already flattens drills → compatible** `[ANALYSIS]` |
| toolTable / ATC | ❌ | host-side only |
| toolChange | `host`/`manual` | `M6` = pause/no-op at best |
| wcsSet | `G10L20` / `G10L2` | `G54–G59` supported (Studio currently avoids G10) |
| arcs | `IJK` | `G2/G3` with I/J/K ✅ |
| transport | serial-stream | char-counting protocol; ESP32 builds add telnet/WS |

## Ports directly (Studio → grbl, little/no change)
- All **flat toolpath wizards** — drill, pocket, slot, surfacing, text, arcs — already emit
  `G0/G1/G2/G3`. `[ANALYSIS]`
- Spindle `M3/M4/M5`, coolant `M7/M8/M9`, `M30`. `[CONFIRMED via docs]`
- Drill peck/bolt patterns: already expanded in JS (no `G83` needed). `[ANALYSIS]`

## Moves host-side (into the bridge — this is the real build)
- **Probing**: stream `G38.2`, read `[PRB:…:1/0]`, decide, issue `G10 L20` to set the offset.
- **Tool change / ATC**: no controller tool table → host orchestrates.
- **Any `IF/GOTO`** from the probe/ATC wizards → host state machine.
- Common probing (touch-plate Z, edge/corner find, autolevel) is already a solved pattern in
  CNCjs / gSender / bCNC / UGS — the bridge would do the same. `[CONFIRMED via docs]`

## Transport / bridge model (differs fundamentally from DDCS)
- grbl is **line-streamed live** over USB serial (typ. 115200) using grbl's flow-control
  protocol (simple `ok`-counting or char-counting). `[CONFIRMED via docs]`
- Status via `?` → `<Idle|Run|Alarm|MPos:…>`; probe `[PRB:…]`; faults `ALARM:n`,
  errors `error:n`. `[CONFIRMED via docs]`
- ⇒ The bridge's job model changes from DDCS's **"drop `.nc` to SMB, trigger Start"** to
  **"stream lines, watch ok/error/alarm, react."** `[ANALYSIS]`

## Open / TO TEST (needs hardware)
- [ ] Pick firmware: grbl 1.1 vs grblHAL vs FluidNC (affects probe pins, SD exec, `M6`). `[TO TEST]`
- [ ] Comment syntax accepted (`( … )` inline vs `;` line). `[TO TEST]`
- [ ] Homing cycle, soft-limits, real feed/accel ceilings. `[TO TEST]`
- [ ] `M6` behavior on the chosen build (pause vs ignore). `[TO TEST]`

## Eventual folder structure (mirrors `dm500/`, `v4.1/`)
- `grbl/install/` — startup blocks (`$N0/$N1`) + **host-side** routine scripts (probe, toolchange)
  — these are bridge JS, **not** controller `.nc` files. *(create when a target is committed)*
- `grbl/FINDINGS.md` — this file.

Cross-ref: [`../shared/ARCHITECTURE.md`](../shared/ARCHITECTURE.md),
[`../PORTING-GRBL-MACH3.md`](../PORTING-GRBL-MACH3.md).
