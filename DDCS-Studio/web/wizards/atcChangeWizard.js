/**
 * DDCS Studio - Tool Change Wizard.
 *
 * REWRITTEN AS A BLOCK STACK: `atcChangeStack(params)` builds the macro from granular atoms (Comment / Set# / Spindle /
 * Coolant / Machine Move / M-Code / Confirm / Pause / Message / If Goto / Goto / Label / End Program / Raw).
 * The G53 machine moves render per post (Expert/DM500 `G53 …`, V4.1 `G0 G53 …`) and the operator prompts fold
 * on controllers with no scripted HMI — so the same stack is native across posts.
 *
 * CHANGE METHOD (params.method — see backward-compat map in atcChangeStack):
 *   m6       — RECOMMENDED for automatic: park (safe G53 Z, then G53 X/Y to the change position) then emit a
 *              bare M6 and let the controller run its own working tool-change handler. Minimal + safe.
 *   firmware — the O10102-accurate FIXED-STATION PUSH sequence (slib-m.nc O10102): #1306 highest-Z, push
 *              start #1320/#1321 → dwell #1322 → push end #1323/#1324 (F#1327) → retreat #1325/#1326, with the
 *              real pneumatic M-code order (M159 vacuum-off, M157 pin-close, M160 pusher-open, M163 dust-off,
 *              M156 pin-open, M161 pusher-close) and an M19 spindle orient before unclamp.
 *   manual   — stop spindle, park the head (G53), M00 pause for a hand swap.
 *   generic  — ASSUMED magazine pick & place (NOT proven on real DDCS firmware — verify on your machine).
 *   disk     — ASSUMED disk/carousel TEMPLATE (rotate-to-pocket indexing is firmware-specific — verify).
 *
 * GROUND TRUTH: the real M350 O10102 is a pneumatic FIXED-STATION PUSH/EJECT station (vacuum pump + locating
 * cylinder + pusher cylinder + dust collector), NOT a pull-stud spindle changer. The drawbar/grab pick&place
 * model below (generic/disk) is an ASSUMPTION carried from earlier guesses — kept only for backward-compat.
 */
import { emitMapped } from '../blocks/blockEmitter.js';
import { activeDialectOpts } from './previewEmit.js';
import { recordOp } from '../blocks/opRecord.js';
import { resolveMethod, atcChoreography } from './atcModel.js';   // I2: method/choreo from the model

// resolveMethod + the ATC CHOREOGRAPHY seam MOVED to the composable model (wizards/atcModel.js) at I2: the choreo is now
// COMPUTED from atcCombo (the declared MOTION's seam projection + the GRIP's device) instead of a fixed per-method table,
// so the seam reads the DECLARED MODEL (one source). Byte + sim identical for the 3 presets. Re-exported here (from the
// top-of-file import) so existing importers (atcViews) are untouched; atcChangeStack's switch uses the imported resolveMethod.
export { resolveMethod, atcChoreography };

// Map a Studio-authored firmwareStation store (the INVERSE of the push seam's region — see atcModel MOTIONS.push.seam)
// { safeZ, pushStart:{x,y}, pushEnd:{x,y}, retreat:{x,y} } back onto its controller vars (#1306 + #1320-1326) as
// [var, value] pairs, so the SIM can be VAR-SEEDED from the store (GUI-1): author the station in Studio → the preview
// renders it from the store instead of untaught-0 (the P-C.1a stuck-at-0 limitation). SIM-ONLY — never emitted: the
// firmware macro still REFERENCES the controller's own #1320-1326 (byte-identical O10102); this only feeds the preview
// engine + the station-highlight trace, and is NEVER pushed to the controller (that gated write is a later step).
export function firmwareStationSeed(fw) {
    if (!fw) return null;
    const n = (v) => Number(v) || 0;
    const p = fw.pushStart || {}, e = fw.pushEnd || {}, r = fw.retreat || {};
    return [
        [1306, n(fw.safeZ)],
        [1320, n(p.x)], [1321, n(p.y)],
        [1323, n(e.x)], [1324, n(e.y)],
        [1325, n(r.x)], [1326, n(r.y)],
    ];
}

// t1728 (gameplan step 1) — atcChangeEffectiveArm/atcChangeStack MOVED to stacks/atcChangeWizard.js (the twin's own builder
// dependency, kept importable+re-exported here unchanged for every other existing caller — pure move).
import { atcChangeEffectiveArm, atcChangeStack } from './stacks/atcChangeWizard.js';
export { atcChangeEffectiveArm, atcChangeStack };

export class AtcChangeWizard {
    generate(params) {
        recordOp('atc_change', params);
        return emitMapped(atcChangeStack(params), activeDialectOpts()).text;
    }
}
