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
import { getMachine, chuckIsAxis } from '../data/workspaceMachine.js';   // t1277 — the chuck is an axis only when the workspace says so

/**
 * Which axes a workspace declares. A lathe is X + Z by construction: the cross-slide and the carriage, with the
 * chuck as rotation rather than a linear axis. A mill declares X/Y/Z.
 * @returns {Set<string>}
 */
export function declaredAxes(machine = getMachine()) {
    if (machine.kind !== 'lathe') return new Set(['X', 'Y', 'Z']);
    // …and A only when the chuck is DECLARED as a driven axis. Most lathe chucks just spin; polygon turning needs
    // one that can be commanded to an angle, and the difference is a fact about the machine, not about the op.
    const axes = new Set(['X', 'Z']);
    if (chuckIsAxis(machine)) axes.add('A');
    return axes;
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
    // the lathe ops need exactly what a lathe has — which a mill also has, so THIS table never greys them on a mill.
    // It asks CAN this machine move that way. Whether the machine has the right FRAME for them is the other question,
    // and OP_FRAME_NEEDS below answers it (t1301) — every lathe op is frame-gated there.
    lathe_facing: ['X', 'Z'],
    lathe_odturn: ['X', 'Z'],
    lathe_parting: ['X', 'Z'],
    lathe_centerdrill: ['Z'],
    lathe_polygon: ['X', 'Z', 'A'],   // …the A is the point of the op: the chuck must TURN to a commanded angle   // …the only op in the app that needs ONE axis: the drill never leaves the centreline
};

/**
 * t1299 — WHAT AN OP ASSUMES ABOUT THE FRAME, which is a different question from which axes exist.
 *
 * The axis table above asks CAN this machine move that way. The probe family needs the other question asked too: a
 * mill has an X, a Z and a spindle, so nothing above would ever grey a lathe probe — and yet running one on a mill
 * writes a WRONG NUMBER into the datum table, silently, which is the worst thing this app can do.
 *
 * Declared per op with ITS OWN sentence, because the hazards are not the same one twice: the OD probe's X is a
 * RADIUS from a centreline a mill does not have, and the face probe is modelled on a bar's end face, where a mill
 * user wants the edge probe instead. A single shared "wrong machine" message would name neither.
 */
export const OP_FRAME_NEEDS = {
    // t1301 (ADVISOR RULING, surfaced to the user) — ALL SEVEN, not just the probes. A mill workspace could open
    // Facing or OD Turn and get a program written in a frame that machine does not have; that is exactly as wrong as
    // the OD probe, and the fact that it CUTS rather than measures makes it worse, not better.
    lathe_facing: {
        kind: 'lathe',
        why: 'faces the end of a BAR held in a chuck, cutting to a CENTRELINE at X0. A mill has no centreline: the same program there drives the tool to the corner of the table.',
    },
    lathe_odturn: {
        kind: 'lathe',
        why: 'turns a DIAMETER — its X is a radius from the centreline, so every size it cuts on a mill comes out half what you typed.',
    },
    lathe_parting: {
        kind: 'lathe',
        why: 'plunges a blade to the CENTRELINE to part a bar off. On a mill there is nothing at X0 to part against.',
    },
    lathe_centerdrill: {
        kind: 'lathe',
        why: 'drills down the axis of a bar that is turning in the chuck. On a mill the work does not turn — use the Drill operation, which spins the tool instead.',
    },
    lathe_polygon: {
        kind: 'lathe',
        why: 'cuts flats by pairing the CHUCK ANGLE with the cross-slide. A mill has neither that pairing nor a workpiece that rotates under the tool.',
    },
    lathe_odprobe: {
        kind: 'lathe',
        why: 'assumes the LATHE FRAME — X is a radius from the centreline. On a mill this would write a datum half the bar out, with nothing on screen looking wrong.',
    },
    lathe_faceprobe: {
        kind: 'lathe',
        why: 'assumes the end face of a BAR and a lathe Z0 (the FINISHED face). On a mill, the Edge probe sets a Z datum.',
    },
};

/**
 * The frame an op assumes that this machine is not. Empty string = nothing to say.
 * @param {string} opType
 */
export function frameWhy(opType, machine = getMachine()) {
    const need = OP_FRAME_NEEDS[String(opType || '').replace(/^user_/, '')];
    if (!need || machine.kind === need.kind) return '';
    return need.why;
}

/** The sentence a greyed op shows. Names the axis AND why we believe it is absent, so it is checkable. */
export function axisWhy(missing, machine = getMachine()) {
    const axes = missing.join(' and ');
    // THE A ANSWER IS ITS OWN SENTENCE. "needs an A axis" tells a turner nothing; "your chuck is declared as a
    // spindle" tells them what to change, and where.
    if (missing.length === 1 && missing[0] === 'A') {
        return 'needs the chuck to be a DRIVEN AXIS — this workspace declares it as a spindle (free RPM). Set the chuck to a driven axis in Settings if your machine has one.';
    }
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
        const frame = frameWhy(opType, machine);                    // t1299 — …or the right axes, wrong frame
        const gated = missing.length > 0 || !!frame;
        el.classList.toggle('axis-gated', gated);
        el.setAttribute('aria-disabled', gated ? 'true' : 'false');
        if (gated) {
            if (el.dataset.origTitle === undefined) el.dataset.origTitle = el.title || '';
            // t1301 — A FRAME MISMATCH ANSWERS FIRST. Polygon turning on a mill is missing an A axis AND in the wrong
            // frame; quoting the axis sends the operator to Settings to declare a driven chuck, which would not make a
            // mill turn polygons. The deeper fact is the one to say.
            el.title = frame || axisWhy(missing, machine);
        } else if (el.dataset.origTitle !== undefined) {
            el.title = el.dataset.origTitle;
            delete el.dataset.origTitle;
        }
    });
}

if (typeof window !== 'undefined') {
    window.ddcsAxisGating = { applyAxisGating, missingAxesFor, declaredAxes, axisWhy, OP_AXIS_NEEDS, frameWhy, OP_FRAME_NEEDS };
    window.addEventListener('ddcs:machine-changed', () => { try { applyAxisGating(); } catch (_) {} });
    window.addEventListener('ddcs:settings-changed', () => { try { applyAxisGating(); } catch (_) {} });
}
