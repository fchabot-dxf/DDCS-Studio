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
 *   BOTTOM — a plain Import button (a native file picker), not a browsable shelf.
 *
 * t2194 (human, on the standalone .wiz LIBRARY SHELF this section used to be) — RETIRED, for three reasons that
 * survive a future where people DO trade .wiz files (not the usage one first given, which under-samples: the
 * human is the AUTHOR of wizards here, not the audience a shared library serves):
 *   (1) IT MISREPRESENTED ITSELF — named "Library", sitting right under the list of your own wizards, it read as
 *       a SECOND CONTAINER for them. It was not: a view of a folder on disk holding files not yet imported. That
 *       is the exact which-one-is-real duplication this whole session has spent its time removing.
 *   (2) UNIMPORTED IS A MOMENT, NOT A PLACE — a file is "unimported" for exactly as long as it takes to click
 *       Import. A transient state does not earn a permanent section beside things that actually live here.
 *   (3) EXPLORER ALREADY DOES THIS BETTER — the OS file browser can rename, preview, sort, show every extension;
 *       ours showed one extension and could do none of that. Rebuilding a worse file browser inside the app was
 *       the actual redundancy, not the sharing itself.
 * EXPORT SURVIVES UNTOUCHED — crossing OUT of the workspace (to a local file or Drive) is still wanted; only the
 * BROWSE-then-import-FROM-a-remembered-folder half is gone, replaced by a plain OS file dialog. Cloud stays a
 * legitimate EXPORT destination (asked for, via a small choice, only when signed in) — it never touches the
 * workspace's own rows, matching t2190 amendment 4's rule that only Export/Import touch the real filesystem.
 *
 * THE DUALITY IS RULED, permanently: the workspace EMBEDS (a wizard used by the workspace is IN the workspace — the
 * .ddcs is self-contained and authoritative); crossing is an EXPLICIT COPY — Export down, Import up. NO references,
 * NO auto-sync, ever: a dangling reference is a broken machine-file by construction. NO update-from-source in v1 —
 * `forkedFrom` is displayed provenance; merging a built-in's changes into a fork is a real merge problem deliberately
 * out of scope.
 *
 * FORK is one-source with the Blocks route (t1075/t1593): the template goes through the SAME wrapRecognizedForFork
 * and the declarations through the SAME forkInheritance the Customize→Save path uses — minus the canvas, which the
 * parity spec proved adds nothing to an untouched fork.
 */
import {
    listEntries, exportWizard, importWizard, wizardFromFile, deleteWizard, setEntryOverride, friendlySource,
} from '../blocks/wizardLibrary.js';
import { buildImportSummary } from './importCompat.js';   // t2196 amendment 3 — the shared confirm-on-import summary
import { listUserOps, createUserOp, updateUserOp, forkInheritance, USER_OP_PREFIX } from '../blocks/userOps.js';
import { writeLibraryFile, hasFSA } from '../data/libraryFolder.js';
import { dlgConfirm, dlgPrompt, dlgNotice, dlgChoice } from './dialog.js';
import { getAccount } from './cloudAccount.js';
import { entryIconHtml } from './wizIcons.js';
import { UIUtils } from './uiUtils.js';
import { popReturn } from './navReturn.js';   // t2192 — the return path (Settings' Workspace tab → here → back)

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// LAZY, like the workspace manager's drive() — the Drive adapter (and devMode's fork wrap) load on first use, not at boot.
const drive = () => import('./cloud/googleDrive.js');

// ── the registry reads (one place, so every render answers from the same source) ────────────────────────────────
/** The PERSISTED def for an opType — JSON-safe (the live registry's def can carry re-attached function fields). */
const storedDef = (opType) => listUserOps().find((d) => d.opType === opType) || null;
const copy = (v) => JSON.parse(JSON.stringify(v));

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
 * outcome) does the work; what this adds is the ONE confirm-on-import summary (t2196 amendment 3) — collision,
 * wrong machine/axes, wrong dialect (never applies to a wizard — see importCompat.js's own header), the #-variables
 * it uses (a listed fact, not a verdict), what it makes and its provenance, all in one ask rather than a bare
 * collision question with everything else invisible until after the file is already part of the workspace.
 */
async function importText(text, sourceName) {
    const file = wizardFromFile(text);
    if (!file) { dlgNotice(`“${sourceName}” is not a wizard file this version understands.`); return false; }
    const existing = listUserOps().find((d) => d.opType === file.opType);
    // file.opType is the twin's OWN identity (e.g. 'user_pocket_data') — buildImportSummary's axisCompatReasons
    // resolves a twin back to its built-in family via the SAME declared bridge friendlySource uses below, so a
    // genuine custom (non-twin) opType is passed through unresolved and simply never matches an axis-need row.
    const summary = buildImportSummary({
        name: file.label || file.opType,
        existing: existing ? (existing.label || existing.opType) : null,
        opTypes: [file.opType],
        rawText: text,
        whatItMakes: friendlySource(file.opType),
        provenance: file.forkedFrom ? `Fork of "${friendlySource(file.forkedFrom)}"` : 'Authored from scratch',
    });
    const ok = await dlgConfirm(summary.body, { title: summary.title, okLabel: existing ? 'Replace' : 'Import', danger: summary.hasWarning || !!existing });
    if (!ok) return false;
    if (existing) deleteWizard(file.opType);   // then the one import path below installs the file's copy
    let def = null;
    try { def = importWizard(text); } catch (e) { dlgNotice('Import failed: ' + ((e && e.message) || e)); return false; }
    if (!def) { dlgNotice(`“${sourceName}” is not a wizard file this version understands.`); return false; }
    dlgNotice(`“${def.label || def.opType}” is in this workspace now — on your bar, editable in Blocks.${def.importNote ? ' ' + def.importNote : ''}`);
    return true;
}

// ── the modal ────────────────────────────────────────────────────────────────────────────────────────────────────
let _ov = null;

/** Open the manager. `opts.returnToken` — t2192: a token from ui/navReturn.js's pushReturn(); when given, closing
 *  this manager (✕ / Esc / backdrop — all one `close()`, so this covers every exit) pops it and reopens whoever
 *  pushed it (e.g. Settings' Workspace tab) instead of just closing to the app. Opened from the file menu (no
 *  token), it closes to the app exactly as before — the token's mere presence is the signal, not a separate flag. */
export async function openWizardManager(opts = {}) {
    if (_ov) { _ov.remove(); _ov = null; }
    const returnToken = opts.returnToken;
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
                <button type="button" class="toolbar-btn settings-io" data-wizm="importfile">⬆ Import .wiz file…</button>
                <input type="file" accept=".wiz,.wizard,application/json" id="wizmImportInput" style="display:none">
            </section>
        </div>
    </div>`;
    document.body.appendChild(ov);
    _ov = ov;
    const close = () => {
        ov.remove(); if (_ov === ov) _ov = null; document.removeEventListener('keydown', onKey, true);
        if (returnToken != null) popReturn(returnToken);
    };
    // Escape closes the MANAGER — unless an app-dialog (rename prompt / replace confirm) is up: both listen on
    // document in capture, so the dialog's stopPropagation cannot shield this one, and without the guard one
    // Escape cancelled the prompt AND took the whole manager with it (caught by the collision spec's Cancel arm).
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.app-dialog')) { e.preventDefault(); close(); } };
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
    ov.querySelector('.wsm-x').addEventListener('click', close);

    // ONE delegated handler for the two registry sections (they re-render after every mutation).
    const applyRegistry = async () => {
        renderMine(ov);
        renderBuiltins(ov);
        if (window.ddcsRefreshWizardBar) window.ddcsRefreshWizardBar();
    };
    ov.__applyRegistry = applyRegistry;
    const fileInput = ov.querySelector('#wizmImportInput');
    fileInput.addEventListener('change', async () => {
        const f = fileInput.files && fileInput.files[0];
        fileInput.value = '';
        if (!f) return;
        const text = await f.text();
        if (await importText(text, f.name)) await applyRegistry();
    });
    ov.querySelector('.wsm-body').addEventListener('click', async (e) => {
        const act = e.target.closest('[data-wizm]');
        if (!act) return;
        const kind = act.dataset.wizm, opType = act.dataset.op;
        if (kind === 'importfile') { fileInput.click(); return; }
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
            if (await dlgConfirm(`Delete “${d.label || opType}” from this workspace?`, { danger: true, okLabel: 'Delete' })) {
                deleteWizard(opType);
                await applyRegistry();
            }
            return;
        }
        if (kind === 'export') { await exportWizardFile(opType); return; }
    });

    renderMine(ov);
    renderBuiltins(ov);
    return ov;
}

// ── THIS WORKSPACE — the custom wizards ─────────────────────────────────────────────────────────────────────────
function renderMine(ov) {
    const host = ov.querySelector('#wizmMine');
    const mine = listEntries().filter((e) => e.kind === 'user');
    ov.__mine = mine;
    host.innerHTML = `<div class="wizm-title">This workspace — embedded in your .ddcs (${mine.length || 'none yet'})</div>`
        + (!mine.length
            ? '<div class="wsm-empty">No custom wizards in this workspace yet. Fork a built-in below, import a .wiz file, or save a stack from the Blocks tab.</div>'
            : `<div class="wizm-list wizm-scroll">${mine.map((e) => {
                const d = e.def || storedDef(e.type) || {};
                const prov = d.forkedFrom ? `fork of ${friendlySource(d.forkedFrom)}` : 'yours';
                const when = d.savedAt ? String(d.savedAt).slice(0, 10) : '';
                return `<div class="wizm-row" data-row="${esc(e.type)}">
                    <span class="wizm-ico">${entryIconHtml(e) || '✦'}</span>
                    <span class="wizm-name" title="${esc(d.label || e.label)}">${esc(d.label || e.label)}</span>
                    <span class="wizm-prov" title="${d.forkedFrom ? esc('forked from ' + d.forkedFrom) : 'authored in this workspace'}">${esc(prov)}</span>
                    <span class="wizm-when">${esc(when)}</span>
                    <span class="wizm-acts">
                        <button type="button" class="wizm-act" data-wizm="rename" data-op="${esc(e.type)}" title="Rename this wizard (the name every surface shows)">✎ Rename</button>
                        <button type="button" class="wizm-act" data-wizm="dup" data-op="${esc(e.type)}" title="Duplicate it inside this workspace">⧉ Duplicate</button>
                        <button type="button" class="wizm-act" data-wizm="export" data-op="${esc(e.type)}" title="Export it to a .wiz file or your Drive">⬇ Export</button>
                        <button type="button" class="wizm-act is-danger" data-wizm="del" data-op="${esc(e.type)}" title="Delete it from this workspace">🗑</button>
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

/**
 * EXPORT — the crossing DOWN, a copy leaving the workspace (t2194 — no more shelf to land on; the destination is
 * asked for directly, once, only when there is a real choice to make). Local writes through the proven
 * library-folder path (a remembered granted folder, asked before replacing; download only when this browser
 * cannot grant folders at all); cloud writes the same bytes into the Drive app folder, asking before overwriting
 * a same-named file. Both paths are UNCHANGED from before the shelf's removal — only the "which one" question
 * moved from a persistent tab to a one-shot ask.
 */
async function exportWizardFile(opType) {
    const d = storedDef(opType);
    const text = exportWizard(opType);
    if (!d || !text) return;
    const stem = (d.label || opType).trim() || 'wizard';

    let target = 'local';
    if (getAccount().connected) {
        target = await dlgChoice(`Export “${stem}” to:`, [
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
            const name = `${stem.replace(/[\/:*?"<>|]/g, '-')}.wiz`;
            const existing = (await dr.list(root)).find((f) => f.type !== 'folder' && f.name === name);
            if (existing && !(await dlgConfirm(`“${name}” already exists in your Drive app folder. Replace it?`, { okLabel: 'Replace' }))) return;
            await dr.write(name, JSON.parse(text), root);
            dlgNotice(`Saved “${name}” to your Drive app folder.`);
        } catch (e) { dlgNotice('Could not write to Drive: ' + ((e && e.message) || e)); }
        return;
    }
    if (!hasFSA()) {
        const safe = stem.replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '') || 'wizard';
        UIUtils.downloadFile(`${safe}.wiz`, text);
        dlgNotice(`This browser cannot grant a folder, so “${safe}.wiz” was downloaded instead.`);
        return;
    }
    const r = await writeLibraryFile(stem, 'wiz', text, {
        confirmReplace: (name, where) => dlgConfirm(`“${name}” already exists in ${where}. Replace it?`, { okLabel: 'Replace' }),
    });
    if (r.ok) dlgNotice(`Saved “${r.name}” to your library folder.`);
    else if (!r.aborted) dlgNotice(`Could not write the .wiz file: ${r.error}`);
}

if (typeof window !== 'undefined') {
    window.openWizardManager = openWizardManager;
}
