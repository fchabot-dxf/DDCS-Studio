/**
 * wizards/ops/wallfinish.js — THE WALL FINISH, EMITTED PARAMETRIC (t1433).
 *
 * The fourth run of the family recipe (holecycle t1381 · surfaceraster t1359 · the pocket's clearing t1429): a walk
 * that today ships as a JS transcript of every ring at every level becomes a header of named #vars and a runtime
 * depth loop. Change the depth or the bite on the pendant and the finish pass re-derives at the machine.
 *
 * ── WHY A SEPARATE ATOM AND NOT A PARAMETRIC `pocketwall` ─────────────────────────────────────────────────────────
 * The precedent is the FILL's, and it is followed rather than re-argued: the pocket's clearing did not become a
 * parametric `pocketfill`, it became a separate generic `surfaceraster` that the stack chooses via `pocketRidesRaster`
 * — because `pocketfill`/`pocketwall` still emit for every arm outside the eligible one (non-rect, a rest tool, too
 * small), and an atom that is parametric on some inputs and literal on others is two emitters wearing one name. So
 * this is a new atom, the pocket stack picks between them at build, and `pocketwall` is untouched.
 *
 * ⚠ THE NAME IS THE ONE THING NOT RULED. t1431 surfaced `wallfinish` vs `rectwall` as a granularity call and the
 * dispatch came back without ruling it. `wallfinish` is taken as the standing lean — it names the operation the
 * codebase already calls it ("the raster wall finish"), and leaves the rect-only scope to the ENVELOPE exactly as
 * `surfaceraster` leaves it to `pocketRasterGap` rather than to a name. Recorded here because it is cheap to rename
 * now (pre-release, no install base) and expensive once a saved workspace carries the type string.
 *
 * ── WHAT THIS BODY DOES NOT HAVE, DECLARED BY ABSENCE ─────────────────────────────────────────────────────────────
 * There is no `entry` field, no `strategy`, no `direction` — and therefore NO envelope table. The literal wall has
 * exactly ONE walk (a rect ring) and exactly ONE descent (the straight plunge): `pocketwall` calls `contourLevel` with
 * no `entry` in its ctx at all, so the ramp branch the contour kernel offers has never been reachable from a pocket
 * wall. A `WALL_FINISH_PROVEN` table would therefore hold one row that can never refuse, which is precisely the kind
 * of declaration nothing can check (t1431's own reason for NOT declaring an unconsumed register band). The absence is
 * the declaration: one walk, one descent, no axes.
 *
 * AND THE CONSUMER NEEDS NO SECOND FORK EITHER. A pocket's wall re-points on the SAME `_para` guard its fill does.
 * That is a superset of what this atom needs — `_para` already means rect, big enough for its tool, no rest pass —
 * and the two clauses it adds (a bridged direction, a bridged descent) are things the wall does not read. One fork in
 * the stack instead of a crossed pair, which is what keeps the guarded superset collapsible.
 *
 * ── THE SCRATCH IT WRITES, DECLARED (t1325's lesson, t1431's re-scout) ────────────────────────────────────────────
 * #11-#14. t1431 re-verified the whole map against every declaration that exists today and found FOUR of the five
 * runs t1395 had named already taken (#23-#29 by the mill generators, #51-#56 and #58-#61 by the probe temps,
 * #71-#74 by the WCS pair / align span / Expert post); #11-#16 was the one that survived. It also corrected its own
 * first read: #103-#149 is NOT scratch — `varMap` puts scratch at #1-#99 and #100-#549 is the PERSISTENT uservar pool
 * (the probe radius lives at #110), and V4.1's factory macros write #0-148 besides. So the honest total is 18 free
 * scratch registers, fragmented, and this atom takes FOUR of them in one run.
 *
 * FOUR IS THE WHOLE COST because the corners are EXPRESSIONS off the seeds rather than registers of their own — a
 * baked corner folds to the literal coordinate the reference emits (`X77`), and a dialled one becomes the arithmetic
 * the controller already evaluates everywhere else in this family (`[#2601 + 74]`). Registers spent on values that
 * fold at build are registers the next atom cannot have.
 */
import { num, val, r3 } from './util.js';
import { affineFrame } from './affineFrame.js';
import { workMarker } from '../../engine/declaredWork.js';
import { pauseConfirmBlock } from './hmi.js';   // the confirm is the STEPDOWN's own emit, asked — never re-typed

/** THE BAND. #11-#14, the one free run t1431's re-scout left standing. Data, so the collision guard reads it. */
export const WALL_SCRATCH = [[11, 14]];

const V = {
    depth: '#11',     // total depth the wall is finished to
    stepdown: '#12',  // per-level bite
    z: '#13',         // the level currently being cut (a POSITIVE depth, like the raster atom's #46)
    lvl: '#14',       // which level just finished — the confirm cadence's index
};

/**
 * A geometry input → { live, w (the word to print), n (the build-time value, floored) } — t1425's shape, shared
 * verbatim with `surfaceraster` because a pocket hands BOTH atoms the same registers and two readings of "is this
 * knob dialled or typed" is the split that file keeps closing.
 */
export const liveWordOf = (v) => { const t = String(v == null ? '' : v).trim(); return /^(#|\[)/.test(t) ? t : null; };
function geoTerm(v, dflt, floor = null) {
    const word = liveWordOf(v);
    const n = floor == null ? num(v, dflt) : Math.max(floor, num(v, dflt));
    return { live: !!word, w: word || String(r3(n)), n };
}
/**
 * A FLAT weighted sum of geometry terms → { live, w, n }. Numbers fold together; live words print as one bracket.
 *
 * ── WHY FLAT, AND WHY THAT IS A CORRECTNESS POINT RATHER THAN A TIDINESS ONE ──────────────────────────────────────
 * The obvious build is `surfaceraster`'s `geoSum` composed twice — the near corner, then the near corner plus the
 * walked span — and the first cut of this atom did exactly that. It emits `X[[#2600 + #22] + [#2601 - 2 * #22]]`:
 * NESTED brackets inside a coordinate word, a form nothing in the factory corpus demonstrates. `surfaceraster` never
 * hits it because it SEEDS its spans into `#40`/`#41` first, so its one nested expression sits inside an assignment
 * (`#40=[#2601 - 2 * #22]`) and every consumer reads a bare register. This atom cannot afford four more registers —
 * #11-#16 is the one free run t1431 left standing and #17 is taken — so the nesting cannot be seeded away.
 *
 * It does not need to be. The far corner is not "near plus the walked span": algebraically it is `x + w − inset`,
 * three terms in ONE bracket, which is precisely the shape the shipped CAM kit already writes (`#24=[#20+<w>-#22]`).
 * Composing twice was re-deriving the same coordinate the long way round and paying for it in an unproven form. So
 * the corners are declared as term lists and printed once, flat.
 */
function flatSum(terms) {
    let c = 0;
    const live = [];
    for (const [t, k] of terms) {
        if (t.live) live.push([t.w, k]);
        else c += k * t.n;
    }
    if (!live.length) return { live: false, w: String(r3(c)), n: c };
    // A LONE REGISTER IS PRINTED BARE. `X[#22]` is a bracket around nothing — and the demonstrated factory form for a
    // register in an axis word has no brackets (`G53 <axis>#var`, gotozero.nc). Brackets are for arithmetic.
    if (live.length === 1 && c === 0 && live[0][1] === 1) return { live: true, w: live[0][0], n: NaN };
    let s = c !== 0 ? String(r3(c)) : '';
    for (const [w, k] of live) {
        const body = Math.abs(k) === 1 ? w : `${r3(Math.abs(k))} * ${w}`;
        if (!s) s = k < 0 ? `0 - ${body}` : body;
        else s += ` ${k < 0 ? '-' : '+'} ${body}`;
    }
    return { live: true, w: `[${s}]`, n: NaN };
}

/**
 * ── HOW FAR IN THE RING SITS: ONE SEED, NOT TWO (t1431's flag, ACCEPTED by the dispatch) ──────────────────────────
 *
 * The dispatch that opened this arc named `wallOffset` and `toolDia` as the two live params. They are not two: the
 * pocket's own declaration `pocketInsetMm` = toolRadius − wallOffset is the SINGLE source both the fill and the wall
 * already ask, and t1402 measured what happens when "how far in" gets read twice — the two readings disagreed in
 * SIGN. So this atom takes `inset`, the number they resolve to, exactly as `surfaceraster` does; the CAM slot's wall
 * section hands it `#22`, the register it already computes. Re-deriving `r − wallOffset` inside this body would be
 * the second reading that declaration exists to forbid.
 */

/** The label numbers this body will use: the emitter's per-program assignment, else the direct-call default. */
const LABEL_DEFAULTS = {
    errLabel: 81, okLabel: 82,             // the zero-stepdown refusal + its skip-over
    ringErrLabel: 83, ringOkLabel: 84,     // the collapsed-ring refusal
    confirmLabel: 61,                      // the confirm-every-N pause skip
};
function labelsOf(p = {}) {
    const out = {};
    for (const k in LABEL_DEFAULTS) out[k] = num(p[k], LABEL_DEFAULTS[k]);
    return out;
}

/**
 * ── t1375's ROTATION SEAM, and the SAME live-geometry refusal `surfaceraster` carries ─────────────────────────────
 * The rotation printer mixes each axis's BUILD-TIME constant into the other; when a corner is a register there is no
 * such constant, so a rotated word would silently drop it. Refused whole rather than emitted half-applied (t1353
 * measured what a half-rewrite does: a move that gains a second axis word — uncommanded motion on a cutting line).
 */
export function wallFinishAbsorbsRotation(p = {}) {
    const live = wallFinishLiveInputs(p);
    if (live.length) {
        return `a dialled ${live.join('/')} makes a ring corner a register, and a program rotation mixes the `
            + 'build-time constant of each axis into the other — there is no such constant to mix, so the rotation cannot be baked';
    }
    return true;
}

/** Which geometry inputs of THIS config are dialled, in declaration order. One reading, shared by the refusal + specs. */
const RING_GEOMETRY = ['x', 'y', 'w', 'h', 'inset'];
export function wallFinishLiveInputs(p = {}) {
    return RING_GEOMETRY.filter((k) => liveWordOf(p[k]) != null);
}

/**
 * ── DOES THIS CONFIG NEED THE COLLAPSED-RING GUARD? — ONE reading, asked by the body, the labels AND the work count ─
 *
 * FOUND BY LOOKING AT THE RUNNING PROGRAM, not by reasoning about it: the first cut emitted the guard whenever an
 * inset was declared, so a perfectly ordinary pocket carried `IF 18 <= 0 GOTO103` — a comparison of two build-time
 * constants that can never be true — plus a four-line refusal block, plus TWO reserved flow labels. Labels are a
 * scarce per-program resource assigned from one counter (t1408), so reserving two for a branch nothing can reach is
 * not cosmetic: it pushes every later body's numbers up for nothing.
 *
 * ⚠ AND IT IS NOT DEAD IN GENERAL, which is why the answer is a predicate rather than a deletion. The span is
 * evaluated at BUILD time from whatever the block holds, and the wizard is not the only thing that fills a block:
 * editing `w` to 4 on the Blocks canvas with a 3mm inset gives a span of −2 and an INVERTED ring — a real cut, in the
 * wrong place, with no `pocketTooSmall` upstream to catch it. There the constant comparison is `IF -2 <= 0` and it
 * fires. So the guard is emitted exactly where it can fire: when the span is dialled (a run-time collapse), or when
 * it is baked and already non-positive (a build-time one).
 */
export function wallFinishNeedsRingGuard(p = {}) {
    const iT = geoTerm(p.inset, 0), wT0 = geoTerm(p.w, 80), hT0 = geoTerm(p.h, 60);
    const wT = flatSum([[wT0, 1], [iT, -2]]), hT = flatSum([[hT0, 1], [iT, -2]]);
    if (wT.live || hT.live) return true;
    return wT.n <= 0 || hT.n <= 0;
}

/**
 * ── HOW MUCH THIS BODY EXECUTES, DECLARED (t1383's rule, t1399's null-when-live) ──────────────────────────────────
 *
 * The tracer's cap is sized from this; a body that is ~30 lines whatever the depth would otherwise get the 5000-step
 * floor while its real work is `levels × a ring`. The per-level count is the one the emitter actually writes (7 motion
 * lines + 4 of loop bookkeeping, +6 for a confirm), and the spec asserts it against the emitted body so the two cannot
 * drift — the t1418 discipline, where a guessed per-pass number was measured and came back lower than the guess.
 *
 * OMITTED, never wrong, the moment any input it reads is a register: the real count does not exist at build time then,
 * and the tracer falls back to the flow-aware floor that SAYS SO if it truncates.
 */
export function wallFinishWorkSteps(p = {}) {
    if ([p.depth, p.stepdown, p.w, p.h, p.inset, p.x, p.y].some((v) => liveWordOf(v) != null)) return null;
    const depth = num(p.depth, 4), stepdown = Math.max(0.01, num(p.stepdown, 1.5));
    const levels = Math.max(1, Math.ceil(depth / stepdown));
    // t1440 — CALIBRATED AGAINST THE ENGINE'S OWN STEP COUNT, by the same differencing that swept the raster's rows.
    // PER_LEVEL 11 was right (measured exactly, by differencing two depths at one area). The other two were not:
    // the HEADER was 6 against a measured 9 — an UNDER-declaration, the direction that truncates a preview — and the
    // confirm's 6 is really 4.25 (its two pause lines fire on one level in N, while its three guard lines fire on
    // every level, and the last level short-circuits at the first IF). 5 is the measured value rounded UP, because
    // where a declaration cannot be exact it must err high.
    const PER_LEVEL = 11;
    const CONFIRM = Math.max(0, Math.round(num(p.confirmEvery, 0))) > 0 ? 5 : 0;
    // the header + the refusal tails — sized from the SAME predicate the body emits them under, so a config that
    // drops the ring guard does not carry six phantom steps in its declaration
    const HEADER = 9 + (wallFinishNeedsRingGuard(p) ? 6 : 0);
    return HEADER + levels * (PER_LEVEL + CONFIRM);
}

/**
 * The parametric body for a whole wall-finish pass: header, depth loop, one rect ring per level.
 * @param {object} p  x,y,z0,w,h,inset,depth,stepdown,feed,plunge,clearance,confirmEvery
 * @param {object} dialect  the active post — the confirm's operator message is ITS form, not this body's
 */
export function wallFinishLines(p = {}, dialect = null) {
    const iT = geoTerm(p.inset, 0);
    const xT = geoTerm(p.x, 0), yT = geoTerm(p.y, 0);
    const wT0 = geoTerm(p.w, 80), hT0 = geoTerm(p.h, 60);
    // the WALKED span: the declared rect held `inset` inside on both sides — the same split t1404 made for the fill,
    // and for the same reason: `extent` must keep declaring the GIVEN rect or a placed pocket slides by the inset.
    const wT = flatSum([[wT0, 1], [iT, -2]]), hT = flatSum([[hT0, 1], [iT, -2]]);
    const LBL = labelsOf(p);
    const depth = num(p.depth, 4), stepdown = Math.max(0.01, num(p.stepdown, 1.5));
    const feed = val(p.feed, 2000), plunge = val(p.plunge, 150);
    const clrT = geoTerm(p.clearance, 5);
    const confirmEvery = Math.max(0, Math.round(num(p.confirmEvery, 0)));

    // THE RING'S TWO CORNERS, each ONE flat sum of the op's own terms: near = x + inset, far = x + w − inset. Both
    // fold to literal coordinates when nothing is dialled, which is what makes the baked emit the reference's numbers.
    const nxT = flatSum([[xT, 1], [iT, 1]]), nyT = flatSum([[yT, 1], [iT, 1]]);
    const fxT = flatSum([[xT, 1], [wT0, 1], [iT, -1]]), fyT = flatSum([[yT, 1], [hT0, 1], [iT, -1]]);
    const z0 = num(p.z0, 0), zTop = r3(z0);

    // ONLY the Z printers and the rotation mix are taken from the frame: this atom's X/Y are its own flat sums (see
    // flatSum), and `z0` is always a build-time number — the place fold hands it one — so the frame never goes live.
    const { az, azE, AX, mv } = affineFrame({
        x0: nxT.n, y0: nyT.n, zTop, live: null,
        rotAngle: num(p.rotAngle, 0), rotPivotX: num(p.rotPivotX, 0), rotPivotY: num(p.rotPivotY, 0),
        absorbs: wallFinishAbsorbsRotation(p) === true,
    });

    // THE ONE RETRACT WORD — a NUMBER folds through the frame's Z printer exactly as the reference's `G0 Z5` does;
    // a REGISTER rides the frame so a placed body keeps its surface in the sum (t1429's clearance finding).
    const zClr = !clrT.live ? az(clrT.n) : (String(zTop) === '0' ? clrT.w : azE(`+ ${clrT.w}`));
    // The ring's four corners as MOVE arguments. `c` (the build-time coordinate) is only read when the rotation is
    // absorbed, which a live ring refuses — so the NaN a live corner carries can never reach the printer.
    const NX = () => AX(nxT.w, nxT.n, []), FX = () => AX(fxT.w, fxT.n, []);
    const NY = () => AX(nyT.w, nyT.n, []), FY = () => AX(fyT.w, fyT.n, []);

    /**
     * THE RING IS THE REFERENCE'S, CORNER FOR CORNER. `rectContour(x0,y0,x1,y1)` walks (x0,y0) → (x1,y0) → (x1,y1) →
     * (x0,y1) and `contourLevel` closes it back on (x0,y0) — four G1s after the plunge, in that order. Reproduced
     * rather than re-derived, because the ORDER is the climb/conventional direction of the finish cut and a walk that
     * ran it the other way would cut the same rectangle the wrong way round.
     */
    const ring = [
        `  G0 Z${zClr}`,
        `  G0 ${mv(NX(), NY())}`,
        `  G1 Z${azE(`- ${V.z}`)} F${plunge}   ( down to this level's floor )`,
        `  G1 ${mv(FX(), NY())} F${feed}`,
        `  G1 ${mv(FX(), FY())} F${feed}`,
        `  G1 ${mv(NX(), FY())} F${feed}`,
        `  G1 ${mv(NX(), NY())} F${feed}   ( closed on the corner it started at )`,
    ];

    /**
     * THE CONFIRM IS THE STEPDOWN'S, AND IT IS ASKED RATHER THAN RE-TYPED.
     *
     * t1431 measured this and it is the fact that would have been guessed wrong: the depth fold injects the
     * `pauseconfirm` ATOM — a `#1505=-5000(…)` operator banner and THEN `M00` — where `surfaceraster`'s own confirm
     * emits the bare `M00`. Copying the atom this family knows best would have changed the operator's pause.
     *
     * So the two lines come from `pauseConfirmBlock.emit(…, dialect)`, the same call `blockEmitter`'s depth fold
     * makes. That is not tidiness: the banner is DIALECT-DEPENDENT (Expert `#1505`, RS274 `(MSG,…)`, V4.1 nothing at
     * all), and a hard-coded Expert line would have emitted an unmapped register write on every port target this
     * project is heading for.
     *
     * The CADENCE is `surfaceraster`'s proven arithmetic — after every Nth level, never after the last, tested with a
     * FIX() modulo rather than a counter so nothing has to be reset.
     */
    const confirm = confirmEvery <= 0 ? [] : [
        `  ${V.lvl}=[${V.z} / ${V.stepdown}]   ( which level just finished )`,
        `  IF ${V.z} >= ${V.depth} GOTO${LBL.confirmLabel}   ( the last pass needs no pause — the wall is done )`,
        `  IF [${V.lvl} / ${r3(confirmEvery)} - FIX[${V.lvl} / ${r3(confirmEvery)}]] > 0.001 GOTO${LBL.confirmLabel}   ( not an Nth level )`,
        ...pauseConfirmBlock.emit({}, 0, 0, dialect || {}).map((ln) => `  ${ln}`),
        `  N${LBL.confirmLabel}`,
    ];

    /**
     * THE COLLAPSED-RING REFUSAL, and its ONE deliberate divergence from the literal.
     *
     * A ring whose inset has eaten the rect traces INVERTED in the literal kernel — `offsetRegion` happily returns a
     * negative w/h and `contourLevel` walks it — which is a real cut in the wrong place. It is unreachable from the
     * wizard (`pocketTooSmall` puts that pocket on the single-plunge arm before this atom is ever built), and it is
     * reachable from a PENDANT, where a dialled width can cross the inset at run time. Refused before any motion,
     * with its own label so the operator is told which number is wrong — a wrong operator message is treated here as
     * seriously as wrong motion (t1404's ruling, applied at the moment the guard is born).
     *
     * Emitted only where a collapse is actually possible (see `wallFinishNeedsRingGuard` for how the predicate was
     * found — by reading the running program, not by reasoning), so an ordinary pocket keeps a tight body rather than
     * carrying a constant comparison and two reserved labels for a branch nothing in it can trip.
     */
    const guardRing = wallFinishNeedsRingGuard(p);
    const ringGuard = !guardRing ? [] : [
        `IF ${wT.live ? wT.w : r3(wT.n)} <= 0 GOTO${LBL.ringErrLabel}   ( the inset leaves no width to finish )`,
        `IF ${hT.live ? hT.w : r3(hT.n)} <= 0 GOTO${LBL.ringErrLabel}`,
    ];
    const ringRefusal = !guardRing ? [] : [
        `GOTO${LBL.ringOkLabel}`,
        `N${LBL.ringErrLabel}`,
        '#1505=1   ;ERROR: the wall offset leaves no ring to finish - the tool is too large for this feature',
        `N${LBL.ringOkLabel}`,
    ];

    const work = wallFinishWorkSteps(p);
    return [
        `( ---- WALL FINISH, parametric. One ring per level; change the depth or the bite and the loop re-derives.`
            + `${work == null ? '' : ' · ' + workMarker(work)} ---- )`,
        `${V.depth}=${liveWordOf(p.depth) || r3(depth)}   ( total depth the wall is finished to )`,
        `${V.stepdown}=${liveWordOf(p.stepdown) || r3(stepdown)}   ( bite per level )`,
        // The build-time floor cannot apply to a value that does not exist yet (t1399/t1389's rule), so the LIVE case
        // is covered by this run-time guard reading the REGISTER — which is what the guard was written for anyway.
        `IF ${V.stepdown} <= 0 GOTO${LBL.errLabel}   ( a zero bite loops forever; refuse cleanly instead )`,
        ...ringGuard,
        '',
        `${V.z}=0   ( the level being cut )`,
        `WHILE [${V.z} < ${V.depth}] DO1   ( depth: one ring per level, the last bite clamped to the total )`,
        `  ${V.z}=[${V.z} + ${V.stepdown}]`,
        `  IF ${V.z} > ${V.depth} THEN ${V.z}=${V.depth}`,
        ...ring,
        // NO PER-LEVEL TRAILING RETRACT — t1431 measured that the reference has none: the NEXT level's own `G0 Z…`
        // serves, and the last level's retract is `progend`'s. A loop that added one would add a rapid per level.
        ...confirm,
        'END1',
        `GOTO${LBL.okLabel}`,
        `N${LBL.errLabel}`,
        '#1505=1   ;ERROR: the step down must be greater than zero',
        `N${LBL.okLabel}`,
        ...ringRefusal,
    ];
}

export const wallFinishBlock = {
    // CATEGORY FOLLOWS `surfaceraster`, NOT `pocketwall`. The toolbox buckets by this field, and the thing that
    // decides the bucket is what the block IS structurally: a self-framing body that owns its own depth loop, which
    // is what the Transforms group already holds (`stepdown`, `placeonstock`, `surfaceraster`). Filing it under
    // Toolpaths beside its literal twin would put a depth-owning atom in the group of leaves that need wrapping.
    type: 'wallfinish', label: 'Wall Finish (parametric)', kind: 'leaf', category: 'Transforms',
    defaults: { x: 0, y: 0, z0: 0, w: 80, h: 60, inset: 0, depth: 4, stepdown: 1.5, feed: 2000, plunge: 150, clearance: 5, confirmEvery: 0 },
    fields: ['x', 'y', 'z0', 'w', 'h', 'inset', 'depth', 'stepdown', 'feed', 'plunge', 'clearance', 'confirmEvery'],
    scratch: WALL_SCRATCH,   // read by universalScratch.opBands() — the band is data, not a comment
    /**
     * A LABEL IS LISTED ONLY WHEN THE BODY ACTUALLY EMITS IT (holecycle's rule, and surfaceraster's): the ring pair
     * only where a collapse is possible, the confirm label only with a cadence. A label reserved for a branch this
     * config cannot take is a number nobody can account for — and `uniquifyFlowLabels` assigns from ONE per-program
     * counter, so a reserved-but-unwritten number is a real cost to the next body in the program.
     */
    flowLabels: (p = {}) => {
        const out = ['errLabel', 'okLabel'];
        if (wallFinishNeedsRingGuard(p)) out.push('ringErrLabel', 'ringOkLabel');   // the SAME predicate the body asks
        if (Math.max(0, Math.round(num(p.confirmEvery, 0))) > 0) out.push('confirmLabel');
        return out;
    },
    // THE DECLARED FOOTPRINT — the GIVEN rect, never the walked one (t1361/t1404): `liveExtent` reads this in
    // preference to placeonstock's frozen snapshot, and declaring the inset ring here would slide a placed pocket by
    // the inset. NULL when it cannot be known, so the place fold keeps its snapshot instead of a footprint computed
    // from this atom's defaults (t1425's rule — `num(word, default)` is the silent substitution t1422 measured).
    extent: (p) => (['x', 'y', 'w', 'h'].some((k) => liveWordOf(p[k]) != null) ? null
        : { minX: num(p.x, 0), maxX: num(p.x, 0) + num(p.w, 80), minY: num(p.y, 0), maxY: num(p.y, 0) + num(p.h, 60) }),
    lines: (p, z, dialect) => wallFinishLines(p, dialect),
    // dx/dy are the STAMP offsets a container applies to a child — folded into the frame rather than ignored, so the
    // atom stays correct if it is ever placed under an Array/Path.
    emit: (p, dx = 0, dy = 0, dialect = null) => wallFinishLines({ ...p, x: num(p.x, 0) + (Number(dx) || 0), y: num(p.y, 0) + (Number(dy) || 0) }, dialect),
    // THE DECLARED PLACEMENT SEAM: this atom takes its frame as PARAMS, so the place fold hands it x0/y0/z0 instead
    // of rewriting emitted text (which cannot work on expressions — t1349 measured it).
    absorbsPlacement: true,
    absorbsRotation: (p) => wallFinishAbsorbsRotation(p),
};
