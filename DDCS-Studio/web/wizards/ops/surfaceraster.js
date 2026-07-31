/**
 * wizards/ops/surfaceraster.js — SURFACING, EMITTED PARAMETRIC (t1329 pilot · t1333 coverage).
 *
 * THE PILOT'S POINT: today a surfacing op unrolls its whole raster in JavaScript — every row, at every depth, as a
 * literal G1. A 200×150 face at a 0.4 stepdown is thousands of lines that all say the same thing, and none of them
 * says WHY. This emits the INTENT instead: a header of named #vars, a depth loop, and inner loops that count
 * themselves from the area and the stepover. Change the tool Ø on the pendant and the raster re-derives at the machine.
 *
 * WHY A NEW ATOM RATHER THAN CHANGING `stepdown` + `surfacefill`: those two are SHARED — pocket, slot and contour
 * emit through them. Making them parametric would re-emit every one of those ops in the same breath as the pilot,
 * which is exactly what a pilot exists to avoid ([[corner-gated-pilot]]: prove each mechanism ONCE, on one op, and
 * let the family inherit it deliberately). This atom owns the loops for the surfacing case and touches nothing else.
 *
 * ── THE SCRATCH IT WRITES, DECLARED (t1325's lesson) ─────────────────────────────────────────────────────────────
 * A hand-picked var is how the CAM stepover derivation got silently overwritten by rasterClear's row count: clean
 * G-code that cut a different part. So the band is DECLARED on the block (`scratch`), the way universalScratch.js
 * already reads every atom's own declaration, and the spec asserts each header var is assigned exactly once.
 *
 * ── THE FRAME ────────────────────────────────────────────────────────────────────────────────────────────────────
 * The area is the TOOL-CENTRE sweep (no radius inset — the tool overhangs the edge and faces the whole top), which
 * is what the literal emitter has always done; the equivalence bridge proves that has not changed.
 *
 * ── THE COMPARATORS ARE SYMBOLS, AND THAT IS AN EVIDENCE DECISION (t1355) ────────────────────────────────────────
 * This body used the WORD forms (LT/GT/LE/GE). Swept against the factory macro corpus — the v4.1 firmware's
 * macroMillCylinder/macroMillRect, dm500's slib, the Expert's slib-g/slib-m — the counts are:
 *     SYMBOLS:  ==  190 · >  50 · <  20 · <=  12 · >=  6      ← every comparator this body needs, demonstrated
 *     WORDS:    NE  25  ← and NOTHING else. No LT, no GT, no LE, no GE, no EQ anywhere in factory code.
 * So all four were swapped, not the two that were flagged: LE and GE sat in exactly the same undemonstrated class as
 * LT and GT, and leaving them would have kept the risk while looking like it had been dealt with.
 *
 * THE BRACKETED, SPACED SHAPE IS DEMONSTRATED TOO — the factory writes both `WHILE #1<=#108 DO2` and
 * `WHILE [#2 <= #1301] DO1`, so the readable form this body already used needs no compromise to sit on the evidence.
 *
 * (Our own shipped CAM slots still emit the spaced WORD forms — `IF #22 LE 0 GOTO`, `IF #71 EQ 0 THEN` — and those
 * are proven a different way: the user runs them live. They are NOT changed here; this is the pre-consumer emitter,
 * and rewriting working live macros to chase a stronger tier would be risk taken for tidiness.)
 *
 * ── GOTO IS WRITTEN WITHOUT A SPACE (t1363 ruling) ───────────────────────────────────────────────────────────────
 * `GOTO91`, not `GOTO 91`. V11 proved the spaced form parses on the Expert, so this is not a correctness fix — but
 * the linter flags every spaced GOTO as a portability advisory (W-GOTOSPACE), and this body emits enough of them
 * that a plain surfacing op arrived in the editor carrying NINE user-visible warnings and a "can't verify" badge.
 * The no-space form is the factory-demonstrated one (the factory's own gotozero.nc writes `IF #569<#792 GOTO1`),
 * so adopting it costs nothing and buys back a clean verify. The engine reads both — its matcher is `GOTO\s*(\d+)` —
 * so this moves TEXT only; the bridges re-ran and the resolved motion is unchanged, which is the whole check.
 */
import { num, val, r3 } from './util.js';   // t1399 — val() at the seeds: a #var survives to the register, so the knob is reachable   // t1425 — r3 from the one source (this file carried an identical local copy)
import { affineFrame } from './affineFrame.js';   // t1381 — the coordinate/rotation printers, one source (drill shares them)
import { workMarker } from '../../engine/declaredWork.js';   // t1383 — this body DECLARES how much it executes (its preview was truncating silently)

/**
 * t1363 — THE ONE READING OF A STORED STEPOVER, declared here because this atom owns what a stepover MEANS.
 *
 * The intent is the PERCENTAGE and the millimetre is its consequence — the macro header re-derives the mm at the
 * machine from the tool Ø and the percentage. An op stored before that split carries a flat `stepover` millimetre
 * and no percentage, so it has to be recovered; and the recovery was hand-rolled in FOUR places (surfacingStack,
 * this atom's body, opCamMap's surface DERIVE, opSession's reverse-sync), which had already drifted: the emitters
 * treated a typed `0` as a real zero (the program then refuses loudly at its own guard) while opCamMap treated it
 * as absent and silently seeded 60. Two paths reading one stored value differently is precisely the split the
 * parametric switch exists to kill, so there is now one function and every reader calls it.
 *
 * PRESENT WINS. A percentage that is there — including a deliberate 0 — is the operator's intent and is used as
 * given; only a genuinely absent one falls back to recovering the stored millimetre against the tool it will run.
 * `toolDia` may be overridden by a caller that knows the tool the SLOT will carry rather than the op's own.
 */
export function stepoverPctOf(p = {}, toolDia) {
    if (p.stepoverPct != null && p.stepoverPct !== '') return num(p.stepoverPct, 60);
    const tool = Math.max(0.1, num(toolDia != null && toolDia !== '' ? toolDia : p.toolDia, 12));
    const mm = num(p.stepover, 0);
    return mm > 0 ? Math.round((mm / tool) * 1000) / 10 : 60;
}

/**
 * t1418 — THE ONE READING OF A STORED DIRECTION, declared beside the stepover's for the same reason: three readers
 * ask this question (the walk, the work declaration, the envelope key) and three hand-rolled `String(p.direction ||
 * 'bothways')` expressions is exactly how two of them drift apart.
 *
 * ABSENT IS THE DEFAULT, UNKNOWN IS KEPT VERBATIM. An unset config IS the block's declared `bothways`, so it resolves;
 * a word this atom has never heard of stays as it was written, so it misses the envelope table and REFUSES there
 * rather than being quietly folded into the walk it most resembles. That asymmetry-free handling is t1404's ruling on
 * `strategy`/`entry` applied to the axis this turn adds, in the same act that adds it.
 */
export function rasterDirectionOf(p = {}) {
    return String(p.direction == null ? '' : p.direction).trim() || 'bothways';
}

/**
 * Does this resolved direction select the ONE-WAY walk? Asked by the walk itself and by the work declaration, from
 * this one place — because those two answering differently is not a cosmetic drift: the declaration would then size
 * the tracer's cap for a body the emitter did not write, and t1383 measured what an undersized cap does (a preview
 * silently showing a fraction of the toolpath). An unknown word is NOT one-way, exactly as the emitter treats it.
 */
export function rasterIsOneWay(direction) { return direction === 'oneway' || direction === 'otherway'; }

/**
 * ── t1429 — WHICH AXIS THE ROWS RUN ALONG, DECLARED. It was an UNSTATED ASSUMPTION, and that is the defect ────────
 *
 * This walk has always run its rows along X and stepped over in Y, and nothing said so — the fact lived only in the
 * letters `X` and `Y` inside `rowWalk`. The CAM kit's own raster has ALWAYS declared it: `rasterClear({ dir })`
 * swaps its row and step axes, and `pocketSlot`/`surfacingSlot` expose that pick as a build-time dropdown
 * (macrosApp's `SECOND_CTL`: *"Raster direction — which axis the clearing rows run along"*). So the moment a slot
 * delegates its clearing body to this atom, a `rows ∥ Y` pick would emit `rows ∥ X` — the operator's build-time
 * choice silently replaced by this atom's assumption, which is t1422's class of defect one layer up again.
 *
 * IT IS NOT AN ENVELOPE AXIS, and that is a measured claim rather than a convenience. `direction` earned its place in
 * SURFACE_RASTER_AXES because a one-way walk is a genuinely DIFFERENT body (11 lines per pass against 20). A row axis
 * is the SAME body with its coordinate pair swapped: the `y` walk at (x,y,w,h) is the `x` walk at (y,x,h,w) with the
 * X and Y words exchanged, which the transposition bridge asserts move-for-move. A table whose rows are the turn that
 * earned them cannot afford six rows that say nothing a swap does not already prove.
 *
 * ABSENT IS 'x' — the assumption this makes explicit, so every existing config emits byte-for-byte what it did.
 * Anything that is not 'y' is 'x', mirroring how `strategy` resolves: the ENVELOPE refuses unknown words, not the
 * emitter (t1404's ruling, applied to the axis this turn adds, in the same act that adds it).
 */
export function rasterRowAxisOf(p = {}) {
    return String(p.rowAxis == null ? '' : p.rowAxis).trim() === 'y' ? 'y' : 'x';
}

/**
 * ── t1492 (C1) — WHICH ROW RULE THIS WALK USES, declared in one place like the axis and the direction ────────────
 *
 * 'fit'  — rows half a stepover inside the walked edge, keeping those that land inside. Surfacing's rule (the tool
 *          overhangs) and a pocket's (a wall-finish pass follows). THE DEFAULT, so every existing caller is
 *          untouched, and an unknown word falls here exactly as `rasterRowAxisOf` and `rasterDirectionOf` do.
 * 'wall' — passes anchored ON the wall plus a forced final pass clamped to the far one, so the finished channel is
 *          exactly the width that was typed. A slot's rule, and NOTHING else asks for it today.
 *
 * ⚠ It is a WALK rule, not a geometry input: it changes where the passes sit inside the span C2's inset decides, and
 * the arc names C2 as its precondition for exactly that reason — get the span wrong first and a row bug and an inset
 * bug are indistinguishable in the output.
 */
export function rasterRowAnchorOf(p = {}) {
    return String(p.rowAnchor == null ? '' : p.rowAnchor).trim() === 'wall' ? 'wall' : 'fit';
}

/**
 * ── t1490 (C2) — THE INSET IS A PAIR, AND THIS IS THE ONE PLACE A CALLER'S INSET WORDS BECOME ONE ─────────────────
 *
 * THE DEFECT IT EXISTS FOR, measured at t1442: the atom held ONE inset and moved it on BOTH axes, so handing it a
 * tool radius walked a 60mm slot from x=3 to x=57 — a 54mm channel where 60 was asked. A slot needs `tool/2` ACROSS
 * its width and NOTHING along its length; the tool centre runs the full centreline, A to B.
 *
 * ⚠ THE PAIR IS NAMED BY ROLE, NOT BY AXIS — `along` is the axis a pass RUNS along, `across` is the one the passes
 * step across — and that is a deliberate coupling to `rowAxis` rather than an oversight, for two reasons. It is what
 * the only asymmetric consumer actually needs (a slot's need is stated in exactly those words), and it is what makes
 * C3 (the bearing) a rename rather than a re-keying: once passes run on a bearing, "along" and "across" ARE the
 * axes. The cost is that flipping `rowAxis` transposes which span each inset moves — harmless while the two are
 * equal, which is every caller that exists today, and the reason the equal case is asserted byte-identical.
 *
 * A RING WALK HAS NO ROWS, so there is nothing for "along" to mean; `rasterRowAxisOf` answers 'x' for it and the
 * pair lands on X/Y in the order written. That is stated here rather than left for a reader to deduce from a
 * default, because a silent default that reads like a decision is this file's own recurring defect (t1399, t1404).
 *
 * Returns the caller's WORDS, not numbers: each may be a register, and `geoTerm` is what resolves either kind.
 */
export function rasterInsetOf(p = {}) {
    const both = p.inset;
    return {
        along: p.insetAlong == null ? both : p.insetAlong,
        across: p.insetAcross == null ? both : p.insetAcross,
    };
}

/** The two inset words mapped onto the X and Y spans, which is the only form the seeds can use. */
export function rasterInsetAxes(p = {}) {
    const { along, across } = rasterInsetOf(p);
    return rasterRowAxisOf(p) === 'y' ? { x: across, y: along } : { x: along, y: across };
}

/**
 * ── t1425 — A GEOMETRY INPUT THAT MAY BE A PENDANT REGISTER, AND THE ONE PLACE THEIR ARITHMETIC COMBINES ─────────
 *
 * THE DEFECT THIS CLOSES, MEASURED AT t1422 BEFORE ANY OF IT WAS BUILT. A CAM slot holds its geometry in REGISTERS
 * (`pocketSlot` reads `#26xx` into locals and its hand-written raster consumes them: `#22=[<tool>/2]`,
 * `#24=[#20+<w>-#22]`). This atom held its geometry in BUILD-TIME NUMBERS. Handing the former to the latter did not
 * fail loudly — `num(word, default)` returns the DEFAULT — so a pendant W of 80 emitted `#40=94`, a 2.4mm stepover
 * emitted `#44=[12 * 60 / 100]` = 7.2, and a live `inset` collapsed to 0, dropping the tool-radius inset so the
 * pocket came out OVERSIZE BY A FULL TOOL Ø while the header called itself SURFACING. Clean-looking G-code that cuts
 * a different part, which is this project's gate-1 defect.
 *
 * SO A GEOMETRY INPUT IS READ ONCE, HERE, AND CARRIES BOTH FORMS. `live` says which it is; `w` is the word to print
 * (the register, or the number already rounded); `n` is the build-time value, floored, for the arithmetic that
 * genuinely cannot wait for the machine. A numeric input takes the IDENTICAL old path — same floor, same rounding —
 * which is what makes the byte-identity of every existing program a property of the code rather than a hope.
 *
 * THIS IS t1399's SHAPE, NOT A NEW ONE. That turn made `depth`/`stepdown` word-or-number seeds and wrote
 * `surfaceRasterWorkSteps` to null out on live `w`/`h`/`toolDia`/`stepoverPct`/`stepover` — inputs nothing could set
 * live yet. The check was written for this continuation; it is cited and asserted rather than re-derived.
 */
export const liveWordOf = (v) => { const t = String(v == null ? '' : v).trim(); return /^(#|\[)/.test(t) ? t : null; };

/** A geometry input → { live, w (the word to print), n (the build-time value, floored) }. */
function geoTerm(v, dflt, floor = null) {
    const word = liveWordOf(v);
    const n = floor == null ? num(v, dflt) : Math.max(floor, num(v, dflt));
    return { live: !!word, w: word || String(r3(n)), n };
}

/**
 * `a + k·b`, folded to a NUMBER when neither side is live — so the baked path prints exactly what it always printed
 * and never grows a `+ 0` nobody asked for. A zero numeric term drops out entirely for the same reason.
 */
function geoSum(a, b, k = 1) {
    if (!a.live && !b.live) return { live: false, w: String(r3(a.n + k * b.n)), n: a.n + k * b.n };
    if (!b.live && b.n === 0) return a;
    const mag = Math.abs(k);
    const term = mag === 1 ? b.w : `${r3(mag)} * ${b.w}`;
    return { live: true, w: `[${a.w} ${k < 0 ? '-' : '+'} ${term}]`, n: NaN };
}

/**
 * THE BAND. #40–#49: clear of the mill kit's #20–#33 (camMacroKit's caller/kit split), clear of the probe temps at
 * #50–#61, and clear of the dialect/atom injections universalScratch aggregates in the low teens. Declared here as
 * data so the collision guard reads it instead of re-deriving it from the emitted text.
 */
// t1343 — EXTENDED DOWN to #34 for the helix recurrence, which needs a rotating vector (2), a temp for the rotate
// (1) and its own segment counter (1) on top of the header. #34–#39 is the gap between camMacroKit's kit band
// (#27–#33) and this atom's original #40–#49 — still clear of the probe temps at #50–#61.
// t1355 — THE SKIM FRAME's three registers, declared as part of the same band data. #62-#64 sits in the gap between
// the probe temps (#50-#61) and camMacroKit's WCS pair (#70-#71) — unclaimed by any band in camScratch.js. They are
// plain LOCALS: far below the #1153+ persistent range the priming freeze concerns, so reading a system register into
// one carries none of that hazard (CORE_TRUTH 4).
export const RASTER_SCRATCH = [[34, 49], [62, 64]];

/**
 * THE LIVE WORK POSITION, read at the top of a SKIM program. #790/#791/#792 are the active-WCS X/Y/Z
 * ([COMMUNITY-ATTESTED]; the factory's own gotozero.nc proves #792 with `IF #569<#792 GOTO1`).
 *
 * WHY THE WCS FRAME AND NOT THE MACHINE FRAME (#880-#882) — the sieve, recorded because it looks like the safer
 * option and is not. Taking machine coordinates would force EVERY cutting move into G53, and G53 is proven here only
 * as `G53 <axis>#var`: one axis, a variable, a rapid, in a program footer (V3a/V3b on machine 2026-06-19).
 * Literal-coordinate G53 is INCONCLUSIVE — V3c/V3d aborted at a guard and were deliberately not pursued because
 * "the dialect emits #var, never bare literals" — and a raster is full of literal coordinates and G1 feed moves.
 * Meanwhile #880-#882 is NOT V7-proven: V7 is still in the verify HANDOFF's "Left to do" table, its values only
 * "seen incidentally".
 *
 * So the choice is not attested-vs-proven, it is WHERE the unproven part sits. The WCS frame puts it on a register
 * READ, at the top, before any motion — where a sentinel can catch it and refuse. The machine frame would put it in
 * the G-code FORM of every cutting move, where a controller that mis-executes it does so with the tool down.
 * A bad read is detectable; a mis-executed cutting form is not. Gate 1 (safety) decides, and it decides for the WCS.
 */
const SKIM_FRAME = { x: '#62', y: '#63', z: '#64' };
const FRAME_SRC = { x: '#790', y: '#791', z: '#792' };
const FRAME_SENTINEL = '-99999';

/**
 * t1375 — WHEN THIS ATOM CAN ABSORB A DECLARED PROGRAM ROTATION, and the REASON when it cannot.
 *
 * Declared here because the atom owns what its frame MEANS, and read from this one place TWICE: the emitter asks it
 * before passing the angle down, and the body asks it again so a direct caller cannot route around it.
 *
 * SKIM IS REFUSED. A skim body is measured from wherever the operator jogged to — it reads the live work position into
 * three registers and runs its ordinary absolute body over them. A program rotation is about the PART DATUM. Rotating
 * a jog-referenced body about the datum mixes two frames that have no fixed relationship, so the result is not "less
 * accurate", it is meaningless. Refusing is the same honesty as skipping the entry waypoint on a skim program (t1365).
 *
 * AND IT COSTS NOTHING AGAINST THE PATH IT REPLACED, which is the part worth recording: a LITERAL skim program is
 * G91-wrapped, and every whole-program transform returns G91 regions untouched — so the text rotation never rotated a
 * skim body either. This is parity with the shipped literal emitter, not a narrowing.
 */
export function surfaceRasterAbsorbsRotation(p = {}) {
    // t1425 — A LIVE-GEOMETRY FRAME REFUSES ROTATION, for a mechanical reason rather than a conceptual one. The
    // rotation printer mixes each axis's BUILD-TIME constant (`X.c`) into the other axis; when the origin is a
    // register there is no such constant, so the rotated word would silently drop it. Skim already refuses for its
    // own (frame-mixing) reason; this is the second way the constant can fail to exist, and it is refused the same
    // way rather than emitted half-applied — which is precisely t1353's measurement of what a half-rewrite does.
    if (surfaceRasterLiveInputs(p).length) {
        return 'a dialled geometry input makes the origin a register, and a program rotation mixes the build-time '
            + 'constant of each axis into the other — there is no such constant to mix, so the rotation cannot be baked';
    }
    if (String(p.zMode || '') === 'skim') {
        return 'a skim body is measured from wherever the operator jogged to, so it has no datum frame — rotating it '
            + 'about the part datum would mix two frames (the literal skim path is G91 and was never rotated either)';
    }
    return true;
}

/**
 * ── t1408 — THE FLOW LABELS, DECLARED. A SHIPPED DEFECT, MEASURED, NOT A PRECAUTION ──────────────────────────────
 *
 * This body wrote its `N`/`GOTO` numbers as literals: 91-96 for the refusals, 13-18 / 21-22 / 31 / 41-42 / 51-52 for
 * the walks and descents. That is safe for exactly one such body per program, and a program can hold two.
 *
 * WHAT IT COSTS, measured in the running app on RELEASED code (V2026.07.30.6) with no pocket involved at all:
 * a program holding a DRILL op and a SURFACING op emits `N91`/`N92` TWICE — `holecycle` gets 91/92 from the emitter's
 * label counter, and this body writes its own — and the SECOND body is then skipped entirely. Per-op time: drill 3.9s,
 * surfacing **0**. Not a preview artifact: duplicate labels are ambiguous on the controller too, and an op that
 * silently does not execute is the worst kind of wrong motion — the operator sees a program that looks complete.
 *
 * t1379 MEASURED THIS EXACT FAILURE ONE ATOM EARLIER — two hole ops, the second's GOTO bound to the first's N, every
 * hole after the first silently undrilled — and t1381 built the answer: an atom DECLARES the labels it needs and the
 * emitter assigns them uniquely per program. `holecycle` declares; this atom never did. So this is not a new
 * mechanism, it is the mechanism reaching the atom that was missing from it.
 *
 * THE DEFAULTS BELOW ARE THE LEGACY NUMBERS, deliberately: a direct `surfaceRasterLines(p)` call carries no label
 * params, so every bridge that reads this body straight is byte-for-byte unchanged. What moves is the EMITTED
 * PROGRAM's numbering, which is what has to move for the numbers to be unique.
 */
const LABEL_DEFAULTS = {
    errLabel: 91, okLabel: 92,                       // the stepover/stepdown refusal + its skip-over
    skimErrLabel: 93, skimOkLabel: 94,               // the skim frame-read refusal
    insetErrLabel: 95, insetOkLabel: 96,             // t1404 — the collapsed-inset refusal
    rowStepLabel: 13, rowCutLabel: 14,               // rowWalk: step-over-at-depth / the cut
    rowNearLabel: 15, rowEndLabel: 16,               // rowWalk: which end this row runs to
    rowFarLabel: 17, rowStartLabel: 18,              // rowWalk: which end this row starts at
    ringStepLabel: 21, ringCutLabel: 22,             // ringWalk: first ring vs the diagonal step in
    ringMinLabel: 23,                                // t1425 — ringWalk: the SHORTER side, resolved at RUN time when w/h are live
    confirmLabel: 31,                                // the confirm-every-N pause skip
    rampPlungeLabel: 41, rampEndLabel: 42,           // the ramp's honest degrade to a plunge
    helixReseedLabel: 51, helixEndLabel: 52,         // the helix re-seed + its final plunge guard
};
/** The label numbers this body will use: the emitter's per-program assignment, else the legacy default. */
function labelsOf(p = {}) {
    const out = {};
    for (const k in LABEL_DEFAULTS) out[k] = num(p[k], LABEL_DEFAULTS[k]);
    return out;
}

const V = {
    w: '#40',        // area X (tool-centre sweep)
    h: '#41',        // area Y
    depth: '#42',    // total depth to remove
    stepdown: '#43', // per-level bite
    step: '#44',     // stepover in mm — DERIVED below, never typed twice
    n: '#45',        // how many rows (raster) or rings (concentric) — counted, not written out
    z: '#46',        // the level currently being cut
    y: '#47',        // the row's Y
    i: '#48',        // row / ring index
    dir: '#49',      // +1 / −1 — which way this row runs (both-ways raster only)
};
// t1339 — the ramp's run length, originally sharing the DIRECTION slot (#49) on the grounds that "a ramp happens at
// the FIRST row of a level, before any direction flip has been read, so the two never overlap."
//
// t1375 — THEY DO OVERLAP, and the sharing only ever worked by an invariant nobody had written down. The ramp writes
// its run into #49 on row 0; every row after that reads #49 as the direction. It survived because the only thing ever
// read was the SIGN — `IF #49 < 0` — and negating ±run once per row alternates exactly as negating ±1 does. So the
// register held two different quantities at once and the program was correct by a property of the tests applied to it.
//
// The moment anything needed the direction's VALUE (the rotated step-over does: it selects a row end arithmetically
// rather than by branching) the collision surfaced as a 416mm error. That is a MISSING DECLARATION, not a patch: the
// two quantities are separated, and #49 now means what its comment says it means.
//
// #34 IS FREE FOR IT BY CONSTRUCTION — that slot belongs to the DESCENT, and a descent is exactly one of plunge / ramp
// / helix, so the ramp's run and the helix's rotating vector can never be live in the same program. That is a sharing
// justified by mutual exclusion, which is what the old comment claimed and this one can actually stand behind.
V.run = '#34';
// The ring walk reuses one of the same slots for its inset: a ring and a row are never walked at the same time, so
// a separate var would be a second name for one register.
const RING_INSET = V.y;
// t1343 — the helix recurrence's own registers, in the extended band.
const HX = { vx: '#34', vy: '#35', tmp: '#36', k: '#37', segs: '#38', rev: '#39' };

/**
 * The parametric body for a whole surfacing op: header, depth loop, and the strategy's own inner walk.
 * @param {object} p  w,h,depth,stepdown,toolDia,stepoverPct (or stepover mm),feed,plunge,clearance,x,y,strategy,direction
 */
/**
 * ── HOW MUCH THIS BODY EXECUTES, DECLARED (t1383, ruled) ──────────────────────────────────────────────────────────
 *
 * THIS ONE IS NOT A PRECAUTION — IT IS A SHIPPING DEFECT, MEASURED. t1381 reported the length-sized trace cap as a risk
 * the drill switch would CREATE. It was already live here: this atom has emitted every surfacing program since t1359, it
 * is ~49 lines whatever the area, so its cap was the 5000-step floor while the work is unbounded. Measured on the real
 * bodies — a 0.1mm-stepdown 10%-stepover face needs 29376 steps and drew 17% of its path; a 600x400 at 0.2/15% needs
 * 115698 and drew 4.3%. Both silently: `stats.capped` was true and nobody read it. So the preview a user checks a facing
 * program against has been showing a fraction of the toolpath, with no indication it was partial.
 *
 * The counts are the ones the body ALREADY computes and emits (`#45` rows-or-rings, the depth loop's levels, the helix's
 * segments-per-revolution) — which is why this is a declaration and not a new calculation.
 */
export function surfaceRasterWorkSteps(p = {}) {
    /**
     * ── IT DECLARES ONLY WHEN IT CAN BE TRUE — returns null otherwise (t1399) ─────────────────────────────────────
     *
     * t1383 gave this function to surfacing and t1389 gave the null-when-live rule to `holeCycleWorkSteps`; surfacing
     * never got it, because until this turn none of its inputs COULD be live. Making the depth/stepdown seeds reachable
     * is exactly what creates the case, so the check lands in the same act rather than after someone reads a declared
     * number that the operator has since dialled past.
     *
     * The rule is t1383's own: never declare wrong. Expected execution size is computed here at BUILD time from depth,
     * stepdown and the area; once any of those is a `#var` the real count does not exist yet, so the marker is OMITTED
     * and the tracer falls back to the flow-aware floor — which was sized for the worst realistic job and SAYS SO if it
     * truncates. Every input it reads is checked, not just the two this turn makes live, so a later knob cannot slip
     * past a check written for today's set.
     */
    const live = (v) => /^(#|\[)/.test(String(v == null ? '' : v).trim());
    // t1490 (C2) — BOTH inset words are checked, through the same resolver the seeds use. Checking only `inset`
    // would have let a live `insetAcross` past a guard written for the single-inset spelling, and the failure mode
    // is the one this whole block exists to prevent: a work count declared confidently from a default nobody set.
    const insetAx = rasterInsetAxes(p);
    if ([p.depth, p.stepdown, p.w, p.h, p.toolDia, p.stepoverPct, p.stepover, p.helixPitch,
        insetAx.x, insetAx.y].some(live)) return null;
    // t1404 — the pass counts below multiply the AREA, and the area the walk covers is the INSET one. Reading the
    // given rect here would over-declare the work by two insets' worth of rows on every consumer that passes one.
    // t1490 — each axis by its own inset, so an anisotropic walk declares the work it actually does.
    const inX = Math.max(0, num(insetAx.x, 0)), inY = Math.max(0, num(insetAx.y, 0));
    const w = num(p.w, 100) - 2 * inX, h = num(p.h, 80) - 2 * inY;
    const depth = num(p.depth, 0.5), stepdown = Math.max(0.01, num(p.stepdown, 0.5));
    const tool = Math.max(0.1, num(p.toolDia, 12));
    const step = Math.max(0.01, tool * stepoverPctOf(p, tool) / 100);
    const levels = Math.max(1, Math.ceil(depth / stepdown));
    // The SAME two count formulas the macro emits (see `count` in each walk) — rows that FIT, or rings before the middle
    // closes — so a change to either shows up here rather than drifting out of sight.
    const concentric = String(p.strategy || '') === 'concentric';
    // t1429 — the row count is counted in the span the rows step ACROSS, which the row axis chooses. `concentric` has
    // no rows to turn, so its shorter-side count is unaffected — the same asymmetry SURFACE_RASTER_AXES already declares.
    // t1492 (C1) — and the ROW ARM now has two forms, because the walk does. A wall-anchored walk cuts the passes
    // from the near wall PLUS the forced final one, which is one more pass than the fit rule declares on the same
    // span — so a declaration still reading the fit formula would under-count every slot-shaped job by exactly the
    // pass the clamp adds. The formulas are the ones the macro emits, which is what keeps this a declaration.
    const crossSpan = rasterRowAxisOf(p) === 'y' ? w : h;
    const passes = concentric
        ? Math.max(1, Math.floor((Math.min(w, h) - 0.001) / (2 * step)) + 1)
        : (rasterRowAnchorOf(p) === 'wall'
            ? Math.max(2, Math.floor((crossSpan - 0.001) / step) + 2)
            : Math.max(1, Math.floor((crossSpan - step / 2) / step) + 1));
    /**
     * ── t1440 — RE-CALIBRATED AGAINST THE ENGINE'S OWN STEP COUNT, BY DIFFERENCING ────────────────────────────────
     *
     * Every constant below was solved from REAL executed-step counts rather than counted off the emitted text, and
     * that distinction is the whole finding. The old numbers counted BODY LINES; a walk's body is full of forks, and
     * only one arm of each fork executes per pass. So `20` for the both-ways row was the number of lines you can SEE
     * and `13` is the number the controller actually runs.
     *
     * HOW: emit the body, run it through `GcodeExecutionEngine.trace` with the step call instrumented, and difference
     * two areas at one depth (isolating the per-pass term) against two depths at one area (isolating the per-level
     * term and the header). Nine (strategy × direction × entry) configs, all agreeing on a header of 16.
     *
     *     walk                 per pass   was      per level (plunge)   was
     *     parallel/bothways       13       20              12            12
     *     parallel/oneway         11       11 ✓             6            12
     *     concentric              12       14               9            12
     *
     * t1418's `11` for the one-way row was RIGHT — it was the one number derived by counting what executes rather
     * than what is written, and the audit confirms it untouched. The other two were overstatements in the SAFE
     * direction (the cap drew more than needed, never less), which is why nothing ever surfaced them.
     *
     * ⚠ THE DESCENT'S HELIX TERM WAS UNDER-DECLARED, and that is the one on the WRONG side. `* 10` per segment
     * against a measured 10.46 (251 steps for a 24-segment revolution) meant a deep helix declared less work than it
     * does — the direction that TRUNCATES a preview. It is 11 now: measured, rounded UP, and the residual over-
     * declaration is 13 steps per level flat, which the assertions below pin.
     *
     * THE MODEL CHANGED SHAPE, not just its numbers: the level overhead is per-WALK (a both-ways level does more
     * branching than a one-way one) and the descent cost is walk-INDEPENDENT (+0 plunge / +6 ramp / +11 per helix
     * segment on all three, measured identical). One flat `PER_LEVEL = 8` could not express that, which is why it
     * was absorbing the error.
     */
    const dirKey = concentric ? 'concentric' : (rasterIsOneWay(rasterDirectionOf(p)) ? 'oneway' : 'bothways');
    const PER_PASS = { bothways: 13, oneway: 11, concentric: 12 }[dirKey];
    const PER_LEVEL = { bothways: 12, oneway: 6, concentric: 9 }[dirKey];
    // THE DESCENT is per LEVEL, not per pass, and only the helix is large: it is a 24-segment-per-revolution polyline.
    const entry = String(p.entry || '');
    const descent = entry === 'helix'
        ? Math.max(24, Math.ceil(stepdown / Math.max(0.001, num(p.helixPitch, 1))) * 24) * 11
        : entry === 'ramp' ? 6 : 0;
    return 16 + levels * (PER_LEVEL + descent + passes * PER_PASS);
}

export function surfaceRasterLines(p = {}) {
    /**
     * ── t1404 — THE DECLARED INSET: the walk runs INSIDE the rect the op declares ────────────────────────────────
     *
     * Surfacing faces a top: the sweep IS the rect, the tool overhangs the edge, and `inset` stays 0 — every line
     * below then collapses to exactly what it emitted before, asserted byte-for-byte. A POCKET is the other case:
     * the op occupies its outline but the tool centre may only reach a radius inside it, so the thing walked and the
     * thing occupied are two different rectangles.
     *
     * WHY A PARAM AND NOT "just pass the smaller rect": because `extent` — which the place fold reads in preference
     * to its own frozen snapshot — would then declare the SMALL one, and t1402 measured what that does: a placed
     * pocket slid by exactly the tool radius, because the placement aligned the tool-centre sweep where it should
     * have aligned the pocket. Splitting them makes footprint and walk agree BY CONSTRUCTION rather than by the
     * caller remembering: `extent` keeps declaring the GIVEN rect, the walk takes the inset one, and one number
     * relates them. Its VALUE is never re-derived here — the consumer passes what `pocketInsetRegion` already
     * computed, which is the one source for what a pocket's inset MEANS (t1402: the dispatch's `r + wallOffset` and
     * the shipped `r − wallOffset` disagree in sign, and the shipped one is the one that has always run).
     */
    /**
     * ── t1425 — THE GEOMETRY TERMS. Each is a register OR a build-time number; see geoTerm for the defect ─────────
     * Every `.n` below is EXACTLY the number this file computed before (same defaults, same floors), so the baked
     * path is unchanged by construction; `.w` is what the seed prints, which is the only thing a live input moves.
     */
    /**
     * ── t1490 (C2) — TWO INSETS, FOLDED INTO THE TWO SPAN SEEDS. See `rasterInsetOf` for what along/across mean ───
     *
     * The pair lands here and NOWHERE ELSE: everything downstream reads `wT`/`hT`/`oxT`/`oyT`, which is why the arc
     * costs this at 0 registers — the insets fold into #40/#41, which already carry the walked spans, exactly as a
     * single live inset has folded since t1425. Two of them fold the same way twice.
     *
     * ⚠ THE SINGLE-INSET CASE IS BYTE-IDENTICAL BY CONSTRUCTION, not by promise: when a caller passes only `inset`,
     * `rasterInsetAxes` hands the SAME word to both axes, so `iXT` and `iYT` are the same term and every expression
     * below folds exactly as it did. That is the design's own stay-clause, and the identity sweep asserts it.
     */
    const insetW = rasterInsetAxes(p);
    const iXT = geoTerm(insetW.x, 0, 0), iYT = geoTerm(insetW.y, 0, 0);
    const xT = geoTerm(p.x, 0), yT = geoTerm(p.y, 0);
    const wT0 = geoTerm(p.w, 100), hT0 = geoTerm(p.h, 80);
    const toolT = geoTerm(p.toolDia, 12, 0.1);
    // the WALKED rect: the declared one held its own inset inside on each axis
    const wT = geoSum(wT0, iXT, -2), hT = geoSum(hT0, iYT, -2);
    const inset = iXT.n;
    const insetOn = iXT.live || iXT.n > 0 || iYT.live || iYT.n > 0;
    // A REGISTER IS NAMED, never printed as though it were a millimetre value ("the #22mm inset" reads as 22mm).
    // The NUMERIC wording is byte-for-byte what this file has always emitted -- caught by the identity sweep when a
    // first cut reworded both at once, which is exactly what that sweep is for.
    // t1490 — the SAME wording whenever the two agree (which is every caller that exists today, so the corpus does
    // not move); when they differ the sentence names BOTH, because "held 3mm inside the declared edge" would be a
    // wrong operator message on a walk held 3mm one way and 0mm the other — the class this file guards hardest.
    const evenInset = iXT.w === iYT.w;
    const heldOf = (t) => (t.live ? `the ${t.w} inset` : `${t.w}mm`);
    const sayOf = (t) => (t.live ? `${t.w} inset` : `${t.w}mm inset`);   // a live inset IS an inset — reading `> 0` off a register gave 0 and silently faced the part
    const insetHeld = evenInset ? heldOf(iXT) : `${heldOf(iXT)} in X and ${heldOf(iYT)} in Y`;
    const insetSay = evenInset ? sayOf(iXT) : `${sayOf(iXT)} in X / ${sayOf(iYT)} in Y`;
    const LBL = labelsOf(p);   // t1408 — the emitter's per-program label assignment (the legacy numbers when called direct)
    const w = wT.n, h = hT.n;
    const depth = num(p.depth, 0.5), stepdown = Math.max(0.01, num(p.stepdown, 0.5));
    const tool = toolT.n;
    // ONE DERIVATION, shared with the CAM slot and the wizard stack: stepover is tool Ø × %. A caller still carrying
    // a flat mm has it recovered against the tool it will run — through `stepoverPctOf` above, which is now the only
    // place that rule is written down (t1363).
    const pct = stepoverPctOf(p, tool);
    // t1425 — the stepover's two words, on the SAME liveWord-or-number pattern the depth/stepdown seeds have used
    // since t1399. `stepoverPctOf` stays purely numeric (four build-time readers depend on that, t1363) — the live
    // case is a seed decision, not a second reading of what a stepover MEANS.
    const pctW = liveWordOf(p.stepoverPct) || String(r3(pct));
    const stepLive = toolT.live || !!liveWordOf(p.stepoverPct);
    // t1399 — feed AND plunge ride val(): each appears ONLY as a bare `F<word>` interpolation (checked - neither is
    // read by any arithmetic, they are threaded through as opts and printed), so a #var survives and a literal still
    // prints exactly what r3() printed. `plunge` is not in the dispatch's example list, but it is the same construct
    // and the dispatch's CRITERION is the walk's arithmetic - which neither touches. Applying the rule, not the list.
    const feed = val(p.feed, 2000), plunge = val(p.plunge, 200);
    /**
     * ── t1429 — THE RETRACT HEIGHT IS A GEOMETRY TERM TOO, and it was the ONE live knob still landing on the floor ──
     *
     * MEASURED at t1427, on the seeding the delegation is about to do: `POCKET_FIELDS.clearance` is a register the
     * shipped slot honours today (`rasterClear` takes it), and handing it here as `clearance: '#10'` emitted
     * `G0 Z5` — this atom's own DEFAULT — at every retract in the program, because `num(word, 5)` returns the
     * default and `az()` folds it at build time. Not a refusal and not a NaN: an operator dialling a 12mm retract
     * would have got 5mm on every lift. Exactly the silent substitution t1425 closed for w/h/tool/stepover/inset,
     * one knob further down, and it is closed the same way rather than a second way.
     *
     * `clearance` is deliberately NOT in `BAKES_GEOMETRY`: it is a Z-only retract that no descent's baked geometry
     * reads (a ramp bakes its run to the area CENTRE, a helix its inradius — both XY), so a dialled clearance is
     * honoured on every (strategy, entry) row including the two that refuse a dialled area.
     */
    const clrT = geoTerm(p.clearance, 5);
    const clr = clrT.n;
    // t1425 — this was a local copy of the same test; it is now `liveWordOf` at module scope, because the envelope's
    // live-geometry refusal has to ask the identical question and two copies of "is this knob dialled or typed" is
    // exactly the split this file keeps closing.
    const liveWord = liveWordOf;

    // t1351 — THE ATOM CARRIES ITS OWN FRAME. x0/y0 were always here; z0 is new, and it is what makes the frame
    // COMPLETE: the surface the depths are measured down from. Together they are the placement shift, absorbed as
    // PARAMS instead of applied to the emitted text afterwards (t1349 measured what the text rewrite does to
    // expressions and registers — a half-shifted move and a corrupted comment). At the zero frame every expression
    // below collapses to exactly what it emitted before, which the bridge asserts byte-for-byte.
    // t1404 — x0/y0 are the WALK's origin, so the inset moves them in on both axes. `extent` below still reads the
    // block's own x/y/w/h, which is what keeps the declared footprint the GIVEN rect. At inset=0 these are unchanged.
    // t1425 — the WALK's origin: the op's own frame moved IN by the inset. Both may now be registers, so the origin
    // is a word-or-number like everything else; `.n` is the number this line always produced.
    // t1490 (C2) — each axis moves in by its OWN inset; at an even pair this is the single-inset expression verbatim
    const oxT = geoSum(xT, iXT), oyT = geoSum(yT, iYT);
    const x0 = oxT.n, y0 = oyT.n, z0 = num(p.z0, 0);
    const confirmEvery = Math.max(0, Math.round(num(p.confirmEvery, 0)));
    const zTop = r3(z0);   // the surface this op faces from — 0 in the op's own frame, the placement's offZ when placed

    /**
     * t1355 — ONE BODY, TWO FRAMES. Every coordinate below is "the op's origin PLUS an offset". What changes between
     * the placed body and the SKIM body is only what the origin IS: a build-time number, or a register the machine
     * fills in at run time from wherever the operator jogged to.
     *
     * `ax(rel)` folds the sum at build time when the origin is a number — so a placed op emits `X3.6`, byte-for-byte
     * what it emitted before this existed. When the origin is a REGISTER the sum cannot be folded, so it stays an
     * expression the controller evaluates: `X[#35 + 3.6]`. `axE()` is the same idea for an offset that is itself a
     * runtime term (`#40`, `#44`), which is why the placed body already wrote `X[0 + #40]`.
     *
     * All the build-time GEOMETRY is frame-independent and needs no version: a distance-to-centre, a unit vector, a
     * ring inset and the rotation constants are the same numbers wherever the origin sits. That is what makes this a
     * substitution rather than a second emitter.
     */
    const skim = String(p.zMode || '') === 'skim';

    /**
     * ── t1375 — THE PROGRAM ROTATION, ABSORBED ───────────────────────────────────────────────────────────────────
     *
     * A declared program-level rotation used to be applied to the emitted TEXT after every op had emitted, and that
     * cannot act on a body whose coordinates are registers: rotation COUPLES the axes, so a move it can only
     * half-rewrite gains a second axis word — uncommanded motion on a cutting line (t1353's measurement). So the angle
     * arrives as a PARAM, exactly as the placement frame and the skim mode already do, and this body bakes it.
     *
     * WHY SIX DECIMALS, AND NOT THE HELIX'S NINE (derived t1371): per coordinate the rotation is two multiplies by a
     * baked constant and one add, ONCE — `x' = x0 + c·ex − s·ey` — with no recurrence, so nothing compounds. Rounding
     * c,s to d decimals bounds the coordinate error by `(|ex|+|ey|)·5·10^−(d+1)`; at 500mm offsets, far beyond any
     * faced area, d=6 gives 5·10⁻⁴ mm — HALF the emit's own 0.001mm quantum, so it cannot tip a rounded digit. The
     * helix needs nine because its constants multiply a vector that is fed back 24 times; these multiply once.
     */
    const rotA = num(p.rotAngle, 0);
    // t1381 — the printers below now come from `affineFrame`, ONE source shared with the drill family's folded atom
    // (which needs the identical axis mix for the identical reason: its pattern points are runtime registers). The
    // arithmetic is unchanged and asserted byte-identical; only its home moved. See affineFrame.js for the derivation.
    /**
     * ── t1425 — THE FRAME MAY NOW BE RUNTIME FOR A SECOND REASON ─────────────────────────────────────────────────
     *
     * `affineFrame`'s live frame is EXISTING machinery, not new: it is how SKIM has read `#62/#63/#64` since t1355.
     * A live geometry origin is the same shape with a different source — the slot's `#20/#21` offset registers plus a
     * live tool-radius inset — so this reaches for the precedent rather than a second mechanism.
     *
     * ⚠ SKIM IS LEFT EXACTLY AS IT WAS, INCLUDING A GAP IT ALREADY HAD. A skim frame drops x0/y0 entirely — `ax()`
     * returns `#62`, never `#62 + x0` — so a skim body with an INSET has always ignored that inset. Folding the inset
     * in is arguably the more correct reading, and the first cut of this change did exactly that; the byte-identity
     * sweep caught it as a real difference on `skim × inset 3` and it is NOT this act's to make. The combination is
     * unreachable in the product (surfacing is the only op that skims and it never insets; a pocket insets and never
     * skims), so it is recorded as a named pre-existing gap and REFUSED in the live-geometry envelope rather than
     * quietly changed here. Preserving it keeps proof 1 — the baked path byte-identical — an honest claim.
     */
    const frameXW = skim ? SKIM_FRAME.x : oxT.w;
    const frameYW = skim ? SKIM_FRAME.y : oyT.w;
    const liveFrame = skim || oxT.live || oyT.live;
    const { F, ax, ay, az, axE, ayE, azE, TM, AX, mv, rot } = affineFrame({
        x0, y0, zTop, live: liveFrame ? { x: frameXW, y: frameYW, z: skim ? SKIM_FRAME.z : String(zTop) } : null,
        rotAngle: rotA, rotPivotX: num(p.rotPivotX, 0), rotPivotY: num(p.rotPivotY, 0),
        absorbs: surfaceRasterAbsorbsRotation(p) === true,
    });

    // t1429 — THE ONE RETRACT WORD, printed once and read by every lift (the header's two and the one-way walk's).
    // A NUMBER takes the identical old path — `az(clr)`, same fold, same bytes. A REGISTER rides the frame's own Z
    // printer, so the retract reads `[<zTop> + <clr>]` and a placed op keeps its surface in the sum for free.
    // …and a retract measured from a ZERO surface is just the retract: `G0 Z[0 + #9]` is correct and is noise, and it
    // would sit one line from the same program's `G0 Z#9` where a slot writes its own. A placed or skim body keeps the
    // sum, because there the surface is a real term.
    const zClr = !clrT.live ? az(clr) : (F.z === '0' ? clrT.w : azE(`+ ${clrT.w}`));

    // THE STRATEGY DECIDES THE WALK, under the SAME header and the SAME depth loop — the loop that counts levels
    // does not care what happens inside it, which is why adding a strategy is a new walk and not a new emitter.
    const stepBaked = tool * pct / 100;   // the stepover AT BUILD VALUES — what the baked ramp geometry is computed for
    const opts = { x0, y0, zTop, w, h, feed, plunge, clr, zClr, r3, F, ax, ay, az, axE, ayE, azE, entry: p.entry || 'plunge', rampAngle: num(p.rampAngle, 3),
        helixDia: num(p.helixDia, 0), helixPitch: num(p.helixPitch, 1), toolDia: tool, stepBaked,
        direction: rasterDirectionOf(p),   // t1418 — the row walk reads it; ringWalk does not, and SURFACE_RASTER_AXES says so
        rowAxis: rasterRowAxisOf(p),       // t1429 — likewise: the ROW walk reads it, ringWalk has no rows to turn
        // t1492 (C1) — RESOLVED HERE, at the seed, with the other two walk words. The first cut left it out of this
        // object and read it off `o` inside the walk, where it was undefined and silently fell to 'fit' — the exact
        // t1402 shape (ringWalk never destructured `entry`, so a ramp selection emitted a plunge in released code).
        // Caught by the slotPath bridge on the first run rather than by reading the code, which is why the bridge is
        // written before the capability is trusted.
        rowAnchor: rasterRowAnchorOf(p),
        wT, hT, geoLive: wT.live || hT.live,   // t1425 — the ring count resolves its min at RUN time when either side is live
        liveGap: surfaceRasterLiveGap(p),      // t1425 — a descent that bakes geometry degrades honestly rather than baking against a dial
        rot, mv, AX, TM, LBL };   // t1375 — the rotation goes through the ONE move printer, so each walk declares points, not words
    const walk = (p.strategy === 'concentric') ? ringWalk(opts) : rowWalk(opts);

    // THE SKIM PREAMBLE. Seed an impossible value, read the frame, then REFUSE if it did not arrive — before any
    // motion at all. A position of 0 is perfectly legal (the operator may jog to the WCS origin), so the sentinel is
    // a value no axis can hold rather than a falsy test: the thing being detected is "the read did not happen".
    const preamble = !skim ? [] : [
        '( ---- SKIM: the frame is READ from the machine, never assumed ---- )',
        `${SKIM_FRAME.x}=${FRAME_SENTINEL}   ( sentinel: no axis can be here, so an unread frame is visible )`,
        `${SKIM_FRAME.y}=${FRAME_SENTINEL}`,
        `${SKIM_FRAME.z}=${FRAME_SENTINEL}`,
        `${SKIM_FRAME.x}=${FRAME_SRC.x}   ( live work X — wherever the operator jogged to )`,
        `${SKIM_FRAME.y}=${FRAME_SRC.y}   ( live work Y )`,
        `${SKIM_FRAME.z}=${FRAME_SRC.z}   ( live work Z — the touched surface )`,
        `IF ${SKIM_FRAME.x} == ${FRAME_SENTINEL} GOTO${LBL.skimErrLabel}   ( no frame -> refuse, with the tool still up )`,
        `IF ${SKIM_FRAME.y} == ${FRAME_SENTINEL} GOTO${LBL.skimErrLabel}`,
        `IF ${SKIM_FRAME.z} == ${FRAME_SENTINEL} GOTO${LBL.skimErrLabel}`,
        '',
    ];
    const refusal = !skim ? [] : [
        `GOTO${LBL.skimOkLabel}`,
        `N${LBL.skimErrLabel}`,
        '#1505=1   ;ERROR: could not read the live position - skim needs the jog frame',
        `N${LBL.skimOkLabel}`,
    ];

    return [
        ...preamble,
        // t1383 — the DECLARED work rides in this header (a token in a comment already emitted, so no line index moves).
        // t1399 — the token is OMITTED when the work cannot be known (a live depth/stepdown), never written wrong.
        // ── t1406 — THE OPERATOR SENTENCE FOLLOWS THE JOB, and only when there IS a second job ──────────────────────
        // At inset 0 every word below is the byte-for-byte text surfacing has always emitted. At inset > 0 the op is a
        // POCKET, and two of these sentences would be lies on a machine: it is not "surfacing", and the tool most
        // certainly does not overhang the edge — not overhanging it is the entire point of the inset. This project
        // treats a wrong operator message as a gate-1 defect rather than a cosmetic one (t1404's collapse guard got
        // its own label for exactly this reason), and the man reading the program at the pendant cannot see which
        // wizard produced it. Keyed on `inset > 0` so the surfacing path is untouched and asserted byte-identical.
        `( ---- ${insetOn ? 'AREA CLEARING' : 'SURFACING'}, parametric. Every var below speaks; change one and the loops re-derive.`
            + `${surfaceRasterWorkSteps(p) == null ? '' : ' · ' + workMarker(surfaceRasterWorkSteps(p))} ---- )`,
        `${V.w}=${wT.w}   ( area X — ${insetOn ? `the tool-CENTRE sweep, held ${insetHeld} inside the declared edge` : 'the tool-CENTRE sweep, so the tool overhangs the edge'} )`,
        `${V.h}=${hT.w}   ( area Y )`,
        // ── t1399 — THE TWO LIVE KNOBS, and the seed is a WORD-OR-NUMBER rather than a plain val() ─────────────────
        // A live `#var` rides verbatim; a numeric takes the SAME path it always did, floor included. That distinction is
        // not pedantry: `stepdown` is floored at 0.01 before printing, so a plain `val()` would have emitted `#43=0` for
        // a typed zero where this file has always emitted `#43=0.01` — a byte change AND a behaviour change (0.01 crawls,
        // 0 hits the refusal). Measured against HEAD rather than assumed. The floor is a BUILD-time protection for a baked
        // zero and cannot apply to a value that does not exist yet, which is exactly the holecycle precedent (t1389).
        //
        // THE LIVE CASE IS SAFE BY A GUARD THAT WAS ALREADY HERE: `IF #43 <= 0 GOTO91` sits four lines below and reads the
        // REGISTER at run time. It was written for a baked zero and covers a dialled one unchanged — so unlike holecycle,
        // this atom needed no new refusal, only the check that the existing one reaches the new path.
        `${V.depth}=${liveWord(p.depth) || r3(depth)}   ( total depth to ${insetOn ? 'clear' : 'face off'} )`,
        `${V.stepdown}=${liveWord(p.stepdown) || r3(stepdown)}   ( bite per level )`,
        // t1425 — the composition is UNCHANGED (`[tool * pct / 100]`, the shape the CAM slot derives too); only the
        // two operands may now be registers, so dialling either at the machine re-derives the stepover there.
        `${V.step}=[${toolT.w} * ${pctW} / 100]   ( stepover mm = tool Ø ${toolT.w} x ${pctW}% — the CAM derives it the same way )`,
        `IF ${V.step} <= 0 GOTO${LBL.errLabel}   ( a zero stepover divides by zero below; refuse cleanly instead of looping forever )`,
        `IF ${V.stepdown} <= 0 GOTO${LBL.errLabel}`,
        // t1404 — AN INSET CAN EAT THE AREA, and a collapsed rect walks an inverted ring rather than failing loudly.
        // Emitted only when an inset is actually declared, so the zero case stays byte-identical; and it gets its own
        // label + message because refusing through GOTO91 would tell the operator the STEPOVER was zero, which is a
        // wrong operator message — the thing this project treats as seriously as wrong motion.
        ...(insetOn ? [
            `IF ${V.w} <= 0 GOTO${LBL.insetErrLabel}   ( the ${insetSay} leaves no width to clear )`,
            `IF ${V.h} <= 0 GOTO${LBL.insetErrLabel}`,
        ] : []),
        ...walk.count,
        '',
        `${V.z}=0   ( the level being cut )`,
        `G0 Z${zClr}   ( clear before the first plunge )`,
        `WHILE [${V.z} < ${V.depth}] DO1   ( depth: one pass per level, the last bite clamped to the total )`,
        `  ${V.z}=[${V.z} + ${V.stepdown}]`,
        `  IF ${V.z} > ${V.depth} THEN ${V.z}=${V.depth}`,
        ...walk.body,
        `  G0 Z${zClr}   ( clear of the work before the next level )`,
        // t1335 — CONFIRM EVERY N LEVELS. The pause word is M00 with the operator sentence the literal path already
        // uses, matched rather than modernised: the machine's own convention is not something to improve in passing.
        // It fires after every Nth level EXCEPT the last — a pause after the final pass would stop the program on a
        // finished part. `#48` is free here: the row/ring index is spent by the time the level ends.
        ...(confirmEvery > 0 ? [
            `  ${V.i}=[${V.z} / ${V.stepdown}]   ( which level just finished )`,
            `  IF ${V.z} >= ${V.depth} GOTO${LBL.confirmLabel}   ( the last pass needs no pause — the part is done )`,
            `  IF [${V.i} / ${r3(confirmEvery)} - FIX[${V.i} / ${r3(confirmEvery)}]] > 0.001 GOTO${LBL.confirmLabel}   ( not an Nth level )`,
            '  M00   ( pause - press Cycle Start to resume )',
            `  N${LBL.confirmLabel}`,
        ] : []),
        'END1',
        `GOTO${LBL.okLabel}`,
        `N${LBL.errLabel}`,
        '#1505=1   ;ERROR: stepover / stepdown must be greater than zero',
        `N${LBL.okLabel}`,
        ...(insetOn ? [
            `GOTO${LBL.insetOkLabel}`,
            `N${LBL.insetErrLabel}`,
            `#1505=1   ;ERROR: the ${insetSay} leaves no area to clear - the tool is too large for this feature`,
            `N${LBL.insetOkLabel}`,
        ] : []),
        ...refusal,
    ];
}

/**
 * THE PARALLEL RASTER — rows across the area, in the DIRECTION the op asks for (t1418).
 *
 * BOTH-WAYS keeps the tool DOWN: cut across, step over AT DEPTH, come back — one plunge per level.
 * ONE-WAY cuts every row the same way: lift to clearance, rapid back to this row's start, re-plunge, cut. That costs
 * a lift/rapid/plunge triple per row and buys a consistent climb (`oneway`) or conventional (`otherway`) cut, which
 * is the entire reason an operator picks it.
 *
 * ── WHY THIS EXISTS NOW, AFTER BEING DELETED ONCE ────────────────────────────────────────────────────────────────
 * t1331 listed `direction: 'oneway'` as an uncovered gap; t1333 corrected that to "not a gap" because `surfacingStack`
 * hard-codes `bothways`, and the parametric one-way walk written then was DELETED as machinery for a case the op did
 * not have. That was right for surfacing and it stopped being right at t1406, when a POCKET — which has a real
 * `direction` param the operator sets — started riding this atom. t1406 handled it by NARROWING: a one-way pocket kept
 * its literal fill and `pocketRasterGap` said so. This turn closes the capability instead of routing around it, so the
 * boundary clause empties and the atom carries the literal's whole three-word vocabulary.
 *
 * ── THE MIRROR IS THE SAME WALK WITH A SIGN, MEASURED BEFORE IT WAS BUILT (t1416's scout) ────────────────────────
 * `otherway` is `oneway` with the row's two ends swapped — nothing else differs, which is why both are taught in one
 * act rather than one being taught and the other left to re-word the boundary around. The scout's numbers on the
 * literal (80×60, Ø6 @40%, 3 levels): both-ways 92 cuts / 6 rapids, one-way 92 cuts / 94 rapids, 46 row cuts either
 * way. THE ROW SET DOES NOT MOVE — same rows, same Y, same extents; only the travel between them changes. And the
 * equal CUT COUNT is a trap worth naming: both-ways is 46 rows + 46 step-overs-at-depth, one-way is 46 rows + 46
 * PLUNGES, so a bridge comparing only cut counts would pass on a walk that never lifted. The discriminator is the
 * RAPIDS and the row directions, and the t1418 spec asserts those rather than the count.
 */
/**
 * THE LEVEL'S DESCENT — ONE SOURCE, ASKED BY BOTH WALKS (t1404).
 *
 * WHY THIS FUNCTION EXISTS AT ALL, since it is a three-way ternary that used to sit inline in rowWalk: because sitting
 * inline in rowWalk is precisely how `concentric` shipped with no descent. `ringWalk` never destructured
 * `entry`/`rampAngle`/`helixDia`/`helixPitch` — so a ramp or helix SELECTION on the rings emitted a straight plunge,
 * silently, in released code (measured at t1402: the literal cuts 2 ramping moves and 48 helical ones, the parametric
 * cut zero). A walk cannot forget a descent it has to ASK for by name, which is the whole reason this is a named thing
 * both callers reach rather than a branch one of them happens to contain.
 *
 * The literal kernel had this right from the start: `entryOrPlunge(ctx, x, y, plungeLines)` in clearing.js is called by
 * concentricRect and the row fill ALIKE, with the walk's own start point. This is that shape, parametric.
 *
 * `sx`/`sy` is the ONLY thing that differs between the two walks — the point the descent starts from and returns to.
 * The plunge case is byte-for-byte the line both walks emitted before, which is what keeps every working combination
 * (all of parallel, and concentric×plunge) unchanged.
 */
function descentLines(o) {
    /**
     * t1425 — THE HONEST DEGRADE, and why it exists beside a refusal that should already have caught this.
     *
     * The ENVELOPE refuses ramp/helix with dialled geometry (surfaceRasterLiveGap), and every consumer asks it. But
     * `surfaceRasterLines` is also callable directly, and this atom's own convention is that the emitter emits and
     * the envelope refuses — which is right for `strategy: 'adaptive'` (you get the parallel walk, nothing moves
     * wrongly) and NOT right here: a ramp built from default w/h against a pendant-dialled rect would cut a real
     * descent in the wrong place. So the emitter degrades to the plunge it can always do correctly, and SAYS SO in
     * the program. That is the literal kernel's own pattern — `( ramp Xdeg needs Ymm, first move Zmm -> plunge )` —
     * applied to a build-time impossibility instead of a run-time one.
     */
    const bakeGap = o.liveGap;
    if (bakeGap && (o.entry === 'ramp' || o.entry === 'helix')) {
        return [
            `    ( ${o.entry} entry degraded to a plunge - its geometry is baked and this area is dialled )`,
            `    G1 Z${o.azE('- ' + V.z)} F${o.plunge}   ( the ONE plunge of this level )`,
        ];
    }
    if (o.entry === 'ramp') return rampLines(o);
    if (o.entry === 'helix') return helixLines(o);
    return [`    G1 Z${o.azE('- ' + V.z)} F${o.plunge}   ( the ONE plunge of this level )`];
}

function rowWalk(o) {
    const { x0, y0, w, h, feed, plunge, zClr, r3, F, ax, ay, axE, ayE, azE, stepBaked, mv, AX, TM, LBL } = o;
    // t1418 — WHICH WALK. Anything that is not one of the two one-way words is the both-ways raster, which mirrors
    // exactly how `strategy` already resolves (anything not 'concentric' is the row walk) — the ENVELOPE is what
    // refuses an unknown word, not the emitter, so the two axes stay symmetric (the t1404 lesson).
    const reverse = o.direction === 'otherway';
    const oneWay = rasterIsOneWay(o.direction);
    // t1339 — THE LEVEL'S DESCENT. Plunge is the straight drop; RAMP runs at the declared angle and comes back.
    // t1483 — it runs along the DECLARED VECTOR below (the row's own cut direction), not toward the area centre:
    // see rampLines for what that retired. Only 1/tan is still baked, and the angle is a form field.
    // t1404 — the row start is handed DOWN now (it was assumed inside the descent builders); the value is unchanged.
    /**
     * ── t1429 — THE ROW AXIS, resolved into the FIVE things that actually differ ──────────────────────────────────
     *
     * Rows ∥ Y is not a second walk and it is not a rotation: it is THIS walk with its coordinate pair swapped. So the
     * axis is resolved ONCE, here, into the five names the body below reads — which span a row runs along, which one it
     * counts rows across, which printer each uses, and which order the pair reaches `mv`. Nothing downstream branches
     * on it again, because a second branch is how the row and the step-over come to disagree about which way is which.
     *
     * AT 'x' EVERY ONE OF THEM IS WHAT IT WAS, so the whole existing corpus is byte-identical by construction rather
     * than by a promise — the identity sweep asserts it, and the transposition bridge asserts the 'y' walk cuts the
     * 'x' walk's path on the transposed rect.
     */
    const yRows = o.rowAxis === 'y';
    const SPAN = yRows ? V.h : V.w;        // the register a row's LENGTH is read from
    const CROSS = yRows ? V.w : V.h;       // the register the rows step ACROSS — the one the row count is counted in
    const a0 = yRows ? y0 : x0;            // the origin along the row axis
    const alongAt = yRows ? ay : ax;       // origin + a build-time offset, on the ROW axis
    const alongE = yRows ? ayE : axE;      // origin + a runtime term, on the ROW axis
    const crossE = yRows ? axE : ayE;      // …and on the axis the rows step across (where #47 is computed)
    /** One move's two axis forms in X,Y order — the ONLY place the row axis reaches the printer. */
    const P = (along, across) => (yRows ? mv(across, along) : mv(along, across));
    // t1418 — an `otherway` level starts at the FAR end, so that is where its descent happens and returns to. This is
    // the literal's own rule: `onewayMoves` hands `entryOrPlunge` the row's `xs`, which is `xhi` when reversed. At
    // bothways/oneway the expression collapses to `x0` — byte-identical, asserted.
    // t1483 (C4) — THE DECLARED RUN VECTOR. The ramp used to derive its own direction (toward the area centre) and
    // its own limit (the baked distance to it). Both are DECLARED by the walk now, because the walk is the only thing
    // that knows where it is about to cut: a row leaves its start ALONG the row axis, and `reverse` is exactly the
    // flag that says which way. The limit is the row's LENGTH — a register the walk already reads for its far end —
    // so the guard stops being a baked number. Same shape the literal kernel has always handed `entryOrPlunge`.
    const runSign = reverse ? -1 : 1;
    // THE THREE POINTS THIS WALK VISITS, declared once as X/Y pairs so the rotation reads them rather than the text.
    // NEAR/FAR are the row's two ends; ROW is the row's cross-axis coordinate, which the body has already computed into
    // #47 as an ABSOLUTE (unrotated) coordinate — so its affine form is a bare register with no constant, and #47 keeps
    // meaning exactly what it means today whether the program rotates or not.
    const NEAR_X = () => AX(alongAt(), a0, []);
    const FAR_X = () => AX(alongE(0, SPAN), a0, [TM(SPAN)]);
    const ROW_Y = (word = V.y) => AX(word, 0, [TM(V.y)]);
    /**
     * ── t1485 (C4, completed) — THE DESCENT STARTS FROM THE WALK'S OWN DECLARED POINT, not from a rebuilt copy ────
     *
     * t1483 gave the ramp a declared run VECTOR and left its START a pair of build-time numbers, and dumping the real
     * emit under a dialled stepover is what showed the second half was still missing:
     *
     *     #47=[0 + #44 / 2 + #48 * #44]              the row's LIVE coordinate
     *     G0 X0 Y#47                                 the walk's own approach already rides it
     *     G1 X[0 + #34 * 1] Y[1.8 + #34 * 0] …       ⚠ the ramp descended at the BAKED 1.8
     *
     * The run vector fixed the axis the ramp RUNS ALONG and left the axis it SITS ON exactly as it was, so a dialled
     * stepover descended at a stale coordinate and the row then cut at `#47` — precisely the kinked entry the bake
     * existed to prevent. The mirror had the same hole one axis over: `otherway` started its ramp at the baked far
     * end, which for a dialled area is `num('#4', 100)` — the DEFAULT width, not the operator's.
     *
     * SO THE START IS DECLARED RATHER THAN RE-DERIVED. These three points are what the walk cuts; handing the descent
     * the same objects means the ramp cannot disagree with the row about where the row IS — not because both
     * expressions were kept in step, but because there is only one expression. That is the whole fix, and it is what
     * makes `SURFACE_RASTER_BAKES`'s two empty ramp rows a true statement instead of a hopeful one.
     *
     * The HELIX still takes its come-back-out point as NUMBERS (`sx`/`sy` below): it bakes the rect inradius anyway
     * and its two rows say so, so lifting only half of it would buy nothing and move a byte-identical descent.
     */
    const START_ALONG = reverse ? FAR_X() : NEAR_X();
    const alongN = reverse ? a0 + (yRows ? h : w) : a0;              // the same point as a NUMBER, for the helix
    const crossN = (yRows ? x0 : y0) + stepBaked / 2;                // …and its cross-axis half, the row-0 coordinate
    const descent = descentLines({ ...o,
        runSpan: SPAN, runUx: yRows ? 0 : runSign, runUy: yRows ? runSign : 0,
        startX: yRows ? ROW_Y() : START_ALONG, startY: yRows ? START_ALONG : ROW_Y(),
        sx: yRows ? crossN : alongN, sy: yRows ? alongN : crossN,
    });
    /**
     * THE STEP-OVER'S X — a value only a ROTATED build has to name. Unrotated, the step over at depth is a Y-only move
     * and leaving X modal is what keeps the tool down. Rotated, that same straight step is a DIAGONAL, so X must be
     * written; and where the previous row's cut ENDED is a runtime fact — `#49` has already flipped, so dir<0 means the
     * row before ran +X and finished at the FAR end.
     *
     * IT IS ARITHMETIC, NOT A BRANCH, and that was a correction made after measuring what a branch costs here. A branch
     * puts a second entry point in front of the line, and `applyModalFeed` folds F words with a LINEAR text walk: the F
     * on the branch-taken path gets dropped and that row then cuts at whatever feed was last set — the plunge feed. (That
     * fold is ALREADY branch-blind on the plunge→first-row path, which is a separate pre-existing defect recorded in the
     * work log; adding a second instance of it would have been building on top of it.)
     *
     * `#49` is only ever ±1 — seeded 1, negated once per row — so `w·(1−dir)/2` picks the end with no comparison inside
     * an expression, which is the construct t1339 found the tracer read wrong. It flattens to two products of exactly the
     * kind this body already emits (`#48 * #44`), so it needs no form the controller has not already been given.
     */
    const END_X = () => AX(null, a0, [TM(SPAN, 0.5), TM(`${SPAN} * ${V.dir}`, -0.5)]);
    /**
     * ── t1492 (C1) — THE ROW RULE IS DECLARED, AND ITS TWO FORMS CANNOT BE SPLIT ─────────────────────────────────
     *
     * FIT (the default, and every caller that exists today): rows sit at step/2 + i·step — half a stepover inside the
     * walked edge — and the count is how many of THOSE land inside. Right for surfacing (the tool overhangs the edge)
     * and for a pocket (a wall-finish pass follows), and byte-identical here by construction: the `fit` arm below is
     * the exact text this file has always emitted.
     *
     * WALL (what a slot needs): passes anchored ON the wall, plus a FORCED final pass clamped to the far wall, so the
     * finished channel is exactly the width that was typed.
     *
     * ⚠ THE PHASE AND THE CLAMP LAND TOGETHER OR NOT AT ALL, and that is measured, not stylistic. The arc re-measured
     * it at t1478: phase-corrected rows coincide with the slot kernel exactly when (width − tool) is a whole multiple
     * of the stepover; where it is NOT, the phased-but-unclamped last row OVERSHOOTS the far wall — +1.20mm at
     * 12×Ø6@40%, +1.20 at 16.8, +0.60 at 15 — every one in the OVERSIZE, destructive direction. So the phase ALONE is
     * worse than neither, and the clamp is not a refinement of it but its other half.
     *
     * ── HOW BOTH FALL OUT OF ONE COUNT AND ONE GUARD (verified against `slotPath` on all six arc widths) ──────────
     *
     *     n   = FIX[(span − 0.001)/step] + 2      rows from the near wall, PLUS the forced final one
     *     row = origin + i·step
     *     IF row > far wall THEN row = far wall
     *
     * At a WHOLE multiple the last loop row lands exactly ON the wall and the clamp is a no-op (span 12, step 2.4 →
     * −6,−3.6,−1.2,1.2,3.6,6). Where it is not, the clamp is what stops the overshoot (span 6 → −3,−0.6,1.8,[4.2→3]).
     * Both reproduce `slotPath` move for move. The −0.001 is the same collapse boundary the ring count already uses,
     * and it is what keeps the whole-multiple case from emitting the wall twice.
     */
    const wallAnchored = rasterRowAnchorOf(o) === 'wall';
    const FAR_WALL = crossE(0, CROSS);          // the far wall as this frame prints it
    const count = wallAnchored ? [
        `${V.n}=[FIX[[${CROSS} - 0.001] / ${V.step}] + 2]   ( passes: from the near wall, plus the FORCED final one on the far wall )`,
        `IF ${V.n} < 2 THEN ${V.n}=2   ( a channel narrower than one stepover still gets both walls )`,
    ] : [
        // THE ROW COUNT — not h/step rounded up. Rows sit at step/2 + i·step, so the count is how many of THOSE land
        // inside the area. The two formulas agree at 150/7.2 and 40/5 and disagree at 60/7.2 (8 rows, not 9), where
        // rounding up puts a row at 61.2 — off the far edge of a 60mm face, cutting air.
        // t1429 — counted in the CROSS span, which is `#41` for rows ∥ X and `#40` for rows ∥ Y. Same formula, and it
        // has to move with the axis: counting rows in the span they RUN along would give a row count for the wrong side.
        `${V.n}=[FIX[[${CROSS} - ${V.step} / 2] / ${V.step}] + 1]   ( rows that FIT: the last lands inside the area, not past it )`,
        `IF ${V.n} < 1 THEN ${V.n}=1   ( a face narrower than one stepover is still one row )`,
    ];
    const rowLines = wallAnchored ? [
        `    ${V.y}=${crossE(0, `${V.i} * ${V.step}`)}`,
        // THE CLAMP, and it is the half that keeps the channel from going OVERSIZE. Without it the last pass rides
        // past the wall by up to one stepover, into the material the operator did not ask to remove.
        `    IF ${V.y} > ${FAR_WALL} THEN ${V.y}=${FAR_WALL}   ( the final pass rides the far wall, never past it )`,
    ] : [
        `    ${V.y}=${crossE(0, `${V.step} / 2 + ${V.i} * ${V.step}`)}`,
    ];

    /**
     * ── t1418 — THE ONE-WAY WALK. Every row cut the same way; the tool LIFTS between them ─────────────────────────
     *
     * `#49` is not written at all here, and that absence is deliberate rather than an oversight: there is no direction
     * to flip, so the register that means "which way this row runs" would be a value nothing reads. The both-ways walk
     * keeps it, and the two never coexist.
     *
     * THE SHAPE IS THE LITERAL'S, LINE FOR LINE. `onewayMoves` descends at the FIRST row of the level and then, for
     * every row after it, emits exactly `G0 Z<clr>` · `G0 X<start> Y<row>` · `G1 Z<depth> F<plunge>` before the cut —
     * a plain plunge, never the ramp/helix. That is why the descent stays where it is (per LEVEL, at row 0) and the
     * inter-row triple below is a bare plunge: matching the reference means matching that asymmetry, not tidying it.
     *
     * IT NEEDS TWO LABELS, NOT SIX. The both-ways walk spends four of its six on choosing an END (`IF #49 < 0 …`);
     * with no flip there is nothing to choose, so `flowLabels` declares only the two this body writes. A label
     * reserved for a branch this config cannot take is a number nobody can account for (holecycle's own rule).
     */
    if (oneWay) {
        const FROM = () => (reverse ? FAR_X() : NEAR_X());
        const TO = () => (reverse ? NEAR_X() : FAR_X());
        return { count, body: [
            `  ${V.i}=0`,
            `  WHILE [${V.i} < ${V.n}] DO2   ( rows: counted above, so the area and the stepover decide how many )`,
            ...rowLines,
            `    IF ${V.i} > 0 GOTO${LBL.rowStepLabel}   ( already down: only the FIRST row of a level gets the descent )`,
            `    G0 ${P(FROM(), ROW_Y())}`,
            ...descent,
            `    GOTO${LBL.rowCutLabel}`,
            `    N${LBL.rowStepLabel}`,
            // THE COST OF ONE-WAY, in three lines: the tool lifts clear, rapids back to this row's start and drops
            // again. The both-ways walk links at depth in ONE line instead — that is the whole trade, and it is what
            // the operator buys when they pick a consistent cut direction over the fastest travel.
            `    G0 Z${zClr}   ( lift: a one-way pass never links at depth )`,
            `    G0 ${P(FROM(), ROW_Y())}   ( rapid back to this row's start — the same end as every other row )`,
            `    G1 Z${azE('- ' + V.z)} F${plunge}   ( re-plunge at this level's floor )`,
            `    N${LBL.rowCutLabel}`,
            `    G1 ${P(TO(), ROW_Y(null))} F${feed}   ( every row cut the SAME way — a consistent ${reverse ? 'conventional' : 'climb'} cut )`,
            `    ${V.i}=[${V.i} + 1]`,
            '  END2',
        ] };
    }

    return { count, body: [
        `  ${V.i}=0`,
        // EVERY LEVEL STARTS AT THE NEAR CORNER, going +X. Carrying the direction over from the previous level looked
        // tidier and is not what the machine does — with an odd row count level 2 would start at the far end and run
        // backwards. The equivalence bridge caught it at move 42 of 84.
        `  ${V.dir}=1   ( the raster restarts at the near corner for each level )`,
        `  WHILE [${V.i} < ${V.n}] DO2   ( rows: counted above, so the area and the stepover decide how many )`,
        ...rowLines,
        `    IF ${V.i} > 0 GOTO${LBL.rowStepLabel}   ( already down: step over at depth rather than lifting between rows )`,
        // WHICH END TO START AT — asked as a BRANCH, not as a comparison inside an expression. `[#49 < 0]` looked
        // like it would evaluate 0/1 and the tracer read it as a plain 1, putting the first plunge off the corner.
        `    IF ${V.dir} < 0 GOTO${LBL.rowFarLabel}`,
        `    G0 ${P(NEAR_X(), ROW_Y())}`,
        `    GOTO${LBL.rowStartLabel}`,
        `    N${LBL.rowFarLabel}`,
        `    G0 ${P(FAR_X(), ROW_Y())}`,
        `    N${LBL.rowStartLabel}`,
        ...descent,
        `    GOTO${LBL.rowCutLabel}`,
        `    N${LBL.rowStepLabel}`,
        // THE STEP OVER AT DEPTH — ONE line in both builds (see END_X above for why it is arithmetic and not a branch).
        `    G1 ${P(END_X(), ROW_Y())} F${feed}   ( step over at depth — the tool does not lift between rows )`,
        `    N${LBL.rowCutLabel}`,
        `    IF ${V.dir} < 0 GOTO${LBL.rowNearLabel}`,
        `    G1 ${P(FAR_X(), ROW_Y(null))} F${feed}`,
        `    GOTO${LBL.rowEndLabel}`,
        `    N${LBL.rowNearLabel}`,
        `    G1 ${P(NEAR_X(), ROW_Y(null))} F${feed}`,
        `    N${LBL.rowEndLabel}`,
        `    ${V.dir}=[0 - ${V.dir}]`,
        `    ${V.i}=[${V.i} + 1]`,
        '  END2',
    ] };
}

/**
 * THE RAMP DESCENT — toward the area centre, at the declared angle, then back to the start.
 *
 * WHAT IS BAKED AND WHY (the t1339 ruling, with its reasoning so the next reader does not have to reconstruct it):
 * the run needed is `drop / tan(angle)` and the midpoint is `start + (run / toC) · (centre − start)`. `tan(angle)`
 * is a build-time number — the angle is a form field, not a pendant knob — so `1/tan` is baked. `toC`, the distance
 * from the ramp start to the centre, is ALSO baked, and that one has a cost worth naming: the ramp start sits at
 * `y0 + step/2`, and `step` is the DERIVED stepover a pendant can change. Computing toC live would need SQRT, which
 * is UNVERIFIED on this controller (the linter's word list is an allow-list, not evidence; ATAN ships in the
 * alignment probe but proves only itself — V13_trig.nc is the decider).
 *
 * SO THE HAZARD IS REAL BUT BOUNDED: a baked toC under a pendant-edited stepover gives a kinked entry. It cannot
 * happen on the WIZARD path — that text is fixed at build values and consistent forever, which is what makes the
 * equivalence bridge true. It can only happen where a pendant edits the knob, i.e. a CAM SLOT — so the slot GATES
 * those knobs bake-only rather than this code guessing (see the entry gate in opCamMap).
 *
 * ── t1483 (C4) — ⚠ EVERYTHING ABOVE THIS LINE IS HISTORY NOW, and it is kept because the reasoning is what the fix
 * had to answer, not because it still describes the code. The TODO that stood here — "pendant-TRUE entries: the +X
 * declared run vector (no square root at all), or live-SQRT if V13 proves it" — IS THIS ACT, and it took the first
 * road. There is no baked toC and no baked unit vector below; the hazard those paragraphs describe cannot occur,
 * the two `SURFACE_RASTER_BAKES` ramp rows are empty, and the `opCamMap` entry gate no longer holds a ramp slot's
 * knobs bake-only. The SECOND half of that TODO (the true-arc helix) went a different way at t1472/t1474: helical
 * arcs are unattested on this controller family, so the helix keeps its polyline AND its inradius bake.
 */
function rampLines(o) {
    const { startLabel = 'row start', zTop, w, h, feed, plunge, rampAngle, r3, F, az, azE, rot, mv, AX, TM, LBL = LABEL_DEFAULTS } = o;
    const ang = Math.min(45, Math.max(0.5, rampAngle));
    const invTan = 1 / Math.tan(ang * Math.PI / 180);
    // t1404 — the start (where the plunge WOULD have happened) is GIVEN by the walk instead of assumed to be the first
    // row. It is the same fact the literal kernel passes to `levelEntry` as (x0,y0): a row walk hands its row start, a
    // ring walk hands the outer ring's corner. Assuming it here is exactly what left rings with no descent at all.
    // t1485 — and it arrives as the walk's declared AXIS FORMS rather than as two numbers, which is what stops the
    // ramp from re-deriving a point the walk has already moved (see `startX`/`startY` below).
    /**
     * ── t1483 (C4) — THE RUN VECTOR IS DECLARED BY THE WALK, AND THREE BAKED QUANTITIES DIE WITH IT ───────────────
     *
     * This ramp used to derive everything itself: the area CENTRE from (x0,y0,w,h), the DISTANCE to it as a
     * hypotenuse, and a unit vector from those. All three were build-time numbers computed from geometry a pendant
     * can dial — which is precisely why `SURFACE_RASTER_BAKES` carried the two ramp rows, and why t1339 named the
     * declared run vector as the answer that "needs no square root at all".
     *
     * The walk declares both now, because the walk is the only thing that knows where it is about to cut:
     *   DIRECTION — the row's own cut direction (±1 on the row axis, sign from `reverse`); the ring's is +X.
     *   LIMIT     — the row's LENGTH, a REGISTER the walk already reads for its far end (#40 / #41).
     *
     * So the hypotenuse is gone, the baked `toC` guard limit is gone, and the unit vector is now an AXIS vector —
     * ±1 and 0 — which needs no extra precision at all. What is left baked is `1/tan(angle)`, and the angle is a form
     * field rather than a pendant knob, which is the one thing the old row's `why` never objected to.
     *
     * ⚠ THIS IS AN IMPROVEMENT, NOT A MIGRATION, and it is the reason this act is bridged by RELATIONSHIP rather than
     * by byte-identity: a ramp along the row cuts a DIFFERENT set of moves from a ramp toward the centre. Everything
     * outside the descent is byte-identical and asserted so; inside, what is preserved is the angle, the drop, the
     * start point, the return to it, and the honest degrade.
     */
    const u6 = (n) => Math.round(n * 1e6) / 1e6;
    const ux = u6(num(o.runUx, 1)), uy = u6(num(o.runUy, 0));
    const runSpan = o.runSpan || V.w;                       // the LIVE register the run is measured against
    const runLabel = `${runSpan === V.h ? 'height' : 'width'} available along the pass`;
    /**
     * ── t1485 — THE START POINT IS THE WALK'S, and adding the run to it must not GROW A BRACKET ──────────────────
     *
     * `startX`/`startY` arrive as the walk's own declared axis forms — the same objects its row moves print — so the
     * ramp sits exactly where the row sits by construction (see rowWalk for the defect this closes). What is left
     * here is one composition: the ramp's far point is that start PLUS the run along this axis' component.
     *
     * It SPLICES into an existing bracket rather than wrapping one, because a start may already be an expression
     * (`[0 + #40]`, the live far end) and wrapping would give `[[0 + #40] + #34 * -1]`. Not because the controller
     * cannot nest — the ring count has emitted `FIX[[…] / [2 * #44]]` since t1333, and that was checked rather than
     * assumed — but because EVERY AXIS WORD this body prints is a flat sum, and `affineFrame`'s own `foldE` flattens
     * the frame origin for exactly that reason. This is that rule applied one level out, so the ramp's move stays the
     * shape the tracer, the linter and the man at the pendant have always read on a motion line.
     */
    const PLUS_RUN = (S, k) => AX(/^\[.*\]$/.test(S.word)
        ? `${S.word.slice(0, -1)} + ${V.run} * ${k}]`
        : `[${S.word} + ${V.run} * ${k}]`, S.c, [...S.terms, TM(V.run, k)]);
    // t1375 — the ramp's two points, declared. `toC` is a DISTANCE and the run is measured along the ramp, so both are
    // rotation-invariant and the guard above needs no version. What rotates is the ramp's DIRECTION — and because the
    // unit vector is a build-time coefficient on a runtime run length, the rotation folds straight into that
    // coefficient: one number per axis, exactly the shape the unrotated line already emits.
    const START_X = o.startX, START_Y = o.startY;
    const RAMP_X = PLUS_RUN(START_X, ux), RAMP_Y = PLUS_RUN(START_Y, uy);
    return [
        `    ${V.run}=[${V.stepdown} * ${r3(invTan)}]   ( ramp run = bite / tan(${r3(ang)}deg) — the tangent is baked; the angle is a form field, not a knob )`,
        // THE HONEST DEGRADE, kept from the literal kernel: when the run needed is longer than the distance available
        // along the declared vector, a ramp cannot be cut and the tool plunges instead — with the reason in the
        // program, not silently. t1483 — the limit is now the LIVE span register, so a dialled area moves it too;
        // this comparison used to be against a baked number and that is the whole of what C4 changed here.
        `    IF ${V.run} > ${runSpan} GOTO${LBL.rampPlungeLabel}   ( ramp needs more run than the ${runLabel} -> plunge )`,
        `    G0 Z${azE(`- ${V.z} + ${V.stepdown}`)}   ( down to the floor this level starts from )`,
        `    G1 ${mv(RAMP_X, RAMP_Y)} Z${azE(`- ${V.z}`)} F${feed}   ( ramp )`,
        `    G1 ${mv(START_X, START_Y)} F${feed}   ( back to the ${startLabel}, now at depth )`,
        `    GOTO${LBL.rampEndLabel}`,
        `    N${LBL.rampPlungeLabel}`,
        `    G1 Z${azE(`- ${V.z}`)} F${plunge}   ( the ramp did not fit — straight plunge )`,
        `    N${LBL.rampEndLabel}`,
    ];
}

/**
 * THE HELIX DESCENT — a descending helix at the area centre, then a cut back to the row start at depth.
 *
 * IT IS A POLYLINE, NOT AN ARC, and that is deliberate for the MIGRATION: the literal kernel emits 24 straight G1
 * segments per revolution, so matching it move-for-move keeps the safety argument mechanical. Emitting true G2/G3
 * arcs is better G-code and the tracer handles variable-fed arcs (measured at t1335) — it is the improvement turn's
 * job, with its own criteria, not a rider on a migration.
 *
 * ── THE ROTATION RECURRENCE, AND WHY 9 DECIMALS ──────────────────────────────────────────────────────────────────
 * Trig is UNVERIFIED on this controller, so the macro cannot call COS/SIN. Instead Studio bakes cos/sin of ONE
 * segment angle and the loop rotates a vector: x' = x·c − y·s, y' = x·s + y·c — four multiplies and two adds.
 *
 * A rotation constant is multiplied EVERY segment, so its rounding error COMPOUNDS. Rounding c,s to d decimals
 * gives each entry an error ≤ 5·10^−(d+1); the radial error grows by roughly 2·ε·R per step, so over one revolution
 * (24 steps) the worst case is ≈ 48·ε·R. At R = 50mm — larger than any realistic surfacing helix:
 *     6 decimals → ≈ 1.2e−3 mm   AT the emit's own 0.001mm rounding: a coordinate can tip to the wrong 3rd decimal
 *     9 decimals → ≈ 1.2e−6 mm   three orders below what the emit can express
 * So 9 it is. And the vector is RE-SEEDED at the start of every revolution, which caps the compounding at 24 steps
 * no matter how deep the descent runs. THE TWO ARE SEPARATE REQUIREMENTS: re-seeding alone still leaves 1.2e−3 at
 * 6 decimals, and 9 decimals alone would drift without bound on a deep descent. The bound holds only with both.
 */
function helixLines({ x0, y0, sx, sy, startLabel = 'row start', zTop, w, h, feed, plunge, helixDia, helixPitch, toolDia, r3, F, ax, ay, az, axE, ayE, azE, rot, mv, AX, TM, LBL = LABEL_DEFAULTS }) {
    const SEG = 24, theta = 2 * Math.PI / SEG;
    // NINE decimals — see the derivation above. r3 would be catastrophic here for exactly the reason t1339 found
    // one level down, and 6 is not enough either.
    const d9 = (n) => Number(n.toFixed(9));
    const c = d9(Math.cos(theta)), sn = d9(Math.sin(theta));
    const cx = x0 + w / 2, cy = y0 + h / 2;
    // t1404 — sx/sy: where the descent comes back OUT to, given by the walk (see rampLines).
    const inrad = Math.min(w, h) / 2;                   // rect inradius, the literal's own clamp source
    const wantR = helixDia > 0 ? helixDia / 2 : Math.max(0.1, toolDia) / 2;
    const R = Math.max(0.2, Math.min(wantR, inrad - 0.01));
    const pitch = Math.max(0.1, helixPitch);
    // t1375 — the helix's points. The rotating vector (#34,#35) is a VECTOR from the area centre, so under rotation its
    // two registers mix into each axis with the same coefficients everything else uses — the recurrence itself is
    // untouched, and its 9-decimal constants keep serving the only thing that compounds.
    const ENTRY_X = AX(ax(cx + R - x0), cx + R, []), ENTRY_Y = AX(ay(cy - y0), cy, []);
    const ARC_X = AX(axE(cx - x0, HX.vx), cx, [TM(HX.vx)]);
    const ARC_Y = AX(ayE(cy - y0, HX.vy), cy, [TM(HX.vy)]);
    const OUT_X = AX(ax(sx - x0), sx, []), OUT_Y = AX(ay(sy - y0), sy, []);
    /**
     * ── t1440 — WHOLE REVOLUTIONS, RULED ON THE GEOMETRY (the t1406 divergence, decided) ──────────────────────────
     *
     * This body rounds the REVOLUTION count UP (`FUP`); the literal kernel rounds the SEGMENT count to NEAREST
     * (`Math.round(max(1, depth/pitch) * 24)`). They agree wherever depth/pitch lands on a whole number of segments —
     * which is every surfacing default and every bridge config, which is why the split survived from t1345 to t1406
     * unnoticed. Outside that they cut different descents, and t1406 recorded it as pre-existing rather than deciding
     * it. DECIDED NOW, and on what the number MEANS rather than on which behaviour got here first:
     *
     * `pitch` IS A CEILING, NOT A TARGET. It is millimetres of descent per revolution — the axial engagement of a
     * helical entry, which is the quantity that loads the tool. Asking for 1mm/rev is asking for "no more than 1mm
     * per revolution"; a descent that takes LESS is gentler and always safe, one that takes MORE is the thing the
     * operator set the number to prevent.
     *
     * MEASURED, BOTH DIRECTIONS, because the decision rests on the asymmetry and not on the sizes:
     *   NEAREST-ROUND can EXCEED the ceiling, by up to ~2.1% (worst at just over one revolution: 1.0207 rev rounds
     *          to 24 segments = 1.000 rev, so the achieved pitch is 2.07% steeper than asked). Small — and a bound
     *          you are allowed to cross is not a bound.
     *   FUP can only FALL SHORT, by up to 50% (just over one revolution rounds to two, halving the pitch). Larger in
     *          magnitude, and entirely in the direction the operator is protected by. Its cost is TIME.
     *
     * So FUP stands — not because it is incumbent, but because a ceiling that can be exceeded is not doing the job
     * the parameter exists for. THE LITERAL'S NEAREST-ROUND IS THE LOSER and its history line is here: it was the
     * shipped behaviour of `helixPoints` and remains frozen in `/_test/literalPocketFill.js`, deliberately — the
     * bridge that measures the two apart now names this divergence as the FIX rather than as a difference.
     *
     * ⚠ A THIRD RULE EXISTS AND IS NOT TAKEN — surfaced, not shipped. Ceiling at the SEGMENT level
     * (`FUP[revs * 24]` rather than `FUP[revs] * 24`) also never exceeds the pitch, and undershoots by at most one
     * segment (~4%/rev) instead of up to 50%. It dominates on both stated criteria and costs one thing: the descent
     * ends MID-revolution, so the helix does not close its circle at the final depth. That is an emit-shape change
     * with its own bridge, and the ruling asked for a decision between the two that exist. Recorded for the ruling.
     */
    return [
        `    ${HX.segs}=[FUP[${V.stepdown} / ${r3(pitch)}] * ${SEG}]   ( segments: ${SEG} per rev, at ${r3(pitch)}mm per rev )`,
        `    IF ${HX.segs} < ${SEG} THEN ${HX.segs}=${SEG}   ( never less than one revolution )`,
        `    G0 ${mv(ENTRY_X, ENTRY_Y)}   ( the helix starts on its own radius, at the area centre )`,
        `    G0 Z${azE(`- ${V.z} + ${V.stepdown}`)}   ( the floor this level starts from )`,
        `    ${HX.vx}=${r3(R)}   ( the rotating vector, re-seeded every revolution so the drift cannot accumulate )`,
        `    ${HX.vy}=0`,
        `    ${HX.k}=0`,
        `    ${HX.rev}=0`,
        `    WHILE [${HX.k} < ${HX.segs}] DO3   ( one straight segment per step — a polyline helix, as the literal is )`,
        `      ${HX.k}=[${HX.k} + 1]`,
        `      ${HX.rev}=[${HX.rev} + 1]`,
        // RE-SEED: at the top of each new revolution the vector returns to its exact starting value, so the
        // compounding above can never run past 24 steps however deep the descent goes.
        `      IF ${HX.rev} <= ${SEG} GOTO${LBL.helixReseedLabel}`,
        `      ${HX.rev}=1`,
        `      ${HX.vx}=${r3(R)}   ( re-seed )`,
        `      ${HX.vy}=0`,
        `      N${LBL.helixReseedLabel}`,
        `      ${HX.tmp}=[${HX.vx} * ${c} - ${HX.vy} * ${sn}]   ( rotate by ${r3(360 / SEG)}deg: 4 multiplies, 2 adds, no trig )`,
        `      ${HX.vy}=[${HX.vx} * ${sn} + ${HX.vy} * ${c}]`,
        `      ${HX.vx}=${HX.tmp}`,
        `      G1 ${mv(ARC_X, ARC_Y)} Z${azE(`- ${V.z} + ${V.stepdown} - ${V.stepdown} * ${HX.k} / ${HX.segs}`)} F${feed}`,
        '    END3',
        `    G1 ${mv(OUT_X, OUT_Y)} Z${azE(`- ${V.z}`)} F${feed}   ( helix — out to the ${startLabel}, now at depth )`,
        `    IF ${V.z} > 0 GOTO${LBL.helixEndLabel}`,
        `    G1 Z${azE(`- ${V.z}`)} F${plunge}`,
        `    N${LBL.helixEndLabel}`,
    ];
}

/**
 * THE CONCENTRIC WALK — inset rectangles, inward. Pure arithmetic, as the literal kernel is: each ring is the area
 * shrunk by `inset` on every side, and the walk stops when a ring would collapse. The tool steps to the next ring on
 * a DIAGONAL CUTTING move and never lifts within a level — one plunge, like the both-ways raster.
 */
function ringWalk(o) {
    const { x0, y0, w, h, feed, clr, r3, F, ax, ay, axE, ayE, mv, AX, TM, LBL } = o;
    void clr; void F;   // t1485 — `ax`/`ay` stopped being spare: the ring now DECLARES its descent start with them
    // t1404 — THE DESCENT THE RINGS NEVER HAD. The outer ring's corner IS where the plunge happens (at i=0 the inset
    // register is 0, so IN_X/IN_Y are exactly x0/y0), so that is the point the ramp runs from and returns to — the same
    // point the literal kernel hands `entryOrPlunge` from `concentricRect`'s `first` branch.
    // t1483 (C4) — the ring's declared run vector is +X with the width span as its limit, and that is READ from the
    // walk below rather than assumed: the outer ring leaves its corner on `G1 (OUT_X, IN_Y)`, i.e. straight along +X
    // for the full width. A ring has no `reverse`, so there is no sign to take.
    // t1485 — and its START, declared in the same axis forms the row walk hands (there is no fallback inside the ramp
    // any more: a walk that does not say where it starts cannot get a guess). A ring's is the walk ORIGIN itself — at
    // i=0 the inset register is 0, which is the line above `descent` in the body below, not an unwritten invariant —
    // so these carry no term and print exactly the `X0 Y0` this descent has always printed.
    const descent = descentLines({ ...o, sx: x0, sy: y0, startLabel: 'ring corner', runSpan: V.w, runUx: 1, runUy: 0,
        startX: AX(ax(0), x0, []), startY: AX(ay(0), y0, []) });
    // t1375 — a ring's four corners, declared as X/Y pairs. The inset (#47) walks INWARD on both axes at once, so
    // under rotation it lands on both with mixed coefficients — which is why the pairs are declared together rather
    // than each axis owning its own string.
    const IN_X = () => AX(axE(0, RING_INSET), x0, [TM(RING_INSET)]);
    const IN_Y = () => AX(ayE(0, RING_INSET), y0, [TM(RING_INSET)]);
    const OUT_X = () => AX(axE(0, `${V.w} - ${RING_INSET}`), x0, [TM(V.w), TM(RING_INSET, -1)]);
    const OUT_Y = () => AX(ayE(0, `${V.h} - ${RING_INSET}`), y0, [TM(V.h), TM(RING_INSET, -1)]);
    return {
        count: [
            // THE RING COUNT — how many insets fit before the SHORTER side closes. The shorter side WAS resolved here
            // rather than in the macro because it is a fact about the AREA, not a dial the operator turns. The
            // −0.001 is the collapse BOUNDARY, not a fudge: at h exactly 2·k·step the k-th ring has zero height, and
            // the literal kernel does not walk it either (its `bx-ax < 1e-6` break is the same test).
            //
            // t1425 — AND THE MOMENT THE AREA *IS* A DIAL, THAT REASONING INVERTS. A pendant W/H makes the shorter
            // side a runtime fact, so it is resolved at run time: three lines, ONE comparison, and NO new register —
            // the min lands in `#45` itself and is then overwritten by the count computed from it. A separate temp
            // would have had to come from the descent's band (#34-#39), and a helix descent runs inside this very
            // walk, which is exactly the kind of sharing-by-unwritten-invariant t1375 spent a turn undoing.
            // The BAKED path below is untouched and asserted byte-identical.
            ...(o.geoLive ? [
                `${V.n}=${V.w}`,
                `IF ${V.h} >= ${V.w} GOTO${LBL.ringMinLabel}   ( the ring count is driven by the SHORTER side )`,
                `${V.n}=${V.h}`,
                `N${LBL.ringMinLabel}`,
                `${V.n}=[FIX[[${V.n} - 0.001] / [2 * ${V.step}]] + 1]   ( rings that FIT before the middle closes )`,
            ] : [
                `${V.n}=[FIX[[${r3(Math.min(w, h))} - 0.001] / [2 * ${V.step}]] + 1]   ( rings that FIT before the middle closes )`,
            ]),
            `IF ${V.n} < 1 THEN ${V.n}=1`,
        ],
        body: [
            `  ${RING_INSET}=0   ( how far in this ring sits )`,
            `  ${V.i}=0`,
            `  WHILE [${V.i} < ${V.n}] DO2   ( rings, inward )`,
            `    IF ${V.i} > 0 GOTO${LBL.ringStepLabel}`,
            `    G0 ${mv(IN_X(), IN_Y())}`,
            ...descent,
            `    GOTO${LBL.ringCutLabel}`,
            `    N${LBL.ringStepLabel}`,
            `    G1 ${mv(IN_X(), IN_Y())} F${feed}   ( diagonal step in to the next ring, still cutting )`,
            `    N${LBL.ringCutLabel}`,
            `    G1 ${mv(OUT_X(), IN_Y())} F${feed}`,
            `    G1 ${mv(OUT_X(), OUT_Y())} F${feed}`,
            `    G1 ${mv(IN_X(), OUT_Y())} F${feed}`,
            `    G1 ${mv(IN_X(), IN_Y())} F${feed}`,
            `    ${RING_INSET}=[${RING_INSET} + ${V.step}]`,
            `    ${V.i}=[${V.i} + 1]`,
            '  END2',
        ],
    };
}

/**
 * WHAT THIS ATOM COVERS — declared, because the switch-over depends on it and a silent gap here would DROP FEATURES.
 *
 * t1335: the confirm-every-N pause is in (M00 after every Nth level except the last, the literal path's own word).
 * What remains is the DESCENT alone — see the note on helix in the work log: the literal helix is a 24-segment G1
 * POLYLINE, not an arc, so "move-for-move" is the wrong criterion for it until we choose what it should emit.
 *
 * t1333: CONCENTRIC rings are now walked parametrically and proven move-for-move against the literal kernel. The
 * one-way raster read as "not a gap" — surfacing hard-codes both-ways, so no config reached it — which was true of
 * SURFACING and stopped being true at t1406, when a pocket with a real `direction` param started riding this atom.
 * t1418 closed it: the row walk reads all three direction words and the table carries the six rows that earned it.
 *
 * The boundary is a predicate rather than a comment: a caller asks whether a config is inside the proven envelope
 * instead of assuming it is. Retiring the literal emitter means closing what is left — every `false` below is a
 * feature that would otherwise vanish on the day the old path dies.
 */
/**
 * ── t1404 — THE ENVELOPE IS A TABLE NOW, AND THAT IS THE WHOLE POINT ─────────────────────────────────────────────
 *
 * This predicate used to be `return true` and its partner `return ''`. Both were honest summaries of their moment:
 * t1345 closed the last descent, t1355 closed skim, and "everything is covered" was, at the time, TRUE.
 *
 * A CONSTANT CANNOT STAY TRUE, and t1402 measured what that costs. `concentric` × `ramp|helix` was never bridged —
 * every bridge that probed a descent probed it against `strategy: 'parallel'` — and `ringWalk` in fact emitted a
 * straight PLUNGE for both. The predicate answered `true` for a combination nothing had ever measured, and it read
 * exactly like the five answers that were earned. That is the same failure as t1399's atomRoles finding, one floor
 * up: a default that LOOKS like a decision.
 *
 * So coverage is DATA, keyed by the two axes that select a code path, with the turn that earned each one. A new
 * strategy or a new descent is a row someone has to add — and until they do, the predicate says "no bridge" and
 * names it, instead of inheriting a `true` that was about somebody else's feature. The cost of the table is one line
 * per combination; the cost of the constant was a shipped op that plunged when the operator asked it to ramp.
 */
/**
 * ── t1418 — WHICH AXES EACH WALK ACTUALLY READS, DECLARED ────────────────────────────────────────────────────────
 *
 * `direction` became a third axis this turn, and the naive move — key every row `strategy/direction/entry` — would
 * have MANUFACTURED SIX FALSE ROWS: `concentric/oneway/plunge`, `concentric/otherway/ramp` and the rest, each reading
 * like a bridged combination when the rings have no direction to bridge. `ringWalk` never looks at the word, and
 * neither does the reference (`fillStrategy` dispatches to `concentricRect` BEFORE it reads `direction`), so the two
 * agree for every direction — which makes "concentric covers all directions" true and "concentric/oneway was
 * measured" a lie. A table whose rows are the turn that earned them cannot afford rows nobody earned.
 *
 * So the axis set is DATA, per strategy, and the key is built from it. Adding a walk that reads a fourth thing is a
 * line here plus its rows, and a walk that stops reading one is a line here plus the rows that must come out.
 *
 * ⚠ IT IS NOT THE ASYMMETRY t1404 WARNED ABOUT, and the distinction is worth stating because it looks alike. That
 * one folded an UNKNOWN `strategy` to a known arm while keeping an unknown `entry` verbatim, so `adaptive` read as
 * proven. Here every axis a strategy reads is still normalised identically, and an unknown STRATEGY falls to the
 * parallel axis set — so `adaptive/bothways/plunge` misses the table and refuses, exactly as before.
 */
// t1429 — `rowAxis` is deliberately NOT a fourth axis here, and the reason is in `rasterRowAxisOf`: a row axis is the
// SAME body with its coordinate pair swapped (the transposition bridge asserts it move-for-move), where `direction`
// earned its place by being a genuinely different body. Six rows nobody measured is exactly what this table refuses.
export const SURFACE_RASTER_AXES = {
    parallel: ['strategy', 'direction', 'entry'],
    concentric: ['strategy', 'entry'],   // rings ignore `direction` on BOTH sides — measured at t1406, unchanged here
};

export const SURFACE_RASTER_PROVEN = {
    'parallel/bothways/plunge': 't1329 — the first bridge, move for move against the literal raster',
    // t1483 (C4) — THE FIVE RAMP ROWS CHANGED THEIR CRITERION, NOT THEIR STATUS. They were proven MOVE-FOR-MOVE
    // against the literal's toward-the-centre ramp. The declared run vector cuts a DIFFERENT set of moves on
    // purpose, so they are proven by RELATIONSHIP now — byte-identity everywhere outside the descent, and inside it
    // the angle, the drop, the start, the return to it and the honest degrade. Keys unchanged: the combinations are
    // still covered, and a ledger that dropped them would read as coverage LOST.
    // t1487 — EACH RESTATED ROW CITES BOTH TURNS: the one that EARNED the coverage and the one that restated its
    // criterion. t1483 wrote only the restating turn, and that read as though the earlier proof had been dropped —
    // the exact "coverage LOST" the key-keeping was meant to prevent, and the two envelope specs said so by asking
    // these rows for their provenance and not finding it.
    'parallel/bothways/ramp': 't1339 earned it (the ramp descent); t1485 restated the criterion — a DECLARED run vector along the row retires the baked toC; relationship-bridged',
    'parallel/bothways/helix': 't1345 — the 24-segment polyline helix, within one emit quantum',
    // t1418 — the six the one-way walk earned, each measured per-phase against the frozen literal's `onewayMoves`.
    // They are SIX and not three because the mirror is the same walk with its two ends swapped: teaching one and
    // leaving the other would have left a conventional-cut pocket on the literal arm while the boundary's wording
    // read as though one-way were handled.
    'parallel/oneway/plunge': 't1418 — the one-way walk, against the literal onewayMoves (lift · rapid · re-plunge)',
    'parallel/oneway/ramp': 't1418 earned it (the one-way walk, descent per LEVEL at row 0); t1485 restated the criterion — the run vector runs along the row; relationship-bridged',
    'parallel/oneway/helix': 't1418 — likewise, inside the whole-revolution agreement the t1406 ledger names',
    'parallel/otherway/plunge': 't1418 — the mirror: every row starts at the FAR end, including the level descent',
    'parallel/otherway/ramp': 't1418 earned it (the mirror, every row from the FAR end); t1485 restated the criterion — the vector takes the MIRROR sign so the ramp runs INTO the area; relationship-bridged',
    'parallel/otherway/helix': 't1418 — likewise',
    'concentric/plunge': 't1333 — inward rings, proven on four adversarial ring boundaries',
    'concentric/ramp': 't1404 earned it (the descent the rings never had — the t1402 defect); t1485 restated the criterion — along +X from the ring corner, the direction the ring walk itself leaves on; relationship-bridged',
    'concentric/helix': 't1404 — likewise; both now run the SAME descentLines both walks ask for',
};

/**
 * WHAT THE ATOM DOES NOT READ, declared rather than left to be re-discovered.
 *
 * ── IT IS EMPTY NOW, AND THAT IS THE DECLARATION DOING ITS JOB (t1418) ───────────────────────────────────────────
 * t1404 put ONE fact here: the walk was always both-ways, `#49` seeded 1 and negated every row with no branch, so a
 * caller asking for one-way got both-ways. It was written down precisely so the next caller with a real `direction`
 * param would find it instead of rediscovering it the way t1402 rediscovered the missing ring descent — and it
 * worked: t1406 read this line and NARROWED the pocket's arm rather than shipping a zig-zag against the request.
 *
 * This turn the walk genuinely reads `direction`, so the entry is GONE rather than reworded. A declaration built to
 * be removed has to actually be removable, and the spec asserts BOTH halves of that — the key is absent AND the walk
 * now branches — because an empty table proves nothing on its own.
 *
 * The export stays as the slot for the next such fact. Empty says "nothing is ignored", which is a claim; absent
 * would say nothing at all, and the next reader would have to re-derive it from three walks.
 */
export const SURFACE_RASTER_IGNORES = {};

/**
 * ── t1425 — WHAT EACH (strategy, entry) STILL BAKES, AND THEREFORE CANNOT TAKE FROM A PENDANT ────────────────────
 *
 * The seeds, the frame and the inset all ride registers now, and the ring count resolves its own min at run time —
 * so PLUNGE, on either walk, has nothing left baked and honours a live geometry input end to end. The two DESCENTS
 * are different, and the difference is not effort but evidence:
 *
 *   RAMP — ⚠ t1483: THIS ROW IS EMPTY NOW. It used to bake the distance from its start to the area centre, a
 *   HYPOTENUSE, because computing that at the machine needs SQRT and SQRT is unverified here. The same paragraph
 *   named the way out — "the +X declared run vector the literal kernel already supports via runX/runY" — and C4 took
 *   it: the WALK declares the direction (its own first-cut vector) and the limit is a LIVE span register, so there
 *   is no hypotenuse to compute and nothing for a pendant to outrun. The ramp honours dialled geometry end to end.
 *   THE DECIDER IS NOT V13 ANY MORE FOR THIS ROW, and data/trigEvidence.js records it as closed by the other road.
 *
 *   HELIX bakes the rect inradius that CLAMPS its radius, and that radius then seeds the rotating vector whose
 *   9-decimal constants are the whole reason the descent stays inside one emit quantum (t1343).
 *
 * DECLARED AS DATA because the next act reads it: the slot delegation must know, from a table rather than from
 * reading three walks, which combinations it may pack live and which it must refuse. Refusing at PACK time in these
 * words is the whole point — never at the machine, with the tool down.
 *
 * ⚠ THE COST OF THIS ROW IS ALMOST NOTHING, which is why refusing beats half-building. `POCKET_FIELDS` carries no
 * descent control at all, so a packed pocket's entry is whatever the op held at pack time and a pocket op defaults
 * to `plunge`. Nobody can dial into a refused combination from the pendant, because no control reaches it.
 *
 * `direction` is NOT an axis here: what a descent bakes is the same whichever way the rows run. (The one-way mirror
 * moves the descent's START to the far end, which is a term in the same already-baked rect, not a new bake.)
 */
/**
 * t1490 (C2) — `inset` became a PAIR, so it comes out of this flat list and is read through `rasterInsetOf`: a
 * caller may spell it `inset`, or `insetAlong`/`insetAcross`, and a list that named only one spelling would report
 * a dialled slot inset as baked (or a baked one as dialled) depending on which word the caller happened to use.
 * The arc's envelope row for C2 is exactly this — "the BAKES table's inset key becomes two, so a config can declare
 * one axis live and the other baked".
 */
const BAKES_GEOMETRY = ['w', 'h', 'toolDia', 'stepoverPct', 'stepover'];
/** EVERY spelling of the pair, so a row that bakes the walked span refuses a dialled inset whichever word says it. */
const BAKES_INSET = ['inset', 'insetAlong', 'insetAcross'];
/** The inset KEYS a caller actually dialled, reported in the caller's own spelling so a message can name it back. */
function insetLiveKeys(p = {}) {
    const one = rasterInsetOf(p);
    const out = [];
    if (p.insetAlong == null && p.insetAcross == null) return liveWordOf(p.inset) != null ? ['inset'] : [];
    if (liveWordOf(one.along) != null) out.push('insetAlong');
    if (liveWordOf(one.across) != null) out.push('insetAcross');
    return out;
}
export const SURFACE_RASTER_BAKES = {
    'parallel/plunge': { inputs: [], why: '' },
    'concentric/plunge': { inputs: [], why: '' },
    // t1483 (C4) — ⚠ THESE TWO ROWS ARE EMPTY NOW, AND THE EMPTINESS IS THE POINT. They read "a ramp bakes the
    // distance from its start to the area centre — a hypotenuse, and SQRT is unverified on this controller", with the
    // run-vector alternative named as a deferred turn. That turn happened: the ramp runs along a vector the WALK
    // declares, against a LIVE span register, so there is no hypotenuse to bake and nothing here for a pendant to
    // outrun. The rows STAY (an absent key says nothing; an empty one says "nothing is baked" — the t1425 rule for
    // SURFACE_RASTER_IGNORES, applied here) and the ramp is pendant-true end to end.
    'parallel/ramp': { inputs: [], why: '' },
    'concentric/ramp': { inputs: [], why: '' },
    // t1490 (C2) — the inset keys ride explicitly now that they are no longer inside BAKES_GEOMETRY. A helix bakes
    // its inradius from the WALKED spans, and those are the given rect held its insets inside — so a dialled inset
    // moves the clamp exactly as a dialled w/h does, and the row has always meant to say so.
    'parallel/helix': { inputs: BAKES_GEOMETRY.concat(BAKES_INSET), why: 'a helix bakes the rect inradius that clamps its radius, and that radius seeds the rotating vector the descent depends on (t1343)' },
    'concentric/helix': { inputs: BAKES_GEOMETRY.concat(BAKES_INSET), why: 'a helix bakes the rect inradius that clamps its radius, and that radius seeds the rotating vector the descent depends on (t1343)' },
};

/**
 * Which geometry inputs of THIS config are live (dialled), in declaration order. One reading, shared by the envelope
 * refusal, the emitter's honest degrade and the specs — so none of them can disagree about what "live" means here.
 */
export function surfaceRasterLiveInputs(p = {}) {
    return BAKES_GEOMETRY.filter((k) => liveWordOf(p[k]) != null).concat(insetLiveKeys(p))
        .concat(liveWordOf(p.x) != null ? ['x'] : []).concat(liveWordOf(p.y) != null ? ['y'] : []);
}

/**
 * Why this config's LIVE geometry cannot be honoured, in the words a reader needs — or '' when it can.
 *
 * Two refusals, both narrow and both named:
 *   the DESCENT   ramp/helix bake the walked rect and the stepover (SURFACE_RASTER_BAKES, above).
 *   SKIM          a skim frame deliberately drops the op's own origin — `ax()` returns the jog register, never the
 *                 register plus x0 — so an inset given to a skim body has ALWAYS been ignored. That is a pre-existing
 *                 gap, unreachable in the product (surfacing is the only op that skims and never insets; a pocket
 *                 insets and never skims), and this act declines to change it silently under cover of a different
 *                 feature. It is refused here instead, so a live input can never land somewhere that quietly drops it.
 */
export function surfaceRasterLiveGap(p = {}) {
    const live = surfaceRasterLiveInputs(p);
    if (!live.length) return '';
    if (String(p.zMode || '') === 'skim') {
        return `a skim body reads its frame from wherever the operator jogged to and drops the op's own origin, so a `
            + `dialled ${live.join('/')} would be silently ignored — skim takes build-time geometry only`;
    }
    const strategy = String(p.strategy == null ? '' : p.strategy).trim() || 'parallel';
    const entry = String(p.entry == null ? '' : p.entry).trim() || 'plunge';
    const row = SURFACE_RASTER_BAKES[`${strategy}/${entry}`];
    if (!row) return '';   // an unknown combination is refused by the envelope table itself, in its own words
    const hit = live.filter((k) => row.inputs.includes(k));
    return hit.length ? `${entry} cannot take a dialled ${hit.join('/')} — ${row.why}` : '';
}

/**
 * (strategy, direction, entry) → the table's key, over whichever axes THIS strategy reads (SURFACE_RASTER_AXES).
 *
 * ABSENT falls to the default (the block's own `parallel`/`bothways`/`plunge`) — an unset config IS the defaults, and
 * those are proven. An UNKNOWN value is kept verbatim so it misses the table and refuses.
 *
 * THE AXES ARE NORMALISED THE SAME WAY, and getting that wrong once is why this comment exists: the first cut
 * folded any non-'concentric' strategy to 'parallel' (mirroring what the emitter DOES) while keeping an unknown
 * entry verbatim. That asymmetry made `strategy: 'adaptive'` read as PROVEN — the operator asks for one thing, the
 * atom silently does another, and the predicate calls it covered. That is the t1402 defect exactly, rebuilt in the
 * very function written to prevent it. "What will actually run is proven" is a true statement and the wrong
 * question; the question is whether what runs is what was ASKED for.
 */
function surfaceRasterCombo(p = {}) {
    const strategy = String(p.strategy == null ? '' : p.strategy).trim() || 'parallel';
    const by = { strategy, direction: rasterDirectionOf(p), entry: String(p.entry == null ? '' : p.entry).trim() || 'plunge' };
    return (SURFACE_RASTER_AXES[strategy] || SURFACE_RASTER_AXES.parallel).map((a) => by[a]).join('/');
}

/**
 * Is this config inside the PROVEN envelope? Scope, accumulated by the turns named in the table: the body, the
 * PLACED program (t1351 — the atom carries its own frame), and the SKIM Z-mode (t1355 — one body, two frames), for
 * whichever (strategy, entry) row applies. The confirm cadence (t1335) rides every row: it is a wrapper around the
 * level, not a walk or a descent.
 */
export function surfaceRasterCovers(p = {}) {
    // t1425 — a LIVE-GEOMETRY refusal is part of the envelope, not a second gate beside it: the question the table
    // answers is "may this config be emitted", and a dialled input the walk bakes is as much a no as an unbridged
    // descent. Folding it in here is what lets the next act's delegation ask ONE predicate.
    if (surfaceRasterLiveGap(p)) return false;
    return Object.prototype.hasOwnProperty.call(SURFACE_RASTER_PROVEN, surfaceRasterCombo(p));
}

/** Why a config is outside the envelope, in the words a reader needs — never a bare false. */
export function surfaceRasterGap(p = {}) {
    const liveGap = surfaceRasterLiveGap(p);
    if (liveGap) return liveGap;
    const k = surfaceRasterCombo(p);
    if (Object.prototype.hasOwnProperty.call(SURFACE_RASTER_PROVEN, k)) return '';
    return `${k} has no equivalence bridge — no turn has measured this walk/descent pair against the literal kernel, `
        + `so the emit is unproven for it (the known combinations are ${Object.keys(SURFACE_RASTER_PROVEN).join(', ')})`;
}

export const surfaceRasterBlock = {
    type: 'surfaceraster', label: 'Surface Raster (parametric)', kind: 'leaf', category: 'Transforms',
    // t1351 — z0 joins x/y: the block's declared FRAME. And the five that `lines()` already reads were missing from
    // this declaration entirely (entry/rampAngle/helixDia/helixPitch/confirmEvery) — a declaration that disagrees with
    // its own emitter is a feature DROP waiting for the day this atom round-trips through the canvas, so it is closed
    // here rather than left for the switch to discover. Defaults match the emitter's own num() fallbacks exactly.
    // t1404 — `inset` joins the declaration for the same reason z0 did at t1351: `lines()` reads it, so a declaration
    // that omitted it would be a feature DROP the day this atom round-trips through the canvas. Default 0 = surfacing's
    // own meaning, unchanged and asserted byte-identical.
    // t1429 — `rowAxis` joins the declaration in the same act that teaches the walk to read it, for the reason z0 and
    // `inset` did before it: `lines()` reads it, so a declaration that omitted it would be a feature DROP the day this
    // atom round-trips through the canvas. Default 'x' = the assumption this act made explicit, asserted byte-identical.
    /**
     * ⚠ t1490 (C2) — THE PAIR IS **NOT** DECLARED HERE YET, AND THAT IS A NAMED GAP, NOT AN OVERSIGHT.
     *
     * The t1351 lesson says an emitter reading a key the block does not declare is a drop waiting to happen. So the
     * first cut of this act DID declare `insetAlong`/`insetAcross` here, defaulting to null (null is what makes
     * `inset` alone keep meaning both axes — 0 cannot stand in, because 0 is a MEANINGFUL inset and is exactly the
     * value the slot case wants along its length).
     *
     * THE FULL SUITE CAUGHT IT: `roundtrip-whole-program-1319`'s iron rule (text differences may only SHRINK from
     * 11) went to 12, with `user_pocket_data` joining — a nullable field does not survive the Blockly round trip
     * unchanged. That is a real defect in waiting: if null came back as 0, `rasterInsetOf` would read a REAL inset of
     * zero and silently drop the caller's single `inset`, which is the silent-substitution class this file keeps
     * closing (t1425).
     *
     * SO THE SEAM STAYS AT THE EMITTER, WHERE IT HAS A CONSUMER, AND OFF THE BLOCK, WHERE IT HAS NONE. Nothing is
     * lost today: no block instance carries these keys, and every caller that sets them (the slot arc's C1/C3) hands
     * params straight to `surfaceRasterLines`. THE DAY A BLOCK MUST CARRY THEM, the nullable round trip is the thing
     * to fix first — in `stackBridge`, on its own act, not as a rider on this one.
     */
    defaults: { x: 0, y: 0, z0: 0, w: 100, h: 80, inset: 0, depth: 0.5, stepdown: 0.5, toolDia: 12, stepoverPct: 60, feed: 2000, plunge: 200, clearance: 5, strategy: 'parallel', direction: 'bothways', rowAxis: 'x', entry: 'plunge', rampAngle: 3, helixDia: 0, helixPitch: 1, confirmEvery: 0 },
    fields: ['x', 'y', 'z0', 'w', 'h', 'inset', 'depth', 'stepdown', 'toolDia', 'stepoverPct', 'feed', 'plunge', 'clearance', 'strategy', 'direction', 'rowAxis', 'entry', 'rampAngle', 'helixDia', 'helixPitch', 'confirmEvery'],
    scratch: RASTER_SCRATCH,   // read by universalScratch.opBands() — the band is data, not a comment
    /**
     * ── t1408 — THE DECLARED FLOW LABELS. See LABEL_DEFAULTS for the defect this closes ──────────────────────────
     *
     * `uniquifyFlowLabels` (blockEmitter) assigns these per PROGRAM from one counter, so no two bodies — this atom
     * twice, or this atom beside a `holecycle` — can write the same `N`. Measured before it was built: a drill op
     * beside a surfacing op in RELEASED code emits `N91`/`N92` twice and the second op does not execute.
     *
     * A LABEL IS LISTED ONLY WHEN THE BODY ACTUALLY EMITS IT — the skim refusal only in skim, the inset refusal only
     * with an inset, the ring pair only on `concentric`, the ramp/helix pairs only for that descent. That keeps the
     * numbering tight and, as holecycle's own declaration says, keeps the declaration HONEST: a label reserved for a
     * branch this config cannot take is a number nobody can account for.
     *
     * THE ORDER IS DELIBERATE. `errLabel`/`okLabel` lead, so the FIRST label-emitting body in a program still writes
     * `N91`/`N92` — the numbers this atom has always written for its one refusal that every config carries.
     */
    flowLabels: (p = {}) => {
        const out = ['errLabel', 'okLabel'];
        if (String(p.zMode || '') === 'skim') out.push('skimErrLabel', 'skimOkLabel');
        if (liveWordOf(p.inset) || Math.max(0, num(p.inset, 0)) > 0) out.push('insetErrLabel', 'insetOkLabel');   // t1425 — a LIVE inset is an inset
        if (String(p.strategy || '') === 'concentric') {
            out.push('ringStepLabel', 'ringCutLabel');
            // t1425 — the runtime shorter-side branch exists only when the area is dialled
            if (liveWordOf(p.w) || liveWordOf(p.h) || liveWordOf(p.inset)) out.push('ringMinLabel');
        }
        // t1418 — the ONE-WAY row walk writes TWO of the six. Four of them exist only to choose which END a row runs
        // to, and a one-way walk has no end to choose. Declaring all six anyway would reserve four numbers no branch
        // in this body can reach — the exact thing this declaration's own rule forbids.
        else if (rasterIsOneWay(rasterDirectionOf(p))) out.push('rowStepLabel', 'rowCutLabel');
        else out.push('rowStepLabel', 'rowCutLabel', 'rowNearLabel', 'rowEndLabel', 'rowFarLabel', 'rowStartLabel');
        if (Math.max(0, Math.round(num(p.confirmEvery, 0))) > 0) out.push('confirmLabel');
        // t1425 — A DEGRADED DESCENT WRITES NO LABELS, and following that here is the declaration's own rule, not a
        // nicety: when dialled geometry forces the honest degrade the body emits a plunge and a comment, so
        // declaring the ramp/helix pairs would reserve four numbers nothing in this config can reach.
        const entry = surfaceRasterLiveGap(p) ? 'plunge' : String(p.entry || 'plunge');
        if (entry === 'ramp') out.push('rampPlungeLabel', 'rampEndLabel');
        if (entry === 'helix') out.push('helixReseedLabel', 'helixEndLabel');
        return out;
    },
    // t1361 — THE DECLARED FOOTPRINT, and the ONE thing the collapse dropped. `surfacefill` declared an `extent` and
    // the place fold reads it (liveExtent) IN PREFERENCE to placeonstock's frozen bminX..bmaxX snapshot; folding
    // stepdown{surfacefill} into this atom left the declaration behind, so a placed op silently fell back to whatever
    // size the snapshot was frozen at. Measured, not inferred: a twin at w=150 on a 200 stock, cc-attach, placed its
    // face at X50 — the shift computed for the template's default 100 — against the built-in's X25. Every caller whose
    // live w/h can differ from the snapshot hits it (the data twin, whose template IS frozen at the defaults, and the
    // Blocks canvas, where editing w/h does not rewrite the parent's snapshot).
    // The rect is the tool-CENTRE sweep at the atom's own local frame, exactly the bbox surfacefill's region contour
    // gave for shape:'rect' — so the built-in is unmoved (its snapshot was already built from the same w/h).
    // t1425 — NULL WHEN THE FOOTPRINT CANNOT BE KNOWN, the same rule `surfaceRasterWorkSteps` follows: a dialled
    // x/y/w/h has no build-time value, and `num(word, default)` would hand the place fold a footprint computed from
    // this atom's DEFAULTS — the exact silent substitution t1422 measured one level down. `liveExtent` already treats
    // a falsy answer as "unmeasurable" and keeps the frozen snapshot, so the honest answer is one the caller handles.
    extent: (p) => (['x', 'y', 'w', 'h'].some((k) => liveWordOf(p[k]) != null) ? null
        : { minX: num(p.x, 0), maxX: num(p.x, 0) + num(p.w, 100), minY: num(p.y, 0), maxY: num(p.y, 0) + num(p.h, 80) }),
    lines: (p) => surfaceRasterLines(p),
    // t1359 — THE LEAF CONTRACT. blockEmitter's default leaf path calls def.emit(p, dx, dy, dialect); `lines` above is
    // the pure body other readers use. dx/dy are the STAMP offsets a container (Array/Path) applies to a child — zero
    // for surfacing, which is never stamped, but folded into the frame rather than ignored so the atom stays correct
    // if it is ever placed under one.
    emit: (p, dx = 0, dy = 0) => surfaceRasterLines({ ...p, x: num(p.x, 0) + (Number(dx) || 0), y: num(p.y, 0) + (Number(dy) || 0) }),
    // t1359 — THE DECLARED PLACEMENT SEAM. This atom takes its frame as PARAMS; the place fold reads this and passes
    // x0/y0/z0 in instead of rewriting the emitted text (which cannot work on expressions — t1349 measured it).
    absorbsPlacement: true,
    // t1375 — THE DECLARED ROTATION SEAM, the same shape one level up: the emitter asks this before handing the angle
    // down as `rotAngle`/`rotPivotX`/`rotPivotY`, and the atom answers `true` or says why not (skim).
    //
    // THOSE THREE ARE DELIBERATELY NOT `fields`/`defaults`, and that is the opposite call from t1361's z0. A placement
    // frame is a fact about THIS op and belongs on it. A program rotation is a fact about the PROGRAM — it is declared
    // ONCE, by the flat `xform` sibling, and re-read at every emit. Storing a copy on the block would create a second
    // source for one angle, which is the split this whole arc exists to remove; so the atom reads it and never keeps it.
    absorbsRotation: (p) => surfaceRasterAbsorbsRotation(p),
};
