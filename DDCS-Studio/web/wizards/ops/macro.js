/**
 * wizards/ops/macro.js — program/machine-control primitives (Move/Machine). PROFILE-AWARE via the active
 * dialect (wizards/dialects/*): machine-move and end-program render per controller.
 *   machine-move (G53) — rapid to an absolute MACHINE coordinate (one axis).
 *   end-program — terminate (M30 on DDCS).
 *   M-Code — raw M-code escape hatch (controller-agnostic): drawbar M154/5, sensor-wait M300-2, M0 pause…
 */
import { num, r3 } from './util.js';
import { M, line } from '../words.js';
import { wrapMachineFrame } from './safeZframe.js';

export const machineMoveBlock = {
    type: 'machinemove', label: 'Machine Move', kind: 'leaf', category: 'Move',
    defaults: { axis: 'Z', to: '#99', var: '#99' }, fields: ['axis', 'to', 'var'],
    // DDCS rule: G53 needs a VARIABLE (a literal fails on M350). If `to` is already a #var (e.g. a stored #57
    // from Read Machine) → move straight to it; if it's a number → stage it in `var` first, then move.
    emit: (p, dx, dy, dialect) => {
        const axis = p.axis || 'Z', t = p.to;
        let core = (typeof t === 'string' && t.trim().startsWith('#'))
            ? dialect.machineMove(axis, t.trim())
            : [`${p.var || '#99'}=${r3(num(t, 0))}`, ...dialect.machineMove(axis, p.var || '#99')];
        // `mark` (optional, t897) — a DECLARED sim marker appended to the core G53 line (safeZParkBlock ret:true uses it so
        // the sim restores the saved scene-Z). Appended BEFORE the wrap so wrapMachineFrame still G90-detects the G53 (it
        // strips comments first). Unset → byte-identical.
        if (p.mark && core.length) core = [...core.slice(0, -1), `${core[core.length - 1]} ( ${p.mark} )`];
        // t856 SAFETY — a machine move flagged `restore` is a SAFE-HEIGHT PARK (safeZParkBlock): force G90 before its G53
        // (+ restore G91 for an incremental body). A bare machine move (no restore — ATC dance, re-centre) is UNCHANGED.
        if (p.restore == null) return core;
        return wrapMachineFrame(dialect, core, p.restore);
    },
};

export const endProgramBlock = {
    type: 'endprogram', label: 'End Program', kind: 'leaf', category: 'Program',
    defaults: {}, fields: [],
    emit: (p, dx, dy, dialect) => dialect.endProgram(),
};

export const mcodeBlock = {
    type: 'mcode', label: 'M-Code', kind: 'leaf', category: 'Signals',
    defaults: { code: 154, note: '' }, fields: ['code', 'note'],   // raw custom M-code (accessory output / sensor wait / pause)
    emit: (p) => [line([M(Math.max(0, Math.round(num(p.code, 0))))], (p.note && String(p.note).replace(/[()]/g, '').trim()) || 'M-code')],
};

export const rawBlock = {
    type: 'raw', label: 'Raw G-code', kind: 'leaf', category: 'Signals',
    defaults: { text: '' }, fields: ['text'],   // verbatim escape hatch (e.g. a controller-specific G4 P / dwell)
    emit: (p) => [String(p.text ?? '')],
};
