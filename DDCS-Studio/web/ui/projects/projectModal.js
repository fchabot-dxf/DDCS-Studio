/**
 * ui/projects/projectModal.js — the project VFS UI, in two surfaces (PROJECTS only; CNCDISK stays in Gateway):
 *   • OPEN/MANAGE = a left DRAWER (Fusion-data-panel style, non-blocking): browse folders + `.mjson` projects,
 *     open, rename, delete, import a `.mjson` file.   → openOpenDrawer()
 *   • SAVE = a centered MODAL: a name + a simple folder TREE PICKER (with + New folder), Save / Export file.
 *     → openSaveModal()
 * Two header buttons drive these. Local volume = IndexedDB (projectStore.js); Cloud is a future volume.
 */
import { serializeProject, loadProject, downloadMacro, openMacroText } from '../../blocks/macroFile.js';
import * as store from './projectStore.js';
import { renderCloudLogin } from '../cloudAccount.js';

const sanitize = (s) => (String(s || '').trim().replace(/[^A-Za-z0-9 _.-]+/g, '_').replace(/^\.+/, '') || 'untitled');

// ── OPEN / MANAGE drawer ──────────────────────────────────────────────────────
let drawer = null, listEl = null, crumbEl = null, footEl = null, importInput = null;
let localWrap = null, cloudWrap = null, cloudMount = null;
let cwd = '', vol = 'local';

export function openOpenDrawer() {
    if (!drawer) buildDrawer();
    if (drawer.hidden) {
        const h = document.querySelector('.app-header');
        drawer.style.top = (h ? h.offsetHeight : 52) + 'px';
        cwd = '';
        drawer.hidden = false;
        switchVol('local');
    } else {
        drawer.hidden = true;
    }
}
function closeDrawer() { if (drawer) drawer.hidden = true; }

/** Switch the drawer's volume tab: Local (IndexedDB browse) vs Cloud (account login → future cloud browse). */
function switchVol(v) {
    vol = v;
    if (localWrap) localWrap.style.display = v === 'local' ? '' : 'none';
    if (cloudWrap) cloudWrap.style.display = v === 'cloud' ? '' : 'none';
    drawer.querySelectorAll('.proj-voltab').forEach((t) => t.classList.toggle('on', t.dataset.vol === v));
    if (v === 'local') renderDrawer();
    else renderCloudLogin(cloudMount);
}

function buildDrawer() {
    drawer = document.createElement('aside');
    drawer.className = 'proj-drawer';
    drawer.hidden = true;
    drawer.innerHTML =
        '<div class="proj-head"><span class="proj-title">📂 Projects</span>'
        + '<button class="op-btn" data-act="close" title="Close">✕</button></div>'
        + '<div class="proj-voltabs"><button class="proj-voltab on" data-vol="local">💾 Local</button>'
        + '<button class="proj-voltab" data-vol="cloud">☁ Cloud</button></div>'
        + '<div id="projLocal">'
        + '<div class="proj-bar"><span class="proj-crumb" id="projCrumb"></span>'
        + '<span class="proj-actions"><button class="op-btn" data-act="mkdir" title="New folder here">+ Folder</button>'
        + '<button class="op-btn" data-act="import" title="Import a .mjson file">Import</button></span></div>'
        + '<div class="proj-list" id="projList"></div>'
        + '<div class="proj-foot muted" id="projFoot"></div>'
        + '</div>'
        + '<div id="projCloud" style="display:none">'
        + '<div class="proj-cloudmount" id="projCloudMount"></div>'
        + '<div class="proj-foot muted">Cloud projects appear here once an account is connected.</div>'
        + '</div>';
    importInput = document.createElement('input');
    importInput.type = 'file'; importInput.accept = '.mjson,application/json'; importInput.style.display = 'none';
    drawer.appendChild(importInput);
    document.body.appendChild(drawer);
    localWrap = drawer.querySelector('#projLocal');
    cloudWrap = drawer.querySelector('#projCloud');
    cloudMount = drawer.querySelector('#projCloudMount');
    listEl = drawer.querySelector('#projList');
    crumbEl = drawer.querySelector('#projCrumb');
    footEl = drawer.querySelector('#projFoot');
    drawer.addEventListener('click', onDrawerClick);
    importInput.addEventListener('change', onImportFile);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer && !drawer.hidden) closeDrawer(); });
}

function mkCrumb(label, path) {
    const b = document.createElement('button');
    b.className = 'proj-crumb-link'; b.textContent = label; b.dataset.act = 'cd'; b.dataset.path = path;
    return b;
}

async function renderDrawer() {
    crumbEl.replaceChildren(mkCrumb('Local', ''));
    let acc = '';
    (cwd ? cwd.split('/') : []).forEach((p) => {
        acc = acc ? acc + '/' + p : p;
        crumbEl.append(document.createTextNode(' / '), mkCrumb(p, acc));
    });

    let entries = [];
    try { entries = await store.list(cwd); }
    catch (e) { listEl.innerHTML = '<div class="muted" style="padding:10px">storage unavailable: ' + e.message + '</div>'; return; }

    listEl.replaceChildren();
    if (!entries.length) listEl.innerHTML = '<div class="muted" style="padding:10px">empty — Save a project, or Import a .mjson file</div>';
    for (const en of entries) {
        const row = document.createElement('div');
        row.className = 'proj-row';
        const icon = en.type === 'folder' ? '📁' : '📄';
        const meta = (en.type === 'project' && en.savedAt) ? en.savedAt.slice(0, 16).replace('T', ' ') : '';
        const nameBtn = document.createElement('button');
        nameBtn.className = 'proj-name';
        nameBtn.dataset.act = en.type === 'folder' ? 'cd' : 'open';
        nameBtn.dataset.path = en.path;
        nameBtn.textContent = icon + ' ' + en.name;
        const metaEl = document.createElement('span'); metaEl.className = 'proj-meta muted'; metaEl.textContent = meta;
        const acts = document.createElement('span'); acts.className = 'proj-rowacts';
        for (const [act, label, cls, title] of [['rename', '✎', '', 'Rename'], ['del', '🗑', 'danger', 'Delete']]) {
            const b = document.createElement('button');
            b.className = 'op-btn ' + cls; b.dataset.act = act; b.dataset.path = en.path; b.textContent = label; b.title = title;
            acts.appendChild(b);
        }
        row.append(nameBtn, metaEl, acts);
        listEl.appendChild(row);
    }
    footEl.textContent = 'Local · IndexedDB' + (cwd ? ' · /' + cwd : '');
}

async function onDrawerClick(e) {
    const vt = e.target.closest('[data-vol]');
    if (vt) { switchVol(vt.dataset.vol); return; }    // Local / Cloud volume tab
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act, path = t.dataset.path || '';
    try {
        if (act === 'close') return closeDrawer();
        if (act === 'cd') { cwd = path; return renderDrawer(); }
        if (act === 'open') { const obj = await store.readProject(path); if (obj) { loadProject(obj); closeDrawer(); } return; }
        if (act === 'mkdir') { const name = window.prompt('New folder name:'); if (name) { await store.mkdir(store.joinPath(cwd, sanitize(name))); renderDrawer(); } return; }
        if (act === 'import') { importInput.click(); return; }
        if (act === 'rename') {
            const cur = store.baseName(path);
            const name = window.prompt('Rename to:', cur);
            if (name && sanitize(name) !== cur) { await store.rename(path, store.joinPath(store.parentOf(path), sanitize(name))); renderDrawer(); }
            return;
        }
        if (act === 'del') { if (window.confirm('Delete "' + store.baseName(path) + '"?')) { await store.remove(path); renderDrawer(); } return; }
    } catch (err) { window.alert(act + ' failed: ' + err.message); }
}

function onImportFile(e) {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { openMacroText(String(r.result)); closeDrawer(); } catch (err) { window.alert('Not a valid .mjson macro: ' + err.message); } };
    r.readAsText(f);
    importInput.value = '';
}

// ── SAVE modal (name + folder tree picker) ────────────────────────────────────
let saveOv = null, treeEl = null, nameInput = null, saveDest = '';

export async function openSaveModal() {
    const stack = (window.ddcsGetBlockProgram && window.ddcsGetBlockProgram()) || [];
    if (!stack.length) { window.alert('Nothing to save — build a program first.'); return; }
    if (!saveOv) buildSaveModal();
    saveDest = cwd || '';                         // default to the drawer's current folder
    nameInput.value = 'macro';
    saveOv.hidden = false;
    await renderTree();
    nameInput.focus(); nameInput.select();
}
function closeSave() { if (saveOv) saveOv.hidden = true; }

function buildSaveModal() {
    saveOv = document.createElement('div');
    saveOv.className = 'proj-savemodal';
    saveOv.hidden = true;
    saveOv.innerHTML =
        '<div class="proj-savepanel">'
        + '<div class="proj-head"><span class="proj-title">⤓ Save project</span><button class="op-btn" data-sact="cancel" title="Cancel">✕</button></div>'
        + '<div class="proj-savebody">'
        + '<label class="label">Name</label><input id="projSaveName" type="text" value="macro" style="width:100%"/>'
        + '<div class="proj-treehead"><span class="label">Folder</span>'
        + '<button class="op-btn" data-sact="mkdir" title="New folder under the selected one">+ New folder</button></div>'
        + '<div class="proj-tree" id="projTree"></div>'
        + '</div>'
        + '<div class="proj-savefoot">'
        + '<button class="op-btn" data-sact="exportfile" title="Download as a .mjson file instead">Export file</button>'
        + '<span style="flex:1"></span>'
        + '<button class="op-btn" data-sact="cancel">Cancel</button>'
        + '<button class="op-btn primary" data-sact="save">Save</button>'
        + '</div></div>';
    document.body.appendChild(saveOv);
    nameInput = saveOv.querySelector('#projSaveName');
    treeEl = saveOv.querySelector('#projTree');
    saveOv.addEventListener('click', onSaveClick);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && saveOv && !saveOv.hidden) closeSave(); });
}

async function renderTree() {
    let folders = [];
    try { folders = await store.allFolders(); } catch (e) { /* none yet */ }
    treeEl.replaceChildren(treeRow('Local (root)', '', 0));
    for (const f of folders) treeRow(store.baseName(f), f, f.split('/').length, treeEl);
    highlightTree();
}
function treeRow(label, path, depth, parent) {
    const b = document.createElement('button');
    b.className = 'proj-tree-row'; b.dataset.sact = 'pick'; b.dataset.folder = path;
    b.style.paddingLeft = (8 + depth * 16) + 'px';
    b.textContent = (path ? '📁 ' : '🗄 ') + label;
    if (parent) parent.appendChild(b);
    return b;
}
function highlightTree() {
    treeEl.querySelectorAll('.proj-tree-row').forEach((r) => r.classList.toggle('sel', (r.dataset.folder || '') === saveDest));
}

async function onSaveClick(e) {
    const t = e.target.closest('[data-sact]');
    if (!t) { if (e.target === saveOv) closeSave(); return; }   // backdrop closes
    const act = t.dataset.sact;
    try {
        if (act === 'cancel') return closeSave();
        if (act === 'pick') { saveDest = t.dataset.folder || ''; return highlightTree(); }
        if (act === 'mkdir') {
            const name = window.prompt('New folder under "' + (saveDest || 'root') + '":');
            if (!name) return;
            const np = store.joinPath(saveDest, sanitize(name));
            await store.mkdir(np); saveDest = np; await renderTree();
            return;
        }
        const name = sanitize(nameInput.value);
        if (act === 'save') {
            await store.saveProject(store.joinPath(saveDest, name), serializeProject(name));
            closeSave();
            if (drawer && !drawer.hidden) renderDrawer();
            return;
        }
        if (act === 'exportfile') { downloadMacro(name); closeSave(); return; }
    } catch (err) { window.alert('Save failed: ' + err.message); }
}
