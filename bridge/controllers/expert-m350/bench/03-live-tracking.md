# Project 3 — Live tracking ⭐ the one that decides it

**Where:** CNC-FAIRY + the SABRENT serial adapter on DB9 **port 2**.
**Time:** ~40 min · **Risk:** ⚠ runs a real program — **E-stop within reach**
**Prereq:** [PREFLIGHT](../BENCH-CHECKLIST.md#preflight--do-this-once-before-any-project-5-min-no-risk)

## Why this matters

The **Expert is the only one of the three controllers that can ever do live tracking** — V4.1 was measured
and cannot (`.pos` frozen while the DRO moved; no Modbus TCP; only 139/445 open). So this project decides
whether the feature is real for the project at all.

## ⛔⛔ TWO RULES BEFORE YOU START

**1. NEVER run `MGETDATA`** — REFUTED on this firmware, wedges the analyzer, forces a reboot
(`FINDINGS.md:23`). If debugging seems to call for it, it doesn't. Stop and report instead.

**2. The two tasks below CANNOT run at the same time.** Slave mode and position-poll mode use the **same
serial port** and are mutually exclusive (`config.py:37`, `bridge.py:67-69`):

```
  TASK A  beacons        SLAVE mode   controller PUSHES  (MSETDATA)
  TASK B  position poll  POLL mode    the PC READS registers
          ↑ run A fully, record it, STOP THE BRIDGE, then run B
```

Running both and concluding "tracking is broken" would be a **configuration collision misread as a
defect**. Don't hand that back as a result.

---

## TASK A — beacons, live (SLAVE mode, ~20 min)

The user's standing report is **"beacon never worked."** Two silent causes were found and fixed in
software: `beacons.start()` spawned a thread and never checked the result, and the startup log printed the
**config value** instead of the thread's real state. **This is the first time that fix meets real hardware.**

- [ ] Bridge in **slave** mode (the default — NOT `--position-poll`, NOT `--no-slave`), on the COM port
      from preflight.
- [ ] At startup, read the slave line in the log. It is now **honest** — it reports what the thread
      actually did. **Write it down verbatim.**
- [ ] Send a **tracked** job (Beacons ON) from Studio. If you get *"Beacons were requested but…"*, record
      it verbatim — that message is deliberate and names the reason.
- [ ] **Press Start at the machine.** Let it run.
- [ ] Watch **Gateway ▸ Tracking**.

**PASS =** progress advances during the run, and the job ends `done` (not `stalled`) with a plausible
duration in History.

**If progress never moves, record:** (a) the honest slave-status line, (b) whether the job was
`tracked:true`, (c) whether the program contained a **Z-up retract** or an **`M30`**.

⚠ **Known, unpatched, and EXPECTED** — that last point: `instrument.js` places beacons only on a **Z-up
retract** or **ahead of `M30`**. A program with neither arrives as `tracked:false` **with no warning**.
Every wizard-built program ends in a progend block defaulting to `M30`, so normal Studio authoring cannot
hit this — but a **hand-typed or pasted** program can. If you test with a hand-written .nc and it reports
untracked, **this is the known hole, not a new bug.**

### RESULTS — Task A

| item | value |
|---|---|
| honest slave line at startup (verbatim) | |
| any "Beacons were requested but…" warning | |
| job `tracked:true`? | ☐ yes ☐ no |
| program had Z-up retract / M30? | ☐ retract ☐ M30 ☐ neither |
| progress advanced during the run | ☐ yes ☐ no |
| final state | ☐ done ☐ stalled ☐ other: |

---

## TASK B — master-side position poller (POLL mode, ~20 min) ⭐

⚠ **Stop the Task A bridge first.** Same serial port.

`fairy/master.py` was proven **only against a synthetic local slave**. The registers below come from the
**M3X ESP32 source** — they are **EVIDENCE, never bench-confirmed on this controller.** This task confirms
or kills them.

| key | addr | count | meaning |
|---|---|---|---|
| `work_position` | **7080** | 10 | WORK coords X,Y,Z,A,B — 5 × float32 (2 regs each) |
| `machine_position` | **7260** | 10 | MACHINE coords X,Y,Z,A,B — 5 × float32 |
| `state` | **10002** | 2 | system state (IDLE/BUSY/RESET) — 32-bit int |

- [ ] From `bridge/bridge-app/`:
      `python -m fairy.bridge run --serve --position-poll --position-poll-interval 2 --port COM<N> --dest \\<ip>\CNCDISK`
- [ ] **Jog each axis by hand.** Compare the reported WORK position against the **panel DRO** — numbers must
      agree, in the right **axis order**, with the right **sign**.
- [ ] Check `machine_position` (7260) against the machine-coords DRO the same way.
- [ ] Read `state` (10002) **idle**, then while a program **runs**. Record both raw values.

**PASS =** polled numbers track the panel DRO as you jog — correct axes, correct signs.

⭐ **Record the RAW values even on success**, for at least one known position. If an axis is swapped or a
sign flipped, the raw numbers are what fixes it — "it looked right" is not provable later.

**If reads fail:** record the exact exception. `master.py`'s `read()` **refuses** a bad register rather than
returning garbage (it raised `IllegalAddress` correctly in the synthetic test), so an error here is
**meaningful, not noise**. Do **not** go hunting with `MGETDATA`.

### RESULTS — Task B

| item | value |
|---|---|
| raw `work_position` @ a known DRO position (write both) | |
| axis order correct | ☐ yes ☐ no — what was wrong: |
| signs correct | ☐ yes ☐ no |
| `machine_position` agrees with machine DRO | ☐ yes ☐ no |
| raw `state` **idle** | |
| raw `state` **running** | |
| exception (verbatim), if any | |

---

**Verdict for the project — does live tracking work on the Expert?**
☐ yes ☐ no ☐ partly:
