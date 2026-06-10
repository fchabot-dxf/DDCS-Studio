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
    inputIds: [
        'atc_block_height', 'atc_safe_z', 'atc_max_dist', 'atc_retract',
        'atc_q', 'atc_feed_fast', 'atc_feed_slow', 'atc_port', 'atc_level',
    ],
    update() {
        const params = {
            blockHeight: el('atc_block_height')?.value || '50',
            safeZ: el('atc_safe_z')?.value || '10',
            maxDist: el('atc_max_dist')?.value || '200',
            retract: el('atc_retract')?.value || '3',
            qStop: el('atc_q')?.value || '1',
            f_fast: el('atc_feed_fast')?.value || '300',
            f_slow: el('atc_feed_slow')?.value || '50',
            port: window.ddcsGetSettings().probes.setterPin,
            level: window.ddcsGetSettings().probes.setterLevel
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
