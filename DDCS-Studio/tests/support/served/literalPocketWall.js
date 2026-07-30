/**
 * tests/support/served/literalPocketWall.js — THE FROZEN LITERAL POCKET WALL (t1433). TEST-ONLY. NEVER SHIPPED.
 *
 * Served at `/_test/literalPocketWall.js` by the mem-server and reachable from nothing else. A verbatim copy of the
 * kernel a RECT pocket's WALL FINISH pass runs through TODAY — `contourLevel` over `pocketInsetRegion`'s rect contour —
 * kept alive solely so the wall re-point's equivalence bridges have an INDEPENDENT truth to compare against.
 *
 * ── WHY IT LANDS BEFORE THE ATOM, NOT AFTER ───────────────────────────────────────────────────────────────────────
 * The vacuity trap, t1385's lesson and t1406's, one atom further along. Every bridge in this act asserts "the literal
 * wall and the parametric `wallfinish` cut the same moves per level". A bridge that built its literal side by calling
 * `pocketStack` would, THE MOMENT the wall place is re-pointed, compare the parametric emit to itself and pass while
 * proving nothing. Freezing FIRST is the only ordering in which that cannot happen — and freezing before any product
 * change is provably safe, because at this commit the frozen leaf and the shipping one are the same code.
 *
 * ⚠ `pocketwall` IS NOT RETIRING THIS ACT, so the freeze earns its keep a second way. That atom still emits for every
 * arm outside the eligible one (non-rect, a rest tool, too small, an unproven strategy/entry) exactly as `pocketfill`
 * does. A bridge could therefore have used the LIVE registry today and stayed honest — right up until somebody
 * re-points `contourLevel` or `offsetRegion` themselves, at which point the baseline would move silently underneath
 * every assertion in this act. Frozen is the only version of "as it ships TODAY" that stays true.
 *
 * ── WHAT IS FROZEN HERE, AND WHAT IS DELIBERATELY BORROWED ────────────────────────────────────────────────────────
 * FROZEN HERE: `contourLevel` (clearing.js) verbatim as of t1431, and the leaf that wraps it.
 * BORROWED from the sibling `literalPocketFill.js`: `entryOrPlunge`/`levelEntry`, `rectContour`, `offsetRegion`,
 * `refTrueRegionFromFlat` and `refPocketInsetRegion` — already frozen there at t1406 from the SAME source files. A
 * second copy of a frozen kernel is not "more frozen"; it is two baselines that can be edited apart, which is the one
 * failure a reference cannot survive. So the shared arithmetic has exactly one frozen home and this module names it.
 *
 * NOT frozen (and must not be): the StepDown fold, the place fold, modal-feed folding, label uniquification, cap
 * gating. The reference installs as an ordinary `kind:'leaf'` so all of that still runs through the REAL emitter —
 * re-implementing it here would test a second emitter instead of the one that ships.
 *
 * ── RECT ONLY, BY DECLARATION ─────────────────────────────────────────────────────────────────────────────────────
 * The re-point touches the RECT arm and nothing else. `pocketwall` also has a `circleTrace` branch (a true G2/G3 arc);
 * it is NOT copied, and the borrowed `offsetRegion`/`regionDesc` throw by name on any non-rect shape rather than
 * quietly answering for a walk this reference was never checked against.
 *
 * ⚠ DO NOT "FIX" ANYTHING IN HERE. A quirk in this kernel is part of the reference.
 */

import { entryOrPlunge, refPocketInsetRegion } from './literalPocketFill.js';

const r3 = (n) => Math.round(n * 1000) / 1000;
const num = (v, d) => { const n = Number(v); return isFinite(n) ? n : d; };

/* ==== FROZEN VERBATIM: clearing.js  contourLevel ==== */
/** Trace each contour once at depth z: retract, descend at the ring start, then run the ring and close it. */
export function contourLevel(contours, ctx) {
    const { z, clr, feed, plunge } = ctx;
    const L = [];
    for (const c of contours) {
        if (c.length < 2) continue;
        L.push(`G0 Z${r3(clr)}`);
        // t842 — depth entry at the ring start: ramp along the FIRST SEGMENT c[0]→c[1] (a profile lead-in). ctx.entry absent
        // (pocket wall finish / a plain contour) → the exact plunge, byte-identical. Contour offers NO helix (it would gouge
        // the profile interior) so only ramp is threaded here.
        const ec = ctx.entry && ctx.entry !== 'plunge'
            ? { ...ctx, runX: c[1].x - c[0].x, runY: c[1].y - c[0].y, runLen: Math.hypot(c[1].x - c[0].x, c[1].y - c[0].y) }
            : ctx;
        L.push(...entryOrPlunge(ec, c[0].x, c[0].y, [`G0 X${r3(c[0].x)} Y${r3(c[0].y)}`, `G1 Z${r3(z)} F${plunge}`]));
        for (let i = 1; i < c.length; i++) L.push(`G1 X${r3(c[i].x)} Y${r3(c[i].y)} F${feed}`);
        L.push(`G1 X${r3(c[0].x)} Y${r3(c[0].y)} F${feed}`);
    }
    return L;
}

/**
 * THE FROZEN LEAF. The same contract as the live `pocketwall` block (`kind:'leaf'`, the StepDown fold supplies `z`)
 * so the StepDown/place folds, modal-feed folding and cap gating all run through the REAL emitter — only the walk is
 * frozen. Registered under its own type so it can never shadow the shipping atom.
 *
 * ⚠ THE `circleTrace` BRANCH IS ABSENT ON PURPOSE, not forgotten: the live emit reads
 * `rg.kind === 'circle' ? circleTrace(…) : contourLevel(…)`, and the borrowed `refPocketInsetRegion` throws on a
 * circle long before that ternary could be reached. Copying a branch this reference cannot exercise would be a second
 * unverified kernel wearing a reference's clothes.
 */
export const pocketWallRefBlock = {
    type: 'pocketwall_ref', label: 'Pocket Wall (frozen ref)', kind: 'leaf', category: 'Toolpaths',
    defaults: { shape: 'rect', originX: 0, originY: 0, w: 80, h: 60, dia: 50, sides: 6, wallOffset: 0, toolDia: 6, z: 'z', feed: 600, plunge: 150, clearance: 5 },
    fields: ['shape', 'originX', 'originY', 'w', 'h', 'dia', 'sides', 'wallOffset', 'toolDia', 'z', 'feed', 'plunge', 'clearance'],
    emit: (p) => {
        const rg = refPocketInsetRegion(p);
        const z = num(p.z, 0), clr = num(p.clearance, 5), feed = num(p.feed, 600), plunge = num(p.plunge, 150);
        return contourLevel(rg.contour, { z, clr, feed, plunge });
    },
};

/** Install the frozen wall leaf into a live BLOCKS registry (the t1385 shape). Returns the types it added. */
export function installLiteralPocketWallRef(BLOCKS) {
    BLOCKS[pocketWallRefBlock.type] = pocketWallRefBlock;
    return [pocketWallRefBlock.type];
}

/**
 * THE FROZEN WALL COMPOSITION — `place{ stepdown{ wall } }`, the shape `pocketStack.wallPlace()` builds TODAY, with
 * the frozen leaf in place of the live one. `deps` are the framing helpers the re-point does NOT change, injected
 * rather than imported so the boundary stays visible: what is frozen is the SHAPE and the order of its children,
 * which is precisely what the re-point moves.
 *
 * It is a SEPARATE export from the sibling's `refPocketLiteralStack` rather than a phase of it, and that is the
 * difference between the two acts: at t1406 the wall was a phase INSIDE one StepDown, so decomposing that composition
 * was the only way to state a per-phase criterion. Since t1406 the wall has had a place of its own — so its literal
 * reference is a whole stack, and the bridge compares two stacks instead of two slices.
 */
export function refPocketWallStack(params, deps) {
    const { newBlock, makeStart, makeEnd, makePlace } = deps;
    const clr = num(params.clearance, 5), feed = num(params.feed, 2000), plunge = num(params.plunge, 150);
    const depth = num(params.depth, 4), by = num(params.stepdown, 1.5);
    const wcs = newBlock('wcs'); wcs.params = { wcs: params.wcs || 'active' };
    const geom = { shape: params.shape || 'rect', originX: num(params.originX, 0), originY: num(params.originY, 0), w: num(params.w, 80), h: num(params.h, 60), dia: num(params.dia, 50), sides: num(params.sides, 6), wallOffset: num(params.wallOffset, 0), toolDia: num(params.toolDia, 6) };
    const wall = newBlock('pocketwall_ref');
    wall.params = { ...geom, z: 'z', feed, plunge, clearance: clr };
    const down = newBlock('stepdown');
    down.params = { to: depth, by, confirmEvery: num(params.confirmEvery, 0) };
    down.children = [wall];
    const bb = { minX: geom.originX, maxX: geom.originX + geom.w, minY: geom.originY, maxY: geom.originY + geom.h };
    return [makeStart(params), wcs, makePlace(params, bb, [down], 'wall'), makeEnd(params)];
}
