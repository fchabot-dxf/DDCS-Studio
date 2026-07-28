/**
 * ui/axisGating.js — grey (don't hide) the wizards this machine cannot physically run (t1271).
 *
 * A lathe has no Y axis. Every mill op that moves in Y — pockets, contours, surfacing — is not "unavailable", it is
 * IMPOSSIBLE on that machine, and the difference matters to a person deciding whether they configured something
 * wrong. So the ops stay on the bar, greyed, saying WHY: "needs a Y axis — this workspace declares none."
 *
 * WHY GREY AND NOT HIDE, restated because it is a rule this project keeps choosing (postGating, field gating, now
 * ops): hiding rewrites the screen so a returning user cannot find what they remember, and it answers the question
 * they did not ask ("where did pocketing go?") while leaving the real one unanswered ("can this machine do it?").
 * Greying keeps the layout still and puts the answer under the cursor.
 *
 * KEYED ON THE DECLARED AXES, never inferred: the machine record says which axes exist (via its envelope + kind).
 * Nothing here guesses from travels or counts motors — an undeclared axis is undeclared, not absent-looking.
 */
import { getMachine } from '../data/workspaceMachine.js';

/**
 * Which axes a workspace declares. A lathe is X + Z by construction: the cross-slide and the carriage, with the
 * chuck as rotation rather than a linear axis. A mill declares X/Y/Z.
 * @returns {Set<string>}
 */
export function declaredAxes(machine = getMachine()) {
    return machine.kind === 'lathe' ? new Set(['X', 'Z']) : new Set(['X', 'Y', 'Z']);
}

/**
 * WHAT EACH OP NEEDS. Declared per op-type rather than sniffed from its emit: an op that happens not to move in Y
 * with today's default parameters still NEEDS Y, and inferring the requirement from one emit would let a parameter
 * change silently make an impossible op look possible.
 */
export const OP_AXIS_NEEDS = {
    pocket: ['X', 'Y'],
    contour: ['X', 'Y'],
    surfacing: ['X', 'Y'],
    slot: ['X', 'Y'],
    text: ['X', 'Y'],
    drill: ['X', 'Y'],
    bore: ['X', 'Y'],
    tap: ['X', 'Y'],
    corner: ['X', 'Y'],
    edge: ['X', 'Y'],
    middle: ['X', 'Y'],
    alignment: ['X', 'Y'],
    // the lathe ops need exactly what a lathe has
    lathe_facing: ['X', 'Z'],
};

/** The sentence a greyed op shows. Names the axis AND why we believe it is absent, so it is checkable. */
export function axisWhy(missing, machine = getMachine()) {
    const axes = missing.join(' and ');
    return machine.kind === 'lathe'
        ? `needs a ${axes} axis — this is a lathe workspace (X cross-slide + Z carriage only)`
        : `needs a ${axes} axis — this workspace declares none`;
}

/**
 * Which axes an op needs that this machine does not declare. Empty = the op is runnable.
 * @param {string} opType  e.g. 'pocket', 'user_lathe_facing'
 */
export function missingAxesFor(opType, machine = getMachine()) {
    const key = String(opType || '').replace(/^user_/, '');
    const needs = OP_AXIS_NEEDS[key];
    if (!needs) return [];                      // an op with no declared need is never gated on a guess
    const have = declaredAxes(machine);
    return needs.filter((a) => !have.has(a));
}

/**
 * Apply the gating to whatever wizard entries are on screen. Idempotent, and it RESTORES an entry when the machine
 * changes back — the same reversibility postGating has, because a kind is a setting a person will toggle while
 * setting up.
 * @param {Document|HTMLElement} root
 */
export function applyAxisGating(root = document) {
    const machine = getMachine();
    root.querySelectorAll('[data-wiz], [data-optype]').forEach((el) => {
        const opType = el.dataset.optype || el.dataset.wiz || '';
        const missing = missingAxesFor(opType, machine);
        const gated = missing.length > 0;
        el.classList.toggle('axis-gated', gated);
        el.setAttribute('aria-disabled', gated ? 'true' : 'false');
        if (gated) {
            if (el.dataset.origTitle === undefined) el.dataset.origTitle = el.title || '';
            el.title = axisWhy(missing, machine);
        } else if (el.dataset.origTitle !== undefined) {
            el.title = el.dataset.origTitle;
            delete el.dataset.origTitle;
        }
    });
}

if (typeof window !== 'undefined') {
    window.ddcsAxisGating = { applyAxisGating, missingAxesFor, declaredAxes, axisWhy, OP_AXIS_NEEDS };
    window.addEventListener('ddcs:machine-changed', () => { try { applyAxisGating(); } catch (_) {} });
    window.addEventListener('ddcs:settings-changed', () => { try { applyAxisGating(); } catch (_) {} });
}
