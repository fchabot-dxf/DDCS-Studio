# THE MACHINE — an Ultimate Bee 1010 on a DDCS Expert / M350

⚠ **This lived only in a per-machine SKILL** (`~/.claude/skills/ddcs-expert/references/CORE_TRUTH.md`) until
2026-08-26. ⛔ **Skills are per-seat, exactly like memories** — so the spec of the machine sat on the seat that
is NOT wired to it, invisible to Fairy, who is. Moved here because every seat needs it.

⛔ **Do not restate the skill's whole reference here.** This is the machine's own shape — the part a seat
needs to reason about travel, sign and reach. Controller behaviour belongs in
[`../bridge/controllers/expert-m350/FINDINGS.md`](../bridge/controllers/expert-m350/FINDINGS.md), which
carries confidence tags this file cannot.

---

## IDENTITY

```
machine     Ultimate Bee 1010
controller  DDCS Expert / M350, hardware V1
firmware    2026-04-10-00   (slave mode present — it was added 2025-12-11-00)
```

⭐ **Hardware V1 decides the flash route: the `install/` folder, NOT `psys/`.** The vendor ships per-model
trees (`only_for_V1_model/install/`, `only_for_V2_model/psys/`) and they are not interchangeable.

⛔⛔ **NEVER put the `setting` file in the install folder.** The OEM read-me states that restores FACTORY
parameters — which would wipe axes, envelope, tool table and probe params. Back up at the pendant first.
Full procedure: `../bridge/controllers/expert-m350/assets/community/modbus-slave-2025-12-11/FLASH-DAY.md`.

## ⭐ IT IS IN PRODUCTION

Owner, 2026-08-26: *"the expert and ultimate bee are mostly working, ive been able to run parts and 2 sided
jobs for a while."* **Real parts come off it.** See [`SETUP.md`](SETUP.md) for what that means for emit work.

## THE ENVELOPE — and the SIGNS are the point

```
X    0 → +756 mm      POSITIVE      ⭐ CONFIRMED from the machine's own setting file
Y   +5 → -776 mm      ⚠ NEGATIVE    ⭐ CONFIRMED
Z          not set    ⚠ see below   ⛔ NO negative soft limit configured
```
⭐ **MEASURED 2026-08-26 by Fairy**, read out of `SYSDISK/setting` in two independent captures
(2026-06-10 and 2026-07-31 — identical), by `eng` name, in the pendant's own **Software limit** section:

| param | name | value |
|---|---|---|
| `#155` | Enable software limits | **1** (on) |
| `#166` / `#161` | X positive / negative | **+756** / `−9999` (unset) |
| `#167` / `#162` | Y positive / negative | **+5** / **−776** |
| `#168` / `#163` | Z positive / negative | **+1** / `−9999` — unset, and ⭐ ruled NORMAL by the owner |

⛔⛔ **THE SKILL'S NUMBERS WERE WRONG, AND `ops.py` WAS RIGHT.** The `X 1000 / Y −735 / Z −150` above came
from `CORE_TRUTH.md` and read as this machine's travel; the machine says **756** and **776**, which are
exactly the figures `ops.py`'s docstrings use. They were never generic examples — they are this machine,
and the discrepancy this file flagged is resolved in `ops.py`'s favour. ⇒ ⭐ **The dump outranked the
document, again.**

**Z has no negative soft limit** — `#163` reads `−9999`, the parameter's floor, i.e. never configured,
while `#155` says soft limits are ON and X and Y are fenced.

⭐ **RULED BY THE OWNER, 2026-08-26 — NORMAL, not a finding:** *"soft limits are optional though"* —
⚠ *"the negative one at least."*

⛔ **Do not re-raise it, and do not "fix" it.** ⭐ **And note how narrow the ruling is: the NEGATIVE Z limit
specifically.** It is not a blanket "soft limits do not matter" — X and Y are fenced on this machine and Z
positive is set. **Exactly one limit is unset, and it is the one that is impractical to set.**

**Why that one:** every other bound is a fixed property of the machine — the table's reach in X and Y, the
mechanical ceiling in Z+. The Z− bound is the only one whose correct value **changes per job**: it would
have to sit below the deepest legitimate cut, and `G54 Z0` is the spoilboard. Set it wrong and it **stops
production** rather than protecting anything. ⇒ Leaving it unset is a normal choice, and it does not
generalise to the others.

⚠ It was written up here as *"the axis that carries the tool toward the spoilboard is the one the controller
is not fencing"* — true as a sentence, and misleading as a framing. **The second time in one day that a
plainly-alarming reading of a real measurement dissolved once the owner applied ordinary knowledge of their
own machine** (the first: a probe-set tool offset being non-zero, which is what tool offsets are for).
⇒ **Measure freely; be slow to call a measurement a hazard.**

⚠ Still worth knowing: `#168` (Z positive) moved `9999 → 1` between the two captures, so this block IS
being adjusted by someone.

⭐ **Machine zero is at the limit switches**, and two of three axes travel NEGATIVE from it. A formula that
assumes positive travel is wrong here on Y and Z.

⛔ **`G28` IS NOT MACHINE ZERO.** It goes to back-off positions ~5 mm off the switches
(`Pr122-Pr126` / `#622-#626`): **X +5.0, Y −5.0, Z −5.0**. ⇒ **Use `G53` when you mean machine zero.**

⭐ **Z travel is only 150 mm.** Worth holding when judging any Z figure — the axis is short, so a
clearance or retract that looks modest can be a large fraction of it.

⚠ **A non-zero tool-length offset is NORMAL, not a warning sign.** The owner's is intentional and
probe-set (−68.336 at the time of writing). ⛔ **Do not treat the existence of a tool offset as evidence
of anything** — that is what the offset is FOR.

## WCS

- Set via **direct `#805+` register writes**. ⛔ **`G10` is broken on this controller — do not use it.**
- Six systems, G54–G59 (⚠ `FINDINGS.md` measured a **seventh** row plus the pendant's trailing "Offset").
- ⛔ **`G54 Z0` = the spoilboard. SACRED.**

---

## ⚠ PROVENANCE — read before trusting a number here

| what | source | confidence |
|---|---|---|
| the travels | ⛔ **the skill was WRONG** — superseded by `setting` `#161-#168` | ⭐ **CONFIRMED, two captures** |
| `G28` back-off, `G10` broken | the `ddcs-expert` skill's `CORE_TRUTH.md` | ⚠ **derived / community**, NOT measured here — ⚠ and its travel figures proved wrong, so treat the rest as unverified too |
| in production, two-sided work in Fusion | the owner, directly | ⭐ stated |
| the WCS table's real shape | `FINDINGS.md` §10 — panel-verified on all six systems | ⭐ **CONFIRMED at the machine** |

⚠ **An unreconciled discrepancy, named rather than resolved:** `bridge/bridge-app/fairy/ops.py`'s own
docstrings use **X 756 / Y 776** while illustrating the soft-limit sentinel logic. They read as generic
examples rather than this machine's declared travel — but that was not established, and if they came from a
real dump then one of the two sets of numbers is wrong.

✅ **SETTLED 2026-08-26 by Fairy** — read from the captured `setting` files, no machine power needed.
`ops.py`'s `X 756 / Y 776` are this machine's real soft limits, not examples. Numbers above.
