/**
 * data/opCamMap.js — CAM Builder S1b: the DECLARED bridge from a program op (opType + BARE op.params) to a CAM slot
 * generator + a seeded expose/bake field table. DATA layer only — no UI. Verified by assertion before S1c hides it.
 *
 * Grounded facts (t1041, do NOT invent):
 *  - op.params keys are BARE (depth, toolDia, w, ax…) — the p_/sf_/c_ prefixes are DOM field ids only.
 *  - The generator field keys (probeToSlot/millToSlot/opToSlot SPECs) mostly match op.params 1:1; PARAM_ALIAS lists the
 *    genuine RENAMES per CAM type (generatorKey -> opParamsKey). Unlisted keys alias to themselves.
 *  - NON_BAKEABLE per CAM type = the guard/branch param keys that MUST stay Expose-only (the SAFETY floor): baking a
 *    branch selector (corner/seq/probeZ/wcs, edge axis/dir, …) or a validity-guard driver (surface stepover/stepdown/
 *    toolDia/clearance — the `IF x LE 0 GOTO error` lines) would silently freeze a path/guard the operator can't see.
 *
 * VARIANT FORKS (t1043 rulings, ENCODED in camTypeOf): pocket shape 'circle' -> cpocket; drill method 'helical' -> bore;
 * middle -> boss (featureType === 'boss') else inside, but ONLY when BOTH-AXIS (twoAxis||findBoth) since the CAM inside/
 * boss generators are fixed both-axis centre probes — a single-axis middle is {unsupported} (never emit a wrong slot).
 * UNSUPPORTED (no generator / known gap): pocket polygon/ellipse, drill pattern 'single', middle single-axis, contour.
 */
import { cornerSlot, edgeSlot, probeZSlot, insideCentreSlot, bossCentreSlot, alignmentSlot } from './probeToSlot.js';
import { pocketSlot, circlePocketSlot, surfacingSlot } from './millToSlot.js';
import { slotFromOp } from './opToSlot.js';
import { stepoverPctOf, SURFACE_RASTER_AXES } from '../wizards/ops/surfaceraster.js';   // t1363 — the ONE reading of a stored stepover   // t1429 — and the ONE reading of which axes each clearing walk actually looks at, now that the pocket's macro IS that walk
import { stepoverMm } from '../wizards/ops/pocketfill.js';   // t1043 — the CANONICAL exported stepoverPct->mm: max(0.2, max(0.1,toolDia)*stepoverPct/100). surfacingWizard.js:24-27 computes the identical formula inline (its absent-param defaults differ — 12/60 vs 6/40 — but are unreachable when the op provides toolDia+pct); the seed test verifies surface stepover == the real surfacingStack value.
import { builtinTypeForTwin } from '../blocks/wizardLibrary.js';   // t1049 — the DECLARED twin->built-in bridge (inverts opensAs->type/variant). Real programs use data-op TWINS (user_surfacing_data …), not the bare built-in optypes.
import { getUserDef, camFieldsFromStack, flattenBlocks } from '../blocks/userOps.js';           // U2 — the LIVE def registry (template + bindings) for the UNIVERSAL fallback; t1095 — the block-native pendant-field rows (S2); t1101 — flatten for the S4b identity re-derive
import { classifyExposable } from './exposeClassifier.js';   // U1 — per-binding exposable/geometry classification for the universal seed
import { num } from '../wizards/ops/util.js';   // t1444 — the pack gates read numbers the same way every emitter does
import { slotTooSmall, slotToolRefusal, SLOT_CAM_PACK_REGS } from '../wizards/ops/slot.js';         // t1444 — the ONE too-small boundary + its sentence, shared with the emit   // t1512 — SLOT_CAM_PACK_REGS: the gate asks the envelope about the LIVE body the pack will emit, not the wizard's baked one
import { slotStackArmGap, slotPatterned, slotPatternPoints } from '../wizards/slotWizard.js';   // t1512 — the PACK arm asks the ATOM'S OWN envelope (never a bearing check here), so C5 lifts the angled case with no change to this file   // t1516 — …and the PATTERN is the wizard's own declaration too: a structure the atom cannot see, so the gate reads it rather than restating it
import { SLOT_ARM } from './opToSlot.js';   // t1512 — the declared arm names, so the variant string has one source
import { pocketToolRefuses, pocketToolRefusal } from '../wizards/pocketWizard.js';   // t1444 — …and the pocket's, from the same one source

// The clean 1:1 opType -> CAM generator type. pocket/drill are the DEFAULT arm; their variant arms are gated in camTypeOf.
export const OPTYPE_TO_CAM = { surfacing: 'surface', corner: 'corner', edge: 'edge', slot: 'slot', pocket: 'pocket', drill: 'drill' };

// ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// t1323 (USER SCREENSHOT) — THE TWO ENUM CLASSES. The param table walked only value fields, so a dropdown param had no row
// at all: on Surfacing, zMode (Normal | Skim) was simply MISSING, and the footer already promised enum support. But the two
// kinds of enum are not one feature — they differ in WHAT READS THE VALUE, and that decides everything else:
//
//   VALUE enum   (corner, wcs, axis, dir…)  the MACRO reads it as a number at RUN time → the pendant can hold it → the
//                                           full Expose treatment: a friendly label picks it, the slot stores its int.
//   BUILD enum   (zMode)                    it changes the PROGRAM'S SHAPE — the G91 wrap either exists in the emitted
//                                           macro or it does not. No number on a pendant can conjure a line that was
//                                           never built → BAKE-ONLY: pick the mode the slot bakes, Expose greyed WITH
//                                           its reason (postGating's rule: grey and say why, never hide).
//
// AND THE CLASS IS ALREADY DECLARED — it is not a new flag and not a guess. A def's binding carries `blockIndex`: the
// socket its value lands in. A STRUCTURAL binding has blockIndex == null, i.e. NO SOCKET — so there is physically nowhere
// for a runtime value to go; it can only fork the build. That is the whole distinction, already written down at every
// param, so this only names it.
// t1323 AMENDED (USER, live) — a build enum is NOT bake-only after all. It has THREE declared dispositions, because the
// macro can carry BOTH arms and jump between them on the pendant mirror numeral — the runtime-branch pattern the corner
// generator has always used (`IF #seq EQ 1 GOTO 20`), generalized:
//   BAKE            frozen at build; the slot contains ONE shape.                                   ← THE DEFAULT
//   EXPOSE AS VALUE the macro reads it as a number at run time (value enums only — they have a socket).
//   EXPOSE AS BRANCH the macro carries EVERY arm and IF/GOTOs on the mirror, so the shape is chosen AT THE MACHINE.
// DEFAULT = BAKE, per the user's ruling: a macro should not carry possibility-space unless someone asks for it. Branch
// is a per-param, per-slot OPT-IN, and it is REFUSED (with its reason shown) when the arms would bloat the macro.
export const BUILD_ENUM_REASON = 'changes the program shape — pick the shape the slot bakes, or expose it as a runtime branch';
// The arm budget: a branch duplicates the WHOLE op body once per arm, so 2–3 is a readable macro and more is bloat.
export const BRANCH_ARM_CAP = 3;
// t1414 — A ONE-ARM ENUM IS NOT REFUSED FOR SIZE, and saying so was its own small lie. The screenshot of the honest
// rows caught it: `material` (a single-option enum) read "1 arms would duplicate the program 1 times — too big for one
// macro", which is broken grammar carrying a wrong reason. There is nothing to branch BETWEEN, which is a different
// fact and the one the operator needs. Found while picturing this act's fix, and in exactly its class.
export const branchRefusal = (n) => (n < 2
    ? 'only one option — there is nothing to branch between; the slot bakes it'
    : `${n} arms would duplicate the program ${n} times — too big for one macro; bake the shape instead`);

/** The enum class of a def binding: 'value' (a socket carries it at runtime) | 'build' (no socket → it forks the build). */
export function enumClassOf(b) {
    if (!b || b.type !== 'enum') return null;
    return b.blockIndex != null ? 'value' : 'build';
}

/** A def's BUILD-TIME enums as table rows: {key,label,value,options:[{value,label}]}. `params` supplies the op's current
 *  pick (else the binding default). Empty for a def with no structural enums — which is every op but Surfacing today. */
/**
 * t1341 — THE ENTRY GATE. A ramp or helix descent has GEOMETRY, and part of that geometry is baked at build time
 * (the distance to the area centre, the rotation constants) because computing it live would need a square root or
 * trig the controller has not been verified to have — see wizards/ops/surfaceraster.js.
 *
 * That baking is exactly right on the WIZARD path: the text is fixed at build values and stays consistent forever.
 * It is NOT safe under a pendant. If an operator dials the stepover-% or the stepdown on a slot whose entry ramps,
 * the raster re-derives around a descent that does not — a KINKED entry, and a possible gouge. So a slot with a
 * ramp or helix entry marks exactly those two knobs BAKE-ONLY, with the reason on the control, and a plunge-entry
 * slot keeps them fully exposable because a straight plunge has no geometry to kink.
 *
 * The improvement turn (pendant-true entries: the +X declared run vector, or live SQRT once V13 settles it) is what
 * LIFTS this gate, and it does so with its own proof rather than by relaxing this one.
 */
export const ENTRY_GEOMETRY_KNOBS = ['stepoverPct', 'stepdown'];
export const ENTRY_GATE_REASON = 'changes the entry geometry, which this descent bakes at build — baked when built';
/**
 * t1483 (C4) — ⚠ THE RAMP CAME OFF THIS GATE, and it came off because the reason for it stopped existing rather than
 * because the gate got friendlier. A ramp used to bake its distance to the area centre, so an operator dialling the
 * stepover on a ramped slot left the descent stale against a raster that re-derived — a kinked entry, possibly a
 * gouge. The declared run vector retired that: `SURFACE_RASTER_BAKES`'s two ramp rows are EMPTY and the run is
 * compared against a live span register, so there is nothing left for a pendant to outrun.
 *
 * THE HELIX STAYS, and keeping the gate NARROW is the whole point — it still bakes the rect inradius that clamps its
 * radius and seeds the rotating vector (t1343). Widening this to "any descent" would have been easier to write and
 * would take away knobs that are now provably safe.
 */
export const entryHasGeometry = (params) => ((params && params.entry) || 'plunge') === 'helix';

/**
 * ── t1512 — THE SLOT'S PACK ARM, RESOLVED FROM THE ATOM'S ENVELOPE ────────────────────────────────────────────────
 *
 * ONE predicate, read by `camTypeOf`'s gate, by the variant the manifest stores, by the honesty rows and by the field
 * seed — so the table an operator is looking at, the arm that gets built and the sentence that explains it cannot say
 * three different things. It delegates to `slotStackArmGap`, which is the WIZARD's own arm question, which ends at
 * `surfaceRasterCovers`. Nothing here knows what a bearing is, and that is the point.
 */
export const slotPackGap = (params) => slotStackArmGap(params || {}, SLOT_CAM_PACK_REGS);
/** '' → the PACKED (atom) arm; anything else → the literal centreline arm, with the gap as its reason. */
export const slotPackArm = (params) => (slotPackGap(params) ? SLOT_ARM.centreline : SLOT_ARM.atom);

/**
 * The refusal for a WIDE slot the atom cannot walk: the ATOM'S OWN reason, verbatim, plus the exit — t1444's rule,
 * because an operator told "unsupported" with no exit does the wrong thing next.
 *
 * ⚠ IT ADDS NO REASON OF ITS OWN, and the first version's mistake is worth keeping written down: it appended "an ANGLED
 * slot waits on C5" to whatever gap came back, so a PATTERNED slot got told about bearings — a true sentence answering
 * a question nobody asked, which is how t1414's wrong-reason defect looked too. Each refusal names its own pending
 * capability where it is declared (the atom's bearing gap does), so this only frames it and points at the exit.
 */
export const slotWideRefusal = (p, gap) => `this slot is ${num(p.width, 0)}mm wide, so its clearing has to be the `
    + `parametric raster atom, and this configuration is outside what that atom can walk. ${String(gap).replace(/\s*$/, '').replace(/([^.])$/, '$1.')} `
    + `Build this one from the Slot wizard, which emits the full walk at any width and any angle.`;

/**
 * ── t1516 — THE LITERAL ARM'S SILENT PATTERN DROP, CLOSED. A DIFFERENT PART, NOT A REDUCED ONE ────────────────────
 *
 * MEASURED, on the released build: a slot op with `pattern: 'grid', cols: 3, rows: 2` and a width at or under its tool
 * packed a CAM slot and returned `camType: 'slot'` — and the generator emits ONE slot body. Six slots drawn, one cut,
 * no message, and the seeded field table shows `ax/ay/bx/by/depth/…` with no pattern row for the operator to notice
 * was missing. It has been true since the slot generator existed, and t1512 named it rather than inheriting it
 * quietly: the PACKED arm already refuses (a wide patterned slot gets `slotWideRefusal` carrying the pattern gap),
 * so the hole was exactly the narrow-slot half. RULED at t1515: the literal arm refuses too.
 *
 * ⚠ AND THE CONDITION IS **NOT** "IS IT PATTERNED", which is the version I wrote first and then measured. A pattern
 * resolves to a point LIST, and the generator's one slot is the right part exactly when that list is a single point
 * AT THE ORIGIN. Measured over the four pattern kinds:
 *
 *     grid 3×2 → 6 points, first {0,0}      grid 1×1 → 1 point,  {0,0}   ← the single slot IS the part: no refusal
 *     line 4   → 4 points, first {0,0}      line 1   → 1 point,  {0,0}   ← likewise
 *     circle 6 → 6 points, first {40,0}     circle 1 → 1 point, {40,0}   ← ONE slot, and the WRONG PLACE
 *
 * So a bolt-circle of one is a real failure a count test would have missed, and a 1×1 grid is a real success a
 * `slotPatterned` test would have refused. Refusing what is actually correct is the same defect class as packing what
 * is not — "every clause a NARROWING" (slotRasterArmGap's own rule), and the narrow clause is the measured one.
 *
 * ⚠ THE TWO FAILURES GET THEIR OWN SENTENCES, which is t1414's lesson applied before it could bite: "1 slots would be
 * dropped" is broken grammar carrying a wrong reason, and an offset single is not a dropped anything.
 */
export const slotPatternPack = (p = {}) => {
    if (!slotPatterned(p)) return null;                 // not a pattern at all — the wizard's own predicate decides
    const pts = slotPatternPoints(p) || [];
    if (pts.length === 1 && !num(pts[0].x, 0) && !num(pts[0].y, 0)) return null;   // one instance, on the drawn line
    return { n: pts.length, kind: String(p.pattern || 'pattern') };
};
export const slotPatternRefusal = (p) => {
    const s = slotPatternPack(p) || { n: 0, kind: 'pattern' };
    const exit = ' Build this one from the Slot wizard, which stamps every instance of the pattern.';
    return s.n > 1
        ? `this op draws ${s.n} slots in a ${s.kind} pattern, and a CAM slot's macro emits ONE. Packing it would cut a `
            + `single slot and silently drop the other ${s.n - 1} — a different part, not a smaller one.${exit}`
        : `this op draws its one slot OFF its own A→B line (a ${s.kind} pattern places it at the pattern's first `
            + `point, not at A), and a CAM slot's macro emits one slot ON that line. Packing it would cut the right `
            + `slot in the wrong place.${exit} Or clear the pattern and move A/B to where the slot belongs.`;
};

/**
 * ⚠ THE PENDING CAPABILITY, DECLARED AS DATA AND NOT BUILT (t1515's ruling). A pattern-emitting CAM slot is a real
 * act with its own bridge; recording what it would need costs nothing and stops the refusal above from reading as a
 * permanent law, which is the distinction `SLOT_ARC_NOT_INCLUDED` draws between a TEACHABLE gap and an evidence-blocked
 * one. This one is teachable — nothing here is waiting on the controller.
 */
export const SLOT_PATTERN_PACK_GAP = {
    what: 'a CAM slot packs ONE slot body; a patterned slot op asks for N at declared offsets',
    whyRefusedRatherThanDegraded: 'cutting one slot where N were drawn is a DIFFERENT PART. The gate-1 rule is that '
        + 'clean-looking G-code cutting the wrong part is the worst failure this project has, and a silent degrade is '
        + 'exactly that shape — the operator sees a complete-looking macro and a table with no pattern row in it',
    whatALiftWouldNeed: 'the offsets are already declared and already build-time (`slotPatternPoints` — no controller '
        + 'arithmetic, so this is NOT trig- or V13-gated). What is missing is an emit: the macro would wrap its body '
        + 'in a per-instance loop over a baked offset list, which is the shape `opToSlot`\'s drill/bore patterns '
        + 'already emit (PATTERN_FIELDS + loopBody) — so the lift is teaching the SLOT generator that same loop, with '
        + 'the walked body inside it, plus a bridge asserting instance N lands on point N',
    whyNotFoldedIntoThisAct: 'it is an EMIT act with its own bridge and its own register question (the loop counter '
        + 'must clear the atom\'s band), and this one is an honesty act. t1515 ruled the refusal in and the lift out',
};

/**
 * ⚠ THE SYNTHETIC DISCRIMINATORS THAT RE-RESOLVE EACH ARM, declared BESIDE the resolver that reads them.
 *
 * `toManifest` drops the source op's params, so `manifestToAuthOp` re-derives just enough to land on the same arm
 * (`CAM_SEED_PARAMS`, t1127). For the slot that means a params seed whose ARM is the stored one — and the pair below is
 * asserted ROUND-TRIP (`slotPackArm(SLOT_ARM_SEED[a]) === a` for both arms) so a future envelope change that moved one
 * of them onto the other arm fails a test instead of silently re-hydrating a saved slot onto the wrong body.
 */
export const SLOT_ARM_SEED = {
    atom: { ax: 0, ay: 0, bx: 60, by: 0, width: 12, toolDia: 6, entry: 'plunge' },        // wide, bearing 0 → the atom walks it
    centreline: { ax: 0, ay: 0, bx: 60, by: 0, width: 6, toolDia: 6, entry: 'plunge' },   // the ZERO BAND → one centreline pass
};

/**
 * ── t1414 — WHAT A PER-TYPE GENERATOR'S MACRO DOES **NOT** CARRY, declared ────────────────────────────────────────
 *
 * A build enum appears in the slot's table as a greyed, informative row, and this file's own rule for it is: *"the row
 * states the shape being built and stays greyed — informative, never a control that lies."* For pocket it lied.
 * Measured at t1412: `pocketSlot`'s packed body is BYTE-IDENTICAL for `strategy: 'spiral'` and `'raster'`, and
 * identical again for `direction: 'bothways'` and `'oneway'` — the macro is one hand-written raster+wall — while the
 * table displayed the operator's pick beside it. So a concentric pocket packed a slot that cuts a raster, and the
 * surface said "Spiral". Same class as t1402's ring defect: asked for one thing, machine does another, surface agrees
 * with the request.
 *
 * ONE SOURCE FOR THE SENTENCE, keyed by (camType, param), so every consumer of `buildEnumFields` says the same thing
 * and a reader can see the whole set of divergences in one place instead of inferring it from nine macros.
 *
 * ⚠ THIS TABLE IS A STATEMENT ABOUT A MACRO, AND IT IS LOCKED TO ONE. `tests/cam-row-honesty-1414.spec.js` builds each
 * generator at each arm of each build enum and requires the two to agree BOTH WAYS: a param listed here must produce
 * an IDENTICAL body across its arms (or the row is now under-claiming — the macro grew a capability and the table
 * hides it), and a param NOT listed must produce a DIFFERENT one (or a new liar has appeared). So when the ruled
 * C-act lands and the clearing body delegates to the atom, this spec goes RED and the row must come out. The row can
 * never lag the macro in either direction, which is the only version of "honest" that survives the next act.
 */
/**
 * ── t1429 — A DISPOSITION CAN DEPEND ON ANOTHER PICK, and the pocket is where that became true ────────────────────
 *
 * `direction` is carried by the RASTER walk and meaningless to the CONCENTRIC one — rings have no scan direction, and
 * the atom has declared that asymmetry since t1418 (`SURFACE_RASTER_AXES.concentric` simply omits the axis, precisely
 * so the envelope table cannot grow six rows nobody measured). The CAM row has to say the same thing or the two will
 * drift, so it READS that declaration rather than restating it — and a table entry may therefore be a FUNCTION of the
 * op's params, resolved through `generatorIgnores`/`generatorBakesPick` and never by looking the key up raw.
 *
 * The sentence follows the t1410 pattern: a row that cannot carry a pick says WHICH setting to change to get it back.
 */
const pocketReadsDirection = (p) => (SURFACE_RASTER_AXES[String((p || {}).strategy) === 'spiral' ? 'concentric' : 'parallel'] || []).includes('direction');

export const GENERATOR_IGNORES = {
    // t1429 — `pocket.strategy` CAME OUT, and the red-then-green is this act's proof. The row said *"a Spiral pick is
    // NOT carried into it — the pack builds the raster either way"*, which was true of a hand-written raster and is a
    // lie about a body that delegates to the atom. The lock in cam-row-honesty-1414 went red on the delegation commit
    // (the macro grew the capability, so the table was hiding it) and green again when this line was deleted —
    // which is the whole reason that spec asserts BOTH directions. `cpocket` stays: its macro is still `ringClear`.
    // The three picks the pocket now carries are declared in GENERATOR_BAKES_PICK below, because "carried" and
    // "branchable" are different claims and collapsing them is how the row would start lying the other way.
    pocket: {
        // …and ONE of them is carried conditionally, which the lock caught on the first run: with the SPIRAL strategy
        // the packed body is identical across all three direction arms, because rings have no scan direction. The
        // honest row is therefore per-pick rather than per-generator.
        direction: (p) => (pocketReadsDirection(p) ? ''
            : 'This slot\'s macro cuts a CONCENTRIC-RING clear, and rings have no scan direction — a Zig-zag / One-way pick is NOT carried into it. Set Strategy to Raster and this pick starts driving the walk.'),
    },
    // The SWEEP that came with this fix found three more of the same class — reported rather than assumed, and each
    // sentence names what its macro actually does rather than what its row promised.
    cpocket: {
        strategy: 'This slot\'s macro cuts a CONCENTRIC-RING clear, layer by layer. A Raster pick is NOT carried into it — the pack builds the rings either way.',
    },
    corner: {
        travelApproach: 'This slot\'s macro always AUTO-TRAVERSES between the two walls — it emits the move itself, with no operator reposition pause. A Manual pick is NOT carried into it.',
        travelShape: 'This slot\'s macro traverses on ONE fixed path, emitted the same way for every pick. A different travel-shape pick is NOT carried into it.',
    },
};

/**
 * ── WHAT THE SWEEP CLEARED, and why each stayed out of the table (measured, not assumed) ──────────────────────────
 *   corner.corner · corner.wcs · edge.axis · edge.dir · edge.wcs   the body genuinely DIFFERS per arm — carried.
 *   corner.probeSeq                                                carried WITHOUT changing the body: the generator
 *                                                                  owns a `seq` VALUE field the macro reads as a
 *                                                                  number at run time. A body-only criterion called
 *                                                                  this a liar on the first run; conflating the two
 *                                                                  mechanisms is exactly how a sweep invents work.
 *   surface.zMode                                                  out of scope: `camTypeOf` forks skim to the
 *                                                                  UNIVERSAL arm, so this generator is never asked
 *                                                                  for that arm. The fork is the honesty.
 *   pocket.direction                                               NOT a build enum at all — it binds to a socket on
 *                                                                  the fill leaf, so the rect pocket's table has no
 *                                                                  direction row to lie with. (I had declared one
 *                                                                  here and removed it: a sentence nothing reads is
 *                                                                  worse than no sentence, because it looks handled.)
 */

/** The declared sentence for a (camType, param) the generator's macro ignores, or '' when it carries it. */
// t1429 — an entry may be a FUNCTION of the op's params (see `pocketReadsDirection`), so it is always RESOLVED here.
// A caller that reads the table key directly gets a truthy function and calls every conditional row a liar; the
// cam-row-honesty sweep did exactly that on the first run, which is why the resolver is the only supported reading.
export function generatorIgnores(camType, param, params) {
    const e = GENERATOR_IGNORES[camType] && GENERATOR_IGNORES[camType][param];
    return (typeof e === 'function' ? e(params || {}) : e) || '';
}

/**
 * ── t1429 — WHAT A GENERATOR **BAKES** FROM THE OP'S PICK. The third disposition, declared ────────────────────────
 *
 * t1323 named three dispositions for a pick — BAKE, EXPOSE AS VALUE, EXPOSE AS BRANCH — and only two of them had a
 * declaration. "Carried" was inferred from the ABSENCE of a GENERATOR_IGNORES row, which conflates two different
 * facts, and the pocket delegation is what made the conflation bite in BOTH directions at once:
 *
 *   1. `direction` and `entry` are VALUE enums on the def (they bind to a socket on the fill leaf), so
 *      `buildEnumFields` never made a row for them and the pocket table had nothing to say about picks its macro now
 *      genuinely bakes. Honest-by-omission was the right reading while the macro ignored them (t1414 measured that and
 *      deliberately removed a sentence it had drafted); it stops being right the moment the macro carries them.
 *   2. `strategy` leaving GENERATOR_IGNORES would have made it BRANCHABLE — `branchable` is gated on `!ignored` — so
 *      the row would offer *"Expose as a BRANCH: the macro carries every arm and jumps on the pendant number"*, which
 *      is precisely what a BAKED pick does not do. Removing one lie would have installed another in its place.
 *
 * So the fact is declared positively, keyed (camType, param), in the words the operator can act on: the slot contains
 * the shape you picked, and picking differently means building a different slot. A baked pick is CARRIED (no
 * GENERATOR_IGNORES row — the body really does differ per arm, which cam-row-honesty asserts) and NOT branchable.
 */
export const GENERATOR_BAKES_PICK = {
    pocket: {
        strategy: 'BAKED into this slot: the pack builds the clearing walk you pick here — Spiral (concentric) cuts rings inward with no separate wall pass, Raster cuts parallel passes then a wall finish. The macro contains ONE of them, so a different pick means building a different slot.',
        direction: (p) => (pocketReadsDirection(p)
            ? 'BAKED into this slot: Zig-zag links its passes at depth; One-way lifts, rapids back and re-plunges for every pass so the cut direction stays consistent. The macro contains ONE of them.'
            : ''),   // …and on the SPIRAL arm it is not baked at all — it is ignored, and GENERATOR_IGNORES says so
        /**
         * ⚠ t1487 — THIS SENTENCE WAS TOLD TO AN OPERATOR AND HALF OF IT STOPPED BEING TRUE, which this project
         * treats as a gate-1 defect rather than a wording nit (t1404's collapse guard got its own label for exactly
         * this reason). It read "a ramp/helix pick degrades to a plunge". After C4 (t1483/t1485) a RAMP runs along
         * its own pass against LIVE span registers with its start on the live row register — it bakes nothing, so it
         * is packed as a REAL ramp. The HELIX is unchanged: it still bakes the rect inradius that clamps its radius
         * (t1343), so it still degrades and still says so.
         *
         * It becomes a FUNCTION of the pick, which is the shape `direction` one line above already uses — the row
         * says what THIS slot does, rather than one sentence covering two descents that no longer behave alike.
         */
        entry: (p) => (String(p && p.entry) === 'helix'
            ? 'BAKED into this slot: a Helix computes its geometry from a fixed area — the rect inradius clamps its radius — and this slot\'s area is a pendant knob, so a helix pick degrades to a plunge, and the macro SAYS so on the line where it descends.'
            : 'BAKED into this slot: the pack descends the way you pick here. A straight PLUNGE and a RAMP are both pendant-true — the ramp runs along its own pass against the live area registers, so dialling the area re-derives it (C4) — while a HELIX still bakes the inradius that clamps its radius, so a helix pick degrades to a plunge and the macro says so where it descends.'),
    },
    /**
     * ── t1512 — THE SLOT'S DEPTH ENTRY, AND THE HONESTY LOCK CORRECTED MY FIRST ANSWER ────────────────────────────
     *
     * I first declared this pick IGNORED on the literal arm, reasoning that `STANDALONE.slot.body` plunges straight down
     * whatever was picked — which is true of the DESCENT and false of the macro. The lock (cam-row-honesty-1414) went
     * red and was right: the bodies genuinely DIFFER across the arms, because a HELIX pick trips `entryHasGeometry` and
     * freezes Stepdown/Stepover into literals. So the pick reaches the macro on both arms; what differs is WHAT it
     * reaches, and a row claiming "not carried" would have been a second lie in the space of the first.
     *
     * Declared BAKED on both arms with the sentence that matches the arm, keyed on the same `slotPackGap` the pack arm
     * itself is chosen by, so the row and the built body cannot disagree. This is the shape `direction` above already
     * uses — a disposition that is a function of the op's own params.
     */
    slot: {
        entry: (p) => (slotPackGap(p)
            ? 'BAKED into this slot: this macro cuts ONE CENTRELINE PASS per level and always plunges straight down, so a Ramp or Helix pick does not change how it descends — though a Helix does freeze the Stepdown and Stepover knobs, because the pack cannot let a pendant re-derive around a descent it baked. '
                + `A real descent is carried by the parametric raster atom, and this slot's clearing cannot ride it: ${slotPackGap(p)} Widen the slot past its tool and the pick starts driving the entry.`
            : 'BAKED into this slot: its clearing IS the parametric raster atom, which carries the descent you pick here — a straight PLUNGE, or a RAMP along the slot\'s own length against the live registers (C4, so dialling the width or the stepover re-derives it). The macro contains ONE of them. A HELIX is not offered on this arm: it wants the entry end clamped to the slot width, which the atom does not do, so a helix slot keeps the wizard.'),
    },
};

/** The declared sentence for a (camType, param) the generator BAKES from the op's pick, or '' when it does not. */
export function generatorBakesPick(camType, param, params) {
    const e = GENERATOR_BAKES_PICK[camType] && GENERATOR_BAKES_PICK[camType][param];
    return (typeof e === 'function' ? e(params || {}) : e) || '';
}

/** Is this param declared as a pick the generator bakes AT ALL (whatever the current arms resolve to)? */
export const generatorPicksParam = (camType, param) => !!(GENERATOR_BAKES_PICK[camType] && GENERATOR_BAKES_PICK[camType][param]);

export function buildEnumFields(def, params, camType) {
    const p = params || {};
    // t1429 — a BUILD enum has no socket, so it can only fork the build and always belongs here. A declared BAKED PICK
    // is a VALUE enum the generator nevertheless bakes, so it belongs here TOO — and it is taken once, from the binding
    // that DECLARES it (the one carrying the dropdown's options): a param is commonly bound twice, once at the wizard
    // leaf that declares it and once at the atom that consumes it, and the second is wiring with no options to offer.
    const seen = new Set();
    return ((def && def.bindings) || []).filter((b) => {
        if (!b || b.type !== 'enum' || seen.has(b.param)) return false;
        const build = enumClassOf(b) === 'build';
        // the ROW's existence is unconditional (`generatorPicksParam`), even where the SENTENCE is conditional: a row
        // that appeared only on the arm that carries it would vanish exactly when the operator needs to be told why.
        if (!build && !(camType && generatorPicksParam(camType, b.param))) return false;
        if (!build && !((b.widgetConfig && b.widgetConfig.options) || []).length) return false;
        seen.add(b.param);
        return true;
    }).map((b) => {
        const ignored = camType ? generatorIgnores(camType, b.param, p) : '';
        const bakedPick = camType ? generatorBakesPick(camType, b.param, p) : '';
        const opts = ((b.widgetConfig && b.widgetConfig.options) || []).map((o) => Array.isArray(o) ? { value: o[1], label: o[0] } : { value: o, label: String(o) });
        const value = (p[b.param] !== undefined && p[b.param] !== '') ? p[b.param] : b.default;
        const arms = opts.length ? opts : [{ value: b.default, label: String(b.default) }];
        // BRANCHABLE = the arms fit the budget. Not branchable → Expose greyed with the REFUSAL as its reason (never
        // hidden: postGating's rule). Branchable → Expose is offered but NOT preselected; `exposed:false` is the
        // declared default, so a slot only carries both arms when someone deliberately ticks it.
        // t1414 — A PICK THE MACRO IGNORES CANNOT BE BRANCHED EITHER, and that is not a second decision: branching
        // means "the macro carries every arm and jumps on the pendant number", which is precisely what a macro that
        // ignores the pick does not do. Offering Expose here would have been a second lie stacked on the first.
        // t1429 — …and neither can a pick the pack BAKES, for the same reason stated the other way round: the macro
        // carries exactly ONE arm, chosen at build. Offering the branch radio would be a control that does nothing.
        const branchable = arms.length > 1 && arms.length <= BRANCH_ARM_CAP && !ignored && !bakedPick;
        return { key: b.param, label: b.label || b.param, def: b.default, value, units: '', type: 'enum',
            buildEnum: arms, branchable,
            exposed: false, exposable: branchable, bakeable: true,
            _exposeTip: ignored || bakedPick || (branchable ? 'Expose as a BRANCH: the macro carries every arm and jumps on the pendant number, so the shape is chosen at the machine' : branchRefusal(arms.length)),
            ...(ignored ? { _notCarried: ignored } : {}),
            ...(bakedPick ? { _bakedPick: bakedPick } : {}),
            _branch: true };
    });
}

// t1175 AUTO-GLYPH — camType (camTypeOf) -> the tileset glyph id (web/assets/svg/tileset.svg) that pictures that op. A fresh
// CAM slot's default icon is this glyph, centred, with no name text. An unmapped camType (e.g. substack) resolves to null →
// the icon editor falls back to the slot-name text, so it never breaks.
export const CAMTYPE_GLYPH = {
    surface: 'surface', corner: 'corner', edge: 'edge', slot: 'slot',
    pocket: 'pocket_rect', cpocket: 'pocket_round', drill: 'drill', bore: 'bore',
    inside: 'probe_center', boss: 'boss_round', universal: 'contour',
};
// t1177 Part D — the FULL op -> glyph resolver (advisor synthesis, "wire by opType"): camType WINS for the 8 generators +
// inside/boss (a BOSS middle stays boss_round — opType never overrides it); a UNIVERSAL op falls to its specific opType glyph,
// else contour. OPTYPE_GLYPH is free inert data, so every auto-only glyph is wired — alignment works today, the rest
// auto-produce once their op becomes a CAM slot.
export const OPTYPE_GLYPH = { alignment: 'align_two', homing: 'home', rotary_center: 'rotary_axis', rotary_clock: 'clock_dial', atc_change: 'tool_change', atc_table: 'tool_table', tap: 'tap', text: 'engrave', contour: 'contour', middle: 'probe_center' };
export function glyphForOp(op) {
    if (!op) return null;
    // An AUTHORING op carries its already-resolved camType/universal but NOT params (a fresh camTypeOf would misresolve
    // pocket-shape / drill-method → regress cpocket→pocket_round, bore→bore), so use the stored values when present; else
    // derive from a raw program op.
    const r = (op.camType != null || op.universal != null) ? { camType: op.camType, universal: !!op.universal } : camTypeOf(op);
    if (!r.universal && r.camType) return CAMTYPE_GLYPH[r.camType] || null;
    return OPTYPE_GLYPH[baseOf(op.opType).baseType] || CAMTYPE_GLYPH.universal || null;
}

// The op types the S1c picker should offer (each has at least one working arm). Per-op variants may still be unsupported
// (seedFromOp returns {unsupported}): pocket polygon/ellipse, drill pattern 'single', middle single-axis. contour excluded.
export const SUPPORTED_OPTYPES = ['pocket', 'surfacing', 'corner', 'edge', 'slot', 'drill', 'middle'];
// Accepts a built-in opType OR a data-op twin (user_*_data) — normalized via the declared bridge (defined below). U2 —
// widened past the 8 premium generators: ANY op with a registered def (every user_* twin/fork) is CAM-able via the universal
// unroll path, so the picker offers EVERY op. A generator arm stays the PREMIUM path for the 8 standard shapes (camTypeOf).
export const isCamableType = (opType) => SUPPORTED_OPTYPES.includes(baseOf(opType).baseType) || !!getUserDef(opType);

// t1073 — is this opType a data-op TWIN of one of the 8 CAM-generator ops (surfacing/pocket/corner/edge/slot/drill/bore/middle)?
// The DECLARED "Customize as blocks" affordance-gate (op menu / wizard list / CAM builder): only these forkable-into-a-sub-unit
// twins surface a Customize entry (not the other ~17 opensAs twins: comm/wcs/homing/atc/…). Base-type membership, so it is
// params-INDEPENDENT (all 8 surface) — editWizardDef then wraps the ones whose DEFAULT variant is a live generator
// (surfacing/pocket/corner/edge/slot); drill/bore/middle default to a universal variant (t1069 Finding 2) → a plain fork.
export function isCamGeneratorTwin(opType) {
    const t = builtinTypeForTwin(opType);   // {type, variant} for a data-op twin (opensAs target), null otherwise
    return !!t && (SUPPORTED_OPTYPES.includes(t.type) || t.type === 'bore');
}

// PARAM_ALIAS[camType] = { generatorFieldKey: opParamsKey } — ONLY the renames; unlisted keys alias to themselves.
// (Grounded from the op.params bare keys + the generator SPECs. stepover has NO op source — pocket/surface store
//  stepoverPct (%) — so it is intentionally UNLISTED: it stays unseeded and shows the generator default until a
//  toolDia*%/100 derivation lands. See the pass note value-semantics.)
// An alias value may be a STRING (one op key) or an ARRAY of candidate keys (first present wins) — the built-in + its
// data-op twin can name the SAME field differently (corner: built-in `probeZ`, twin `probeZFirst`).
export const PARAM_ALIAS = {
    corner: { seq: 'probeSeq', maxProbe: 'dist', travel: 'travelDist', scan: 'scanDepth', fast: 'f_fast', slow: 'f_slow', probeZ: ['probeZ', 'probeZFirst'] },
    edge: { maxProbe: 'dist', fast: 'f_fast', slow: 'f_slow' },
    surface: {},
    pocket: {},
    cpocket: {},
    slot: {},
    // t1051 — posX/posY = the op's PLACED position (originX/originY), NOT the pattern-local origin x0/y0 (default 0). The
    // drill/bore CAM slot runs at the WCS origin with posX/posY as the pattern anchor + has NO separate #20/#21 offset, so
    // it must carry the placement. x0/y0 structurally cancels through the placement datum-corner attach (grounded), so
    // originX alone is right (never originX+x0). The fallback ['originX','x0'] keeps the built-in path identical (drillView
    // force-sets x0===originX). CAVEAT flagged to the advisor: a CIRCLE pattern's centre-vs-min-corner MAY differ by dia/2 —
    // not fixed here (the built-in centres the circle at originX, so it's ambiguous; the x0->originX fix is certain).
    drill: { posX: ['originX', 'x0'], posY: ['originY', 'y0'] },
    bore: { posX: ['originX', 'x0'], posY: ['originY', 'y0'] },
    inside: { maxProbe: 'dist', fast: 'f_fast', slow: 'f_slow' },   // middle -> inside; middle op stores dist/f_fast/f_slow
    boss: { maxProbe: 'dist', fast: 'f_fast', slow: 'f_slow' },     // middle -> boss (op has no plain safeZ -> generator default)
};

// DERIVE[camType][fieldKey] = (op.params) -> value. For fields with NO direct op source (pocket/surface/cpocket store
// stepoverPct %, the generator wants absolute stepover mm). Mirrors the wizard one-source via the exported stepoverMm.
const DERIVE = {
    // t1429 — the rect pocket's field is the PERCENTAGE now (the macro derives the mm, as the surface slot has since
    // t1325), so its seed reads the op's own intent through the SAME one source instead of pre-multiplying it into a
    // millimetre the atom would only have to divide back out. `cpocket` is untouched: `ringClear` still steps in mm.
    pocket: { stepoverPct: (p, toolDia) => stepoverPctOf(p, toolDia) },
    cpocket: { stepover: stepoverMm },
    // surfacing: the BUILT-IN op stores stepoverPct+toolDia (derive); the data-op TWIN precomputes a FLAT `stepover` and has
    // NO stepoverPct/toolDia (surfacingData.js) — so use the flat value if present, else derive. Mirrors surfacingWizard.js:27.
    // t1325 — the surface generator's field is now the PERCENTAGE (the mm is derived in its macro header). Seeding it
    // reads the op's own intent where the op has it (the built-in stores stepoverPct), and RECOVERS it from the twin's
    // flat mm where it does not — pct = mm / toolØ · 100, computed ONCE here rather than left to drift.
    // t1363 — ONE SOURCE: this now CALLS the atom's declared `stepoverPctOf` instead of restating it. The recovery
    // still runs against the tool Ø the SLOT will actually carry (the op's, else the generator field's own default),
    // which is what the override argument is for — recovering against anything else changes the cut: a 9.6mm stepover
    // is 80% of the Ø12 default, and calling it 60% would quietly widen the raster.
    // ONE BEHAVIOUR CHANGE, deliberate: a typed `stepoverPct` of 0 used to be treated here as ABSENT and silently
    // replaced by 60, while both emitters treated it as a real zero and let the program refuse at its own
    // `IF #44 <= 0 GOTO 91` guard. That was the dual reading; the emitters' rule wins, because a silent 60 is a
    // raster the operator never asked for and a loud refusal is not.
    surface: { stepoverPct: (p, toolDia) => stepoverPctOf(p, toolDia) },
};

// NON_BAKEABLE[camType] = generator field keys that MUST be Expose-only (Bake greyed). t1047 amend (user + advisor
// verified): CHOICE params (corner/wcs/axis/seq/probeZ/dir) ARE BAKEABLE — every probe/mill field appears only in IF
// CONDITIONS, arithmetic, or #var assignments (never as a GOTO/label TARGET), so a baked valid literal CONSTANT-FOLDS to
// valid G-code (e.g. corner=1 → `IF 1 EQ 2 THEN …` = an always-false no-op; the signs resolve correctly). The enum
// dropdown / numeric min-max CONSTRAINS the baked value to valid options + the live preview confirms it before save
// (valid-by-construction), so the dropdown serves BOTH expose and bake. Motive: authors bake a choice to make a
// single-purpose, clearly-illustrated slot (four clean FL/BL/BR/FR slots vs one ambiguous icon). Only a param that
// STRUCTURALLY breaks when literalized would stay here — none of the CAM params do. surface's numeric validity guards
// (IF x LE 0 GOTO error) are kept Expose-only for now (they'd fold safely too — flagged to the advisor).
export const NON_BAKEABLE = {
    surface: ['stepover', 'stepdown', 'toolDia', 'clearance'],
};

// S1d — ENUM options per field key (shared across generators: corner/wcs/axis mean the same everywhere). GROUNDED
// one-source (t1047, do NOT invent): the friendly `label` + the program-op `op` value come from the wizard defs
// (cornerData.js:186/190/191, wizardOptions.WCS_OPTIONS, index.html p_axis/p_dir); the CAM `value` (int) is the macro's
// branch convention (probeToSlot.js field legends "1FL 2FR 3BL 4BR" etc. + the IF corner EQ 2 THEN … macro bodies). The
// wizard value ORDER matches the CAM int order in every case (positional). corner is 1-based; the rest 0-based.
export const ENUM_OPTIONS = {
    corner: [{ label: 'Front-Left', value: 1, op: 'FL' }, { label: 'Front-Right', value: 2, op: 'FR' }, { label: 'Back-Left', value: 3, op: 'BL' }, { label: 'Back-Right', value: 4, op: 'BR' }],
    wcs: [{ label: 'Active', value: 0, op: 'active' }, { label: 'G54', value: 1, op: 'G54' }, { label: 'G55', value: 2, op: 'G55' }, { label: 'G56', value: 3, op: 'G56' }, { label: 'G57', value: 4, op: 'G57' }, { label: 'G58', value: 5, op: 'G58' }, { label: 'G59', value: 6, op: 'G59' }],
    probeZ: [{ label: 'No', value: 0, op: false }, { label: 'Yes', value: 1, op: true }],
    seq: [{ label: 'Y then X', value: 0, op: 'YX' }, { label: 'X then Y', value: 1, op: 'XY' }],
    axis: [{ label: 'X', value: 0, op: 'X' }, { label: 'Y', value: 1, op: 'Y' }],
    checkAxis: [{ label: 'X', value: 0, op: 'X' }, { label: 'Y', value: 1, op: 'Y' }],
    dir: [{ label: 'Positive', value: 0, op: 'pos' }, { label: 'Negative', value: 1, op: 'neg' }],
};

/** The generator's field list for a CAM type (one-source: read the SPEC keys off the generator itself, no duplication). */
function genFieldsFor(camType, params) {
    const GEN = { corner: cornerSlot, edge: edgeSlot, surface: surfacingSlot, pocket: pocketSlot, cpocket: circlePocketSlot,
        zprobe: probeZSlot, inside: insideCentreSlot, boss: bossCentreSlot, align: alignmentSlot };
    if (GEN[camType]) return GEN[camType](new Set(), 0).fields;
    // t1512 — the slot's field list is PER ARM (the packed arm's #2600 layout gains width/toolDia/stepover%/plunge and
    // loses the endpoints), so the arm is resolved from the op's own params rather than assumed to be the literal one.
    if (camType === 'slot') return slotFromOp('slot', slotPackArm(params), new Set(), 0).fields;
    if (camType === 'drill' || camType === 'bore') return slotFromOp(camType, params.pattern || 'circle', new Set(), 0).fields;
    return [];
}

/**
 * Resolve a program op to its CAM generator type. Returns { camType } for a clean mapping, or { unsupported: reason }
 * for a gated variant / excluded op. PURE — reads only op.opType + op.params.
 */
// t1049 — normalize a program op's opType to its built-in base type (+ variant). A DATA-OP TWIN (user_*_data — what real
// programs are built from) resolves via the declared opensAs bridge; a built-in op passes through. So camTypeOf/isCamableType
// work on the twins users actually insert, not just built-ins.
function baseOf(opType) {
    const twin = opType && builtinTypeForTwin(opType);   // null for a built-in / unknown opType
    return twin ? { baseType: twin.type, variant: twin.variant } : { baseType: opType, variant: undefined };
}

export function camTypeOf(op) {
    const p = (op && op.params) || {};
    const { baseType: t, variant } = baseOf(op && op.opType);
    switch (t) {
        case 'surfacing':
            // t1323 — the BUILD enum decides the ARM. surfacingSlot emits ONE fixed macro shape (absolute, WCS-referenced);
            // Skim is a whole-op G91 program that does not exist in it. Same ruling as pocket-polygon and single-axis middle
            // below: a variant the generator cannot express routes to the UNIVERSAL unroll, which builds from the op's own
            // stack — so the skim shape has exactly ONE source (skimStructure's postInstantiate), never a second macro here
            // that could drift from it.
            if (p.zMode === 'skim') return { universal: true, reason: 'Skim surfacing is a whole-op RELATIVE (G91) program shape the surface generator cannot express → universal (unrolls the skim stack as built)' };
            return { camType: 'surface' };
        case 'corner': return { camType: 'corner' };
        case 'edge': return { camType: 'edge' };
        /**
         * ── t1444 — THE SLOT'S TWO PACK GATES, both of them "never emit a wrong slot" ─────────────────────────────
         *
         * THE WIDTH GATE (t1442's measured find, ruled here). `slotFromOp`'s macro is ONE centreline pass per level —
         * its own comment says *"For width > tool, add perpendicular offset passes"* — and this line packed EVERY slot
         * into it regardless. A 12mm-wide slot became a slot cutting 6mm: the op's DEFINING dimension dropped, with no
         * gate and nothing declared. It now packs only the case the macro cuts correctly (width ≤ tool) and refuses
         * the rest by name, which is the same rule single-axis middle and polygon pockets have always been held to.
         * The slot capability arc (SLOT_RASTER_GAP) is what lifts this later; until then the wizard path is correct
         * and the sentence says so, because an operator told "unsupported" with no exit does the wrong thing next.
         *
         * THE TOO-SMALL GATE is the user's ruling reaching the third surface: a slot narrower than its tool refuses at
         * BUILD, so the operator hears it here rather than at the machine. Belt and braces — the wizard's own emit
         * refuses too (`slotPath`), and this is the brace.
         */
        /**
         * ── t1512 — THE WIDTH GATE LIFTS, FOR THE SLOTS THE ATOM CAN ACTUALLY WALK ─────────────────────────────────
         *
         * `slotFromOp` has a second arm now whose clearing IS `surfaceRasterLines`, so a slot wider than its tool has a
         * correct parametric macro at last — the delegation the whole slot capability arc was built toward.
         *
         * ⚠ THE ELIGIBILITY QUESTION IS ASKED OF THE **ATOM'S OWN ENVELOPE**, never of a bearing or a width here, and
         * that is the ruling's structural condition (t1511) rather than a stylistic preference. `slotPackArm` reads
         * `slotStackArmGap` → `surfaceRasterCovers` → the live-geometry and bearing refusals. So the domain this gate
         * enforces is whatever the atom currently declares it can do.
         *
         * ⚠ t1514 — AND THAT CONDITION HAS NOW BEEN **PAID OUT**, which is the fact worth pinning rather than the
         * prediction. C5 landed (the live-frame rotation, which needed no runtime trig exactly as t1510 measured) and
         * ANGLED slots began packing with NO DECIDING LINE of this file or of `opToSlot` changed — their whole diff
         * that act is comments plus the one stale sentence below. The gate moved because the ENVELOPE moved, which is
         * the condition the ruling asked for. The domain is now: wide slots at any bearing. What still refuses is what the atom still
         * refuses, in the atom's own sentence, with the wizard named as the exit — t1444's rule stands whatever the
         * domain is: an operator told "unsupported" with no exit does the wrong thing next.
         */
        case 'slot': {
            if (slotTooSmall(p)) return { unsupported: slotToolRefusal(p) };
            /**
             * ⚠ t1516 — THE PATTERN REFUSES BEFORE THE ARM QUESTION, and that placement is the fix. A pattern is not a
             * property of the CLEARING, so neither arm's envelope can see it — the WIDE half was refused only as a
             * side effect (`slotWideRefusal` carrying the pattern gap the wizard supplies), and the narrow half fell
             * straight through to the literal arm and cut ONE slot where N were drawn. Asked here, before either arm
             * is chosen, it is refused for its own reason on both. Same shape as the pocket's tool refusal below,
             * which likewise lands before the shape fork.
             */
            if (slotPatternPack(p)) return { unsupported: slotPatternRefusal(p) };
            const gap = slotPackGap(p);
            if (!gap) return { camType: 'slot' };   // the PACKED arm walks the true channel — the width gate is lifted for it
            if (num(p.width, 0) > num(p.toolDia, 6) + 0.001) return { unsupported: slotWideRefusal(p, gap) };
            return { camType: 'slot' };             // narrow enough that ONE centreline pass IS the correct program
        }
        case 'pocket': {
            const shape = p.shape || 'rect';
            // t1444 — the user's ruling at PACK: a pocket the tool cannot fit has no correct macro to build, on any
            // shape, so it refuses before the shape fork rather than packing a generator that would plunge oversize.
            if (pocketToolRefuses(p)) return { unsupported: pocketToolRefusal(p) };
            if (shape === 'rect') return { camType: 'pocket' };
            if (shape === 'circle') return { camType: 'cpocket' };   // t1043 ruling — circle -> circlePocketSlot
            return { universal: true, reason: `pocket shape "${shape}" has no CAM generator (only rect + circle) → universal` };   // polygon/ellipse → the unrolled long-tail path
        }
        case 'drill': {
            // t1089 — pattern 'single' now routes to the GENERATOR like every other pattern. It used to fall through to the
            // universal unroll (the t1043 S1 gap: slotFromOp had no 'single'), which was the WORST arm for it — measured at
            // t1087, the universal path could not expose depth/peck AT ALL, because drill.js peckDrill drove a JS `while` loop
            // that unrolls the peck sequence and bakes every Z literal at build time. A single hole is just a degenerate
            // pattern (count 1 at the anchor), so opToSlot declares it and depth/peck become live #2600 knobs driven by a
            // MACRO loop instead. NB this is the DEFAULT drill pattern (DRILL_DEFAULTS.pattern === 'single'), so it is the
            // common case, not an edge one. It's a bore when the built-in op sets method:'helical' OR the twin resolves to
            // variant:'bore' (user_bore_data — the twin has no `method`).
            return { camType: (variant === 'bore' || (p.method || 'peck') === 'helical') ? 'bore' : 'drill' };
        }
        case 'middle': {
            // t1043 ruling — the CAM inside/boss generators are FIXED BOTH-AXIS centre probes (no single-axis variant). A
            // single-axis middle would probe an axis the operator didn't intend -> mark unsupported (never emit a wrong slot).
            // `circular` is covered either way (insideCentreSlot always re-centres X; "harmless for a rectangle"). featureType picks the arm.
            if (!(p.twoAxis || p.findBoth)) return { universal: true, reason: 'middle single-axis: the inside/boss generator is BOTH-AXIS only → universal (unrolls the single-axis probe as authored)' };
            return { camType: p.featureType === 'boss' ? 'boss' : 'inside' };
        }
        case 'contour': return { universal: true, reason: 'contour has NO CAM generator → universal' };   // (user_contour_data resolves here too)
        default: return { universal: true };   // U2 — ANY unrecognized op (a forked/custom user_* op) routes to the universal unroll path (seedFromOp reads its def bindings)
    }
}

/**
 * S3 — the LAZY materializer: a def's value bindings → a cam_table block (one cam_field per binding, in binding PRE-ORDER),
 * mode = the classifier default (exposable → expose, non-exposable → bake at the binding default), label from the binding.
 * Consuming it via stackToSlot's cam_table branch (S2) reproduces today's DEFAULT field set exactly (makeAuthOp seeds
 * exposable→exposed / non-exposable→baked-at-value, which the materializer mirrors) → BYTE-NEUTRAL. The inverse of
 * camFieldsFromStack. Returns null when the def has no value bindings (nothing to declare). PURE — no injection, no side
 * effect; the caller decides where to place it (and must re-derive binding blockIndex if it injects into a mouth).
 */
export function camTableFromBindings(def) {
    const valueBindings = ((def && def.bindings) || []).filter((b) => b && b.blockIndex != null);
    if (!valueBindings.length) return null;
    const cls = classifyExposable(def);
    const children = valueBindings.map((b) => {
        const exposable = !!(cls[b.param] && cls[b.param].exposable);
        return { type: 'cam_field', params: {
            param: b.param, label: b.label || '', mode: exposable ? 'expose' : 'bake',
            baked: exposable ? '' : String(b.default),   // a bake row inlines the binding default (matches makeAuthOp's baked=value)
            units: b.units || '', dflt: '', nmin: '', nmax: '',
        } };
    });
    return { type: 'cam_table', params: {}, children };
}

/**
 * S4b core — materialize a cam_table INTO a def (the reusable, hook-agnostic step). Injects camTableFromBindings into the
 * user_root PRESENTATION mouth and re-derives EVERY binding's blockIndex BY IDENTITY over the post-injection flatten (the
 * wrapForkAtSave pattern): flattenBlocks visits uiChildren BEFORE children, so the shift is non-uniform and a blanket +1+N
 * would corrupt a uiChildren binding — instead each binding's ORIGINAL block object is found at its NEW index. Mutates `def`
 * in place (template + bindings). BYTE-NEUTRAL by construction: the materialized rows reproduce today's default field set
 * (camTableFromBindings mirrors makeAuthOp) and the cam_table emits []. Idempotent: a no-op when the def has no value bindings
 * or already carries a cam_table. Returns def. NOTHING calls this yet — the HOOK (the WHERE) is gated to the advisor (t1101).
 */
export function materializeCamTable(def) {
    if (!def || !Array.isArray(def.template)) return def;
    const root = def.template.find((b) => b && b.type === 'user_root');
    if (!root) return def;
    if (flattenBlocks(def.template).some((b) => b && b.type === 'cam_table')) return def;   // already materialized — idempotent
    const ct = camTableFromBindings(def);
    if (!ct) return def;   // no value bindings — nothing to declare
    const flatBefore = flattenBlocks(def.template);
    root.uiChildren = [ct, ...(root.uiChildren || [])];   // the cam_table leads the Presentation mouth
    const flatAfter = flattenBlocks(def.template);
    (def.bindings || []).forEach((b) => {
        if (!b || b.blockIndex == null) return;
        const ref = flatBefore[b.blockIndex]; const ni = ref ? flatAfter.indexOf(ref) : -1;   // BY IDENTITY (never a blanket shift)
        if (ni >= 0) b.blockIndex = ni;
    });
    return def;
}

/** UNIVERSAL seed — read the def BINDINGS directly (param names are the def's own; NO PARAM_ALIAS/DERIVE). Each value binding
 *  becomes a field seeded from op.params, with an `exposable` flag from exposeClassifier (value-role AND not under a fold).
 *  Geometry/other params are exposable:false → the table greys Expose + bake-forces them. Returns {unsupported} if the op has
 *  no registered def or no value bindings (the honest floor). */
function seedUniversal(op, reason) {
    const def = getUserDef(op && op.opType);
    // No registered def (a bare built-in optype has none — real programs use user_*_data twins): fall back to camTypeOf's
    // reason (why no dedicated generator) so the message stays informative, else a plain no-def note.
    if (!def) return { unsupported: reason || `no registered def for "${op && op.opType}" — cannot build a universal slot` };
    const valueBindings = (def.bindings || []).filter((b) => b && b.blockIndex != null);   // structural (guard) bindings have no socket
    if (!valueBindings.length) return { unsupported: reason || `"${op && op.opType}" has no value bindings to expose or bake` };
    const params = (op && op.params) || {};
    // t1410 — the op's OWN params decide which arm a guarded def will build, so the classification is asked about that
    // arm rather than about the guarded superset (which fails closed and exposes nothing). Same call `stackToSlot` makes.
    const cls = classifyExposable(def, params);
    const fieldFor = (b, over) => {                                     // one seed field; `over` = the cam_field row overriding label/mode/value (S2)
        const raw = params[b.param];
        const value = (over && over.mode === 'bake' && over.baked != null) ? over.baked
            : (raw !== undefined && raw !== '') ? raw : (over && over.dflt != null ? over.dflt : b.default);
        const exposable = !!(cls[b.param] && cls[b.param].exposable);
        // t1410 — THE WHY, CARRIED. macrosApp shows `_exposeTip` on the Expose control and otherwise falls back to a
        // generic "geometry / fold-driven". The classifier already computes the real reason per param — including the
        // ARM's own words when the op sits on a poorer one — so a greyed knob can say WHICH setting to change to get
        // it back, instead of leaving the operator to guess.
        const tip = (!exposable && cls[b.param] && cls[b.param].reason) ? { _exposeTip: cls[b.param].reason } : {};
        return { key: b.param, label: (over && over.label) || b.label || b.param, def: (over && over.dflt != null) ? over.dflt : b.default,
            value, units: (over && over.units != null) ? over.units : (b.units || ''), type: b.type,
            exposed: over ? (over.mode !== 'bake') : true, bakeable: true, exposable, ...tip };   // over-mode drives expose/bake; else exposed by default
    };
    // t1095 (block-native params S2) — ADDITIVE-BY-FALLBACK. A cam_table in the template makes its cam_field ROWS the field
    // declaration: seed order = block order, expose/bake = the row mode, label/units/default from the row (binding = wiring).
    // No cam_table (every op today) → the UNCHANGED binding-order seed → byte-identical.
    const camRows = camFieldsFromStack(def.template);
    let fields;
    if (camRows.length) {
        const bindingByParam = {}; valueBindings.forEach((b) => { bindingByParam[b.param] = b; });
        fields = camRows.map((row) => { const b = bindingByParam[row.param]; return b ? fieldFor(b, row) : null; }).filter(Boolean);
    } else {
        fields = valueBindings.map((b) => fieldFor(b));
    }
    // t1323 — the BUILD-time enums ride ALONGSIDE the value fields (they are rows, not sockets): the operator sees which
    // shape the slot bakes, greyed out of Expose with its reason, instead of a param that silently does not exist.
    return { camType: 'universal', universal: true, fields: fields.concat(buildEnumFields(def, params)) };
}

/**
 * S1b — seed the expose/bake field table from ONE program op. PURE. Returns { camType, fields } or { unsupported }.
 * Each field: { key (generator field key), value (op.params via PARAM_ALIAS, else the generator default), exposed:true,
 * bakeable (NOT in NON_BAKEABLE) }. Enum values (corner/wcs/axis/dir/…) are pulled RAW here (strings); the enum<->int
 * conversion is S1d. No UI.
 */
export function seedFromOp(op) {
    const r = camTypeOf(op);
    if (r.universal) return seedUniversal(op, r.reason);   // U2 — the universal (def-bindings-derived) seed for any non-generator op
    if (r.unsupported) return { unsupported: r.unsupported };
    const camType = r.camType, params = (op && op.params) || {};
    const alias = PARAM_ALIAS[camType] || {}, nb = NON_BAKEABLE[camType] || [], derive = DERIVE[camType] || {};
    // Read a field's op value via its alias — a STRING key or an ARRAY of candidates (first present wins: built-in vs twin).
    const readParam = (fkey) => { const a = alias[fkey], keys = Array.isArray(a) ? a : [a || fkey]; for (const k of keys) if (params[k] !== undefined) return params[k]; return undefined; };
    const genFields = genFieldsFor(camType, params);
    // t1325 — the tool Ø the slot will CARRY (the op's own, else the generator's field default): a derive that
    // recovers a percentage from a stored mm has to divide by the very number the macro will multiply back.
    const toolDiaCarried = (() => { const v = readParam('toolDia'); if (v !== undefined && v !== '') return Number(v); const f = genFields.find((x) => x.key === 'toolDia'); return f ? Number(f.def) : NaN; })();
    const fields = genFields.map((f) => {
        const opts = ENUM_OPTIONS[f.key];
        let value, meta;
        if (opts) {   // ENUM — map the op's string/bool value to the CAM int (S1d); the friendly dropdown lives on `enum`
            const opVal = readParam(f.key);
            const opt = opts.find((o) => o.op === opVal) || opts.find((o) => o.value === opVal);
            value = opt ? opt.value : f.def;
            meta = { type: 'enum', enum: opts };
        } else if (derive[f.key]) { value = derive[f.key](params, toolDiaCarried); meta = { type: f.type }; }   // DERIVED (e.g. stepover from stepoverPct / the twin's flat stepover)
        else { const opVal = readParam(f.key); value = opVal !== undefined ? opVal : f.def; meta = { type: f.type }; }   // op value via alias, else the generator default
        // t1512 — A GENERATOR FIELD MAY DECLARE ITSELF BAKE-ONLY (the packed slot's endpoints + ramp angle), and that
        // declaration has to SURVIVE the seed or the row arrives exposed and the arm's build-time geometry becomes a
        // pendant knob it was never allowed to be. Carried explicitly, with the reason the greyed control shows.
        const bakeOnly = f.bakeOnly === true;
        return { key: f.key, label: f.label, def: f.def, value, exposed: !bakeOnly, bakeable: !nb.includes(f.key), ...meta,
            ...(bakeOnly ? { bakeOnly: true, exposable: false, _exposeTip: f._exposeTip || '' } : {}) };
    });
    // t1341 — THE ENTRY GATE, applied to the generator arm's own fields: a ramp/helix slot cannot expose the knobs
    // that move the descent's baked geometry. Grey with the reason, never hidden (postGating's rule).
    if (entryHasGeometry(params)) {
        for (const f of fields) {
            if (!ENTRY_GEOMETRY_KNOBS.includes(f.key)) continue;
            f.exposable = false; f.exposed = false; f._exposeTip = ENTRY_GATE_REASON;
        }
    }
    // t1323 — a BUILD enum lives on the DEF, not on the generator's field list, so it is appended on the generator arm too.
    // On this arm it is always sitting at the value that KEEPS this camType (a shape-forking pick routed to universal
    // above), so the row states the shape being built and stays greyed — informative, never a control that lies.
    // t1414 — the camType is passed so the row can say what THIS generator's macro actually carries.
    return { camType, fields: fields.concat(buildEnumFields(getUserDef(op && op.opType), params, camType)) };
}
