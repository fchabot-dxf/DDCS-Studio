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
 *   earns a column of its own because that is what you actually recognise a machine by. Click a row to open it; one
 *   Browse-elsewhere escape covers files outside the folder.
 *
 * WHY A GRANTED FOLDER: the OS dialog lives in exactly one place. Pick the folder once, and from then on opening a
 * workspace is a click on a card instead of a file dialog. The directory handle persists in IDB, so it survives
 * reloads, and it works the same on the web and in the exe (WebView2 exposes Chromium's File System Access).
 *
 * OPEN IS ALWAYS THE WHOLE FILE (user ruling). The old store-picker let you restore a subset, which quietly produced a
 * workspace that was neither the file nor what you had. If the buffer has unsaved work you get ONE prompt —
 * Save and continue / Discard / Cancel — and never a silent download.
 */
import { restoreBackup, previewBackup, markWorkspaceSavedToFile, workspaceDelta, isWorkspaceDirtyToFile, fileSavedName, fileSavedAt } from '../data/backup.js';
import { saveWorkspace, adoptSaveHandle } from './workspaceSave.js';
import { getHandle, putHandle, handleGranted, FOLDER_KEY } from '../data/fsHandles.js';
import { setMachineName } from '../data/workspaceMachine.js';
import { dlgNotice } from './dialog.js';
import { CONTROLLER_PROFILES } from '../shared/js/profiles/controllerProfiles.js';

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
        const done = (v) => { ov.remove(); document.removeEventListener('keydown', onKey, true); resolve(v); };
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

/** Read one .ddcs and summarize it for a row — every value from the FILE itself, never from this browser's state. */
async function cardFor(fileHandle) {
    const name = fileHandle.name.replace(/\.ddcs$/i, '');
    try {
        const file = await fileHandle.getFile();
        const { obj, error } = await readWorkspaceFile(file);
        if (error) return { name, handle: fileHandle, invalid: true, reason: error };
        const st = obj.stores || {};
        const mach = st.machine || {};
        const mm = (st.settings && st.settings.machine) || {};
        const n = (v) => (Number.isFinite(Number(v)) ? Math.abs(Number(v)) : null);
        const env = [n(mm.x), n(mm.y), n(mm.z)];
        return {
            name, handle: fileHandle,
            envelope: env.every((v) => v != null) ? `${env[0]} × ${env[1]} × ${env[2]}` : null,
            dialect: (CONTROLLER_PROFILES[mach.controllerId] || {}).name || mach.controllerId || null,
            savedAt: obj.date || null,
        };
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
 * before. Browse… has no handle, so it passes null — which forgets the old one rather than leaving it armed.
 */
async function openWorkspaceFile(file, label, fileHandle) {
    const { obj, error } = await readWorkspaceFile(file);   // ONE reader: the panel row and this door refuse for the same reason
    if (error) { dlgNotice(error); return false; }
    if (!(await confirmDiscardBuffer(label || 'a workspace'))) return false;
    await restoreBackup(obj);                       // the WHOLE file, by construction — absent stores reset to default
    // ORDER (t1225): the name is stamped BEFORE the save baseline, or the workspace is dirty the moment it is opened.
    try { setMachineName(file.name); } catch (_) {}   // ONE-NAME RULE: an OS-renamed file shows its OWN name everywhere
    markWorkspaceSavedToFile(file.name);            // the buffer now IS this file
    await adoptSaveHandle(fileHandle || null);      // …and Save writes THIS file from now on
    if (!window.__ddcsNoReload) location.reload();
    return true;
}

/** Does this .ddcs carry the machine row every current workspace has? (identity, not config — see BACKUP_STORES) */
function hasMachineRecord(obj) {
    const m = obj && obj.stores && obj.stores.machine;
    return !!(m && (m.name || m.controllerId));
}

// ── the modal ───────────────────────────────────────────────────────────────────────────────────────────────────
let _ov = null;

/** Open the manager. `focus` = 'save' (top) | 'open' (bottom) — the two entry points into the ONE surface. */
export async function openWorkspaceManager(focus = 'save') {
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
                <div class="wsm-folder-head">
                    <span class="wsm-folder-path" id="wsmFolderPath">No workspace folder yet</span>
                    <button type="button" class="toolbar-btn settings-io" id="wsmPickFolder">📁 Choose folder…</button>
                    <button type="button" class="toolbar-btn settings-io" id="wsmBrowse" title="Open a .ddcs from anywhere else">Browse…</button>
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
        if (kind === 'save') { const r = await saveWorkspace(); if (r && r.ok) { renderCurrent(ov); } return; }
        if (kind === 'saveas') { const r = await saveWorkspace({ pickNew: true }); if (r && r.ok) { renderCurrent(ov); } return; }
        if (kind === 'duplicate') {
            // DUPLICATE = Save As a copy. There is no separate copy mechanism to keep correct: the bytes are the same
            // buildBackup, and the new file's NAME becomes the copy's name (one-name rule).
            const base = (fileSavedName() || 'workspace').replace(/\.ddcs$/i, '');
            const r = await saveWorkspace({ pickNew: true, suggestedName: `copy-of-${base}.ddcs` });
            if (r && r.ok) renderCurrent(ov);
        }
    });

    ov.querySelector('#wsmPickFolder').addEventListener('click', async () => {
        if (!hasFSA()) { dlgNotice('This browser cannot grant a folder. Use Browse… to open a .ddcs file instead.'); return; }
        try { const dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'ddcsWorkspaces' }); await putHandle(FOLDER_KEY, dir); await renderFolder(ov, dir); }
        catch (e) { if (!e || e.name !== 'AbortError') dlgNotice('Could not open that folder: ' + ((e && e.message) || e)); }
    });
    ov.querySelector('#wsmBrowse').addEventListener('click', async () => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.ddcs,application/json';
        // no handle from a plain file input → openWorkspaceFile FORGETS the old one (a Save then asks where to put it)
        input.addEventListener('change', async () => { const f = input.files && input.files[0]; if (f) await openWorkspaceFile(f, `“${f.name}”`, null); });
        input.click();
    });
    ov.querySelector('#wsmCards').addEventListener('click', async (e) => {
        const card = e.target.closest('[data-wsm-open]');
        if (!card) return;
        const idx = Number(card.dataset.wsmOpen);
        const card_ = (ov.__cards || [])[idx];
        if (!card_) return;
        if (card_.invalid) { dlgNotice(card_.reason || `“${card_.name}” is not a readable workspace.`); return; }
        await openWorkspaceFile(await card_.handle.getFile(), `“${card_.name}”`, card_.handle);
    });

    const dir = await getHandle(FOLDER_KEY);
    if (dir && await handleGranted(dir)) await renderFolder(ov, dir);
    else renderCards(ov, null, []);

    if (focus === 'open') ov.querySelector('.wsm-folder')?.scrollIntoView({ block: 'nearest' });
    return ov;
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
    // "Never saved to a file". The saved/dirty state comes from the watermark (which every save has always written);
    // only WHICH PARTS changed depends on the newer per-store baseline.
    const everSaved = at != null || !!name;
    const state = !everSaved ? 'Never saved to a file' : (dirty ? 'Unsaved changes' : 'Saved');
    host.innerHTML = `
        <div class="wsm-cur-head">
            <span class="wsm-cur-name">${esc(name || 'Untitled workspace')}</span>
            <span class="wsm-state ${dirty || !everSaved ? 'is-dirty' : 'is-saved'}">${esc(state)}</span>
            ${at ? `<span class="wsm-cur-when">${esc(new Date(at).toLocaleString())}</span>` : ''}
        </div>
        <div class="wsm-delta">${
            !known
                ? (everSaved
                    ? '<span class="wsm-dim">Which parts changed is unknown until the next save.</span>'
                    : '<span class="wsm-dim">Save it once and this will list exactly what changed since.</span>')
                : (changed.length
                    ? rows.map((r) => `<span class="wsm-drow ${r.changed ? 'is-chg' : ''}">${esc(r.label)}${r.count != null ? ` <b>${esc(r.count)}</b> ${esc(r.unit)}` : ''}</span>`).join('')
                    : '<span class="wsm-dim">Nothing has changed since the last save.</span>')
        }</div>
        <div class="wsm-cur-actions">
            <button type="button" class="toolbar-btn settings-io" data-wsm="save" style="border-color:var(--accent);">💾 Save</button>
            <button type="button" class="toolbar-btn settings-io" data-wsm="saveas">Save As…</button>
            <button type="button" class="toolbar-btn settings-io" data-wsm="duplicate">Duplicate…</button>
        </div>`;
}

async function renderFolder(ov, dir) {
    ov.querySelector('#wsmFolderPath').textContent = dir.name || 'Workspace folder';
    ov.querySelector('#wsmCards').innerHTML = '<div class="wsm-dim">Reading the folder…</div>';
    renderCards(ov, dir, await listWorkspaces(dir));
}

function renderCards(ov, dir, cards) {
    ov.__cards = cards;
    const host = ov.querySelector('#wsmCards');
    if (!dir) { host.innerHTML = '<div class="wsm-empty">Choose a folder to keep your workspaces in — then opening one is a click, not a file dialog.</div>'; return; }
    if (!cards.length) { host.innerHTML = '<div class="wsm-empty">No .ddcs workspaces in this folder yet. Save one here and it will show up.</div>'; return; }
    // An OS-style FILE PANEL (user): a bordered, scrollable list with a column header, not a card grid. The ENVELOPE
    // keeps the strongest column because that is what a machine is recognised by; the name leads the row because that
    // is what a file browser is.
    host.innerHTML =
        '<div class="wsm-fp">'
        + '<div class="wsm-fp-head"><span class="wsm-c-name">Name</span><span class="wsm-c-env">Envelope</span>'
        + '<span class="wsm-c-ctrl">Controller</span><span class="wsm-c-when">Saved</span></div>'
        + '<div class="wsm-fp-list">'
        + cards.map((c, i) => (c.invalid
            // a file it cannot open is still CLICKABLE — clicking it says why, instead of a row that ignores you
            ? `<button type="button" class="wsm-fp-row is-bad" data-wsm-open="${i}" title="${esc(c.reason || 'not a readable workspace')}">`
              + `<span class="wsm-c-name">${FILE_ICON}${esc(c.name)}</span>`
              + `<span class="wsm-c-env">—</span><span class="wsm-c-ctrl">cannot be opened</span><span class="wsm-c-when"></span></button>`
            : `<button type="button" class="wsm-fp-row" data-wsm-open="${i}" title="Open ${esc(c.name)}">`
              + `<span class="wsm-c-name">${FILE_ICON}${esc(c.name)}</span>`
              + `<span class="wsm-c-env">${esc(c.envelope || '—')}</span>`
              + `<span class="wsm-c-ctrl">${esc(c.dialect || 'unknown')}</span>`
              + `<span class="wsm-c-when">${c.savedAt ? esc(String(c.savedAt).slice(0, 10)) : ''}</span></button>`)).join('')
        + '</div></div>';
}

const FILE_ICON = '<svg class="wsm-fico" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">'
    + '<path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#2f6fd0"/>'
    + '<path d="M15 2l5 5h-5z" fill="#8fb6e8"/></svg>';

if (typeof window !== 'undefined') {
    window.openWorkspaceManager = openWorkspaceManager;
    window.ddcsConfirmDiscardBuffer = confirmDiscardBuffer;
}
