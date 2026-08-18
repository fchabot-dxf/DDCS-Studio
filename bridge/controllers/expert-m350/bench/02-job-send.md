# Project 2 — Job send + history, console to the real controller

**Where:** CNC-FAIRY, gateway pointed at the controller.
**Time:** ~15 min · **Risk:** none (nothing runs) · **Prereq:** [PREFLIGHT](../BENCH-CHECKLIST.md#preflight--do-this-once-before-any-project-5-min-no-risk)

## Why this matters

A gap that was named but never closed. **Both halves are proven separately, never in one sitting:**

```
  console → gateway → a DIRECTORY        ✅ proven in software (t2065)
                                            real spawned bridge, real Send click, real DOM
  SMB write → the REAL controller        ✅ proven at the bench, June 2026 (FINDINGS.md → find "SMB file access")
  ────────────────────────────────────────────────────────────────────────
  console → gateway → the REAL controller   ❌ never run end to end
```

This project runs it.

## Tasks

- [ ] Gateway running, pointed at the controller (`--dest \\<ip>\CNCDISK`). Open Studio.
- [ ] Build or open any small program. **Gateway ▸ Send**, with **Beacons OFF** (deliver-only).
      Tracked sends belong to project 3.
- [ ] Watch the gateway log for the poller's state machine (`poller.py:6`):
      `LIST inbox → claim oldest → Transfer → DELETE from inbox → "delivered"`
- [ ] On the controller (or over SMB), confirm the **.nc is physically on CNCDISK** — right name, right
      byte count.
- [ ] Studio → **Gateway ▸ Jobs / History**: the job appears with a real timestamp.

## PASS

The file is **physically on the controller** AND the job **shows in History**.

## Watch for

⚠ **Filename mangling.** A `multi_step.nc` naming bug was fixed earlier in this arc and **this is its first
real-hardware check.** If the name is wrong, record the exact name written vs expected.

⚠ **USB-stick workflow records nothing — by construction, not a bug.** `submit_job` / `api/jobs` is the only
path that ever writes history; `Export...` / `downloadFile` shares no code with it and never contacts the
server. If you normally copy files to a stick, History will stay empty no matter what this test shows.
That's a finding about who the feature serves — the user is deciding whether it deserves a UI nudge.

## RESULTS

| item | value |
|---|---|
| poller log showed the full state machine | ☐ yes ☐ no |
| file on CNCDISK | ☐ yes ☐ no — name written: |
| byte count matches | ☐ yes ☐ no |
| appears in History | ☐ yes ☐ no — timestamp: |

**Notes (raw errors verbatim):**
