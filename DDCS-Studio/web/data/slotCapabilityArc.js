/**
 * data/slotCapabilityArc.js — THE SLOT CAPABILITY ARC, DESIGNED AS DATA (t1478 scout — no product code).
 *
 * ── WHAT THIS IS ────────────────────────────────────────────────────────────────────────────────────────────────
 * t1442 measured why a slot's clearing cannot ride the parametric raster atom and declared it as `SLOT_RASTER_GAP`,
 * with the distinction that makes this arc possible at all: rest machining is blocked by EVIDENCE (SQRT on an
 * unverified controller) and only a machine visit lifts it, while these four are things the atom COULD BE TAUGHT.
 * A capability arc, opened deliberately, with its own bridge per step.
 *
 * This file is the design the build acts read — the `trigEvidence` / `SURFACE_RASTER_BAKES` precedent. It is inert
 * data: what changes, what stays, the order, the register cost, the envelope rows earned, and what the CAM
 * generator inherits. `tests/slot-capability-arc-1478.spec.js` asserts every factual claim below against the real
 * kernels, so the design cannot rot in the gap between being written and being built.
 *
 * ── THE THREE FINDINGS THAT SHAPED THE ORDER ────────────────────────────────────────────────────────────────────
 *
 * 1. ⚠ THE REGISTER BAND IS FULL, AND IT IS FULL ON BOTH SIDES. The atom's band is `#34–#49` — sixteen registers,
 *    declared in `surfaceraster.js` — and it is boxed in: camMacroKit's kit band sits immediately below at
 *    `#27–#33`, the probe temps immediately above at `#50–#61`. There is no adjacent room to grow into. So "how
 *    many registers does this cost" is not bookkeeping here, it is the binding constraint, and the arc was designed
 *    against it rather than discovering it three acts in. **The whole arc costs +1 register in its baked form.**
 *
 * 2. ⚠ ONE CAPABILITY PAYS TWICE, AND IT IS THE SMALLEST ONE. C4 (the declared run vector) is not only a slot
 *    capability: t1339's own TODO names the `+X` declared run vector as the ramp's pendant-true answer *"which
 *    needs no square root at all"*. So C4 also lifts the raster ramp's own `SURFACE_RASTER_BAKES` rows — the
 *    improvement-remainder item that is otherwise waiting on V13. It is first for that reason as much as its size.
 *
 * 3. ⚠ ONE CAPABILITY IS EVIDENCE-GATED IN HALF ITS FORMS, AND ONLY IN HALF. A BAKED bearing is two build-time
 *    constants and costs no registers and no evidence. A LIVE (pendant-dialled) bearing needs COS/SIN of a runtime
 *    angle — trig, unverified on this controller, V13's decision. That is why C3 is LAST: not because it is hard,
 *    but so the arc cannot stall on a machine visit while three teachable capabilities wait behind it.
 */

/** The atom's declared register band, and why "+1 register" is the design constraint rather than an afterthought. */
export const SLOT_ARC_BAND = {
    atom: '#34-#49', descent: '#34-#39', header: '#40-#49',
    boundedBelowBy: 'camMacroKit kit band #27-#33', boundedAboveBy: 'probe temps #50-#61',
    note: 'sixteen registers with no adjacent room. Every capability below is costed against this, and the arc as a '
        + 'whole adds ONE — the ramp\'s second run component, inside the descent band that ramp and helix already share '
        + 'by mutual exclusion',
};

/**
 * THE FOUR CAPABILITIES. `order` is the build sequence — smallest independently-bridgeable steps first, each with a
 * bridge that does not depend on the ones after it.
 *
 *   changes    — what the atom must learn
 *   stays      — what must NOT move, which is the larger half and the reason each step is bridgeable at all
 *   bridge     — the equivalence this step is proved by, against the literal kernel
 *   registers  — cost against SLOT_ARC_BAND
 *   envelope   — the declared rows this capability earns (the surfaceRasterCovers / BAKES precedent)
 *   gate       — '' when nothing external blocks it
 */
export const SLOT_CAPABILITIES = [
    {
        id: 'declared-run-vector', order: 1, label: 'C4 — the declared run vector for descents',
        atomNow: 'a ramp runs toward the AREA CENTRE and bakes the distance to it (a hypotenuse); a helix sits at the '
            + 'area centre with its radius clamped by the rect inradius',
        slotNeeds: 'a ramp ALONG the slot length and a helix at the ENTRY END clamped to the slot WIDTH — both already '
            + 'expressed by the literal kernel, which passes runX/runY/cx/cy/maxHelixR into its own descent ctx',
        changes: 'rampLines and helixLines take a DECLARED run vector and a declared centre+clamp instead of deriving '
            + 'them from the walked rect',
        stays: 'the walk, the row rule, the inset, the axis, every emitted move outside the descent',
        bridge: 'one rect, one level, plunge vs ramp-along-vector vs helix-at-entry — the descent is the only thing '
            + 'that moves, so the rest of the program is a byte-identity check',
        registers: '+1 — the ramp currently holds one run component in #34; a declared vector needs runX AND runY. '
            + 'The descent band #34-#39 already belongs to exactly one of plunge/ramp/helix, so the second component '
            + 'takes #35 with NO band growth',
        envelope: 'SURFACE_RASTER_BAKES parallel/ramp + concentric/ramp collapse to inputs [] — the ramp stops baking '
            + 'its distance-to-centre and becomes pendant-true',
        gate: '',
        paysTwice: 'this is ALSO the improvement remainder\'s pendant-true ramp (t1339: the run vector "needs no square '
            + 'root at all"), so it lifts a raster row that is otherwise waiting on V13. Doing it here retires that item',
    },
    {
        id: 'two-axis-inset', order: 2, label: 'C2 — the anisotropic (two-axis) inset',
        atomNow: 'ONE inset moved on BOTH axes (w − 2·inset, h − 2·inset). Handing it tool/2 walks a 60mm slot from '
            + 'x=3 to x=57 — a 54mm channel where 60 was asked (t1442, measured)',
        slotNeeds: 'tool/2 across the WIDTH and NOTHING along the LENGTH — the tool centre runs the full centreline A to B',
        changes: 'inset becomes a pair (along, across) folded into the two span seeds at seed time',
        stays: 'the row rule, the descent, the axis, and the single-inset case must stay BYTE-IDENTICAL — the existing '
            + 'callers pass one number and must keep emitting exactly what they emit today',
        bridge: 'the same rect walked with (i, i) reproduces today\'s emit character for character; then (tool/2, 0) '
            + 'against slotPath\'s own span',
        registers: '0 — the insets fold into #40/#41, which already carry the walked spans. A LIVE inset was always '
            + 'folded the same way; two of them fold the same way twice',
        envelope: 'the BAKES table\'s `inset` key becomes two, so a config can declare one axis live and the other baked',
        gate: '',
    },
    {
        id: 'wall-anchored-rows', order: 3, label: 'C1 — the wall-anchored row rule',
        atomNow: 'uniformly spaced rows, the first HALF A STEPOVER inside the walked edge, keeping only those that FIT '
            + '(n = floor((span − step/2)/step) + 1)',
        slotNeeds: 'passes anchored ON the wall (±(width−tool)/2) with a FORCED final pass clamped to the far wall, so '
            + 'the finished channel is exactly the width that was typed',
        changes: 'TWO teachings, and this scout\'s main finding is that they CANNOT BE SPLIT — see twoTeachings below',
        stays: 'everything the rows are made of — the both-ways link at depth, the one-way lift-and-return, the '
            + 'descent hook on row 0, the direction restart per level',
        twoTeachings: '⚠ RE-MEASURED THIS ACT RATHER THAN INHERITED, and the inherited sentence was not reproducible '
            + 'as written. The RAW atom NEVER coincides with the slot at any width — its rows sit exactly half a '
            + 'stepover off, which is the PHASE. Only the PHASE-CORRECTED atom (rows starting ON the wall) coincides, '
            + 'and then exactly when (width − tool) is a whole multiple of the stepover: measured IDENTICAL at 18×Ø6@40% '
            + '(both [−6,−3.6,−1.2,1.2,3.6,6]), 13.2×Ø6@40% and 20×Ø8@50%. Where it is NOT whole, the phased atom\'s '
            + 'LAST row OVERSHOOTS the far wall — measured +1.20mm at 12×Ø6@40%, +1.20 at 16.8, +0.60 at 15 — every one '
            + 'of them in the OVERSIZE, destructive direction. SO THE PHASE ALONE IS WORSE THAN NEITHER, and the CLAMP '
            + '(the forced final pass) is not a refinement of it but its other half. They land in ONE step or the '
            + 'capability ships a gouge',
        bridge: 'THE EQUALITY ARM IS REAL AND MEASURED: phase + clamp against slotPath\'s own offsets, byte-identical '
            + 'wherever (width − tool) is a whole multiple of the stepover (the three cases above). THE DIVERGENCE ARM '
            + 'is the other three, where the assert is that the last pass lands ON the wall rather than past it — i.e. '
            + 'the bridge proves the clamp, not just the phase',
        stepsAfter: 'two-axis-inset — rows anchor to the walked span, so the span must be right first or a row bug and '
            + 'an inset bug are indistinguishable in the output',
        registers: '0 — the row position moves from `step/2 + i·step` to `−half + i·step`, and `half` is derived from '
            + 'the cross span already in #41. The forced last pass is a clamp against a value already in hand',
        envelope: 'a declared `rowRule` axis: "fit" (today, surfacing and pockets — the tool may overhang, or a wall '
            + 'finish pass follows) vs "wall" (a slot, which has neither). Both stay reachable: this is a NEW AXIS, '
            + 'not a replacement, and the existing rule is the default',
        gate: '',
    },
    {
        id: 'bearing', order: 4, label: 'C3 — the slot\'s own bearing',
        atomNow: 'rows run ∥X or ∥Y (rasterRowAxisOf). Only rotAngle could express an angle, and that socket means the '
            + 'PROGRAM\'s declared rotation — a second, unrelated quantity that would have to compose with it',
        slotNeeds: 'passes on the slot\'s bearing (measured 30.000° on a 30° slot, its step-overs at 120°)',
        changes: 'every X/Y coordinate expression becomes a rotation of the (along, across) pair by the bearing',
        stays: 'the row rule, the inset, the descent — all of which are expressed in the (along, across) frame and do '
            + 'not know the frame is rotated',
        bridge: 'a bearing of 0 must reproduce the unrotated emit BYTE-IDENTICALLY (the null case is the strongest '
            + 'assert this step has); then 30° against slotPath\'s own measured 30.000° passes and 120° step-overs',
        stepsAfter: 'wall-anchored-rows AND two-axis-inset — a bearing bug and a row bug look identical in the output, '
            + 'so the unrotated frame has to be right first. This is why it is last rather than because it is hard',
        registers: '0 BAKED (two build-time constants in the expressions) · +2 LIVE (a dialled bearing needs its cos '
            + 'and sin at run time)',
        envelope: 'a `bearing` axis, and the composition with rotAngle declared explicitly: two build-time rotations '
            + 'are ONE sum, so they compose for free while both are baked',
        gate: '⚠ THE LIVE FORM ONLY: a pendant-dialled bearing needs COS/SIN of a runtime angle, which is trig — '
            + 'unverified on this controller (V13_trig.nc, and see data/trigEvidence.js). THE BAKED FORM IS UNGATED '
            + 'and is what a slot actually needs, since a slot\'s bearing is geometry the operator drew, not a knob '
            + 'they turn at the machine. So this capability lands baked and its live half joins the V13 lift plan',
    },
];

/**
 * WHAT THE SLOT CAM GENERATOR INHERITS, and it is NOT one event.
 *
 * `opCamMap`'s width gate refuses to pack any slot wider than its tool, because `opToSlot`'s slot macro is ONE
 * centreline pass per level — its own comment says *"For width > tool, add perpendicular offset passes"* and t1444
 * ruled that packing anything else emits a wrong slot. That gate lifts when the slot can DELEGATE its clearing to
 * the atom, and delegation needs different capabilities for different slots:
 */
export const SLOT_CAM_INHERITANCE = [
    { when: 'C2 + C1 (two-axis inset AND wall-anchored rows)', unlocks: 'AXIS-ALIGNED slots of any width — the atom '
        + 'walks the true channel, so the generator can pack the atom\'s macro instead of its own centreline body and '
        + 'the width gate lifts for them' },
    { when: 'C3 (bearing)', unlocks: 'slots at ANY angle — until then an angled wide slot stays wizard-only, and the '
        + 'gate\'s sentence must keep naming the wizard as the exit (t1444: an operator told "unsupported" with no '
        + 'exit does the wrong thing next)' },
    { when: 'C4 (declared run vector)', unlocks: 'nothing for the CAM gate on its own — it is a DESCENT capability. '
        + 'It is first in the build order for its own reasons, and this row exists so nobody expects the gate to move '
        + 'when it lands' },
];

/** The one thing this arc does NOT touch, restated so it cannot be folded in by accident. */
export const SLOT_ARC_NOT_INCLUDED = {
    what: 'rest machining (REST_PARAMETRIC_GAP)',
    why: 'that boundary is EVIDENCE-blocked — SQRT per row per corner on a controller where SQRT is unverified — and '
        + 'only a machine visit lifts it. These four are TEACHABLE. Collapsing the two kinds is exactly what '
        + 'SLOT_RASTER_GAP was written to prevent',
};
