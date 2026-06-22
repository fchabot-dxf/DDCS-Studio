/** views/rotaryCenterView.js — Rotary centreline (4th-axis setup) wizard view. */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { RotaryCenterWizard } from '../rotaryCenterWizard.js';
import { cylinderOf, rotaryAxisOf } from '../../engine/probeGeometry.js';
import { applySettings } from '../../ui/settingsPanel.js';

const wizard = new RotaryCenterWizard();

/** Rotary probing is for a round bar — make the stock a cylinder so the preview, the probe collision and the
 *  Ø-pull all match. Keeps the axial LENGTH but squares up the two cross dimensions to a single diameter, so a
 *  block (mismatched cross dims) doesn't become a thin rod lost in its bounding box. Skips if already a cylinder. */
export function activateCylinderStock() {
    const get = window.ddcsGetSettings ? window.ddcsGetSettings() : {};
    const cur = get.stock || {};
    if (cur.shape === 'cylinder' && cur.show) return;
    const axis = rotaryAxisOf(get.motors);
    const cross = axis === 'x' ? ['y', 'z'] : axis === 'y' ? ['x', 'z'] : ['x', 'y'];
    const dims = { x: cur.x || 150, y: cur.y || 76.2, z: cur.z || 76.2 };
    const D = Math.max(dims[cross[0]], dims[cross[1]]) || 76.2;   // diameter = the larger cross dim (fills the stock)
    dims[cross[0]] = D; dims[cross[1]] = D;
    applySettings({ stock: { datum: 'nnp', pin: 'origin', ...cur, ...dims, shape: 'cylinder', show: true } });
}

export const rotaryCenterView = {
    type: 'rotary_center',
    panelId: 'wiz_rotary_center',
    codeElId: 'wiz_rotary_center_code',
    large: true,
    twoPane: true,
    inputIds: [
        'rc_method', 'rc_approach', 'rc_datum', 'rc_diameter', 'rc_wcs',
        'rc_dist', 'rc_retract', 'rc_safe_z', 'rc_feed_fast', 'rc_feed_slow', 'rc_q',
    ],
    // Controller-source chips (PROBE-CONFIG-SOURCE.md)
    probeSrcFields: { rc_feed_fast: 'fastFeed', rc_retract: 'retract' },

    onOpen(ctx) {
        activateCylinderStock();           // rotary probing → round-bar stock (preview + collision + Ø-pull all match)
        setTimeout(() => { ctx.update(); }, 50);
    },

    update(ctx) {
        const settings = window.ddcsGetSettings ? window.ddcsGetSettings() : { probes: {}, stock: {} };
        const method = el('rc_method')?.value || 'known';

        // Known diameter: if the stock IS a cylinder, pull Ø straight from it (the bar being probed) so the macro's
        // R and the sim's collision radius can't disagree. Otherwise the operator types it.
        const stock = settings.stock || {};
        const fromStock = stock.shape === 'cylinder' && stock.x > 0 && stock.y > 0 && stock.z > 0;
        const diaEl = el('rc_diameter');
        let diameter;
        if (fromStock) {
            diameter = Math.round(2 * cylinderOf(stock, rotaryAxisOf(settings.motors)).r * 100) / 100;
            if (diaEl) { diaEl.value = String(diameter); diaEl.readOnly = true; diaEl.title = 'Pulled from the cylinder stock Ø — change it in the stock editor.'; }
        } else {
            if (diaEl) { diaEl.readOnly = false; diaEl.title = 'Known cylinder diameter. R = diameter/2; centreline Z = top - R.'; }
            diameter = diaEl?.value || '76.2';
        }

        const params = {
            method,
            approach: el('rc_approach')?.value || 'auto',
            datum: el('rc_datum')?.value || 'center',
            diameter,
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

        // Diameter + flank-approach only apply to the known-diameter method (fit uses its own reposition pauses)
        const diaBlock = el('rc_diameter_block');
        if (diaBlock) diaBlock.classList.toggle('hidden', method !== 'known');
        const appBlock = el('rc_approach_block');
        if (appBlock) appBlock.classList.toggle('hidden', method !== 'known');

        const desc = el('rc_desc');
        if (desc) {
            desc.innerHTML = method === 'fit'
                ? '<b>3-point fit:</b> probe the top, then the +Y and -Y flanks (with reposition pauses), and the macro solves the Y-Z circle for centre + radius — no diameter needed. <b>Advanced — verify the math on the machine before relying on it.</b>'
                : fromStock
                    ? '<b>Known diameter (from stock):</b> Ø is pulled from your cylinder stock; probe the top + both flanks. Yc is the flank midpoint; centreline Z = top − radius. Robust, 3 touches.'
                    : '<b>Known diameter:</b> enter the blank diameter; probe the top and both flanks. Yc is the flank midpoint (exact at any height); centreline Z = top − radius. Robust, 3 touches.';
        }

        const gcode = wizard.generate(params);
        el('wiz_rotary_center_code').innerHTML = UIUtils.formatGCode(gcode);
        ctx.preview3D(gcode, 'rotaryCenterVizContainer', wizard.inferStart(params, stock));

        const status = el('rotaryCenterVizStatus');
        if (status) status.textContent = `Rotary centre: ${method} | Z0 ${params.datum} | ${params.wcs}`;
    },
};
