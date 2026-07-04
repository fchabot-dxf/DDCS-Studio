/**
 * wizards/atcModel.js — the COMPOSABLE ATC model (RE-PLAN #2, increment I1).
 *
 * A tool changer is DECLARED from composable pieces instead of a fixed method:
 *     LAYOUT (where — linear/disk/custom · settings.atc, exists)
 *   × GRIP   (how the tool is held/released — the release/clamp action-lists + a device)
 *   × MOTION (the travel sequence — a declared step-list with grip-hooks + LAYOUT position refs)
 *   × I/O    (the M-code ↔ pin dialect — settings.outputs/inputs, exists)
 * The choreography = MOTION driving GRIP at LAYOUT's positions, speaking the I/O dialect.
 *
 * I1 IS INERT DATA ONLY — this module DECLARES the vocabulary (GRIPS / MOTIONS), the 3 shipped methods as grip×motion
 * PRESETS, and a resolver (atcCombo) that back-fills any op → its combo. NOTHING in the app consumes it yet: the EMIT
 * still goes entirely through the existing hand-written stacks (atcChangeWizard.js — Fork A "delegate"), so this
 * increment is BYTE-IDENTICAL (no emit / sim / behaviour change). The interpreter that WALKS these declarations to
 * drive the sim (I4) then emit new combos (I5) comes later; the declarations are the free, safe foundation.
 *
 * ONE-SOURCE: grip/motion live under settings.atc (a user override, added by the setup GUI in I3); until then atcCombo
 * derives the combo from the op's method (via resolveMethod), so existing ops/files are untouched.
 */
// Map a saved op → a change METHOD — new ops carry params.method; OLD ops (mode/magType, no method) map on so existing
// blocks/files resolve to the same combo. MOVED here from atcChangeWizard at I2 so the MODEL is the one source for
// method → combo → choreo, and atcChangeWizard imports it back (no import cycle).
export function resolveMethod(params = {}) {
    if (params.method) return params.method;
    if (params.mode === 'auto') return (params.magType === 'disk') ? 'disk' : 'generic';
    return 'manual';   // legacy default (mode unset or 'manual')
}

// ── GRIP: the hold/release MECHANISM ────────────────────────────────────────────────────────────────────────
// release[]/clamp[] are ACTION-LISTS (a multi-actuator grip declares cleanly). An action = { code (M-code), off
// (the paired off-code), wait (its sensor M-code), dev (the sim device it animates), dwell (a G04 var) }. `orient`
// = an M19 spindle-orient before release. `pre`/`post` = actuator steps a MOTION runs around the swap (pneumatic).
export const GRIPS = {
    drawbar: {
        label: 'Drawbar / collet',
        orient: false,
        release: [{ code: 'M154', wait: 'M301', dev: 'collet-open' }],   // unclamp + drawbar-released sensor
        clamp: [{ code: 'M155', wait: 'M302', dev: 'collet-close' }],    // clamp + tool-locked sensor
        device: 'collet',
    },
    // Named by MECHANISM (pusher), NOT actuation — most ATCs are pneumatic; air/hydraulic/electric is a separate/implied
    // property, not the grip type (human t218).
    pusher: {
        label: 'Pusher',
        orient: true,   // M19 before the unclamp (O10102)
        // O10102's pneumatics interleave with the push travel; declared as the actuator actions the push MOTION drives.
        pre: [{ code: 'M159', dev: 'vacuum-off' }, { code: 'M157', dev: 'pin-close' }],   // vacuum pump off, locating pin close
        release: [{ code: 'M160', dwell: '#1322', dev: 'pusher-open' }],                  // pusher extends (ejects) + dwell
        post: [{ code: 'M163', dev: 'dust-off' }, { code: 'M156', dev: 'pin-open' }],     // dust collector off, pin open
        clamp: [{ code: 'M161', dev: 'pusher-close' }],                                   // pusher retracts
        device: 'pusher',
    },
    // CANDIDATE (RapidChange, wired in I5): no actuator I/O — the plunge MOTION mechanically engages the fork/magnet.
    magnet: {
        label: 'Magnet',
        orient: false,
        release: [], clamp: [],   // mechanical — see the `plunge` motion
        device: 'fork',
        candidate: true,
    },
};

// ── MOTION: the travel SEQUENCE (a declared step-list) ───────────────────────────────────────────────────────
// A step = { step, ref? } — `step` is a primitive (safeZ · travelZ · travelXY · descend · retract · rotate ·
// grip.pre · grip.release · grip.post · grip.clamp · orient · dwell), `ref` names a LAYOUT position the interpreter
// resolves ('cur.pocket' / 'target.pocket' / 'pickup' / 'station.start|end|retreat|z' / 'dock'). `layout` = the
// LAYOUT kind this motion expects.
export const MOTIONS = {
    'pick-place': {
        label: 'Pick & place (per-pocket)',
        layout: 'linear',
        seam: { kind: 'pick-place', variant: 'magazine', label: 'magazine pick & place' },   // sim projection (I2)
        steps: [
            { step: 'safeZ' },
            { step: 'travelXY', ref: 'cur.pocket' }, { step: 'descend', ref: 'cur.pocket' }, { step: 'grip.release' }, { step: 'retract' },
            { step: 'travelXY', ref: 'target.pocket' }, { step: 'grip.release' }, { step: 'descend', ref: 'target.pocket' }, { step: 'grip.clamp' }, { step: 'retract' },
        ],
    },
    push: {
        label: 'Fixed-station push (O10102)',
        layout: 'station',
        // sim projection (I2): the push seam carries the taught station vars + the region builder the highlight uses
        // (moved verbatim from the old ATC_CHOREOGRAPHY.firmware → identical descriptor).
        seam: {
            kind: 'push', label: 'fixed-station push (O10102)',
            stationVars: [1306, 1320, 1321, 1323, 1324, 1325, 1326],
            region: (v) => ({
                z: Number(v[1306]) || 0,
                start: { x: Number(v[1320]) || 0, y: Number(v[1321]) || 0 },
                end: { x: Number(v[1323]) || 0, y: Number(v[1324]) || 0 },
                retreat: { x: Number(v[1325]) || 0, y: Number(v[1326]) || 0 },
            }),
        },
        steps: [
            { step: 'orient' }, { step: 'grip.pre' },
            { step: 'travelZ', ref: 'station.z' }, { step: 'travelXY', ref: 'station.start' },
            { step: 'grip.release' },                                   // pusher out + dwell
            { step: 'travelXY', ref: 'station.end' }, { step: 'grip.post' }, { step: 'travelXY', ref: 'station.retreat' },
            { step: 'grip.clamp' },
        ],
    },
    rotate: {
        label: 'Carousel rotate (disk)',
        layout: 'disk',
        seam: { kind: 'pick-place', variant: 'carousel', label: 'carousel pick & place' },   // sim projection (I2): a pick-place with a carousel variant
        steps: [
            { step: 'safeZ' },
            { step: 'rotate', ref: 'cur.pocket' }, { step: 'travelXY', ref: 'pickup' }, { step: 'grip.release' }, { step: 'retract' },
            { step: 'rotate', ref: 'target.pocket' }, { step: 'travelXY', ref: 'pickup' }, { step: 'descend', ref: 'pickup' }, { step: 'grip.clamp' }, { step: 'retract' },
        ],
    },
    // CANDIDATE (RapidChange, wired in I5): the spindle plunges into the dock; the plunge itself does the release/clamp
    // (magnetic grip → empty grip hooks). A spin/dwell sub-step may be needed for a fork-nut variant — confirm at I5.
    plunge: {
        label: 'Plunge dock (RapidChange)',
        layout: 'linear',
        seam: { kind: 'pick-place', variant: 'plunge', label: 'plunge dock' },   // sim projection (candidate, I5)
        steps: [
            { step: 'safeZ' },
            { step: 'travelXY', ref: 'cur.pocket' }, { step: 'descend', ref: 'cur.pocket' }, { step: 'grip.release' }, { step: 'retract' },
            { step: 'travelXY', ref: 'target.pocket' }, { step: 'descend', ref: 'target.pocket' }, { step: 'grip.clamp' }, { step: 'retract' },
        ],
        candidate: true,
    },
    'macro-call': { label: 'Controller M6 (T.nc)', layout: null, seam: { kind: 'macro-call', label: 'controller M6 (T.nc)' }, steps: [] },   // the controller performs the change
    manual: { label: 'Manual park + swap', layout: 'park', seam: null, steps: [] },         // operator swaps by hand — no inline choreography
};

// ── PRESETS: the shipped methods AS grip×motion combos (the migration map) ───────────────────────────────────
// resolveMethod maps an op (new `method`, or old mode/magType) → one of these keys, so every existing op back-fills
// to its combo. NOTE: "firmware" is a MISLABEL — it is the pneumatic-push installed macro (O10102), so its combo is
// pneumatic × push; the GUI (I3) relabels it "Pneumatic push".
export const PRESETS = {
    firmware: { grip: 'pusher', motion: 'push', layout: 'station', label: 'Push station' },   // the O10102 pusher/push install ("firmware" was a mislabel)
    generic: { grip: 'drawbar', motion: 'pick-place', layout: 'linear', label: 'Drawbar pick & place' },
    disk: { grip: 'drawbar', motion: 'rotate', layout: 'disk', label: 'Disk carousel' },
    m6: { grip: null, motion: 'macro-call', layout: null, label: 'Controller M6' },
    manual: { grip: null, motion: 'manual', layout: 'park', label: 'Manual' },
    // CANDIDATE (wired in I5): the composed RapidChange changer — linear docks + magnet grip + plunge motion.
    rapidchange: { grip: 'magnet', motion: 'plunge', layout: 'linear', label: 'RapidChange', candidate: true },
};

/**
 * Resolve an op's params → its composable ATC combo { method, gripKind, motionKind, layout, grip, motion } (or null
 * for an unknown method). Back-fills OLD ops (mode/magType, no method) via resolveMethod. INERT in I1 — nothing emits
 * from this yet; the seam consumes it in I2. A settings.atc grip/motion override (I3) is not read here yet.
 */
export function atcCombo(params = {}, atc = null) {
    const method = resolveMethod(params);
    const preset = PRESETS[method] || null;
    // A Studio-DECLARED changer (settings.atc.grip/motion/layout, written by the I3 setup GUI) WINS; else the method
    // preset (back-compat). When atc is null/unset the result is exactly the I2 preset combo → byte + sim identical.
    const gripKind = (atc && atc.grip) || (preset && preset.grip) || null;
    const motionKind = (atc && atc.motion) || (preset && preset.motion) || null;
    const layout = (atc && atc.layout) || (preset && preset.layout) || null;
    if (!preset && !gripKind && !motionKind) return null;
    return {
        method,
        gripKind, motionKind, layout,
        grip: gripKind ? (GRIPS[gripKind] || null) : null,
        motion: motionKind ? (MOTIONS[motionKind] || null) : null,
    };
}

/**
 * The ATC CHOREOGRAPHY descriptor for an op — COMPUTED from the composable model (I2): the SEAM projection of the op's
 * declared MOTION (via atcCombo) + the declared GRIP's device. REPLACES the old fixed ATC_CHOREOGRAPHY table so the
 * seam reads the DECLARED MODEL (one source), not a hardcoded per-method table. BYTE + SIM IDENTICAL for the 3 presets:
 * each returns the SAME { kind, label, stationVars, region | variant } the table did — the sim consumes kind / region /
 * stationVars (createPreviewPanel.setAtcSwap + atcViews); the grip-sourced `device` is additive (unconsumed today).
 * null = no inline choreography (manual).
 */
export function atcChoreography(params = {}, atc = null) {
    const combo = atcCombo(params, atc);
    const seam = combo && combo.motion && combo.motion.seam;
    if (!seam) return null;
    const device = combo.grip && combo.grip.device;
    return device ? { ...seam, device } : { ...seam };
}
