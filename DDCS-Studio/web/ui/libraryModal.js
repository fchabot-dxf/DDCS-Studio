/**
 * ui/libraryModal.js — THE PROJECTS MODAL (t854, part 1; SPLIT from Wizards at t2178 amendment 14).
 *
 * t854 built this as ONE tabbed modal — Projects · Wizards · Profiles. t1217 retired Profiles (a workspace holds
 * exactly ONE machine, so there is no library of machines to browse — see [[one-workspace-one-machine]]), leaving
 * two tabs sharing nothing but a modal frame and a persisted last-tab. t2178 (human: "i think the modal should be
 * seperated, wizard modal and project modal dont need to be shared") finishes the split — checked FIRST whether an
 * independent Wizards surface already existed rather than authoring a new one: `window.openWizardManager()` (t1617,
 * `ui/wizardManager.js`) already is a fully independent, already-wired, RICHER modal (rename/duplicate/fork/export/
 * delete + its own local/cloud shelves) than this file's old Wizards tab ever offered (that tab only ever embedded
 * `wizardManagerPanel.renderWizardLibrary`, the bar-ARRANGEMENT designer — also independently reachable from
 * Settings). And nothing in the app ever deep-linked to `openLibrary('wizards')` directly (confirmed by grep) — the
 * quick-menu's own "Wizards…" row already called `openWizardManager()`, bypassing this tab entirely. So this was
 * restoring a door that was already open and deleting a shell around it, not building anything new.
 *
 * ONE DOOR, now for Projects alone: `openLibrary()` opens the projects browser — REUSING its existing logic
 * unchanged (the projectStore API + the shared selectLoad contract + projectModal.openSaveModal), just without the
 * now-pointless single-tab switcher around it. Kept the exported name (`openLibrary`) and the `#libraryOverlay` id
 * — every existing caller (macroBar.js, headerPost.js's "Open project…" row) already only ever wanted this tab, so
 * neither needed to change.
 */
import { installSelectLoad, syncPrimary } from './selectLoad.js';
import * as store from './projects/projectStore.js';
import { openSaveModal, renderCloudInto } from './projects/projectModal.js';
import { loadProject } from '../blocks/programFile.js';
import { dlgPrompt, dlgConfirm, dlgNotice } from './dialog.js';
import { busyRow } from './busyRow.js';   // t1257 — feedback on the row you clicked

const esc = (s) => String(s == null ? '' : s).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

let _ov = null;

/** Open the Projects modal. Idempotent — re-opening replaces any already-open instance. */
export function openLibrary() {
    if (_ov) { _ov.remove(); _ov = null; }
    const ov = document.createElement('div');
    ov.id = 'libraryOverlay';
    ov.className = 'library-overlay';
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `<div class="library-modal">
        <div class="library-head">
            <div class="library-title">Projects</div>
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

    Promise.resolve(renderProjectsTab(body, { close })).catch((e) => { body.innerHTML = `<div style="padding:20px; opacity:.7;">Could not open Projects: ${esc(e && e.message || e)}</div>`; });
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

// t2178 — the WIZARDS tab that used to live here is GONE, not relocated: it only ever embedded
// `wizardManagerPanel.renderWizardLibrary` (the bar-arrangement designer, independently reachable from Settings'
// own Wizards tab) plus a "New from current" button that duplicates the quick-menu's own `case 'wizard'` door
// (headerPost.js) — and `window.openWizardManager()` (ui/wizardManager.js, t1617) already covers the RICHER
// lifecycle actions (rename/duplicate/fork/export/delete + its own library shelves) this tab never had at all.
// Nothing deep-linked to `openLibrary('wizards')` (confirmed by grep before deleting), so no caller is stranded.

if (typeof window !== 'undefined') window.openLibrary = openLibrary;
