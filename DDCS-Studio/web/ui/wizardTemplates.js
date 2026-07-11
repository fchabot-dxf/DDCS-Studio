/**
 * ui/wizardTemplates.js — per-op wizard parameter templates + the wizard-header Templates popover.
 *
 * Storage is per OP TYPE, decoupled from controller profiles:
 *   - Local  → localStorage  (ddcs_tpl_<op>)            — always available
 *   - Cloud  → the connected provider's adapter (ui/cloud/*), one .mjson file per op in the cloud root
 * Save asks Local vs Cloud only when a cloud account is connected. Load seeds the form + re-renders the preview.
 */
import { getAdapter } from './cloud/cloudVolume.js';
import { getAccount } from './cloudAccount.js';
import { getLastOp } from '../blocks/opRecord.js';
import { dlgConfirm, dlgPrompt, dlgNotice } from './dialog.js';   // in-app dialogs (t684 d — no bare confirm/prompt/alert)

const LKEY = (op) => `ddcs_tpl_${op}`;
const CLOUD_FILE = (op) => `ddcs-templates-${op}.mjson`;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function readLocal(op) { try { return JSON.parse(localStorage.getItem(LKEY(op)) || '[]'); } catch (_) { return []; } }
function writeLocal(op, list) { try { localStorage.setItem(LKEY(op), JSON.stringify(list)); } catch (_) { /* quota */ } }

export function cloudConnected() { try { return !!getAccount().connected; } catch (_) { return false; } }

// --- cloud: all of an op's templates live in ONE .mjson file in the cloud root (mirrors the local blob) ---
async function adapter() {
    const acc = getAccount(); if (!acc.connected || !acc.provider) return null;
    return getAdapter(acc.provider);
}
async function cloudFileRef(a, op) {
    const root = await a.ensureRoot();
    const items = await a.list(root);
    const hit = items.find((i) => i.name === CLOUD_FILE(op));
    return { root, ref: hit ? hit.ref : null };
}
async function cloudRead(op) {
    try {
        const a = await adapter(); if (!a) return [];
        const { ref } = await cloudFileRef(a, op); if (!ref) return [];
        const obj = await a.read(ref); return Array.isArray(obj && obj.templates) ? obj.templates : [];
    } catch (_) { return []; }
}
async function cloudWrite(op, list) {
    const a = await adapter(); if (!a) throw new Error('no cloud connected');
    const { root } = await cloudFileRef(a, op);
    await a.write(CLOUD_FILE(op), { templates: list }, root);
}

/** All templates for an op (local first, then cloud if connected). Async because cloud may fetch. */
export async function listTemplates(op) {
    const local = readLocal(op).map((t) => ({ name: t.name, params: t.params, where: 'local' }));
    let cloud = [];
    if (cloudConnected()) cloud = (await cloudRead(op)).map((t) => ({ name: t.name, params: t.params, where: 'cloud' }));
    return [...local, ...cloud];
}
export async function saveTemplate(op, name, params, where = 'local') {
    const rec = { name, params };
    if (where === 'cloud') { const list = (await cloudRead(op)).filter((t) => t.name !== name); list.push(rec); await cloudWrite(op, list); }
    else { const list = readLocal(op).filter((t) => t.name !== name); list.push(rec); writeLocal(op, list); }
}
export async function deleteTemplate(op, name, where = 'local') {
    if (where === 'cloud') await cloudWrite(op, (await cloudRead(op)).filter((t) => t.name !== name));
    else writeLocal(op, readLocal(op).filter((t) => t.name !== name));
}

// ── the wizard-header Templates popover ─────────────────────────────────────────────────────────────────────
let _pop = null, _onDocDown = null;
export function closeTemplatesPopover() {
    if (_onDocDown) { document.removeEventListener('pointerdown', _onDocDown, true); _onDocDown = null; }
    if (_pop && _pop.parentNode) _pop.parentNode.removeChild(_pop);
    _pop = null;
}

/** Toggle the popover anchored to `anchor`, driven by the WizardManager `wm` (active op + seed/update). */
export function openTemplatesPopover(wm, anchor) {
    if (_pop) { closeTemplatesPopover(); return; }
    const op = wm && wm._activeType; if (!op || !anchor) return;
    const label = (typeof wm.opLabel === 'function' && wm.opLabel(op)) || op;

    const pop = document.createElement('div');
    pop.className = 'wiz-tpl-pop';
    pop.innerHTML =
        `<div class="wt-head">Templates — ${esc(label)}</div>` +
        `<button class="wt-save" type="button">+ Save current as template…</button>` +
        `<div class="wt-list">Loading…</div>`;
    document.body.appendChild(pop);
    _pop = pop;

    const r = anchor.getBoundingClientRect();
    pop.style.top = Math.round(r.bottom + 6) + 'px';
    pop.style.left = Math.round(Math.min(r.left, window.innerWidth - 252)) + 'px';

    pop.querySelector('.wt-save').addEventListener('click', async () => {
        try { wm.update(); } catch (_) { /* keep the recorded op fresh */ }
        const last = getLastOp();
        const params = last && last.type === op ? last.params : null;   // recordOp stores { type, params } (not opType)
        if (!params) { dlgNotice('Nothing to save yet — adjust the wizard first.'); return; }
        const name = (await dlgPrompt('Template name:', '', { title: 'Save preset' }) || '').trim();
        if (!name) return;
        let where = 'local';
        if (cloudConnected()) where = await dlgConfirm('Save to your connected cloud?\n\nOK = Cloud  ·  Cancel = Local', { okLabel: 'Cloud', cancelLabel: 'Local' }) ? 'cloud' : 'local';
        try { await saveTemplate(op, name, params, where); } catch (e) { dlgNotice('Save failed: ' + (e && e.message || e)); }
        renderList();
    });

    async function renderList() {
        const listEl = pop.querySelector('.wt-list');
        let list = [];
        try { list = await listTemplates(op); } catch (_) { /* */ }
        if (!list.length) { listEl.innerHTML = '<div class="wt-empty">No templates yet.</div>'; return; }
        listEl.innerHTML = list.map((t, i) =>
            `<div class="wt-row" data-i="${i}"><span class="wt-name" title="Load">${esc(t.name)}</span>` +
            `<span class="wt-where" title="${t.where === 'cloud' ? 'Cloud' : 'Local'}">${t.where === 'cloud' ? '☁' : '💾'}</span>` +
            `<button class="wt-del" type="button" title="Delete">✕</button></div>`).join('');
        [...listEl.querySelectorAll('.wt-row')].forEach((row, i) => {
            const t = list[i];
            row.querySelector('.wt-name').addEventListener('click', () => {
                try { wm._seedForm(op, t.params); wm.update(); } catch (_) { /* */ }
                closeTemplatesPopover();
            });
            row.querySelector('.wt-del').addEventListener('click', async (e) => {
                e.stopPropagation();
                try { await deleteTemplate(op, t.name, t.where); } catch (_) { /* */ }
                renderList();
            });
        });
    }
    renderList();

    _onDocDown = (e) => { if (_pop && !_pop.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) closeTemplatesPopover(); };
    setTimeout(() => document.addEventListener('pointerdown', _onDocDown, true), 0);
}
