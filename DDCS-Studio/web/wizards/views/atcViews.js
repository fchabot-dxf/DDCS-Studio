/** views/atcViews.js — the ATC wizard views (length / warmup / change / commissioning test). */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { AtcLengthWizard } from '../atcLengthWizard.js';
import { AtcWarmupWizard } from '../atcWarmupWizard.js';
import { AtcChangeWizard } from '../atcChangeWizard.js';
import { AtcTestWizard } from '../atcTestWizard.js';
import { AtcToolCheckWizard } from '../atcToolCheckWizard.js';

const lengthWizard = new AtcLengthWizard();
const warmupWizard = new AtcWarmupWizard();
const changeWizard = new AtcChangeWizard();
const testWizard = new AtcTestWizard();
const toolCheckWizard = new AtcToolCheckWizard();

export const atcLengthView = {
    type: 'atc_length',
    panelId: 'wiz_atc_length',
    codeElId: 'wiz_atc_length_code',
    large: true,
    inputIds: [],   // no wizard inputs — params come from Settings → ATC (tool-setter pin from Probes)
    update() {
        const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        const a = s.atc || {};
        const p = s.probes || {};
        const params = {
            blockHeight: a.blockHeight ?? 50,
            safeZ: a.safeZ ?? 10,
            maxDist: a.maxDist ?? 200,
            retract: a.retract ?? 3,
            qStop: a.qStop ?? 1,
            f_fast: a.fFast ?? 300,
            f_slow: a.fSlow ?? 50,
            port: p.setterPin,
            level: p.setterLevel,
            sources: window.ddcsResolveProbeSources(['setterPort', 'setterLevel', 'blockHeight']),
        };
        el('wiz_atc_length_code').innerHTML = UIUtils.formatGCode(lengthWizard.generate(params));
    },
};

export const atcCheckView = {
    type: 'atc_check',
    panelId: 'wiz_atc_check',
    codeElId: 'wiz_atc_check_code',
    large: true,
    inputIds: ['atc_check_tol'],   // tolerance only — setter + feeds come from Settings → ATC / Probes
    update() {
        const s = (window.ddcsGetSettings && window.ddcsGetSettings()) || {};
        const a = s.atc || {};
        const p = s.probes || {};
        const params = {
            blockHeight: a.blockHeight ?? 50,
            safeZ: a.safeZ ?? 10,
            maxDist: a.maxDist ?? 200,
            retract: a.retract ?? 3,
            qStop: a.qStop ?? 1,
            f_fast: a.fFast ?? 300,
            f_slow: a.fSlow ?? 50,
            port: p.setterPin,
            level: p.setterLevel,
            tolerance: el('atc_check_tol')?.value || '0.5',
            sources: window.ddcsResolveProbeSources(['setterPort', 'setterLevel', 'blockHeight']),
        };
        el('wiz_atc_check_code').innerHTML = UIUtils.formatGCode(toolCheckWizard.generate(params));
    },
};

export const atcWarmupView = {
    type: 'atc_warmup',
    panelId: 'wiz_atc_warmup',
    codeElId: 'wiz_atc_warmup_code',
    large: true,
    inputIds: ['atc_warmup_rpm1', 'atc_warmup_time1', 'atc_warmup_rpm2', 'atc_warmup_time2'],
    update() {
        const params = {
            rpm1: el('atc_warmup_rpm1')?.value || '6000',
            time1: el('atc_warmup_time1')?.value || '30',
            rpm2: el('atc_warmup_rpm2')?.value || '12000',
            time2: el('atc_warmup_time2')?.value || '30'
        };
        el('wiz_atc_warmup_code').innerHTML = UIUtils.formatGCode(warmupWizard.generate(params));
    },
};

export const atcChangeView = {
    type: 'atc_change',
    panelId: 'wiz_atc_change',
    codeElId: 'wiz_atc_change_code',
    large: true,
    inputIds: [
        'atc_change_mode',
        'atc_change_x', 'atc_change_y', 'atc_change_z',
        'atc_change_zclear', 'atc_change_capacity', 'atc_change_fixedt',
        'atc_change_m300', 'atc_change_cover', 'atc_change_confirm',
    ],
    update() {
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
            capacity: el('atc_change_capacity')?.value || '8',
            fixedT: el('atc_change_fixedt')?.value || '0',
            waitSpindle: el('atc_change_m300')?.checked !== false,
            dustCover: el('atc_change_cover')?.checked === true,
            confirm: el('atc_change_confirm')?.checked === true,
        };
        el('wiz_atc_change_code').innerHTML = UIUtils.formatGCode(changeWizard.generate(params));
    },
};

export const atcTestView = {
    type: 'atc_test',
    panelId: 'wiz_atc_test',
    codeElId: 'wiz_atc_test_code',
    large: true,
    inputIds: [
        'atc_test_mode',
        'atc_test_cycles', 'atc_test_dwell',
        'atc_test_first', 'atc_test_count', 'atc_test_zclear', 'atc_test_descend',
    ],
    update() {
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
        };
        el('wiz_atc_test_code').innerHTML = UIUtils.formatGCode(testWizard.generate(params));
    },
};
