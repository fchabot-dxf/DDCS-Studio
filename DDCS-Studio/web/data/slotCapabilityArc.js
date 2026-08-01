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
        /** t1492 — what actually landed, recorded on the row (the shape C4 introduced at t1487). */
        landed: 'SHIPPED at t1492, phase AND clamp in ONE act as this row insisted. `rasterRowAnchorOf` declares the '
            + 'rule (fit = every existing caller, wall = a slot), and BOTH halves fall out of one count and one '
            + 'guard: n = FIX[(span - 0.001)/step] + 2, row = origin + i*step, IF row > far wall THEN row = far wall. '
            + 'At a WHOLE multiple the last loop row lands exactly ON the wall and the clamp is a no-op; where it is '
            + 'not, the clamp is what stops the overshoot this row measured (+1.20 / +1.20 / +0.60, all OVERSIZE). '
            + 'BRIDGED against slotPath move for move at TEN widths - the three whole-multiple cases, the three '
            + 'divergent ones, two narrower than a stepover and two long - all MATCH. The fit default is asserted '
            + 'byte-identical over 432 configs, and an unknown word falls to fit like every other walk word. '
            + '⚠ ONE DIVERGENCE NAMED RATHER THAN PAPERED OVER: at width == tool the band is zero, where slotPath '
            + 'emits a single centreline pass and the atom REFUSES (its collapsed-inset guard fires first, in its own '
            + 'words). That is the atom being louder, not wronger, and it is the degenerate the slot kernel has its '
            + 'own arm for.',
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
        /** t1494 — what landed, and the arc CLOSES here. Same `landed` shape C4 introduced at t1487. */
        landed: 'SHIPPED at t1494, BAKED — and the arc closes with it. `rasterBearingOf` declares the angle and '
            + '`bearingShift` resolves it WITH the program rotation into ONE rotation by the sum about a shifted '
            + 'origin, which is this row\'s own "two build-time rotations are ONE sum" made exact: the algebra was '
            + 'verified numerically (5.7e-14 over six angles × five pivots × five points) BEFORE any emit changed. '
            + 'The pivot is the OP\'S DECLARED ORIGIN, not the walk\'s, so the C2 inset turns with the construction '
            + 'and across-the-pass means across the PASS at any angle — the C2 payoff this row was promised. '
            + 'THE NULL CASE IS BYTE-IDENTICAL over 864 configs (this row called it the strongest assert, and it is: '
            + 'a zero bearing takes the untouched path entirely, so even rotated configs cannot move). Bridged '
            + 'against slotPath at SEVEN bearings (0/30/45/90/-30/137.5/180) — all match within one emit quantum. '
            + '⚠ THE LIVE HALF DID NOT SHIP and is refused in its own words: a dialled bearing needs COS/SIN of a '
            + 'runtime angle, so it joins the V13 lift plan beside the helix.',
        gate: '⚠ THE LIVE FORM ONLY: a pendant-dialled bearing needs COS/SIN of a runtime angle, which is trig —'
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

/**
 * ⚠ t1500 — THE RE-POINT LANDED, AND THE TWO HALVES OF "INHERITS" CAME APART. Recorded on the design rather than
 * left for a reader to infer, which is the discipline the `landed` rows above follow.
 *
 * The rows above were written as if one event lifted both halves. It did not. The WIZARD side shipped: an eligible
 * slot's clearing IS the atom now (`slotStack` forks on `slotStackArmGap`), measured against the frozen kernel move
 * for move across 400+ configs. **The CAM width gate did NOT move, and that is correct rather than unfinished** —
 * lifting it means teaching `opToSlot` to pack the atom's macro instead of its own centreline body, which is
 * generator work with its own bridge, not a consequence of the wizard delegating. `slot-capability-arc-1478` pins
 * the gate as still refusing, so the two cannot be quietly conflated.
 *
 * AND THE EXPRESSIBLE DOMAIN IS SMALLER THAN THESE ROWS IMPLY. "Slots of any width" and "slots at ANY angle" are
 * both true only outside the gates that t1498/t1500 measured — THREE of them as of t1506, down from four: the ramp
 * over a partial last bite RETIRED when t1504 measured the family and found the slot kernel, not the atom, was the
 * outlier (see the retirement note in `wizards/ops/slot.js`). That is the only one that has ever closed.
 */
export const SLOT_REPOINT_LANDED = {
    wizard: 'SHIPPED at t1500. `slotStack` forks at the PLACE on a derived `_para`: the eligible slot\'s clearing is '
        + 'ONE `surfaceraster`, everything the gate refuses keeps the literal kernel byte-identically. The twin '
        + '(`slot_data`) became a SUPERSET twin in the same act — it had to, because a frozen template seeded at the '
        + 'zero-band defaults would have emitted the LITERAL slot where the form emitted the ATOM (t1498 measured it '
        + 'at width 14), and two paths cutting differently for one parameter set is worse than not re-pointing',
    camGate: 'NOT LIFTED, deliberately. Packing the atom\'s macro into a CAM slot is `opToSlot` work with its own '
        + 'bridge; the wizard delegating does not do it. The gate still refuses a slot wider than its tool and still '
        + 'names the wizard as the exit',
    gates: 'THREE as of t1506, and none of them is the pair this arc inventoried: the ZERO BAND (width == tool), the '
        + 'HELIX entry-end clamp, and a PATTERNED slot (t1500 — an `array` is not self-framing, so a placed pattern is '
        + 'refused by `translateProgram` and would silently lose its placement). A FOURTH stood between t1498 and '
        + 't1506 — a RAMP over a PARTIAL last depth level, which the shipped defaults landed in — and it RETIRED: '
        + 't1504 measured the whole family and the slot kernel, not the atom, was the outlier (three kernels plus the '
        + 'atom all ramp the nominal stepdown), so the slot converged on the nominal floor and the divergence ceased. '
        + 'THE SHIPPED-DEFAULT RAMPING SLOT IS PARAMETRIC BECAUSE OF IT',
};

/**
 * ── t1508 — THE CAM LIFT, SCOUTED BEFORE IT IS BUILT, because its FIELD LIST is not the one the act assumed ───────
 *
 * The act is to pack the ATOM's macro for eligible slots so the CAM width gate can lift. The scout found one
 * constraint that decides the whole shape, and it is not negotiable by effort:
 *
 * ⚠ THE BEARING MUST BE BAKED — AND THAT FORCES THE ENDPOINTS TO BE BAKED TOO.
 *
 * `slotRasterParams` derives the atom's frame from A and B:
 *
 *     bearing = atan2(By - Ay, Bx - Ax)      w = hypot(B - A)
 *     x = Ax + (width/2)·sin(bearing)        y = Ay - (width/2)·cos(bearing)
 *
 * A packed CAM slot's fields are LIVE `#2600` registers an operator dials at the pendant, so any quantity derived
 * from them must be computable ON THE CONTROLLER. `atan2` and `hypot` are not: `data/trigEvidence.js` rates ATAN and
 * SQRT `community-referenced` — the weakest tier — and the two places Studio already ships them (the alignment probe,
 * the rotary 3-point fit) are OPERATOR-ATTENDED PROBING, which that file is explicit is a NARROWER precedent than it
 * looks and not a licence for a cutting macro. So the bearing and the length are build-time constants or nothing.
 *
 * A BAKED BEARING BESIDE LIVE ENDPOINTS IS THE DEFECT, NOT THE COMPROMISE. Dial B at the pendant and the slot cuts
 * the OLD angle through the NEW endpoint — clean G-code, wrong part, no error. That is exactly the class `t1425`
 * closed for the raster (`surfaceRasterLiveGap`: a descent that bakes geometry degrades honestly rather than baking
 * against a dial) and the class the `no-knob-dark` law exists for.
 *
 * SO THE PACKED SLOT'S KNOBS ARE THE ATOM'S OWN, NOT THE WIZARD'S. This is the correction the build act needs:
 */
export const SLOT_CAM_PACK_DESIGN = {
    live: 'depth · stepdown · feed · plunge · clearance · rpm · toolDia · stepoverPct · WIDTH — every one of them is '
        + 'either a direct atom register or reachable from one by arithmetic the controller does today. `width` stays '
        + 'live because `x`/`y` need it only as `width/2 · <baked sin>`, and a baked sine is a constant',
    baked: 'ax · ay · bx · by — and they are baked TOGETHER WITH the bearing and the length they derive, because that '
        + 'is the only way the three cannot disagree. The existing expose/bake machinery already expresses this '
        + '(`decl[key].exposed === false` in opToSlot/probeToSlot allocates no #11xx param and no field)',
    why: 'atan2 + hypot are V13-gated (trigEvidence: ATAN/SQRT community-referenced), so the frame is build-time or '
        + 'nothing; and a baked frame beside live endpoints cuts the old angle through the new point — silently',
    /**
     * ⚠ THE ACT AS DISPATCHED SAID "tool diameter + stepoverPct join the #2600 layout". That is right and it is not
     * the whole change: the endpoints must LEAVE the live layout in the same act, or the new arm ships the very
     * silent-substitution defect the arc exists to prevent. A format change that adds two knobs and leaves four
     * lying is worse than the gate it lifts.
     */
    fieldListDelta: '+toolDia +stepoverPct +width (live) · -ax -ay -bx -by (baked, with the bearing and length)',
    refusalIfExposed: 'if a future caller exposes an endpoint on the packed arm, the pack must REFUSE in the table\'s '
        + 'words rather than emit — the surfaceRasterLiveGap pattern, one surface along',
    stillLiteral: 'helix entries, the zero band, patterns, and anything the atom\'s own envelope refuses keep the '
        + 'centreline body and the honest row that names the wizard as the exit',
    bands: 'the packed atom writes RASTER_SCRATCH (#34-#49, #62-#64); the literal centreline body keeps #50-#54. '
        + '`bandsFor(\'slot\')` must carry BOTH, and the probe temps #50-#61 overlap is what the collision guard has '
        + 'to be asserted against at a HIGH varOffset',
};

/**
 * ── t1510 — THE BUILD STARTED AND MEASURED ITS OWN PREMISE FALSE. The DOMAIN is not the one the act assumed ───────
 *
 * The scout above settled WHICH KNOBS the packed arm carries and it is right. This is the next question down, and the
 * first emit probe answered it the hard way: **CAN the atom actually walk a slot whose bearing is baked while its
 * knobs are live?** For an ANGLED slot, no — and it does not say so, it silently drops the angle.
 *
 * MEASURED, both directions, same config (a 30° slot, width 16, Ø8, 40%):
 *
 *   FULLY BAKED (the wizard path, the one C3/t1494 bridged against `slotPath`):
 *       G0 X[6.781086 + #40 * 0.866025 - #47 * 0.5] Y[3.915064 + #40 * 0.5 + #47 * 0.866025]
 *       → both axes mixed by the rotation constants. The walk really runs on the bearing.
 *
 *   THE PACKED SHAPE (h/toolDia/stepoverPct/insetAcross as live #registers, bearing still baked at 30):
 *       G0 X[5+[#35/2]*0.500000000] Y#47      ·      G1 X[[5+[#35/2]*0.500000000] + #40]
 *       → a pure AXIS-ALIGNED walk, placed at the rotated origin. The 30° VANISHED.
 *
 * ⚠ AND `surfaceRasterCovers` RETURNED **TRUE** FOR IT. The envelope permitted a config whose defining angle it
 * discarded — the exact silent-substitution class this arc exists to prevent, sitting inside the predicate written to
 * prevent it. WHY it was reachable: `surfaceRasterAbsorbsRotation` refuses a LIVE frame (there is no build-time
 * constant per axis for the rotation printer to mix), and for `rotAngle` that refusal is complete — the caller falls
 * back to the whole-program text rewrite, so somebody still applies it. FOR A BEARING THERE IS NO FALLBACK. Two
 * quantities t1494 proved compose into ONE rotation turn out to have DIFFERENT failure modes when that rotation
 * cannot be baked, and only `rotAngle` had a safety net. t1425 folded the live-GEOMETRY refusal into the envelope so
 * the delegation could ask one question; the ROTATION refusal was left outside it, and that gap was the hole.
 *
 * FIXED THIS TURN, in the atom's own words and INERT for every caller shipping today (`surfaceRasterLiveGap` now
 * refuses a non-zero bearing the body cannot absorb — the wizard slot path bakes its whole frame so `absorbs` is true,
 * and the CAM pocket's frame is live but its bearing is 0, so nothing to drop). The caller it stops is the one that
 * measured it.
 */
export const SLOT_CAM_PACK_DOMAIN = {
    reachableToday: 'a wide slot whose BEARING IS 0 — MEASURED move-for-move identical to the fully-baked wizard path '
        + 'with the register values substituted, so the packed arm is a true delegation for it. This is the common '
        + 'case and the shipped default (A 0,0 → B 60,0), and it is exactly `SLOT_CAM_INHERITANCE`\'s FIRST row',
    refusedToday: 'a wide slot at ANY OTHER bearing, including the axis-aligned +Y one. Not a caution — the atom '
        + 'DROPS the angle and emits an axis-aligned channel, so this must refuse at pack and name the wizard as the '
        + 'exit (t1444). `SLOT_CAM_INHERITANCE`\'s C3 row already said exactly this: "until then an angled wide slot '
        + 'stays wizard-only, and the gate\'s sentence must keep naming the wizard as the exit"',
    /**
     * ⚠ THE DISPATCH SAID "axis-aligned AND angled slots of any width pack honestly, both stages together". The
     * measurement says the second half is not reachable, and THIS FILE'S OWN INHERITANCE TABLE agreed with the
     * measurement rather than with the dispatch before either was written — the two halves were always separate rows,
     * gated on C2+C1 and on C3 respectively. So "build to the design, not to the wording" resolves it: axis-aligned
     * lifts, angled keeps its honest row.
     */
    dispatchCorrection: 'the ANGLED half of the lift is measured-unreachable; the axis-aligned half is measured-exact',
    whyNotJustBakeMore: 'baking the width/toolØ/stepover% back down would restore `absorbs` and let an angled slot '
        + 'rotate — and it would leave the packed arm with NO live knob the literal body does not already have, which '
        + 'is the whole point of the lift. The trade is not available: live knobs OR a rotatable frame, not both',
    theCapabilityThatWouldLiftIt: 'C5, a LIVE-FRAME ROTATION — the printer mixing each axis\'s constant into the '
        + 'other where the origin is a register. The rotation constants multiply the walk\'s RELATIVE offsets (already '
        + 'runtime registers: the row position, the span), so it needs no runtime trig and is NOT V13-gated — it is '
        + 'real atom work with its own bridge, in the shape of the four capabilities this file already built, and it '
        + 'is NOT a packaging act',
    /**
     * A SECOND, SMALLER CORRECTION to the scout's field list, found the same way. `SLOT_CAM_PACK_DESIGN.live` names
     * `plunge` and its `fieldListDelta` line does not — and the literal slot body has no plunge field at all (it
     * plunges at `feed`). The atom takes a real `plunge`, so the delta is one key longer than the line says.
     */
    fieldListDeltaCorrected: '+toolDia +stepoverPct +width +PLUNGE (live) · -ax -ay -bx -by (baked, with the bearing '
        + 'and length). `plunge` is in the design\'s `live` sentence but missing from its `fieldListDelta` line, and '
        + 'the literal body never had the field — the atom descends at a plunge feed, so it joins',
    bandKeyingIsOpen: 'the scout said `bandsFor(\'slot\')` must carry BOTH bands, and it must — but `bandsFor` is '
        + 'keyed by camType ALONE, so adding the atom\'s #34-#49 to the one `slot` key makes the LITERAL arm\'s field '
        + 'vars step over registers it never writes, moving their numbers and the read-lines that cite them. Pre-'
        + 'release that costs no migration, but it is not the byte-identical literal arm `stillLiteral` implies. Either '
        + 'the literal arm moves (accepted, one key, both bands) or the band is keyed per ARM — a decision, not a detail',
};

/** The one thing this arc does NOT touch, restated so it cannot be folded in by accident. */
export const SLOT_ARC_NOT_INCLUDED = {
    what: 'rest machining (REST_PARAMETRIC_GAP)',
    why: 'that boundary is EVIDENCE-blocked — SQRT per row per corner on a controller where SQRT is unverified — and '
        + 'only a machine visit lifts it. These four are TEACHABLE. Collapsing the two kinds is exactly what '
        + 'SLOT_RASTER_GAP was written to prevent',
};
