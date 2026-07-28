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
import { isWorkspaceDirtyToFile, ensureWorkspaceWatermark, hasWorkspaceWatermark, workspaceSignature, fileSavedName, changeLabel } from '../data/backup.js';   // t1309 — changeLabel: the ONE way a changed row reads
import { getMachine } from '../data/workspaceMachine.js';   // t1223 — the tooltip names the file AND the dialect it generates for
import { CONTROLLER_PROFILES } from '../shared/js/profiles/controllerProfiles.js';

let chip = null;

export { announceSaved, dismissSaved };   // t1287 — the Ctrl+S path announces through the same one voice

/** t1287 — take any lingering confirmation away. A modal popup that outlives its moment BLOCKS what comes next: the
 *  suite caught it covering the Save-As dialog of the very next save, which is unreachable underneath it. Any save
 *  clears the last answer before it starts producing a new one. */
function dismissSaved() { try { document.getElementById('fileSaveSaid')?.remove(); } catch (_) {} }

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

/**
 * t1287 (user, live, refined) — SAY WHAT WAS SAVED, in a POPUP THE USER DISMISSES.
 *
 * A re-save to a remembered file shows no browser dialog at all, so the whole gesture was silent. The first version
 * put the answer beside the disk chip — and the user's refinement is the reason that was wrong: ON A NARROW SCREEN
 * THE CHIP IS NOT THERE. Feedback anchored to a control that a phone does not render is feedback nobody gets, which
 * is the same failure as no feedback with more code behind it.
 *
 * So it is a centred overlay, at every width, and it WAITS: a click, a tap or Esc dismisses it. No timer — a message
 * that names what was written should not be able to vanish before it has been read.
 *
 * WHAT IT SAYS comes from the ONE registry the save-first modal and the FAQ already read, so all three use the same
 * words about the same things. Three honest answers, and the middle one is the one that is easy to get wrong:
 *   · stores changed        → name them;
 *   · nothing changed       → say so, rather than claim work that was not done;
 *   · no baseline to compare → the first save to this file, which writes EVERYTHING. Saying "nothing changed" there
 *                              would be false in exactly the case where the most is happening.
 *
 * "Saved" still belongs ONLY to a real file write: this shows on the resolved result of writeTo, never a buffer flush.
 */
function announceSaved(res) {
    if (!res || !res.ok || typeof document === 'undefined') return;
    const changed = res.changed;
    // t1309 — ONE phrase builder (data/backup.js), so the popup and the save-first modal cannot word the same fact
    // differently. It NAMES the programs a save wrote — up to three, then "+N more" — and keeps the qualifying count
    // for every other store.
    const bit = (c) => changeLabel(c);
    // the count QUALIFIES the store, never replaces it: naming alone once read "4 tools" for a machine-envelope edit
    const what = !Array.isArray(changed) ? 'The whole workspace was written.'
        : changed.length ? changed.map(bit).join(' · ')
        : 'Nothing had changed since the last save.';
    const title = (Array.isArray(changed) && !changed.length) ? 'Already saved' : 'Saved';

    document.getElementById('fileSaveSaid')?.remove();
    const ov = document.createElement('div');
    ov.id = 'fileSaveSaid';
    ov.className = 'saved-pop';
    ov.setAttribute('role', 'status');
    ov.setAttribute('aria-live', 'polite');
    ov.innerHTML = `<div class="saved-pop-card">
        <div class="saved-pop-title"></div>
        <div class="saved-pop-name"></div>
        <div class="saved-pop-what"></div>
        <button type="button" class="saved-pop-ok">OK</button>
    </div>`;
    ov.querySelector('.saved-pop-title').textContent = title;
    ov.querySelector('.saved-pop-name').textContent = res.name ? '“' + res.name + '”' : '';
    ov.querySelector('.saved-pop-what').textContent = what;
    const close = () => { ov.remove(); document.removeEventListener('keydown', onEsc, true); };
    const onEsc = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    ov.addEventListener('click', close);        // anywhere: the card, the backdrop, the button — all dismiss
    document.addEventListener('keydown', onEsc, true);
    document.body.appendChild(ov);
    ov.querySelector('.saved-pop-ok').focus();
}

function saveWorkspace() {
    // the deliberate save — a user-owned .ddcs via the File System Access API (t1199); falls back to the download.
    const save = window.ddcsSaveWorkspace || window.ddcsExportBackup;
    if (save) { Promise.resolve(save()).then((res) => { refresh(); announceSaved(res); }).catch(() => {}); }
    else if (window.openSettings) { window.openSettings(); }
}

function install() {
    chip = document.getElementById('fileSaveChip');
    if (chip) chip.addEventListener('click', saveWorkspace);
    try { window.ddcsAnnounceSaved = announceSaved; window.ddcsDismissSaved = dismissSaved; } catch (_) {}   // t1287 — one voice for every save path

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
