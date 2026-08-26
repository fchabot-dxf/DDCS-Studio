# CONTROLLER TASKS & TESTS — DDCS Expert (M350) & V4.1

> **Master index** of every controller-centric test/experiment and its status. The detailed method for each
> lives in [`bridge/archive/EXPERIMENTS.md`](../bridge/archive/EXPERIMENTS.md) (the full plan, Tracks A–E);
> confirmed results live in the per-controller `FINDINGS.md`. This file is the **at-a-glance roll-up** — update
> the status here when a test resolves, and record the *detail* in `FINDINGS.md` with a confidence tag.
>
> **Two controllers, never cross-apply** — see [`bridge/controllers/README.md`](../bridge/controllers/README.md).
> - **DDCS Expert / M350** — the real studio machine (`\\192.168.0.99\`, Modbus on COM6). The target.
> - **DDCS V4.1** — bench sandbox (`10.0.0.50`), motorless. Hardening / dev rig only.
>
> Canonical: [`bridge/RULES.md`](../bridge/RULES.md) · Expert [`FINDINGS.md`](../bridge/controllers/expert-m350/FINDINGS.md)
> · V4.1 [`FINDINGS.md`](../bridge/controllers/v4.1/FINDINGS.md) · [`bridge/ROADMAP.md`](../bridge/ROADMAP.md)
> · system [`ddcs-studio-roadmap`](ddcs-studio-roadmap).
>
> Status legend: ✅ confirmed · ❌ refuted · 🟡 partial / mixed · ⬚ open · 🔵 needs ESP32 (~$6) · 🟣 needs capture card · ~~obsolete~~
> Hardware legend (from EXPERIMENTS): 🟢 nothing extra · 🔵 ESP32 · 🟣 M3K / HDMI capture.

*Last updated: 2026-06-10.*

---

## The autonomy chain (hardware-free remote control of the Expert)
Goal: deliver + run jobs on the Expert from the PC with **zero added hardware**. Status of each link:

| Link | Mechanism | Status |
|---|---|---|
| Deliver a job file to the controller | SMB write to CNCDISK | ✅ `[CONFIRMED]` (read+write, guest=root) |
| Read back machine state | SMB decode of `uservar`/`setting`; Modbus `MSETDATA` push | ✅ `[CONFIRMED]` (checkpoint sentinels, no wedge) |
| Press panel keys from a macro | `#2037` virtual buttons (`65536+[KeyValue−1000]`) | ✅ **`[CONFIRMED LIVE 2026-06-10]`** (A7) |
| Trigger a run with **no** panel touch | overwrite `mdi.nc` | ❌ **REFUTED 2026-06-10** (A8 — MDI line is RAM) |
| Feed a command to a *running* macro | PC write into `uservar` file | ❌ **REFUTED 2026-06-10** (A9-a — RAM/file isolated both ways) |
| Controller pulls commands from the PC | Modbus `MGETDATA` | ❌ **REFUTED 2026-06-10** (A9-b — wedges the *analyzer*, zero frames sent) |
| Pulse External Start from the PC | ESP32 + opto on a Start input (C1) | ⬚ **THE PATH** — ~$6, the one physical link |

⇒ **A9 verdict: hardware-free inbound is refuted on every path.** The dispatcher architecture is settled:
**one physical Start input (C1)** + everything else software — PC overwrites the selected job over SMB
(Start re-reads disk per-cycle), `MSETDATA` checkpoints back, `#2037` for panel nav.

---

## Track A — Software over Ethernet 🟢 (the core hardware-free tests)
| # | Test | Status | Where | Note |
|---|---|---|---|---|
| A0 | Reach controller files over SMB | ✅ both | — | V4.1 recipe works on the Expert (guest=root, CNCDISK+SYSDISK) |
| A1 | Overwrite a program + Start runs the NEW code | 🟡 | V4.1 ✅ / Expert ❌ | V4.1 `M47` self-loop re-reads disk; on the **Expert `M47` ≠ V4.1** — only a per-cycle **Start** re-reads the file |
| A2 | `error.nc` fault hook fires + leaves a readable flag | 🟡 | Expert ✅(docs) / V4.1 ❌ | fires on a **system alarm**, NOT on a syntax error (syntax errors render to screen only) |
| A2-syn | Syntax-error text/line readable over SMB? | ❌ **refuted** | Expert 2026-06-10 | sha256 diff of all 193 files around a live error → only the MDI *input* buffer changed; **no error record persists** ⇒ needs **D2 (OCR)** |
| A2b | *Which* system var holds the live alarm **code** | ⬚ open | both | the key error-readback unknown; ⚠️ runtime-var reads can wedge (`#1630`) |
| A3 | Port scan for a hidden telnet/FTP/web service | ⬚ open | — | not yet run |
| A4 | Live file tracks position (software DRO) | ❌/low | — | `.pos` marks *did-it-run*, not live position; position not wanted anyway |
| A5/A8 | Inject a single line via `mdi.nc`/`mdiblock` + trigger MDI | ❌ refuted | Expert | `mdi.nc` is panel **output** (RAM line); overwrite doesn't reach the live buffer |
| A6 | Macro-hook survey (`error/pause/key-1..7/ext_button/probe/fnd*`) | 🟡 | Expert | hooks catalogued in FINDINGS "Macro hooks"; signal-out per hook still partial |
| **A7** | **`#2037` virtual buttons press panel keys** | ✅ **LIVE** | **Expert 2026-06-10** | nav/file-select/start are software now (MDI page 1348, Monitor 1373) |
| **A9** | **Hardware-free dispatcher (inbound to a running macro)** | ❌ **refuted** | **Expert 2026-06-10** | a: `uservar` file ↔ RAM isolated 2-way · b: `MGETDATA` wedges the analyzer (zero frames, cable+slave proven) ⇒ **C1 is the path** |

## Track B — Desk research / firmware mining 🟢 (no machine)
| # | Test | Status | Note |
|---|---|---|---|
| B1 | Recover M3K serial key→byte codes from firmware | ❌ dead end | M3K driver is **kernel-level** on both controllers — not recoverable from the app binaries |
| B2 | Mine factory `.nc` as ground truth (harden the rules) | ✅ done | `ddcs_lint.py` validated vs ~70 real macros; CORE_TRUTH discrepancies logged |
| B3 | `motiondev.ko` disassembly feasibility | ⬚ low-pri | high-effort emulator path; parked |
| B4 | Alarm-code variable candidates (feeds A2b) | 🟡 | variable map mined (`#1630-1636`=analyze status); exact alarm-**code** var still open |

## Track C — Control bridge 🔵 (ESP32 ~$6) — *mostly obviated by A7*
| # | Test | Status | Note |
|---|---|---|---|
| C1 | Run control via External Start/Pause/Estop inputs | 🔵 **THE PATH** | A9 refuted hardware-free inbound ⇒ this is the dispatcher's one physical link (ESP32 + PC817 optos, ~$6) |
| C2 | Full navigation via M3K serial emulation | ~~obsolete~~ | superseded by `#2037` (A7) — no ESP32/serial needed |
| C3 | Hardware error readback (spare output → ESP32) | 🔵 optional | low-latency fault line vs SMB polling |
| C4 | Variable-to-button high-level macro triggers | 🟡 | overlaps `#2037` + `key-1..7.nc` hooks |

## Track D — Sense / eyes 🔵🟣 (optional)
| # | Test | Status | Note |
|---|---|---|---|
| D1 | Step/dir position tap (DRO) | ⬚ not needed | errors-only goal; position not wanted |
| D2 | Screen capture + OCR ("eyes" — error text, file picker) | 🟣 optional | sidesteps file-selection; future autonomy aid |

## Track E — Integration & autonomy 🔵
| # | Test | Status | Note |
|---|---|---|---|
| E1 | PC orchestrator (`push_job/start/stop/key/get_error`) | 🟡 building | this **is** the fairy gateway (`/api` ops, `ops.py`) |
| E2 | Front-end console / DRO / error panel | 🟡 building | fairy local UI + Studio (Submit/Track) |
| E3 | AI-in-the-loop (generate → push → start → poll → abort) | ⬚ future | gated on A9 + E4 |
| E4 | **Safety** — independent HW E-stop + watchdog | ⚠️ **MANDATORY** | before ANY autonomy on the cutting machine |

---

## Next up (prioritized)
1. **C1 — buy + wire the physical-input link** (the dispatcher's one hardware piece). Options, by budget:
   - *Easiest (~$20–35):* USB relay+opto-input board on CNC-FAIRY — Python-driven, zero firmware.
   - *Best stack-fit (~$25–40):* **Modbus-RTU DIN I/O module + USB-RS485 dongle** — driven by the same
     pymodbus stack just bench-proven; isolated 24V inputs ready for C3 (error line). ← preferred
   - *Most powerful (~$40–70):* ESP32 DIN I/O w/ Ethernet (ESPHome) — network API + can host the E4
     **hardware watchdog** (NC relay in the hold/E-stop chain, drops if the PC dies).
   Wiring (any tier): relay contact shorts the mapped External-Start input to `COM-` for ~150 ms.
2. **A2b / B4 — alarm-code variable** (⚠️ wedge-prone) — completes error readback.
3. **Desk wins (safe):** linter G/M-landmine scan + **hard-error on any `MGETDATA`** (refuted primitive);
   conformance corpus vs the ~70 captured macros; ship the V4.1 builtin profile + `schema.json`.
4. **Untested, 🟢:** does the panel read `mdi.nc` at **boot**? (the one A8 path left open — needs a reboot).

## Recently done
- **Controller profiles (Phase 5)** — `Ops.profile()` returns a live profile (tabs + `pins`) + startup/UI
  validation. [`PROFILE_BUILD_TASK.md`](../bridge/controllers/expert-m350/PROFILE_BUILD_TASK.md) complete.
- **A7** `#2037` confirmed live. · **A8** MDI file-injection refuted. · **A9-a/b** hardware-free inbound
  refuted (uservar 2-way RAM/file isolation; `MGETDATA` = analyzer wedge, zero frames) → **C1 settled as
  the architecture**. Bonus: `uservar` disk file is a lazy snapshot (not live readback).

## Safety (non-negotiable, any machine-side test)
- **Read-only by default.** SMB reads are safe; **param changes are made by the human on the panel**, then
  re-read — never write params from code.
- **Lint + stage motion-free** test macros (`tools/ddcs_lint.py`); **gate any panel "Run"** on the operator
  first confirming what's staged (an A8 lesson — the buffer can hold a stale motion line).
- **Human at the panel with E-stop** for anything that can move or auto-execute. Each hard wedge
  (`#1630` read, `MGETDATA`) = a reboot — treat new primitives as wedge-capable until proven otherwise.
