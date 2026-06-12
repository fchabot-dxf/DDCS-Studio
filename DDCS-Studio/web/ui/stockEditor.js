/**
 * ui/stockEditor.js — compact Stock popover, opened from the 3D preview's jog bar.
 *
 * Stock is visual, so you set it where you see it. This floats over the whole screen
 * (not confined to the preview drawer) with no backdrop, so the stock keeps updating
 * live in 3D behind it. It edits the same _ddcsSettings.stock the Settings → Stock tab
 * does (via applySettings → broadcasts ddcs:settings-changed → the preview re-renders).
 * Pick a template and tweak dims/shape/show here; Save-as-template still lives in Settings.
 */
import { getSettings, applySettings, STOCK_TEMPLATES } from './settingsPanel.js';

let _pop = null;
let _anchor = null;

const esc = (v) => String(v).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
function tplLabel(t) {
    const dims = t.shape === 'cylinder' ? `Ø${t.y}×${t.x}` : `${t.x}×${t.y}×${t.z}`;
    return `${esc(t.name)} — ${dims}`;
}
function allTpls() {
    const user = getSettings().stockTemplates || [];
    return STOCK_TEMPLATES.map(t => ({ t, builtin: true })).concat(user.map(t => ({ t, builtin: false })));
}

export function toggleStockEditor(anchor) {
    if (_pop) { closeStockEditor(); return; }
    openStockEditor(anchor);
}

export function openStockEditor(anchor) {
    closeStockEditor();
    _anchor = anchor || null;
    const s = getSettings().stock || {};
    const list = allTpls();
    const pop = document.createElement('div');
    pop.className = 'stock-editor-pop';
    pop.style.cssText = 'position:fixed; left:50%; top:13%; transform:translateX(-50%); z-index:1000;' +
        'background:rgba(20,22,28,0.98); border:1px solid rgba(255,255,255,0.14); border-radius:8px;' +
        'padding:12px 14px; color:#e6ecf2; font-size:12px; width:300px; box-shadow:0 10px 34px rgba(0,0,0,0.55);';
    pop.innerHTML = `
        <style>
            .stock-editor-pop input, .stock-editor-pop select { width:100%; box-sizing:border-box; background:#11141a; color:#e6ecf2; border:1px solid #3a414d; border-radius:4px; padding:3px 5px; }
            .stock-editor-pop label.col { display:flex; flex-direction:column; gap:2px; }
        </style>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span style="font-weight:bold; letter-spacing:1px; color:#9fb4cc;">STOCK</span>
            <button id="se_close" class="toolbar-btn" style="padding:1px 8px;" title="Close">✕</button>
        </div>
        <label class="col" style="margin-bottom:10px;">Template
            <select id="se_tpl">
                <option value="">— template —</option>
                ${list.map((e, i) => `<option value="${i}">${e.builtin ? '' : '⭐ '}${tplLabel(e.t)}</option>`).join('')}
            </select>
        </label>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:10px;">
            <label class="col">X<input id="se_x" type="number" min="0" step="1"></label>
            <label class="col">Y<input id="se_y" type="number" min="0" step="1"></label>
            <label class="col">Z<input id="se_z" type="number" min="0" step="1"></label>
        </div>
        <label class="col" style="margin-bottom:10px;">Shape
            <select id="se_shape">
                <option value="boss">Boss — probe the outside</option>
                <option value="pocket">Pocket — probe the inside</option>
                <option value="cylinder">Cylinder — rotary stock</option>
            </select>
        </label>
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; width:auto;"><input id="se_show" type="checkbox" style="width:auto;"> Show stock in 3D</label>
        <div style="margin-top:10px; color:#7f8a99; font-size:11px;">Cylinder lies along the rotary axis (Y = diameter, X = length). Save presets in Settings → Stock.</div>
    `;
    document.body.appendChild(pop);
    _pop = pop;

    const q = (id) => pop.querySelector('#' + id);
    q('se_x').value = s.x ?? '';
    q('se_y').value = s.y ?? '';
    q('se_z').value = s.z ?? '';
    q('se_shape').value = s.shape || 'boss';
    q('se_show').checked = s.show !== false;

    const commit = () => applySettings({ stock: {
        x: parseFloat(q('se_x').value) || 0,
        y: parseFloat(q('se_y').value) || 0,
        z: parseFloat(q('se_z').value) || 0,
        shape: q('se_shape').value,
        show: q('se_show').checked,
    } });
    ['se_x', 'se_y', 'se_z', 'se_shape', 'se_show'].forEach((id) => {
        q(id).addEventListener('input', commit);
        q(id).addEventListener('change', commit);
    });
    q('se_tpl').addEventListener('change', () => {
        const i = q('se_tpl').value === '' ? -1 : parseInt(q('se_tpl').value, 10);
        const all = allTpls();
        if (i < 0 || !all[i]) return;
        const t = all[i].t;
        q('se_x').value = t.x; q('se_y').value = t.y; q('se_z').value = t.z;
        q('se_shape').value = t.shape || 'boss';
        commit();
    });
    q('se_close').addEventListener('click', closeStockEditor);
    // keep pointer events on the popover from reaching the 3D orbit handler
    pop.addEventListener('pointerdown', (e) => e.stopPropagation());
    setTimeout(() => document.addEventListener('pointerdown', _onDoc, true), 0);
}

function _onDoc(e) {
    if (!_pop) return;
    if (_pop.contains(e.target)) return;
    if (_anchor && (e.target === _anchor || _anchor.contains(e.target))) return; // let the button toggle
    closeStockEditor();
}

export function closeStockEditor() {
    if (_pop) { _pop.remove(); _pop = null; _anchor = null; document.removeEventListener('pointerdown', _onDoc, true); }
}
