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

/** THE machine record for this workspace: { name, controllerId }. Never null — an un-named workspace is legal (''). */
export function getMachine() {
    const m = readJSON(MACHINE_KEY);
    if (m && typeof m === 'object') return { name: String(m.name || ''), controllerId: m.controllerId || liveControllerId() };
    return { name: '', controllerId: liveControllerId() };   // derived, NOT written — writing on read would mask a real save
}

/**
 * Persist the record. `applyController` (default true) also RETARGETS this workspace's live controller/dialect — the
 * active controller profile, the variable family that follows it, and the UI refresh + broadcast that make the change
 * visible. This is the ONE way to change this workspace's controller, so an open, an import and the Settings dropdown
 * all land in the same state. (The Settings dropdown passes false: it has already applied the controller itself.)
 */
export function setMachine(next, applyController = true) {
    const cur = getMachine();
    const rec = { name: String((next && next.name) != null ? next.name : cur.name), controllerId: (next && next.controllerId) || cur.controllerId };
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
 * @param {{x:number,y:number,z:number}} m  a settings `machine` block — live, or read out of a .ddcs
 * @returns {string|null} e.g. "850 × -850 × -120", or null when an axis is not a finite number
 */
export function envelopeSummary(m) {
    const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);
    const xyz = [n(m && m.x), n(m && m.y), n(m && m.z)];
    return xyz.every((v) => v != null) ? xyz.join(' × ') : null;
}

if (typeof window !== 'undefined') {
    window.ddcsGetMachine = getMachine;
    window.ddcsSetMachine = setMachine;
    window.ddcsSetMachineName = setMachineName;
}
