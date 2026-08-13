# Job progress — time remaining, predicted then corrected

**Status:** scoping note. Nothing built. Prepared 2026-08-13 at the user's request.

---

## The problem, in the user's words

> *"long jobs have no way to tell if its halfway or 90%"*

And tracking is **not** a remote-only concern — *"tracker is anytime."* Whether you are in the shop or not,
the question is the same: **how much longer.**

## Why neither existing mechanism answers it

| | what it gives | why it does not answer "how long" |
|---|---|---|
| **Beacons** (`bridge/`'s tracker: poll `status/<jobId>.json` → `% · op · line · ETA`) | a line number | **lines ≠ time.** A dwell is one line. A 40-minute surfacing pass is one line. |
| **Modbus** (`10002` state, `7080`/`7260` position — see `M350-MODBUS-REFERENCE.md`) | BUSY/IDLE + where the tool is, live | truthful about *now*, silent about *how much is left* |

## The thing neither has, and Studio does

**Studio wrote the program.** It knows every move, every feed, every rapid — and the sim already walks the
whole thing. So Studio can predict the duration *before the run*, then anchor that prediction to reality
using live position.

```
  PREDICT   from the emitted program            → "41 min"
  ANCHOR    live position → advance a cursor
            through the plan                    → "we are 18 min in"
  CORRECT   predicted-elapsed vs actual-elapsed  → a factor
  RE-PREDICT the remainder with that factor      → "~23 min left"
```

**This compares the machine against Studio's own plan.** The existing tracker only mirrors what the
controller reports — it cannot do this, because it does not have the plan.

---

## What is EXACT vs MODELLED vs MEASURED — this determines how good it gets

```
  EXACT      (Studio wrote it)     distances · feed rates · rapid rate (if configured)
  MODELLED   (approximated)        acceleration ramps · controller look-ahead / corner
                                   blending · dwells · tool changes · probe retries
  MEASURED   (closes the gap)      actual elapsed vs predicted, live, during the run
```

The exact half is most of the time in a long job, which is why this works at all. **The unknowns are
SYSTEMATIC, not random** — a controller that decelerates into corners is slow *consistently*, so ONE
measured factor corrects the rest of the run rather than requiring a better physics model.

---

## Design constraints — these are the point, not polish

1. **⚠ HONEST EARLY.** The first stretch is a guess. Say "estimating" rather than showing a confident wrong
   number. *A bar that reads 90% and then sits for twenty minutes is worse than one that admits it is still
   learning.* Same rule as everything else in this project: it may be a guess, it may not be a SILENT guess.
2. **Confidence is part of the answer.** Not one number — time remaining AND how sure. A uniform job
   (surfacing, a drill pattern) converges fast; a job of wildly varied move lengths has a factor that keeps
   shifting, so the estimate genuinely wanders and should say so.
3. **⚠ Unbounded waits are NOT part of the countdown.** Tool change, manual jog prompt, a probe the operator
   watches — the machine is waiting on a HUMAN. Folding those into a time-remaining figure makes it a lie.
   Show them as a distinct state ("waiting for you"), never as elapsed time.
4. **Anchor by ADVANCING A CURSOR, not by matching position.** A program crosses the same point many times,
   so "where is the tool" ≠ "which move is it on". Walk the plan forward as positions arrive. **The sim
   already does exactly this walk** — it knows the expected time-to-reach at every point, because it plays
   the program.
5. **Works with no cloud.** No beacons, no status files, no Worker: estimate from the emitted program, read
   the position, subtract. The beacon path stays for the genuinely remote case.

---

## Beacons and Modbus are complementary, not a swap

- **Beacons** know the SEMANTIC position — which op, which line.
- **Modbus** knows the PHYSICAL position and whether it is actually moving.
- **Together they detect a STALL**, which neither does alone: a beacon-only tracker cannot tell "finished"
  from "died at line 40" — both look like no new beacon. `10002` distinguishes them truthfully.

---

## Later, and cheap: learn the machine's character

Record actual-vs-predicted per job. After a few runs the FIRST estimate on a NEW job starts from *this
machine's measured behaviour* rather than a generic model. That is a small store, not a feature —
and it is the difference between decent and genuinely good.
⚠ Per-machine, in the user's own workspace file — **not a shipped default**. See NEXT-SESSION's
"personal machine values hardcoded as universal defaults": one machine's measured acceleration must never
become everyone's constant.

---

## Prerequisites, honestly

- **Live position requires the Modbus link** — verified for position/state only
  (`M350-MODBUS-REFERENCE.md` §1), and unverified against this user's own controller.
- **Read-only** throughout. This feature needs no writes, so it sits entirely on the safe side of
  `[[live-cnc-readonly-when-away]]`.
- **Prediction alone works with NO link at all** — "this job should take 41 min" is useful before a run and
  needs nothing connected. **That is the sensible first slice:** predict-only, no live anchor, no
  correction. It proves the estimate against real jobs before any machine plumbing exists.
