/**
 * wizards/ops/macro.js — program/machine-control primitives (Move/Machine), the footer + setup atoms.
 *
 * These are dialect-sensitive, so they emit through words.js/dialect.js (which honor the controller `rules`/
 * `fmt` back doors) instead of hardcoding strings — the audit flagged the G53 form etc. as controller-fragile.
 *   machine-move (G53) — rapid to an absolute MACHINE coordinate (one axis), bypassing the WCS.
 *   end-program (M30/M2) — terminate (+ rewind).
 *   M-Code — raw M-code escape hatch (drawbar M154/5, sensor-wait M300-2, dust-cover M162/3, M0 pause…).
 */
import { num, r3 } from './util.js';
import { M, raw, line } from '../words.js';
import { g53 } from '../dialect.js';

export const machineMoveBlock = {
    type: 'machinemove', label: 'Machine Move', kind: 'leaf', category: 'Move',
    defaults: { axis: 'Z', to: 0 }, fields: ['axis', 'to'],   // axis select X/Y/Z/A; G53 frame
    emit: (p) => [g53(p.axis || 'Z', r3(num(p.to, 0)), 'machine move')],
};

export const endProgramBlock = {
    type: 'endprogram', label: 'End Program', kind: 'leaf', category: 'Machine',
    defaults: { end: 'M30' }, fields: ['end'],   // M30 (end+rewind) | M2 (end)
    emit: (p) => [line([raw(p.end === 'M2' ? 'M2' : 'M30')], 'program end')],
};

export const mcodeBlock = {
    type: 'mcode', label: 'M-Code', kind: 'leaf', category: 'Machine',
    defaults: { code: 154 }, fields: ['code'],   // raw custom M-code (accessory output / sensor wait / pause)
    emit: (p) => [line([M(Math.max(0, Math.round(num(p.code, 0))))], 'M-code')],
};
