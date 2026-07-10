/**
 * data/profileLibrary.js — the LOCAL named-profile LIBRARY (t658, user design). A PROFILE is the first-class unit:
 * { id, name, controllerId, settings, userVars }; the CONTROLLER is a PROPERTY of the profile, not a peer concept.
 *
 * ONE SOURCE: the ACTIVE profile's settings ARE the live getSettings() (the working copy) — the library holds the
 * metadata + a SNAPSHOT of every profile (the active slot is re-snapshotted on any switch/create/export). SWITCHING
 * FULL-SWAPS the live settings via replaceSettings (NEVER a partial merge), so the one-source seams built this session
 * (motors/gantry, homing config, WCS table, autostartProfileId) swap atomically and can't blend across profiles.
 *
 * Profiles are ONLY ever USER-NAMED (the migrated default is created UNNAMED — the UI prompts for a name, non-blocking).
 * Export/Import + cloud keep using data/profileStore.js's bundle (this layers the named library on top; cloud unchanged, E2).
 */
import { getSettings, replaceSettings } from '../ui/settingsPanel.js';
import { getActiveProfile, setActiveProfile, DEFAULT_PROFILE_ID } from '../shared/js/profiles/controllerProfiles.js';

const LIB_KEY = 'ddcs_profile_library';
const db = () => (window.ddcsStudio && window.ddcsStudio.variableDB) || null;
const deep = (o) => (o == null ? null : JSON.parse(JSON.stringify(o)));
const uid = () => 'p_' + Date.now().toString(36) + '_' + Math.floor(Math.random() * 1e6).toString(36);

function readLib() { try { const p = JSON.parse(localStorage.getItem(LIB_KEY)); if (p && Array.isArray(p.profiles) && p.profiles.length) return p; } catch (e) { /* */ } return null; }
function writeLib(lib) { try { localStorage.setItem(LIB_KEY, JSON.stringify(lib)); } catch (e) { /* */ } }

function curControllerId() { try { return (getActiveProfile() || {}).id || DEFAULT_PROFILE_ID; } catch (e) { return DEFAULT_PROFILE_ID; } }
function curUserVars() { const d = db(); return d && d.getAll ? d.getAll().filter((v) => !v.isSys) : []; }

/** The library (migrating on first access: wrap the current implicit state as ONE UNNAMED profile — byte-preserving,
 *  settings = the live getSettings() as-is; the user names it). */
export function getLibrary() {
    let lib = readLib();
    if (!lib) {
        const id = uid();
        lib = { activeId: id, profiles: [{ id, name: '', controllerId: curControllerId(), settings: deep(getSettings()), userVars: curUserVars() }] };
        writeLib(lib);
    }
    return lib;
}

export function listProfiles() { return getLibrary().profiles.map((p) => ({ id: p.id, name: p.name, controllerId: p.controllerId })); }
export function activeProfileId() { return getLibrary().activeId; }
export function activeProfile() { const lib = getLibrary(); return lib.profiles.find((p) => p.id === lib.activeId) || lib.profiles[0]; }
/** Does this profile (default = active) still need a name? (Profiles are only ever user-named.) */
export function needsName(id) { const lib = getLibrary(); const p = lib.profiles.find((x) => x.id === (id || lib.activeId)); return !!(p && !String(p.name || '').trim()); }

// snapshot the LIVE state into the active slot (the active's settings ARE the live copy → keep the slot fresh before a swap)
function snapshotActive(lib) {
    const p = lib.profiles.find((x) => x.id === lib.activeId);
    if (p) { p.settings = deep(getSettings()); p.userVars = curUserVars(); p.controllerId = curControllerId(); }
}
export function saveActiveSnapshot() { const lib = getLibrary(); snapshotActive(lib); writeLib(lib); }

export function renameProfile(id, name) { const lib = getLibrary(); const p = lib.profiles.find((x) => x.id === id); if (p) { p.name = String(name || '').trim(); writeLib(lib); } return p ? p.name : ''; }

export function deleteProfile(id) {
    const lib = getLibrary();
    if (lib.profiles.length <= 1) return false;   // never delete the last profile
    const wasActive = lib.activeId === id;
    lib.profiles = lib.profiles.filter((p) => p.id !== id);
    if (wasActive) { lib.activeId = lib.profiles[0].id; writeLib(lib); switchProfile(lib.profiles[0].id, true); }
    else writeLib(lib);
    return true;
}

/** FULL-SWAP switch: snapshot the outgoing active (preserve its edits), then load the target's settings/vars/controller
 *  ENTIRELY (replaceSettings = a true swap, never a merge). */
export function switchProfile(id, force) {
    const lib = getLibrary();
    if (!force && id === lib.activeId) return activeProfile();
    snapshotActive(lib);
    const target = lib.profiles.find((p) => p.id === id); if (!target) { writeLib(lib); return null; }
    lib.activeId = id; writeLib(lib);
    replaceSettings(target.settings || {});   // ← the FULL SWAP (defaults + the target, in place; one-source seams carried)
    const d = db(); if (d && d.importUserVars) { d.importUserVars(target.userVars || []); if (window.refreshDeckVariables) window.refreshDeckVariables(); }
    try { setActiveProfile(target.controllerId || DEFAULT_PROFILE_ID); const ap = getActiveProfile(); if (ap && ap.varFamily && d && d.setControllerVars) d.setControllerVars(ap.varFamily); } catch (e) { /* */ }
    if (window.ddcsRefreshControllerUI) window.ddcsRefreshControllerUI();
    window.dispatchEvent(new CustomEvent('ddcs:settings-changed'));
    return target;
}

/** NEW profile: 'dup' = a true copy of the current active (settings + vars, same controller); 'baseline' = a fresh
 *  config on a controller baseline (default settings). Only ever user-named. Makes the new profile active. */
export function createProfile({ from = 'dup', controllerId, name } = {}) {
    const lib = getLibrary(); snapshotActive(lib);
    const id = uid();
    let settings, userVars, cid;
    if (from === 'baseline') { cid = controllerId || curControllerId(); settings = {}; userVars = []; }   // fresh → replaceSettings fills defaults
    else { const a = activeProfile(); cid = a.controllerId; settings = deep(a.settings); userVars = deep(a.userVars); }
    lib.profiles.push({ id, name: String(name || '').trim(), controllerId: cid, settings, userVars });
    writeLib(lib);
    switchProfile(id, true);
    return id;
}

/** Set the active profile's CONTROLLER property (switching controller = changing THIS profile's controller). Reuses the
 *  existing controller-switch flow (setActiveProfile + refresh); the pull/import still lands into the active profile. */
export function setActiveControllerId(controllerId) {
    const lib = getLibrary(); const p = lib.profiles.find((x) => x.id === lib.activeId);
    if (p) { p.controllerId = controllerId; writeLib(lib); }
    try { setActiveProfile(controllerId); const ap = getActiveProfile(); const d = db(); if (ap && ap.varFamily && d && d.setControllerVars) d.setControllerVars(ap.varFamily); } catch (e) { /* */ }
    if (window.ddcsRefreshControllerUI) window.ddcsRefreshControllerUI();
    window.dispatchEvent(new CustomEvent('ddcs:settings-changed'));
}

/** Import a profile bundle (data/profileStore buildProfile shape) as a NEW named library profile, then switch to it. */
export function importAsProfile(bundle, name) {
    if (!bundle || typeof bundle !== 'object') return null;
    const lib = getLibrary(); snapshotActive(lib);
    const id = uid();
    lib.profiles.push({ id, name: String(name || bundle.name || '').trim(), controllerId: bundle.controllerId || curControllerId(), settings: deep(bundle.settings || {}), userVars: deep(bundle.userVars || []) });
    writeLib(lib);
    switchProfile(id, true);
    return id;
}

// expose for the settings panel + tests
window.ddcsProfileLib = { getLibrary, listProfiles, activeProfileId, activeProfile, needsName, saveActiveSnapshot, renameProfile, deleteProfile, switchProfile, createProfile, setActiveControllerId, importAsProfile };
