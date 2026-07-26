/**
 * data/workspaceMachine.js — THE WORKSPACE'S ONE MACHINE RECORD (t1217, user ruling [[one-workspace-one-machine]]).
 *
 * A workspace holds exactly ONE machine: the `.ddcs` file IS the machine. Multiple machines = multiple workspace files.
 * This replaces the profile LIBRARY (data/profileLibrary.js), whose switching machinery was itself the bug surface —
 * an active profile carried a SNAPSHOT of settings/userVars that duplicated the live stores, and every
 * create/switch/delete had to re-sync those copies (the measured stale-dup: edit the envelope, "Save as profile", and
 * the new profile holds the PREVIOUS values while the live app reverts to them).
 *
 * WHY THIS RECORD IS TINY: the machine's real configuration — the envelope, WCS table, motors, homing, macros, user
 * variables — ALREADY persists in `ddcs_studio_settings` / `ddcs_vars_persistent`, and each already rides a `.ddcs` as
 * its own declared BACKUP_STORES row. The only bytes the library uniquely owned were the NAME and the CONTROLLER ID.
 * So the machine record is exactly those two, and the duplication (with its whole class of stale-copy bugs) is gone.
 *
 * THE CONTROLLER TRAVELS WITH THE FILE: opening/restoring a workspace ADOPTS the file's controllerId (user ruling) —
 * the old behaviour kept the receiving browser's controller, which contradicts "the file is the machine".
 */
import { getActiveProfile, setActiveProfile, DEFAULT_PROFILE_ID } from '../shared/js/profiles/controllerProfiles.js';

export const MACHINE_KEY = 'ddcs_machine';
const LEGACY_LIB_KEY = 'ddcs_profile_library';
const LEGACY_RECENTS_KEY = 'ddcs_profile_recents';   // orphaned by the collapse (the old library browser's MRU list)

const readJSON = (k) => { try { const v = localStorage.getItem(k); return v == null ? null : JSON.parse(v); } catch (_) { return null; } };
const liveControllerId = () => { try { return (getActiveProfile() || {}).id || DEFAULT_PROFILE_ID; } catch (_) { return DEFAULT_PROFILE_ID; } };

/** THE machine record for this workspace: { name, controllerId }. Never null — an un-named machine is legal (''). */
export function getMachine() {
    const m = readJSON(MACHINE_KEY);
    if (m && typeof m === 'object') return { name: String(m.name || ''), controllerId: m.controllerId || liveControllerId() };
    return { name: '', controllerId: liveControllerId() };   // derived, NOT written — writing on read would mask a migration
}

/**
 * Persist the record. `applyController` (default true) also RETARGETS this workspace's live controller/dialect — the
 * FULL retarget the retired profileLibrary.setActiveControllerId used to do: the active controller profile, the
 * variable family that follows it, and the UI refresh + broadcast that make the change visible. This is the ONE way to
 * change this workspace's controller, so a restore, an import and the Settings dropdown all land in the same state.
 * (The Settings dropdown passes false: it has already applied the controller itself, with its own extra work.)
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
 * LEGACY PROFILES that are NOT the active one. They are never silently dropped: each becomes a one-time machine-config
 * EXPORT the user can save and use to seed a NEW workspace. Returns [] once the library is gone.
 * @returns {Array<{id:string,name:string,controllerId:string,settings:object,userVars:Array}>}
 */
export function legacyMachineConfigs() {
    const lib = readJSON(LEGACY_LIB_KEY);
    if (!lib || !Array.isArray(lib.profiles) || !lib.profiles.length) return [];
    return lib.profiles.filter((p) => p && p.id !== lib.activeId);
}

/** A non-active legacy profile as a standalone machine-config file body (seeds a new workspace). */
export function machineConfigFile(p) {
    return JSON.stringify({
        kind: 'ddcs.machine', v: 1, exportedAt: new Date().toISOString(),
        machine: { name: String((p && p.name) || ''), controllerId: (p && p.controllerId) || DEFAULT_PROFILE_ID },
        settings: (p && p.settings) || {}, userVars: (p && p.userVars) || [],
    }, null, 2);
}

/**
 * MIGRATE the profile library to the single machine record. Idempotent, and safe to run at BOOT and after a RESTORE.
 *  - the ACTIVE profile becomes this workspace's machine (its name + controllerId; its settings/userVars are already
 *    the live stores, so nothing is copied — that duplication was the bug);
 *  - NON-ACTIVE profiles are LEFT IN PLACE until the user has exported them (legacyMachineConfigs surfaces them), so a
 *    migration can never lose a machine the user configured;
 *  - once there is nothing left to export, the legacy keys are removed.
 * @returns {{migrated:boolean, pendingExports:number, machine:{name:string,controllerId:string}}}
 */
export function migrateProfileLibrary() {
    const lib = readJSON(LEGACY_LIB_KEY);
    const hadRecord = !!readJSON(MACHINE_KEY);
    let migrated = false;

    if (lib && Array.isArray(lib.profiles) && lib.profiles.length && !hadRecord) {
        const active = lib.profiles.find((p) => p && p.id === lib.activeId) || lib.profiles[0];
        // adopt WITHOUT applying the controller: at boot the live controller already IS this browser's, and a restore
        // applies it through the declared store's own write (see backup.js). Avoids a redundant re-target on every load.
        setMachine({ name: String((active && active.name) || ''), controllerId: (active && active.controllerId) || liveControllerId() }, false);
        migrated = true;
    }

    const pending = legacyMachineConfigs().length;
    if (lib && !pending) { try { localStorage.removeItem(LEGACY_LIB_KEY); localStorage.removeItem(LEGACY_RECENTS_KEY); } catch (_) {} }
    return { migrated, pendingExports: pending, machine: getMachine() };
}

/** Drop a legacy profile once the user has exported it (the last one removes the library entirely). */
export function dropLegacyProfile(id) {
    const lib = readJSON(LEGACY_LIB_KEY);
    if (!lib || !Array.isArray(lib.profiles)) return 0;
    lib.profiles = lib.profiles.filter((p) => p && p.id !== id);
    try {
        if (lib.profiles.length <= 1) { localStorage.removeItem(LEGACY_LIB_KEY); localStorage.removeItem(LEGACY_RECENTS_KEY); }
        else localStorage.setItem(LEGACY_LIB_KEY, JSON.stringify(lib));
    } catch (_) {}
    return legacyMachineConfigs().length;
}

if (typeof window !== 'undefined') {
    window.ddcsGetMachine = getMachine;
    window.ddcsSetMachine = setMachine;
    window.ddcsLegacyMachineConfigs = legacyMachineConfigs;
    window.ddcsMigrateProfileLibrary = migrateProfileLibrary;
}
