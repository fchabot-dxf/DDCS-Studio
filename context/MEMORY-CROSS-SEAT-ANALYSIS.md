# CROSS-SEAT MEMORY ANALYSIS — RENDERRANCHY (165) vs Fairy (7)

**2026-08-25.** Fairy dumped its store as instructed. The comparison is far more one-sided than the counts
suggest, and **not in the direction the counts suggest.**

⭐ **HEADLINE: three of Fairy's seven were needed on RENDERRANCHY TONIGHT and were not there.** One of them
would have prevented six exchanges of design work. Volume is not value — 165 memories accumulated over 90% of
the dev time did not contain what 7 memories written at the machine did.

---

## 1. ⛔ UNIQUE TO FAIRY — hardware truth the RENDERRANCHY seat cannot produce and did not have

These come from a machine with a controller attached. **The RENDERRANCHY seat has none of them.**

| fact | why it matters |
|---|---|
| ⛔ **Never `G53 G1`** | It does not lift/position correctly and **crashed the tool into the table, breaking a bit (2026-07-23)**. Use a plain `G53` rapid. |
| ⛔ **`G53` needs a VARIABLE, never a literal** | `#101=0 / G53 Z#101` — `G53 Z0` is wrong. |
| ⛔ **Comments CANNOT nest parentheses** | `( … ( … ) )` throws a DDCS bracket error and the line is rejected. **See §2 — this one is the finding.** |
| **Arithmetic needs brackets** | `#102 = [#100+5]`; a literal in a motion word can error — put it in a var first. |
| **`M115` (home-all) FAILS at boot** | Enters factory O501 with `#1` dirty. Home per-axis via `M98P501X<n>`. |
| **The `setting` file is a float64 array** | slot = param − 500 for ≥500. Reads can be unreliable — verify at the machine. |
| **The tool-setter diagnosis** | The real bug was a **rapid descent through the setter before any G31 ran**, not a dead signal. It looked like a signal fault for a whole session. **Tell: drive-through at RAPID = approach bug; at PROBE speed = signal bug.** |

⭐ **This is exactly the asymmetry the handoff predicted**: *"on anything the real machine can answer, Fairy is
the authority and RENDERRANCHY is guessing."* Confirmed, and stronger than expected.

---

## 2. ⭐⭐ THE FINDING — Fairy already knew what RENDERRANCHY spent an evening re-deriving

Tonight the RENDERRANCHY seat designed comment-safety machinery across **four dispatched amendments**, each cut back
by the owner, and finally withdrawn entirely. It then asked Fairy to derive a safe replacement-character list
**from the dumps**, since the advisor had ruled himself out as a source.

**Fairy's `ddcs-macro-writing-rules` already contained the constraint, and the app already contains the fix:**

> *"Never double/nested parentheses in a comment — `( … ( … ) )` throws a DDCS bracket error and rejects the
> line. Keep comments flat."* … *"also the app export bug fixed in `917f8856`"*

⇒ The real constraint is **NESTING**, not the character set. And it was fixed in the app months ago.

⚠ **This is the two-homes defect doing exactly what was predicted of it** — not a contradiction, an *absence*.
The RENDERRANCHY seat did not hold a wrong belief; it held no belief, and re-derived from scratch while the answer
sat in another store on another machine. **Nothing detected that.** No test, no exception, no grep — precisely
the failure mode the dump instruction was written to expose.

⇒ **The blocking item in `HANDOFF-FROM-FAIRY.md` §1 is partly answered already.** What remains is narrower:
whether a *flat* comment has any character restriction at all, beyond not nesting.

---

## 3. ⚠ A FEEDBACK MEMORY THE RENDERRANCHY SEAT SHOULD HAVE HAD — and visibly needed tonight

Fairy's `feedback-scope-discipline`:

> *"When the user says something 'doesn't really matter' / 'just make it an honest stub' … treat that as a real
> scope ceiling — not an invitation to fully investigate and build a feature around it."* … *"A big,
> well-tested change for a thing they called minor reads as ignoring their signal, not as thoroughness."*

⭐ **That describes tonight's comment thread precisely.** The owner said *"keep it as it is"*, *"forget that"*,
*"simply signaled and nothing else special"* — and each time the design was cut back only after being
dispatched. The advisor also spent **six measurements** hunting a dirty-dot bug that did not exist.

⇒ This is a **working convention, not a seat preference** — same person, both machines — so by this project's
own newly-recorded rule it belongs in `ROADMAP.md`'s conventions section, where every seat reads it.

---

## 4. OVERLAP — the same facts, held twice

- **`wizards-as-data-port`** (Fairy) vs RENDERRANCHY's arc docs. Fairy's notes ops have **TWO build paths
  that must stay in sync** — the same dual-vocabulary hazard the RENDERRANCHY seat rediscovered at t2263 and guarded
  with a pairing test. ⚠ **Held in two stores, in different words, neither pointing at the other.**
- **`multi-pc-agent-setup`** (Fairy) vs `shop-two-pc-network` (RENDERRANCHY). Same topology, two records.

⇒ Both are candidates to move into the repo once and be pointed at from both stores.

---

## 5. NO OUTRIGHT CONTRADICTIONS FOUND

Nothing in Fairy's seven directly contradicts a RENDERRANCHY memory. **The damage was absence, not disagreement** —
which is worth recording, because it means the danger is not only "two seats believing different things" but
"one seat not knowing what the other paid to learn."

⚠ And the price of that absence is on record here: *"Repeated guessing (nested parens, `G53 G1`) has cost real
hardware."*

---

## 6. ⇒ WHAT TO DO

1. ⛔ **Promote Fairy's hardware facts to `controllers/expert-m350/FINDINGS.md`**, tagged `[CONFIRMED]` — they
   are measured at the machine and belong where every seat reads them. Especially `G53 G1`, the `G53`-needs-a-
   variable rule, and the no-nested-parens constraint.
2. **Promote `feedback-scope-discipline` to ROADMAP's conventions section.** It is about the person, and the
   person is on both machines.
3. **Collapse the two wizards-as-data records** into the arc doc, with pointers left behind.
4. ⚠ **Do not merge the stores.** The residue that should stay local is small and genuinely local: this
   machine's ports and paths, VS Code's module caching. Everything else belongs in the repo.
