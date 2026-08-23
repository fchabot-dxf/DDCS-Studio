/**
 * ui/fileSaveState.js — PERSISTENCE-A: the file-save status indicator.
 *
 * PRINCIPLE (user): unsaved data is TEMPORARY, even when auto-saved to localStorage — localStorage is a working buffer,
 * only a .ddcs FILE counts as saved. The workspace auto-saves to localStorage ONLY; a .ddcs is its sole PORTABLE copy.
 * This surfaces that state so the user KNOWS when their work lives only in this browser:
 *   - t2188 (amendment 1, human: "ok dot", superseding t1223/t2147's own "the disk chip's colour is the one
 *     indicator" ruling) — the STANDALONE DISK BUTTON (#fileSaveChip) is GONE; its two jobs split. STATE is a
 *     small DOT on the workspace chip itself (#hdrWsDirtyDot, inside #hdrPostBtn) — shown when unsaved, hidden
 *     (not just faded) when saved, in a fixed slot so the name never reflows. ACTION is the file menu's own
 *     Workspace-section Save button (t2184) — click the chip, the menu that opens IS the door. Two places state
 *     the same fact deliberately: the dot is the passive, at-a-glance signal; the identity line says it in
 *     words once the menu is open.
 *   (t1221 — there is deliberately NO exit warning. The buffer survives a reload/close, so a leave prompt would warn
 *   about a loss that does not happen; the dot tells the truth without blocking the gesture.)
 *
 * The dirty signal is ONE SOURCE (data/backup.js workspaceSignature over the BACKUP_STORES registry) — this module only
 * reflects it in the UI. Parts (b) exe disk-file + (c) web File-System-Access are a separate concern; this is the
 * localStorage-vs-.ddcs AWARENESS layer only. The workspace .ddcs is the config/library grain (settings, wizards, CAM
 * pack, presets, layout); the current PROGRAM is the separate .mjson job grain and is not part of this signal.
 */
import { isWorkspaceDirtyToFile, ensureWorkspaceWatermark, hasWorkspaceWatermark, workspaceSignature, fileSavedStem, changeLabel } from '../data/backup.js';   // t1309 — changeLabel: the ONE way a changed row reads; t2147 — fileSavedStem for the header name (BACKLOG #7)

let dot = null;
let headerName = null, headerNameTxt = null;   // t2147 (BACKLOG #7) — the header workspace chip's button + name text.
                                                 // t2188 (amendment 1) — `dot` is the workspace chip's OWN dirty
                                                 // indicator now (#hdrWsDirtyDot, index.html); see refresh() below.

export { announceSaved, dismissSaved };   // t1287 — the Ctrl+S path announces through the same one voice

/** t1287 — take any lingering confirmation away. A modal popup that outlives its moment BLOCKS what comes next: the
 *  suite caught it covering the Save-As dialog of the very next save, which is unreachable underneath it. Any save
 *  clears the last answer before it starts producing a new one. */
function dismissSaved() { try { document.getElementById('fileSaveSaid')?.remove(); } catch (_) {} }

/**
 * t2188 (amendment 1) — THE DOT IS THE STATE SIGNAL NOW, replacing the retired disk chip's colour. This is the
 * THIRD ruling on a dot for this exact fact, worth naming so nobody re-litigates it as new ground: an early dot
 * was removed ("we can remove the dot") once the disk chip's own colour already said it; now the disk chip
 * itself is gone, so the fact needs a home again — a dot, not the colour of a button that no longer exists.
 * NOT an asterisk (the human's own reasoning): the chip's name already truncates, and an asterisk would compete
 * with it for width and shift the chevron; a dot occupies a FIXED slot (styles.css) whether shown or hidden, so
 * nothing reflows. NOT red — unsaved is not an error state (red is reserved for the pre-flight badge and
 * Clear); a warm/accent tone reads as "notice", not "broken". HIDDEN, not just coloured, when clean — visually
 * (no fill) AND from assistive tech (`aria-hidden`), so a screen reader never announces an empty status region.
 * ACCESSIBLE NAME lives on the dot itself (`aria-label`), not on the button's own `title` — that stays
 * headerPost.js's single-writer fact (see the ⚠ two-owners note that used to live here, still true of the
 * button's title; just no longer true of this dot, which this module owns outright).
 */
function refresh() {
    const dirty = isWorkspaceDirtyToFile();
    if (dot) {
        dot.classList.toggle('is-on', dirty);
        if (dirty) { dot.setAttribute('aria-label', 'Unsaved changes'); dot.removeAttribute('aria-hidden'); }
        else { dot.removeAttribute('aria-label'); dot.setAttribute('aria-hidden', 'true'); }
    }
    // t2147 (BACKLOG #7) — THE HEADER WORKSPACE CHIP'S NAME TEXT: the stem, not the full filename with its
    // .ddcs extension — matches the identity line's own convention (headerPost.js). "Not saved" is the honest
    // label when there is no file, never a fake title.
    // ⚠ NOT the button's `title` — the chip is #hdrPostBtn itself (merged control), and headerPost.js's own
    // fillFileMenu() already owns that tooltip ("File menu — <name> · <ctrl>"); writing it here too would be
    // two owners racing over one attribute. Text (and now the dot) only, here; the tooltip stays a single-writer fact.
    if (headerNameTxt) headerNameTxt.textContent = fileSavedStem() || 'Not saved';
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
    // t1321 (USER) — A FIRST SAVE SAYS JUST THE NAME. There is no baseline to compare against, so there is no change
    // list to show — and the ABSENCE of one is the honest display for a full first write. Saying "the whole workspace
    // was written" was true but read like machinery; replacing it with a cheerier line would have been the same
    // mistake in nicer words. The other two cases keep theirs: a change list when there is one, and the already-saved
    // line when nothing moved (the t1287 honesty case — silence must never be read as "nothing changed").
    const what = !Array.isArray(changed) ? ''
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
    // …and an EMPTY line is not rendered at all: the first-save popup is the title and the filename, nothing else.
    { const el = ov.querySelector('.saved-pop-what'); el.textContent = what; el.style.display = what ? '' : 'none'; }
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
    // t2188 (amendment 1) — #fileSaveChip is DELETED, not repointed: its own click-to-save wiring goes with it
    // (the file menu's Workspace-section Save button is the one door now, t2184). `saveWorkspace()` below stays
    // exposed on window.ddcsFileSaveState.save — a declared door, unused today, not dead: a future keyboard
    // shortcut or automation caller is a real, cheap use for a function that already exists and works.
    dot = document.getElementById('hdrWsDirtyDot');
    try { window.ddcsAnnounceSaved = announceSaved; window.ddcsDismissSaved = dismissSaved; } catch (_) {}   // t1287 — one voice for every save path

    // t2147 (BACKLOG #7, amended — merged into ONE control) — the name text lives INSIDE #hdrPostBtn now, the
    // SAME button that opens the quick menu (headerPost.js's own initHeaderPost() already wires its click) —
    // no second "open the menu" implementation needed here, just the text (and now the dot) to keep live.
    headerName = document.getElementById('hdrPostBtn');
    if (headerName) headerNameTxt = headerName.querySelector('.hdr-ws-name-txt');

    // t1221 — the beforeunload exit warning is REMOVED (user ruling). It warned about a loss that does not happen:
    // the localStorage buffer SURVIVES a reload or a tab close, so the browser's "Reload site?" prompt was crying
    // wolf on every refresh. Being interrupted by a false alarm teaches people to click through real ones. The DOT
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
    // adopt that settled default state as "clean". Until then the watermark stays unset → dirty is false → no dot
    // and no exit-warning during boot. Returning users have a watermark, so this never runs for them. t2188 — the
    // `settings` store specifically is no longer "lazy" (ui/settingsPanel.js persists it at boot now, closing the
    // exact race this stabilization loop exists to survive for the OTHER, still-lazy stores).
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
