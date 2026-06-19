/**
 * DDCS Studio — profile store
 *
 * A single JSON "profile" bundles the user's settings (machine / stock / limits)
 * and user variables. In the browser, Export/Import = download/upload. In the
 * pywebview .exe, the same calls read/write a local `ddcs-profile.json` through
 * window.pywebview.api, so persistence carries over with no rework.
 */
import { getSettings, applySettings } from '../ui/settingsPanel.js';
import { getAccessToken, ensureRoot, list as driveList, read as driveRead, write as driveWrite, mkdir as driveMkdir, del as driveDel } from '../ui/cloud/googleDrive.js';
import { getActiveProfile, setActiveProfile } from '../shared/js/profiles/controllerProfiles.js';

const PROFILE_VERSION = 1;
const CLOUD_EXT = '.ddcsprofile.json';   // distinguishes profiles from .mjson projects in the user's Drive

function getDB() { return window.ddcsStudio && window.ddcsStudio.variableDB; }
function isPywebview() { return !!(window.pywebview && window.pywebview.api); }

export function buildProfile() {
    const db = getDB();
    const ap = (() => { try { return getActiveProfile(); } catch (e) { return null; } })();
    return {
        version: PROFILE_VERSION,
        controllerId: ap ? ap.id : '',        // which controller this profile is for → load restores the dialect/post
        controllerName: ap ? ap.name : '',
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

export async function importProfile() {
    // Desktop (.exe): read the local file via the Python bridge
    if (isPywebview() && window.pywebview.api.loadProfile) {
        try {
            const json = await window.pywebview.api.loadProfile();
            if (json) applyProfile(JSON.parse(json));
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
        r.onload = (e) => {
            try { applyProfile(JSON.parse(e.target.result)); }
            catch (err) { console.error('Invalid profile JSON', err); }
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
    const ap = (() => { try { return getActiveProfile(); } catch (e) { return null; } })();
    const profile = sanitizeForCloud({
        ...buildProfile(),
        machine: { id: ap ? ap.id : '', name: ap ? ap.name : '' },   // bind to a machine so a remote load picks the right frame
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

/** Load + apply a cloud profile by Drive file id. */
export async function loadCloudProfile(fileId) {
    if (!cloudConnected()) throw new Error('Not signed in to cloud.');
    const obj = await driveRead(fileId);
    applyProfile(obj);
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
