/**
 * wizards/ops/spindle.js — SPINDLE: machine state. The "spindle rotation" that turns a Cut move into a cut.
 *
 * Emits a modal command (`M3 S<rpm>`, or `M5` when rpm = 0) — G-code is modal, so everything below it
 * inherits the running spindle without any explicit state threading.
 */
import { num, val } from './util.js';

export const spindleBlock = {
    type: 'spindle', label: 'Spindle', kind: 'leaf', category: 'Spindle & Feed',
    defaults: { rpm: 12000, dir: 'cw' },
    fields: ['rpm', 'dir'],          // dir = cw (M3) / ccw (M4); rpm 0 → M5 (off)
    emit: (p) => {
        const dir = p.dir === 'ccw' ? 4 : 3, lbl = p.dir === 'ccw' ? 'CCW' : 'CW';
        if (typeof p.rpm === 'string' && /[#[]/.test(p.rpm)) return [`M${dir} S${p.rpm.trim()}   ( spindle ${lbl} )`];   // #var rpm
        const r = num(p.rpm, 0);
        if (r <= 0) return ['M5   ( spindle off )'];
        return [`M${dir} S${val(r)}   ( spindle ${lbl} )`];
    },
};
