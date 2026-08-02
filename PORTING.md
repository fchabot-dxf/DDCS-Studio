# PORTING.md — the porting arc, tracked

> ⚠ **THE ARC WAS REFRAMED AT t1531 (scout t1530): "port the corpus" → "MAKE THE EVIDENCE EXECUTABLE".**
> Measurement inverted the premise. V4.1 is **already ported** — a full dialect module, one of exactly
> two `POST_VERIFIED` (hardware-verified) posts, touched by 54 specs, maintained continuously through
> the whole parametric arc. What is missing is the **instrument**: the dialect's confirmations live in
> code comments ("CONFIRMED against probe-fix.nc"), and **prose does not go red** — 0 of 91 tracked
> factory `.nc` macros are read by any spec, for any target. That is a smaller, safer, almost entirely
> offline arc than the one that was planned.

> The living progress record for **the porting arc** (the plan's arc 3, committed).
> Maintained by the **advisor** at each pass-back — read this file for "where is the port right now"
> without digging through HANDOFF/WORK-LOG. The in-repo *design* record (stages, gates, caps — as
> data) will live in the repo once the scout lands it; this file is the human-readable ledger.

**Order of targets:** DDCS **V4.1 FIRST** (maintenance-mode target, last firmware 2024-05-11),
then DM500/V3-class, then grbl-class (= unroll). Every parametric op ports once; wizards follow.
**Discipline:** per-target verify instruments; one PILOT op proven end-to-end (emit · sim ·
round-trip · verify) before any fleet port — the corner-gated-pilot rule.

---

## Status: S1 BUILDING (t1532)

The scout's own stage plan, declared as data in `DDCS-Studio/web/data/portingArc.js` (the
`slotCapabilityArc` shape) and pinned by `tests/porting-arc-scout-1530.spec.js` (9 factual claims,
all green) so the design cannot rot before it is built.

| # | Stage | State | What it is |
|---|-------|-------|------------|
| 0 | Kickoff scout | ✅ **landed** t1530 | Inverted the premise. 5 forks parked, all ruled at t1531. |
| — | Design ruling | ✅ **landed** t1531 | See the ruling table below. |
| S1 | **Corpus oracle** | 🔄 **building** (t1532) | The 91 factory `.nc` macros become oracles *read at runtime* — following `controller-import-one-door-1221`, which already does this for the settings corpus (the existence proof: it is a known shape, not a new mechanism). Pilot **WCS zero-at-current** (already reproduces `zeroxy.nc`/`zeroz.nc` byte-for-byte), then **corner** as second subject. Plus the residue census (below). |
| S2 | Normalisation policy | ⏳ **unblocked** | Factory G-code is **unspaced**, Studio emits **spaced**. ✅ **SETTLED t1531 — V4.1 accepts spaced** (user-attested). The oracle still compares normalised (the corpus is unspaced, so normalisation is what makes comparison possible), but the delta is an **answered** row, not an open question. S5 confirms it for free. |
| S3 | Caps completeness | ⏳ | 3 caps live outside `DEFAULT_CAPS`, confirmed **latent not live** (every consumer truthy-tests; zero `=== false` comparisons). |
| S4 | Named unknowns | ⏳ | `readActiveWcs` / `hmiPrompt` / ATC tables — all fold to `[]` honestly today. |
| S5 | Live round-trip | ⏳ **human-gated** | Cannot be agent-scheduled — needs a human at the bench to press Start. The C3-is-last discipline. |
| — | DM500 follows | ⏳ | Same S1–S4 stages. **Guard:** rows carry their evidence tier on their face, and DM500 does **not** enter `POST_VERIFIED` on offline agreement alone. |
| — | grbl-class | ⏳ | **UNROLL** — confirmed against caps: grbl has no `#vars` at all; grblHAL's O-word flow cannot stream. |

## The t1531 rulings

| Fork | Ruled | Why |
|---|---|---|
| **arc-reframe** | **A — reframe to "make the evidence executable"** | Holding the port framing re-does finished work; widening to all 7 posts multiplies a mechanism never once run. **Condition:** the "already ported" claim itself must stop being prose — see the residue census. |
| **pilot-choice** | **A — WCS zero-at-current** | The corner-gated-pilot rule governed the *wizards-as-data* port, which is complete. A pilot for an **evidence instrument** must be an op that *has* evidence; corner has no factory file. Corner is S1's **second subject**, so op-richness is still proven early. |
| **spacing** | **A + ✅ SETTLED** — compare normalised; the delta is an **answered** row | ✅ **The user attested it t1531: V4.1 accepts spaced.** Evidence tier **user-attested** (stronger than an assumption, weaker than a captured bench trace — the `trigEvidence` tier discipline applied to a parser). Consequence, recorded so nobody re-opens it: **Studio's spaced emit is legal on V4.1**, so no act in this arc needs to consider emitting unspaced, and S5 confirms it for free rather than gating on it. |
| **a-axis-wcs** | **A for this arc + B as a real backlog item** | Not a V4.1 question (both dialects behave identically) — but the user runs a 4th axis, so it is a genuine gap, declared as data where a future act will find it. |
| **arc-order-after-v41** | **A — DM500 next, through the same stages** | The S1 instrument is the cheapest discriminator between "likely parametric" and "measured". Guarded by the `POST_VERIFIED` rule above. |

### The residue census (the condition on the reframe)

The scout's "the port is done" rested on a **sampled** residue — ~33 Expert-literal lines across 16
files, the sampled ones judged passthrough-semantics or gated absences rather than bypasses. A sample
is prose too. S1 turns it into a **census**: every line classified in data
(`passthrough-semantic` / `gated-absence` / `actual-bypass`) with the count **pinned**, so
*"already ported"* becomes a claim that can go red. Any actual bypass found **is** port work and
lands inside this arc.

## Cross-target floor (t1529 amendment, answered)

| Target | `#vars` | Expressions | `IF`/`WHILE` | Trig | Verdict |
|---|---|---|---|---|---|
| **DDCS Expert M350** | ✅ | ✅ | ✅ | COS/SIN attested; SQRT/ATAN community-referenced (V13-gated) | **parametric** — shipped |
| **DDCS V4.1** | ✅ | ✅ | ✅ | same shape as Expert | **parametric** — already ported, instrument pending |
| **DDCS V3 / DM500** | likely | likely | likely | same trig shape as V4.1 | **likely parametric, UNMEASURED** — 18-file installer tree vs V4.1's 209-file firmware+SMB capture. Named loudly. |
| **grbl / grblHAL** | ❌ none | — | O-word flow cannot stream | — | **UNROLL** (confirmed against caps, not re-derived) |

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

_(newest at the bottom: turn · release · what landed · gate result)_

- **t1530** — _no release (scout, no product code)_ — the arc scouted as data (`portingArc.js`, 5 stages,
  5 forks) + 9 claims pinned by spec. **Inverted the arc's premise.** Branch `wizard-porting-work`
  found conclusively superseded (asserted against its own map, not sampled) → **archive-tagged
  `archive/wizard-porting-work` and deleted** (advisor, t1531). Scout spec green, smoke 71/71.
- **t1531** — _advisor ruling, no code_ — all 5 forks ruled (table above); arc renamed; residue-census
  condition attached; S1 dispatched.
