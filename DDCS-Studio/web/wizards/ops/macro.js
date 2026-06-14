/**
 * wizards/ops/macro.js — program/machine-control primitives (Move/Machine). PROFILE-AWARE via the active
 * dialect (wizards/dialects/*): machine-move and end-program render per controller.
 *   machine-move (G53) — rapid to an absolute MACHINE coordinate (one axis).
 *   end-program — terminate (M30 on DDCS).
 *   M-Code — raw M-code escape hatch (controller-agnostic): drawbar M154/5, sensor-wait M300-2, M0 pause…
 */
import { num, r3 } from './util.js';
import { M, line } from '../words.js';

export const machineMoveBlock = {
    type: 'machinemove', label: 'Machine Move', kind: 'leaf', category: 'Move',
    defaults: { axis: 'Z', to: '#99', var: '#99' }, fields: ['axis', 'to', 'var'],
    // DDCS rule: G53 needs a VARIABLE (a literal fails on M350). If `to` is already a #var (e.g. a stored #57
    // from Read Machine) → move straight to it; if it's a number → stage it in `var` first, then move.
    emit: (p, dx, dy, dialect) => {
        const axis = p.axis || 'Z', t = p.to;
        if (typeof t === 'string' && t.trim().startsWith('#')) return dialect.machineMove(axis, t.trim());
        const v = p.var || '#99';
        return [`${v}=${r3(num(t, 0))}`, ...dialect.machineMove(axis, v)];
    },
};

export const endProgramBlock = {
    type: 'endprogram', label: 'End Program', kind: 'leaf', category: 'Machine',
    defaults: {}, fields: [],
    emit: (p, dx, dy, dialect) => dialect.endProgram(),
};

export const mcodeBlock = {
    type: 'mcode', label: 'M-Code', kind: 'leaf', category: 'Machine',
    defaults: { code: 154 }, fields: ['code'],   // raw custom M-code (accessory output / sensor wait / pause)
    emit: (p) => [line([M(Math.max(0, Math.round(num(p.code, 0))))], 'M-code')],
};
