/**
 * viz/viewScope.js — THE CAMERA IS SCOPED TO THE KIND OF MACHINE (t1295).
 *
 * ── WHAT WENT WRONG, and it was not subtle once found ───────────────────────────────────────────────────────────
 * The 3D start orientation came from ONE unscoped setting. t1281 added a lathe default behind `sv.phi ?? default` —
 * but `SETTINGS_DEFAULTS.view` always supplies a theta AND a phi, so that fallback could never fire. The lathe
 * default was dead code from the day it was written, and every pane opened a lathe scene with the mill's
 * three-quarter view down at a table: the bar standing on end, the chuck at the bottom. A user orbited the main
 * preview and saw exactly that.
 *
 * ── AND WHY A DEFAULT ALONE WOULD NOT HAVE FIXED IT ─────────────────────────────────────────────────────────────
 * One saved view for both worlds is wrong even when the defaults are right: a camera saved while working on a mill
 * would govern every lathe scene afterwards, forever, and the first orbit on either would poison the other. A view
 * belongs to the KIND of machine it was framed for, so it is stored per kind and read per kind. Switching kind
 * re-baselines to that kind's own view — its saved one if it has one, its default if it does not.
 *
 * The ROLL (up = +X, so the bed lies across the screen) is applied separately in gcodeViz3d's camera; this module
 * owns only WHERE the camera stands.
 */
import { getMachine } from '../data/workspaceMachine.js';

const H = Math.PI / 2;

/**
 * THE DEFAULT STANDPOINT PER KIND.
 *   mill  — the established three-quarter view down at the table (unchanged, deliberately: this is the view every
 *           mill screenshot in the project was taken from).
 *   lathe — square on to the ZX plane, which with the lathe roll puts the BED ACROSS THE SCREEN and the cross-slide
 *           up. It is where a turner stands, and it is the one view in which a bar reads as a bar.
 */
export const DEFAULT_VIEW_BY_KIND = {
    mill: { theta: -H, phi: Math.PI / 3 },
    lathe: { theta: -H, phi: H },
};

/** The kind this camera question is being asked about. */
export const viewKind = (kind) => (kind || (() => { try { return getMachine().kind; } catch (_) { return 'mill'; } })());

/**
 * The saved views, by kind. Accepts the LEGACY flat shape `{theta, phi}` and reads it as the MILL's — which is what
 * it was: every view saved before this existed was framed on a mill.
 */
export function savedViews(settingsView) {
    const v = settingsView || {};
    const out = {};
    if (v.byKind && typeof v.byKind === 'object') Object.assign(out, v.byKind);
    if (typeof v.theta === 'number' && typeof v.phi === 'number' && !out.mill) out.mill = { theta: v.theta, phi: v.phi };
    return out;
}

/**
 * WHERE THE CAMERA STANDS for this kind: its own saved view if it has one, else its own default. Never the other
 * kind's — that is the whole point of the scope.
 * @returns {{theta:number, phi:number, saved:boolean}}
 */
export function viewFor(kind, settingsView) {
    const k = (kind === 'lathe') ? 'lathe' : 'mill';
    const saved = savedViews(settingsView)[k];
    const base = DEFAULT_VIEW_BY_KIND[k];
    if (saved && typeof saved.theta === 'number' && typeof saved.phi === 'number') {
        return { theta: saved.theta, phi: saved.phi, saved: true };
    }
    return { ...base, saved: false };
}

/** Record a view AGAINST ITS KIND, leaving the other kind's untouched. Returns the new `settings.view` value. */
export function withSavedView(settingsView, kind, theta, phi) {
    const k = (kind === 'lathe') ? 'lathe' : 'mill';
    const byKind = { ...savedViews(settingsView) };
    byKind[k] = { theta, phi };
    return { ...(settingsView || {}), byKind };
}

/**
 * t1321 — WHICH WAY IS UP WHILE YOU ORBIT, per kind (user: "orbiting is weird since the roll").
 *
 * The camera framed the bed horizontal, but the ORBIT never rolled with it: `up` was pinned to the meridian and only
 * swapped to +X while the view direction stayed clear of it — so a horizontal drag walked the camera around the mill's
 * up and, at the angles where the swap fired, the whole scene snapped. That snap is the corkscrew.
 *
 * A lathe's up is the CROSS-SLIDE, always — no threshold, so nothing flips mid-drag. The tiny Z bias keeps it from
 * being exactly parallel to the view direction when you orbit round to look along the cross-slide (a parallel up is
 * what makes lookAt degenerate); it is far too small to see and it never changes.
 *
 * @returns {{x:number,y:number,z:number}|null} null = the mill's meridian up, untouched
 */
export function orbitUpFor(kind) {
    return (kind === 'lathe') ? { x: 1, y: 0, z: 0.001 } : null;
}

/**
 * WHAT THE ORBIT TURNS AROUND. A mill orbits its work on the table; a lathe orbits THE BAR, whose centreline is the
 * one line every lathe fact is measured from — so left-right walks around the bar instead of swinging the bar itself
 * across the screen. The Z stays wherever the framing put it (the bar's middle); only the radial pair is centred.
 */
export function orbitTargetFor(kind, target, stock) {
    if (kind !== 'lathe') return target;
    const bar = stock && stock.shape === 'cylinder' && stock.axis === 'z';
    return bar ? { x: 0, y: 0, z: (target && target.z) || 0 } : target;
}
