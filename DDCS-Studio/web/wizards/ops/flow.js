/**
 * wizards/ops/flow.js — low-level control-flow primitives (Control): the macro jump skeleton. PROFILE-AWARE
 * via the active dialect (GOTO spacing / label form vary by controller; RS274NGC folds these into O-words).
 *   Label — a numbered jump target.   Goto — an unconditional jump.
 */
import { num } from './util.js';

export const labelBlock = {
    type: 'label', label: 'Label', kind: 'leaf', category: 'Control',
    help: "Marks a jump target by number — a Goto or an If Goto block elsewhere in the program can jump here. Use it to mark the top of a loop or the point a probe failure skips back to.",
    labels: { n: 'Label number' },
    defaults: { n: 1 }, fields: ['n'],
    emit: (p, dx, dy, dialect) => dialect.label(Math.max(0, Math.round(num(p.n, 1)))),
};

export const gotoBlock = {
    type: 'goto', label: 'Goto', kind: 'leaf', category: 'Control',
    help: "Jumps straight to a label elsewhere in the program, no condition. Use it to loop back to a label, or to skip past a block of code entirely.",
    labels: { n: 'Jump to label' },
    defaults: { n: 1 }, fields: ['n'],
    emit: (p, dx, dy, dialect) => dialect.goto(Math.max(0, Math.round(num(p.n, 1)))),
};

/** Conditional jump: IF <lhs><op><rhs> GOTO <label>. Generic form behind both the probe-status check
 *  (#1920 != 2) and the operator-cancel check (#1505 == 0); the dialect renders the controller's grammar. */
export const ifGotoBlock = {
    type: 'ifgoto', label: 'If Goto', kind: 'leaf', category: 'Control',
    help: "Jumps to a label only when the comparison is true — e.g. #1920 != 2 goto 3 skips ahead unless the probe found its target. Use it to branch on a probe result, an operator cancel, or any variable's value; if the comparison is false, the program just continues to the next line.",
    labels: { lhs: 'if', op: '', rhs: '', goto: 'goto' },
    defaults: { lhs: '#1920', op: '!=', rhs: '2', goto: 1 }, fields: ['lhs', 'op', 'rhs', 'goto'],
    // t1581 — THE OTHER conditional, and it takes the OTHER precedent. This emits a REAL controller `IF … GOTO`,
    // so the branch survives into the G-code and the machine is the thing that reads it — the coordinate case.
    // `lhs`/`rhs` already ride out verbatim (they are interpolated as strings, so t1575's collapse carries the
    // author's text). The LABEL did not: `num(p.goto, 1)` turned an unresolvable jump target into `GOTO1` — a
    // silent jump to a real but WRONG label, which is the same class of laundering, and the lint was announcing
    // "emitted as written" about it, which was simply false. An unresolvable label now rides out as the author
    // wrote it, so the controller refuses the line instead of jumping somewhere nobody asked for.
    emit: (p, dx, dy, dialect) => {
        const g = (typeof p.goto === 'string' && p.goto.trim() !== '' && !Number.isFinite(Number(p.goto)))
            ? p.goto.trim()
            : Math.max(0, Math.round(num(p.goto, 1)));
        return dialect.ifGoto(p.lhs || '#1920', p.op || '!=', String(p.rhs ?? '0'), g);
    },
};
