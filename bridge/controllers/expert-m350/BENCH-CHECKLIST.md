# Expert M350 — bench work, at the machine (CNC-FAIRY)

**Index + shared safety + the preflight every project depends on.**
Written 2026-08-17 by the advisor session on RENDERRANCHY (home, V4.1) — it **cannot reach the Expert**,
different building. This file is the handoff.

**Everything here is blocked on physically being at the machine.** Run **PREFLIGHT** below once, then open
whichever project file you're working. Each project file is self-contained — a session can be handed one
file and nothing else.

---

## THE PROJECTS

| # | Project | File | Time | Why it matters |
|---|---|---|---|---|
| 1 | **Remote access** | [`bench/01-remote-access.md`](bench/01-remote-access.md) | ~10 min | Lets you use Studio from the desk PC instead of standing at the shop machine. Cheapest win here. |
| 2 | **Job send + history** | [`bench/02-job-send.md`](bench/02-job-send.md) | ~15 min | Closes a real gap: both halves of the send chain are proven, never in one sitting. |
| 3 | **Live tracking** | [`bench/03-live-tracking.md`](bench/03-live-tracking.md) | ~40 min | ⭐ Decides whether live tracking is real for this project. Two tasks that **cannot run together**. |

**If you only get through two: do project 1, then project 3.** 1 is cheap and makes everything afterward
comfortable; 3 is the only one that **cannot** be retried remotely — its registers have never been
confirmed on your controller.

---

## ⛔ SAFETY — applies to every project

1. ⛔⛔ **NEVER run `MGETDATA`.** REFUTED on this firmware — it wedges the controller's *analyzer* (not the
   serial link) and forces a reboot. `FINDINGS.md → find "MGETDATA` = REFUTED"`. No slave configuration fixes it. If a step seems to
   want it, the step is wrong — stop and say so.
2. ⛔ **Nothing here starts the spindle.** The gateway's op allowlist is `{"delete"}` only — it never runs
   or starts G-code. Where a program must *run*, a human at the machine presses Start having checked the
   tool and workpiece. Keep it that way.
3. ⚠ **E-stop within reach for project 3** — it runs a real program.
4. ⚠ **Reboot the controller after any `#279` / serial / network parameter change.** The panel's "Restart
   takes effect" note is real; the port stays silent until you do.

## ⚠ THE CONSTRAINT THAT WILL BITE YOU

**Modbus SLAVE mode and POSITION-POLL mode use the SAME serial port and are MUTUALLY EXCLUSIVE**
(`config.py:37`, `bridge.py:67-69`). Both tasks live in project 3 for exactly this reason — run one, record
it, stop the bridge, run the other. Running both and concluding "tracking is broken" is a **configuration
collision, not a defect**.

---

## PREFLIGHT — do this once, before any project (≈5 min, no risk)

Confirms the machine is in the state every project assumes. **Several later steps take these values as
arguments**, so write them down.

- [ ] Controller panel: read and record the **firmware build string** (must be ≥ `2025-12-11-00` for
      P279=Slave; user reports a 2026 build).
- [ ] Param page → **`#279` Modbus RTU = Slave** (not `NO`). `FINDINGS.md → find "IS the Modbus-RTU enable"`
- [ ] **`#267` Serial-2 baud = `B115200`**, framing **8N1**, on **DB9 port 2**. `FINDINGS.md → find "Serial 2 baud rate" + "framing is confirmed"`
- [ ] **`#284` Network boot mode = manu-IP** — Ethernet up, "Cable IP" not reading *Disconnect*. Record the
      controller **IP**. `FINDINGS.md → find "Network boot mode"`
- [ ] On CNC-FAIRY: confirm the SABRENT adapter's **COM port** in Device Manager (was COM6 — it can move).
- [ ] SMB reachable: `net use S: \\<controller-ip>\CNCDISK`
      (⚠ `Test-Path` is flaky under SMB1-guest — use `net use`). `FINDINGS.md → find "flaky under SMB1-guest"`

**PASS =** all six confirmed and written down.

```
  RECORD:  firmware ____________   controller IP ____________   COM port ______
```

---

## Context the CNC-FAIRY session should know

- The advisor session is on **RENDERRANCHY (home, V4.1)** and **cannot reach the Expert**. Do not wait on
  it for anything physical.
- **V4.1 can never do live tracking** — measured, not assumed (184 files watched, only 3 touched with
  identical content; `.pos` frozen while the DRO moved; port scan found only 139/445, no Modbus TCP). The
  Expert is the only one of the three controllers that can — which is why project 3 matters.
- Ground truth for G-code is the **M350 factory dumps**, not wizard code.
- Evidence with confidence tags: **`FINDINGS.md`**. Which PC is where: `../ENVIRONMENTS.md`.

**Record results in each project file's own RESULTS table, then commit.** A failed task with a raw error is
more useful than a vague pass. Mark findings **OBSERVED** or **INFERRED**.
