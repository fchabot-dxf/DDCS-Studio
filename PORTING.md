# PORTING.md — the porting arc, tracked

> The living progress record for **the porting arc** (the plan's arc 3, committed).
> Maintained by the **advisor** at each pass-back — read this file for "where is the port right now"
> without digging through HANDOFF/WORK-LOG. The in-repo *design* record (stages, gates, caps — as
> data) will live in the repo once the scout lands it; this file is the human-readable ledger.

**Order of targets:** DDCS **V4.1 FIRST** (maintenance-mode target, last firmware 2024-05-11),
then DM500/V3-class, then grbl-class (= unroll). Every parametric op ports once; wizards follow.
**Discipline:** per-target verify instruments; one PILOT op proven end-to-end (emit · sim ·
round-trip · verify) before any fleet port — the corner-gated-pilot rule.

---

## Status: SCOUT IN FLIGHT (t1530)

| # | Stage | State | Evidence / notes |
|---|-------|-------|------------------|
| 0 | Kickoff scout | 🔄 **in flight** (t1530, fresh seat) | Four questions: branch peek · evidence floor · dialect delta · arc-as-data + pilot nominee. Parks at the design gate. |
| 1 | Design ruling | ⏳ waits on scout | Advisor rules the forks: pilot op choice, caps shape, anything the measurement inverts. |
| 2 | Pilot op end-to-end on V4.1 | ⏳ | Emit + sim + round-trip + the V4.1 verify instrument, proven on ONE op family. |
| 3 | Fleet port (V4.1) | ⏳ | The remaining parametric ops through the proven seams — mechanical by design. |
| 4 | Wizards follow | ⏳ | Per the arc's standing plan. |
| 5 | Later targets | ⏳ | DM500/V3-class; grbl-class = unroll. Not started, not scoped. |

## The scout's four questions (t1529 dispatch)

1. **Branch peek** — `wizard-porting-work` @ 76348158 (predates the whole parametric arc):
   salvage vs superseded, disposition (cherry-pick / mine-for-design / archive-tag).
2. **Evidence floor** — what V4.1 ground truth exists in-repo (bridge/controllers/, community
   corpus, factory dumps) and what does NOT — the Expert arc ran on M350 dumps as its truth; V4.1's
   equivalent must be named, or its absence named LOUDLY. A verify instrument cannot be an assumption.
3. **Dialect delta as data** — variable bands, macro syntax, probing surface, caps: Expert→V4.1
   declared as a caps/post table the existing postGating reads, not prose.
4. **Arc-as-data + pilot** — stage structure the way `slotCapabilityArc.js` carried the slot arc;
   a nominated pilot op family with the argument for it.
5. **Cross-target breadth pass** _(added by amendment, user-driven)_ — ONE row per candidate target
   against the parametric FLOOR (`#vars` · expressions in coordinate words · `IF`/`WHILE` · trig+SQRT
   · free-register band), verdict **PARAMETRIC vs UNROLL**, every row tagged by evidence tier
   (attested dump / manual / community-referenced / unknown). Cheap and shallow on purpose — it exists
   so the **arc ORDER** is ruled on evidence rather than on the assumption that V3/DM500 is closest.
   An honest `unknown` beats a guess; name what would settle it.

### The parametric floor (why a target may or may not take the macros)

```
 has #vars + expressions in coord words + IF/WHILE ?
   YES → parametric ports; the delta is DIALECT (bands, syntax, feature subset)
   NO  → UNROLL: same toolpath, emitted as literal G-code computed at build time
 side conditions that SHAPE a port without blocking it:
   · no trig/SQRT      → geometry bakes at build (the V13-gate lesson: the slot's bearing baked)
   · small free band   → less can stay live on the pendant
```

Either way there is a floor: a controller that cannot do parametric still gets the **same toolpaths**,
just as fixed G-code rather than pendant-editable macros.

## Sizing expectation (advisor estimate, pre-scout)

Meaningfully smaller than the parametric arc — that arc *built* the machinery (envelopes, affine
frames, @work, freezes, bridges); this one *reuses* it. Rough guess: a quarter to a third of the
effort for V4.1, bounded properly by the scout. The two risks that could grow it: a weak V4.1
evidence floor, and a larger-than-expected dialect distance.

## Landed acts

_(none yet — filled as acts land, newest at the bottom: turn · release · what landed · gate result)_
