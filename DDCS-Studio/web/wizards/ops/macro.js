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
import { M, raw, line, set } from '../words.js';
import { g53 } from '../dialect.js';

export const machineMoveBlock = {
    type: 'machinemove', label: 'Machine Move', kind: 'leaf', category: 'Move',
    defaults: { axis: 'Z', to: '#99', var: '#99' }, fields: ['axis', 'to', 'var'],   // axis X/Y/Z/A; G53 (machine) frame
    // DDCS rule: G53 must take a VARIABLE, not a literal (a constant fails on M350). If `to` is already a
    // variable (e.g. a stored #57 from Read Machine) → G53 straight to it; if it's a number → stage it in `var` first.
    emit: (p) => {
        const axis = p.axis || 'Z', t = p.to;
        if (typeof t === 'string' && t.trim().startsWith('#')) return [g53(axis, t.trim(), 'machine move')];
        const v = p.var || '#99';
        return [line([set(v, r3(num(t, 0)))], `machine ${axis} target`), g53(axis, v, 'machine move')];
    },
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
