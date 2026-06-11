# CONTROLLER TASKS & TESTS — DDCS Expert (M350) & V4.1

> **Master index** of every controller-centric test/experiment and its status. The detailed method for each
> lives in [`bridge/archive/EXPERIMENTS.md`](bridge/archive/EXPERIMENTS.md) (the full plan, Tracks A–E);
> confirmed results live in the per-controller `FINDINGS.md`. This file is the **at-a-glance roll-up** — update
> the status here when a test resolves, and record the *detail* in `FINDINGS.md` with a confidence tag.
>
> **Two controllers, never cross-apply** — see [`bridge/controllers/README.md`](bridge/controllers/README.md).
> - **DDCS Expert / M350** — the real studio machine (`\\192.168.0.99\`, Modbus on COM6). The target.
> - **DDCS V4.1** — bench sandbox (`10.0.0.50`), motorless. Hardening / dev rig only.
>
> Canonical: [`bridge/AGENTS.md`](bridge/AGENTS.md) · Expert [`FINDINGS.md`](bridge/controllers/expert-m350/FINDINGS.md)
> · V4.1 [`FINDINGS.md`](bridge/controllers/v4.1/FINDINGS.md) · [`bridge/ROADMAP.md`](bridge/ROADMAP.md)
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
| Keep an executor alive to press Start | `sysstart.nc` dispatcher loop + `#2037` | ⬚ **OPEN — next: A9** |

⇒ delivery + readback + button-injection are proven; the **one remaining wall is the run trigger** (A9).

---

## Track A — Software over Ethernet 🟢 (the core hardware-free tests)
| # | Test | Status | Where | Note |
|---|---|---|---|---|
| A0 | Reach controller files over SMB | ✅ both | — | V4.1 recipe works on the Expert (guest=root, CNCDISK+SYSDISK) |
| A1 | Overwrite a program + Start runs the NEW code | 🟡 | V4.1 ✅ / Expert ❌ | V4.1 `M47` self-loop re-reads disk; on the **Expert `M47` ≠ V4.1** — only a per-cycle **Start** re-reads the file |
| A2 | `error.nc` fault hook fires + leaves a readable flag | 🟡 | Expert ✅(docs) / V4.1 ❌ | fires on a **system alarm**, NOT on a syntax error (syntax errors render to screen only) |
| A2b | *Which* system var holds the live alarm **code** | ⬚ open | both | the key error-readback unknown; ⚠️ runtime-var reads can wedge (`#1630`) |
| A3 | Port scan for a hidden telnet/FTP/web service | ⬚ open | — | not yet run |
| A4 | Live file tracks position (software DRO) | ❌/low | — | `.pos` marks *did-it-run*, not live position; position not wanted anyway |
| A5/A8 | Inject a single line via `mdi.nc`/`mdiblock` + trigger MDI | ❌ refuted | Expert | `mdi.nc` is panel **output** (RAM line); overwrite doesn't reach the live buffer |
| A6 | Macro-hook survey (`error/pause/key-1..7/ext_button/probe/fnd*`) | 🟡 | Expert | hooks catalogued in FINDINGS "Macro hooks"; signal-out per hook still partial |
| **A7** | **`#2037` virtual buttons press panel keys** | ✅ **LIVE** | **Expert 2026-06-10** | nav/file-select/start are software now (MDI page 1348, Monitor 1373) |
| **A9** | **`sysstart.nc` dispatcher loop survives + bootstraps runs** | ⬚ **next** | Expert | ⚠️ motion-capable — the one wall; does a job's `M30` relaunch the dispatcher? |

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
| C1 | Run control via External Start/Pause/Estop inputs | 🔵 fallback | the $6 physical-Start path **if A9 fails** |
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
1. **A9 — dispatcher bootstrap** (⚠️ motion; needs an E-stop story) — the last autonomy wall.
2. **A2b / B4 — alarm-code variable** (⚠️ wedge-prone) — completes error readback.
3. **Desk wins (safe):** linter G/M-landmine scan + flag live `MGETDATA`; conformance corpus vs the ~70
   captured macros; ship the V4.1 builtin profile + `schema.json`.
4. **Untested, 🟢:** does the panel read `mdi.nc` at **boot**? (the one A8 path left open — needs a reboot).

## Recently done
- **Controller profiles (Phase 5)** — `Ops.profile()` returns a live profile (tabs + `pins`) + startup/UI
  validation. [`PROFILE_BUILD_TASK.md`](bridge/controllers/expert-m350/PROFILE_BUILD_TASK.md) complete.
- **A7** `#2037` confirmed live. · **A8** MDI file-injection refuted.

## Safety (non-negotiable, any machine-side test)
- **Read-only by default.** SMB reads are safe; **param changes are made by the human on the panel**, then
  re-read — never write params from code.
- **Lint + stage motion-free** test macros (`tools/ddcs_lint.py`); **gate any panel "Run"** on the operator
  first confirming what's staged (an A8 lesson — the buffer can hold a stale motion line).
- **Human at the panel with E-stop** for anything that can move or auto-execute. Each hard wedge
  (`#1630` read, `MGETDATA`) = a reboot — treat new primitives as wedge-capable until proven otherwise.
