/**
 * ui/stockEditor.js — compact Stock popover, opened from the 3D preview's jog bar.
 *
 * Stock is visual, so you set it where you see it. This floats over the whole screen
 * (not confined to the preview drawer) with no backdrop, so the stock keeps updating
 * live in 3D behind it. It edits the same _ddcsSettings.stock the Settings → Stock tab
 * does (via applySettings → broadcasts ddcs:settings-changed → the preview re-renders).
 * Pick a template, tweak dims/shape/show, and save/delete your own templates here.
 */
import { getSettings, applySettings, STOCK_TEMPLATES } from './settingsPanel.js';
import { makeDraggable } from './uiUtils.js';

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
    const pop = document.createElement('div');
    pop.className = 'stock-editor-pop';
    pop.style.cssText = 'position:fixed; left:50%; top:13%; transform:translateX(-50%); z-index:10050;' +
        'background:rgba(20,22,28,0.98); border:1px solid rgba(255,255,255,0.14); border-radius:8px;' +
        'padding:12px 14px; color:#e6ecf2; font-size:12px; width:300px; box-shadow:0 10px 34px rgba(0,0,0,0.55);';
    pop.innerHTML = `
        <style>
            .stock-editor-pop input, .stock-editor-pop select { width:100%; box-sizing:border-box; background:#11141a; color:#e6ecf2; border:1px solid #3a414d; border-radius:4px; padding:3px 5px; }
            .stock-editor-pop label.col { display:flex; flex-direction:column; gap:2px; }
            .se-datum-pick { background:#11141a; border:1px solid #3a414d; border-radius:4px; padding:3px; }
            .se-datum-pick svg { display:block; width:100%; height:auto; }
            .se-datum-pick circle { fill:#2a3340; stroke:#5a6675; stroke-width:1; cursor:pointer; transition:fill 80ms; }
            .se-datum-pick circle:hover { fill:#3a4655; }
            .se-datum-pick circle.sel { fill:#ffb454; stroke:#ffe0b0; stroke-width:1.6; }
        </style>
        <div class="stock-editor-head" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <span style="font-weight:bold; letter-spacing:1px; color:#9fb4cc;">STOCK</span>
            <button id="se_close" class="toolbar-btn" style="padding:1px 8px;" title="Close">✕</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:4px; margin-bottom:10px;">
            <label class="col">Template
                <select id="se_tpl">
                    <option value="">— template —</option>
                </select>
            </label>
            <div style="display:flex; gap:6px;">
                <button id="se_tpl_save" class="toolbar-btn" style="flex:1; padding:3px 5px; font-size:11px;" title="Save current settings as a template">⭐ Save template</button>
                <button id="se_tpl_del" class="toolbar-btn" style="flex:1; padding:3px 5px; font-size:11px; display:none;" title="Delete selected template">🗑 Delete</button>
            </div>
            <div id="se_tpl_saverow" style="display:none; gap:6px; margin-top:6px;">
                <input id="se_tpl_name" type="text" placeholder="Template name…" style="flex:1;">
                <button id="se_tpl_ok" class="toolbar-btn" style="padding:3px 9px;" title="Save">✓</button>
                <button id="se_tpl_cancel" class="toolbar-btn" style="padding:3px 9px;" title="Cancel">✕</button>
            </div>
        </div>
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
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:10px;">
            <label class="col">Part-zero (datum)
                <div id="se_datum_pick" class="se-datum-pick" title="Click the box point of the stock that is your part-zero / program origin"></div>
                <span id="se_datum_name" style="font-size:10px; color:#9fb4cc; text-align:center;"></span>
            </label>
            <label class="col">Sits at WCS
                <select id="se_pin" title="Where this stock sits in the machine: the program zero, or pinned to a WCS offset from the table (Settings → Hardware → WCS). This is the stock's WCS — the op runs from its datum.">
                    <option value="origin">Program zero</option>
                    <option value="g54">G54</option><option value="g55">G55</option><option value="g56">G56</option>
                    <option value="g57">G57</option><option value="g58">G58</option><option value="g59">G59</option>
                </select>
            </label>
        </div>
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; width:auto;"><input id="se_show" type="checkbox" style="width:auto;"> Show stock in 3D</label>
        <div style="margin-top:10px; color:#7f8a99; font-size:11px;">Cylinder lies along the rotary axis (Y = diameter, X = length).</div>
    `;
    document.body.appendChild(pop);
    _pop = pop;
    makeDraggable(pop, pop.querySelector('.stock-editor-head'));

    const q = (id) => pop.querySelector('#' + id);
    // Visual datum picker: a 3D stock box with the 26 BOX POINTS (8 corners + 12 edge mids + 6 face centres;
    // the body centre is excluded). The chosen point is a 3-char code [X][Y][Z], each n(min)/c(centre)/p(max).
    const datumPick = q('se_datum_pick');
    const CH = ['n', 'c', 'p'];
    const X_W = { n: 'left', c: '', p: 'right' }, Y_W = { n: 'front', c: '', p: 'back' }, Z_W = { n: 'bottom', c: '', p: 'top' };
    const OLD_DATUM = { fl: 'nnp', fr: 'pnp', bl: 'npp', br: 'ppp', center: 'ccp' };
    const migrateDatum = (d) => (d && /^[ncp]{3}$/.test(d)) ? d : (OLD_DATUM[d] || 'nnp');
    const datumName = (code) => {
        const w = [Z_W[code[2]], Y_W[code[1]], X_W[code[0]]].filter(Boolean).join(' ');
        return w ? w[0].toUpperCase() + w.slice(1) : 'Centre';
    };
    const projDatum = (a, b, c) => [60 + 24 * (a - b), 78 + 14 * (a + b) - 30 * c];   // iso: X↘  Y↙  Z↑
    const getDatum = () => migrateDatum(datumPick && datumPick.dataset.datum);
    const renderDatumPicker = (sel) => {
        if (!datumPick) return;
        const corners = [];
        for (const a of [0, 2]) for (const b of [0, 2]) for (const c of [0, 2]) corners.push([a, b, c]);
        let edges = '';
        for (let i = 0; i < corners.length; i++) for (let j = i + 1; j < corners.length; j++) {
            const diff = (corners[i][0] !== corners[j][0]) + (corners[i][1] !== corners[j][1]) + (corners[i][2] !== corners[j][2]);
            if (diff === 1) { const p1 = projDatum(...corners[i]), p2 = projDatum(...corners[j]); edges += `<line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" stroke="#414c5a" stroke-width="1"></line>`; }
        }
        let dots = '';
        for (let c = 0; c < 3; c++) for (let b = 0; b < 3; b++) for (let a = 0; a < 3; a++) {
            if (a === 1 && b === 1 && c === 1) continue;   // exclude the body centre → 26 points
            const code = CH[a] + CH[b] + CH[c];
            const [px, py] = projDatum(a, b, c);
            dots += `<circle data-d="${code}" cx="${px}" cy="${py}" r="5"${code === sel ? ' class="sel"' : ''}></circle>`;
        }
        datumPick.dataset.datum = sel;
        datumPick.innerHTML = `<svg viewBox="0 0 120 152" aria-label="Datum picker">
            <text x="110" y="116" fill="#ff8a8a" font-size="9" font-weight="bold" text-anchor="middle">X</text>
            <text x="10" y="116" fill="#8fe08f" font-size="9" font-weight="bold" text-anchor="middle">Y</text>
            <text x="60" y="12" fill="#8ab4ff" font-size="9" font-weight="bold" text-anchor="middle">Z</text>
            ${edges}${dots}</svg>`;
        const nm = q('se_datum_name'); if (nm) nm.textContent = datumName(sel);
    };
    const setDatum = (v) => renderDatumPicker(migrateDatum(v));
    q('se_x').value = s.x ?? '';
    q('se_y').value = s.y ?? '';
    q('se_z').value = s.z ?? '';
    q('se_shape').value = s.shape || 'boss';
    setDatum(s.datum);
    q('se_pin').value = s.pin || 'origin';
    q('se_show').checked = s.show !== false;

    const updateTplDel = () => {
        const sel = q('se_tpl');
        const del = q('se_tpl_del');
        if (!sel || !del) return;
        const i = sel.value === '' ? -1 : parseInt(sel.value, 10);
        const list = allTpls();
        del.style.display = (i >= 0 && list[i] && !list[i].builtin) ? '' : 'none';
    };

    const rebuildTplDropdown = (selIdx) => {
        const sel = q('se_tpl');
        if (!sel) return;
        const list = allTpls();
        sel.innerHTML = '<option value="">— template —</option>' +
            list.map((e, i) => `<option value="${i}">${e.builtin ? '' : '⭐ '}${tplLabel(e.t)}</option>`).join('');
        sel.value = selIdx != null ? String(selIdx) : '';
        updateTplDel();
    };

    rebuildTplDropdown();

    const commit = () => applySettings({ stock: {
        x: parseFloat(q('se_x').value) || 0,
        y: parseFloat(q('se_y').value) || 0,
        z: parseFloat(q('se_z').value) || 0,
        shape: q('se_shape').value,
        datum: getDatum(),
        pin: q('se_pin').value,
        show: q('se_show').checked,
    } });

    ['se_x', 'se_y', 'se_z', 'se_shape', 'se_pin', 'se_show'].forEach((id) => {
        q(id).addEventListener('input', commit);
        q(id).addEventListener('change', commit);
    });
    // Datum dots are re-rendered on each pick, so delegate the click to the container.
    if (datumPick) datumPick.addEventListener('click', (e) => { const c = e.target.closest('circle[data-d]'); if (!c) return; setDatum(c.dataset.d); commit(); });

    q('se_tpl').addEventListener('change', () => {
        const i = q('se_tpl').value === '' ? -1 : parseInt(q('se_tpl').value, 10);
        const all = allTpls();
        updateTplDel();
        if (i < 0 || !all[i]) return;
        const t = all[i].t;
        q('se_x').value = t.x; q('se_y').value = t.y; q('se_z').value = t.z;
        q('se_shape').value = t.shape || 'boss';
        if (t.datum) setDatum(t.datum);
        if (t.pin) q('se_pin').value = t.pin;
        commit();
    });

    const saverow = q('se_tpl_saverow');
    q('se_tpl_save').addEventListener('click', () => { saverow.style.display = 'flex'; const n = q('se_tpl_name'); n.value = ''; n.focus(); });
    q('se_tpl_cancel').addEventListener('click', () => { saverow.style.display = 'none'; });
    const doSaveTpl = () => {
        const name = (q('se_tpl_name').value || '').trim();
        if (!name) { q('se_tpl_name').focus(); return; }
        const currentTemplates = getSettings().stockTemplates || [];
        const newTemplate = {
            name,
            x: parseFloat(q('se_x').value) || 0,
            y: parseFloat(q('se_y').value) || 0,
            z: parseFloat(q('se_z').value) || 0,
            shape: q('se_shape').value || 'boss',
            datum: getDatum(), pin: q('se_pin').value,
        };
        const updated = [...currentTemplates, newTemplate];
        applySettings({ stockTemplates: updated });
        saverow.style.display = 'none';
        rebuildTplDropdown(STOCK_TEMPLATES.length + updated.length - 1);
    };
    q('se_tpl_ok').addEventListener('click', doSaveTpl);
    q('se_tpl_name').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSaveTpl(); else if (e.key === 'Escape') saverow.style.display = 'none'; });

    q('se_tpl_del').addEventListener('click', () => {
        const sel = q('se_tpl');
        const i = sel.value === '' ? -1 : parseInt(sel.value, 10);
        const list = allTpls();
        if (i < 0 || !list[i] || list[i].builtin) return;
        const userIdx = i - STOCK_TEMPLATES.length;
        const currentTemplates = getSettings().stockTemplates || [];
        const updated = [...currentTemplates];
        updated.splice(userIdx, 1);
        applySettings({ stockTemplates: updated });
        rebuildTplDropdown();
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
