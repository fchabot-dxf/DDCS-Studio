/** wizards/ops/dwell.js — DWELL (Machine): pause in place for `sec` seconds. PROFILE-AWARE: the dialect
 *  handles the P units (ms on Expert/V4.1, seconds on DM500). */
import { num } from './util.js';

export const dwellBlock = {
    type: 'dwell', label: 'Dwell', kind: 'leaf', category: 'Machine',
    defaults: { sec: 1 },
    fields: ['sec'],
    emit: (p, dx, dy, dialect) => dialect.dwell(num(p.sec, 0)),
};
