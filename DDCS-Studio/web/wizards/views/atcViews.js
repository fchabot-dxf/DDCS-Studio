/** views/atcViews.js — the ATC wizard views (length / warmup / change / commissioning test). */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { num } from '../ops/util.js';
import { toolProfileSvg } from '../../viz/toolProfile.js';
import { renderMagazineTable } from '../../ui/ioTable.js';
import { AtcLengthWizard } from '../atcLengthWizard.js';
import { AtcWarmupWizard } from '../atcWarmupWizard.js';
import { AtcChangeWizard } from '../atcChangeWizard.js';
import { AtcTestWizard } from '../atcTestWizard.js';
import { AtcToolCheckWizard } from '../atcToolCheckWizard.js';
import { AtcTableWizard } from '../atcTableWizard.js';

const lengthWizard = new AtcLengthWizard();
const warmupWizard = new AtcWarmupWizard();
const changeWizard = new AtcChangeWizard();
const testWizard = new AtcTestWizard();
const toolCheckWizard = new AtcToolCheckWizard();
const tableWizard = new AtcTableWizard();

const setStatus = (id, text) => { const e = el(id); if (e) e.textContent = text; };

/** One tool tile: the real tool profile (now-accurate shapes) + a label + sub-line. `on` = highlighted. */
function toolTile(tool, label, sub, on) {
    const t = tool || { type: 'endmill', dia: 6, length: '' };
    return `<div title="${t.type || 'tool'}${t.dia ? ' Ø' + t.dia : ''}" style="text-align:center;flex:0 0 auto;font-size:10px;color:var(--text-dim);padding:2px 5px;border-radius:6px;${on ? 'background:rgba(45,226,255,.14);outline:1px solid var(--accent,#2de2ff);' : ''}">`
        + toolProfileSvg(t, on ? { w: 30, h: 46, color: 'var(--accent,#2de2ff)' } : { w: 30, h: 46 })
        + `<div>${label}</div><div>${sub || ''}</div></div>`;
}

/**
 * Magazine rack strip — the "see the pockets + tools" preview, shared by the ATC wizards. If a magazine is built,
 * it shows one tile per POCKET (with the assigned tool's real profile). If no magazine yet but the library has
 * tools, it shows the TOOL LIBRARY so you still SEE your tools (build the magazine to assign pockets).
 * `opts.highlight` = a tool number to emphasise (e.g. the tool being changed to).
 */
function magazineRackHtml(a, opts = {}) {
    const byNum = {};
    (a.tools || []).forEach((t) => { if (t && t.num != null && t.num !== '') byNum[Number(t.num)] = t; });
    const mag = Array.isArray(a.magazine) ? a.magazine : [];
    const hl = opts.highlight != null && opts.highlight !== '' ? Number(opts.highlight) : null;
    if (mag.length) {
        return mag.map((p, i) => {
            const tn = Number(p.tool);
            const tool = byNum[tn] || { type: 'endmill', dia: 6, length: '' };
            const len = (tool.length !== '' && tool.length != null) ? tool.length + 'mm' : '';
            return toolTile(tool, `P${num(p.pocket, i + 1)}${tn ? ' · T' + tn : ''}`, len, hl != null && tn === hl);
        }).join('');
    }
    // No magazine pockets yet — still show the tool LIBRARY so the user sees the tools they added.
    const tools = (a.tools || []).filter((t) => t && t.num != null && t.num !== '');
    if (!tools.length) return '<span style="font-size:11px;color:var(--text-dim);">No tools yet — add them in Settings → Tool table (＋ Tool library).</span>';
    return tools.map((t) => toolTile(t, 'T' + t.num, (t.length !== '' && t.length != null) ? t.length + 'mm' : (t.name || ''), hl != null && Number(t.num) === hl)).join('');
}

/** Build the 3D-magazine pocket list (machine XYZ + the assigned tool's full shape) for viz.setMagazine. */
function magazinePockets(a) {
    const byNum = {};
    (a.tools || []).forEach((t) => { if (t && t.num != null && t.num !== '') byNum[Number(t.num)] = t; });
    return (Array.isArray(a.magazine) ? a.magazine : []).map((p, i) => {
        const t = byNum[Number(p.tool)] || {};
        return {
            x: p.x, y: p.y, z: p.z, pocket: p.pocket != null ? p.pocket : i + 1,
            tool: { type: t.type || 'endmill', dia: num(t.dia, 6), angle: t.angle, length: num(t.length, 30) },
        };
    });
}

/** Pop the full magazine editor as a modal with a Done button — the wizard's own table stays read-only/compact. */
function openMagazineModal(refresh) {
    const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
    s.atc = s.atc || {};
    const ov = document.createElement('div');
    ov.style.cssText = 'position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,.6); display:flex; align-items:center; justify-content:center;';
    ov.innerHTML = `<div style="width:min(900px,95vw); max-height:88vh; overflow:auto; background:var(--panel,#161b22); border:1px solid var(--border); border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:10px;">
        <b>Edit tool magazine</b>
        <div class="mag-edit-host"></div>
        <div style="display:flex; justify-content:flex-end; gap:8px;"><button class="toolbar-btn settings-io" data-mag-done>✓ Done</button></div>
    </div>`;
    document.body.appendChild(ov);
    renderMagazineTable(ov.querySelector('.mag-edit-host'), s.atc, () => { if (window.ddcsSaveSettings) window.ddcsSaveSettings(); if (refresh) refresh(); });
    const close = () => ov.remove();
    ov.querySelector('[data-mag-done]').addEventListener('click', close);
    ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
}

export const atcLengthView = {
    type: 'atc_length',
    panelId: 'wiz_atc_length',
    codeElId: 'wiz_atc_length_code',
    large: true,
    twoPane: true,
    inputIds: [],   // no wizard inputs — params come from Settings → ATC (tool-setter pin from Probes)
    update(mgr) {
        const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        const a = s.atc || {};
        const p = s.probes || {};
        const params = {
            blockHeight: a.blockHeight ?? 50,
            safeZ: a.safeZ ?? 10,
            maxDist: a.maxDist ?? 100,
            retract: a.retract ?? 3,
            qStop: a.qStop ?? 1,
            f_fast: a.fFast ?? 300,
            f_slow: a.fSlow ?? 50,
            port: p.setterPin,
            level: p.setterLevel,
            sources: window.ddcsResolveProbeSources(['setterPort', 'setterLevel', 'blockHeight']),
        };
        const gcode = lengthWizard.generate(params);
        el('wiz_atc_length_code').innerHTML = UIUtils.formatGCode(gcode);
        if (mgr) mgr.preview3D(gcode, 'atcLengthViz');
        setStatus('atcLengthVizStatus', 'Z touch on the tool setter · ▶ traces the fast approach, slow touch + retract');
    },
};

export const atcCheckView = {
    type: 'atc_check',
    panelId: 'wiz_atc_check',
    codeElId: 'wiz_atc_check_code',
    large: true,
    twoPane: true,
    inputIds: ['atc_check_tol'],   // tolerance only — setter + feeds come from Settings → ATC / Probes
    update(mgr) {
        const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        const a = s.atc || {};
        const p = s.probes || {};
        const params = {
            blockHeight: a.blockHeight ?? 50,
            safeZ: a.safeZ ?? 10,
            maxDist: a.maxDist ?? 100,
            retract: a.retract ?? 3,
            qStop: a.qStop ?? 1,
            f_fast: a.fFast ?? 300,
            f_slow: a.fSlow ?? 50,
            port: p.setterPin,
            level: p.setterLevel,
            tolerance: el('atc_check_tol')?.value || '0.5',
            sources: window.ddcsResolveProbeSources(['setterPort', 'setterLevel', 'blockHeight']),
        };
        const gcode = toolCheckWizard.generate(params);
        el('wiz_atc_check_code').innerHTML = UIUtils.formatGCode(gcode);
        if (mgr) mgr.preview3D(gcode, 'atcCheckViz');
        setStatus('atcCheckVizStatus', 'Z re-tap on the setter · ▶ traces the probe; aborts if broken / wrong length');
    },
};

export const atcWarmupView = {
    type: 'atc_warmup',
    panelId: 'wiz_atc_warmup',
    codeElId: 'wiz_atc_warmup_code',
    large: true,
    twoPane: true,
    inputIds: ['atc_warmup_rpm1', 'atc_warmup_time1', 'atc_warmup_rpm2', 'atc_warmup_time2'],
    update(mgr) {
        const params = {
            rpm1: el('atc_warmup_rpm1')?.value || '6000',
            time1: el('atc_warmup_time1')?.value || '30',
            rpm2: el('atc_warmup_rpm2')?.value || '12000',
            time2: el('atc_warmup_time2')?.value || '30'
        };
        const gcode = warmupWizard.generate(params);
        el('wiz_atc_warmup_code').innerHTML = UIUtils.formatGCode(gcode);
        if (mgr) mgr.preview3D(gcode, 'atcWarmupViz');
        setStatus('atcWarmupVizStatus', 'Spindle warm-up · no toolpath — ▶ steps the RPM / dwell stages');
    },
};

export const atcChangeView = {
    type: 'atc_change',
    panelId: 'wiz_atc_change',
    codeElId: 'wiz_atc_change_code',
    large: true,
    twoPane: true,
    inputIds: [
        'atc_change_mode',
        'atc_change_x', 'atc_change_y', 'atc_change_z',
        'atc_change_zclear', 'atc_change_fixedt',
        'atc_change_m300', 'atc_change_cover', 'atc_change_confirm',
    ],
    update(mgr) {
        const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        const mode = el('atc_change_mode')?.value || 'manual';
        // Populate the "change to tool" selector from the magazine tools (preserve the current choice).
        const ftSel = el('atc_change_fixedt');
        if (ftSel && ftSel.tagName === 'SELECT') {
            const cur = ftSel.value;
            const byNum = {}; (s.atc?.tools || []).forEach((t) => { if (t && t.num != null && t.num !== '') byNum[Number(t.num)] = t; });
            const opts = ['<option value="0">From program (M6 Txx)</option>'];
            (s.atc?.magazine || []).forEach((p) => { if (p.tool !== '' && p.tool != null) { const t = byNum[Number(p.tool)]; opts.push(`<option value="${p.tool}">T${p.tool}${t && t.name ? ' · ' + t.name : ''} (P${p.pocket})</option>`); } });
            ftSel.innerHTML = opts.join('');
            if ([...ftSel.options].some((o) => o.value === cur)) ftSel.value = cur;
        }
        // Mode-specific parameter rows
        const manualRow = el('atc_change_manual_params');
        const autoRow = el('atc_change_auto_params');
        if (manualRow) manualRow.style.display = mode === 'manual' ? '' : 'none';
        if (autoRow) autoRow.style.display = mode === 'auto' ? '' : 'none';

        const params = {
            mode,
            // manual
            x: el('atc_change_x')?.value || '100',
            y: el('atc_change_y')?.value || '100',
            z: el('atc_change_z')?.value || '0',
            // auto
            zClear: el('atc_change_zclear')?.value || '0',
            fixedT: el('atc_change_fixedt')?.value || '0',
            waitSpindle: el('atc_change_m300')?.checked !== false,
            dustCover: el('atc_change_cover')?.checked === true,
            confirm: el('atc_change_confirm')?.checked === true,
            magazine: (s.atc && s.atc.magazine) || [],   // pockets + park XYZ come from Settings → Tool table
        };
        const gcode = changeWizard.generate(params);
        el('wiz_atc_change_code').innerHTML = UIUtils.formatGCode(gcode);
        if (mgr) mgr.preview3D(gcode, 'atcChangeViz');
        if (mgr) mgr.previewMagazine('atcChangeViz', magazinePockets(s.atc || {}));   // pockets + tools in 3D on the envelope
        // Magazine strip: show the pockets + tools; in auto mode highlight the fixed test tool being swapped to.
        const ft = Number(el('atc_change_fixedt')?.value || 0);
        const rack = el('atcChangeTools');
        if (rack) rack.innerHTML = magazineRackHtml(s.atc || {}, { highlight: mode === 'auto' && ft > 0 ? ft : '' });
        setStatus('atcChangeVizStatus', mode === 'auto'
            ? 'Auto ATC pick & place · pocket moves come from controller tables (#1330/#1350/#1370)'
            : 'Manual park · ▶ traces the safe-Z retract then the move to the swap position');
    },
};

export const atcTestView = {
    type: 'atc_test',
    panelId: 'wiz_atc_test',
    codeElId: 'wiz_atc_test_code',
    large: true,
    twoPane: true,
    inputIds: [
        'atc_test_mode',
        'atc_test_cycles', 'atc_test_dwell',
        'atc_test_first', 'atc_test_count', 'atc_test_zclear', 'atc_test_descend',
    ],
    update(mgr) {
        const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        const mode = el('atc_test_mode')?.value || 'drawbar';
        const drawbarRow = el('atc_test_drawbar_params');
        const pocketRow = el('atc_test_pocket_params');
        if (drawbarRow) drawbarRow.style.display = mode === 'drawbar' ? '' : 'none';
        if (pocketRow) pocketRow.style.display = mode === 'pockets' ? '' : 'none';

        const params = {
            mode,
            cycles: el('atc_test_cycles')?.value || '10',
            dwellMs: el('atc_test_dwell')?.value || '500',
            first: el('atc_test_first')?.value || '1',
            count: el('atc_test_count')?.value || '8',
            zClear: el('atc_test_zclear')?.value || '0',
            descend: el('atc_test_descend')?.checked === true,
            magazine: (s.atc && s.atc.magazine) || [],   // pocket dry-run visits the Settings → Tool table magazine
        };
        const gcode = testWizard.generate(params);
        el('wiz_atc_test_code').innerHTML = UIUtils.formatGCode(gcode);
        if (mgr) mgr.preview3D(gcode, 'atcTestViz');
        setStatus('atcTestVizStatus', mode === 'pockets'
            ? 'Pocket dry-run · visits each magazine pocket (Settings → Tool table) at clearance Z'
            : 'Drawbar cycle · no toolpath — ▶ steps the release / lock sequence');
    },
};

export const atcTableView = {
    type: 'atc_table',
    panelId: 'wiz_atc_table',
    codeElId: 'wiz_atc_table_code',
    large: true,
    twoPane: true,
    inputIds: ['atc_table_lengths', 'atc_table_pockets'],   // include lengths / include pockets
    update(mgr) {
        const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        const a = s.atc || {};
        const params = {
            tools: a.tools || [],
            magazine: a.magazine || [],
            includeLengths: el('atc_table_lengths') ? el('atc_table_lengths').checked : true,
            includePockets: el('atc_table_pockets') ? el('atc_table_pockets').checked : true,
        };
        const gcode = tableWizard.generate(params);   // the apply-macro the operator RUNS on the controller
        el('wiz_atc_table_code').innerHTML = UIUtils.formatGCode(gcode);
        // Programming the table is PARAMETER writes (no motion) — so DON'T plot a rapid path (that stray "single
        // movement" was just one G0 to a pocket). Keep the 3D on the bare envelope; the magazine strip below is
        // the real preview (pockets + tools).
        const mag = (Array.isArray(a.magazine) ? a.magazine : []).filter((p) => p && (p.x !== '' || p.y !== '' || p.z !== ''));
        if (mgr) mgr.preview3D('G90', 'atcTableViz');
        if (mgr) mgr.previewMagazine('atcTableViz', magazinePockets(a));   // pockets + tools in 3D on the envelope
        // Tool-profile rack strip: each magazine tool drawn at its real shape (type/Ø) + length — review the rack.
        const rack = el('atcTableTools');
        if (rack) rack.innerHTML = magazineRackHtml(a);
        // The wizard's magazine view is READ-ONLY + compact; "✎ Edit table…" pops the full editor as a modal (Done).
        const host = el('atc_table_magazine');
        if (host) {
            const magAll = Array.isArray(a.magazine) ? a.magazine : [];
            const byNum = {}; (a.tools || []).forEach((t) => { if (t && t.num != null && t.num !== '') byNum[Number(t.num)] = t; });
            const td = 'padding:3px 7px; border-bottom:1px solid var(--border);';
            const rows = magAll.map((p, i) => {
                const t = byNum[Number(p.tool)] || {};
                const has = p.tool !== '' && p.tool != null;
                const name = has ? (t.name || [t.type, t.dia ? 'Ø' + t.dia : ''].filter(Boolean).join(' ') || '—') : '(empty)';
                const len = (has && t.length !== '' && t.length != null) ? t.length + 'mm' : '';
                const icon = has ? toolProfileSvg({ type: t.type || 'endmill', dia: num(t.dia, 6), angle: t.angle, length: num(t.length, 30) }, { w: 18, h: 26 }) : '';
                return `<tr><td style="${td} color:var(--text-dim);">P${p.pocket != null ? p.pocket : i + 1}</td><td style="${td} width:22px; text-align:center;">${icon}</td><td style="${td} font-weight:600;">${has ? 'T' + p.tool : '—'}</td><td style="${td}">${name}</td><td style="${td} color:var(--text-dim);">${len}</td></tr>`;
            }).join('');
            const table = magAll.length
                ? `<table style="width:100%; border-collapse:collapse; font-size:11px; margin-top:6px;"><thead><tr style="color:var(--text-dim); text-align:left; font-size:10px;"><th style="padding:0 7px 3px;">Pocket</th><th></th><th style="padding:0 7px 3px;">Tool</th><th style="padding:0 7px 3px;">Description</th><th style="padding:0 7px 3px;">Length</th></tr></thead><tbody>${rows}</tbody></table>`
                : '<div class="settings-hint" style="margin:6px 0 0;">No pockets yet — click Edit table to build the magazine.</div>';
            host.innerHTML = `<div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;"><button class="toolbar-btn settings-io" data-edit-mag>✎ Edit table…</button><span class="settings-hint" style="margin:0;">${magAll.length} pocket${magAll.length === 1 ? '' : 's'} · ${a.magType === 'disk' ? 'disk / carousel' : 'linear'}</span></div>${table}`;
            host.querySelector('[data-edit-mag]').addEventListener('click', () => openMagazineModal(() => this.update(mgr)));
        }
        const lens = (a.tools || []).filter((t) => t && t.length !== '' && t.length != null).map((t) => `T${t.num} ${t.length}`).join(' · ');
        setStatus('atcTableVizStatus', `Magazine: ${mag.length} pocket${mag.length === 1 ? '' : 's'}${lens ? ' · lengths ' + lens : ' · no tool lengths set'} — writes the table, no motion; review the strip below`);
    },
};
