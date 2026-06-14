/**
 * wizards/ops/flow.js — low-level control-flow primitives (Control): the macro jump skeleton. PROFILE-AWARE
 * via the active dialect (GOTO spacing / label form vary by controller; RS274NGC folds these into O-words).
 *   Label — a numbered jump target.   Goto — an unconditional jump.
 */
import { num } from './util.js';

export const labelBlock = {
    type: 'label', label: 'Label', kind: 'leaf', category: 'Control',
    defaults: { n: 1 }, fields: ['n'],
    emit: (p, dx, dy, dialect) => dialect.label(Math.max(0, Math.round(num(p.n, 1)))),
};

export const gotoBlock = {
    type: 'goto', label: 'Goto', kind: 'leaf', category: 'Control',
    defaults: { n: 1 }, fields: ['n'],
    emit: (p, dx, dy, dialect) => dialect.goto(Math.max(0, Math.round(num(p.n, 1)))),
};

/** Conditional jump: IF <lhs><op><rhs> GOTO <label>. Generic form behind both the probe-status check
 *  (#1920 != 2) and the operator-cancel check (#1505 == 0); the dialect renders the controller's grammar. */
export const ifGotoBlock = {
    type: 'ifgoto', label: 'If Goto', kind: 'leaf', category: 'Control',
    defaults: { lhs: '#1920', op: '!=', rhs: '2', goto: 1 }, fields: ['lhs', 'op', 'rhs', 'goto'],
    emit: (p, dx, dy, dialect) => dialect.ifGoto(p.lhs || '#1920', p.op || '!=', String(p.rhs ?? '0'),
        Math.max(0, Math.round(num(p.goto, 1)))),
};
