/** views/rotaryCenterView.js — Rotary centreline (4th-axis setup) wizard view. */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { RotaryCenterWizard } from '../rotaryCenterWizard.js';
import { cylinderOf, rotaryAxisOf } from '../../engine/probeGeometry.js';
import { applyPreviewIntent } from './atcViews.js';   // t714 — the ONE declared-intent apply (rig + envelope), single-sourced with the twin

const wizard = new RotaryCenterWizard();

/** t1722 (gate repair, cycle 857 ACT 2) — Rotary probing is for a round bar, so the preview/collision/Ø-pull all
 *  need to see one. THIS is the SAME cross-square math the OLD activateCylinderStock() used, kept as a pure
 *  derivation: given the current stock, return a NEW round-stock object, touching nothing global. It no longer
 *  mutates + persists window.ddcsGetSettings().stock — a preview writing user state was a defect on its own terms
 *  (survey finding, PREVIEW-AS-DATA.md), and it's the exact shape rotaryCenterData.js's OWN def.simStock already
 *  uses for the twin (that comment: "Mirrors activateCylinderStock's cross-square, but the Ø comes from #57" —
 *  the twin was already built to retire this; the legacy view just never followed). */
function deriveCylinderStock() {
    const get = window.ddcsGetSettings ? window.ddcsGetSettings() : {};
    const cur = get.stock || {};
    if (cur.shape === 'cylinder' && cur.show) return { ...cur };
    const axis = rotaryAxisOf(get.motors);
    const cross = axis === 'x' ? ['y', 'z'] : axis === 'y' ? ['x', 'z'] : ['x', 'y'];
    const dims = { x: cur.x || 150, y: cur.y || 76.2, z: cur.z || 76.2 };
    const D = Math.max(dims[cross[0]], dims[cross[1]]) || 76.2;   // diameter = the larger cross dim (fills the stock)
    dims[cross[0]] = D; dims[cross[1]] = D;
    return { datum: 'nnp', pin: 'origin', ...cur, ...dims, shape: 'cylinder', show: true };
}

/** t1722 — NOW A NO-OP, kept exported: `activateCylinderStock` no longer mutates the global stock (above), so
 *  there is nothing left to restore. `edgeView.js`/`middleView.js`/`rotaryClockView.js` still call this on open
 *  (their own "not a rotary op, revert a forced cylinder" gesture) — kept as a safe no-op rather than touching
 *  those 3 call sites, which is a bigger footprint than this repair needs. */
export function restoreBoxStock() { /* nothing to restore — the mutation this undid no longer happens */ }

export const rotaryCenterView = {
    type: 'rotary_center',
    panelId: 'wiz_rotary_center',
    codeElId: 'wiz_rotary_center_code',
    large: true,
    twoPane: true,
    inputIds: [
        'rc_method', 'rc_approach', 'rc_datum', 'rc_diameter', 'rc_wcs',
        'rc_dist', 'rc_retract', 'rc_safe_z', 'rc_safe_z_frame', 'rc_feed_fast', 'rc_feed_slow', 'rc_q',
    ],
    // Controller-source chips (PROBE-CONFIG-SOURCE.md)
    probeSrcFields: { rc_feed_fast: 'fastFeed', rc_retract: 'retract' },

    onOpen(ctx) {
        setTimeout(() => { ctx.update(); }, 50);
    },

    update(ctx) {
        const settings = window.ddcsGetSettings ? window.ddcsGetSettings() : { probes: {}, stock: {} };
        const method = el('rc_method')?.value || 'known';

        // Known diameter: if the REAL stock is ALREADY a cylinder (the operator configured it that way in
        // Settings → Stock), pull Ø straight from it — an honest read, not a forced one. t1722: this no longer
        // FORCES the stock into a cylinder on open to manufacture that match (see deriveCylinderStock above);
        // the preview below always shows round regardless (matching rotaryCenterData.js's own def.simStock,
        // unconditional), independent of what this diameter-pull reads.
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
        // t1722 — the round-bar preview stock, derived fresh each render (never mutating settings.stock — see
        // deriveCylinderStock above). Fed to BOTH the start-position math and preview3D's simStock override, the
        // SAME dual use rotaryCenterData.js's def.simStock gets via userOpView.js (stkNow → opSimStarts + preview3D).
        const simStock = deriveCylinderStock();
        // Per-pass start hints: the FIT method repositions twice → 3 starts (top + ±Y flanks) so the 3 probes hit
        // DISTINCT points and the circle solves; the KNOWN method is a single pass (one start).
        ctx.preview3D(gcode, 'rotaryCenterVizContainer', wizard.inferStart(params, simStock), wizard.inferStarts(params, simStock), simStock);
        applyPreviewIntent(ctx, 'rotaryCenterVizContainer', 'rotary_center');   // t714 — rig + envelope, single-sourced with the twin

        const status = el('rotaryCenterVizStatus');
        if (status) status.textContent = `Rotary centre: ${method} | Z0 ${params.datum} | ${params.wcs}`;
    },
};
