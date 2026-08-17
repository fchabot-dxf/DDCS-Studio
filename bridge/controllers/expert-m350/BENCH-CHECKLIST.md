# Expert M350 — bench checklist (at the machine, on CNC-FAIRY)

**Written 2026-08-17 by the advisor session (on RENDERRANCHY, home, V4.1 — cannot reach the Expert).**
**For:** whoever is driving at the studio, with a Claude session on **CNC-FAIRY** — the only PC with both
the SMB/Ethernet link and the SABRENT serial adapter to the Expert.

Everything below is blocked on being physically at that machine. Nothing here can be done remotely.
Work top to bottom: each block is ordered cheapest-first and unblocks the ones after it.

**Record results in the RESULTS section at the bottom, then commit.** A block that fails is as valuable a
result as one that passes — write down what actually happened, including the raw error.

---

## ⛔ SAFETY — read before touching anything

1. ⛔⛔ **NEVER run `MGETDATA`.** It is REFUTED on this firmware — it wedges the controller's *analyzer*
   (not the serial link) and forces a reboot. `FINDINGS.md:23`. No slave configuration fixes it. If a step
   below seems to want it, the step is wrong — stop and say so.
2. ⛔ **Nothing in this checklist starts the spindle.** The gateway's op allowlist is `{"delete"}` only —
   it never runs or starts G-code. If any job is to be *run*, a human at the machine presses Start, having
   checked the tool and the workpiece. Keep it that way.
3. ⚠ **Have the E-stop within reach for Block D and E** — those run a real program.
4. ⚠ **Reboot the controller after any `#279` / serial / network parameter change.** The panel's
   "Restart takes effect" note is real; the port stays silent until you do.

## ⚠ THE ONE CONSTRAINT THAT WILL BITE YOU

**Modbus SLAVE mode and POSITION-POLL mode use the SAME serial port and are MUTUALLY EXCLUSIVE.**
(`config.py:37`, `bridge.py:67-69` — *"in one mode at a time (Poll, which MSETDATA needs, or Slave, which
polling needs) — never both."*)

```
  BLOCK D  beacons        needs SLAVE mode      (controller pushes, MSETDATA)
  BLOCK E  position poll  needs POLL mode       (PC reads registers)
                          ↑ these CANNOT run at the same time
```

Do D fully, record it, stop the bridge, then do E. Do **not** try to run both and conclude "tracking is
broken" — that is a configuration collision, not a defect.

---

## BLOCK A — preflight (≈5 min, no risk)

**Goal:** confirm the machine is in the state the rest of the checklist assumes.

- [ ] On the controller panel, read and write down the **firmware build string** (needs to be ≥ `2025-12-11-00`
      for P279=Slave; the user reports a 2026 build).
- [ ] Param page → confirm **`#279` Modbus RTU = Slave** (not `NO`). `FINDINGS.md:69`
- [ ] Confirm **`#267` Serial-2 baud = `B115200`**, framing **8N1**, on **DB9 port 2**. `FINDINGS.md:66,74`
- [ ] Confirm **`#284` Network boot mode = manu-IP** (Ethernet is up; "Cable IP" should not read
      *Disconnect*). Write down the controller's **IP**. `FINDINGS.md:70`
- [ ] On CNC-FAIRY: confirm the SABRENT adapter's **COM port** (was COM6) in Device Manager. It can move.
- [ ] Confirm the SMB share is reachable: `net use S: \\<controller-ip>\CNCDISK` (note: `Test-Path` is flaky
      under SMB1-guest — use `net use`). `FINDINGS.md:130`

**PASS =** all six confirmed and written down. **If the COM port or IP moved, record the new values** —
several later steps take them as arguments.

---

## BLOCK B — LAN serving, so the desk PC can use Studio (≈10 min, no risk)

**Goal:** settle whether ASUS TUF can reach the gateway at all. This is the cheapest high-value test here,
and it answers a question the advisor got *wrong* twice: the browser route is **not** blocked — mixed
content only affects the Cloudflare-hosted page, not a page served by the gateway itself.

- [ ] On CNC-FAIRY, run the Studio exe. Go to **Gateway ▸ Setup**.
- [ ] Tick **"Allow other devices on my network (serve Studio on the LAN)"** (`admin.js:240`) — this sets
      the bind address to `0.0.0.0`.
- [ ] **Restart the exe** (the bind address is read at startup).
- [ ] The Setup page now prints a **LAN URL**. Write it down — the port is the first free one of
      **8765–8769**, so do not assume 8765.
- [ ] From **ASUS TUF**, in PowerShell:
      `curl.exe http://<fairy-ip>:<port>/api/descriptor`
- [ ] Then open `http://<fairy-ip>:<port>/` in a browser on ASUS TUF.

**PASS =** JSON comes back from the descriptor, and Studio loads in the browser on ASUS TUF.

**If it times out:** that is almost certainly **WiFi client isolation** (the studio WiFi is not
administered by the user). Record it as such. The fallback is a direct Ethernet cable between the two PCs —
they are metres apart — not a networking change nobody can make.

---

## BLOCK C — one real send, console → gateway → real controller (≈15 min)

**Goal:** close a gap the advisor named explicitly. The chain *console → gateway → a directory* was proven
end to end in software (t2065), and *SMB write → the real controller* was proven at the bench in June. **The
two halves have never been run in one sitting.** This block does that.

- [ ] With the gateway running and pointed at the controller (`--dest \\<ip>\CNCDISK`), open Studio.
- [ ] Build or open any small program. Use **Gateway ▸ Send**. Choose **deliver-only** (Beacons OFF) for
      this block — Block D covers tracked sends.
- [ ] Watch the gateway log: expect the poller's state machine —
      `LIST inbox → claim oldest → Transfer → DELETE from inbox → "delivered"` (`poller.py:6`).
- [ ] On the controller (or over SMB), confirm the **.nc file is actually on CNCDISK**, with the right name
      and the right byte count.
- [ ] In Studio, open **Gateway ▸ Jobs / History**: the job should appear with a real timestamp.

**PASS =** the file is physically on the controller AND the job shows in History.

⚠ If the filename is wrong or mangled, note the exact name written vs expected — a `multi_step.nc` naming
bug was fixed earlier in this arc and this is the first real-hardware check of it.

---

## BLOCK D — beacons, live (≈20 min) — SLAVE mode

**Goal:** the user's report is *"beacon never worked"*. Two silent causes were found and fixed in software
(`beacons.start()` spawned a thread and never checked the result; the startup log printed the *config value*
instead of the thread's real state). **This is the first time that fix meets real hardware.**

- [ ] Ensure the bridge is in **slave** mode (default; NOT `--position-poll`, NOT `--no-slave`), on the COM
      port from Block A.
- [ ] At startup, read the log line reporting the slave. It is now **honest** — it reports what the thread
      actually did, not what the config asked for. Write down exactly what it says.
- [ ] Send a **tracked** job (Beacons ON) from Studio. Expect no warning; if you get
      *"Beacons were requested but…"*, record it verbatim — that message is deliberate and tells you why.
- [ ] **Press Start at the machine** and let the program run.
- [ ] Watch **Gateway ▸ Tracking** while it runs.

**PASS =** progress advances in the Tracking tab as the program runs, and the job ends in `done` (not
`stalled`) with a plausible duration in History.

**If progress never moves:** record (a) the honest slave-status line from startup, (b) whether the job was
`tracked:true`, (c) whether the program contained a Z-up retract or an `M30`. That last one matters — see
the known gap below.

⚠ **Known, unpatched, and expected:** `instrument.js` only places beacons on a **Z-up retract** or **ahead
of `M30`**. A program with neither arrives as `tracked:false` **with no warning**. Every wizard-built
program ends in a progend block defaulting to `M30`, so normal Studio authoring cannot hit this — but a
**hand-typed or pasted raw program** can. If you test with a hand-written .nc, this is the likely cause and
it is a known hole, not a new bug.

---

## BLOCK E — master-side position poller (≈20 min) — POLL mode ⭐ the big one

**Goal:** this is what gates *live tracking* for the whole project. The master-side client
(`fairy/master.py`) was proven against a **synthetic local slave** only. The registers below come from the
**M3X ESP32 source** and are **EVIDENCE, never bench-confirmed on this controller.** This block confirms or
kills them.

⚠ **Stop the bridge from Block D first** — same serial port, mutually exclusive.

Registers the poller reads by default (`master.py:40-43`):

| key | addr | count | meaning |
|---|---|---|---|
| `work_position` | **7080** | 10 | WORK coords X,Y,Z,A,B — 5 × float32 (2 regs each) |
| `machine_position` | **7260** | 10 | MACHINE coords X,Y,Z,A,B — 5 × float32 |
| `state` | **10002** | 2 | system state (IDLE/BUSY/RESET) — 32-bit int |

- [ ] Start the bridge in poll mode, from `bridge/bridge-app/`:
      `python -m fairy.bridge run --serve --position-poll --position-poll-interval 2 --port COM<N> --dest \\<ip>\CNCDISK`
- [ ] **Jog each axis by hand** and watch the reported WORK position. Compare against the **DRO on the
      controller panel** — the numbers must agree, in the right axis order, with the right sign.
- [ ] Check `machine_position` (7260) the same way against the machine-coords DRO.
- [ ] Read `state` (10002) while **idle**, then while a program **runs**, and record both raw values.

**PASS =** the polled numbers track the panel DRO as you jog, on the correct axes, with correct signs.

**Record even on success:** the **raw** values for at least one known position, so the float32 decode and
the axis order are provable later, not just "it looked right". If an axis is swapped or a sign is flipped,
that is a decode bug and the raw numbers are what fixes it.

**If reads fail:** record the exact exception. `master.py`'s `read()` **refuses** a bad register rather than
returning garbage (it raised `IllegalAddress` correctly in the synthetic test) — so an error here is
meaningful, not noise. Do **not** go hunting with `MGETDATA`.

---

## RESULTS — fill in and commit

> Write what happened, not what was expected. Mark each **OBSERVED** or **INFERRED**. A failed block with a
> raw error is more useful than a vague pass.

**Session date:** ____________  **Driver:** ____________  **Firmware build:** ____________

| Block | Result | Notes / raw values |
|---|---|---|
| A preflight | ☐ pass ☐ fail | COM port: ____ · controller IP: ____ |
| B LAN serving | ☐ pass ☐ fail | LAN URL: ____ · client isolation? ____ |
| C real send | ☐ pass ☐ fail | file on CNCDISK? ____ · in History? ____ |
| D beacons live | ☐ pass ☐ fail | honest slave line: ____ |
| E position poll | ☐ pass ☐ fail | raw 7080 @ known pos: ____ · state idle/run: ____ |

**Anything surprising, in plain words:**

---

## Context the CNC-FAIRY session should know

- The advisor session is on **RENDERRANCHY (home, V4.1)** and **cannot reach the Expert** — different
  building. Do not wait on it for anything physical.
- **V4.1 can never do live tracking** — measured, not assumed (184 files watched, only 3 touched with
  identical content; `.pos` frozen while the DRO moved; port scan found only 139/445 open, no Modbus TCP).
  The Expert is the only one of the three controllers that can. That is why this checklist matters.
- Ground truth for anything G-code lives in the **M350 factory dumps**, not in wizard code.
- Relevant reading next to this file: **`FINDINGS.md`** (the evidence, with confidence tags),
  `../ENVIRONMENTS.md` (which PC is where).
