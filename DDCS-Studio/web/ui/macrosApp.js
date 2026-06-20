/**
 * ui/macrosApp.js — the MACROS main-tab view (promoted out of Settings: these are authoring surfaces,
 * not configuration). Three builders: custom M-codes (O100nn), K-buttons (key-N.nc), and the CAM Pack
 * Builder. M-codes/K-buttons persist in the profile via getSettings()/saveSettings(); the CAM pack is a
 * distributable kept in localStorage. Mounted lazily into #macros-app by showApp('macros').
 */
import { getSettings, saveSettings } from './settingsPanel.js';
import { makeClient } from '../shared/js/client.js';
import * as camPack from '../data/camPack.js';
import { bmpDataUrl } from '../data/bmp.js';
import { openIconEditor } from './iconEditor.js';
import { slotFromOp } from '../data/opToSlot.js';
import { cornerSlot, edgeSlot, probeZSlot, insideCentreSlot, bossCentreSlot, alignmentSlot } from '../data/probeToSlot.js';
import { pocketSlot, circlePocketSlot, surfacingSlot } from '../data/millToSlot.js';
import { autoIconBmp } from '../data/autoIcon.js';
import { auditMacroVars } from '../data/varMap.js';
import { makeZip, downloadBytes } from '../data/zip.js';
import { createPreviewPanel } from '../viz/createPreviewPanel.js';

let _wired = false;

export function initMacrosApp() {
    const root = document.getElementById('macros-app');
    if (!root || _wired) return; _wired = true;

    root.innerHTML = `
        <div style="padding:16px; overflow:auto; height:100%; box-sizing:border-box;">
            <div style="display:flex; gap:8px; margin-bottom:14px; border-bottom:1px solid var(--border); padding-bottom:8px;">
                <button class="toolbar-btn settings-io macros-sub active" data-msub="m">Macros — M-codes &amp; K-buttons</button>
                <button class="toolbar-btn settings-io macros-sub" data-msub="c">CAM Pack Builder</button>
            </div>
            <div id="macros_sub_m">
                <div class="settings-section">
                    <div class="settings-section-title">CUSTOM M-CODES</div>
                    <div class="settings-hint">Macros called <b>from a program</b> — O100nn ⇄ <b>M<i>nn</i></b> (e.g. M15 tool-break check). Build one with a wizard in Studio, then <b>＋ Add from editor</b>. <b>Generate</b> wraps it as the installable O100nn block. Saved with your Profile.</div>
                    <div id="mcodes_list"></div>
                    <div class="settings-row" style="margin-top:8px;">
                        <button class="toolbar-btn settings-io" id="mcodes_add_editor">＋ Add from editor</button>
                        <button class="toolbar-btn settings-io" id="mcodes_add_blank">＋ Add blank</button>
                    </div>
                </div>
                <div class="settings-section">
                    <div class="settings-section-title">K-BUTTONS (K1–K7)</div>
                    <div class="settings-hint">The 7 panel buttons — each runs <b>key-<i>N</i>.nc</b> when pressed. Type/paste a body or <b>⇪ From editor</b>, then <b>Generate</b> for the install file. Empty = unused.</div>
                    <div id="kbuttons_list"></div>
                </div>
            </div>
            <div id="macros_sub_c" style="display:none">
                <div class="settings-section">
                    <div class="settings-section-title">CAM PACK BUILDER</div>
                    <div class="settings-hint">Author a DDCS Expert <b>CAM-menu pack</b> — parameterized macro slots for the controller's CAM page — to share with the community. Each slot = a <b>form</b> + a <b>macro</b> that reads the form live (the <code>#2600+</code> mirrors). Studio auto-allocates the shared <code>#1100–1499</code> form params and flags collisions. <i>Phase 1: form designer + macro + plain export. Icons + eng-merge install come next.</i></div>
                    <div class="settings-row"><label>Pack name<input type="text" id="cam_pack_name"></label><button class="toolbar-btn settings-io" id="cam_add_slot">＋ Add slot</button><button class="toolbar-btn settings-io" id="cam_export_pack" title="Bundle every slot (macro_camN.nc + camN.bmp) + the eng lines to merge + an install README into a USB-ready .zip.">📦 Export pack (.zip)</button><button class="toolbar-btn settings-io" id="cam_merge_eng" title="Paste the controller's CURRENT eng file → get a safely-merged eng (your pack appended, #param / -m group collisions flagged). Avoids the community full-replace mistake.">🔗 Merge eng</button></div>
                    <div id="cam_validate" class="settings-hint" style="margin-top:6px;"></div>
                    <div id="cam_slots" style="margin-top:6px;"></div>
                </div>
            </div>
        </div>`;

    const q = (id) => root.querySelector('#' + id);
    root.querySelectorAll('[data-msub]').forEach((b) => b.addEventListener('click', () => {
        root.querySelectorAll('[data-msub]').forEach((x) => x.classList.toggle('active', x === b));
        q('macros_sub_m').style.display = b.dataset.msub === 'm' ? '' : 'none';
        q('macros_sub_c').style.display = b.dataset.msub === 'c' ? '' : 'none';
    }));

    // --- Macros: author controller macros (M-code O100nn / K-button key-N); saved in the profile. ---
    const macrosArr = () => (getSettings().macros || (getSettings().macros = []));
    const editorText = () => { const e = document.getElementById('editor'); return e ? e.value : ''; };
    function macroFileText(m) {
        const name = (m.name || 'macro').trim();
        const body = String(m.body || '').replace(/\r/g, '').replace(/\s+$/, '');
        const t = m.trigger || {};
        const hasEnd = /\b(M99|M30|M0?2)\b/.test(body);
        if (t.kind === 'mcode') { const n = Math.max(0, parseInt(t.code, 10) || 0); return `O${10000 + n} ( ${name} — M${n} )\n${body}${hasEnd ? '' : '\nM99'}\n`; }
        if (t.kind === 'kbutton') { const k = Math.min(7, Math.max(1, parseInt(t.key, 10) || 1)); return `( save as key-${k}.nc on SYSDISK — K${k} button )\n${body}${hasEnd ? '' : '\nM30'}\n`; }
        return `( save as ${(name || 'macro').replace(/[^\w-]+/g, '_')}.nc )\n${body}${hasEnd ? '' : '\nM30'}\n`;
    }
    const insertToEditor = (txt) => { const em = (window.ddcsStudio && window.ddcsStudio.editorManager) || window.editorManager; if (em && typeof em.insert === 'function') em.insert(txt); else alert('Editor not available.'); };
    const findKbtn = (k) => macrosArr().find((m) => (m.trigger || {}).kind === 'kbutton' && (m.trigger || {}).key === k);
    const ensureKbtn = (k) => { let m = findKbtn(k); if (!m) { m = { name: '', trigger: { kind: 'kbutton', key: k }, body: '' }; macrosArr().push(m); } return m; };
    async function pushMcode(m) {
        const n = parseInt((m.trigger || {}).code, 10) || 0; const oNum = 'O' + (10000 + n);
        if (!confirm(`Merge M${n} (${oNum}) into the controller's macro library (slib-m.nc)?\n\nThe existing slib-m.nc is backed up first (slib-m.nc.bak). You must REBOOT the controller afterward for it to load.`)) return;
        try {
            const cur = await makeClient().readSysfile('slib-m.nc');
            if (!cur || cur.ok === false) { alert('Could not read slib-m.nc — needs the gateway/desktop app + a connected controller.' + (cur && cur.error ? '\n(' + cur.error + ')' : '')); return; }
            if (new RegExp('(^|\\s)' + oNum + '(\\s|$)').test(cur.content || '')) { alert(`${oNum} is already in slib-m.nc — remove it on the controller first so it isn't duplicated, then push again.`); return; }
            const res = await makeClient().writeSysfile('slib-m.nc', '\n' + macroFileText(m), 'append');
            if (res && res.ok) alert(`Merged ${oNum} (M${n}) into slib-m.nc${res.backup ? ' — backup ' + res.backup : ''}.\n\nReboot the controller to load it; then M${n} is callable from a program.`);
            else alert('Push failed: ' + ((res && res.error) || 'unknown'));
        } catch (err) { alert('Push failed: ' + (err && err.message ? err.message : err)); }
    }
    async function pushKbutton(k, m) {
        if (!confirm(`Write key-${k}.nc to the controller (the K${k} button)?\n\nThe existing key-${k}.nc is backed up first (key-${k}.nc.bak).`)) return;
        try {
            const res = await makeClient().writeSysfile('key-' + k + '.nc', macroFileText(m), 'write');
            if (res && res.ok) alert(`Wrote key-${k}.nc${res.backup ? ' — backup ' + res.backup : ''}.\nPress K${k} to run it (reboot if the controller doesn't pick it up).`);
            else alert('Push failed: ' + ((res && res.error) || 'needs the gateway/desktop app + a connected controller'));
        } catch (err) { alert('Push failed: ' + (err && err.message ? err.message : err)); }
    }
    function renderMcodes() {
        const host = q('mcodes_list'); if (!host) return;
        const rows = macrosArr().map((m, i) => ({ m, i })).filter((x) => (x.m.trigger || {}).kind === 'mcode');
        if (!rows.length) { host.innerHTML = '<div class="settings-hint">No custom M-codes yet — “＋ Add from editor” or “＋ Add blank”.</div>'; return; }
        host.innerHTML = rows.map(({ m, i }) => `<div class="macro-card" data-i="${i}" style="border:1px solid var(--border); border-radius:6px; padding:8px; margin-bottom:8px;">
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                <label style="font-size:11px; color:var(--text-dim);">M<input type="number" class="mc-f" data-f="num" value="${(m.trigger || {}).code != null ? m.trigger.code : 15}" min="0" max="99" style="width:52px; margin-left:2px;"></label>
                <input class="mc-f" data-f="name" value="${String(m.name || '').replace(/"/g, '&quot;')}" placeholder="Name" style="flex:1; min-width:120px;">
                <span class="mc-o" style="font-size:10px; color:var(--text-dim);">→ O${10000 + (parseInt((m.trigger || {}).code, 10) || 0)}</span>
            </div>
            <textarea class="mc-f" data-f="body" spellcheck="false" placeholder="macro body (G-code)" style="width:100%; height:110px; margin-top:6px; font:12px/1.4 monospace; box-sizing:border-box;">${String(m.body || '').replace(/</g, '&lt;')}</textarea>
            <div class="settings-row" style="margin-top:6px;"><button class="toolbar-btn settings-io" data-act="gen">⬇ Generate</button><button class="toolbar-btn settings-io" data-act="push">⬆ Push to controller</button><span style="flex:1"></span><button class="op-btn" data-act="del" title="Delete">✕</button></div>
        </div>`).join('');
    }
    function renderKbuttons() {
        const host = q('kbuttons_list'); if (!host) return;
        let html = '';
        for (let k = 1; k <= 7; k++) {
            const m = findKbtn(k);
            html += `<div class="kbtn-row" data-k="${k}" style="border:1px solid var(--border); border-radius:6px; padding:8px; margin-bottom:8px;">
                <div style="display:flex; gap:8px; align-items:center;">
                    <b style="width:30px;">K${k}</b>
                    <input class="kb-f" data-f="name" value="${m ? String(m.name || '').replace(/"/g, '&quot;') : ''}" placeholder="(unused)" style="flex:1;">
                    <span style="font-size:10px; color:var(--text-dim);">key-${k}.nc</span>
                </div>
                <textarea class="kb-f" data-f="body" spellcheck="false" placeholder="button macro body" style="width:100%; height:80px; margin-top:6px; font:12px/1.4 monospace; box-sizing:border-box;">${m ? String(m.body || '').replace(/</g, '&lt;') : ''}</textarea>
                <div class="settings-row" style="margin-top:6px;"><button class="toolbar-btn settings-io" data-act="ked">⇪ From editor</button><button class="toolbar-btn settings-io" data-act="kgen">⬇ Generate</button><button class="toolbar-btn settings-io" data-act="kpush">⬆ Push</button><span style="flex:1"></span><button class="op-btn" data-act="kclr" title="Clear">✕</button></div>
            </div>`;
        }
        host.innerHTML = html;
    }
    const mch = q('mcodes_list');
    if (mch) {
        mch.addEventListener('input', (e) => {
            const c = e.target.closest('.macro-card'); if (!c || !e.target.dataset.f) return;
            const m = macrosArr()[+c.dataset.i]; if (!m) return; const f = e.target.dataset.f;
            if (f === 'name') m.name = e.target.value;
            else if (f === 'body') m.body = e.target.value;
            else if (f === 'num') { m.trigger = m.trigger || { kind: 'mcode' }; m.trigger.kind = 'mcode'; m.trigger.code = parseInt(e.target.value, 10) || 0; const s = c.querySelector('.mc-o'); if (s) s.textContent = '→ O' + (10000 + m.trigger.code); }
            saveSettings();
        });
        mch.addEventListener('click', (e) => {
            const c = e.target.closest('.macro-card'); if (!c) return; const i = +c.dataset.i; const a = e.target.dataset.act;
            if (a === 'del') { macrosArr().splice(i, 1); saveSettings(); renderMcodes(); }
            else if (a === 'gen') insertToEditor(macroFileText(macrosArr()[i]));
            else if (a === 'push') pushMcode(macrosArr()[i]);
        });
    }
    const kbh = q('kbuttons_list');
    if (kbh) {
        kbh.addEventListener('input', (e) => { const r = e.target.closest('.kbtn-row'); if (!r || !e.target.dataset.f) return; const m = ensureKbtn(+r.dataset.k); if (e.target.dataset.f === 'name') m.name = e.target.value; else m.body = e.target.value; saveSettings(); });
        kbh.addEventListener('click', (e) => {
            const r = e.target.closest('.kbtn-row'); if (!r) return; const k = +r.dataset.k; const a = e.target.dataset.act;
            if (a === 'ked') { ensureKbtn(k).body = editorText().trim(); saveSettings(); renderKbuttons(); }
            else if (a === 'kgen') { const m = findKbtn(k); if (!m || !String(m.body).trim()) { alert('K' + k + ' is empty.'); return; } insertToEditor(macroFileText(m)); }
            else if (a === 'kpush') { const m = findKbtn(k); if (!m || !String(m.body).trim()) { alert('K' + k + ' is empty.'); return; } pushKbutton(k, m); }
            else if (a === 'kclr') { const i = macrosArr().findIndex((x) => (x.trigger || {}).kind === 'kbutton' && (x.trigger || {}).key === k); if (i >= 0) macrosArr().splice(i, 1); saveSettings(); renderKbuttons(); }
        });
    }
    const _mcAddEd = q('mcodes_add_editor');
    if (_mcAddEd) _mcAddEd.addEventListener('click', () => { macrosArr().push({ name: 'New M-code', trigger: { kind: 'mcode', code: 15 }, body: editorText().trim() }); saveSettings(); renderMcodes(); });
    const _mcAddBlank = q('mcodes_add_blank');
    if (_mcAddBlank) _mcAddBlank.addEventListener('click', () => { macrosArr().push({ name: 'New M-code', trigger: { kind: 'mcode', code: 15 }, body: '' }); saveSettings(); renderMcodes(); });
    renderMcodes(); renderKbuttons();

    // --- CAM Pack Builder (Phase 1): author CAM-menu slots (form + macro), auto-allocate #11xx, export. ---
    const CAMPACK_KEY = 'ddcs_campack';
    const loadCamPack = () => { try { const p = JSON.parse(localStorage.getItem(CAMPACK_KEY)); if (p && Array.isArray(p.slots)) return p; } catch (e) { /* */ } return { meta: { name: 'My CAM pack', baseSlot: 22 }, slots: [] }; };
    let _camPack = loadCamPack();
    const saveCamPack = () => { try { localStorage.setItem(CAMPACK_KEY, JSON.stringify(_camPack)); } catch (e) { /* */ } };
    const camEsc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    // The op's SECOND build-time dropdown is context-aware (no dead greyed control): point pattern for
    // drill/bore, raster direction for the rect mill ops, arc direction for the round pocket. The probes (and
    // the standalone slot mill) have no build-time choice — their discrete options are runtime form fields — so
    // the dropdown is hidden for them. The chosen value is passed to the generator as its variant arg.
    const SECOND_CTL = {
        drill:   { title: 'Point pattern the holes are arranged in', opts: [['circle', 'bolt circle'], ['grid', 'grid'], ['line', 'line'], ['rect', 'rectangle']] },
        bore:    { title: 'Point pattern the bores are arranged in', opts: [['circle', 'bolt circle'], ['grid', 'grid'], ['line', 'line'], ['rect', 'rectangle']] },
        pocket:  { title: 'Raster direction — which axis the clearing rows run along', opts: [['x', 'rows ∥ X'], ['y', 'rows ∥ Y']] },
        surface: { title: 'Raster direction — which axis the facing rows run along', opts: [['x', 'rows ∥ X'], ['y', 'rows ∥ Y']] },
        cpocket: { title: 'Ring direction (CW spindle): climb = CCW/G3, conventional = CW/G2', opts: [['G3', 'climb (G3)'], ['G2', 'conventional (G2)']] },
    };
    const secondCtlOpts = (method, sel) => (SECOND_CTL[method] ? SECOND_CTL[method].opts.map(([val, lbl]) => `<option value="${val}"${sel === val ? ' selected' : ''}>${lbl}</option>`).join('') : '');
    const secondCtlTitle = (method) => (SECOND_CTL[method] ? SECOND_CTL[method].title : '');
    // Rebuild the second dropdown's options + tooltip for a method, hiding it when the op has no build-time choice.
    function applySecondCtl(sel, method) {
        const has = !!SECOND_CTL[method];
        sel.innerHTML = secondCtlOpts(method);
        sel.title = secondCtlTitle(method);
        sel.style.display = has ? '' : 'none';
    }
    // ---- Structured op model: a slot can remember the OPS it was built from (slot.ops = [{type, variant}]) so
    // they can be edited as cards and the macro REGENERATED from them. Legacy/hand-built slots (no slot.ops) keep
    // the raw-text workflow untouched. ----
    const OP_LABEL = { drill: 'Drill', bore: 'Bore', slot: 'Slot', pocket: 'Pocket (rect)', cpocket: 'Pocket (circle)', surface: 'Surface / face', corner: 'Probe corner', edge: 'Probe edge', zprobe: 'Probe Z surface', inside: 'Probe inside centre', boss: 'Probe boss centre', align: 'Probe alignment' };
    const CAM_GEN = { corner: cornerSlot, edge: edgeSlot, zprobe: probeZSlot, inside: insideCentreSlot, boss: bossCentreSlot, align: alignmentSlot, pocket: pocketSlot, cpocket: circlePocketSlot, surface: surfacingSlot };
    const opTypeOpts = (sel) => Object.entries(OP_LABEL).map(([v, l]) => `<option value="${v}"${sel === v ? ' selected' : ''}>${l}</option>`).join('');
    const defaultVariant = (type) => (SECOND_CTL[type] ? SECOND_CTL[type].opts[0][0] : '');
    // Generate one op into a starting point. The mill/probe ops live in CAM_GEN; drill/bore/slot go via slotFromOp.
    const generateOp = (type, variant, used, off) => (CAM_GEN[type] ? CAM_GEN[type](used, off, variant) : slotFromOp(type, variant, used, off));
    // Columns the user can tune in the field table that we PERSIST per op (so a regenerate keeps them, matched by
    // field key). `var` is generator-assigned (renaming would desync the body) and `type` has no column, so neither
    // is persisted. Stored on the op as op.values[key] = {def, min, max, label, units}.
    const FIELD_OVR_COLS = ['label', 'units', 'def', 'min', 'max'];
    // A read-line in canonical form (identical to what every generator emits) — used to re-sync the macro comment
    // to a tuned field so the table, the macro, Simulate and "Refresh fields" all agree.
    const canonicalRead = (f) => `${f.var}=#${f.idx + 1500}   ;${f.label}${f.units ? ' [' + f.units + ']' : ''} =${f.def} [${f.min}~${f.max}]`;
    function applyOverridesToBody(body, fields, values) {
        let out = body;
        fields.forEach((f) => {
            if (!values[f.key]) return;   // only fields the user actually tuned
            const re = new RegExp('^[ \\t]*' + f.var.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=#' + (f.idx + 1500) + '\\b.*$', 'm');
            if (re.test(out)) out = out.replace(re, canonicalRead(f));
        });
        return out;
    }
    // Rebuild a slot's fields + body + name from its op list. Params are allocated AROUND the other slots' params
    // (so a regenerate doesn't collide), and vars continue across ops — exactly the Add-op append sequence. Each
    // field is tagged with its owning op (_op) and any value the user tuned on that op (op.values) is re-applied to
    // both the field and its macro read-line; only keys carried over by the new op/variant survive. Icon untouched.
    function buildSlotFromOps(slot) {
        const used = new Set();
        _camPack.slots.forEach((s) => { if (s !== slot) (s.fields || []).forEach((f) => used.add(f.idx)); });
        let fields = [], parts = [], name = '';
        (slot.ops || []).forEach((op, oi) => {
            const gen = generateOp(op.type, op.variant, used, fields.length);
            let body = gen.body;
            gen.fields.forEach((f) => {
                used.add(f.idx);
                f._op = oi;
                const ov = op.values && op.values[f.key];
                if (ov) FIELD_OVR_COLS.forEach((k) => { if (ov[k] !== undefined) f[k] = ov[k]; });
            });
            if (op.values) body = applyOverridesToBody(body, gen.fields, op.values);
            fields = fields.concat(gen.fields);
            parts.push(body);
            name = name ? name + ' + ' + gen.name.replace(/^(Drill|Bore) — /, '') : gen.name;
        });
        slot.fields = fields;
        slot.body = parts.join('\n\n');
        if (name) slot.name = name;
        slot.bodyDirty = false;
    }
    // A structural edit rebuilds the macro. If the body was hand-edited since the last build, confirm first.
    function regenGuard(slot) { return !slot.bodyDirty || confirm('Rebuild the macro from the ops?\nYour manual edits to the macro body will be discarded.'); }
    // The editable op list for a slot (empty for legacy/hand-built slots with no op manifest).
    function opCardsHtml(slot) {
        if (!slot.ops || !slot.ops.length) return '';
        const cards = slot.ops.map((op, oi) => `<div class="cam-op-card" style="display:flex; align-items:center; gap:6px; padding:4px 6px; background:rgba(127,127,127,.05); border:1px solid var(--border); border-radius:6px;">
                <span style="font-size:10px; color:var(--text-dim); width:14px; text-align:center;">${oi + 1}</span>
                <select class="cam-op-type" data-oi="${oi}" title="Op type — changing it rebuilds this op's fields + macro">${opTypeOpts(op.type)}</select>
                <select class="cam-op-var" data-oi="${oi}" title="${secondCtlTitle(op.type)}"${SECOND_CTL[op.type] ? '' : ' style="display:none"'}>${secondCtlOpts(op.type, op.variant)}</select>
                <span style="flex:1"></span>
                <button class="op-btn" data-act="delop" data-oi="${oi}" title="Remove this op">✕</button>
            </div>`).join('');
        const dirty = slot.bodyDirty ? '<div class="settings-hint" style="color:#fd0; margin:0;">✎ macro hand-edited — changing an op rebuilds it and discards those edits</div>' : '';
        return `<div class="cam-ops" style="margin-top:8px; display:flex; flex-direction:column; gap:5px;">
                <div style="font-size:10px; color:var(--text-dim);">OPS IN THIS SLOT — edit to rebuild the macro (tuned field values are kept where the new op shares the same field)</div>
                ${cards}${dirty}
            </div>`;
    }
    function renderCamBuilder() {
        const host = q('cam_slots'); if (!host) return;
        const nameEl = q('cam_pack_name'); if (nameEl && document.activeElement !== nameEl) nameEl.value = (_camPack.meta && _camPack.meta.name) || '';
        const v = camPack.validatePack(_camPack);
        const vEl = q('cam_validate');
        if (vEl) vEl.innerHTML = [...v.errors.map((e) => '⛔ ' + e), ...v.warnings.map((w) => '⚠ ' + w)].join('<br>') || ('✓ No collisions · ' + camPack.usedParams(_camPack).size + '/400 form params used.');
        if (!_camPack.slots.length) { host.innerHTML = '<div class="settings-hint">No slots yet — “＋ Add slot”. Slots default to cam' + ((_camPack.meta && _camPack.meta.baseSlot) || 22) + '+ (cam0–21 are factory / community).</div>'; return; }
        host.innerHTML = _camPack.slots.map((slot, si) => {
            const fields = slot.fields || [];
            const rows = fields.map((f, fi) => `<tr data-si="${si}" data-fi="${fi}">
                <td><input class="cf" data-f="label" value="${camEsc(f.label)}" placeholder="Label" style="width:100%;"></td>
                <td><input class="cf" data-f="units" value="${camEsc(f.units)}" placeholder="mm" style="width:46px;"></td>
                <td><input class="cf" data-f="def" type="number" value="${f.def != null ? f.def : 0}" style="width:62px;"></td>
                <td><input class="cf" data-f="min" type="number" value="${f.min != null ? f.min : 0}" style="width:62px;"></td>
                <td><input class="cf" data-f="max" type="number" value="${f.max != null ? f.max : 0}" style="width:62px;"></td>
                <td><input class="cf" data-f="var" value="${camEsc(f.var || '#' + (fi + 1))}" style="width:42px;"></td>
                <td style="color:var(--text-dim); font-size:10px; white-space:nowrap;">#${f.idx} → #${camPack.mirrorVar(f.idx)}</td>
                <td><button class="op-btn" data-act="delf" title="Remove field">✕</button></td>
            </tr>`).join('');
            return `<div class="cam-slot" data-si="${si}" style="border:1px solid var(--border); border-radius:6px; padding:8px; margin-bottom:10px;">
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                    <label style="font-size:11px; color:var(--text-dim);">cam<input type="number" class="cs" data-f="slot" value="${slot.slot}" min="0" max="9999" style="width:60px; margin-left:2px;"></label>
                    <input class="cs" data-f="name" value="${camEsc(slot.name)}" placeholder="Slot name" style="flex:1; min-width:120px;">
                    <label style="font-size:10px; color:var(--text-dim);" title="Work coordinate system this slot's macro runs in. Active = whatever G54–G59 the operator has selected; or bake a specific one.">WCS<select class="cs" data-f="wcs" style="margin-left:3px;">${['active', 'G54', 'G55', 'G56', 'G57', 'G58', 'G59'].map((o) => `<option value="${o}"${(slot.wcs || 'active') === o ? ' selected' : ''}>${o === 'active' ? 'Active' : o}</option>`).join('')}</select></label>
                    <span style="font-size:10px; color:var(--text-dim);">-m${camPack.slotGroup(slot.slot)}</span>
                    <button class="op-btn" data-act="dels" title="Remove slot">✕</button>
                </div>
                <div style="display:flex; gap:8px; align-items:center; margin-top:6px;">
                    ${slot.icon ? `<img src="${slot.icon.data}" alt="" style="width:72px; height:36px; object-fit:contain; border:1px solid var(--border); background:#000;"><span style="font-size:10px; color:var(--text-dim);">${camEsc(slot.icon.name)}${slot.icon.w ? ' · ' + slot.icon.w + '×' + slot.icon.h + (slot.icon.w === 360 && slot.icon.h === 180 ? '' : ' ⚠ not 360×180') : ''}</span><button class="op-btn" data-act="delicon" title="Remove icon">✕</button>` : '<span style="font-size:11px; color:var(--text-dim);">No icon (camN.bmp)</span>'}
                    <button class="toolbar-btn settings-io" data-act="edit">🎨 ${slot.icon ? 'Edit' : 'Create'} icon</button>
                    <button class="toolbar-btn settings-io" data-act="icon">🖼 Import BMP</button>
                </div>
                <table style="width:100%; font-size:11.5px; margin-top:6px; border-collapse:collapse;"><thead><tr style="color:var(--text-dim); font-size:10px; text-align:left;"><th>Label</th><th>Units</th><th>Default</th><th>Min</th><th>Max</th><th>Var</th><th>#param→#2600</th><th></th></tr></thead><tbody>${rows}</tbody></table>
                <div class="settings-row" style="margin-top:4px;"><button class="toolbar-btn settings-io" data-act="addf">＋ Add field</button><button class="toolbar-btn settings-io" data-act="refresh" title="Rebuild the field table from the macro's #2600 mirror-read comments — label, units, default and min~max all come from the macro (field type is preserved). Edit a read-line comment, then refresh to apply it.">🔄 Refresh fields from macro</button><span style="flex:1"></span><span style="display:inline-flex; align-items:center; gap:6px; padding:4px 8px; border:1px dashed var(--border); border-radius:6px; background:rgba(127,127,127,.06);"><span style="font-size:10px; color:var(--text-dim); white-space:nowrap;" title="Pick a NEW op to generate into this slot. These do NOT edit the macro below — the macro body is the editable source of truth.">＋ Add op:</span><select class="cam-op"><option value="drill">Drill</option><option value="bore">Bore</option><option value="slot">Slot</option><option value="pocket">Pocket (rect)</option><option value="cpocket">Pocket (circle)</option><option value="surface">Surface / face</option><option value="corner">Probe corner</option><option value="edge">Probe edge</option><option value="zprobe">Probe Z surface</option><option value="inside">Probe inside centre</option><option value="boss">Probe boss centre</option><option value="align">Probe alignment</option></select><select class="cam-op-pat" title="${secondCtlTitle('drill')}">${secondCtlOpts('drill')}</select><button class="toolbar-btn settings-io" data-act="addop" title="Generate the selected op into the slot — fills a blank slot, or APPENDS it to the existing macro (multi-op). It does NOT rewrite code you've already edited; the macro body below is the editable source of truth.">Generate ▸</button></span></div>
                ${opCardsHtml(slot)}
                <textarea class="cs" data-f="body" spellcheck="false" placeholder="macro body — declare fields as  #1=#2600 ;Label [mm] =0 [min~max]  then reference each Var (#1, #2 …)" style="width:100%; height:130px; margin-top:6px; font:12px/1.4 monospace; box-sizing:border-box;">${camEsc(slot.body)}</textarea>
                ${(() => { const a = auditMacroVars(slot.body); return a.danger.length ? `<div class="settings-hint" style="color:#ff6b6b; margin-top:4px;">⚠ macro writes persistent vars — ${a.danger.map(camEsc).join('; ')}</div>` : ''; })()}
                <div class="settings-row" style="margin-top:6px;"><button class="toolbar-btn settings-io" data-act="sim" title="Run this slot's macro in the simulator with each field seeded from its default — verify the toolpath before publishing.">▶ Simulate</button><button class="toolbar-btn settings-io" data-act="exp">⬇ Export macro + eng to editor</button></div>
            </div>`;
        }).join('');
    }
    function importCamIcon(slot) {
        const input = document.createElement('input'); input.type = 'file'; input.accept = '.bmp,image/bmp,image/*';
        input.addEventListener('change', () => {
            const f = input.files && input.files[0]; if (!f) return;
            const r = new FileReader();
            r.onload = () => {
                const data = r.result; const img = new Image();
                img.onload = () => { slot.icon = { name: f.name, data, w: img.naturalWidth, h: img.naturalHeight }; saveCamPack(); renderCamBuilder(); };
                img.onerror = () => { slot.icon = { name: f.name, data }; saveCamPack(); renderCamBuilder(); };
                img.src = data;
            };
            r.readAsDataURL(f);
        });
        input.click();
    }
    async function svgToCamIcon(slot, svgName) {
        try {
            const resp = await fetch('assets/svg/' + svgName + '.svg');
            if (!resp.ok) throw new Error('SVG not found (' + resp.status + ')');
            let svg = (await resp.text()).replace(/width="100%"/, 'width="465"').replace(/height="100%"/, 'height="465"');
            const blobUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
            const img = new Image();
            img.onload = () => {
                const W = 360, H = 180; const c = document.createElement('canvas'); c.width = W; c.height = H;
                const ctx = c.getContext('2d'); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
                const iw = img.naturalWidth || 465, ih = img.naturalHeight || 465; const sc = Math.min(W / iw, H / ih);
                ctx.drawImage(img, (W - iw * sc) / 2, (H - ih * sc) / 2, iw * sc, ih * sc);
                URL.revokeObjectURL(blobUrl);
                try { slot.icon = { name: svgName + '.bmp', data: bmpDataUrl(W, H, ctx.getImageData(0, 0, W, H).data), w: W, h: H, source: 'svg:' + svgName }; saveCamPack(); renderCamBuilder(); }
                catch (e) { alert('Could not read the rendered icon: ' + (e && e.message ? e.message : e)); }
            };
            img.onerror = () => { URL.revokeObjectURL(blobUrl); alert('Could not render ' + svgName + '.svg'); };
            img.src = blobUrl;
        } catch (e) { alert('Palette icon failed: ' + (e && e.message ? e.message : e)); }
    }
    // Simulate a slot: run its macro through the shared preview panel with the #2600 mirrors SEEDED from each
    // field's default (mirror = #param + 1500). Lets the pack author verify the toolpath before publishing —
    // the same engine + 2D/3D view the editor preview uses, in a throwaway modal.
    function simulateSlot(slot) {
        if (window.ddcsStopPreview) window.ddcsStopPreview();   // only one engine runs at a time
        const macro = camPack.slotMacro(slot);
        const seed = new Map();
        (slot.fields || []).forEach((f) => { const v = Number(f.def); seed.set(camPack.mirrorVar(f.idx), Number.isFinite(v) ? v : 0); });
        // Probe macros (G31) trace their full travel unless the engine has stock to clamp to — the panel's
        // Stock button (📦) sets it, so a probe then stops at the real surface instead of running to the limit.
        const isProbe = /\bG31\b/.test(macro);
        const hint = isProbe ? 'probes clamp to Stock (📦) — else they trace full travel' : 'form values seeded from field defaults';
        const overlay = document.createElement('div');
        overlay.className = 'cam-sim-overlay';
        overlay.style.cssText = 'position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center;';
        overlay.innerHTML = `<div style="width:min(1100px,92vw); height:min(760px,88vh); background:var(--panel,#161b22); border:1px solid var(--border); border-radius:10px; display:flex; flex-direction:column; overflow:hidden;">
            <div style="display:flex; align-items:center; gap:10px; padding:8px 12px; border-bottom:1px solid var(--border);">
                <b style="flex:1">▶ Simulate — ${camEsc(slot.name || ('CAM slot ' + slot.slot))}</b>
                <span class="settings-hint" style="margin:0">${hint}</span>
                <button class="toolbar-btn settings-io" data-sim-close>✕ Close</button>
            </div>
            <div class="cam-sim-host" style="flex:1; position:relative; min-height:0;"></div>
        </div>`;
        document.body.appendChild(overlay);
        const panel = createPreviewPanel(overlay.querySelector('.cam-sim-host'), { getGcode: () => macro, createVarStore: () => new Map(seed) });
        panel.setActive(true);
        const close = () => { try { panel.stop(); panel.setActive(false); } catch (_) { /* noop */ } overlay.remove(); document.removeEventListener('keydown', onKey); };
        const onKey = (e) => { if (e.key === 'Escape') close(); };
        overlay.querySelector('[data-sim-close]').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        document.addEventListener('keydown', onKey);
    }

    const camHost = q('cam_slots');
    if (camHost) {
        camHost.addEventListener('input', (e) => {
            const t = e.target; const card = t.closest('.cam-slot'); if (!card) return; const slot = _camPack.slots[+card.dataset.si]; if (!slot) return;
            if (t.classList.contains('cf')) {
                const f = (slot.fields || [])[+t.closest('tr').dataset.fi]; if (!f) return; const fld = t.dataset.f;
                f[fld] = (fld === 'label' || fld === 'units' || fld === 'var') ? t.value : (t.value === '' ? '' : parseFloat(t.value));
                // Structured slot: remember this tuned column on the owning op so a regenerate keeps it.
                if (slot.ops && f._op != null && f.key && FIELD_OVR_COLS.includes(fld)) {
                    const op = slot.ops[f._op];
                    if (op) { op.values = op.values || {}; op.values[f.key] = op.values[f.key] || {}; op.values[f.key][fld] = f[fld]; }
                }
                saveCamPack();
            } else if (t.classList.contains('cs')) {
                const fld = t.dataset.f;
                if (fld === 'slot') { slot.slot = parseInt(t.value, 10) || 0; saveCamPack(); renderCamBuilder(); }
                else { slot[fld] = t.value; if (fld === 'body' && slot.ops && slot.ops.length) slot.bodyDirty = true; saveCamPack(); if (fld !== 'body') renderCamBuilder(); }
            }
        });
        camHost.addEventListener('click', (e) => {
            const card = e.target.closest('.cam-slot'); if (!card) return; const si = +card.dataset.si; const slot = _camPack.slots[si]; if (!slot) return; const a = e.target.dataset.act;
            if (a === 'addf') { slot.fields = slot.fields || []; const idx = camPack.nextParam(camPack.usedParams(_camPack)); if (idx == null) { alert('The #1100–1499 form-param pool is full.'); return; } slot.fields.push({ idx, label: '', units: '', def: 0, min: 0, max: 0, type: 1, var: '#' + (slot.fields.length + 1) }); saveCamPack(); renderCamBuilder(); }
            else if (a === 'delf') { slot.fields.splice(+e.target.closest('tr').dataset.fi, 1); saveCamPack(); renderCamBuilder(); }
            else if (a === 'dels') { _camPack.slots.splice(si, 1); saveCamPack(); renderCamBuilder(); }
            else if (a === 'edit') { openIconEditor(slot.icon || null, (bmp, model) => { slot.icon = { name: (slot.name || 'cam' + slot.slot) + '.bmp', data: bmp, w: 360, h: 180, layers: model.layers }; saveCamPack(); renderCamBuilder(); }); }
            else if (a === 'icon') { importCamIcon(slot); }
            else if (a === 'delicon') { slot.icon = null; saveCamPack(); renderCamBuilder(); }
            else if (a === 'addop') {
                const method = card.querySelector('.cam-op').value, variant = card.querySelector('.cam-op-pat').value;
                // The second dropdown's value is the op's VARIANT: pattern for drill/bore, raster dir ('x'/'y') for
                // pocket/surface, arc dir ('G3'/'G2') for the round pocket. Probes ignore it (runtime form fields).
                const empty = !(slot.fields && slot.fields.length) && !String(slot.body || '').trim();
                if (!slot.ops && !empty) {
                    // Legacy / hand-built slot (no op manifest) — keep the raw-text append so manual work is never lost.
                    const gen = generateOp(method, variant, camPack.usedParams(_camPack), (slot.fields || []).length);
                    slot.fields = (slot.fields || []).concat(gen.fields);
                    slot.body = String(slot.body || '').replace(/\s+$/, '') + '\n\n' + gen.body;
                    slot.name = (slot.name || 'Slot') + ' + ' + gen.name.replace(/^(Drill|Bore) — /, '');
                } else {
                    // Structured slot — record the op and regenerate fields + body from the whole op list.
                    slot.ops = slot.ops || [];
                    slot.ops.push({ type: method, variant });
                    buildSlotFromOps(slot);
                    // Auto-seed a labelled icon so a fresh slot isn't blank (editable via the icon editor).
                    if (empty && !slot.icon) { try { slot.icon = { name: (slot.name || 'cam' + slot.slot) + '.bmp', data: autoIconBmp(slot.name, method), w: 360, h: 180, source: 'auto' }; } catch (_) { /* canvas unavailable */ } }
                }
                saveCamPack(); renderCamBuilder();
            }
            else if (a === 'delop') {
                if (!regenGuard(slot)) { renderCamBuilder(); return; }
                slot.ops.splice(+e.target.dataset.oi, 1);
                buildSlotFromOps(slot); saveCamPack(); renderCamBuilder();
            }
            else if (a === 'refresh') {
                // Rebuild the field table from the macro's #2600 mirror reads. The read-line comment
                // "(Label [units] =default [min~max])" is the source for label/units/default/range, so editing it
                // in the macro and refreshing actually takes effect. Only `type` (int vs decimal) is preserved
                // from the existing field — it isn't encoded in the comment and has no column in the table to re-enter.
                const scanned = camPack.fieldsFromMacro(slot.body);
                const byIdx = new Map((slot.fields || []).map((f) => [f.idx, f]));
                slot.fields = scanned.map((s, i) => { const e = byIdx.get(s.idx); return e ? { ...s, type: e.type, var: s.var || e.var } : { ...s, var: s.var || ('#' + (i + 1)) }; });
                saveCamPack(); renderCamBuilder();
            }
            else if (a === 'sim') { simulateSlot(slot); }
            else if (a === 'exp') { insertToEditor('( ===== eng form lines — MERGE into the controller eng language file ===== )\n' + camPack.slotEng(slot) + '\n\n' + camPack.slotMacro(slot)); }
        });
        camHost.addEventListener('change', (e) => {
            const t = e.target;
            // Add-op selector: rebuild its variant dropdown into the relevant build-time setting (or hide it).
            if (t.classList.contains('cam-op')) {
                const sel = t.parentElement.querySelector('.cam-op-pat');
                if (sel) applySecondCtl(sel, t.value);
                return;
            }
            // Structured op-card edits → mutate the op manifest and regenerate the slot from it.
            const card = t.closest('.cam-slot'); if (!card) return; const slot = _camPack.slots[+card.dataset.si]; if (!slot || !slot.ops) return;
            const op = slot.ops[+t.dataset.oi]; if (!op) return;
            if (t.classList.contains('cam-op-type')) {
                if (!regenGuard(slot)) { renderCamBuilder(); return; }
                op.type = t.value; op.variant = defaultVariant(t.value);   // reset the variant to the new type's default
                buildSlotFromOps(slot); saveCamPack(); renderCamBuilder();
            } else if (t.classList.contains('cam-op-var')) {
                if (!regenGuard(slot)) { renderCamBuilder(); return; }
                op.variant = t.value;
                buildSlotFromOps(slot); saveCamPack(); renderCamBuilder();
            }
        });
    }
    const _camName = q('cam_pack_name');
    if (_camName) _camName.addEventListener('input', () => { _camPack.meta = _camPack.meta || {}; _camPack.meta.name = _camName.value; saveCamPack(); });
    const nextSlotNum = () => { const base = (_camPack.meta && _camPack.meta.baseSlot) || 22; const used = new Set(_camPack.slots.map((s) => +s.slot)); let n = base; while (used.has(n)) n++; return n; };
    const _camAddSlot = q('cam_add_slot');
    if (_camAddSlot) _camAddSlot.addEventListener('click', () => { _camPack.slots.push({ slot: nextSlotNum(), name: 'New slot', fields: [], body: '' }); saveCamPack(); renderCamBuilder(); });
    // Pack export: bundle the whole pack into a USB-ready .zip (CAM/ folder + eng-merge + README).
    const packBytes = (dataUrl) => { const bin = atob(String(dataUrl || '').split(',')[1] || ''); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
    const readmeText = (name) => [name, '',
        'INSTALL (DDCS Expert / M350):',
        '1. Copy the CAM/ folder onto a FAT32 USB stick.',
        '2. Power off the controller, insert the USB, power on, wait for restart.',
        '3. F2 -> Program -> F1 (select U-disk) -> cursor on the CAM folder -> F4 (copy to local).',
        '   Macros MUST run from internal storage — running from USB silently does nothing.',
        '4. MERGE eng-additions.txt into the controller eng (and chs) language file — do NOT replace it.',
        '5. Open the CAM page: bind a K-key (K1-K7) to function code 1399 (parameter range Pr210-252),',
        '   then press it. The new slots (cam22+) appear as icons — tap one, fill the form, press Start.',
        '', 'Spindle: the cutting slots run M3/M5 themselves. If your CAM workflow starts the spindle',
        'separately, delete the M3/G04/M5 lines from the macro (they are plain editable lines).'].join('\n') + '\n';
    const _camExport = q('cam_export_pack');
    if (_camExport) _camExport.addEventListener('click', () => {
        if (!_camPack.slots.length) { alert('No slots to export — add a slot first.'); return; }
        const v = camPack.validatePack(_camPack);
        if (!v.ok && !confirm('This pack has problems:\n\n' + v.errors.join('\n') + '\n\nExport anyway?')) return;
        const files = [], eng = [];
        _camPack.slots.forEach((slot) => {
            files.push({ name: `CAM/macro_cam${slot.slot}.nc`, data: camPack.slotMacro(slot) });
            if (slot.icon && slot.icon.data) files.push({ name: `CAM/cam${slot.slot}.bmp`, data: packBytes(slot.icon.data) });
            eng.push(`( ===== cam${slot.slot} — ${slot.name || ''} ===== )`, camPack.slotEng(slot), '');
        });
        files.push({ name: 'eng-additions.txt', data: '( MERGE these lines into the controller eng/chs language file — do NOT replace it. )\n\n' + eng.join('\n') });
        const name = (_camPack.meta && _camPack.meta.name) || 'CAM pack';
        files.push({ name: 'README.txt', data: readmeText(name) });
        downloadBytes(name.replace(/[^\w-]+/g, '_') + '.zip', makeZip(files));
    });

    // Safe eng merge: paste the controller's CURRENT eng → append this pack's params, flag collisions, download.
    const _camMerge = q('cam_merge_eng');
    if (_camMerge) _camMerge.addEventListener('click', () => {
        if (!_camPack.slots.length) { alert('No slots to merge — add a slot first.'); return; }
        const additions = _camPack.slots.map((s) => camPack.slotEng(s)).join('\n') + '\n';
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center;';
        overlay.innerHTML = `<div style="width:min(900px,92vw); height:min(680px,88vh); background:var(--panel,#161b22); border:1px solid var(--border); border-radius:10px; display:flex; flex-direction:column; overflow:hidden;">
            <div style="display:flex; align-items:center; gap:10px; padding:8px 12px; border-bottom:1px solid var(--border);"><b style="flex:1">🔗 Merge into controller eng</b><button class="toolbar-btn settings-io" data-mc>✕ Close</button></div>
            <div style="padding:12px; display:flex; flex-direction:column; gap:8px; flex:1; min-height:0;">
                <div class="settings-hint">Paste the controller's CURRENT <code>eng</code> file (pull it over the gateway or copy from the controller). Studio appends this pack's params and flags any <code>#param</code> / <code>-m</code> group collisions — then downloads the merged <code>eng</code> to push back. It never replaces existing content.</div>
                <textarea data-eng spellcheck="false" placeholder="paste the controller eng here…" style="flex:1; width:100%; font:12px/1.4 monospace; box-sizing:border-box;"></textarea>
                <div data-mout class="settings-hint" style="margin:0"></div>
                <div class="settings-row"><button class="toolbar-btn settings-io" data-mgo>Check &amp; download merged eng</button></div>
            </div></div>`;
        document.body.appendChild(overlay);
        const close = () => overlay.remove();
        overlay.querySelector('[data-mc]').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        overlay.querySelector('[data-mgo]').addEventListener('click', () => {
            const eng = overlay.querySelector('[data-eng]').value;
            if (!eng.trim()) { alert('Paste the controller eng first.'); return; }
            const m = camPack.mergeEng(eng, additions);
            const msgs = [];
            if (m.paramCollisions.length) msgs.push('⚠ #param collisions (already defined in the eng): ' + m.paramCollisions.map((n) => '#' + n).join(', ') + ' — reallocate these fields in the builder before installing.');
            if (m.groupCollisions.length) msgs.push('⚠ -m group collisions: ' + m.groupCollisions.map((g) => 'm' + g).join(', ') + ' — change the slot number(s).');
            msgs.push(`Appended ${m.added.length} param line(s).` + (m.paramCollisions.length || m.groupCollisions.length ? ' Merged file downloaded, but FIX the collisions first.' : ' No collisions — safe to install.'));
            const out = overlay.querySelector('[data-mout]');
            out.innerHTML = msgs.join('<br>');
            out.style.color = (m.paramCollisions.length || m.groupCollisions.length) ? '#ff6b6b' : '#3c9';
            const blob = new Blob([m.merged], { type: 'text/plain' });
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'eng-merged.txt'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        });
    });

    renderCamBuilder();
}

window.ddcsInitMacrosApp = initMacrosApp;
