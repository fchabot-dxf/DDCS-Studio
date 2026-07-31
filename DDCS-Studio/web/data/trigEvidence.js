/**
 * data/trigEvidence.js — THE TRIG GATE AND ITS LIFT PLAN, declared as data (t1466).
 *
 * ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────────────────────────────────────────
 * t1464 measured three literal boundaries and found that all of them wait on ONE obstruction wearing three names:
 * trig is unverified on this controller. That finding is only worth what the NEXT act can do with it, and the next
 * act is a machine visit. A visit is turnkey when the operator knows which files to run, in what order, and when
 * somebody has already written down what each possible answer changes — BEFORE the drive out. Prose in six source
 * headers cannot do that; each header knows its own boundary and none of them knows the set. This registry is the
 * set, in one reading, and `tests/trig-lift-plan-1466.spec.js` asserts it against the real declarations so it cannot
 * quietly go stale while the boundaries move.
 *
 * ── THE DIAGNOSIS THAT PRODUCED IT — why live SQRT is V13-GATED and not shippable behind the loud-failure rule ───
 * The corpus discipline is explicit (ddcs-expert `references/CORE_TRUTH.md` §9): *new emit may lean on the ◐/◔
 * evidence tiers only where a failure is LOUD — a parse error that stops the program — never where a silently wrong
 * value could steer a cut.* Three things decide the case, and only the third is the blocker:
 *
 *   1. LOUD IS UNUSUALLY GOOD ON THIS CONTROLLER, which is better news than the queue assumed. `verify/HANDOFF.md`
 *      safety rule 3 is machine-CONFIRMED: any syntax error aborts the WHOLE file — nothing executes, state
 *      pristine. So a loud failure here is not a halt mid-cut with the tool down; it is a program that never starts.
 *      The rule is therefore SATISFIABLE in principle at this site.
 *   2. THE PRECEDENT IS REAL BUT NARROWER THAN IT LOOKS. Studio already ships both functions — ATAN in the alignment
 *      probe and SQRT in the rotary 3-point fit — but both are OPERATOR-ATTENDED PROBING, one of them behind an
 *      explicit ADVANCED / verify-on-machine banner. A raster ramp is an unattended cut into material. The shipped
 *      cases do not license the new one; they are rows on this plan in their own right (see `kind`).
 *   3. ⚠ AND THE LOUDNESS OF AN *UNKNOWN FUNCTION* IS EXACTLY WHAT IS UNEVIDENCED. Every observed `syntax error!`
 *      in the corpus is malformed SYNTAX — bracketed IF conditions, GOTO spacing, three-digit labels. Not one is an
 *      unimplemented function word. A parser that tokenises `SQRT` as a stray word and evaluates the bracket anyway
 *      returns a NUMBER, and at this site that number is a divisor: `toC` near zero turns the ramp midpoint into a
 *      wild coordinate. That is the forbidden half of the rule, and no amount of reasoning converts it into the
 *      permitted half. Only the test does.
 *
 * So the answer to "does the corpus discipline allow emit-behind-loud-failure here?" is: NOT YET, because the
 * loudness itself is the unproven premise, and the decider already exists. Hence a V13-PREP act rather than a build.
 *
 * ── WHAT THE VISIT IS AND IS NOT WORTH ───────────────────────────────────────────────────────────────────────────
 * Read `lifts` before promising anything. Two of the six rows lift a boundary outright on a YES. Two are boundaries
 * that a YES only NARROWS — they carry a second, independent reason (a tessellated walk is a POINT LIST, and a
 * macro cannot count itself into a list the way it counts rows into a rectangle), so proving SIN/COS changes their
 * wording and not their existence. Two are not lifts at all: they are DEFECT CHECKS on emit that already ships.
 * Overselling the visit is the failure mode this column exists to prevent.
 */

/** The corpus rule this gate is decided by, quoted at its source so the two cannot drift. */
export const TRIG_LOUD_FAILURE_RULE = 'new emit may lean on the sister-demonstrated / community-referenced evidence '
    + 'tiers only where a failure is LOUD — a parse error that stops the program — never where a silently wrong value '
    + 'could steer a cut (ddcs-expert references/CORE_TRUTH.md section 9)';

/** Machine-CONFIRMED, and the reason "loud" is a good outcome here rather than a merely tolerable one. */
export const TRIG_ABORT_SEMANTICS = 'a syntax error aborts the WHOLE file on this controller — nothing executes and '
    + 'the state is pristine (verify/HANDOFF.md safety rule 1/3, learned the hard way on V1 and IF_neg_test). A loud '
    + 'failure is therefore a program that never starts, not a halt mid-cut';

/**
 * The four functions, their evidence tier, and the file that settles each. `expect` is the number the probe must
 * report; the spec asserts it appears in the macro, so this registry — not the .nc text — is the one source.
 * A reported number that is NEITHER `seed` NOR `expect` is the silently-wrong outcome the rule forbids.
 */
export const TRIG_FUNCTIONS = {
    COS:  { tier: 'sister-demonstrated',    test: 'V13a_cos.nc',  expect: 50,   seed: 0, probe: 'COS 60 x100',
            indirect: 'V4.1 + DM500 factory slibs run a full 2D rotation matrix — but the M350 firmware libm import table does NOT hold cos' },
    SIN:  { tier: 'sister-demonstrated',    test: 'V13b_sin.nc',  expect: 50,   seed: 0, probe: 'SIN 30 x100',
            indirect: 'same sister evidence as COS, and the same absence from the M350 libm import table' },
    SQRT: { tier: 'community-referenced',   test: 'V13c_sqrt.nc', expect: 300,  seed: 0, probe: 'SQRT 9 x100',
            indirect: 'the M350 firmware libm import table DOES hold sqrt — of the four this has the strongest indirect case, which matters because the ramp needs exactly it' },
    ATAN: { tier: 'community-referenced',   test: 'V13d_atan.nc', expect: 4500, seed: 0, probe: 'ATAN 1 over 1 x100',
            indirect: 'the libm table holds atan, AND Studio already emits this exact two-operand form to real machines' },
};

/** Run order for the visit. The combined file first: one run answers all four when nothing is missing, and its ABORT
 *  is the only evidence we can get for whether an unknown function fails loud at all. */
export const TRIG_RUN_ORDER = ['V13_trig.nc', 'V13c_sqrt.nc', 'V13a_cos.nc', 'V13b_sin.nc', 'V13d_atan.nc'];

/**
 * THE LIFT PLAN. One row per site that names the trig gate, with what a YES actually buys.
 *
 *   kind 'gated'              — a declared boundary waiting on the answer.
 *   kind 'shipped-unconfirmed'— emit ALREADY going to real machines on an unconfirmed function. Not a lift: a
 *                               defect check, and the reason a NO is as urgent as a YES is welcome.
 *   lifts true                — a YES removes the boundary and the declaration must come out.
 *   lifts false               — a YES does NOT remove it; `whyNotLift` says what else is in the way.
 */
export const TRIG_LIFT_PLAN = [
    {
        id: 'raster-ramp', kind: 'gated', needs: 'SQRT', lifts: true,
        site: 'wizards/ops/surfaceraster.js', decl: 'SURFACE_RASTER_BAKES', anchor: 'SURFACE_RASTER_BAKES',
        keys: ['parallel/ramp', 'concentric/ramp'],
        what: 'a ramp bakes toC, the distance from its start to the area centre — a hypotenuse. The start sits at '
            + 'y0 + step/2 and step is the DERIVED stepover a pendant can change, so a baked toC under a dialled '
            + 'stepover gives a kinked entry',
        onYes: 'compute toC live and both ramp rows collapse to inputs [] / why "" — the ramp becomes pendant-true. '
             + 'The opCamMap ENTRY_GEOMETRY_KNOBS gate that marks stepoverPct + stepdown bake-only on a ramp slot '
             + 'lifts with it, and raster-live-geometry-1425.spec.js goes red by design',
        onNo: 'the row stays, permanently rather than pending, and the pendant-true ramp goes to its OTHER answer: '
            + 'the +X declared run vector, which needs no square root at all (the literal kernel already supports it '
            + 'via runX/runY). That path is an IMPROVEMENT-class change — a different set of moves, so a new entry '
            + 'mode with its own bridge, never a silent substitution',
    },
    {
        id: 'rest-walk', kind: 'gated', needs: 'SQRT', lifts: true,
        site: 'wizards/ops/restmachining.js', decl: 'REST_PARAMETRIC_GAP', anchor: 'REST_PARAMETRIC_GAP', keys: [],
        what: 'maskToCorners clips each scanline span to a circle around every pocket corner, and a horizontal line '
            + 'crossing a circle needs sqrt(R^2 - dy^2) — once per row per corner (8 on an 80x60 Ø6-then-Ø3, one '
            + 'level), plus the same root again at the fillet arcs bounding the cleared-region rings',
        onYes: 'the rest walk becomes a candidate for a runtime macro loop and the declaration must come down rather '
             + 'than be quietly kept; rest-parametric-boundary-1431.spec.js goes red by design. It is a CANDIDATE and '
             + 'not a conversion: the walk still has to be shown countable, on its own act with its own bridge',
        onNo: 'rest stays literal, whole and correct. The cheap dodge stays refused — masking to a SQUARE needs no '
            + 'root and cuts a different part, which is a geometry change wearing a port\'s clothes (t1425)',
    },
    {
        id: 'pocket-non-rect', kind: 'gated', needs: 'SIN+COS', lifts: false,
        site: 'wizards/ops/pocketfill.js', decl: 'POCKET_SHAPE_GAP', anchor: 'POCKET_SHAPE_GAP', keys: [],
        what: 'a circle / polygon / ellipse pocket is cleared by walking a tessellated offset polyline computed in '
            + 'JS — 124 polygon, 384 circle, 2496 ellipse trig calls per depth level, against ZERO for the rect that '
            + 'converted at t1406',
        onYes: 'the declaration is REWORDED to drop its trig clause and stand on the point-list clause alone. The '
             + 'boundary itself does not move',
        onNo: 'unchanged — the declaration already states both reasons',
        whyNotLift: 'the ellipse\'s 1167 lines at one level are a JS-computed POINT LIST, and a macro cannot count '
            + 'itself into a tessellated offset polyline the way it counts rows into a rectangle. The rect converted '
            + 'because its walk is a FORMULA; these stay because theirs is a LIST',
    },
    {
        id: 'contour-polygon-ellipse', kind: 'gated', needs: 'SIN+COS', lifts: false,
        site: 'wizards/ops/contour.js', decl: 'CONTOUR_PARAMETRIC_GAP', anchor: 'CONTOUR_PARAMETRIC_GAP', keys: [],
        what: 'only POLYGON and ELLIPSE contours are transcripts at all — 13 and 192 trig calls, the ellipse a '
            + '96-segment polyline. A RECT boundary is four corners (7 lines, 0 trig: a macro loop saves nothing) '
            + 'and a CIRCLE already emits one true G3 arc, which IS the compact parametric form',
        onYes: 'the declaration drops its trig clause. Contour remains declared-literal BY DESIGN',
        onNo: 'unchanged — and this is the row where a NO costs least, because two of the four region kinds were '
            + 'never trig-bound and the other two have a second reason behind the first',
        whyNotLift: 'the same POINT LIST reason as the pocket fills, one layer out — plus two of the four region '
            + 'kinds were never trig-bound in the first place, so trig was only ever one of this ruling\'s three '
            + 'reasons. This row is a DESIGN STATEMENT, not a deferral: nothing here is queued',
    },
    {
        id: 'alignment-atan', kind: 'shipped-unconfirmed', needs: 'ATAN', lifts: false,
        site: 'data/probeToSlot.js', decl: '#54=ATAN[#52]/[#53]', anchor: '#54=ATAN[#52]/[#53]', keys: [],
        what: 'the alignment probe computes its fence angle with the two-operand ATAN form and SENDS IT TO REAL '
            + 'MACHINES. Nobody has confirmed the controller accepts it. This is the tier the t1339 note calls the '
            + 'riskiest of the three, because it looks like usage without being evidence',
        onYes: 'confirmed. The tier moves from community-referenced to live-shipped-and-checked, and the alignment '
             + 'angle is trustworthy for the first time',
        onNo: '⚠ A DEFECT, NOT A DEFERRAL. Either the alignment slot has never parsed on this controller, or it has '
            + 'been computing a wrong angle — and the correction depends on WHICH, so the reported number matters as '
            + 'much as the yes/no. Highest-stakes row on this plan',
        whyNotLift: 'nothing is gated behind it — the emit already ships. A YES buys confidence, not capability',
    },
    {
        id: 'rotary-fit-sqrt', kind: 'shipped-unconfirmed', needs: 'SQRT', lifts: false,
        site: 'wizards/rotaryCenterWizard.js', decl: 'the 3-point circle fit R solver', anchor: 'SQRT[[[#52-#54]', keys: [],
        what: 'the FIT arm solves the true OD radius with SQRT of the squared deltas. It is Studio-original and '
            + 'machine-UNVALIDATED, and it says so on the operator\'s screen — the ADVANCED / verify-on-machine '
            + 'banner is the reason this ships at all where the ramp may not',
        onYes: 'the banner\'s SQRT concern resolves; the fit stays ADVANCED for its own separate reason (the solver '
             + 'shape and its un-simulated operator-jog were never the function\'s fault)',
        onNo: 'the FIT arm cannot produce a radius and the banner has to say so outright rather than say "verify"',
        whyNotLift: 'operator-attended probing behind an explicit banner — a different risk class from an unattended '
            + 'cut, which is exactly why this shipped and the ramp did not',
    },
];

/**
 * NOT ON THIS PLAN, and named so that nobody adds it. A boundary can be literal for reasons that have nothing to do
 * with the controller's maths, and folding those into the trig gate would make the machine visit look like it buys
 * more than it does — the precise error this file was written to prevent.
 */
export const TRIG_NOT_GATED = [
    { site: 'wizards/ops/slot.js', decl: 'SLOT_RASTER_GAP',
      why: 'a boundary of the raster atom\'s DECLARED AXES, not of arithmetic: a wall-anchored row rule, an '
         + 'anisotropic inset, the slot\'s own bearing and a declared run vector. All four are things the atom COULD '
         + 'be taught — a capability arc to open deliberately. V13 changes nothing here either way' },
    { site: 'wizards/ops/surfaceraster.js', decl: 'SURFACE_RASTER_BAKES helix rows',
      why: 'a helix bakes the rect inradius that CLAMPS its radius, and that radius seeds the rotating vector whose '
         + '9-decimal constants keep the descent inside one emit quantum (t1343). That is a recurrence-precision '
         + 'fact, not a trig-availability one — the true-arc helix act is what touches it' },
];
