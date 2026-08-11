/**
 * wizards/stacks/slotWizard.js — slot milling generator (Mill group).
 *
 * REWRITTEN AS A BLOCK STACK: the wizard's only implementation is `slotStack(params)` → a single Slot atom,
 * emitted through emitMapped. The Slot atom owns the geometry (slotPath kernel): a widened channel from
 * (ax,ay)→(bx,by) at any angle, width ≥ tool, zig-zag offset passes stepping down. Form and Blocks view are
 * two editors of this one stack.
 */
import { newBlock } from '../../blocks/blockEmitter.js';
import { makeStart, makeEnd, makePlace } from '../../blocks/programFraming.js';
import { num } from '../ops/util.js';
import { patternPoints } from '../ops/array.js';
import { pointsBBox } from '../ops/placement.js';
import { slotRasterArmGap, slotRasterParams } from '../ops/slot.js';   // t1500 — the MEASURED domain (t1498) + the slot's clearing in the atom's own words

/** The slot channel's footprint (A↔B widened by the cut width) — used by PlaceOnStock (when you attach to a corner)
 *  + the 2D view. */
export function slotBBox(params = {}) {
    const ax = num(params.ax, 0), ay = num(params.ay, 0), bx = num(params.bx, 60), by = num(params.by, 0);
    const W = num(params.width, num(params.toolDia, 6));   // t1444 — no width clamp: a no-op for every slot that cuts, a lie for the one that refuses (see slot.js extent)
    const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy) || 1;
    const px = (-dy / len) * (W / 2), py = (dx / len) * (W / 2);   // half-width, perpendicular to the centreline
    const xs = [ax + px, ax - px, bx + px, bx - px], ys = [ay + py, ay - py, by + py, by - py];
    return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) };
}

/** True when params ask for a repeated slot (a real pattern, not a single slot). */
export function slotPatterned(params = {}) {
    const p = params.pattern || 'single';
    return p !== 'single' && p !== '';
}

/** The array's pattern OFFSETS (origin 0,0 → relative shifts the slot is stamped at). */
export function slotPatternPoints(params = {}) {
    return patternPoints({ ...params, x0: 0, y0: 0, cx: 0, cy: 0 });
}

/** Footprint of the whole slot array = the base slot's bbox spread over the pattern offsets (Minkowski sum of
 *  axis-aligned boxes → add the mins/maxes). Used for PlaceOnStock when the array attaches to a stock corner. */
export function slotArrayBBox(params = {}) {
    const sb = slotBBox(params);
    if (!slotPatterned(params)) return sb;
    const pb = pointsBBox(slotPatternPoints(params));
    if (!pb) return sb;
    return { minX: sb.minX + pb.minX, maxX: sb.maxX + pb.maxX, minY: sb.minY + pb.minY, maxY: sb.maxY + pb.maxY };
}

/**
 * THE WIZARD'S NAMES → THE LEAF'S NAMES, declared ONCE (t1500).
 *
 * `ax/ay/bx/by/toolDia` are the words the FORM uses; `x0/y0/x1/y1/tool` are the words the LEAF and the whole measured
 * domain (`slotRasterArmGap`, `slotRasterParams`) use. The stack builder needs the map and so does the twin's guard
 * hook — and the twin's whole byte-identity claim is that both sides ask the SAME question of the SAME numbers, so
 * two copies of this map would be two chances to answer it differently. One source, read by both.
 */
export function slotLeafParams(params = {}) {
    return {
        x0: num(params.ax, 0), y0: num(params.ay, 0), x1: num(params.bx, 60), y1: num(params.by, 0),
        width: num(params.width, num(params.toolDia, 6)), tool: num(params.toolDia, 6),
        stepoverPct: num(params.stepoverPct, 40), depth: num(params.depth, 4), stepdown: num(params.stepdown, 1.5),
        entry: params.entry || 'plunge', rampAngle: num(params.rampAngle, 3), helixDia: num(params.helixDia, 0), helixPitch: num(params.helixPitch, 1),   // t842 — depth entry
        feed: num(params.feed, 2000), plunge: num(params.plunge, 150), clearance: num(params.clearance, 5),
    };
}

/**
 * ⚠ THE FOURTH CLAUSE, AND IT IS THE ONLY ONE THE LEAF CANNOT SEE — a PATTERNED slot keeps its literal kernel.
 *
 * `slotRasterArmGap` asks about a slot's CLEARING, in leaf words, and a pattern is not a property of the clearing —
 * it is the STRUCTURE the stack wraps around it. So the clause lives here, where the structure does, rather than
 * being smuggled into a leaf-scope gate that has no `pattern` to read.
 *
 * IT IS A STRUCTURAL REASON, NOT A CAUTION, AND THE MECHANISM WAS MEASURED RATHER THAN ASSUMED. A pattern wraps the
 * op in an `array` container, and the array is then the `placeonstock` fold's SOLE child — but `array` does not
 * declare `absorbsPlacement`, so the shift falls through to `translateProgram` instead of being handed over as
 * params. The first version of this note said that rewrite would SHEAR the body (t1349's `G0 X0 Y#47` becoming
 * `G0 X50 Y#47`); driving it proved otherwise, and the truth is worth having exactly. **t1353 already closed the
 * shear**: `translateProgram` REFUSES a parametric body outright and hands the text back untouched. So a placed,
 * patterned, re-pointed slot would not cut a sheared path — it would cut an UNPLACED one, silently ignoring the
 * stock-attach and the offset the operator set. Quieter than a shear and no better, so the pattern stays literal.
 */
export const SLOT_PATTERN_GAP = 'a PATTERNED slot stamps its op through an `array` container, and the array is not '
    + 'self-framing — so a placed pattern falls through to `translateProgram`, which REFUSES a parametric body '
    + '(t1353\'s guard, measured) and returns it unshifted: the stock-attach and offset would be silently dropped. '
    + 'The literal kernel\'s coordinate list takes that rewrite exactly, as it always has, so the single slot rides '
    + 'the atom and a pattern keeps the literal kernel until the array itself can absorb a placement';

/**
 * '' when THIS slot re-points onto the parametric atom, else the REASON it keeps its literal kernel — asked in the
 * WIZARD's words, so the form path, the twin's `_para` guard and the CAM table's why-column all read ONE predicate.
 *
 * The measured domain is `slotRasterArmGap`'s (t1498: the zero band, the helix's entry-end clamp, the ramp over a
 * and finally the atom's own envelope); this adds the one clause only the stack can see.
 */
export function slotStackArmGap(params = {}, regs = null) {
    if (slotPatterned(params)) return SLOT_PATTERN_GAP;
    // t1512 — `regs` threads through to the atom's envelope question so a caller that will emit LIVE knobs is judged on
    // the body it will really build (the CAM pack). The wizard passes nothing and reads exactly as it always has.
    return slotRasterArmGap(slotLeafParams(params), regs);
}

/** The predicate half of `slotStackArmGap` — one source, read by the concrete build AND the twin's deriveGuards. */
export function slotStackRidesRaster(params = {}) { return slotStackArmGap(params) === ''; }

/**
 * Slot params → [ Program Start, WCS, PlaceOnStock{ … }, Program End ]. One source of truth for both displays.
 *
 * ── t1500 — THE RE-POINT: the eligible slot's clearing IS the parametric atom ─────────────────────────────────────
 *
 * The whole slot capability arc (C4 → C2 → C1 → C3) taught `surfaceraster` the four things a slot's walk needs, and
 * t1498 MEASURED which slots that reaches: every accepted config reproduces the frozen kernel move for move. So the
 * eligible slot's place now holds the ATOM, and everything the gate refuses falls through to the literal leaf below,
 * unchanged and byte-identical — which is what makes the boundary testable rather than merely claimed.
 *
 * `opts.superset` carries BOTH arms GUARDED (on the derived `_para` key) so `pruneGuards` collapses the template to
 * the concrete shape — the twin seam, exactly as `pocketStack` does it. ⚠ THE FORK SITS AT THE **PLACE**, not inside
 * one: `absorbingChild` is strict about exactly ONE child, so a guard holding two clearings inside a single place
 * would stop the atom being handed its frame as params and the shift would be painted onto its macro text instead.
 */
export function slotStack(params = {}, opts = {}) {
    const superset = !!opts.superset;
    const slot = newBlock('slot');
    slot.params = slotLeafParams(params);
    // Repeat the slot in a pattern: wrap it in an Array container (origin 0,0 → offsets), exactly like drill = array(hole).
    let op = slot, bbox = slotBBox(params);
    if (slotPatterned(params)) {
        const arr = newBlock('array');
        arr.params = {
            pattern: params.pattern, x0: 0, y0: 0,
            cols: num(params.cols, 2), rows: num(params.rows, 2), dx: num(params.dx, 40), dy: num(params.dy, 30),
            count: num(params.count, 6), spacing: num(params.spacing, 30), angle: num(params.angle, 0),
            dia: num(params.dia, 80), startAngle: num(params.startAngle, 0),
            w: num(params.w, 100), h: num(params.h, 80), nx: num(params.nx, 3), ny: num(params.ny, 2),
            skip: params.skip || '',
        };
        arr.children = [slot];
        op = arr; bbox = slotArrayBBox(params);
    }
    const wcs = newBlock('wcs'); wcs.params = { wcs: params.wcs || 'active' };   // 'active' emits nothing

    /** The LITERAL arm, exactly as it has always been: the slot leaf (or the array of them) under its one place. */
    const litPlace = () => makePlace(params, bbox, op);   // opt-in placement
    /**
     * The RE-POINTED arm: ONE `surfaceraster` carrying the walk, the depth loop and the descent.
     *
     * The params are `slotRasterParams` and nothing else — the atom's slot-side inputs are ALL derived (an `atan2`
     * bearing, a `hypot` length, a placement that is `A − R(bearing)(0, width/2)` UNROUNDED), so re-deriving any of
     * them here would be a second source for numbers the bridges already measure against the frozen kernel.
     * The bbox is the slot channel's own, unchanged: t1498 measured the atom's bearing-turned `extent` equal to
     * `slotBBox` to six decimals at seven bearings, so both arms declare the same footprint by construction.
     */
    const rasterPlace = () => { const b = newBlock('surfaceraster'); b.params = slotRasterParams(slot.params); return makePlace(params, bbox, [b]); };

    if (!superset) {   // concrete: the measured gate selects the arm directly
        return [makeStart(params), wcs, slotStackRidesRaster(params) ? rasterPlace() : litPlace(), makeEnd(params)];
    }
    // superset: BOTH arms present + guarded on the derived `_para` key (the twin injects it before prune, since no
    // single user param carries it — it is geometry, entry and the atom's own envelope answered together).
    const GUARD = (when, kids) => { const g = newBlock('guard'); g.params = { when }; g.children = kids; return g; };
    return [
        makeStart(params), wcs,
        GUARD({ param: '_para', is: true }, [rasterPlace()]),
        GUARD({ param: '_para', is: false }, [litPlace()]),
        makeEnd(params),
    ];
}
