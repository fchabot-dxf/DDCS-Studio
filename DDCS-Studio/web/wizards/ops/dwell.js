/** wizards/ops/dwell.js — DWELL (Machine): pause in place for `sec` seconds (G4) — e.g. spindle spin-up. */
import { num, r3 } from './util.js';

export const dwellBlock = {
    type: 'dwell', label: 'Dwell', kind: 'leaf', category: 'Machine',
    defaults: { sec: 1 },
    fields: ['sec'],
    emit: (p) => [`G4 P${r3(num(p.sec, 0))}   ( dwell )`],
};
