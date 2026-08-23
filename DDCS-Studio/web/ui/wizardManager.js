/**
 * ui/wizardManager.js — THE WIZARD MANAGER (t1617, user-ruled): the workspace-manager idiom over the wizard registry.
 *
 * ONE modal for everything you do to a wizard's LIFECYCLE — distinct from the Settings bar-designer (which arranges
 * wizards ON the bar) and from Blocks Dev mode (which authors a wizard's CONTENT). Two halves, like the workspace
 * manager it copies:
 *
 *   TOP — THIS WORKSPACE: your custom wizards (name · provenance · saved-when) with Rename / Duplicate / Export /
 *   Delete, then the BUILT-INS listed read-only with FORK as their one action — the not-editable-but-forkable model
 *   made visible instead of implied.
 *
 *   BOTTOM — THE LIBRARY: standalone `.wiz` files on two shelves, the SAME two places the workspace manager proved —
 *   the granted local folder (data/libraryFolder + ui/libraryShelf, reused whole) and the Drive app folder
 *   (ui/cloud/googleDrive, the same ensureRoot/list/read/write/trash the cloud workspaces ride).
 *
 * THE DUALITY IS RULED, permanently: the workspace EMBEDS (a wizard used by the workspace is IN the workspace — the
 * .ddcs is self-contained and authoritative); the library folders SHELVE standalone files; crossing is an EXPLICIT
 * COPY — Export down, Import up. NO references, NO auto-sync, ever: a dangling reference is a broken machine-file by
 * construction. "Also in library" may be SHOWN (a content match against the shelf), never acted on automatically.
 * NO update-from-source in v1 — `forkedFrom` is displayed provenance; merging a built-in's changes into a fork is a
 * real merge problem deliberately out of scope.
 *
 * FORK is one-source with the Blocks route (t1075/t1593): the template goes through the SAME wrapRecognizedForFork
 * and the declarations through the SAME forkInheritance the Customize→Save path uses — minus the canvas, which the
 * parity spec proved adds nothing to an untouched fork.
 *
 * t2190 (amendment 4, confirmed already true here, generalising the rule to ui/projects/projectManager.js too) —
 * everything inside the workspace is VIRTUAL; the real OS filesystem is reachable ONLY through Export (writing
 * out) and the Library's Import (copying in). This section (THIS WORKSPACE) never offers a Cloud destination of
 * its own — only the LIBRARY tabs below do, because standalone .wiz files are the one place Cloud legitimately
 * belongs (outside the workspace boundary).
 */
import {
    listEntries, exportWizard, importWizard, wizardFromFile, deleteWizard, builtinLabelForTwin, setEntryOverride,
} from '../blocks/wizardLibrary.js';
import { listUserOps, createUserOp, updateUserOp, forkInheritance, USER_OP_PREFIX } from '../blocks/userOps.js';
import { writeLibraryFile, hasFSA } from '../data/libraryFolder.js';
import { renderLibraryShelf } from './libraryShelf.js';
import { dlgConfirm, dlgPrompt, dlgNotice } from './dialog.js';
import { getAccount, connect, disconnect } from './cloudAccount.js';
import { entryIconHtml } from './wizIcons.js';
import { UIUtils } from './uiUtils.js';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// LAZY, like the workspace manager's drive() — the Drive adapter (and devMode's fork wrap) load on first use, not at boot.
const drive = () => import('./cloud/googleDrive.js');

// ── the registry reads (one place, so every render answers from the same source) ────────────────────────────────
/** The PERSISTED def for an opType — JSON-safe (the live registry's def can carry re-attached function fields). */
const storedDef = (opType) => listUserOps().find((d) => d.opType === opType) || null;
const copy = (v) => JSON.parse(JSON.stringify(v));

/** A source opType, named for a human: a twin resolves to its built-in label ("Corner"), a user op to its label. */
function friendlySource(opType) {
    return builtinLabelForTwin(opType) || (storedDef(opType) || {}).label || opType;
}

/** A unique user opType from a display name — the SAME slug rule the Blocks save dialog uses (one behaviour). */
function uniqueOpType(name) {
    const slug = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'wizard';
    const existing = new Set(listUserOps().map((d) => d.opType));
    let t = slug, n = 2;
    while (existing.has(USER_OP_PREFIX + t)) t = slug + '_' + (n++);
    return USER_OP_PREFIX + t;
}

/**
 * THE ONE COPY MECHANISM — Fork (of a built-in's twin) and Duplicate (of a custom) are the same act: a deep copy of
 * the PERSISTED def under a new identity. What differs is only provenance: a fork RECORDS its source (`forkedFrom` —
 * what re-attaches the source's code hooks on the other side of a share); a duplicate KEEPS the def's existing
 * provenance verbatim (a copy of a fork is still a fork of the same source — pointing it at the intermediate copy
 * would break the one-step hook lookup). `defV`/`savedAt` are dropped so the copy starts fresh at v1, today.
 */
function copyDef(src, opType, label) {
    const d = copy(src);
    d.opType = opType;
    d.label = label;
    delete d.defV;
    delete d.savedAt;
    return d;
}

async function forkBuiltin(entry) {
    const srcType = entry.opensAs;
    const src = srcType && storedDef(srcType);
    if (!src) { dlgNotice(`“${entry.label}” has no data twin to fork yet.`); return false; }
    const name = await dlgPrompt(`Name for your editable copy of “${entry.label}”:`, `${entry.label} fork`);
    if (!name || !name.trim()) return false;
    // ONE-SOURCE with the Blocks fork route: the same opunit wrap (recognized generator twins stay LIVE in CAM) and
    // the same declaration inheritance (bindings remapped across the wrap, bindingSpecs + forkedFrom riding whole).
    const { wrapRecognizedForFork } = await import('../blocks/devMode.js');
    const { template } = wrapRecognizedForFork(src);
    const d = copyDef(src, uniqueOpType(name), name.trim());
    d.template = template;
    const inherited = forkInheritance(src, template);
    if (inherited) {
        d.bindings = inherited.bindings;
        if (inherited.bindingSpecs) d.bindingSpecs = inherited.bindingSpecs;
    }
    d.forkedFrom = srcType;
    try { createUserOp(d); } catch (e) { dlgNotice('Fork failed: ' + ((e && e.message) || e)); return false; }
    return true;
}

async function duplicateWizard(opType) {
    const src = storedDef(opType);
    if (!src) return false;
    const name = await dlgPrompt('Name for the copy:', `${src.label || opType} copy`);
    if (!name || !name.trim()) return false;
    const d = copyDef(src, uniqueOpType(name), name.trim());
    try { createUserOp(d); } catch (e) { dlgNotice('Duplicate failed: ' + ((e && e.message) || e)); return false; }
    return true;
}

async function renameWizard(opType) {
    const src = storedDef(opType);
    if (!src) return false;
    const name = await dlgPrompt('Rename this wizard:', src.label || opType);
    if (!name || !name.trim() || name.trim() === src.label) return false;
    const d = copy(src);
    d.label = name.trim();
    d.savedAt = new Date().toISOString();   // a rename IS a save — declared HERE (updateUserOp preserves when undeclared)
    updateUserOp(d);   // defV is declared on the stored def → respected as-is: a rename does not stale placed instances
    // ONE-NAME: a bar-designer label override would keep showing the OLD name over the renamed def — clear it so the
    // def (the source) is what every surface shows.
    setEntryOverride(opType, { label: undefined });
    return true;
}

/**
 * IMPORT — one path for both shelves. The proven importer (wizardLibrary.importWizard: hooks manifest, named
 * outcome) does the work; the only thing added here is the collision answer, and it is an EXPLICIT COPY question:
 * the same wizard already embedded in this workspace is replaced only when the user says so, never merged.
 */
async function importText(text, sourceName) {
    const file = wizardFromFile(text);
    if (!file) { dlgNotice(`“${sourceName}” is not a wizard file this version understands.`); return false; }
    const existing = listUserOps().find((d) => d.opType === file.opType);
    if (existing) {
        const ok = await dlgConfirm(
            `“${existing.label || file.opType}” is already in this workspace.\n\nReplace it with the file's copy? The embedded one is overwritten — this is a copy, not a link.`,
            { okLabel: 'Replace', danger: true },
        );
        if (!ok) return false;
        deleteWizard(file.opType);   // then the one import path below installs the file's copy
    }
    let def = null;
    try { def = importWizard(text); } catch (e) { dlgNotice('Import failed: ' + ((e && e.message) || e)); return false; }
    if (!def) { dlgNotice(`“${sourceName}” is not a wizard file this version understands.`); return false; }
    dlgNotice(`“${def.label || def.opType}” is in this workspace now — on your bar, editable in Blocks.${def.importNote ? ' ' + def.importNote : ''}`);
    return true;
}

// ── the modal ────────────────────────────────────────────────────────────────────────────────────────────────────
let _ov = null;

/** Open the manager. `opts.place` = 'local' | 'cloud' — which library shelf to land on (default local). */
export async function openWizardManager(opts = {}) {
    if (_ov) { _ov.remove(); _ov = null; }
    const place0 = opts.place === 'cloud' ? 'cloud' : 'local';
    const ov = document.createElement('div');
    ov.id = 'wizmOverlay';
    ov.className = 'wsm-overlay';   // the workspace manager's chrome, deliberately — one design language, one CSS
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="wsm-modal">
        <div class="wsm-head"><span class="wsm-title">Wizards</span><button type="button" class="wsm-x" aria-label="Close">✕</button></div>
        <div class="wsm-body">
            <section id="wizmMine"></section>
            <section id="wizmBuiltins"></section>
            <section class="wsm-folder">
                <div class="wizm-title">Library — standalone .wiz files (import is a copy into this workspace)</div>
                <div class="wsm-places" role="tablist" aria-label="Where shared wizards live">
                    <button type="button" class="wsm-place${place0 === 'cloud' ? '' : ' is-active'}" data-place="local" role="tab">📁 Local folder</button>
                    <button type="button" class="wsm-place${place0 === 'cloud' ? ' is-active' : ''}" data-place="cloud" role="tab">☁ Cloud</button>
                </div>
                <div id="wizmShelf"></div>
            </section>
        </div>
    </div>`;
    document.body.appendChild(ov);
    _ov = ov;
    const close = () => { ov.remove(); if (_ov === ov) _ov = null; document.removeEventListener('keydown', onKey, true); };
    // Escape closes the MANAGER — unless an app-dialog (rename prompt / replace confirm) is up: both listen on
    // document in capture, so the dialog's stopPropagation cannot shield this one, and without the guard one
    // Escape cancelled the prompt AND took the whole manager with it (caught by the collision spec's Cancel arm).
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.app-dialog')) { e.preventDefault(); close(); } };
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
    ov.querySelector('.wsm-x').addEventListener('click', close);

    ov.__place = place0;
    ov.querySelector('.wsm-places').addEventListener('click', async (e) => {
        const t = e.target.closest('[data-place]');
        if (!t || t.dataset.place === ov.__place) return;
        ov.__place = t.dataset.place;
        ov.querySelectorAll('.wsm-place').forEach((b) => b.classList.toggle('is-active', b.dataset.place === ov.__place));
        await renderPlace(ov);
    });

    // ONE delegated handler for the two registry sections (they re-render after every mutation).
    const applyRegistry = async () => {
        renderMine(ov);
        renderBuiltins(ov);
        if (window.ddcsRefreshWizardBar) window.ddcsRefreshWizardBar();
        fillLibraryChips(ov);
    };
    ov.__applyRegistry = applyRegistry;
    ov.querySelector('.wsm-body').addEventListener('click', async (e) => {
        const act = e.target.closest('[data-wizm]');
        if (!act) return;
        const kind = act.dataset.wizm, opType = act.dataset.op;
        if (kind === 'fork') {
            const entry = (ov.__builtins || []).find((b) => b.id === act.dataset.id);
            if (entry && await forkBuiltin(entry)) { await applyRegistry(); }
            return;
        }
        if (kind === 'rename') { if (await renameWizard(opType)) await applyRegistry(); return; }
        if (kind === 'dup') { if (await duplicateWizard(opType)) await applyRegistry(); return; }
        if (kind === 'del') {
            const d = storedDef(opType);
            if (!d) return;
            if (await dlgConfirm(`Delete “${d.label || opType}” from this workspace?\n\nA copy exported to the library stays on its shelf; the embedded wizard is what dies.`, { danger: true, okLabel: 'Delete' })) {
                deleteWizard(opType);
                await applyRegistry();
            }
            return;
        }
        if (kind === 'export') { await exportToActiveShelf(ov, opType); return; }
    });

    renderMine(ov);
    renderBuiltins(ov);
    await renderPlace(ov);
    return ov;
}

// ── THIS WORKSPACE — the custom wizards ─────────────────────────────────────────────────────────────────────────
function renderMine(ov) {
    const host = ov.querySelector('#wizmMine');
    const mine = listEntries().filter((e) => e.kind === 'user');
    ov.__mine = mine;
    host.innerHTML = `<div class="wizm-title">This workspace — embedded in your .ddcs (${mine.length || 'none yet'})</div>`
        + (!mine.length
            ? '<div class="wsm-empty">No custom wizards in this workspace yet. Fork a built-in below, import one from the library, or save a stack from the Blocks tab.</div>'
            : `<div class="wizm-list wizm-scroll">${mine.map((e) => {
                const d = e.def || storedDef(e.type) || {};
                const prov = d.forkedFrom ? `fork of ${friendlySource(d.forkedFrom)}` : 'yours';
                const when = d.savedAt ? String(d.savedAt).slice(0, 10) : '';
                return `<div class="wizm-row" data-row="${esc(e.type)}">
                    <span class="wizm-ico">${entryIconHtml(e) || '✦'}</span>
                    <span class="wizm-name" title="${esc(d.label || e.label)}">${esc(d.label || e.label)}</span>
                    <span class="wizm-chip wizm-inlib" hidden title="A content-identical copy is on the library shelf below (shown only — never synced).">· in library</span>
                    <span class="wizm-prov" title="${d.forkedFrom ? esc('forked from ' + d.forkedFrom) : 'authored in this workspace'}">${esc(prov)}</span>
                    <span class="wizm-when">${esc(when)}</span>
                    <span class="wizm-acts">
                        <button type="button" class="wizm-act" data-wizm="rename" data-op="${esc(e.type)}" title="Rename this wizard (the name every surface shows)">✎ Rename</button>
                        <button type="button" class="wizm-act" data-wizm="dup" data-op="${esc(e.type)}" title="Duplicate it inside this workspace">⧉ Duplicate</button>
                        <button type="button" class="wizm-act" data-wizm="export" data-op="${esc(e.type)}" title="Copy it onto the library shelf below (the active tab decides which shelf)">⬇ Export</button>
                        <button type="button" class="wizm-act is-danger" data-wizm="del" data-op="${esc(e.type)}" title="Delete it from this workspace (library copies stay)">🗑</button>
                    </span>
                </div>`;
            }).join('')}</div>`);
}

// ── BUILT-INS — read-only, fork is the one action ───────────────────────────────────────────────────────────────
function renderBuiltins(ov) {
    const host = ov.querySelector('#wizmBuiltins');
    const builtins = listEntries().filter((e) => e.kind === 'builtin');
    ov.__builtins = builtins;
    host.innerHTML = `<div class="wizm-title">Built-ins — read-only; fork one to make it yours</div>
        <div class="wizm-list wizm-scroll">${builtins.map((e) => `<div class="wizm-row" data-brow="${esc(e.id)}">
            <span class="wizm-ico">${entryIconHtml(e) || '✦'}</span>
            <span class="wizm-name">${esc(e.label)}</span>
            <span class="wizm-badge">BUILT-IN</span>
            <span class="wizm-prov"></span>
            <span class="wizm-acts">
                <button type="button" class="wizm-act" data-wizm="fork" data-id="${esc(e.id)}"${e.opensAs ? '' : ' disabled title="This built-in has no data twin to fork yet."'}${e.opensAs ? ` title="Make an editable copy of ${esc(e.label)} in this workspace"` : ''}>⑂ Fork</button>
            </span>
        </div>`).join('')}</div>`;
}

// ── THE LIBRARY — two shelves, the workspace manager's two places ───────────────────────────────────────────────
async function renderPlace(ov) {
    // the workspace manager's stale-render guard, for the same reason: both shelves await, and the slower older
    // render must never paint over (or hand its rows to) the newer one.
    const token = (ov.__renderSeq = (ov.__renderSeq || 0) + 1);
    const stale = () => ov.__renderSeq !== token;
    const host = ov.querySelector('#wizmShelf');
    if (ov.__place === 'cloud') { await renderCloudShelf(ov, host, stale); return; }
    await renderLibraryShelf(host, {
        kindKey: 'wiz',
        describe: (e) => {
            const op = (e.obj && e.obj.op) || {};
            const n = (op.bindings || []).length;
            // NOT esc()'d here — the shelf escapes its describe output itself
            return `${op.label ? op.label + ' · ' : ''}${n} field${n === 1 ? '' : 's'}${op.forkedFrom ? ' · fork' : ''}`;
        },
        emptyHint: 'Export one of your wizards above and it lands here.',
        onImport: async (e) => { if (await importText(e.text, e.name)) await ov.__applyRegistry(); },
    });
    if (stale()) return;
    fillLibraryChips(ov);
}

/**
 * "ALSO IN LIBRARY" — SHOWN, never acted on (the ruled duality). A workspace row gets the quiet chip when a shelf
 * file's op content is IDENTICAL to what this wizard would export right now — a content match, not a reference:
 * rename either side and the chip simply goes out.
 */
function fillLibraryChips(ov) {
    const host = ov.querySelector('#wizmShelf');
    const entries = (host && host.__lshEntries) || [];
    if (ov.__place !== 'local') return;
    const shelfKeys = new Set(entries.filter((e) => e.obj && e.obj.op).map((e) => JSON.stringify(e.obj.op)));
    for (const e of (ov.__mine || [])) {
        const row = ov.querySelector(`.wizm-row[data-row="${CSS.escape(e.type)}"] .wizm-inlib`);
        if (!row) continue;
        let key = null;
        try { const t = exportWizard(e.type); key = t ? JSON.stringify(JSON.parse(t).op) : null; } catch (_) { key = null; }
        row.hidden = !(key && shelfKeys.has(key));
    }
}

async function renderCloudShelf(ov, host, stale = () => false) {
    const acc = getAccount();
    if (!acc.connected || acc.provider !== 'google') {
        host.innerHTML = '<div class="wsm-empty">Keep shared wizards in your own Google Drive too — the same app folder your cloud workspaces use.'
            + '<div style="margin-top:10px"><button type="button" class="toolbar-btn settings-io" id="wizmCloudSignIn">☁ Sign in to Google Drive</button></div></div>';
        host.querySelector('#wizmCloudSignIn').addEventListener('click', async () => {
            try { await connect('google'); } catch (_) { /* the shared flow reports its own failures */ }
            const done = () => { window.removeEventListener('ddcs:cloud-account', done); renderPlace(ov); };
            window.addEventListener('ddcs:cloud-account', done);
            setTimeout(() => { window.removeEventListener('ddcs:cloud-account', done); if (getAccount().connected) renderPlace(ov); }, 15000);
        });
        return;
    }
    host.innerHTML = '<div class="wsm-dim">Reading your Drive…</div>';
    let files = [];
    try {
        const d = await drive();
        const root = await d.ensureRoot();
        files = (await d.list(root)).filter((f) => f.type !== 'folder' && /\.wiz(ard)?$/i.test(f.name)).slice(0, 60)
            .sort((a, b) => a.name.localeCompare(b.name));
    } catch (e) {
        if (stale()) return;
        const why = /cloud-auth/.test(String(e && e.message)) ? 'Your Google sign-in has expired.' : `Drive could not be reached (${(e && e.message) || e}).`;
        host.innerHTML = `<div class="wsm-empty">${esc(why)} Your local shelf is unaffected — switch back to <b>Local folder</b>, or sign in again.`
            + '<div style="margin-top:10px"><button type="button" class="toolbar-btn settings-io" id="wizmCloudSignIn">Sign in to Google Drive</button></div></div>';
        const b = host.querySelector('#wizmCloudSignIn');
        if (b) b.addEventListener('click', () => renderPlace(ov));
        return;
    }
    if (stale()) return;
    ov.__cloudFiles = files;
    host.innerHTML =
        `<div class="wsm-cloudbar"><span class="wsm-dim">Signed in as</span> <b>${esc(acc.email || acc.name || 'your Google account')}</b>`
        + '<button type="button" class="wss-link" id="wizmCloudOut">Sign out</button></div>'
        + (!files.length
            ? '<div class="wsm-empty">No .wiz files in your Drive app folder yet. Export a wizard while this tab is open and it will show up here.</div>'
            : `<div class="wsm-fp"><div class="wsm-fp-head"><span class="wsm-c-name">Name</span><span class="wsm-c-when">Saved</span></div>
                <div class="wsm-fp-list">${files.map((f, i) => `<div class="wsm-fp-row">
                    <button type="button" class="wsm-fp-open" data-wizm-cloud="${i}" title="Import “${esc(f.name)}” into this workspace (a copy, not a link)">
                        <span class="wsm-c-name">${esc(f.name)}</span>
                        <span class="wsm-c-when">${f.savedAt ? esc(String(f.savedAt).slice(0, 10)) : ''}</span>
                    </button>
                    <button type="button" class="wsm-fp-del" data-wizm-trash="${i}" title="Move ${esc(f.name)} to your Drive trash" aria-label="Trash ${esc(f.name)}">🗑</button>
                </div>`).join('')}</div></div>`);
    host.querySelector('#wizmCloudOut').addEventListener('click', async () => { disconnect(); await renderPlace(ov); });
    if (host.__wizmCloudBound) return;   // delegated once — the host outlives every re-render (the shelf's own lesson)
    host.__wizmCloudBound = true;
    host.addEventListener('click', async (e) => {
        const del = e.target.closest('[data-wizm-trash]');
        if (del) {
            const f = (ov.__cloudFiles || [])[Number(del.dataset.wizmTrash)];
            if (!f) return;
            if (!(await dlgConfirm(`Move “${f.name}” to your Google Drive trash?\n\nDrive keeps trashed files for about 30 days, so you can restore it there.`, { danger: true, okLabel: 'Move to trash' }))) return;
            try { await (await drive()).trash(f.id); } catch (err) { dlgNotice(`“${f.name}” could not be trashed: ${(err && err.message) || err}`); return; }
            await renderPlace(ov);
            return;
        }
        const open = e.target.closest('[data-wizm-cloud]');
        if (!open) return;
        const f = (ov.__cloudFiles || [])[Number(open.dataset.wizmCloud)];
        if (!f) return;
        try {
            const obj = await (await drive()).read(f.id);
            if (await importText(JSON.stringify(obj), f.name)) await ov.__applyRegistry();
        } catch (err) { dlgNotice(`“${f.name}” could not be read from Drive: ${(err && err.message) || err}`); }
    });
}

/**
 * EXPORT — the crossing DOWN, an explicit copy onto whichever shelf is showing (the workspace manager's own
 * "the active tab is where a save goes" rule). Local writes through the proven library-folder path (ask before
 * replacing, download only when this browser cannot grant folders at all); cloud writes the same bytes into the
 * Drive app folder, asking before overwriting a same-named file.
 */
async function exportToActiveShelf(ov, opType) {
    const d = storedDef(opType);
    const text = exportWizard(opType);
    if (!d || !text) return;
    const stem = (d.label || opType).trim() || 'wizard';
    if (ov.__place === 'cloud') {
        if (!getAccount().connected) { dlgNotice('Sign in on the Cloud tab first — the export writes into your Drive app folder.'); return; }
        try {
            const dr = await drive();
            const root = await dr.ensureRoot();
            const name = `${stem.replace(/[\/:*?"<>|]/g, '-')}.wiz`;
            const existing = (await dr.list(root)).find((f) => f.type !== 'folder' && f.name === name);
            if (existing && !(await dlgConfirm(`“${name}” already exists in your Drive app folder. Replace it?`, { okLabel: 'Replace' }))) return;
            await dr.write(name, JSON.parse(text), root);
            dlgNotice(`Saved “${name}” to your Drive app folder — it is on the shelf below.`);
        } catch (e) { dlgNotice('Could not write to Drive: ' + ((e && e.message) || e)); return; }
        await renderPlace(ov);
        return;
    }
    if (!hasFSA()) {
        const safe = stem.replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '') || 'wizard';
        UIUtils.downloadFile(`${safe}.wiz`, text);
        dlgNotice(`This browser cannot grant a folder, so “${safe}.wiz” was downloaded instead. The desktop app keeps it in your library folder.`);
        return;
    }
    const r = await writeLibraryFile(stem, 'wiz', text, {
        confirmReplace: (name, where) => dlgConfirm(`“${name}” already exists in ${where}. Replace it?`, { okLabel: 'Replace' }),
    });
    if (r.ok) { dlgNotice(`Saved “${r.name}” to your library folder — it is on the shelf below.`); await renderPlace(ov); }
    else if (!r.aborted) dlgNotice(`Could not write the .wiz file: ${r.error}`);
}

if (typeof window !== 'undefined') {
    window.openWizardManager = openWizardManager;
}
