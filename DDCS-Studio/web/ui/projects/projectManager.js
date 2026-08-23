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
 *   BOTTOM — a plain Import button (a native file picker), not a browsable shelf.
 *
 * t2194 (human, mirroring the same removal in ui/wizardManager.js) — THE STANDALONE .mjson LIBRARY SHELF THIS
 * SECTION USED TO BE IS RETIRED, for the same three reasons that file's header now carries in full: it
 * misrepresented itself as a second container for your projects, "unimported" is a moment not a place, and the
 * OS file browser already does the browsing better than a one-extension shelf ever could. EXPORT SURVIVES
 * UNTOUCHED — a local file or Drive is still a legitimate crossing OUT of the workspace; only the browse-then-
 * import-from-a-remembered-folder half is gone, replaced by a plain OS file dialog.
 *
 * THE DUALITY IS THE SAME RULE wizardManager.js states: the workspace EMBEDS (a project you saved is IN the
 * workspace); crossing is an EXPLICIT COPY — Export down, Import up. Import writes the file into THIS workspace's
 * own project list (a copy, not a live open) — opening it afterward is a second, explicit click on its new row,
 * exactly like installing an imported wizard before using it.
 *
 * t2190 (amendment 4) — THE ONE LINE THAT DIVIDES THE TWO ACTS, for projects AND wizards alike (wizardManager.js
 * carries the same line): everything inside the workspace is VIRTUAL — the "+ Folder" tree here is rooted at, and
 * confined to, the open workspace; the real OS filesystem is reachable ONLY through Export (writing out) and
 * Import (copying in, now a plain file picker rather than a shelf). Save never sees a real folder or a Cloud
 * destination; only Export does.
 */
import * as store from './projectStore.js';
import { loadProject } from '../../blocks/programFile.js';
import { writeLibraryFile, hasFSA } from '../../data/libraryFolder.js';
import { friendlySource } from '../../blocks/wizardLibrary.js';
import { dlgConfirm, dlgPrompt, dlgNotice, dlgChoice } from '../dialog.js';
import { getAccount } from '../cloudAccount.js';
import { busyRow } from '../busyRow.js';
import { UIUtils } from '../uiUtils.js';
import { popReturn } from '../navReturn.js';   // t2192 — the return path (Settings' Workspace tab → here → back)
import { buildImportSummary, collectOpTypes, profileName } from '../importCompat.js';   // t2196 amendment 3 — the shared confirm-on-import summary

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
                <button type="button" class="toolbar-btn settings-io" data-pm="importfile">⬆ Import .mjson file…</button>
                <input type="file" accept=".mjson,application/json" id="projmImportInput" style="display:none">
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
    ov.__applyMine = async () => { await renderMine(ov); };
    ov.querySelector('.wsm-body').addEventListener('click', (e) => onMineClick(ov, e, close));

    const fileInput = ov.querySelector('#projmImportInput');
    fileInput.addEventListener('change', async () => {
        const f = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (!f) return;
        const text = await f.text();
        let obj = null;
        try { obj = JSON.parse(text); } catch (e) { dlgNotice(`"${f.name}" is not valid JSON.`); return; }
        if (await importIntoWorkspace(ov, obj, f.name.replace(/\.mjson$/i, ''), text)) await ov.__applyMine();
    });

    await renderMine(ov);
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
            ? '<div class="wsm-empty">No saved programs here yet. Save the current program, or import a .mjson file below.</div>'
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
                        <button type="button" class="wizm-act" data-pm="export" data-path="${esc(en.path)}" title="Export it to a .mjson file or your Drive">⬇ Export</button>
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
        if (act === 'importfile') { ov.querySelector('#projmImportInput').click(); return; }
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
        if (act === 'export') { await exportProjectFile(path); return; }
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

/**
 * IMPORT — a copy INTO the workspace's own project list (not an immediate open, matching the wizard duality:
 * crossing UP installs it here; opening it afterward is a second, explicit click on the row). t2196 amendment 3 —
 * one confirm-on-import summary (collision, wrong machine/axes across the WHOLE stack, wrong dialect via the
 * bundle's own `post` field, the #-variables it uses as a listed fact, what it makes, and where it was authored),
 * sharing ui/importCompat.js's builder with wizardManager.js's own import rather than a second implementation.
 */
async function importIntoWorkspace(ov, obj, stem, rawText = '') {
    if (!obj || (obj.kind !== 'ddcs.macro' && obj.kind !== 'ddcs.project') || !Array.isArray(obj.stack)) {
        dlgNotice(`"${stem}" is not a saved-program file this version understands.`);
        return false;
    }
    const name = sanitize(obj.name || stem);
    const path = store.joinPath(ov.__cwd, name);
    const existing = await store.readProject(path);
    const opTypes = collectOpTypes(obj.stack);
    const makes = [...new Set(opTypes.map((t) => friendlySource(t)))];
    const summary = buildImportSummary({
        name: obj.name || stem,
        existing: existing ? name : null,
        opTypes,
        post: obj.post || null,
        rawText: rawText || JSON.stringify(obj),
        whatItMakes: makes.join(', '),
        provenance: obj.profile ? `Saved on a ${profileName(obj.profile)} workspace` : '',
    });
    const ok = await dlgConfirm(summary.body, { title: summary.title, okLabel: existing ? 'Replace' : 'Import', danger: summary.hasWarning || !!existing });
    if (!ok) return false;
    await store.saveProject(path, obj);
    dlgNotice(`"${name}" is in this workspace now — open it from the list above.`);
    return true;
}

/**
 * EXPORT — the crossing DOWN, a copy leaving the workspace (t2194 — no more shelf to land on; the destination is
 * asked for directly, once, only when there is a real choice to make). Both write paths are UNCHANGED from
 * before the shelf's removal — only the "which one" question moved from a persistent tab to a one-shot ask.
 */
async function exportProjectFile(path) {
    const obj = await store.readProject(path);
    if (!obj) return;
    const stem = store.baseName(path) || 'macro';
    const text = JSON.stringify(obj, null, 2);

    let target = 'local';
    if (getAccount().connected) {
        target = await dlgChoice(`Export "${stem}" to:`, [
            { key: 'local', label: '📁 Local file', primary: true },
            { key: 'cloud', label: '☁ Cloud' },
            { key: 'cancel', label: 'Cancel' },
        ], { cancelKey: 'cancel' });
        if (target === 'cancel') return;
    }

    if (target === 'cloud') {
        try {
            const dr = await drive();
            const root = await dr.ensureRoot();
            const name = `${stem.replace(/[\/:*?"<>|]/g, '-')}.mjson`;
            const existing = (await dr.list(root)).find((f) => f.type !== 'folder' && f.name === name);
            if (existing && !(await dlgConfirm(`"${name}" already exists in your Drive app folder. Replace it?`, { okLabel: 'Replace' }))) return;
            await dr.write(name, obj, root);
            dlgNotice(`Saved "${name}" to your Drive app folder.`);
        } catch (e) { dlgNotice('Could not write to Drive: ' + ((e && e.message) || e)); }
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
    if (r.ok) dlgNotice(`Saved "${r.name}" to your library folder.`);
    else if (!r.aborted) dlgNotice(`Could not write the .mjson file: ${r.error}`);
}

if (typeof window !== 'undefined') {
    window.openProjectManager = openProjectManager;
}
