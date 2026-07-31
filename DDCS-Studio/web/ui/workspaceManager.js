/**
 * ui/workspaceManager.js — THE WORKSPACE MANAGER (t1223 Turn A, user-designed).
 *
 * ONE modal for everything you do to a workspace, with two entry points into the same surface (Save focuses the top,
 * Open the bottom) so there is no second place to learn:
 *
 *   TOP — THIS workspace: its name, whether it is saved, and WHAT CHANGED since the last save (derived per declared
 *   BACKUP_STORES row, so a new store shows up here for free), plus Save / Save As… / Duplicate…
 *   BOTTOM — the GRANTED FOLDER as an OS-style file panel: every *.ddcs in it as a row (name · ENVELOPE · controller ·
 *   saved-when), every value read from the FILES themselves, not from anything this browser remembers. The envelope
 *   earns a column of its own because that is what you actually recognise a machine by. Click a row to open it — and
 *   that is the ONLY way in (t1227): a workspace kept somewhere else gets dropped into the folder like any document.
 *
 * WHY A GRANTED FOLDER: the OS dialog lives in exactly one place. Pick the folder once, and from then on opening a
 * workspace is a click on a card instead of a file dialog. The directory handle persists in IDB, so it survives
 * reloads, and it works the same on the web and in the exe (WebView2 exposes Chromium's File System Access).
 *
 * OPEN IS ALWAYS THE WHOLE FILE (user ruling). The old store-picker let you restore a subset, which quietly produced a
 * workspace that was neither the file nor what you had. If the buffer has unsaved work you get ONE prompt —
 * Save and continue / Discard / Cancel — and never a silent download.
 */
import { restoreBackup, previewBackup, markWorkspaceSavedToFile, markItemsSavedToFile, forgetWorkspaceFile, workspaceDelta, changedItemsSince, changeLabel, isWorkspaceDirtyToFile, fileSavedName, fileSavedAt, fileSavedPlace } from '../data/backup.js';   // t1309 — the save-first modal names the programs too
import { saveWorkspace, adoptSaveHandle } from './workspaceSave.js';
import { getHandle, putHandle, handleGranted, requestHandle, FOLDER_KEY } from '../data/fsHandles.js';
import { setMachineName, envelopeSummary } from '../data/workspaceMachine.js';   // t1231 — the envelope AS DECLARED (signs included)
import { dlgNotice, dlgConfirm } from './dialog.js';
import { CONTROLLER_PROFILES } from '../shared/js/profiles/controllerProfiles.js';
import { getAccount, connect, disconnect } from './cloudAccount.js';   // t1233 — the SAME sign-in Settings and the drawer use
import { busyRow, busyOverlay, clearBusyOverlay } from './busyRow.js';   // t1257 — feedback on the row you clicked, the instant you click it

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hasFSA = () => typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

/**
 * THE UNSAVED GATE — the ONE prompt (user ruling). Opening replaces the whole buffer, so if there is unsaved work the
 * user chooses once: keep it (save first), drop it, or back out. There is deliberately no silent safety download here:
 * a file appearing in Downloads that nobody asked for is not consent, and it taught people nothing about their state.
 * @returns {Promise<boolean>} may the caller proceed
 */
export async function confirmDiscardBuffer(what) {
    if (!isWorkspaceDirtyToFile()) return true;
    const choice = await threeWay(
        `Opening ${what} replaces everything in this workspace, and you have changes that are not in a file yet.`,
    );
    if (choice === 'cancel') return false;
    if (choice === 'save') {
        const r = await saveWorkspace();
        if (!r || r.aborted) return false;   // they backed out of the save → back out of the open too
    }
    return true;
}

/** A three-way ask (Save and continue / Discard / Cancel) — dialog.js is two-way, so this is its own small overlay. */
function threeWay(message) {
    return new Promise((resolve) => {
        // t1329 — THE GLYPH STANDS DOWN WHILE WE ASK. The centred "Opening…" overlay is raised on the CLICK (t1283)
        // and sits at z-index 100000; this prompt is at 20000 and appears AFTER it, so with unsaved work the user was
        // shown a spinner covering the very question they had to answer — Save / Discard / Cancel unreachable, the
        // open apparently hung. It is also simply untrue: while this prompt is up nothing is being opened yet.
        // So the overlay is hidden for the duration and restored if the answer lets the open proceed.
        const busy = document.getElementById('ddcs-busy-overlay');
        const prevDisplay = busy ? busy.style.display : null;
        if (busy) busy.style.display = 'none';
        const restoreBusy = (proceeding) => { if (busy) busy.style.display = proceeding ? (prevDisplay || '') : 'none'; if (busy && !proceeding) busy.remove(); };
        const ov = document.createElement('div');
        // NOT `app-dialog`: that class belongs to ui/dialog.js, and borrowing it made this overlay answerable by
        // anything that drives dialogs generically (the test helper did exactly that, clicking the last button).
        ov.className = 'wsm-3way';
        ov.style.cssText = 'position:fixed; inset:0; z-index:20000; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.5);';
        ov.innerHTML = `<div class="wsm-3box" style="background:var(--panel,#161b22); color:var(--text-main,#e6edf5); border:1px solid var(--border,#333a45); border-radius:8px; padding:18px 20px; width:min(460px,92vw); box-shadow:0 12px 40px rgba(0,0,0,.5);">
            <div style="white-space:pre-wrap; line-height:1.45; margin-bottom:16px;">${esc(message)}</div>
            <div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
                <button type="button" class="toolbar-btn settings-io" data-w3="cancel">Cancel</button>
                <button type="button" class="toolbar-btn settings-io" data-w3="discard">Discard changes</button>
                <button type="button" class="toolbar-btn settings-io" data-w3="save" style="border-color:var(--accent);">Save and continue</button>
            </div></div>`;
        const done = (v) => {
            ov.remove(); document.removeEventListener('keydown', onKey, true);
            // cancel means no open is happening, so the glyph goes away entirely rather than sitting over a screen
            // where nothing is loading; the other two answers continue into the open, so it comes back.
            restoreBusy(v !== 'cancel');
            resolve(v);
        };
        const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); done('cancel'); } };
        ov.addEventListener('click', (e) => { const b = e.target.closest('[data-w3]'); if (b) done(b.dataset.w3); else if (e.target === ov) done('cancel'); });
        document.addEventListener('keydown', onKey, true);
        document.body.appendChild(ov);
        (ov.querySelector('[data-w3="save"]') || {}).focus?.();
    });
}

/**
 * READ ONE WORKSPACE FILE — and when it cannot be opened, say WHICH CHECK FAILED (t1225 amendment, user live symptom:
 * their own saved workspace came back as a flat "not a valid .ddcs file", which tells them nothing and is not even
 * true of most failures). Every file this app writes is buildBackup JSON, so the only thing that ever gets refused is
 * something this app did not write — and then the message names the reason.
 *
 * A leading byte-order mark is TOLERATED, not treated as a syntax error: the app never writes one, but a file that has
 * been through an external editor can pick one up, and refusing a workspace over an invisible character is nonsense.
 *
 * @returns {Promise<{obj?:object, error?:string}>}
 */
export async function readWorkspaceFile(file) {
    let text;
    try { text = await file.text(); } catch (_) { return { error: `“${file.name}” could not be read from disk.` }; }
    const body = String(text || '').replace(/^﻿/, '').trim();
    if (!body) return { error: `“${file.name}” is empty — there is nothing in it to open.` };
    let obj;
    try { obj = JSON.parse(body); } catch (e) { return { error: `“${file.name}” is not a workspace: its contents are not valid JSON (${(e && e.message) || 'parse error'}).` }; }
    if (!obj || typeof obj !== 'object') return { error: `“${file.name}” is not a workspace: it holds a bare value, not a workspace object.` };
    if (!previewBackup(obj).valid) {
        // Name the shape when we recognise it. The likeliest wrong file to have on hand is a machine-configuration
        // BUNDLE (what the retired Backup Profile button wrote) — saying so beats "not valid". No door is promised
        // here because the bundle import has no UI door today (see data/profileStore.js).
        if (!obj.kind && (obj.controllerId || obj.userVars || obj.machine)) {
            return { error: `“${file.name}” looks like a machine-configuration bundle, not a workspace file.` };
        }
        const why = !obj.kind ? 'it carries no kind marker'
            : (obj.kind !== 'ddcs.backup' ? `it is a “${obj.kind}” file, not a DDCS workspace`
                : 'it carries no stores');
        return { error: `“${file.name}” is not a DDCS workspace — ${why}.` };
    }
    // A pre-pivot .ddcs has no machine record. Per [[no-legacy-burden]] we do NOT migrate it — restoring it would put
    // this workspace on whatever controller happened to be active, which is worse than not opening it at all.
    if (!hasMachineRecord(obj)) return { error: 'This file is from an older format and has no machine record.' };
    return { obj };
}

/**
 * ONE ROW SUMMARY for a workspace, wherever it lives (t1233). The local panel reads a FILE handle and the cloud panel
 * reads Drive JSON, but what a row SAYS about a machine is one function — so a workspace cannot look like two different
 * machines depending on which tab you are on.
 */
function summarizeWorkspace(name, obj, extra) {
    const st = (obj && obj.stores) || {};
    const mach = st.machine || {};
    const mm = (st.settings && st.settings.machine) || {};
    return {
        name, ...extra,
        envelope: envelopeSummary(mm),   // t1231 — signs INCLUDED: the sign declares the home end, so stripping it hid the machine
        kind: (obj.stores && obj.stores.machine && obj.stores.machine.kind === 'lathe') ? 'lathe' : 'mill',   // t1267 — read from the FILE, like everything else on a row
        dialect: (CONTROLLER_PROFILES[mach.controllerId] || {}).name || mach.controllerId || null,
        savedAt: (obj && obj.date) || null,
    };
}

/** Read one LOCAL .ddcs and summarize it — every value from the FILE itself, never from this browser's state. */
async function cardFor(fileHandle) {
    const name = fileHandle.name.replace(/\.ddcs$/i, '');
    try {
        const file = await fileHandle.getFile();
        const { obj, error } = await readWorkspaceFile(file);
        if (error) return { name, handle: fileHandle, invalid: true, reason: error };
        return summarizeWorkspace(name, obj, { handle: fileHandle });
    } catch (_) { return { name, handle: fileHandle, invalid: true }; }
}

async function listWorkspaces(dir) {
    const out = [];
    try {
        for await (const [entryName, h] of dir.entries()) {
            if (h.kind === 'file' && /\.ddcs$/i.test(entryName)) out.push(h);
            if (out.length >= 60) break;   // a folder browser, not a crawler
        }
    } catch (_) { return []; }
    const cards = await Promise.all(out.map(cardFor));
    return cards.sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
}

/**
 * Open a .ddcs File — the WHOLE file, always — then reload so every module re-reads the restored stores.
 *
 * `fileHandle` is the writable handle this file came from when there is one (a row in the granted folder). Passing it
 * RETARGETS the save handle: after opening B, Ctrl+S must write B, not silently overwrite the file that was open
 * before. A file with no handle (there is no such door today) passes null, which FORGETS the old one rather than
 * leaving a stale save target armed.
 */
async function openWorkspaceFile(file, label, fileHandle) {
    const { obj, error } = await readWorkspaceFile(file);   // ONE reader: the panel row and this door refuse for the same reason
    if (error) { dlgNotice(error); return false; }
    return openWorkspaceObject(obj, file.name, label, { handle: fileHandle || null, place: 'local' });
}

/**
 * THE OPEN ITSELF (t1233) — shared by both places. A workspace from Drive is the same bytes as a workspace from the
 * folder, so it gets the same whole-file restore, the same save-first prompt and the same one-name stamp; only the
 * SAVE TARGET differs (an FSA handle locally, the Drive app folder in the cloud), and that is recorded so a plain Save
 * afterwards goes back where the workspace came from. NO WRITES happen here beyond the user's own save in the prompt.
 */
async function openWorkspaceObject(obj, fileName, label, { handle = null, place = 'local' } = {}) {
    if (!(await confirmDiscardBuffer(label || 'a workspace'))) return false;
    const t0 = Date.now();                          // t1257 — the window in which a re-seed counts as "settled"
    await restoreBackup(obj);                       // the WHOLE file, by construction — absent stores reset to default
    // ORDER (t1225): the name is stamped BEFORE the save baseline, or the workspace is dirty the moment it is opened.
    try { setMachineName(fileName); } catch (_) {}   // ONE-NAME RULE: a renamed file shows its OWN name everywhere
    markWorkspaceSavedToFile(fileName, place);      // the buffer now IS this file, and we remember WHERE it lives
    try { await markItemsSavedToFile(); } catch (_) {}   // t1309 — …including the per-program baseline the file just became
    // …and then take the baseline AGAIN, because the open is not finished when restoreBackup returns. Adopting the
    // file's controller re-seeds the variable DB, and variableDB.setControllerVars is ASYNC (it fetches that
    // controller's variable list before writing) — so on a cross-controller open that write lands AFTER the baseline
    // and the workspace reads "Unsaved changes" the instant it opens. Measured, not guessed: the delta named
    // `variables` as the only changed store. Its own completion signal is what we wait for.
    await controllerSettled(900, t0);
    markWorkspaceSavedToFile(fileName, place);
    try { await markItemsSavedToFile(); } catch (_) {}   // t1309 — the opened file is the new per-program baseline
    await adoptSaveHandle(handle || null);          // …and Save writes THIS file (a cloud open has no local handle)
    // t1329 — the reload takes the page, overlay and all. When the harness stands in for it, stand in FULLY:
    // otherwise the centred open glyph survives an open that 'succeeded' and blocks the next click.
    if (!window.__ddcsNoReload) location.reload(); else clearBusyOverlay();
    return true;
}

/**
 * Resolve when the controller retarget's variable re-seed has landed (or promptly, if nothing is re-seeding).
 *
 * t1257 — MEASURED: this was the whole of the open's lag. The re-seed is triggered by restoreBackup and completes in
 * milliseconds, so by the time this function attached its listener the event had ALREADY FIRED — and it then waited
 * out the full 900ms cap on every single open, for a thing that had finished before it started looking. The fix is to
 * ask "has it happened SINCE the restore began?" instead of "will it happen next?": variableDB stamps
 * window.__ddcsVarsReadyAt when it fires, so a re-seed that landed in the gap counts. The event path stays for a
 * re-seed still in flight, and the cap stays because a signal that never comes must not hang an open.
 * @param {number} since  a timestamp from BEFORE the work that would trigger the re-seed
 */
function controllerSettled(cap = 900, since = 0) {
    if (since && Number(window.__ddcsVarsReadyAt || 0) >= since) return Promise.resolve();
    return new Promise((resolve) => {
        let done = false;
        const finish = () => { if (done) return; done = true; window.removeEventListener('variableDB:ready', finish); resolve(); };
        window.addEventListener('variableDB:ready', finish);
        setTimeout(finish, cap);   // never hang an open on a signal that may not come
    });
}

// ── THE CLOUD SHELF (t1233) — Google Drive as another place workspaces live ─────────────────────────────────────
// REUSED WHOLESALE from the retired project-cloud doors: ui/cloud/googleDrive.js (ensureRoot / list / read / write,
// the GIS token + its silent refresh) and ui/cloudAccount.js (the ONE sign-in Settings and the drawer already use).
// REBUILT: only `trash()` (the existing del() was a permanent files.delete) and this workspace-shaped listing.
const drive = () => import('./cloud/googleDrive.js');

async function listCloudWorkspaces() {
    const d = await drive();
    const root = await d.ensureRoot();
    const files = (await d.list(root)).filter((f) => f.type !== 'folder' && /\.ddcs$/i.test(f.name)).slice(0, 60);
    const cards = await Promise.all(files.map(async (f) => {
        const name = f.name.replace(/\.ddcs$/i, '');
        try {
            const obj = await d.read(f.id);
            if (!previewBackup(obj).valid) return { name, cloudId: f.id, invalid: true, reason: `“${f.name}” is not a DDCS workspace.` };
            if (!hasMachineRecord(obj)) return { name, cloudId: f.id, invalid: true, reason: 'This file is from an older format and has no machine record.' };
            return summarizeWorkspace(name, obj, { cloudId: f.id });
        } catch (e) { return { name, cloudId: f.id, invalid: true, reason: `“${f.name}” could not be read from Drive.` }; }
    }));
    return cards.sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));
}

/** Does this .ddcs carry the machine row every current workspace has? (identity, not config — see BACKUP_STORES) */
function hasMachineRecord(obj) {
    const m = obj && obj.stores && obj.stores.machine;
    return !!(m && (m.name || m.controllerId));
}

// ── the modal ───────────────────────────────────────────────────────────────────────────────────────────────────
let _ov = null;

/** Open the manager. `focus` = 'save' (top) | 'open' (bottom) — the two entry points into the ONE surface. */
/**
 * @param {'save'|'open'} focus  which half to bring the eye to
 * @param {{place?: 'local'|'cloud'}} [opts]  t1245 — open ON a shelf. The setup checklist's "Connect…" needs the CLOUD
 *   tab specifically (its sign-in moved here when Settings' Cloud subtab retired), and a caller that means "the cloud"
 *   should be able to say so instead of opening the manager and hoping the user finds the second tab.
 */
export async function openWorkspaceManager(focus = 'save', opts = {}) {
    const _place0 = initialPlace(opts);   // t1265 — decided ONCE, so the chrome and the render cannot disagree
    if (_ov) { _ov.remove(); _ov = null; }
    const ov = document.createElement('div');
    ov.id = 'wsmOverlay';
    ov.className = 'wsm-overlay';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="wsm-modal">
        <div class="wsm-head"><span class="wsm-title">Workspace</span><button type="button" class="wsm-x" aria-label="Close">✕</button></div>
        <div class="wsm-body">
            <section class="wsm-current" id="wsmCurrent"></section>
            <section class="wsm-folder">
                <div class="wsm-places" role="tablist" aria-label="Where workspaces live">
                    <button type="button" class="wsm-place${_place0 === 'cloud' ? '' : ' is-active'}" data-place="local" role="tab">📁 Local folder</button>
                    <button type="button" class="wsm-place${_place0 === 'cloud' ? ' is-active' : ''}" data-place="cloud" role="tab">☁ Cloud</button>
                </div>
                <div class="wsm-folder-head">
                    <span class="wsm-folder-path" id="wsmFolderPath">No workspace folder yet</span>
                    <button type="button" class="toolbar-btn settings-io" id="wsmPickFolder">📁 Choose folder…</button>
                </div>
                <div class="wsm-cards" id="wsmCards"></div>
            </section>
        </div>
    </div>`;
    document.body.appendChild(ov);
    _ov = ov;
    const close = () => { ov.remove(); if (_ov === ov) _ov = null; document.removeEventListener('keydown', onKey, true); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
    ov.querySelector('.wsm-x').addEventListener('click', close);

    renderCurrent(ov);
    ov.querySelector('#wsmCurrent').addEventListener('click', async (e) => {
        const act = e.target.closest('[data-wsm]');
        if (!act) return;
        const kind = act.dataset.wsm;
        // t1233 — the ACTIVE TAB is where a save goes: on the Cloud tab, Save / Save As / Duplicate write to Drive.
        const to = ov.__place === 'cloud' ? 'cloud' : '';
        const after = async (r) => { if (r && r.ok) { renderCurrent(ov); await renderPlace(ov); } if (r && r.error) dlgNotice('Could not save to Drive: ' + r.error); };
        if (kind === 'save') { await after(await saveWorkspace({ to })); return; }
        if (kind === 'saveas') { await after(await saveWorkspace({ pickNew: true, to })); return; }
        if (kind === 'duplicate') {
            // DUPLICATE = Save As a copy. There is no separate copy mechanism to keep correct: the bytes are the same
            // buildBackup, and the new file's NAME becomes the copy's name (one-name rule).
            const base = (fileSavedName() || 'workspace').replace(/\.ddcs$/i, '');
            await after(await saveWorkspace({ pickNew: true, suggestedName: `copy-of-${base}.ddcs`, to }));
        }
    });

    ov.querySelector('#wsmPickFolder').addEventListener('click', async () => {
        // t1231 — this used to point at Browse…, a button t1227 retired: a message naming a door that no longer
        // exists is worse than no message. It now says what this browser can actually do.
        if (!hasFSA()) { dlgNotice('This browser cannot grant a workspaces folder. Saving still works — it downloads the .ddcs instead, and you can open it in a browser that supports folders (Chrome, Edge, or the desktop app).'); return; }
        try { const dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'ddcsWorkspaces' }); await putHandle(FOLDER_KEY, dir); await renderFolder(ov, dir); }
        catch (e) { if (!e || e.name !== 'AbortError') dlgNotice('Could not open that folder: ' + ((e && e.message) || e)); }
    });
    // t1227 (user ruling) — the BROWSE… escape is gone: the granted folder is the ONE door. A workspace that lives
    // somewhere else gets dropped into the folder like any other document, which is a thing the OS already does well.
    // (openWorkspaceFile still takes a null handle — that is how it FORGETS a stale save target, not a second door.)
    // t1233 — THE PLACE TABS. Local folder | Cloud. Same table, same formatter, same open; a different shelf.
    // t1265 AMEND-2 (user: "if I'm connected I expect the file explorer to open ON the Cloud tab") — THE INITIAL TAB
    // IS DECIDED BY CONTEXT, never by a setting:
    //   1. an explicit place from the caller wins (the checklist's Connect… means the Cloud tab, specifically)
    //   2. else, if this workspace HAS a home, open on ITS shelf — a Drive-living file opens on Cloud, a local one
    //      on Local, because the thing you are looking at is the thing you most likely want to act on
    //   3. else (no file yet): Cloud when signed in, Local otherwise
    // The tabs stay freely clickable either way; this only decides where the eye lands first.
    ov.__place = _place0;
    ov.querySelector('.wsm-places').addEventListener('click', async (e) => {
        const t = e.target.closest('[data-place]');
        if (!t || t.dataset.place === ov.__place) return;
        ov.__place = t.dataset.place;
        ov.querySelectorAll('.wsm-place').forEach((b) => b.classList.toggle('is-active', b.dataset.place === ov.__place));
        await renderPlace(ov);
    });

    /**
     * ── t1462 — SURFACE 5 OF THE CONTEXT-MENU PASS: the WORKSPACE ROWS ───────────────────────────────────────────
     *
     * OPEN + DELETE, and the menu CLICKS THE ROW'S OWN BUTTONS rather than re-implementing either. Both actions here
     * end in something irreversible — a `location.reload()` that replaces the app, and a File System Access
     * `removeEntry` that does not go to the Recycle Bin — so a second copy of either would be a second chance to get
     * the index wrong, on the two operations in this app least able to survive it. Dispatching the row's real button
     * also keeps the busy-row guard, the double-click lock and the delete confirm exactly as they are.
     *
     * ── ⚠ RENAME IS ABSENT, BY A SHIPPED RULING, AND ITS ABSENCE IS LOCKED ───────────────────────────────────────
     * t1223's ONE-NAME RULE: *"the name input is GONE. The workspace's name IS its filename IS what every surface
     * shows… Renaming is Save As."* There is no rename action anywhere to shortcut, and `Save As` is a HEADER action
     * on the workspace that is currently OPEN — offering it on some other card would mean "open that one first",
     * which the Open entry already is. (That reading was rejected explicitly: it is Open wearing a second label, and
     * the user would discover the difference only after their file had not been renamed.)
     *
     * The queued FILE-rename feature is a different thing and PRESERVES one-name — it renames the file itself, so the
     * one name simply changes. It lives in another lane. So this menu must not lag it: `context-menu-workspace-1462`
     * asserts the absence AND instruments the module for a real rename capability, and goes RED the day one lands.
     * A menu that quietly lacks an action the app has grown is the same defect as one that offers an action it lacks.
     */
    ov.querySelector('#wsmCards').addEventListener('contextmenu', async (e) => {
        const row = e.target.closest && e.target.closest('.wsm-fp-row');
        if (!row) return;
        const openBtn = row.querySelector('[data-wsm-open]');
        const delBtn = row.querySelector('[data-wsm-del]');
        if (!openBtn) return;
        const card = (ov.__cards || [])[Number(openBtn.dataset.wsmOpen)];
        if (!card) return;
        e.preventDefault();
        const { openMenu } = await import('./opContextMenu.js');
        openMenu([
            {
                label: `▶ Open ${card.name}`,
                fn: () => openBtn.click(),
                disabled: !!card.invalid,
                title: card.invalid ? (card.reason || 'not a readable workspace') : '',
            },
            { label: '🗑 Delete…', fn: () => delBtn && delBtn.click(), disabled: !delBtn },
        ], e.clientX, e.clientY);
    });
    import('./opContextMenu.js').then((m) => m.attachLongPress(ov.querySelector('#wsmCards'))).catch(() => { /* optional */ });

    ov.querySelector('#wsmCards').addEventListener('click', async (e) => {
        // t1263 — the RE-ALLOW. A click is a user gesture, so the runtime will actually ask; the handle is the one
        // already remembered, so there is no OS picker and no chance of picking a different folder by mistake.
        if (e.target.closest('#wsmAllowFolder')) {
            const known = await getHandle(FOLDER_KEY);
            if (known && await requestHandle(known)) { ov.__needsAllow = false; await renderPlace(ov); }
            else dlgNotice('Without access to that folder your workspaces cannot be listed. You can allow it next time, or choose a different folder.');
            return;
        }
        const signin = e.target.closest('#wsmCloudSignIn');
        if (signin) { await cloudSignIn(ov); return; }
        if (e.target.closest('#wsmCloudOut')) { disconnect(); await renderPlace(ov); return; }   // t1243 — the badge's disconnect, transferred
        const del = e.target.closest('[data-wsm-del]');
        if (del) {
            const c = (ov.__cards || [])[Number(del.dataset.wsmDel)];
            if (!c) return;
            if (c.cloudId) await deleteCloudWorkspace(ov, c);
            else if (ov.__dir) await deleteWorkspaceFile(ov, ov.__dir, c);
            return;
        }
        const card = e.target.closest('[data-wsm-open]');
        if (!card) return;
        const idx = Number(card.dataset.wsmOpen);
        const card_ = (ov.__cards || [])[idx];
        if (!card_) return;
        if (card_.invalid) { dlgNotice(card_.reason || `“${card_.name}” is not a readable workspace.`); return; }
        // The busy state belongs to the ROW, not to the open BUTTON inside it: the row also holds a delete button, and
        // freezing the whole row is what stops a mis-tap landing on delete while the workspace is opening.
        const busyTarget = card.closest('.wsm-fp-row') || card;
        // t1257 (user live report) — the row goes BUSY on the click, not when the read returns. A cloud row is the
        // worst case (a Drive fetch, then the whole restore); a local row is fast now but still ends in a reload, and
        // the glyph has to bridge that or the screen goes quiet again just before the page changes.
        // t1283 (user ruling) — a workspace open ALSO takes the screen centre. This open ends in location.reload(),
        // so the whole app is going away: a centred glyph is the honest signal and it bridges the gap until the new
        // page paints. The row state stays as the double-click guard. (Library imports keep the row glyph alone —
        // they finish on this screen, where an overlay would claim a busyness the app does not have.)
        const dismiss = busyOverlay(`“${card_.name}”`);
        if (card_.cloudId) {   // a cloud row: read it from Drive, then the SAME open
            await busyRow(busyTarget, async () => {
                try {
                    const obj = await (await drive()).read(card_.cloudId);
                    return await openWorkspaceObject(obj, card_.name + '.ddcs', `“${card_.name}”`, { handle: null, place: 'cloud' });
                } catch (e) { dismiss(); dlgNotice(`“${card_.name}” could not be read from Drive: ${(e && e.message) || e}`); return false; }
            });
            return;
        }
        await busyRow(busyTarget, async () => {
            try { return await openWorkspaceFile(await card_.handle.getFile(), `“${card_.name}”`, card_.handle); }
            catch (e) { dismiss(); throw e; }
        });
    });

    await renderPlace(ov);

    if (focus === 'open') ov.querySelector('.wsm-folder')?.scrollIntoView({ block: 'nearest' });
    return ov;
}

/**
 * t1309 — WHICH PROGRAMS, filled in a tick later. The rest of this panel is derived synchronously from localStorage;
 * the project volume is IDB, so its item detail arrives asynchronously and is written into the row the render left
 * for it. If it says nothing (no per-item baseline yet, or no program changed) the row stays hidden rather than
 * printing an empty parenthesis.
 */
function fillProgramDelta(ov) {
    const host = ov.querySelector('#wsmPrograms');
    if (!host) return;
    changedItemsSince('projects').then((d) => {
        if (!d.known || !d.items.length) return;
        host.hidden = false;
        host.textContent = changeLabel({ label: 'Saved programs', unit: 'programs', unitOne: 'program', count: d.items.length, items: d.items });
    }).catch(() => {});
}

function renderCurrent(ov) {
    const host = ov.querySelector('#wsmCurrent');
    const name = fileSavedName();
    const dirty = isWorkspaceDirtyToFile();
    const at = fileSavedAt();
    const rows = workspaceDelta();
    const changed = rows.filter((r) => r.changed === true);
    const known = rows.some((r) => r.changed !== null);   // is there a per-store baseline (a save since t1223)?
    // NEVER-SAVED and BASELINE-UNKNOWN are different states, and conflating them made a workspace that HAS a file read
    // "Never saved to a file". Only WHICH PARTS changed depends on the newer per-store baseline.
    // t1231 — SAVED REQUIRES A NAME. This used to accept a bare timestamp (`at != null`), so a browser carrying a
    // nameless mark from an older build reported "Untitled workspace · Saved" — saved to a file it could not name.
    // The name is the one fact that proves a file exists, so it is the one this reads. (data/backup.js no longer
    // writes a nameless mark at all; this keeps the display honest for browsers that already have one.)
    const everSaved = !!name;
    const state = !everSaved ? 'Never saved to a file' : (dirty ? 'Unsaved changes' : 'Saved');
    host.innerHTML = `
        <div class="wsm-cur-head">
            <span class="wsm-cur-name">${esc(name || 'Untitled workspace')}</span>
            <span class="wsm-state ${dirty || !everSaved ? 'is-dirty' : 'is-saved'}">${esc(state)}</span>
            ${everSaved && at ? `<span class="wsm-cur-when">${esc(new Date(at).toLocaleString())}</span>` : ''}
        </div>
        <div class="wsm-delta">${
            !known
                ? (everSaved
                    ? '<span class="wsm-dim">Which parts changed is unknown until the next save.</span>'
                    : '<span class="wsm-dim">Save it once and this will list exactly what changed since.</span>')
                : (changed.length
                    ? rows.map((r) => `<span class="wsm-drow ${r.changed ? 'is-chg' : ''}">${esc(r.label)}${r.count != null ? ` <b>${esc(r.count)}</b> ${esc(r.unit)}` : ''}</span>`).join('')
                    : '<span class="wsm-dim">Nothing has changed since the last save.</span>')
        }<span class="wsm-drow is-chg" id="wsmPrograms" hidden></span></div>
        <div class="wsm-cur-actions">
            <button type="button" class="toolbar-btn settings-io" data-wsm="save" style="border-color:var(--accent);">💾 Save</button>
            <button type="button" class="toolbar-btn settings-io" data-wsm="saveas">Save As…</button>
            ${/* t1227 — Duplicate is meaningless before there IS a file to duplicate, so first run does not offer it. */''
            }${everSaved ? '<button type="button" class="toolbar-btn settings-io" data-wsm="duplicate">Duplicate…</button>' : ''}
        </div>`;
    fillProgramDelta(ov);   // t1309 — the program names arrive a tick later (IDB), into the row above
}

/**
 * Render whichever PLACE is active. Local keeps exactly today's behaviour; cloud lists Drive (or states why it cannot).
 * Feature-detect and DEGRADE: no folder support, no account, no network — each says which, and none of them throw.
 */
async function renderPlace(ov) {
    // t1243 — THE STALE-RENDER GUARD. Both halves await (IDB + the folder walk locally, the Drive listing in the cloud),
    // so switching tabs while one is in flight used to let the SLOWER, OLDER render land last and paint over the newer
    // one. That is not just a wrong picture: the render also writes `ov.__cards`, which is what a row click opens or
    // deletes — so a Cloud-looking list could hold local rows. One monotonic token, checked after every await: a render
    // that is no longer the current one writes nothing at all.
    const token = (ov.__renderSeq = (ov.__renderSeq || 0) + 1);
    const stale = () => ov.__renderSeq !== token;
    const head = ov.querySelector('.wsm-folder-head');
    const cards = ov.querySelector('#wsmCards');
    if (ov.__place === 'cloud') {
        head.hidden = true;
        const acc = getAccount();
        if (!acc.connected || acc.provider !== 'google') { renderCloudSignedOut(ov); return; }
        cards.innerHTML = '<div class="wsm-dim">Reading your Drive…</div>';
        try {
            const list = await listCloudWorkspaces();
            if (stale()) return;
            renderCards(ov, null, list, 'cloud');
            cards.insertAdjacentHTML('afterbegin', cloudAccountBar(acc));   // t1243 — WHO you are signed in as, and out
        }
        catch (e) {
            if (stale()) return;
            ov.__cards = [];
            const why = /cloud-auth/.test(String(e && e.message)) ? 'Your Google sign-in has expired.' : `Drive could not be reached (${(e && e.message) || e}).`;
            cards.innerHTML = `<div class="wsm-empty">${esc(why)} Your local workspaces are unaffected — switch back to <b>Local folder</b>, or sign in again.`
                + '<div style="margin-top:10px"><button type="button" class="toolbar-btn settings-io" id="wsmCloudSignIn">Sign in to Google Drive</button></div></div>';
        }
        return;
    }
    head.hidden = false;
    const dir = await getHandle(FOLDER_KEY);
    if (stale()) return;
    const granted = dir && await handleGranted(dir);   // QUERY only — this runs on open, outside any click (t1263)
    if (stale()) return;
    if (granted) { await renderFolder(ov, dir, stale); return; }
    // t1263 (user-proven) — TWO DIFFERENT STATES, and conflating them is what made a granted folder look unchosen
    // after every restart. `dir` here means the user HAS chosen a folder and the runtime wants one click to re-allow
    // it; that is not the same as never having chosen one, and it must not send them back through the OS picker.
    ov.__needsAllow = !!dir;
    renderCards(ov, null, []);
}

/**
 * t1243 (user) — THE ACCOUNT BAR. The header's ☁ badge is retired: cloud access lives in ONE place, this tab. The badge
 * carried three things and all three land here rather than being orphaned — sign-in (the signed-out panel below),
 * WHO you are signed in as, and the way back out. The identity is read from the shared account API, not a second copy.
 */
function cloudAccountBar(acc) {
    const who = esc(acc.email || acc.name || 'your Google account');
    return `<div class="wsm-cloudbar" id="wsmCloudBar"><span class="wsm-dim">Signed in as</span> <b>${who}</b>`
        + '<button type="button" class="wss-link" id="wsmCloudOut">Sign out</button>'
        // t1265 (user ruling) — THE "new saves go to" PREFERENCE IS GONE. The CONTEXT already decides: a plain Save
        // returns the file to the shelf it lives on, Save As follows the tab you are looking at, and a brand-new
        // workspace runs the name+folder dialog. A setting that pre-decides all that could only ever disagree with
        // what the screen was showing — and when a setting and the visible context disagree, people trust the screen.
        + '</div>';
}

/**
 * Which shelf the manager opens on (t1265). Pure decision, no side effects — so the three cases can be read at once
 * and tested one by one.
 */
function initialPlace(opts) {
    if (opts && (opts.place === 'cloud' || opts.place === 'local')) return opts.place;
    // "HAS a home" is answered by the saved NAME, not by fileSavedPlace(): that function answers "which shelf does a
    // save go to", and it defaults to 'local' when there is no file at all — a sensible fallback for the save path,
    // and a wrong answer to this question. Asking it here would make every unsaved workspace look local-living and
    // the signed-in case unreachable.
    if (fileSavedName()) return fileSavedPlace() === 'cloud' ? 'cloud' : 'local';
    return getAccount().connected ? 'cloud' : 'local';
}

/** The signed-out cloud tab: ONE button, and nothing else to decide. */
function renderCloudSignedOut(ov) {
    ov.__cards = [];
    ov.__dir = null;
    ov.querySelector('#wsmCards').innerHTML =
        '<div class="wsm-empty">Keep workspaces in your own Google Drive as well as on this machine — the same file, reachable from anywhere you sign in.'
        + '<div style="margin-top:10px"><button type="button" class="toolbar-btn settings-io" id="wsmCloudSignIn">☁ Sign in to Google Drive</button></div></div>';
}

/**
 * Sign in, then show the shelf. THE ORIGIN PROBLEM (user hit a Google 400 origin_mismatch): Google's own page says
 * nothing a person can act on, and the address it objects to is one we KNOW. So when sign-in fails we name it, in
 * plain words, instead of leaving them on Google's generic error.
 */
async function cloudSignIn(ov) {
    try { await connect('google'); } catch (_) { /* the shared flow reports its own failures */ }
    // GIS resolves asynchronously; the account event is the honest signal that it worked.
    const done = () => { window.removeEventListener('ddcs:cloud-account', done); renderPlace(ov); };
    window.addEventListener('ddcs:cloud-account', done);
    setTimeout(() => {
        window.removeEventListener('ddcs:cloud-account', done);
        if (getAccount().connected) { renderPlace(ov); return; }
        ov.querySelector('#wsmCards').innerHTML =
            `<div class="wsm-empty">Google did not sign you in for this address.<br><br>If you saw a <b>400: origin_mismatch</b>, this exact origin has to be listed under <b>Authorized JavaScript origins</b> on the OAuth client:<br><b class="wsm-origin">${esc(location.origin)}</b><br><br>That is a setting on the Google side, not something the app can change for you.`
            + '<div style="margin-top:10px"><button type="button" class="toolbar-btn settings-io" id="wsmCloudSignIn">Try again</button></div></div>';
    }, 20000);
}

/**
 * DELETE A CLOUD WORKSPACE — Drive's TRASH, which is recoverable, so the confirm promises something different from the
 * local one (removeEntry has no trash at all). Fails closed, same as local.
 */
async function deleteCloudWorkspace(ov, card) {
    const fileName = card.name + '.ddcs';
    const isActive = fileSavedName() === fileName;
    let ok = false;
    try {
        ok = await dlgConfirm(
            `Move “${fileName}” to your Google Drive trash?\n\n`
            + 'It leaves this list straight away. Drive keeps trashed files for about 30 days, so you can restore it there if you change your mind.'
            + (isActive ? '\n\nThis is the workspace you have open. Your work stays open here, but it will no longer be saved to a file.' : ''),
            { title: 'Move workspace to Drive trash', danger: true, okLabel: 'Move to trash', cancelLabel: 'Cancel' },
        );
    } catch (_) { return; }
    if (!ok) return;
    try { await (await drive()).trash(card.cloudId); }
    catch (e) { dlgNotice(`“${fileName}” could not be trashed: ${(e && e.message) || e}`); return; }
    if (isActive) { forgetWorkspaceFile(); await adoptSaveHandle(null); renderCurrent(ov); }
    await renderPlace(ov);
}

async function renderFolder(ov, dir, stale = () => false) {
    ov.querySelector('#wsmFolderPath').textContent = dir.name || 'Workspace folder';
    ov.querySelector('#wsmCards').innerHTML = '<div class="wsm-dim">Reading the folder…</div>';
    // the folder walk reads every file's header, so it is the SLOWEST await in the modal and the one most likely to
    // land after a tab switch — it takes renderPlace's staleness check with it (t1243)
    const list = await listWorkspaces(dir);
    if (stale()) return;
    renderCards(ov, dir, list);
}

function renderCards(ov, dir, cards, place = 'local') {
    ov.__cards = cards;
    ov.__dir = dir;   // the granted folder handle — delete needs it to removeEntry (null in the cloud: Drive is by id)
    const host = ov.querySelector('#wsmCards');
    if (place === 'local' && !dir) {
        host.innerHTML = ov.__needsAllow
            ? '<div class="wsm-empty">Your workspaces folder is remembered — this app just needs your OK to read it again.'
              + '<div style="margin-top:10px"><button type="button" class="toolbar-btn settings-io" id="wsmAllowFolder">📁 Allow the folder</button></div></div>'
            : '<div class="wsm-empty">Choose a folder to keep your workspaces in — then opening one is a click, not a file dialog.</div>';
        return;
    }
    if (!cards.length) {
        host.innerHTML = place === 'cloud'
            ? '<div class="wsm-empty">No workspaces in your Drive yet. Save one while this tab is open and it will show up here.</div>'
            : '<div class="wsm-empty">No .ddcs workspaces in this folder yet. Save one here and it will show up.</div>';
        return;
    }
    // An OS-style FILE PANEL (user): a bordered, scrollable list with a column header, not a card grid. The ENVELOPE
    // keeps the strongest column because that is what a machine is recognised by; the name leads the row because that
    // is what a file browser is.
    host.innerHTML =
        '<div class="wsm-fp">'
        + '<div class="wsm-fp-head"><span class="wsm-c-name">Name</span><span class="wsm-c-env">Envelope</span>'
        + '<span class="wsm-c-ctrl">Controller</span><span class="wsm-c-when">Saved</span></div>'
        + '<div class="wsm-fp-list">'
        // t1231 — each row is now a ROW (a div) holding the OPEN button plus its own DELETE button: a button cannot
        // nest inside a button, and delete has to be a target of its own so a mis-tap opens a workspace rather than
        // erasing one. `.wsm-fp-row` stays the row for everything that reads it (specs, styling, hover).
        + cards.map((c, i) => `<div class="wsm-fp-row${c.invalid ? ' is-bad' : ''}">`
            + (c.invalid
                // a file it cannot open is still CLICKABLE — clicking it says why, instead of a row that ignores you
                ? `<button type="button" class="wsm-fp-open" data-wsm-open="${i}" title="${esc(c.reason || 'not a readable workspace')}">`
                  + `<span class="wsm-c-name">${FILE_ICON}${esc(c.name)}</span>`
                  + `<span class="wsm-c-env">—</span><span class="wsm-c-ctrl">cannot be opened</span><span class="wsm-c-when"></span></button>`
                : `<button type="button" class="wsm-fp-open" data-wsm-open="${i}" title="Open ${esc(c.name)}">`
                  + `<span class="wsm-c-name">${FILE_ICON}${esc(c.name)}</span>`
                  + `<span class="wsm-c-env">${esc(c.envelope || '—')}</span>`
                  // t1267 — a LATHE row says so beside its dialect; a mill row says nothing extra (the default needs no label)
                  + `<span class="wsm-c-ctrl">${esc(c.dialect || 'unknown')}${c.kind === 'lathe' ? ' · Lathe' : ''}</span>`
                  + `<span class="wsm-c-when">${c.savedAt ? esc(String(c.savedAt).slice(0, 10)) : ''}</span></button>`)
            + `<button type="button" class="wsm-fp-del" data-wsm-del="${i}" title="Delete ${esc(c.name)}.ddcs permanently" aria-label="Delete ${esc(c.name)}">${TRASH_ICON}</button>`
            + '</div>').join('')
        + '</div></div>';
}

const FILE_ICON = '<svg class="wsm-fico" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">'
    + '<path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#2f6fd0"/>'
    + '<path d="M15 2l5 5h-5z" fill="#8fb6e8"/></svg>';
const TRASH_ICON = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
    + 'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/>'
    + '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'
    + '<line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

/**
 * DELETE A WORKSPACE FILE (t1231, user-ruled). The confirm NAMES the file and says plainly what deletion means here:
 * this is a File System Access removeEntry, which does NOT go to the Recycle Bin and cannot be undone from the app.
 * It FAILS CLOSED — if the confirm cannot be shown, nothing is deleted.
 *
 * The OPEN workspace can be deleted too (the user's ruling, and their machine): the buffer keeps working, so the only
 * thing that changes is that its work no longer lives in any file — which the confirm says, and which the state then
 * reflects (never-saved, and the save handle is dropped so Ctrl+S asks where to put it).
 */
async function deleteWorkspaceFile(ov, dir, card) {
    const fileName = card.name + '.ddcs';
    const isActive = fileSavedName() === fileName;
    let ok = false;
    try {
        ok = await dlgConfirm(
            `Delete “${fileName}” from ${dir.name || 'this folder'}?\n\n`
            + 'This deletes the file PERMANENTLY. It does not go to the Recycle Bin, and this app cannot undo it.'
            + (isActive ? '\n\nThis is the workspace you have open. Your work stays open here, but it will no longer be saved to a file.' : ''),
            { title: 'Delete workspace file', danger: true, okLabel: 'Delete', cancelLabel: 'Cancel' },
        );
    } catch (_) { return; }   // cannot ask → do not delete
    if (!ok) return;
    try { await dir.removeEntry(fileName); }
    catch (e) { dlgNotice(`“${fileName}” could not be deleted: ${(e && e.message) || e}`); return; }
    if (isActive) { forgetWorkspaceFile(); await adoptSaveHandle(null); renderCurrent(ov); }
    await renderFolder(ov, dir);
}

if (typeof window !== 'undefined') {
    window.openWorkspaceManager = openWorkspaceManager;
    window.ddcsConfirmDiscardBuffer = confirmDiscardBuffer;
}
