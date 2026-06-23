# Mach3 — Port Findings (candidate target, NOT owned yet)

**Unit:** none yet — Mach3 is a **PC-based** controller (Windows + parallel port, or an external
motion device: SmoothStepper / UC100 / etc.). **Scope:** Mach3 as a *target* for DDCS Studio
output. From ArtSoft docs/manual — **nothing tested on hardware we own.**
**Studio-side emitter analysis:** [`../PORTING-GRBL-MACH3.md`](../PORTING-GRBL-MACH3.md).

> Tags: `[CONFIRMED via docs]` documented behavior · `[TO TEST]` needs our hardware ·
> `[HYPOTHESIS]` unverified guess · `[ANALYSIS]` derived from Studio's code.

---

## What Mach3 is, relative to DDCS
- A **macro controller** — the architectural *cousin* of DDCS: `#variables`, `G31` probing,
  canned cycles, tool table, fixture offsets. Most of Studio's model maps onto it. `[CONFIRMED via docs]`
- **Key difference:** part-program **flow control is NOT native** — there is no in-program
  `IF/GOTO/WHILE`. Branching lives in **VBScript M-macros** (and the macropump). So DDCS's
  `IF #x!=2 GOTO1` becomes "part program calls a custom M-code → VBScript macro decides."
  `[CONFIRMED via docs]`
- **Legacy caveat:** Mach3 is XP-era; **Mach4** (Lua scripting) is the maintained successor and
  **LinuxCNC** is the open alternative — and LinuxCNC is the *closest* match to DDCS's smart-macro
  model (native `#vars`, `O`-word subs, `IF/WHILE/GOTO`, in-program `G38.x` results, `M6` remap).
  **Evaluate target before committing.** `[CONFIRMED via docs]`

## G-code / macro support
- Canned cycles `G81/G82/G83/G98/G99` ✅; `#variables` ✅; `G31` probe with result in `#vars` ✅;
  `G10 L2/L20` WCS ✅; tool table + `M6` via macro ✅; `M98/M99` subroutines ✅. `[CONFIRMED via docs]`
- No native part-program `IF/GOTO/WHILE` → VBScript macros invoked by custom M-codes / macropump.
  `[CONFIRMED via docs]`
- `G65` Fanuc macro-call with args: limited/unsupported — use VBScript instead. `[HYPOTHESIS]`

## Capability matrix (caps keys per the porting doc)
| cap | Mach3 | note |
|---|---|---|
| onControllerMacros | ✅ | VBScript M-macros |
| variables (`#`) | ✅ | in-program |
| flowControl | `macro-vbscript` | not native part-program |
| probeWord | `G31` | same word DDCS uses |
| inProgramProbeResult | ✅ | result in `#vars` (e.g. `#2002`) |
| cannedCycles | ✅ | **could STOP flattening drills — a feature gain** `[ANALYSIS]` |
| toolTable / ATC | ✅ | `M6` VBScript macro + tool table |
| wcsSet | `G10L2` / `G10L20` | + `#5221+` fixture offsets |
| arcs | `IJK` | ✅ |
| transport | `file` | load `.tap/.nc` into Mach3 UI; automate via plugin/VB |

## Ports directly (Studio → Mach3)
- All flat toolpath wizards emit fine; optionally upgrade drills to real `G81/82/83`. `[ANALYSIS]`
- Probing: `G31` maps closely to DDCS's `G31`; only the **result variable numbers** differ. `[CONFIRMED via docs]`

## Needs translation (the dialect + macro-library work)
- `IF #x!=2 GOTO1` (DDCS) → **VBScript M-macro** that branches; part program calls that M-code. `[CONFIRMED via docs]`
- **`#var` family remap**: DDCS `#1920`(probe status)/`#1925`(result)/`#805+`(WCS)/`#1504`(tool) →
  Mach3 equivalents (`#2002` probe, `#5221+` fixture offsets, tool table). `[TO MAP]`
- **M-code set**: DDCS `M154/M155` (drawbar), `M300–302` (sensors), `M162/163` (dust cover) →
  Mach3 custom **`Mxxx.m1s` VBScript** macros. `[TO BUILD]`
- EOL `\r\n` (Windows); `G53` likely Fanuc form `G53 G0 Z…` (i.e. `dialect.rules.g53Rapid = true`). `[HYPOTHESIS]`

## Transport / bridge model
- Mach3 **loads a file then runs**; remote automation is via a Mach3 plugin / VB / SerialDRO,
  **not** a streaming protocol. Different bridge shape than grbl. `[HYPOTHESIS]`

## Open / TO TEST
- [ ] **Mach3 vs Mach4 vs LinuxCNC** target decision (LinuxCNC is the strongest technical fit). `[TO TEST]`
- [ ] Probe result var numbers + fixture-offset addressing on the real build. `[TO TEST]`
- [ ] `M6` macro + tool-table workflow for the ATC. `[TO TEST]`

## Eventual folder structure (mirrors `dm500/`, `v4.1/`)
- `mach3/install/` — VBScript M-macros (`probe`, `M6` toolchange), screenset/brain notes.
  *(create when a target is committed)*
- `mach3/FINDINGS.md` — this file.

Cross-ref: [`../shared/ARCHITECTURE.md`](../shared/ARCHITECTURE.md),
[`../PORTING-GRBL-MACH3.md`](../PORTING-GRBL-MACH3.md).
