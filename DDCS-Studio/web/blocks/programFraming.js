/**
 * blocks/programFraming.js — build Program Start / Program End block records from wizard params.
 *
 * The cutting wizards' stacks wrap their op with these so the framing is explicit blocks (see ops/program.js).
 * Lives here (not in ops/program.js) because it needs newBlock from blockModel, which would cycle through
 * ops/index back into ops/program.
 */
import { newBlock, absorbingChild } from './blockEmitter.js';
import { num } from '../wizards/ops/util.js';

/** Program Start from wizard params: spindle (rpm/dir/spin-up) + clearance. */
export function makeStart(params = {}) {
    const sp = params.spindle || {};
    const rpm = num(params.rpm, 0) > 0 ? num(params.rpm, 0) : num(sp.defaultRpm, 0);
    const b = newBlock('progstart');
    // t982/t984 — thread `skim` through: in Skim mode progstart drops its ABSOLUTE `G0 Z<clr>` (a relative op has no
    // WCS-Z; an absolute pre-G91 Z move would rapid to an unknown work Z = a crash). Omitted/false → byte-identical.
    b.params = { rpm, dir: sp.dir || 'cw', spinUp: num(sp.spinUp, 0), clearance: num(params.clearance, 5), skim: !!params.skim };
    return b;
}

/** Wrap an op's cutting block(s) in a PlaceOnStock atom that sits the op on the stock — its path-datum corner
 *  attaches to the chosen stock corner + signed offset (see ops/placeOnStock.js + ops/placement.js). The geometry
 *  bbox {minX,maxX,minY,maxY} + stock dims/datum are SNAPSHOTTED so the block is self-contained and stable, and the
 *  2D layout uses the SAME bbox so 2D and 3D agree. `children` may be one block or an array.
 *  t1406 — `role` (default '') NAMES which phase of its op this placement frames, for an op placed more than once
 *  (pocket: 'clear' + 'wall'). It emits nothing; it exists so a twin's binding spec can identify ONE of them. Omitting
 *  it leaves the block exactly as it was — every other caller is unchanged. See ops/placeOnStock.js for the why. */
export function makePlace(params = {}, bbox, children, role = '') {
    const bb = bbox || { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const b = newBlock('placeonstock');
    b.params = {
        stockAttach: params.stockAttach || '', pathDatum: params.pathDatum || '',
        offX: num(params.originX, 0), offY: num(params.originY, 0), offZ: num(params.offZ, 0), optIn: !!params.optIn,
        stockW: num(params.stockW, 0), stockH: num(params.stockH, 0), stockZ: num(params.stockZ, 0), stockDatum: params.stockDatum || 'nnp',
        bminX: bb.minX, bmaxX: bb.maxX, bminY: bb.minY, bmaxY: bb.maxY, role,
    };
    b.children = Array.isArray(children) ? children : [children];
    return b;
}

/** Wrap block(s) in a ROTATE atom — rotate their XY geometry by `angle` (deg CCW) about (pivotX,pivotY). The atom
 *  behind ⟳ Align (wraps the whole program) and a per-op rotate (wraps one op). `children` may be one block or an
 *  array. See ops/rotate.js + the blockModel kind:'rotate' fold. */
export function makeRotate(params = {}, children) {
    const b = newBlock('rotate');
    b.params = { angle: num(params.angle, 0), pivotX: num(params.pivotX, 0), pivotY: num(params.pivotY, 0) };
    b.children = Array.isArray(children) ? children : [children];
    return b;
}

/** t982 — SKIM Z-mode: wrap the cutting body in a `skim` atom so the whole op emits RELATIVE (G91) from the jog start
 *  (jog to a corner, touch, face — no WCS datum). The atom prepends a clearance lift + relativizes the body (blockEmitter
 *  kind:'skim'); pair it with makeStart({skim:true}) so progstart drops its own absolute clearance. `children` = the body. */
export function makeSkim(params = {}, children) {
    const b = newBlock('skim');
    b.params = { clearance: num(params.clearance, 5) };
    b.children = Array.isArray(children) ? children : [children];
    // t1620 — stamp zMode:'skim' on the absorbing child at BUILD time so uniquifyFlowLabels reserves its skimErr/skimOk
    // labels. Without it those fall back to 93/94 (already taken by the row-walk) and the raster's post-plunge GOTO
    // lands on the skim-OK label → the sweep never runs (the sim showed one plunge, no carve). Twin path is fixed the
    // same way in dataOps/skimStructure.js swapPlaceToSkim.
    const absorber = absorbingChild(b.children);
    if (absorber) absorber.params = { ...(absorber.params || {}), zMode: 'skim' };
    return b;
}

/** t736 — the DECLARED program-level ROTATION: a flat childless `xform` sibling carrying {angle,pivotX,pivotY}. Emits
 *  nothing itself; blockEmitter.applyProgramTransform applies it ONCE over the whole program at generation. Sits at the
 *  TOP of the stack (a program declaration). See ops/transform.js. */
export function makeXform(params = {}) {
    const b = newBlock('xform');
    b.params = { angle: num(params.angle, 0), pivotX: num(params.pivotX, 0), pivotY: num(params.pivotY, 0) };
    return b;
}

/** t812 — a PROGRAM-LEVEL entry waypoint as a flat childless `entry` sibling carrying {entryX,entryY}. Emits nothing
 *  itself; blockEmitter.applyEntryWaypoint inserts the opening G0 X Y ( entry ) before the first cut. Mirror of makeXform
 *  — used to RECONSTRUCT a program-level entry from its .nc marker (a nested per-op entry rides its own op marker). */
export function makeEntry(params = {}) {
    const b = newBlock('entry');
    const ex = parseFloat(params.entryX), ey = parseFloat(params.entryY);
    b.params = { entryX: Number.isFinite(ex) ? ex : '', entryY: Number.isFinite(ey) ? ey : '' };
    return b;
}

/** t879 — the TWO-SIDED FLIP as a flat childless `flip` sibling carrying {axis, setup}. Emits nothing itself;
 *  blockEmitter.applySetupFlips mirrors the named setup's own line range. Mirror of makeXform — used to RECONSTRUCT the
 *  flip declaration from its .nc prog marker (the setup containers themselves round-trip via .mjson). See ops/transform.js. */
export function makeFlip(params = {}) {
    const b = newBlock('flip');
    b.params = { axis: String(params.axis || 'X').toUpperCase() === 'Y' ? 'Y' : 'X', setup: num(params.setup, 2) };
    return b;
}

/** Program End from wizard params: the configured end-of-program routine. */
export function makeEnd(params = {}) {
    const ep = params.endProgram || {};
    const b = newBlock('progend');
    b.params = {
        spindleOff: ep.spindleOff !== false, coolantOff: ep.coolantOff !== false,
        retract: ep.retract !== false, retractZ: num(ep.retractZ, 0),
        park: ep.park === true, parkX: num(ep.parkX, 0), parkY: num(ep.parkY, 0),
        end: ep.end || 'M30',
    };
    return b;
}
