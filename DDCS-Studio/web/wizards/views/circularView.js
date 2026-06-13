/** views/circularView.js — Circular bore/boss centre + diameter wizard view. */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { CircularWizard } from '../circularWizard.js';

const wizard = new CircularWizard();

export const circularView = {
    type: 'circular',
    panelId: 'wiz_circular',
    codeElId: 'wiz_circular_code',
    large: true,
    twoPane: true,
    inputIds: [
        'circ_type', 'circ_wcs', 'circ_dist', 'circ_retract', 'circ_safe_z',
        'circ_feed_fast', 'circ_feed_slow', 'circ_q',
    ],
    // Controller-source chips (PROBE-CONFIG-SOURCE.md)
    probeSrcFields: { circ_feed_fast: 'fastFeed', circ_retract: 'retract' },

    onOpen(ctx) {
        setTimeout(() => { ctx.update(); }, 50);
    },

    update(ctx) {
        const settings = window.ddcsGetSettings ? window.ddcsGetSettings() : { probes: {} };
        const params = {
            featureType: el('circ_type')?.value || 'bore',
            wcs: el('circ_wcs')?.value || 'active',
            dist: el('circ_dist')?.value || '20',
            retract: el('circ_retract')?.value || '2',
            safeZ: el('circ_safe_z')?.value || '10',
            f_fast: el('circ_feed_fast')?.value || '200',
            f_slow: el('circ_feed_slow')?.value || '50',
            qStop: el('circ_q')?.value || '1',
            port: settings.probes.probePin,
            level: settings.probes.probeLevel,
            sources: window.ddcsResolveProbeSources(['port', 'level', 'fastFeed', 'retract']),
        };

        const desc = el('circ_desc');
        if (desc) {
            desc.innerHTML = params.featureType === 'boss'
                ? '<b>Boss (outside):</b> start with the stylus clear of one side at probe height. The macro probes each face, pausing for you to move clear around the boss between faces, and re-centres in X before the Y pair so the Y touch is a true diameter. Reports centre, mean diameter and out-of-round.'
                : '<b>Bore (inside):</b> start near the hole centre at probe height. The macro probes +X/-X across the bore, re-centres in X, then probes +Y/-Y — so the Y touch is a true diameter, not a chord. Reports centre, mean diameter and out-of-round.';
        }

        const gcode = wizard.generate(params);
        el('wiz_circular_code').innerHTML = UIUtils.formatGCode(gcode);
        const stock = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || {};
        ctx.preview3D(gcode, 'circularVizContainer', wizard.inferStart(params, stock));

        const status = el('circularVizStatus');
        if (status) status.textContent = `Circular: ${params.featureType} | centre + diameter | ${params.wcs}`;
    },
};
