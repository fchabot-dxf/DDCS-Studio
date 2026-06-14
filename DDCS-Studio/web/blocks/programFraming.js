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
