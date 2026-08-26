# THE MACHINE — an Ultimate Bee 1010 on a DDCS Expert / M350

⚠ **This lived only in a per-machine SKILL** (`~/.claude/skills/ddcs-expert/references/CORE_TRUTH.md`) until
2026-08-26. ⛔ **Skills are per-seat, exactly like memories** — so the spec of the machine sat on the seat that
is NOT wired to it, invisible to Fairy, who is. Moved here because every seat needs it.

⛔ **Do not restate the skill's whole reference here.** This is the machine's own shape — the part a seat
needs to reason about travel, sign and reach. Controller behaviour belongs in
[`../bridge/controllers/expert-m350/FINDINGS.md`](../bridge/controllers/expert-m350/FINDINGS.md), which
carries confidence tags this file cannot.

---

## ⭐ IT IS IN PRODUCTION

Owner, 2026-08-26: *"the expert and ultimate bee are mostly working, ive been able to run parts and 2 sided
jobs for a while."* **Real parts come off it.** See [`SETUP.md`](SETUP.md) for what that means for emit work.

## THE ENVELOPE — and the SIGNS are the point

```
X    0 → +1000 mm     POSITIVE
Y    0 →  -735 mm     ⚠ NEGATIVE
Z    0 →  -150 mm     ⚠ NEGATIVE
```

⭐ **Machine zero is at the limit switches**, and two of three axes travel NEGATIVE from it. A formula that
assumes positive travel is wrong here on Y and Z.

⛔ **`G28` IS NOT MACHINE ZERO.** It goes to back-off positions ~5 mm off the switches
(`Pr122-Pr126` / `#622-#626`): **X +5.0, Y −5.0, Z −5.0**. ⇒ **Use `G53` when you mean machine zero.**

⭐⭐ **Z travel is only 150 mm, and that is load-bearing for judging a claimed error.** The tool-offset
question in `BACKLOG.md` posits a WCS-Z wrong by **68.336 mm** — **45% of the entire Z axis.** On a machine
running real parts, an error that size is not subtle; it is a crash or a cut in mid-air on the first job.
⇒ **The missing symptom is strong evidence**, and any analysis claiming a large silent Z error has to explain
why nothing happened.

## WCS

- Set via **direct `#805+` register writes**. ⛔ **`G10` is broken on this controller — do not use it.**
- Six systems, G54–G59 (⚠ `FINDINGS.md` measured a **seventh** row plus the pendant's trailing "Offset").
- ⛔ **`G54 Z0` = the spoilboard. SACRED.**

---

## ⚠ PROVENANCE — read before trusting a number here

| what | source | confidence |
|---|---|---|
| the travels, `G28` back-off, `G10` broken | the `ddcs-expert` skill's `CORE_TRUTH.md` | ⚠ **derived / community**, NOT measured at this machine |
| in production, two-sided work in Fusion | the owner, directly | ⭐ stated |
| the WCS table's real shape | `FINDINGS.md` §10 — panel-verified on all six systems | ⭐ **CONFIRMED at the machine** |

⚠ **An unreconciled discrepancy, named rather than resolved:** `bridge/bridge-app/fairy/ops.py`'s own
docstrings use **X 756 / Y 776** while illustrating the soft-limit sentinel logic. They read as generic
examples rather than this machine's declared travel — but that was not established, and if they came from a
real dump then one of the two sets of numbers is wrong.

⇒ ⭐ **This is settleable, and only from one seat.** The real soft limits live in the controller's own
`setting` file (`ops.py`'s `_SOFT_NEG` / `_SOFT_POS`). **Fairy can read them directly**; Ranchy has captures.
Whoever gets there first: record the measured numbers here and tag them CONFIRMED, and delete this note.
