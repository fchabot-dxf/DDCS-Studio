/**
 * blocks/programFraming.js — build Program Start / Program End block records from wizard params.
 *
 * The cutting wizards' stacks wrap their op with these so the framing is explicit blocks (see ops/program.js).
 * Lives here (not in ops/program.js) because it needs newBlock from blockModel, which would cycle through
 * ops/index back into ops/program.
 */
import { newBlock } from './blockModel.js';
import { num } from '../wizards/ops/util.js';

/** Program Start from wizard params: spindle (rpm/dir/spin-up) + clearance. */
export function makeStart(params = {}) {
    const sp = params.spindle || {};
    const rpm = num(params.rpm, 0) > 0 ? num(params.rpm, 0) : num(sp.defaultRpm, 0);
    const b = newBlock('progstart');
    b.params = { rpm, dir: sp.dir || 'cw', spinUp: num(sp.spinUp, 0), clearance: num(params.clearance, 5) };
    return b;
}

/** Wrap an op's cutting block(s) in a PlaceOnStock atom that sits the op on the stock — its path-datum corner
 *  attaches to the chosen stock corner + signed offset (see ops/placeOnStock.js + ops/placement.js). The geometry
 *  bbox {minX,maxX,minY,maxY} + stock dims/datum are SNAPSHOTTED so the block is self-contained and stable, and the
 *  2D layout uses the SAME bbox so 2D and 3D agree. `children` may be one block or an array. */
export function makePlace(params = {}, bbox, children) {
    const bb = bbox || { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    const b = newBlock('placeonstock');
    b.params = {
        stockAttach: params.stockAttach || '', pathDatum: params.pathDatum || '',
        offX: num(params.originX, 0), offY: num(params.originY, 0), offZ: num(params.offZ, 0), optIn: !!params.optIn,
        stockW: num(params.stockW, 0), stockH: num(params.stockH, 0), stockDatum: params.stockDatum || 'nnp',
        bminX: bb.minX, bmaxX: bb.maxX, bminY: bb.minY, bmaxY: bb.maxY,
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
