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
