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
        /**
         * t1487 — WHAT ACTUALLY LANDED, recorded on the row rather than left for a reader to infer from the code.
         * A design entry whose premise has been overtaken and does not say so is the same defect class as a PROVEN
         * row that keeps a criterion it no longer meets.
         */
        landed: 'THE RAMP HALF SHIPPED — t1483 declared the run vector (direction from the walk, limit a LIVE span '
            + 'register) and t1485 completed it (the descent start rides the walk\'s own declared axis forms, so a '
            + 'dialled stepover descends where it cuts). Both BAKES ramp rows are inputs: [], the opCamMap entry gate '
            + 'narrowed to helix alone, and trigEvidence\'s raster-ramp row closed by the no-SQRT road. '
            + 'THE HELIX HALF DID NOT, and went a different way: t1472/t1474 ruled helical arcs unattested on this '
            + 'controller family, so the helix keeps its polyline AND its inradius bake — which is why the slot '
            + 'boundary\'s descent clause survives on its helix half (SLOT_RASTER_GAP, amended t1487)',
        /**
         * ⚠ t1480 — C4'S TRUE REACH, MAPPED BEFORE ANY EMIT WAS TOUCHED. The scout costed this capability as
         * "+1 register, touches only the descent", and the EMIT half of that is right: the declared vector is the
         * row's own cut direction (±1 on the row axis — the ring walk leaves its corner along +X, the row walk along
         * its row) with the available distance already in a LIVE register (#40 / #41 span). No hypotenuse, no baked
         * unit vector, no baked toC — the new ramp is strictly SIMPLER than the one it replaces.
         *
         * What the costing missed is that this boundary is DECLARED IN THREE PLACES, and collapsing it in one leaves
         * the other two asserting something that is no longer true. Listed so the build act is turnkey rather than
         * discovering them one red spec at a time:
         */
        reach: [
            'wizards/ops/surfaceraster.js — rampLines takes the declared vector; the two BAKES rows collapse',
            'the live-geometry refusal lifts for RAMP automatically (it is keyed off the BAKES table) and must be '
                + 'asserted to still refuse HELIX, which keeps baking its inradius',
            'data/opCamMap.js — entryHasGeometry must narrow from (ramp || helix) to helix ALONE, or a CAM slot keeps '
                + 'stepoverPct/stepdown bake-only for a reason that no longer exists',
            '⚠ data/trigEvidence.js — the `raster-ramp` row is declared `needs: SQRT, lifts: true`. C4 lifts that same '
                + 'boundary by the OTHER path, which the row\'s own `onNo` already predicted ("the pendant-true ramp '
                + 'goes to its OTHER answer: the +X declared run vector"). So the row becomes STALE THE MOMENT C4 '
                + 'lands and must be restated in the same act',
            '⚠ tests/trig-lift-plan-1466 LOCK 2 asserts every GATED row\'s site still cites V13_trig.nc. When the ramp '
                + 'rows collapse, surfaceraster stops citing it and LOCK 2 goes RED — correctly. That is why the '
                + 'trigEvidence restatement cannot be a follow-up: the lock ties them into one act',
            'tests/raster-live-geometry-1425 PROOF 3 asserts the declared bakes per (strategy, entry) — red by design',
            '@work: the new ramp emits the same NUMBER of lines (assign · guard · G0 Z · ramp · return · goto · two '
                + 'labels · plunge), so the t1440 per-descent constant is expected to hold — to be MEASURED, not assumed',
        ],
        needsRuling: 'what becomes of trigEvidence\'s `raster-ramp` row. It is an EVIDENCE registry and the honest '
            + 'options differ in meaning: (a) delete it — the boundary is gone, and a lift plan should only list live '
            + 'ones; (b) keep it with `lifts: false` and a note that the boundary was lifted by the non-trig path, so '
            + 'the machine visit is not oversold for it; (c) keep it pointed at the HELIX rows, which still bake and '
            + 'still wait. My lean is (b) then (c) as separate facts, but a registry that exists to keep a machine '
            + 'visit honest should not be re-scoped by the act that happens to trip it',
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
        /** t1490 — what actually landed, recorded on the row (the shape C4 introduced at t1487). */
        landed: 'SHIPPED at t1490. `rasterInsetOf` / `rasterInsetAxes` resolve one word OR a pair into the two span '
            + 'seeds; the pair is named by ROLE (along the pass / across it) and maps to X/Y through `rowAxis`, which '
            + 'is what makes C3 a rename rather than a re-keying. The single-inset case is BYTE-IDENTICAL — measured '
            + 'over 432 configs (both walks × three descents × three directions × both row axes × skim × rotation × a '
            + 'LIVE inset), 0 differ — and an anisotropic pair walks the full centreline: a 60mm slot handed '
            + '(along 0, across tool/2) walks 0..60 where one inset walked 3..57. '
            + '⚠ THIS DOES NOT MAKE THE ATOM SLOT-READY, and saying so is the point: it fixes the walked SPAN, which '
            + 'is C1\'s precondition (`stepsAfter` says exactly that). The rows INSIDE that span are still uniformly '
            + 'spaced half a stepover in — measured y −1.8..3 on a 12mm width where a slot needs −3..3 — and closing '
            + 'that is C1\'s phase+clamp, which this arc says must land as ONE step or it ships a gouge',
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
