# 04 — MODBUS SLAVE: the bench test plan

⏸ **NOT RUN. Written 2026-09-02, nothing here has been executed.** The owner explicitly is not updating
firmware now — this exists so the plan survives the session rather than the transcript.

**Why now:** `foinnc/M350-LiveG` (the same author as the M3X bridge our register map came from) documents
four registers we did not have, and states a firmware requirement NEWER than anything in our records. See
`FINDINGS.md`'s own firmware entry for the three-date reconciliation.

⭐ **THE DESIGN RULE OF THIS PLAN, and the reason it is ordered the way it is:** every read test is paired
with a **ground truth you can see on the controller's own screen**. A register that returns a plausible
but WRONG number is the dangerous outcome — worse than one that times out, because it looks like success.
A test that only proves "something came back" proves nothing worth having.

---

## PHASE 0 — the single fact that decides everything

**Read the firmware version off the controller itself.**

```
  three dates are in play, and they may be sequential milestones rather than contradictions
    2025-12-11     our memory: "adds P279 SLAVE"
    2026-04-10     FINDINGS.md: "P279 three-way introduced by"
    2026-08-03-00  M350-LiveG's own stated minimum
```

⚠ **If the controller is below 2026-08-03-00, expect `3000` and `15000` to be ABSENT.** That is the
reconciliation working, not a fault — the newer firmware likely *adds* the dispatch/macro registers on top
of the older slave mode. Record the version string verbatim before anything else.

## PHASE 1 — link only, no motion

```
  P267 = B115200   ·   P279 = Slave   ·   P296 = None   ·   P297 = 1
```

Confirmed identical to our own recorded map, and independently stated by M350-LiveG's README.

⚠ **`P279` changes the controller's ROLE.** Note the previous value before changing it. Reversible.

**Success criterion:** a read returns *anything at all*. Nothing else is under test yet.

## PHASE 2 — reads. Safe, and each one verifiable.

| register | ×len | what it should be | ⭐ the ground truth to check it against |
|---|---|---|---|
| `7080` | 10 | WORK X Y Z A B, 5 × f32 | the DRO on screen. **Jog an axis and read again** |
| `7260` | 10 | MACHINE X Y Z A B | same — and `machine − work` should equal your active WCS offset |
| `10002` | 2 | state (IDLE/BUSY/RESET) | read while idle, then during a cycle |
| `15000` | ? | **macro variables** | set `#500` on the controller to something distinctive, read it back |
| `6500` | ? | **user parameters** | compare against a `Pr` value visible in the parameter screen |
| `10000` | ? | status — undocumented for us | whatever correlates; report what is actually in there |

⚠ Each axis in `7080`/`7260` spans two registers, reassembled `((uint32_t)r2 << 16) | r1` then cast to
float. ⚠ `10002` is recorded as int32 in our map; M350-LiveG declares no per-address types at all (checked:
zero occurrences in its 731 lines). Both read zero identically, so this is unresolved, not contradicted.

⭐ **`15000` and `6500` are the two worth the trip.** If `15000` really is the `#` variables, Studio can
read live machine state directly instead of round-tripping an engineering dump. If `6500` is the `Pr` set,
it replaces that import path entirely — see `machine-facts-vs-macro` reasoning in ARCHITECTURE/FINDINGS.

## PHASE 3 — writes. ⛔ A DIFFERENT RISK CLASS.

```
  6908  ×2   KEYPRESS         → START / PAUSE / RESET / JOG on a real machine
  3000       G-CODE DISPATCH  → the controller EXECUTES what you send (ASCII, ≤246 bytes)
```

⛔ **Preconditions, all of them:** no tool in the spindle · nothing clamped · hand on the E-stop · the
owner physically at the machine. ⛔ **Never remotely, never while away** — `live-cnc-readonly-when-away` is
the standing rule and this is exactly what it exists for.

⇒ Send something **inert first** — a comment line, or `G4 P100` — and confirm it is accepted before
sending anything that moves an axis.

⚠ Keypress codes are in `FINDINGS.md` / the register-map record. They were never bench-verified either.

## WHAT TO RECORD, whatever happens

The firmware string verbatim · which registers responded · which returned garbage · which timed out ·
and for every read, whether it MATCHED its ground truth. **A register that answers plausibly but wrongly
is the finding that matters most**, and it is invisible unless the pairing above is actually done.
