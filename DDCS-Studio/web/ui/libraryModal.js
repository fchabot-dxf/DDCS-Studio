/**
 * ui/libraryModal.js — THE LIBRARY (t854, part 1). ONE tabbed modal for the user's stuff: Projects · Wizards.
 * (t1217 — the Profiles tab retired with the profile library; the workspace's ONE machine lives in Settings.)
 *
 * ONE DOOR: `openLibrary(tab)` opens a single modal on the last-used tab (persisted). Every old entry point (the
 * projects drawer button, Profiles…, the wizard manager) becomes a DEEP-LINK into its tab — nothing breaks on landing
 * day; the old surfaces stay reachable and are retired later.
 *
 * REUSE, not rebuild: each tab hosts the EXISTING surface's own logic —
 *   Projects → the projectStore API + the shared selectLoad contract + projectModal.openSaveModal (save-as-into-folders)
 *   Wizards  → wizardManagerPanel.renderWizardLibrary (the bar-designer) + a New-from-current door
 * The three tabs are a DECLARED registry (TABS) so adding one is a row, not new machinery.
 */
import { renderWizardLibrary } from './wizardManagerPanel.js';
import { installSelectLoad, syncPrimary } from './selectLoad.js';
import * as store from './projects/projectStore.js';
import { openSaveModal, renderCloudInto } from './projects/projectModal.js';
import { loadProject } from '../blocks/programFile.js';
import { dlgPrompt, dlgConfirm, dlgNotice } from './dialog.js';
import { busyRow } from './busyRow.js';   // t1257 — feedback on the row you clicked

const TAB_KEY = 'ddcs_library_tab';
const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

const lastTab = () => { try { return localStorage.getItem(TAB_KEY) || 'projects'; } catch (_) { return 'projects'; } };
const rememberTab = (id) => { try { localStorage.setItem(TAB_KEY, id); } catch (_) { /* private mode */ } };

// The declared tab registry — each mounts its surface into the shared body.
const TABS = [
    // t1217 RETIRED ([[one-workspace-one-machine]]): the Profiles tab is gone — a workspace holds exactly ONE machine,
    // so there is no library to browse. The machine lives in Settings ("This workspace's machine"); a second machine is
    // a second .ddcs. A deep-link to 'profiles' now lands on the first surviving tab rather than 404-ing.

    { id: 'projects', label: 'Projects', mount: (body, ctx) => renderProjectsTab(body, ctx) },
    { id: 'wizards', label: 'Wizards', mount: (body, ctx) => renderWizardsTab(body, ctx) },
];

let _ov = null;

/** Open the Library on `tab` (default: the last-used tab). Idempotent — re-opens onto the requested tab. */
export function openLibrary(tab) {
    const want = TABS.some((t) => t.id === tab) ? tab : lastTab();
    if (_ov) { _ov.remove(); _ov = null; }
    const ov = document.createElement('div');
    ov.id = 'libraryOverlay';
    ov.className = 'library-overlay';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="library-modal">
        <div class="library-head">
            <div class="library-tabs" role="tablist">${TABS.map((t) => `<button type="button" class="library-tab" role="tab" data-lib-tab="${t.id}">${esc(t.label)}</button>`).join('')}</div>
            <button type="button" class="library-x" aria-label="Close">✕</button>
        </div>
        <div class="library-body" id="libraryBody"></div>
    </div>`;
    document.body.appendChild(ov);
    _ov = ov;
    const body = ov.querySelector('#libraryBody');
    const close = () => { ov.remove(); if (_ov === ov) _ov = null; document.removeEventListener('keydown', onKey, true); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    document.addEventListener('keydown', onKey, true);
    ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
    ov.querySelector('.library-x').addEventListener('click', close);

    const show = (id) => {
        rememberTab(id);
        ov.querySelectorAll('.library-tab').forEach((b) => b.classList.toggle('active', b.dataset.libTab === id));
        body.innerHTML = '';
        const t = TABS.find((x) => x.id === id) || TABS[0];
        Promise.resolve(t.mount(body, { close, show })).catch((e) => { body.innerHTML = `<div style="padding:20px; opacity:.7;">Could not open ${esc(t.label)}: ${esc(e && e.message || e)}</div>`; });
    };
    ov.querySelectorAll('.library-tab').forEach((b) => b.addEventListener('click', () => show(b.dataset.libTab)));
    show(want);
    return ov;
}

// ── PROJECTS tab — the local project browser, reusing the store API + the shared select-then-load + openSaveModal ──
function renderProjectsTab(body, ctx) {
    let cwd = '';
    // t863 — TWO VOLUMES, two select-load roots (the t806 drawer pattern): Local (projectStore) + Cloud (renderCloudInto,
    // its OWN folder stack). Each root owns its own [data-sl-primary] so a selection on one can't drive the other's [Open].
    body.innerHTML = `
        <div class="proj-voltabs" role="tablist">
            <button type="button" class="proj-voltab on" data-lvol="local" role="tab">💾 Local</button>
            <button type="button" class="proj-voltab" data-lvol="cloud" role="tab">☁ Cloud</button>
        </div>
        <div id="libProjLocal">
            <div class="lib-projhead">
                <span class="lib-crumb" data-crumb></span>
                <span style="flex:1"></span>
                <button type="button" class="toolbar-btn settings-io" data-pa="mkdir" title="New folder here">+ Folder</button>
                <button type="button" class="toolbar-btn settings-io" data-pa="save" title="Save the current program into a folder">💾 Save current…</button>
            </div>
            <div class="lib-list" data-list></div>
            <div class="sl-openbar"><button type="button" class="sl-primary" data-sl-primary disabled title="Open the selected project">Open</button></div>
        </div>
        <div id="libProjCloud" style="display:none"></div>`;
    const localWrap = body.querySelector('#libProjLocal');
    const cloudWrap = body.querySelector('#libProjCloud');
    const listEl = localWrap.querySelector('[data-list]');
    const crumbEl = localWrap.querySelector('[data-crumb]');

    async function render() {
        // breadcrumb
        crumbEl.replaceChildren();
        const mk = (label, path) => { const b = document.createElement('button'); b.className = 'lib-crumb-link'; b.textContent = label; b.dataset.cd = path; return b; };
        crumbEl.appendChild(mk('Local', ''));
        let acc = '';
        (cwd ? cwd.split('/') : []).forEach((p) => { acc = acc ? acc + '/' + p : p; crumbEl.append(' / ', mk(p, acc)); });
        // rows
        const items = await store.list(cwd);
        listEl.innerHTML = items.map((en) => {
            if (en.type === 'folder') return `<div class="proj-row lib-row"><button class="lib-name" data-cd="${esc(en.path)}" title="Open folder">📁 ${esc(en.name)}</button><span style="flex:1"></span><button class="op-btn" data-ren="${esc(en.path)}" title="Rename">✎</button><button class="op-btn" data-del="${esc(en.path)}" title="Delete">🗑</button></div>`;
            return `<div class="proj-row lib-row sl-row" data-sl-id="${esc(en.path)}"><span class="sl-name">📄 ${esc(en.name)}</span><span class="sl-tag">💾 local</span><button class="op-btn" data-ren="${esc(en.path)}" title="Rename">✎</button><button class="op-btn" data-del="${esc(en.path)}" title="Delete">🗑</button></div>`;
        }).join('') || '<div style="opacity:.6; padding:16px; text-align:center;">Empty — Save current… to add a project.</div>';
        syncPrimary(localWrap);
    }

    // t1257 (user live report) — the clicked project row goes busy while it is read and loaded. keepOnSuccess is
    // FALSE because a project load closes the Library rather than reloading the page, so the glyph has a real end.
    installSelectLoad(localWrap, async (path) => {
        const row = localWrap.querySelector(`.sl-row[data-sl-id="${CSS.escape(path)}"]`);
        await busyRow(row, async () => {
            try { const obj = await store.readProject(path); if (obj) { const loaded = await loadProject(obj); if (loaded) ctx.close(); } }
            catch (err) { dlgNotice('Open failed: ' + (err && err.message || err)); }
        }, { keepOnSuccess: false });
    });
    localWrap.addEventListener('click', async (e) => {
        const cd = e.target.closest('[data-cd]'); if (cd) { cwd = cd.dataset.cd; render(); return; }
        const ren = e.target.closest('[data-ren]');
        if (ren) {
            const p = ren.dataset.ren; const base = store.baseName(p);
            const nn = await dlgPrompt('Rename to:', base); if (!nn || nn === base) return;
            await store.rename(p, store.joinPath(store.parentOf(p), nn)); render(); return;
        }
        const del = e.target.closest('[data-del]');
        if (del) {
            const p = del.dataset.del;
            if (!(await dlgConfirm(`Delete “${esc(store.baseName(p))}”? This can’t be undone.`, { danger: true, okLabel: 'Delete' }))) return;
            await store.remove(p); render(); return;
        }
        const pa = e.target.closest('[data-pa]');
        if (pa && pa.dataset.pa === 'mkdir') { const nn = await dlgPrompt('New folder name:', ''); if (nn) { await store.mkdir(store.joinPath(cwd, nn)); render(); } return; }
        if (pa && pa.dataset.pa === 'save') { ctx.close(); openSaveModal(); return; }
    });

    // t863 — CLOUD volume: the reusable renderCloudInto (mounts its browser + select-load on cloudWrap; its own folder stack).
    const cloudBrowser = renderCloudInto(cloudWrap, { onClose: ctx.close });

    function switchVol(v) {
        localWrap.style.display = v === 'local' ? '' : 'none';
        cloudWrap.style.display = v === 'cloud' ? '' : 'none';
        body.querySelectorAll('.proj-voltab').forEach((t) => t.classList.toggle('on', t.dataset.lvol === v));
        if (v === 'local') render();
        else { cloudBrowser.reset(); cloudBrowser.render(); }
    }
    body.querySelectorAll('.proj-voltab').forEach((t) => t.addEventListener('click', () => switchVol(t.dataset.lvol)));

    render();
}

// ── WIZARDS tab — the embedded bar-designer (reused) + a New-from-current door ────────────────────────────────────
function renderWizardsTab(body, ctx) {
    body.innerHTML = `
        <div class="lib-wizhead">
            <button type="button" class="toolbar-btn settings-io" data-newwiz title="Turn the operation you have open in Blocks into a saved wizard on your bar">＋ New from current</button>
            <span class="settings-hint" style="flex:1; margin:0;">Manage your wizards and arrange them on the toolbar. New wizards land on the bar; drag, group, show/hide here.</span>
        </div>
        <div id="library_wizard_manager"></div>`;
    body.querySelector('[data-newwiz]').addEventListener('click', () => {
        if (window.ddcsSaveAsWizard) { ctx.close(); window.ddcsSaveAsWizard(); }
        else dlgNotice('Open an operation in the Blocks tab first, then New from current turns it into a wizard.');
    });
    // Reuse the existing bar-designer as-is. Its ✎ Edit switches to the Blocks tab (to re-author the wizard), so close
    // the Library after that click so the user lands on the editor — via a capture listener, NOT a global override.
    const mgr = body.querySelector('#library_wizard_manager');
    renderWizardLibrary(mgr);
    mgr.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (btn && /✎\s*Edit/.test(btn.textContent || '')) setTimeout(ctx.close, 0);   // let the switch-to-Blocks handler run first
    }, true);
}

if (typeof window !== 'undefined') window.openLibrary = openLibrary;
