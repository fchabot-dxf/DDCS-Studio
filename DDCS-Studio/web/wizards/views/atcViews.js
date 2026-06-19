/** views/atcViews.js — the ATC wizard views (length / warmup / change / commissioning test). */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { num } from '../ops/util.js';
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
        'atc_change_zclear', 'atc_change_capacity', 'atc_change_fixedt',
        'atc_change_m300', 'atc_change_cover', 'atc_change_confirm',
    ],
    update(mgr) {
        const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        const mode = el('atc_change_mode')?.value || 'manual';
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
        // Preview reuses the 3D engine: plot each pocket as a rapid visit so you can review the rack layout.
        const mag = (Array.isArray(a.magazine) ? a.magazine : []).filter((p) => p && (p.x !== '' || p.y !== '' || p.z !== ''));
        const pv = ['G90'].concat(mag.map((p) => `G0 X${num(p.x, 0)} Y${num(p.y, 0)} Z${num(p.z, 0)}`)).join('\n');
        if (mgr) mgr.preview3D(pv, 'atcTableViz');
        const lens = (a.tools || []).filter((t) => t && t.length !== '' && t.length != null).map((t) => `T${t.num} ${t.length}`).join(' · ');
        setStatus('atcTableVizStatus', `${mag.length} pocket${mag.length === 1 ? '' : 's'} plotted${lens ? ' · lengths: ' + lens : ' · no tool lengths set'}`);
    },
};
