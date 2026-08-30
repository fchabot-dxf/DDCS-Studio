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
    help: "The program's own header — switches to absolute positioning, starts the spindle at the given RPM/direction (with an optional spin-up pause), then rapids up to clearance height. Every program should start with exactly one of these.",
    labels: { dir: 'direction', spinUp: 'spin-up dwell', skim: 'relative program (skim)' },
    defaults: { rpm: 12000, dir: 'cw', spinUp: 0, clearance: 5, skim: false },
    fields: ['rpm', 'dir', 'spinUp', 'clearance', 'skim'],
    // t982 — `skim`: a relative (G91) op has no absolute WCS-Z, so the opening clearance can't be an absolute `G0 Z<clr>`;
    // the wrapping skim atom emits the clearance as a RELATIVE lift instead. skim omitted/false → byte-identical (the clearance stays).
    emit: (p, dx, dy, dialect) => [
        ...headerBlock({ spindle: { dir: p.dir, spinUp: num(p.spinUp, 0) }, rpm: num(p.rpm, 0), dialect }),
        ...(p.skim ? [] : [`G0 Z${num(p.clearance, 5)}   ( clearance )`]),
    ],
};

const truthy = (v) => v !== false && v !== 'false' && v !== 0 && v !== '0';

export const progEndBlock = {
    type: 'progend', label: 'Program End', kind: 'leaf', category: 'Program',
    help: "The program's own footer — stops the spindle and coolant, retracts (optionally to a park position), then ends the program. Every program should end with exactly one of these.",
    labels: { retractZ: 'retract to Z', parkX: 'park X', parkY: 'park Y', end: 'end code' },
    defaults: { spindleOff: true, coolantOff: true, retract: true, retractZ: 0, park: false, parkX: 0, parkY: 0, end: 'M30' },
    fields: ['spindleOff', 'coolantOff', 'retract', 'retractZ', 'park', 'parkX', 'parkY', 'end'],
    allFields: ['spindleOff', 'coolantOff', 'retract', 'retractZ', 'park', 'parkX', 'parkY', 'end'],
    // t2399 (BACKLOG #48 item 5) — `retractZ` only matters when `retract` is on, `parkX`/`parkY` only when
    // `park` is on (both read below in `emit`'s own `footerBlock` call) — every combination showed all 4 boxes
    // regardless, same dead-field shape as t2393's other fixes.
    //
    // `fieldsFor` is called from bridge.js's `apply()` with RAW `getFieldValue()` results for the `dynamic`-
    // listed fields — a Blockly checkbox reads back UPPERCASE 'TRUE'/'FALSE', not the lowercase/real-boolean
    // shape `emit`'s own `truthy()` below normally sees (that one reads the already-resolved op params, a
    // DIFFERENT stage of the pipeline). Live-caught: reusing `truthy()` here passed 'FALSE' as truthy (it only
    // rejects lowercase 'false'), so `park:'FALSE'` still showed retractZ/hid parkX/Y regardless of the real
    // toggle — a fresh block (init-time apply(), defaults untouched) never surfaced it since the DEFAULT
    // checkbox state happens to match `truthy()`'s own bias; only caught by explicitly testing the OFF state.
    dynamic: ['retract', 'park'],
    fieldsFor(p) {
        const on = (v) => v === true || v === 'TRUE';
        const f = ['spindleOff', 'coolantOff', 'retract'];
        if (on(p && p.retract)) f.push('retractZ');
        f.push('park');
        if (on(p && p.park)) f.push('parkX', 'parkY');
        f.push('end');
        return f;
    },
    emit: (p, dx, dy, dialect) => footerBlock({
        endProgram: {
            spindleOff: truthy(p.spindleOff), coolantOff: truthy(p.coolantOff),
            retract: truthy(p.retract), retractZ: num(p.retractZ, 0),
            park: p.park === true || p.park === 'true', parkX: num(p.parkX, 0), parkY: num(p.parkY, 0),
            end: p.end || 'M30',
        }, dialect,
    }),
};
