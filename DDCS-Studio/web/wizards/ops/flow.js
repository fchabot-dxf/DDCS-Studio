/**
 * wizards/ops/flow.js — low-level control-flow primitives (Control): the macro jump skeleton.
 *
 * Every probe/ATC macro ends in a label + goto error/exit structure. These are the bare atoms; `if`/`compare`
 * sit on top. Emitted through dialect.js so GOTO spacing follows the controller `rules`.
 *   Label — a numbered jump target (N<n>).
 *   Goto  — an unconditional jump (GOTO<n>).
 */
import { num } from './util.js';
import { N, line } from '../words.js';
import { goto as gotoLine } from '../dialect.js';

export const labelBlock = {
    type: 'label', label: 'Label', kind: 'leaf', category: 'Control',
    defaults: { n: 1 }, fields: ['n'],
    emit: (p) => [line([N(Math.max(0, Math.round(num(p.n, 1))))], 'label')],
};

export const gotoBlock = {
    type: 'goto', label: 'Goto', kind: 'leaf', category: 'Control',
    defaults: { n: 1 }, fields: ['n'],
    emit: (p) => [gotoLine(Math.max(0, Math.round(num(p.n, 1))))],
};
