/**
 * wizards/ops/spindle.js — SPINDLE: machine state. The "spindle rotation" that turns a Cut move into a cut.
 *
 * Emits a modal command (`M3 S<rpm>`, or `M5` when rpm = 0) — G-code is modal, so everything below it
 * inherits the running spindle without any explicit state threading.
 */
import { num, r3 } from './util.js';

export const spindleBlock = {
    type: 'spindle', label: 'Spindle', kind: 'leaf', category: 'Machine',
    defaults: { rpm: 12000, dir: 'cw' },
    fields: ['rpm', 'dir'],          // dir = cw (M3) / ccw (M4); rpm 0 → M5 (off)
    emit: (p) => {
        const r = num(p.rpm, 0);
        if (r <= 0) return ['M5   ( spindle off )'];
        return [`M${p.dir === 'ccw' ? 4 : 3} S${r3(r)}   ( spindle ${p.dir === 'ccw' ? 'CCW' : 'CW'} )`];
    },
};
