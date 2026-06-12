/** views/rotaryCenterView.js — Rotary centreline (4th-axis setup) wizard view. */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { RotaryCenterWizard } from '../rotaryCenterWizard.js';

const wizard = new RotaryCenterWizard();

export const rotaryCenterView = {
    type: 'rotary_center',
    panelId: 'wiz_rotary_center',
    codeElId: 'wiz_rotary_center_code',
    large: true,
    inputIds: [
        'rc_method', 'rc_datum', 'rc_diameter', 'rc_wcs',
        'rc_dist', 'rc_retract', 'rc_safe_z', 'rc_feed_fast', 'rc_feed_slow', 'rc_q',
    ],
    // Controller-source chips (PROBE-CONFIG-SOURCE.md)
    probeSrcFields: { rc_feed_fast: 'fastFeed', rc_retract: 'retract' },

    onOpen(ctx) {
        setTimeout(() => { ctx.update(); }, 50);
    },

    update(ctx) {
        const settings = window.ddcsGetSettings ? window.ddcsGetSettings() : { probes: {} };
        const method = el('rc_method')?.value || 'known';
        const params = {
            method,
            datum: el('rc_datum')?.value || 'center',
            diameter: el('rc_diameter')?.value || '76.2',
            wcs: el('rc_wcs')?.value || 'active',
            dist: el('rc_dist')?.value || '30',
            retract: el('rc_retract')?.value || '2',
            safeZ: el('rc_safe_z')?.value || '15',
            f_fast: el('rc_feed_fast')?.value || '200',
            f_slow: el('rc_feed_slow')?.value || '50',
            qStop: el('rc_q')?.value || '1',
            port: settings.probes.probePin,
            level: settings.probes.probeLevel,
            sources: window.ddcsResolveProbeSources(['port', 'level', 'fastFeed', 'retract']),
        };

        // Diameter only applies to the known-diameter method
        const diaBlock = el('rc_diameter_block');
        if (diaBlock) diaBlock.classList.toggle('hidden', method !== 'known');

        const desc = el('rc_desc');
        if (desc) {
            desc.innerHTML = method === 'fit'
                ? '<b>3-point fit:</b> probe the top, then the +Y and -Y flanks (with reposition pauses), and the macro solves the Y-Z circle for centre + radius — no diameter needed. <b>Advanced — verify the math on the machine before relying on it.</b>'
                : '<b>Known diameter:</b> enter the blank diameter; probe the top and both flanks. Yc is the flank midpoint (exact at any height); centreline Z = top − radius. Robust, 3 touches.';
        }

        const gcode = wizard.generate(params);
        el('wiz_rotary_center_code').innerHTML = UIUtils.formatGCode(gcode);
        const stock = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || {};
        ctx.preview3D(gcode, 'rotaryCenterVizContainer', wizard.inferStart(params, stock));

        const status = el('rotaryCenterVizStatus');
        if (status) status.textContent = `Rotary centre: ${method} | Z0 ${params.datum} | ${params.wcs}`;
    },
};
