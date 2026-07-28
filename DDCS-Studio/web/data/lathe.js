/**
 * data/lathe.js — THE LATHE MODEL (t1267). Declarations only: no wizard, no emit, no canvas.
 *
 * A DDCS controller has NO lathe mode — one controller, one G-code set (user, definitive). So "lathe" is never a
 * machine setting we read back; it is a shape of MACHINE the user built, declared on the workspace record, and
 * everything here follows from that declaration rather than inferring anything.
 *
 * WHAT THIS FILE IS FOR: every later surface — the wizards in turn 2, the half-profile view, the CAM recipes — reads
 * ONE of these declarations instead of re-deciding it. The frame, the bar, the rotation, the conversion: each has a
 * single home, so two consumers cannot disagree about what X means.
 *
 * ── THE MECHANISM ────────────────────────────────────────────────────────────────────────────────────────────────
 * The CHUCK holds the bar. The CARRIAGE runs Z along the bed. The CROSS-SLIDE runs X. The tool approaches from +X.
 * That is the whole kinematic story, and it is declared below rather than assumed at each call site.
 *
 * ── THE FRAME (the part that causes wrong parts if it drifts) ─────────────────────────────────────────────────────
 *   X is a RADIUS off the centreline.  Z runs along the bar.  Z0 is the FINISHED FACE, so cutting runs −Z toward the
 *   chuck. A turner reads and speaks DIAMETER; the controller has no diameter mode, so the emit writes RADIUS.
 *   THAT CONVERSION EXISTS EXACTLY ONCE, in `radiusOf()` — see the note there. It is the passAnchorFor lesson applied
 *   before the copies exist rather than after (t1241 B): one expression, hand-copied, is how a frame quietly drifts.
 */
import { getMachine } from './workspaceMachine.js';

// ── (2) THE MECHANISM ───────────────────────────────────────────────────────────────────────────────────────────
/**
 * How the CHUCK's rotation behaves. Two declared behaviours of ONE chuck concept — the same physical thing the rotary
 * rig already models, asked to do a different job:
 *   axis    — the driven rotary the app already models (indexed or interpolated). Martin's hexagon: the bar is a
 *             workpiece being INDEXED, and milling ops apply.
 *   spindle — free RPM cutting rotation. The turning case: the bar spins, the tool cuts a profile into it, and no
 *             angular position is commanded at all.
 * REUSED vs NEW, stated: the CHUCK + BAR concepts and the cylinder stock come from the existing rotary rig (t-rotary:
 * a cylinder gripped at one end, free at the other). What is NEW is `spindle` rotation — the rotary rig has no notion
 * of "spinning for cutting rather than positioning" — and the Z-axis orientation (see barToStock).
 */
export const LATHE_ROTATION = {
    axis: {
        id: 'axis',
        label: 'Driven rotary (indexed / interpolated)',
        why: 'The chuck is a positioning axis: mill flats, hexagons, timed features. The app already models this.',
        commandsAngle: true,
    },
    spindle: {
        id: 'spindle',
        label: 'Cutting spindle (free RPM)',
        why: 'The chuck spins the bar for turning. No angle is commanded — only RPM, and RPM only (no G96 on a DDCS).',
        commandsAngle: false,
    },
};

/** The kinematic declaration. Read it; never re-assume it at a call site. */
export const LATHE_KINEMATICS = {
    chuck: { holds: 'bar', rotation: Object.keys(LATHE_ROTATION) },
    carriage: { axis: 'Z', along: 'the bed', carries: 'the tool, lengthwise' },
    crossSlide: { axis: 'X', along: 'the cross', carries: 'the tool, in and out' },
    toolApproach: '+X',   // the tool comes at the bar from outside; +X is away from the centreline
};

// ── (4) THE FRAME ───────────────────────────────────────────────────────────────────────────────────────────────
export const LATHE_FRAME = {
    x: { means: 'radius off the centreline', zeroAt: 'the centreline', positive: 'away from centre' },
    z: { means: 'along the bar', zeroAt: 'the FINISHED FACE', positive: 'away from the chuck' },
    cutDirection: '-Z',   // from the finished face toward the chuck
    uiSpeaks: 'diameter',
    emitWrites: 'radius',
};

/**
 * THE ONE CONVERSION. UI diameter → emit radius.
 *
 * There is no diameter mode on a DDCS, so every turning number a person types as Ø has to be halved before it reaches
 * G-code. That halving lives HERE and nowhere else: a second `d / 2` somewhere downstream is how a part comes out
 * twice the size it should be, and the failure is silent because both numbers look plausible. A spec asserts no other
 * diameter-halving exists in the tree (see lathe-model-1267.spec.js) — the same tripwire shape as passAnchorFor.
 * @param {number} diameter  as a person says it
 * @returns {number} the radius the controller is given
 */
export function radiusOf(diameter) {
    const d = Number(diameter);
    return Number.isFinite(d) ? d / 2 : NaN;
}

/** The inverse, for showing a machine number back to a person. Same single home, so the pair cannot drift apart. */
export function diameterOf(radius) {
    const r = Number(radius);
    return Number.isFinite(r) ? r * 2 : NaN;
}

// ── (3) THE BAR ─────────────────────────────────────────────────────────────────────────────────────────────────
/**
 * THE LATHE WORKPIECE. What a turner actually has: a bar of some diameter, sticking out of the chuck by some amount,
 * gripped at one end and free at the other, with a bit of raw material ahead of the finished face to face off.
 * @typedef {{diameter:number, stickOut:number, allowance:number, rotation:'axis'|'spindle'}} Bar
 */
export const DEFAULT_BAR = { diameter: 25, stickOut: 60, allowance: 1, rotation: 'spindle' };

/** A bar, with every field a finite number and a declared rotation. Never throws — an unusable bar reads as invalid. */
export function normalizeBar(bar) {
    const n = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
    const b = bar || {};
    return {
        diameter: n(b.diameter, DEFAULT_BAR.diameter),
        stickOut: n(b.stickOut, DEFAULT_BAR.stickOut),
        allowance: Number.isFinite(Number(b.allowance)) && Number(b.allowance) >= 0 ? Number(b.allowance) : DEFAULT_BAR.allowance,
        rotation: LATHE_ROTATION[b.rotation] ? b.rotation : DEFAULT_BAR.rotation,
    };
}

/**
 * THE MAPPING TO THE EXISTING STOCK MODEL, stated because it is the load-bearing reuse.
 *
 * The app already has a CYLINDER stock — the rotary rig's bar. Two differences, and only two:
 *   AXIS   the rotary cylinder lies along the ROTARY AXIS (X today); a lathe bar lies along Z. So the length goes to
 *          `z` and the diameter drives `x`/`y`, where the rotary case puts length on `x`.
 *   ORIGIN the rotary bar is measured from wherever it was set; a lathe bar is measured from the FINISHED FACE, which
 *          is Z0 — so the stock extends in −Z (into the chuck) and the allowance sticks out in +Z.
 * Everything else — the round shape, the diameter field, the 3D draw — is the SAME model, which is why this is a
 * mapping and not a second stock type.
 * @param {Bar} bar
 * @returns {{shape:'cylinder', x:number, y:number, z:number, diameter:number, origin:string}}
 */
export function barToStock(bar) {
    const b = normalizeBar(bar);
    const length = b.stickOut + b.allowance;   // the material that exists ahead of the chuck, raw face included
    return {
        shape: 'cylinder',
        diameter: b.diameter,
        x: b.diameter,        // the round cross-section, as the cylinder stock already expresses it
        y: b.diameter,
        z: length,            // ← the re-axising: length runs along Z, not along the rotary axis
        origin: 'finished-face',
        show: true,
    };
}

// ── (5) THE VIEW CONTRACT ───────────────────────────────────────────────────────────────────────────────────────
/**
 * THE 2D HALF-PROFILE, as DATA. A lathe part is drawn as one half of its section: Z horizontal, X (radius) up, the
 * centreline along the bottom. Nobody draws the other half — it is the same profile mirrored, and showing it doubles
 * the ink for no information.
 *
 * This returns the geometry a renderer draws, in the declared frame, so the canvas has nothing to decide. That split
 * is deliberate: the model is testable without a canvas, and the canvas cannot invent a shape the model did not state.
 * @param {Bar} bar
 * @returns {{centreline:{z1:number,z2:number}, outline:Array<{z:number,x:number}>, datum:{z:number}, allowance:{z1:number,z2:number}, bounds:{z1:number,z2:number,x1:number,x2:number}}}
 */
export function halfProfile(bar) {
    const b = normalizeBar(bar);
    const r = radiusOf(b.diameter);
    const zFace = 0;                    // the FINISHED face is the datum
    const zRaw = b.allowance;           // raw material sticks out ahead of it, in +Z
    const zChuck = -b.stickOut;         // the bar runs back into the chuck, in −Z
    return {
        centreline: { z1: zChuck, z2: zRaw },
        // the bar's silhouette, walked from the chuck end to the raw face and back down to the centre
        outline: [
            { z: zChuck, x: 0 }, { z: zChuck, x: r }, { z: zRaw, x: r }, { z: zRaw, x: 0 },
        ],
        datum: { z: zFace },            // Z0 — where the finished face will be
        allowance: { z1: zFace, z2: zRaw },   // the material that gets faced off
        bounds: { z1: zChuck, z2: zRaw, x1: 0, x2: r },
    };
}

// ── (6) ENVELOPE SEMANTICS ──────────────────────────────────────────────────────────────────────────────────────
/**
 * What the machine's axes are CALLED on a lathe. Display only: the declared signed-travel machinery is untouched, and
 * an envelope is still the same three numbers with the same signs. What changes is that "X travel" on a lathe means
 * how far the CROSS-SLIDE moves in radius-space, and "Z travel" means the carriage along the bed — so the Hardware
 * panel that says "X" to a mill user should say what X IS to a turner.
 * @param {'mill'|'lathe'} kind
 */
export function axisLabels(kind = getMachine().kind) {
    if (kind !== 'lathe') return { x: 'X', y: 'Y', z: 'Z', note: '' };
    return {
        x: 'X (cross-slide, radius)',
        y: 'Y',
        z: 'Z (carriage, along the bed)',
        note: 'On a lathe X is a RADIUS off the centreline and Z runs along the bar; the travel numbers and their signs are unchanged.',
    };
}

if (typeof window !== 'undefined') {
    window.ddcsLathe = { LATHE_ROTATION, LATHE_KINEMATICS, LATHE_FRAME, radiusOf, diameterOf, normalizeBar, barToStock, halfProfile, axisLabels };
}
