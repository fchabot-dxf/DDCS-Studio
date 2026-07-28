/**
 * data/workspaceMachine.js — THE WORKSPACE'S ONE MACHINE RECORD (t1217, user ruling [[one-workspace-one-machine]]).
 *
 * A workspace holds exactly ONE machine: the `.ddcs` file IS the machine. Multiple machines = multiple workspace files.
 *
 * WHY THIS RECORD IS TINY: the machine's real configuration — the envelope, WCS table, motors, homing, macros, user
 * variables — ALREADY persists in `ddcs_studio_settings` / `ddcs_vars_persistent`, and each already rides a `.ddcs` as
 * its own declared BACKUP_STORES row. The only bytes it uniquely owns are the NAME and the CONTROLLER ID.
 *
 * THE CONTROLLER TRAVELS WITH THE FILE: opening/restoring a workspace ADOPTS the file's controllerId (user ruling) —
 * keeping the receiving browser's controller would contradict "the file is the machine".
 *
 * THE NAME IS THE FILENAME (t1223 ONE-NAME RULE): the workspace's name, its filename stem and what every surface
 * displays are ONE string. There is no separate machine-name field to drift from the file it lives in; renaming is
 * Save As. `setMachineName` exists so the save path can keep the record in step with the file it just wrote.
 *
 * t1223 LEGACY PURGE ([[no-legacy-burden]]): the profile-library migration, the one-time machine-config exports
 * (`machineConfigFile` / `legacyMachineConfigs` / `dropLegacyProfile`) and `migrateProfileLibrary` are GONE, along with
 * the `ddcs_profile_library` key they read. They existed to carry a pre-pivot browser across the t1217 change; the
 * app has no install base, this browser is already on the machine record, and every one of those affordances was
 * something the next rework would have had to keep carrying.
 */
import { getActiveProfile, setActiveProfile, DEFAULT_PROFILE_ID } from '../shared/js/profiles/controllerProfiles.js';

export const MACHINE_KEY = 'ddcs_machine';

const readJSON = (k) => { try { const v = localStorage.getItem(k); return v == null ? null : JSON.parse(v); } catch (_) { return null; } };
const liveControllerId = () => { try { return (getActiveProfile() || {}).id || DEFAULT_PROFILE_ID; } catch (_) { return DEFAULT_PROFILE_ID; } };

/**
 * THE MACHINE KIND (t1267) — what SHAPE of machine this workspace is for.
 *
 * A DDCS controller has no lathe mode: one controller, one G-code set (user, definitive). So the kind is a fact about
 * the MACHINE THE USER BUILT, not something the controller can be asked — which is exactly why it belongs on the
 * workspace record, beside its name and controller, and why nothing downstream may try to infer it.
 *
 * It changes what the app SHOWS and what ops make sense (a lathe workspace has no pocketing; a mill has no facing
 * pass down a bar), never what a given op emits.
 */
export const MACHINE_KINDS = ['mill', 'lathe'];
export const DEFAULT_KIND = 'mill';
const cleanKind = (k) => (MACHINE_KINDS.includes(k) ? k : DEFAULT_KIND);
const cleanChuck = (c) => (['spindle', 'axis'].includes(c) ? c : 'spindle');

/** THE machine record for this workspace: { name, controllerId, kind }. Never null — an un-named workspace is legal (''). */
export function getMachine() {
    const m = readJSON(MACHINE_KEY);
    if (m && typeof m === 'object') {
        return { name: String(m.name || ''), controllerId: m.controllerId || liveControllerId(), kind: cleanKind(m.kind), chuck: cleanChuck(m.chuck) };
    }
    return { name: '', controllerId: liveControllerId(), kind: DEFAULT_KIND };   // derived, NOT written — writing on read would mask a real save
}

/** Is this workspace a lathe? The one question every surface asks; nobody re-derives it from anything else. */
export const isLathe = () => getMachine().kind === 'lathe';

/**
 * HOW THE CHUCK BEHAVES, declared on the workspace (t1277). A lathe chuck is either a free-spinning SPINDLE (rpm
 * only — the ordinary turning case) or a DRIVEN AXIS (the A axis, commanded to an angle). It is a property of the
 * machine the user built, not something to infer from an op: polygon turning NEEDS the driven axis, and the honest
 * way to tell someone their machine cannot run it is to have ASKED what their machine is.
 */
export const CHUCK_MODES = ['spindle', 'axis'];
export const DEFAULT_CHUCK = 'spindle';
export const chuckMode = (m = getMachine()) => (CHUCK_MODES.includes(m && m.chuck) ? m.chuck : DEFAULT_CHUCK);
/** Is the chuck a commanded axis? (A lathe question — a mill's rotary is a separate declaration.) */
export const chuckIsAxis = (m = getMachine()) => m.kind === 'lathe' && chuckMode(m) === 'axis';

/**
 * Persist the record. `applyController` (default true) also RETARGETS this workspace's live controller/dialect — the
 * active controller profile, the variable family that follows it, and the UI refresh + broadcast that make the change
 * visible. This is the ONE way to change this workspace's controller, so an open, an import and the Settings dropdown
 * all land in the same state. (The Settings dropdown passes false: it has already applied the controller itself.)
 */
export function setMachine(next, applyController = true) {
    const cur = getMachine();
    const rec = {
        name: String((next && next.name) != null ? next.name : cur.name),
        controllerId: (next && next.controllerId) || cur.controllerId,
        // t1267 — the kind rides with the record, so it travels in the .ddcs like the name and the controller do
        // ([[one-workspace-one-machine]]: the file IS the machine, and what kind of machine is part of that).
        kind: cleanKind((next && next.kind) || cur.kind),
        chuck: cleanChuck((next && next.chuck) || cur.chuck),
    };
    try { localStorage.setItem(MACHINE_KEY, JSON.stringify(rec)); } catch (_) {}
    if (applyController && rec.controllerId) {
        try {
            setActiveProfile(rec.controllerId);
            const ap = getActiveProfile();
            const db = (window.ddcsStudio && window.ddcsStudio.variableDB) || null;
            if (ap && ap.varFamily && db && db.setControllerVars) db.setControllerVars(ap.varFamily);
            if (window.ddcsRefreshControllerUI) window.ddcsRefreshControllerUI();
            window.dispatchEvent(new CustomEvent('ddcs:settings-changed'));
        } catch (_) {}
    }
    try { window.dispatchEvent(new CustomEvent('ddcs:machine-changed', { detail: rec })); } catch (_) {}
    return rec;
}

/**
 * ONE-NAME RULE (t1223): set the workspace's name from the FILE it was saved to / opened from. Takes a filename and
 * keeps the stem, so `Rig B.ddcs` and `Rig B` are the same name — the file on disk and the name on screen cannot
 * disagree. Never touches the controller.
 */
export function setMachineName(fileName) {
    const stem = String(fileName || '').split(/[\\/]/).pop().replace(/\.ddcs$/i, '');
    return setMachine({ name: stem }, false);
}

/**
 * THE ENVELOPE AS DECLARED — SIGNS INCLUDED (t1231, user ruling). A travel's sign is not decoration: it declares which
 * END of the axis the machine homes to, so `850 × -850 × -120` and `850 × 850 × 120` are two different machines. Both
 * summaries used to run the numbers through Math.abs, which made a machine unrecognisable from the one line that is
 * supposed to identify it. ONE formatter, so the Settings band, the file panel and any tooltip cannot disagree.
 *
 * t1243 (user) — the AXIS LETTERS are part of the reading. "850 × -850 × -120" makes you count positions to know
 * which number is Z; "X 850 Y -850 Z -120" says it. The letters make the × separators redundant, so they go —
 * the line stays the same length it was. Changing it HERE changes all three surfaces at once, which is the point
 * of there being one formatter. (ONE space between groups, not two: HTML collapses the second, so a wider gap here
 * would be a declaration that no surface honours.)
 * @param {{x:number,y:number,z:number}} m  a settings `machine` block — live, or read out of a .ddcs
 * @returns {string|null} e.g. "X 850 Y -850 Z -120", or null when an axis is not a finite number
 */
export function envelopeSummary(m) {
    const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
    const xyz = [n(m && m.x), n(m && m.y), n(m && m.z)];
    return xyz.every((v) => v != null) ? xyz.map((v, i) => `${'XYZ'[i]} ${v}`).join(' ') : null;
}

if (typeof window !== 'undefined') {
    window.ddcsGetMachine = getMachine;
    window.ddcsIsLathe = isLathe;   // t1281 — the 3D reads the KIND to pick a turner's camera; the record is the one source
    window.ddcsSetMachine = setMachine;
    window.ddcsSetMachineName = setMachineName;
}
