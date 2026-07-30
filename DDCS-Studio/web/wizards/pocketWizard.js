/**
 * wizards/pocketWizard.js — pocket clearing generator (Mill group).
 *
 * REWRITTEN AS A BLOCK STACK: the wizard's only implementation is `pocketStack(params)` →
 * [ StepDown{ StepOver(Region) [+ Wall(Region)] } ]. The Region is the tool-CENTRE boundary (inset by the
 * tool radius) so the FINISHED pocket matches the size you type. Strategy raster → parallel rows + a Wall
 * finish; spiral → concentric rings (which reach the wall). A pocket smaller than the tool falls back to a
 * single centre plunge (peck). Form and Blocks view are two editors of this one stack.
 */
import { newBlock, emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
import { makeStart, makeEnd, makePlace } from '../blocks/programFraming.js';
import { num } from './ops/util.js';
import { regionDesc } from './ops/region.js';
import { restValid } from './ops/restmachining.js';   // t871 — REST MACHINING: append a corner-clear pass with a smaller 2nd tool

/** The TRUE pocket region (rect = corner+size, circle/polygon = centre±R, ellipse = centre±(rx,ry)) — the size you
 *  type, before insetting. Shape-centred at (originX, originY) except rect (its corner). */
function trueRegionParams(params = {}) {
    const ox = num(params.originX, 0), oy = num(params.originY, 0), shape = params.shape || 'rect';
    if (shape === 'circle') return { shape: 'circle', x: ox, y: oy, w: num(params.dia, 50) };
    if (shape === 'polygon') return { shape: 'polygon', x: ox, y: oy, w: num(params.dia, 50), sides: num(params.sides, 6) };
    if (shape === 'ellipse') return { shape: 'ellipse', x: ox, y: oy, w: num(params.w, 80), h: num(params.h, 60) };
    return { shape: 'rect', x: ox, y: oy, w: num(params.w, 80), h: num(params.h, 60) };
}

/** A region DESCRIPTOR → region-block params (the inverse of regionDesc): rect = corner+size, circle/polygon =
 *  centre + Ø (polygon keeps its sides), ellipse = centre + the two diameters. */
export function regionParamsFromDesc(rg) {
    if (rg.kind === 'circle') return { shape: 'circle', x: rg.cx, y: rg.cy, w: 2 * rg.r };
    if (rg.kind === 'polygon') return { shape: 'polygon', x: rg.cx, y: rg.cy, w: 2 * rg.r, sides: rg.sides };
    if (rg.kind === 'ellipse') return { shape: 'ellipse', x: rg.cx, y: rg.cy, w: 2 * rg.rx, h: 2 * rg.ry };
    return { shape: 'rect', x: rg.x, y: rg.y, w: rg.w, h: rg.h };
}

/** The pocket's outer footprint on the stock (rect = corner+size, circle/polygon = centre±R, ellipse = centre±(rx,ry))
 *  — shared by the stack (for PlaceOnStock's snapshot) and the 2D view, so 2D and 3D place identically. */
export function pocketBBox(params = {}) {
    const ox = num(params.originX, 0), oy = num(params.originY, 0), shape = params.shape || 'rect';
    if (shape === 'circle' || shape === 'polygon') {
        const R = num(params.dia, 50) / 2;
        return { minX: ox - R, maxX: ox + R, minY: oy - R, maxY: oy + R };
    }
    if (shape === 'ellipse') {
        const rx = num(params.w, 80) / 2, ry = num(params.h, 60) / 2;
        return { minX: ox - rx, maxX: ox + rx, minY: oy - ry, maxY: oy + ry };
    }
    const w = num(params.w, 80), h = num(params.h, 60);
    return { minX: ox, maxX: ox + w, minY: oy, maxY: oy + h };
}

/** Would insetting the TRUE region by `inset` leave a degenerate (≤0) pocket → too small for the tool to clear?
 *  Checked on the unclamped geometry (offsetRegion floors radii at 0.01, which would hide it). */
function insetTooSmall(rg, inset) {
    if (rg.kind === 'circle') return rg.r - inset <= 0;
    if (rg.kind === 'polygon') return rg.r - inset / Math.cos(Math.PI / rg.sides) <= 0;
    if (rg.kind === 'ellipse') return rg.rx - inset <= 0 || rg.ry - inset <= 0;
    return rg.w - 2 * inset <= 0 || rg.h - 2 * inset <= 0;
}

/** Would the pocket inset degenerate (≤0) for these params → too small for the tool to clear (a single centre plunge
 *  instead of a stepover)? The ONE-SOURCE geometry-derived predicate — drives the concrete build AND the E0 tooSmall
 *  guard (the twin injects this into the prune params, since it can't be read off any single user param). */
export function pocketTooSmall(params = {}) {
    const r = Math.max(0.1, num(params.toolDia, 6)) / 2;
    return insetTooSmall(regionDesc(trueRegionParams(params)), r - num(params.wallOffset, 0));
}

/** The pocket CENTRE (the tooSmall drill-plunge point) — rect = corner+size/2; circle/polygon/ellipse = the shape origin.
 *  ONE-SOURCE: shared by pocketStack (the concrete drill arm) and the twin's postInstantiate (which rewrites the drill x/y
 *  from the resolved params, since the frozen superset template bakes them at the DEFAULT geometry). */
export function pocketDrillCentre(params = {}) {
    const d = regionDesc(trueRegionParams(params));
    return d.kind === 'rect' ? { cx: d.x + d.w / 2, cy: d.y + d.h / 2 } : { cx: d.cx, cy: d.cy };
}

/**
 * Pocket params → its block stack. The one source of truth for both displays. E0 (t467): the pocket geometry rides
 * FLAT pocketfill/pocketwall leaves (region-pill→flat REFRAME, byte-identical to the stepover+contour region-socket
 * path) so E1 can bind positionally; `opts.superset` carries BOTH structural forks GUARDED so pruneGuards collapses to
 * the concrete shape (the twin seam). The forks: `strategy` (raster → parallel clearing + a wall finish; spiral →
 * concentric clearing, no wall) is a real param → guarded directly; `tooSmall` is GEOMETRY-DERIVED → guarded on the
 * derived `_tooSmall` key (injected into the prune params by pocketTooSmall). Shapes/side/scalars are E1 value-swaps.
 */
export function pocketStack(params = {}, opts = {}) {
    const superset = !!opts.superset;
    const shape = params.shape || 'rect';
    const clr = num(params.clearance, 5), feed = num(params.feed, 2000), plunge = num(params.plunge, 150);
    const ox = num(params.originX, 0), oy = num(params.originY, 0);
    const raster = (params.strategy || 'spiral') === 'raster';
    const depth = num(params.depth, 4), by = num(params.stepdown, 1.5);
    const wcs = newBlock('wcs'); wcs.params = { wcs: params.wcs || 'active' };   // 'active' emits nothing

    // The pocket centre (the tooSmall drill point) — one source, shared with the twin's postInstantiate.
    const { cx, cy } = pocketDrillCentre(params);
    const tooSmall = pocketTooSmall(params);
    const bbox = pocketBBox(params);

    // The FLAT typed geometry the leaves carry (originX/originY = the shape origin) — one source for both leaves; each
    // recomputes the inset region + the absolute stepover internally (pocketfill.pocketInsetRegion / stepoverMm).
    const geom = { shape, originX: ox, originY: oy, w: num(params.w, 80), h: num(params.h, 60), dia: num(params.dia, 50), sides: num(params.sides, 6), wallOffset: num(params.wallOffset, 0), toolDia: num(params.toolDia, 6) };
    const fillLeaf = (strat) => { const b = newBlock('pocketfill'); b.params = { ...geom, stepoverPct: num(params.stepoverPct, 40), strategy: strat, direction: params.direction || 'bothways', entry: params.entry || 'plunge', rampAngle: num(params.rampAngle, 3), helixDia: num(params.helixDia, 0), helixPitch: num(params.helixPitch, 1), by: 'by', z: 'z', feed, plunge, clearance: clr }; return b; };   // strat: parallel (raster) | concentric (spiral); direction (t800 P6); entry (t804 P?) = per-level descent, params.entry || plunge → byte-identical; by='by' resolves the StepDown step from scope
    const wallLeaf = () => { const b = newBlock('pocketwall'); b.params = { ...geom, z: 'z', feed, plunge, clearance: clr }; return b; };
    /**
     * ── THE TOO-SMALL FALLBACK, RE-POINTED THROUGH holecycle (t1391, ruled) ────────────────────────────────────────
     *
     * A pocket narrower than its tool cannot be cleared, so it becomes a single plunge. That plunge used to be the literal
     * `drill` leaf — which made pocket the last consumer of an atom the whole drill arc had otherwise retired, and the
     * reason `drill.js` could not die. The fork was ruled: NOT a second single-hole emitter beside the parametric family
     * (that hand-rolls exactly what the arc unified), but the family's own `holecycle` degenerated to one hole.
     *
     * ⚠ THE CENTRE GOES IN x0/y0, NOT x/y, AND THAT IS NOT COSMETIC. For the literal leaf, `x`/`y` WERE the hole's
     * position and the place fold rewrote its emitted text. `holecycle` declares `absorbsPlacement`, so the fold hands it
     * the shift THROUGH `x`/`y` as params instead — writing the plunge centre there would collide with the placement.
     * `x0`/`y0` are the pattern's own origin, which folds into the frame at build time, so the hole lands at the centre
     * AND the placement still applies on top. (`postInstantiate` in pocketData writes the same two keys, for the same reason.)
     */
    const drillPlace = () => {
        const hole = newBlock('holecycle');
        hole.params = { pattern: 'single', cycle: 'peck', x0: cx, y0: cy, depth, peck: by, feed: plunge, clearance: clr };
        return makePlace(params, bbox, hole);
    };
    const GUARD = (when, kids) => { const g = newBlock('guard'); g.params = { when }; g.children = kids; return g; };
    // t871 — the REST section rides INSIDE the main clear's ONE placeonstock (a second place would duplicate the placement
    // bindings): a StepDown of the pocketrest leaf, preceded by a STATIC marker comment (so the twin freezes byte-identically
    // — the tool specifics live on the op + the setup sheet, not the baked text). Only when a valid smaller rest tool is
    // declared on a cornered shape → otherwise ABSENT, so the emit is byte-identical (goldens untouched).
    const restLeaf = () => { const b = newBlock('pocketrest'); b.params = { ...geom, restDia: num(params.restDia, 0), restStepover: num(params.restStepover, 40), depth, by, feed, plunge, clearance: clr }; return b; };   // a LEAF that loops its own depth levels (no 2nd stepdown → no depth-binding collision)
    const restInner = () => {
        const note = newBlock('comment'); note.params = { text: 'REST — smaller tool clears the corners; change tools here' };
        return [note, restLeaf()];
    };
    const clearPlace = (kids, restKids) => { const down = newBlock('stepdown'); down.params = { to: depth, by, confirmEvery: num(params.confirmEvery, 0) }; down.children = kids; return makePlace(params, bbox, restKids ? [down, ...restKids] : [down]); };   // t1031 — confirmEvery pause (0 = off → byte-identical)

    if (!superset) {   // concrete: the geometry-derived tooSmall + strategy select the arm directly
        if (tooSmall) return [makeStart(params), wcs, drillPlace(), makeEnd(params)];
        const kids = [fillLeaf(raster ? 'parallel' : 'concentric')];
        if (raster) kids.push(wallLeaf());   // raster leaves the wall un-finished → a Contour(on) finish pass
        return [makeStart(params), wcs, clearPlace(kids, restValid(params) ? restInner() : null), makeEnd(params)];   // t871 — rest inside the ONE place (byte-identical when unset)
    }
    // superset: BOTH forks present + guarded — tooSmall (drill vs clearing) on the derived `_tooSmall` key, strategy
    // (parallel+wall vs concentric) on the real param. prune keeps one tooSmall arm + one strategy arm → concrete shape.
    return [
        makeStart(params), wcs,
        GUARD({ param: '_tooSmall', is: true }, [drillPlace()]),
        GUARD({ param: '_tooSmall', is: false }, [clearPlace([
            GUARD({ param: 'strategy', is: 'raster' }, [fillLeaf('parallel'), wallLeaf()]),
            GUARD({ param: 'strategy', is: 'spiral' }, [fillLeaf('concentric')]),
        ], [GUARD({ param: '_rest', is: true }, restInner())])]),   // t871 — the rest corner-clear rides the SAME place, on the geometry-derived `_rest` guard (absent → byte-identical)
        makeEnd(params),
    ];
}

export class PocketWizard {
    generate(params) {
        recordOp('pocket', params);   // let the Blocks tab open this op as its stack
        return emitMapped(pocketStack(params), activeDialectOpts()).text;
    }
}
