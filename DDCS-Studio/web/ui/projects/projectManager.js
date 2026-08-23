/**
 * ui/projects/projectManager.js — THE PROJECT MANAGER (t2190, user-ruled): the workspace-manager idiom, copied from
 * ui/wizardManager.js rather than invented — see scratchpad/t-projects-in-workspace.md.
 *
 * RULING (human, 2026-08-23): "the save and open should search the workspace not another location outside." A saved
 * program was ALREADY workspace content in the data model — data/backup.js's own BACKUP_STORES declares a `projects`
 * row beside `userOps` (wizards), and ui/projects/projectStore.js's volume is CLEARED-then-imported on every whole-
 * file open (t1225), so in practice it already holds exactly the open workspace's own projects. Only the UI disagreed,
 * presenting a Local/Cloud "volume" switcher that told a different, external-storage story. This file fixes the
 * story to match the data, replacing BOTH ui/libraryModal.js's openLibrary() (the old "Open" surface) and
 * ui/projects/projectModal.js's openSaveModal()/openOpenDrawer()/renderCloudInto() (the old "Save" surface and its
 * dead drawer) with the ONE modal wizardManager.js already proved:
 *
 *   TOP — THIS WORKSPACE: every saved program in the open .ddcs (name · folder · saved-when), with Open / Rename /
 *   Export / Delete per row, "+ New folder" and "Save current program" to add to it. Folders are KEPT (pre-existing
 *   projectStore.js capability; nothing here removes it) but rendered in the wizard manager's own row style, not the
 *   old file-explorer chrome.
 *
 *   BOTTOM — THE LIBRARY: standalone `.mjson` files on two shelves, the SAME two places the wizard/workspace managers
 *   use — the granted local folder (data/libraryFolder + ui/libraryShelf, reused whole via the declared `mjson` kind)
 *   and the Drive app folder (ui/cloud/googleDrive).
 *
 * THE DUALITY IS THE SAME RULE wizardManager.js states: the workspace EMBEDS (a project you saved is IN the
 * workspace); the library folders SHELVE standalone files; crossing is an EXPLICIT COPY — Export down, Import up.
 * Import writes the file into THIS workspace's own project list (a copy, not a live open) — opening it afterward is
 * a second, explicit click on its new row, exactly like installing an imported wizard before using it.
 *
 * t2190 (amendment 4) — THE ONE LINE THAT DIVIDES THE TWO ACTS, for projects AND wizards alike (wizardManager.js
 * carries the same line): everything inside the workspace is VIRTUAL — the "+ Folder" tree here is rooted at, and
 * confined to, the open workspace; the real OS filesystem is reachable ONLY through Export (writing out) and the
 * Library's Import (copying in). Save never sees a real folder or a Cloud destination; only Export does.
 */
import * as store from './projectStore.js';
import { loadProject } from '../../blocks/programFile.js';
import { writeLibraryFile, hasFSA } from '../../data/libraryFolder.js';
import { renderLibraryShelf } from '../libraryShelf.js';
import { dlgConfirm, dlgPrompt, dlgNotice } from '../dialog.js';
import { getAccount, connect, disconnect } from '../cloudAccount.js';
import { busyRow } from '../busyRow.js';
import { UIUtils } from '../uiUtils.js';
import { popReturn } from '../navReturn.js';   // t2192 — the return path (Settings' Workspace tab → here → back)

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const drive = () => import('../cloud/googleDrive.js');   // lazy, like the wizard/workspace managers' own drive()

const sanitize = (s) => (String(s || '').trim().replace(/[^A-Za-z0-9 _.-]+/g, '_').replace(/^\.+/, '') || 'untitled');

// ── the modal ────────────────────────────────────────────────────────────────────────────────────────────────────
let _ov = null;

/** Open the manager. `opts.promptSave` = true fires the "Save current program" prompt immediately (the file menu's
 *  own Save… row) — the same modal either way, since Save and Open are one surface now, like Wizards.
 *  `opts.returnToken` — t2192: a token from ui/navReturn.js's pushReturn(); when given, closing this manager
 *  (✕ / Esc / backdrop — all one `close()`) pops it and reopens whoever pushed it (e.g. Settings' Workspace tab)
 *  instead of just closing to the app. Opened from the file menu (no token), it closes to the app as before. */
export async function openProjectManager(opts = {}) {
    if (_ov) { _ov.remove(); _ov = null; }
    const returnToken = opts.returnToken;
    const ov = document.createElement('div');
    ov.id = 'projmOverlay';
    ov.className = 'wsm-overlay';   // the workspace/wizard managers' own chrome, deliberately — one design language
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="wsm-modal">
        <div class="wsm-head"><span class="wsm-title">Projects</span><button type="button" class="wsm-x" aria-label="Close">✕</button></div>
        <div class="wsm-body">
            <section id="projmMine"></section>
            <section class="wsm-folder">
                <div class="wizm-title">Library — standalone .mjson files (import is a copy into this workspace)</div>
                <div class="wsm-places" role="tablist" aria-label="Where shared projects live">
                    <button type="button" class="wsm-place is-active" data-place="local" role="tab">📁 Local folder</button>
                    <button type="button" class="wsm-place" data-place="cloud" role="tab">☁ Cloud</button>
                </div>
                <div id="projmShelf"></div>
            </section>
        </div>
    </div>`;
    document.body.appendChild(ov);
    _ov = ov;
    const close = () => {
        ov.remove(); if (_ov === ov) _ov = null; document.removeEventListener('keydown', onKey, true);
        if (returnToken != null) popReturn(returnToken);
    };
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.app-dialog')) { e.preventDefault(); close(); } };
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
    ov.querySelector('.wsm-x').addEventListener('click', close);

    ov.__cwd = '';
    ov.__place = 'local';
    ov.querySelector('.wsm-places').addEventListener('click', async (e) => {
        const t = e.target.closest('[data-place]');
        if (!t || t.dataset.place === ov.__place) return;
        ov.__place = t.dataset.place;
        ov.querySelectorAll('.wsm-place').forEach((b) => b.classList.toggle('is-active', b.dataset.place === ov.__place));
        await renderShelf(ov);
    });

    ov.__applyMine = async () => { await renderMine(ov); };
    ov.querySelector('.wsm-body').addEventListener('click', (e) => onMineClick(ov, e, close));

    await renderMine(ov);
    await renderShelf(ov);
    if (opts.promptSave) await saveCurrent(ov);
    return ov;
}

// ── THIS WORKSPACE — folders + saved programs, one flat list per folder ────────────────────────────────────────
async function renderMine(ov) {
    const host = ov.querySelector('#projmMine');
    const total = await store.countAll();
    const entries = await store.list(ov.__cwd);
    host.innerHTML = `<div class="wizm-title">This workspace — embedded in your .ddcs (${total || 'none yet'})</div>
        <div class="wizm-crumbrow">
            <span class="wizm-crumb" data-crumb></span>
            <span style="flex:1"></span>
            <button type="button" class="wizm-act" data-pm="mkdir" title="New folder here">+ Folder</button>
            <button type="button" class="wizm-act" data-pm="save" title="Save the current program into this folder">💾 Save current program</button>
        </div>`
        + (!entries.length
            ? '<div class="wsm-empty">No saved programs here yet. Save the current program, or Import one from the library below.</div>'
            : `<div class="wizm-list wizm-scroll">${entries.map((en) => {
                if (en.type === 'folder') {
                    return `<div class="wizm-row" data-frow="${esc(en.path)}">
                        <span class="wizm-ico">📁</span>
                        <button type="button" class="wizm-name" style="all:unset; cursor:pointer; flex:1 1 32%; min-width:0; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" data-pm="cd" data-path="${esc(en.path)}" title="Open folder">${esc(en.name)}</button>
                        <span class="wizm-prov"></span><span class="wizm-when"></span>
                        <span class="wizm-acts">
                            <button type="button" class="wizm-act" data-pm="ren" data-path="${esc(en.path)}" title="Rename">✎ Rename</button>
                            <button type="button" class="wizm-act is-danger" data-pm="del" data-path="${esc(en.path)}" title="Delete this folder and everything in it">🗑</button>
                        </span>
                    </div>`;
                }
                const when = en.savedAt ? String(en.savedAt).slice(0, 10) : '';
                return `<div class="wizm-row" data-prow="${esc(en.path)}">
                    <span class="wizm-ico">📄</span>
                    <span class="wizm-name" title="${esc(en.name)}">${esc(en.name)}</span>
                    <span class="wizm-prov"></span>
                    <span class="wizm-when">${esc(when)}</span>
                    <span class="wizm-acts">
                        <button type="button" class="wizm-act" data-pm="open" data-path="${esc(en.path)}" title="Open this program (replaces the current one)">▶ Open</button>
                        <button type="button" class="wizm-act" data-pm="ren" data-path="${esc(en.path)}" title="Rename">✎ Rename</button>
                        <button type="button" class="wizm-act" data-pm="export" data-path="${esc(en.path)}" title="Copy it onto the library shelf below (the active tab decides which shelf)">⬇ Export</button>
                        <button type="button" class="wizm-act is-danger" data-pm="del" data-path="${esc(en.path)}" title="Delete">🗑</button>
                    </span>
                </div>`;
            }).join('')}</div>`);
    const crumbEl = host.querySelector('[data-crumb]');
    const mk = (label, path) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'wizm-crumb-link'; b.textContent = label; b.dataset.pm = 'cd'; b.dataset.path = path; return b; };
    crumbEl.replaceChildren(mk('This workspace', ''));
    let acc = '';
    (ov.__cwd ? ov.__cwd.split('/') : []).forEach((p) => { acc = acc ? acc + '/' + p : p; crumbEl.append(document.createTextNode(' / '), mk(p, acc)); });
}

async function onMineClick(ov, e, close) {
    const t = e.target.closest('[data-pm]');
    if (!t) return;
    const act = t.dataset.pm, path = t.dataset.path || '';
    try {
        if (act === 'cd') { ov.__cwd = path; await renderMine(ov); return; }
        if (act === 'mkdir') {
            const name = await dlgPrompt('New folder name:');
            if (!name) return;
            await store.mkdir(store.joinPath(ov.__cwd, sanitize(name)));
            await renderMine(ov);
            return;
        }
        if (act === 'save') { await saveCurrent(ov); return; }
        if (act === 'ren') {
            const cur = store.baseName(path);
            const name = await dlgPrompt('Rename to:', cur);
            if (!name || sanitize(name) === cur) return;
            await store.rename(path, store.joinPath(store.parentOf(path), sanitize(name)));
            await renderMine(ov);
            return;
        }
        if (act === 'del') {
            const isFolder = !!t.closest('[data-frow]');
            const label = store.baseName(path);
            const msg = isFolder ? `Delete folder "${label}" and everything in it? This can't be undone.` : `Delete "${label}"? This can't be undone.`;
            if (!(await dlgConfirm(msg, { danger: true, okLabel: 'Delete' }))) return;
            await store.remove(path);
            await renderMine(ov);
            return;
        }
        if (act === 'open') {
            const row = t.closest('[data-prow]');
            await busyRow(row, async () => {
                const obj = await store.readProject(path);
                if (!obj) { dlgNotice('That project could not be read.'); return; }
                const loaded = await loadProject(obj);
                if (loaded) close();
            }, { keepOnSuccess: false });
            return;
        }
        if (act === 'export') { await exportToActiveShelf(ov, path); return; }
    } catch (err) { dlgNotice((act === 'open' ? 'Open' : 'Action') + ' failed: ' + ((err && err.message) || err)); }
}

/** Save the CURRENT program into the workspace, in the manager's own current folder — one prompt, like a wizard
 *  Duplicate/Fork, not a separate modal (t2190 — Save and Open are one surface now). */
async function saveCurrent(ov) {
    const stack = (typeof window !== 'undefined' && window.ddcsGetBlockProgram) ? (window.ddcsGetBlockProgram() || []) : [];
    if (!stack.length) { dlgNotice('Nothing to save — build a program first.'); return; }
    const name = await dlgPrompt('Save current program as:', 'macro');
    if (!name || !name.trim()) return;
    const { serializeProject } = await import('../../blocks/programFile.js');
    const data = serializeProject(sanitize(name));
    await store.saveProject(store.joinPath(ov.__cwd, sanitize(name)), data);
    await renderMine(ov);
}

// ── THE LIBRARY — two shelves, the wizard/workspace managers' two places ───────────────────────────────────────
async function renderShelf(ov) {
    const token = (ov.__renderSeq = (ov.__renderSeq || 0) + 1);
    const stale = () => ov.__renderSeq !== token;
    const host = ov.querySelector('#projmShelf');
    if (ov.__place === 'cloud') { await renderCloudShelf(ov, host, stale); return; }
    await renderLibraryShelf(host, {
        kindKey: 'mjson',
        describe: (e) => {
            const op = e.obj || {};
            const n = Array.isArray(op.stack) ? op.stack.length : 0;
            return `${n} op${n === 1 ? '' : 's'}${op.post ? ' · ' + op.post : ''}`;
        },
        emptyHint: 'Export one of your saved programs above and it lands here.',
        onImport: async (e) => { if (await importIntoWorkspace(ov, e.obj, e.stem)) await ov.__applyMine(); },
    });
}

/** IMPORT — a copy INTO the workspace's own project list (not an immediate open, matching the wizard duality:
 *  crossing UP installs it here; opening it afterward is a second, explicit click on the row). */
async function importIntoWorkspace(ov, obj, stem) {
    if (!obj || (obj.kind !== 'ddcs.macro' && obj.kind !== 'ddcs.project') || !Array.isArray(obj.stack)) {
        dlgNotice(`"${stem}" is not a saved-program file this version understands.`);
        return false;
    }
    const name = sanitize(obj.name || stem);
    const path = store.joinPath(ov.__cwd, name);
    const existing = await store.readProject(path);
    if (existing) {
        const ok = await dlgConfirm(`"${name}" is already in this workspace, in this folder.\n\nReplace it with the file's copy?`, { okLabel: 'Replace', danger: true });
        if (!ok) return false;
    }
    await store.saveProject(path, obj);
    dlgNotice(`"${name}" is in this workspace now — open it from the list above.`);
    return true;
}

async function renderCloudShelf(ov, host, stale = () => false) {
    const acc = getAccount();
    if (!acc.connected || acc.provider !== 'google') {
        host.innerHTML = '<div class="wsm-empty">Keep shared programs in your own Google Drive too — the same app folder your cloud workspaces use.'
            + '<div style="margin-top:10px"><button type="button" class="toolbar-btn settings-io" id="projmCloudSignIn">☁ Sign in to Google Drive</button></div></div>';
        host.querySelector('#projmCloudSignIn').addEventListener('click', async () => {
            try { await connect('google'); } catch (_) { /* the shared flow reports its own failures */ }
            const done = () => { window.removeEventListener('ddcs:cloud-account', done); renderShelf(ov); };
            window.addEventListener('ddcs:cloud-account', done);
            setTimeout(() => { window.removeEventListener('ddcs:cloud-account', done); if (getAccount().connected) renderShelf(ov); }, 15000);
        });
        return;
    }
    host.innerHTML = '<div class="wsm-dim">Reading your Drive…</div>';
    let files = [];
    try {
        const d = await drive();
        const root = await d.ensureRoot();
        files = (await d.list(root)).filter((f) => f.type !== 'folder' && /\.mjson$/i.test(f.name)).slice(0, 60)
            .sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
        if (stale()) return;
        const why = /cloud-auth/.test(String(e && e.message)) ? 'Your Google sign-in has expired.' : `Drive could not be reached (${(e && e.message) || e}).`;
        host.innerHTML = `<div class="wsm-empty">${esc(why)} Your local shelf is unaffected — switch back to <b>Local folder</b>, or sign in again.`
            + '<div style="margin-top:10px"><button type="button" class="toolbar-btn settings-io" id="projmCloudSignIn">Sign in to Google Drive</button></div></div>';
        const b = host.querySelector('#projmCloudSignIn');
        if (b) b.addEventListener('click', () => renderShelf(ov));
        return;
    }
    if (stale()) return;
    ov.__cloudFiles = files;
    host.innerHTML =
        `<div class="wsm-cloudbar"><span class="wsm-dim">Signed in as</span> <b>${esc(acc.email || acc.name || 'your Google account')}</b>`
        + '<button type="button" class="wss-link" id="projmCloudOut">Sign out</button></div>'
        + (!files.length
            ? '<div class="wsm-empty">No .mjson files in your Drive app folder yet. Export a saved program while this tab is open and it will show up here.</div>'
            : `<div class="wsm-fp"><div class="wsm-fp-head"><span class="wsm-c-name">Name</span><span class="wsm-c-when">Saved</span></div>
                <div class="wsm-fp-list">${files.map((f, i) => `<div class="wsm-fp-row">
                    <button type="button" class="wsm-fp-open" data-pm-cloud="${i}" title="Import ${esc(f.name)} into this workspace (a copy, not a link)">
                        <span class="wsm-c-name">${esc(f.name)}</span>
                        <span class="wsm-c-when">${f.savedAt ? esc(String(f.savedAt).slice(0, 10)) : ''}</span>
                    </button>
                    <button type="button" class="wsm-fp-del" data-pm-trash="${i}" title="Move ${esc(f.name)} to your Drive trash" aria-label="Trash ${esc(f.name)}">🗑</button>
                </div>`).join('')}</div></div>`);
    host.querySelector('#projmCloudOut').addEventListener('click', async () => { disconnect(); await renderShelf(ov); });
    if (host.__pmCloudBound) return;
    host.__pmCloudBound = true;
    host.addEventListener('click', async (e) => {
        const del = e.target.closest('[data-pm-trash]');
        if (del) {
            const f = (ov.__cloudFiles || [])[Number(del.dataset.pmTrash)];
            if (!f) return;
            if (!(await dlgConfirm(`Move "${f.name}" to your Google Drive trash?\n\nDrive keeps trashed files for about 30 days, so you can restore it there.`, { danger: true, okLabel: 'Move to trash' }))) return;
            try { await (await drive()).trash(f.id); } catch (err) { dlgNotice(`"${f.name}" could not be trashed: ${(err && err.message) || err}`); return; }
            await renderShelf(ov);
            return;
        }
        const open = e.target.closest('[data-pm-cloud]');
        if (!open) return;
        const f = (ov.__cloudFiles || [])[Number(open.dataset.pmCloud)];
        if (!f) return;
        try {
            const obj = await (await drive()).read(f.id);
            if (await importIntoWorkspace(ov, obj, f.name.replace(/\.mjson$/i, ''))) await ov.__applyMine();
        } catch (err) { dlgNotice(`"${f.name}" could not be read from Drive: ${(err && err.message) || err}`); }
    });
}

/** EXPORT — the crossing DOWN, an explicit copy onto whichever shelf is showing (the wizard manager's own "the
 *  active tab is where a save goes" rule). */
async function exportToActiveShelf(ov, path) {
    const obj = await store.readProject(path);
    if (!obj) return;
    const stem = store.baseName(path) || 'macro';
    const text = JSON.stringify(obj, null, 2);
    if (ov.__place === 'cloud') {
        if (!getAccount().connected) { dlgNotice('Sign in on the Cloud tab first — the export writes into your Drive app folder.'); return; }
        try {
            const dr = await drive();
            const root = await dr.ensureRoot();
            const name = `${stem.replace(/[\/:*?"<>|]/g, '-')}.mjson`;
            const existing = (await dr.list(root)).find((f) => f.type !== 'folder' && f.name === name);
            if (existing && !(await dlgConfirm(`"${name}" already exists in your Drive app folder. Replace it?`, { okLabel: 'Replace' }))) return;
            await dr.write(name, obj, root);
            dlgNotice(`Saved "${name}" to your Drive app folder — it is on the shelf below.`);
        } catch (e) { dlgNotice('Could not write to Drive: ' + ((e && e.message) || e)); return; }
        await renderShelf(ov);
        return;
    }
    if (!hasFSA()) {
        // NOT downloadMacro() — that re-serializes the LIVE editor program, and this row may be a different,
        // stored one. Download the STORED object read above, the same way writeLibraryFile below writes it.
        UIUtils.downloadFile(`${stem}.mjson`, text);
        dlgNotice(`This browser cannot grant a folder, so "${stem}.mjson" was downloaded instead.`);
        return;
    }
    const r = await writeLibraryFile(stem, 'mjson', text, {
        confirmReplace: (name, where) => dlgConfirm(`"${name}" already exists in ${where}. Replace it?`, { okLabel: 'Replace' }),
    });
    if (r.ok) { dlgNotice(`Saved "${r.name}" to your library folder — it is on the shelf below.`); await renderShelf(ov); }
    else if (!r.aborted) dlgNotice(`Could not write the .mjson file: ${r.error}`);
}

if (typeof window !== 'undefined') {
    window.openProjectManager = openProjectManager;
}
