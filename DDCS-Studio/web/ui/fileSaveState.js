/**
 * ui/fileSaveState.js — PERSISTENCE-A: the file-save status indicator + exit warning.
 *
 * PRINCIPLE (user): unsaved data is TEMPORARY, even when auto-saved to localStorage — localStorage is a working buffer,
 * only a .ddcs FILE counts as saved. The workspace auto-saves to localStorage ONLY; a .ddcs is its sole PORTABLE copy.
 * This surfaces that state so the user KNOWS when their work lives only in this browser:
 *   - a header chip with TWO honest states — dirty = "Temporary — not saved to a file"; clean-with-a-prior-file-save =
 *     "Saved to file · Nm ago" (a never-file-saved clean workspace stays hidden). Click = Save workspace.
 *   - a beforeunload guard so closing / reloading the tab with unsaved-to-file work triggers the browser's leave prompt.
 *
 * The dirty signal is ONE SOURCE (data/backup.js workspaceSignature over the BACKUP_STORES registry) — this module only
 * reflects it in the UI. Parts (b) exe disk-file + (c) web File-System-Access are a separate concern; this is the
 * localStorage-vs-.ddcs AWARENESS layer only. The workspace .ddcs is the config/library grain (settings, wizards, CAM
 * pack, presets, layout); the current PROGRAM is the separate .mjson job grain and is not part of this signal.
 */
import { isWorkspaceDirtyToFile, ensureWorkspaceWatermark, hasWorkspaceWatermark, workspaceSignature, fileSavedAt } from '../data/backup.js';

let chip = null;

// PRINCIPLE (user): unsaved data is TEMPORARY, even when auto-saved to localStorage — localStorage is a working buffer,
// only a .ddcs FILE counts as saved. The badge reflects that: dirty = "Temporary — not saved to a file"; clean-with-a-
// prior-file-save = "Saved to file · Nm ago"; a never-file-saved clean workspace stays hidden (nothing to report yet).
function agoText(ms) {
    const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
    if (s < 45) return 'just now';
    const m = Math.round(s / 60);
    if (m < 60) return m + 'm ago';
    const h = Math.round(m / 60);
    if (h < 24) return h + 'h ago';
    return Math.round(h / 24) + 'd ago';
}

function refresh() {
    const dirty = isWorkspaceDirtyToFile();
    if (!chip) return dirty;
    const savedAt = fileSavedAt();
    const tx = chip.querySelector('.fsc-tx');
    if (dirty) {
        chip.hidden = false;
        chip.classList.add('dirty'); chip.classList.remove('saved');
        if (tx) tx.textContent = 'Temporary — not saved to a file';
        chip.title = 'Your work is only in this browser (temporary, auto-saved). It is NOT in a portable file — click to Save workspace to a .ddcs file.';
    } else if (savedAt) {
        chip.hidden = false;
        chip.classList.add('saved'); chip.classList.remove('dirty');
        if (tx) tx.textContent = 'Saved to file · ' + agoText(savedAt);
        chip.title = 'This workspace was saved to a .ddcs file ' + agoText(savedAt) + '. Click to save again.';
    } else {
        chip.hidden = true;   // clean but never saved to a file (fresh default state) — nothing to announce yet
        chip.classList.remove('dirty', 'saved');
    }
    return dirty;
}

function saveWorkspace() {
    if (window.ddcsExportBackup) { Promise.resolve(window.ddcsExportBackup()).then(refresh).catch(() => {}); }
    else if (window.openSettings) { window.openSettings(); }   // fallback: the Save-workspace button also lives in Settings
}

function install() {
    chip = document.getElementById('fileSaveChip');
    if (chip) chip.addEventListener('click', saveWorkspace);

    // exit warning — the browser's generic "Leave site?" prompt when there is unsaved-to-file work. (After a Save or
    // Open, the watermark is clean, so a save-then-close / the restore reload does NOT prompt.)
    window.addEventListener('beforeunload', (e) => {
        if (!isWorkspaceDirtyToFile()) return undefined;
        e.preventDefault(); e.returnValue = '';   // modern browsers show a fixed message; the value only needs to be set
        return '';
    });

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

    window.ddcsFileSaveState = {
        refresh, isDirty: isWorkspaceDirtyToFile, save: saveWorkspace, signature: workspaceSignature,
        markSaved: () => { window.ddcsMarkWorkspaceSaved && window.ddcsMarkWorkspaceSaved(); return refresh(); },
    };
}

if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
    else install();
}
