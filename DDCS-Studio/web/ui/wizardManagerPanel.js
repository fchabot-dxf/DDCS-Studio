/**
 * ui/wizardManagerPanel.js — the Settings "Wizard library manager" (wizard-maker stage 5).
 *
 * Renders the whole wizard catalog (blocks/wizardLibrary.getLibrary, includeHidden) as an editable list and lets
 * the user customise the wizard bar without touching code: show/hide, rename, re-group, re-order ANY wizard
 * (built-ins included), delete or export a custom op, import a `.wizard` file, fork a built-in into an editable
 * copy, and reset the whole layout to factory. Every edit persists through the library layer (the bar layout in
 * `ddcs_wizard_layout`, user ops in `ddcs_user_ops`) and is pushed LIVE to the bar via window.ddcsRefreshWizardBar.
 *
 * Built like ioTable.renderIoTable: a `rerender()` closure rebuilds the list in place after each mutation. No
 * saveSettings() — the library owns its own persistence.
 */
import { UIUtils } from './uiUtils.js';
import {
    getLibrary, setEntryOverride, setGroupOverride, resetLayout,
    createWizard, deleteWizard, exportWizard, importWizard,
} from '../blocks/wizardLibrary.js';
import { _builderAtoms } from '../blocks/opBuilders.js';
import { userOpFromStack, listUserOps, USER_OP_PREFIX } from '../blocks/userOps.js';

// ── small DOM helpers ────────────────────────────────────────────────────────────────────────────────────────
function mkBtn(text, onClick, opts = {}) {
    const b = document.createElement('button');
    b.className = 'toolbar-btn';
    b.textContent = text;
    b.style.cssText = `padding:4px 10px; font-size:12px;${opts.danger ? ' color:var(--danger);' : ''}`;
    if (opts.title) b.title = opts.title;
    b.addEventListener('click', onClick);
    return b;
}
function mkArrow(glyph, disabled, onClick, title) {
    const b = document.createElement('button');
    b.className = 'toolbar-btn';
    b.textContent = glyph;
    b.title = title;
    b.disabled = !!disabled;
    b.style.cssText = 'padding:2px 7px; font-size:12px; align-self:center;';
    if (!disabled) b.addEventListener('click', onClick);
    return b;
}

// ── mutations (each reassigns contiguous order to avoid the implicit-index pitfall) ─────────────────────────────
function moveItem(items, i, dir) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const ids = items.map((e) => e.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    ids.forEach((id, k) => setEntryOverride(id, { order: k }));   // contiguous 0..n-1 within the group
}
function moveGroup(groups, gi, dir) {
    const j = gi + dir;
    if (j < 0 || j >= groups.length) return;
    const ids = groups.map((g) => g.id);
    [ids[gi], ids[j]] = [ids[j], ids[gi]];
    ids.forEach((id, k) => setGroupOverride(id, { order: k }));
}
function regroup(entry, newGroup) {
    if (!newGroup || newGroup === entry.group) return;
    const target = getLibrary({ includeHidden: true }).groups.find((g) => g.id === newGroup);
    const maxOrder = target ? target.items.reduce((m, e) => Math.max(m, e.order), -1) : -1;
    setEntryOverride(entry.id, { group: newGroup, order: maxOrder + 1 });   // append to the end of the target group
}

/** Fork a built-in into an editable user op: capture its default output stack as a zero-binding template. */
function forkBuiltin(entry) {
    const params = entry.variant ? { variant: entry.variant } : {};
    const stack = _builderAtoms(entry.type, params);
    if (!stack || !stack.length) throw new Error('this wizard produced no blocks to fork');
    const existing = new Set(listUserOps().map((d) => d.opType));
    const pref = (s) => (s.startsWith(USER_OP_PREFIX) ? s : USER_OP_PREFIX + s);
    const base = entry.id;                                          // id is unique per catalog entry (incl. bore vs drill)
    let slug = `${base}_copy`, n = 2;
    while (existing.has(pref(slug))) slug = `${base}_copy${n++}`;
    const def = userOpFromStack(slug, `${entry.label || base} (copy)`, stack, []);
    createWizard(def);                                             // validates by construction (params baked, zero bindings)
}

function exportEntry(entry) {
    const text = exportWizard(entry.type);
    if (!text) return;
    const safe = (entry.label || entry.type).replace(/[^A-Za-z0-9_.-]+/g, '_').replace(/^_+|_+$/g, '') || 'wizard';
    UIUtils.downloadFile(`${safe}.wizard`, text);
}

let _importInput = null;
function importWizardFile(onDone) {
    if (!_importInput) {
        _importInput = document.createElement('input');
        _importInput.type = 'file';
        _importInput.accept = '.wizard,.json';
        _importInput.style.display = 'none';
        document.body.appendChild(_importInput);
    }
    const input = _importInput;
    input.onchange = () => {
        const f = input.files && input.files[0];
        input.value = '';                                          // let the same file be re-picked
        if (!f) return;
        const r = new FileReader();
        r.onload = (e) => {
            try {
                const def = importWizard(e.target.result || '');
                if (!def) { alert('That isn’t a valid .wizard file.'); return; }
                onDone();
            } catch (err) { alert('Import failed: ' + (err && err.message || err)); }
        };
        r.readAsText(f);
    };
    input.click();
}

// ── the panel ──────────────────────────────────────────────────────────────────────────────────────────────────
export function renderWizardLibrary(container) {
    if (!container) return;
    const rerender = () => renderWizardLibrary(container);
    // after a mutation: rebuild this list AND push the change live to the wizard bar
    const apply = () => { rerender(); if (window.ddcsRefreshWizardBar) window.ddcsRefreshWizardBar(); };

    container.innerHTML = '';
    const lib = getLibrary({ includeHidden: true });
    const groupIds = lib.groups.map((g) => g.id);

    // header: intro + import + reset
    const head = document.createElement('div');
    head.className = 'settings-section';
    head.innerHTML = `<div class="settings-section-title">WIZARD LIBRARY</div>
        <div class="settings-hint">Customise the wizard bar: hide, rename, re-group or re-order any wizard (built-ins included),
        fork a built-in into an editable copy, or import/share custom <code>.wizard</code> ops. Changes apply to the bar instantly.</div>`;
    const actions = document.createElement('div');
    actions.className = 'settings-row';
    actions.style.marginTop = '10px';
    actions.appendChild(mkBtn('⬆ Import .wizard', () => importWizardFile(apply), { title: 'Load a shared .wizard file into your library' }));
    actions.appendChild(mkBtn('↺ Reset to factory', () => {
        if (confirm('Reset the wizard bar layout (visibility, names, grouping, order) to factory defaults?\nYour custom .wizard ops are kept.')) { resetLayout(); apply(); }
    }, { title: 'Discard all bar customisation (keeps your custom ops)' }));
    head.appendChild(actions);
    container.appendChild(head);

    // one section per group
    lib.groups.forEach((group, gi) => {
        const sec = document.createElement('div');
        sec.className = 'settings-section';

        const gh = document.createElement('div');
        gh.style.cssText = 'display:flex; align-items:center; gap:8px; margin-bottom:4px;';
        const gName = document.createElement('input');
        gName.type = 'text';
        gName.value = group.label;
        gName.title = 'Rename this group';
        gName.style.cssText = 'flex:0 0 auto; width:160px; font-size:12px; font-weight:700; letter-spacing:0.6px; text-transform:uppercase; color:var(--text-dim); background:transparent; border:1px solid transparent; border-radius:5px; padding:3px 6px;';
        gName.addEventListener('focus', () => { gName.style.borderColor = 'var(--border)'; gName.style.background = 'var(--bg)'; });
        gName.addEventListener('blur', () => { gName.style.borderColor = 'transparent'; gName.style.background = 'transparent'; });
        gName.addEventListener('change', () => { setGroupOverride(group.id, { label: gName.value.trim() || group.id }); apply(); });
        gh.appendChild(gName);
        gh.appendChild(mkArrow('▲', gi === 0, () => { moveGroup(lib.groups, gi, -1); apply(); }, 'Move group up'));
        gh.appendChild(mkArrow('▼', gi === lib.groups.length - 1, () => { moveGroup(lib.groups, gi, +1); apply(); }, 'Move group down'));
        sec.appendChild(gh);

        group.items.forEach((entry, ei) => sec.appendChild(renderRow(entry, group, ei, groupIds, apply)));
        container.appendChild(sec);
    });
}

function renderRow(entry, group, ei, groupIds, apply) {
    const items = group.items;
    const row = document.createElement('div');
    row.dataset.entry = entry.id;
    row.style.cssText = 'display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:7px 9px; margin:6px 0; border:1px solid var(--border); border-radius:7px; background:var(--panel);';

    // visibility toggle (the app's switch)
    const vis = document.createElement('label');
    vis.className = 'ddcs-switch';
    vis.title = entry.visible ? 'Visible in the bar — click to hide' : 'Hidden — click to show';
    vis.innerHTML = '<input type="checkbox"><span class="ddcs-slider"></span>';
    const cb = vis.querySelector('input');
    cb.checked = entry.visible;
    cb.addEventListener('change', () => { setEntryOverride(entry.id, { visible: cb.checked }); apply(); });
    row.appendChild(vis);

    // rename
    const name = document.createElement('input');
    name.type = 'text';
    name.value = entry.label;
    name.title = 'Rename (the name shown in the bar)';
    name.style.cssText = 'flex:1 1 140px; min-width:120px; padding:5px 8px; border:1px solid var(--border); border-radius:5px; background:var(--bg); color:var(--text); font-size:13px;';
    if (!entry.visible) name.style.opacity = '0.5';
    name.addEventListener('change', () => { const v = name.value.trim(); if (v) { setEntryOverride(entry.id, { label: v }); apply(); } else { name.value = entry.label; } });
    row.appendChild(name);

    // kind badge
    const badge = document.createElement('span');
    badge.textContent = entry.kind === 'user' ? 'CUSTOM' : 'BUILT-IN';
    badge.style.cssText = `flex:0 0 auto; font-size:9px; font-weight:700; padding:1px 5px; border-radius:3px; color:#fff; background:${entry.kind === 'user' ? '#3a6b7b' : '#6b7b3a'};`;
    row.appendChild(badge);

    // regroup
    const grp = document.createElement('select');
    grp.title = 'Move to another group';
    grp.style.cssText = 'flex:0 0 auto; padding:4px 6px; border:1px solid var(--border); border-radius:5px; background:var(--bg); color:var(--text); font-size:12px;';
    groupIds.forEach((gid) => {
        const o = document.createElement('option');
        o.value = gid; o.textContent = gid;
        if (gid === entry.group) o.selected = true;
        grp.appendChild(o);
    });
    grp.addEventListener('change', () => { regroup(entry, grp.value); apply(); });
    row.appendChild(grp);

    // reorder within group
    row.appendChild(mkArrow('▲', ei === 0, () => { moveItem(items, ei, -1); apply(); }, 'Move up'));
    row.appendChild(mkArrow('▼', ei === items.length - 1, () => { moveItem(items, ei, +1); apply(); }, 'Move down'));

    // actions
    if (entry.kind === 'user') {
        row.appendChild(mkBtn('Export', () => exportEntry(entry), { title: 'Save this op as a shareable .wizard file' }));
        row.appendChild(mkBtn('Delete', () => {
            if (confirm(`Delete the custom wizard “${entry.label}”? This removes it from your library.`)) { deleteWizard(entry.type); apply(); }
        }, { danger: true, title: 'Remove this custom op' }));
    } else {
        row.appendChild(mkBtn('Fork', () => {
            try { forkBuiltin(entry); apply(); }
            catch (e) { console.warn('fork failed', e); alert('Could not fork this wizard: ' + (e && e.message || e)); }
        }, { title: 'Create an editable custom copy of this built-in' }));
    }
    return row;
}
