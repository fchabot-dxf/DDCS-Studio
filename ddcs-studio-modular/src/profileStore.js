/**
 * DDCS Studio — profile store
 *
 * A single JSON "profile" bundles the user's settings (machine / stock / limits)
 * and user variables. In the browser, Export/Import = download/upload. In the
 * pywebview .exe, the same calls read/write a local `ddcs-profile.json` through
 * window.pywebview.api, so persistence carries over with no rework.
 */
import { getSettings, applySettings } from './settingsPanel.js';

const PROFILE_VERSION = 1;

function getDB() { return window.ddcsStudio && window.ddcsStudio.variableDB; }
function isPywebview() { return !!(window.pywebview && window.pywebview.api); }

export function buildProfile() {
    const db = getDB();
    return {
        version: PROFILE_VERSION,
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

// .exe: load the profile when the pywebview API is ready; save on any settings change
window.addEventListener('pywebviewready', autoLoadProfile);
window.addEventListener('ddcs:settings-changed', autoSaveProfile);
