/**
 * ui/fileSaveState.js — PERSISTENCE-A: the file-save status indicator.
 *
 * PRINCIPLE (user): unsaved data is TEMPORARY, even when auto-saved to localStorage — localStorage is a working buffer,
 * only a .ddcs FILE counts as saved. The workspace auto-saves to localStorage ONLY; a .ddcs is its sole PORTABLE copy.
 * This surfaces that state so the user KNOWS when their work lives only in this browser:
 *   - ONE header DISK BUTTON (t1223): accent = unsaved, muted = saved, click = Save. Its tooltip is the filename plus
 *     the dialect; the name itself is displayed where there is room for it (the workspace modal, the Settings band).
 *   (t1221 — there is deliberately NO exit warning. The buffer survives a reload/close, so a leave prompt would warn
 *   about a loss that does not happen; the chip tells the truth without blocking the gesture.)
 *
 * The dirty signal is ONE SOURCE (data/backup.js workspaceSignature over the BACKUP_STORES registry) — this module only
 * reflects it in the UI. Parts (b) exe disk-file + (c) web File-System-Access are a separate concern; this is the
 * localStorage-vs-.ddcs AWARENESS layer only. The workspace .ddcs is the config/library grain (settings, wizards, CAM
 * pack, presets, layout); the current PROGRAM is the separate .mjson job grain and is not part of this signal.
 */
import { isWorkspaceDirtyToFile, ensureWorkspaceWatermark, hasWorkspaceWatermark, workspaceSignature, fileSavedName } from '../data/backup.js';
import { getMachine } from '../data/workspaceMachine.js';   // t1223 — the tooltip names the file AND the dialect it generates for
import { CONTROLLER_PROFILES } from '../shared/js/profiles/controllerProfiles.js';

let chip = null;

/**
 * t1223 (5, user-refined) — ONE DISK BUTTON. Always present, because it is the Save control as well as the indicator.
 * The COLOUR is the whole state (accent = unsaved, muted = saved), and the TOOLTIP is the filename plus the dialect it
 * generates for — the two facts you actually want when hovering a save button. No label, no timestamp, no dot: the
 * fat pill spelled out in prose what one colour already says, and a timestamp nobody asked for kept re-rendering.
 * The NAME lives where there is room to read it — the workspace modal and the Settings identity band.
 */
function refresh() {
    const dirty = isWorkspaceDirtyToFile();
    if (!chip) return dirty;
    const name = fileSavedName();
    let dialect = '';
    try {
        const cid = getMachine().controllerId;
        dialect = (CONTROLLER_PROFILES[cid] || {}).name || cid || '';
    } catch (_) { dialect = ''; }
    chip.classList.toggle('dirty', dirty);
    chip.classList.toggle('saved', !dirty);
    // labelled "Workspace" so the tooltip says WHAT the name is, not just a bare filename floating on a header icon
    chip.title = 'Workspace: ' + (name || 'not saved yet') + (dialect ? ' · ' + dialect : '');
    chip.setAttribute('aria-label', dirty ? 'Save workspace (unsaved changes)' : 'Save workspace');
    return dirty;
}

function saveWorkspace() {
    // the deliberate save — a user-owned .ddcs via the File System Access API (t1199); falls back to the download.
    const save = window.ddcsSaveWorkspace || window.ddcsExportBackup;
    if (save) { Promise.resolve(save()).then(refresh).catch(() => {}); }
    else if (window.openSettings) { window.openSettings(); }
}

function install() {
    chip = document.getElementById('fileSaveChip');
    if (chip) chip.addEventListener('click', saveWorkspace);

    // t1221 — the beforeunload exit warning is REMOVED (user ruling). It warned about a loss that does not happen:
    // the localStorage buffer SURVIVES a reload or a tab close, so the browser's "Reload site?" prompt was crying
    // wolf on every refresh. Being interrupted by a false alarm teaches people to click through real ones. The CHIP
    // is the only truth-teller about not-saved-to-a-file, and it says so without blocking anything.

    window.addEventListener('ddcs:file-state', refresh);   // fired by markWorkspaceSavedToFile (save / open)
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refresh(); });
    window.addEventListener('focus', refresh);
    // Live-ish poll — cheap (a few localStorage reads + a 32-bit hash); paused while the tab is hidden.
    setInterval(() => { if (document.visibilityState !== 'hidden') refresh(); }, 1500);

    refresh();   // returning users (a watermark already exists) get the correct state immediately

    // First-run baseline: a brand-new browser has no watermark. Boot writes/seeds backup stores at VARIOUS times
    // (init on DOMContentLoaded, lazy settings, gateway status, …), later than any single lifecycle event — so we
    // don't snapshot at a fixed moment. We wait for the signature to STABILIZE (unchanged for two ~400ms ticks) and
    // adopt that settled default state as "clean". Until then the watermark stays unset → dirty is false → no chip and
    // no exit-warning during boot. Returning users have a watermark, so this never runs for them.
    if (!hasWorkspaceWatermark()) {
        let last = null, stable = 0, ticks = 0;
        const tick = () => {
            if (hasWorkspaceWatermark()) { refresh(); return; }   // a save/open set it meanwhile
            const sig = String(workspaceSignature());
            if (sig === last) stable++; else { stable = 0; last = sig; }
            if (stable >= 2 || ++ticks > 20) { ensureWorkspaceWatermark(); refresh(); return; }   // settled (or a 8s safety cap)
            setTimeout(tick, 400);
        };
        setTimeout(tick, 400);
    }

    // t1231 — `markSaved()` is GONE with the nameless mark it wrapped: it stamped "saved" without a file name, which is
    // not a state the one-name rule allows (and is how "Untitled workspace · Saved" was produced). Marking a save is
    // the save path's job, under the name it actually wrote.
    window.ddcsFileSaveState = {
        refresh, isDirty: isWorkspaceDirtyToFile, save: saveWorkspace, signature: workspaceSignature,
    };
}

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
    else install();
}
