/**
 * DDCS Studio — profile store
 *
 * A single JSON "profile" bundles the user's settings (machine / stock / limits)
 * and user variables. In the browser, Export/Import = download/upload. In the
 * pywebview .exe, the same calls read/write a local `ddcs-profile.json` through
 * window.pywebview.api, so persistence carries over with no rework.
 */
import { getSettings, applySettings, replaceSettings } from '../ui/settingsPanel.js';
import { getAccessToken, ensureRoot, list as driveList, read as driveRead, write as driveWrite, mkdir as driveMkdir, del as driveDel } from '../ui/cloud/googleDrive.js';
import { getActiveProfile, setActiveProfile, CONTROLLER_PROFILES } from '../shared/js/profiles/controllerProfiles.js';
import { getMachine, setMachine } from './workspaceMachine.js';   // t1217 — the bundle's name/controller ARE this workspace's machine
import { dlgConfirm } from '../ui/dialog.js';   // t1219 — an explicit confirm before a destructive swap

const PROFILE_VERSION = 1;
const CLOUD_EXT = '.ddcsprofile.json';   // distinguishes profiles from .mjson projects in the user's Drive

function getDB() { return window.ddcsStudio && window.ddcsStudio.variableDB; }
function isPywebview() { return !!(window.pywebview && window.pywebview.api); }

export function buildProfile() {
    const db = getDB();
    // t1219 — ONE SOURCE for the exported identity: BOTH the name and the controller come from the machine record.
    // This used to take the name from the machine record but the controllerId from getActiveProfile(), so an export
    // could stamp one machine's name onto another machine's controller. After the restore fix those two cannot
    // diverge, but a bundle's identity is exactly the thing that must not be assembled from two sources — an export
    // that mislabels its controller is a wrong-dialect import waiting to happen. Make it true by construction.
    const machine = (() => { try { return getMachine(); } catch (e) { return { name: '', controllerId: '' }; } })();
    const cid = machine.controllerId || '';
    const ctrlName = (() => { try { return (CONTROLLER_PROFILES[cid] || {}).name || ''; } catch (e) { return ''; } })();
    return {
        version: PROFILE_VERSION,
        name: machine.name || '',             // this workspace's machine name
        controllerId: cid,                    // which controller this machine is → load restores the dialect/post
        controllerName: ctrlName,
        settings: getSettings(),
        userVars: db ? db.getAll().filter(v => !v.isSys) : [],
    };
}

export function applyProfile(profile) {
    if (!profile || typeof profile !== 'object') return false;
    if (profile.settings) applySettings(profile.settings);
    const db = getDB();
    if (Array.isArray(profile.userVars) && db && db.importUserVars) {
        db.importUserVars(profile.userVars);
        if (window.refreshDeckVariables) window.refreshDeckVariables();
    }
    // Switch the CONTROLLER to the one this profile was saved for (dialect/post follow it). Older profiles
    // without a controllerId fall back to the cloud machine.id stamp; if neither, the controller is left as-is.
    const cid = profile.controllerId || (profile.machine && profile.machine.id);
    if (cid) {
        try {
            setActiveProfile(cid);
            const ap = getActiveProfile(); const vdb = window.ddcsStudio && window.ddcsStudio.variableDB;
            if (ap && ap.varFamily && vdb) vdb.setControllerVars(ap.varFamily);   // switch the #var list too
        } catch (e) { /* */ }
        if (window.ddcsRefreshControllerUI) window.ddcsRefreshControllerUI();      // re-sync the Settings dropdown + post + tabs
        window.dispatchEvent(new CustomEvent('ddcs:settings-changed'));            // re-sync the header post chip + open previews (after the switch)
    }
    return true;
}

export async function exportProfile() {
    const json = JSON.stringify(buildProfile(), null, 2);
    // Desktop (.exe): write the local file via the Python bridge
    if (isPywebview() && window.pywebview.api.saveProfile) {
        try { await window.pywebview.api.saveProfile(json); return; } catch (e) { /* fall back to download */ }
    }
    // Browser: download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ddcs-profile.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// t1217 — an imported bundle is applied to THIS WORKSPACE'S MACHINE ([[one-workspace-one-machine]]). It used to land as
// a NEW named entry in the profile library; with the library retired there is nowhere else for it to go, and "apply it
// to this machine" is the honest reading of importing a machine configuration into a workspace. The bundle's own name
// and controller are adopted too, so the workspace identifies as what was imported.
export function landImportedProfile(obj) {
    if (!obj || typeof obj !== 'object') return;
    // FULL SWAP, never a merge. The retired library landed an import through switchProfile → replaceSettings, and that
    // is the semantic to keep: this workspace must BECOME the imported machine. applySettings (what applyProfile uses)
    // merges a WHITELIST — it carries no workspace/workspaceFiles at all, and leaves the previous machine's values in
    // every key the bundle omits, blending two machines into an incoherent third.
    if (obj.settings) replaceSettings(obj.settings);
    const db = getDB();
    if (Array.isArray(obj.userVars) && db && db.importUserVars) {
        db.importUserVars(obj.userVars);
        if (window.refreshDeckVariables) window.refreshDeckVariables();
    }
    // the bundle's identity IS this workspace's machine now (true → retarget the controller + refresh the UI)
    try { setMachine({ name: obj.name || obj.controllerName || '', controllerId: obj.controllerId || (obj.machine && obj.machine.id) || '' }, true); } catch (e) { /* */ }
}

/**
 * THE PRE-IMPORT SAFETY GATE (t1219). Landing a bundle FULL-SWAPS this workspace's machine — the same blast radius as
 * opening a .ddcs over your work — so it gets the same two protections the .ddcs restore path already has: an EXPLICIT
 * confirm, then an automatic safety export as the undo path (ui/backupModal.js does exactly this: its preview modal is
 * the confirm, then `await safetyExport()` before the restore).
 *
 * Declared ONCE, so every landing site is covered by construction rather than by remembering. Both of today's sites
 * are currently reachable only via the console or the pywebview bridge — the UI door retired with the profile library
 * — but "no door today" is not a reason to leave a destructive path unguarded; a door is one button away.
 *
 * FAILS CLOSED: if the confirm cannot be shown, the swap does NOT happen. A destructive operation that cannot ask is
 * one that must not proceed.
 * @returns {Promise<boolean>} may the caller land the bundle
 */
export async function allowDestructiveLanding(what) {
    let ok = false;
    try {
        ok = await dlgConfirm(
            `Import ${what}? This REPLACES this workspace's machine — its envelope, WCS, macros, variables and`
            + ' controller are all swapped for the imported ones.',
            { danger: true, okLabel: 'Replace this machine' },
        );
    } catch (e) { return false; }   // cannot ask → do not swap
    if (!ok) return false;
    // t1223 SILENT-DOWNLOAD SWEEP: this used to fire safetyExport() — a .ddcs appearing in Downloads that nobody asked
    // for. A file the user did not request is not consent and taught them nothing about their state. They now get the
    // SAME save-first prompt an Open gets, and a download remains only as the no-FSA fallback inside saveWorkspace.
    try { return await window.ddcsConfirmDiscardBuffer('this machine configuration'); } catch (e) { return true; }
}

export async function importProfile() {
    // Desktop (.exe): read the local file via the Python bridge
    if (isPywebview() && window.pywebview.api.loadProfile) {
        try {
            const json = await window.pywebview.api.loadProfile();
            if (json) {
                const obj = JSON.parse(json);
                if (await allowDestructiveLanding('this machine configuration')) landImportedProfile(obj);
            }
            return;
        } catch (e) { /* fall back to file picker */ }
    }
    // Browser: file picker
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.addEventListener('change', () => {
        const f = input.files && input.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = async (e) => {
            let obj;
            try { obj = JSON.parse(e.target.result); }
            catch (err) { console.error('Invalid profile JSON', err); return; }
            // parse BEFORE asking — never prompt for a swap that a malformed file can't perform anyway
            if (await allowDestructiveLanding('“' + (obj && obj.name ? obj.name : 'this machine configuration') + '”')) landImportedProfile(obj);
        };
        r.readAsText(f);
    });
    input.click();
}

// --- Cloud (BYO Google Drive): named profiles in a "Profiles" subfolder of the app's Drive root. ---
//     Pull at the machine → save here → load on a remote PC for a faithful sim. See [[controller-import-remote-sim]].
function cloudConnected() { try { return !!getAccessToken(); } catch (e) { return false; } }

// Never publish secrets to the cloud: the profile bundle is settings + user-vars (no tokens today), but scrub
// defensively before upload — a cloud profile is effectively published.
function sanitizeForCloud(obj) {
    const SENSITIVE = /token|secret|refresh|password|api[_-]?key|client[_-]?secret/i;
    const clone = JSON.parse(JSON.stringify(obj));
    const scrub = (o) => { if (o && typeof o === 'object') for (const k of Object.keys(o)) { if (SENSITIVE.test(k)) delete o[k]; else scrub(o[k]); } };
    scrub(clone);
    return clone;
}

async function profilesFolderId() {
    const root = await ensureRoot();
    const kids = await driveList(root);
    const f = kids.find((k) => k.type === 'folder' && k.name === 'Profiles');
    return f ? f.id : await driveMkdir('Profiles', root);
}

const safeName = (s) => (String(s || 'profile').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'profile');

/** Save the current profile (settings + user vars) to Drive under `name`, stamped with machine + savedAt. */
export async function saveProfileToCloud(name) {
    if (!cloudConnected()) throw new Error('Not signed in — connect your cloud account in Settings → Cloud.');
    // t1219 — the `machine` stamp is derived from the SAME bundle identity, not re-read from getActiveProfile(). Two
    // reads of "which controller is this" in one document is how a cloud copy ends up labelled for the wrong dialect.
    const base = buildProfile();
    const profile = sanitizeForCloud({
        ...base,
        machine: { id: base.controllerId, name: base.controllerName },   // bind to a machine so a remote load picks the right frame
        savedAt: new Date().toISOString(),
    });
    await driveWrite(safeName(name) + CLOUD_EXT, profile, await profilesFolderId());   // upserts by name
    return safeName(name);
}

/** List saved cloud profiles → [{ id, name, savedAt }]. */
export async function listCloudProfiles() {
    if (!cloudConnected()) return [];
    return (await driveList(await profilesFolderId()))
        .filter((e) => e.type !== 'folder' && e.name.endsWith(CLOUD_EXT))
        .map((e) => ({ id: e.id, name: e.name.slice(0, -CLOUD_EXT.length), savedAt: e.savedAt }));
}

/** Load a cloud profile by Drive file id → APPLY it to this workspace's machine (t1217: the same landing as a file
 *  import, since the library it used to land in is retired). Keeps the Drive plumbing (driveRead) unchanged.
 *  t1219 — gated by the same confirm + safety export as a file import; returns null if the user declines. */
export async function loadCloudProfile(fileId) {
    if (!cloudConnected()) throw new Error('Not signed in to cloud.');
    const obj = await driveRead(fileId);
    if (!(await allowDestructiveLanding('“' + ((obj && obj.name) || 'this cloud machine') + '” from your cloud'))) return null;
    landImportedProfile(obj);   // t1217 — same landing as a file import: apply to THIS workspace's machine
    return obj;
}

export async function deleteCloudProfile(fileId) {
    if (!cloudConnected()) throw new Error('Not signed in to cloud.');
    await driveDel(fileId);
}

// pywebview-only auto persistence (no-ops in a browser)
function autoSaveProfile() {
    if (!isPywebview() || !window.pywebview.api.saveProfile) return;
    try { window.pywebview.api.saveProfile(JSON.stringify(buildProfile())); } catch (e) { /* ignore */ }
}
async function autoLoadProfile() {
    if (!isPywebview() || !window.pywebview.api.loadProfile) return;
    try {
        const json = await window.pywebview.api.loadProfile();
        if (json) applyProfile(JSON.parse(json));
    } catch (e) { /* ignore */ }
}

window.ddcsExportProfile = exportProfile;
window.ddcsImportProfile = importProfile;
window.ddcsSaveProfileToCloud = saveProfileToCloud;
window.ddcsListCloudProfiles = listCloudProfiles;
window.ddcsLoadCloudProfile = loadCloudProfile;
window.ddcsDeleteCloudProfile = deleteCloudProfile;

// .exe: load the profile when the pywebview API is ready; save on any settings change
window.addEventListener('pywebviewready', autoLoadProfile);
window.addEventListener('ddcs:settings-changed', autoSaveProfile);
