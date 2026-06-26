/**
 * wizards/ops/program.js — PROGRAM FRAMING primitives (Machine): the start and end of a full program.
 *
 * These make the header/footer EXPLICIT blocks instead of auto-injected framing — so a program is just a
 * stack that begins with Program Start and ends with Program End, and a SNIPPET (probe/WCS/comms) is simply
 * a stack without them (no special "bare" mode). Both route through the active dialect.
 *   Program Start — G90 absolute + spindle on (+ spin-up dwell) + rapid to clearance.
 *   Program End   — spindle off / coolant off / G53 retract / optional park / M30 (or M2).
 */
import { num } from './util.js';
import { headerBlock, footerBlock } from '../cuttingBlocks.js';

export const progStartBlock = {
    type: 'progstart', label: 'Program Start', kind: 'leaf', category: 'Program',
    defaults: { rpm: 12000, dir: 'cw', spinUp: 0, clearance: 5 },
    fields: ['rpm', 'dir', 'spinUp', 'clearance'],
    emit: (p, dx, dy, dialect) => [
        ...headerBlock({ spindle: { dir: p.dir, spinUp: num(p.spinUp, 0) }, rpm: num(p.rpm, 0), dialect }),
        `G0 Z${num(p.clearance, 5)}   ( clearance )`,
    ],
};

const truthy = (v) => v !== false && v !== 'false' && v !== 0 && v !== '0';

export const progEndBlock = {
    type: 'progend', label: 'Program End', kind: 'leaf', category: 'Program',
    defaults: { spindleOff: true, coolantOff: true, retract: true, retractZ: 0, park: false, parkX: 0, parkY: 0, end: 'M30' },
    fields: ['spindleOff', 'coolantOff', 'retract', 'retractZ', 'park', 'parkX', 'parkY', 'end'],
    emit: (p, dx, dy, dialect) => footerBlock({
        endProgram: {
            spindleOff: truthy(p.spindleOff), coolantOff: truthy(p.coolantOff),
            retract: truthy(p.retract), retractZ: num(p.retractZ, 0),
            park: p.park === true || p.park === 'true', parkX: num(p.parkX, 0), parkY: num(p.parkY, 0),
            end: p.end || 'M30',
        }, dialect,
    }),
};
