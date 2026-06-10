/** views/atcViews.js — the three (small) ATC wizard views. */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { AtcLengthWizard } from '../atcLengthWizard.js';
import { AtcWarmupWizard } from '../atcWarmupWizard.js';
import { AtcChangeWizard } from '../atcChangeWizard.js';

const lengthWizard = new AtcLengthWizard();
const warmupWizard = new AtcWarmupWizard();
const changeWizard = new AtcChangeWizard();

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
        };
        el('wiz_atc_length_code').innerHTML = UIUtils.formatGCode(lengthWizard.generate(params));
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
    inputIds: ['atc_change_x', 'atc_change_y', 'atc_change_z'],
    update() {
        const params = {
            x: el('atc_change_x')?.value || '100',
            y: el('atc_change_y')?.value || '100',
            z: el('atc_change_z')?.value || '0'
        };
        el('wiz_atc_change_code').innerHTML = UIUtils.formatGCode(changeWizard.generate(params));
    },
};
