/**
 * wizards/surfacingWizard.js — face / surfacing generator (Mill group).
 *
 * REWRITTEN AS A BLOCK STACK: the wizard has ONE implementation — `surfacingStack(params)` builds the
 * primitive stack and `generate()` emits it. The STUDIO form and the Blocks view are two editors of that
 * same stack, so the G-code is identical by construction (no parallel converter). Surfacing = StepDown{
 * StepOver(Region) } with NO radius inset (the area is the tool-CENTRE sweep, so the tool overhangs the edge
 * and faces the whole top) and no wall pass. Rect only; raster → parallel rows, else concentric rings.
 */
import { newBlock, emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
import { makeStart, makeEnd, makePlace, makeSkim } from '../blocks/programFraming.js';
import { num } from './ops/util.js';

/** The faced area's footprint on the stock — shared by the stack (PlaceOnStock snapshot) + the 2D view. */
export function surfacingBBox(params = {}) {
    const ox = num(params.originX, 0), oy = num(params.originY, 0);
    return { minX: ox, maxX: ox + num(params.w, 100), minY: oy, maxY: oy + num(params.h, 80) };
}

/**
 * t1359 — THE MIGRATION'S GROUND TRUTH, KEPT ALIVE ON PURPOSE AND CALLED BY NOTHING THAT SHIPS.
 *
 * This IS the old literal emitter: StepDown{ SurfaceFill } unrolled in JavaScript, every row at every depth as a
 * literal G1. `surfacingStack` no longer builds it — the parametric atom does — and it is preserved here under a
 * name that says what it is for, because of a trap that would otherwise close silently:
 *
 *   THE EQUIVALENCE BRIDGES READ THE LITERAL THROUGH THIS FUNCTION. Re-pointing `surfacingStack` without first
 *   giving them their own reference would make every one of them compare the parametric emit TO ITSELF — and pass.
 *   The whole safety argument of this arc would go vacuous in the exact moment it was supposed to be cashed in,
 *   with a green suite saying nothing at all.
 *
 * So it is moved FIRST, in the same act as the re-point, and it stays: the bridges keep executing the comparison
 * that licensed the migration, for as long as anyone might need to re-check it.
 *
 * WHAT KEEPS IT TEST-ONLY: `tests/surfacing-both-paths-1361.spec.js` (a) scans every .js under web/ and fails if any
 * of them so much as names this function, and (b) requires every route that builds a surfacing op — this stack, the
 * data twin, and the wizard the STUDIO form calls — to come out carrying `surfaceraster` and neither `stepdown` nor
 * `surfacefill`. Nothing under web/ may reach this, and that is CHECKED, not asked. (t1361 — this paragraph used to
 * cite an `assert-no-app-import` test that had never been written; the guard described here is the one that exists.)
 */
export function surfacingLiteralStack(params = {}) {
    const tool = Math.max(0.1, num(params.toolDia, 12));
    // stepover: the FORM precomputes tool·% → a flat `stepover` (the data-def binds that one socket); the math is the
    // legacy fallback for the toolDia/% form path. strategy: take the socket value directly (the form's 'raster' → parallel).
    const so = Math.max(0.2, ('stepover' in params) ? num(params.stepover, 0) : tool * num(params.stepoverPct, 60) / 100);
    const strat = (params.strategy === 'concentric') ? 'concentric' : 'parallel';
    const clr = num(params.clearance, 5), feed = num(params.feed, 2000), plunge = num(params.plunge, 200);
    const w = num(params.w, 100), h = num(params.h, 80);

    // The fill region is defined LOCALLY at (0,0); PlaceOnStock owns the part position (offX = originX), so originX/originY
    // are a single placement socket — bindable like drill, not woven through the geometry. Byte-identical: placementShift
    // anchors the bbox min-corner (x = originX − bbox.minX), so region-at-0 + shift originX == region-at-originX + shift 0.
    const fill = newBlock('surfacefill');
    fill.params = { shape: 'rect', x: 0, y: 0, w, h, stepover: so, strategy: strat, direction: 'bothways',
        entry: params.entry || 'plunge', rampAngle: num(params.rampAngle, 3), helixDia: num(params.helixDia, 0), helixPitch: num(params.helixPitch, 1), by: 'by', toolDia: tool,   // t842 — depth entry (plunge/ramp/helix); by from the StepDown scope; toolDia feeds the helix clamp
        z: 'z', feed, plunge, clearance: clr };

    const down = newBlock('stepdown');
    down.params = { to: num(params.depth, 0.5), by: num(params.stepdown, 0.5), confirmEvery: num(params.confirmEvery, 0) };   // t1031 — pause every N passes (0 = off → byte-identical)
    down.children = [fill];
    const wcs = newBlock('wcs'); wcs.params = { wcs: params.wcs || 'active' };   // 'active' emits nothing
    if (params.zMode === 'skim') {
        // SKIM (t982): whole-op RELATIVE (G91) from the jog start — jog to a corner, touch, face. No placement (the jog IS
        // the reference — makeSkim replaces makePlace at the SAME position, keeping wcs so the flat block indices stay parallel
        // to Normal → the data-op bindings work unchanged for both modes). wcs='active' emits nothing (byte-identical). progstart
        // drops its absolute clearance; makeSkim prepends a relative lift + relativizes the body + wraps G91…G90; makeEnd's G53
        // safe-Z retract stays machine-frame absolute after the G90 exit.
        return [makeStart({ ...params, skim: true }), wcs, makeSkim(params, down), makeEnd(params)];
    }
    return [makeStart(params), wcs, makePlace(params, { minX: 0, maxX: w, minY: 0, maxY: h }, down), makeEnd(params)];   // local 0-based bbox snapshot (live-extent overrides it)
}

// t1728 (gameplan step 1) — surfacingStack MOVED to stacks/surfacingWizard.js (the twin's own builder dependency, kept
// importable+re-exported here unchanged for every other existing caller — pure move). surfacingLiteralStack above stays
// put (test-only, no app-code importer — see its own header) and is UNAFFECTED by this move.
import { surfacingStack } from './stacks/surfacingWizard.js';
export { surfacingStack };

export class SurfacingWizard {
    generate(params) {
        recordOp('surfacing', params);   // let the Blocks tab open this op as its stack
        const w = num(params.w, 100), h = num(params.h, 80);
        // Emit THROUGH the block stack — the same stack the Blocks tab renders/edits.
        const stack = (w <= 0 || h <= 0) ? [makeStart(params), makeEnd(params)] : surfacingStack(params);
        return emitMapped(stack, activeDialectOpts()).text;
    }
}
