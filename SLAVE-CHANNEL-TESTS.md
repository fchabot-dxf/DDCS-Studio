# SLAVE-CHANNEL TESTS — what to try on the new firmware (Modbus slave, P279=2)

The at-machine test matrix for the 2026-04-10 firmware's slave channel. Work the tiers in order —
**read-only first; every command-tier test with a hand near e-stop, Z high, no stock.** Log every
result (even "nothing happened") — negative results are corpus evidence too. Companion docs:
MACHINE-DAY.md (the day list) · the protocol spec in
bridge/controllers/expert-m350/assets/community/modbus-slave-2025-12-11/README.md.

## TIER 1 — READ-ONLY (safe any time the machine is on)
- [ ] **Proof of life:** FC03 read reg 10002 (2 regs, float32 low-word-first) → expect 0.0 (IDLE).
      Easiest via the OEM's M350_LiveG_v1.7.exe; or any Modbus tool at 115200 8N1 slave-ID 1.
- [ ] **Coords match the pendant:** read 7080–7089 (work X/Y/Z/A/B) and 7260–7269 (machine) —
      decode and compare against the DRO to the display's precision. Confirms endianness on THIS
      machine, not just in the docs.
- [ ] **State semantics:** read 10002 while idle / mid-program / paused / after RESET — record the
      value in each state (docs say 0=IDLE, 1=BUSY, 2=RESET; verify, note anything undocumented).
- [ ] **During an alarm:** trip a soft limit (jog toward it, hands on e-stop) — what does 10002
      read? Do the coord registers still answer? What exception (if any) comes back?
- [ ] **Poll rate tolerance:** sustained 100ms polling for 10+ minutes — any pendant lag, missed
      responses, or CRC noise (EMI)? (LiveG treats CRC mismatch as retry-able noise.)

## TIER 2 — VIRTUAL KEYS (reg 6908, FC10; harmless program loaded, Z high)
- [ ] **Jog each axis ±** via the documented keycodes (0x015E–0x0166): press vs hold(300ms) vs
      release semantics — what distance/speed does a remote jog use? Which screen must be active?
- [ ] **START / PAUSE / RESET** (0x0148 / 0x0149 / 0x0147) on an air program — timing, reliability,
      and what 10002 reads through each transition.
- [ ] **F1–F6** (0x0600–0x0605): per-screen meaning — do they act on whatever page the pendant
      shows? (If yes, remote menu NAVIGATION may be possible.)
- [ ] **Speed toggle** (0x0184): observable effect on jog/run speeds.
- [ ] ⚠ **UNKNOWN-KEYCODE HUNT** (the screenshot key is the prize): carefully probe candidate
      codes beyond the documented set, ONE at a time, noting every effect (beep, menu move, error,
      nothing). Goal: the keycode/combo behind the pendant's native screen capture (BMPn.bmp →
      CNCDISK). Found → remote screenshots = keypress + SMB pull, no one at the machine.
- [ ] **Wrong-state writes:** send a jog while BUSY — refused (0x90)? queued? executed? This
      decides the gateway's interlock design.

## TIER 3 — G-CODE INJECTION (reg 3000; air only)
- [ ] **Single block:** `G91 G0 X0` (zero-stroke) then a real 1mm move — confirm execution + the
      state-machine rhythm (8×20ms detect, 2-quiet stabilize @40ms — copy LiveG's timing).
- [ ] **Busy rejection:** inject while a program runs → expect exception 0x90; confirm nothing
      queues or interleaves.
- [ ] **Syntax error over the wire:** inject a malformed block — does the whole-file loud-abort
      rule hold for injected blocks (nothing executes)? What does 10002 / the exception say?
- [ ] **Length limit:** a block near 246 chars, then past it — truncation, refusal, or error?
- [ ] **Macro constructs:** does an injected block accept #var writes? An IF? (Scopes what MDI
      injection can ever do for wizard-style snippets.)
- [ ] **The wedge check:** repeated zero-motion commands WITHOUT the bypass — does the channel
      wedge the way LiveG's comment warns? (Defines how defensively the gateway must poll.)

## TIER 4 — SYSTEM QUESTIONS
- [ ] **Role exclusivity:** with P279=Slave, do the MSETDATA master macros still run, refuse, or
      wedge? (Presumed exclusive — one P279 role. Decide the bridge-beacon retirement on evidence.)
- [ ] **The #298 mystery:** release default 100, this machine reads 0 — change it (50 / 100 / 200)
      and observe slave-channel timing/behavior. Label-less in every language file; unknown.
- [ ] **SMB while polling:** drive capture over SMB during active Modbus polling — any interference?
- [ ] **Reboot persistence:** do P279/P267 survive power cycles cleanly (expected yes — verify once).

## TIER 5 — GATEWAY TAB INTEGRATIONS (The "MSETDATA Retirement" Arc)
*Now that the controller is a Modbus Slave, we are the Master and can poll it directly, meaning we might be able to retire the MSETDATA bridge-beacons entirely.*

- [ ] **Files / Send Tab — Remote File Execution:** If we push `job.nc` over SMB, can we execute `M98 P"job.nc"` via G-code injection (Reg 3000) to start it remotely? Or must we use Virtual Keys to navigate the file menu?
- [ ] **Tracking Tab — Active Tool & Line Number:** While running an air program, do any Modbus registers (known or undocumented) expose the currently loaded tool (T#) or the executing G-code line number? If we can poll the line number directly, we don't need tracking beacons at all.
- [ ] **Tracking Tab — Macro Variable Polling:** If the line number isn't exposed, can we read standard macro variables (e.g., `#100-#199`) via Modbus? (If yes, we just inject normal `#199 = X` lines into the G-code and poll them over Modbus to track progress, which is natively supported without needing the master-mode `MSETDATA`).
- [ ] **Status Tab — Active WCS & Overrides:** Can we read the active WCS (e.g., is G54 active?) directly? Can we read the Feed/Spindle override percentages? Can we *write* to them directly, or only bump them via Virtual Keys?
- [ ] **Console Tab — Execution Feedback:** If an injected G-code line (Reg 3000) causes an alarm or out-of-bounds error, does the controller return a specific error code in register 10002 or as an exception that we can print to the Console?

## While you're there (from MACHINE-DAY.md)
- [ ] The V-series copies (bridge/controllers/expert-m350/verify/ → CNCDISK) and runs: V13a–d ·
      V14 · V15 · V16 · V7 — each names its three outcomes in its header.
- [ ] Confirm the macro restore held: home → "HOMING COMPLETE — A SYNCED TO Y".
