/** views/rotaryCenterView.js — Rotary centreline (4th-axis setup) wizard view. */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { safeZFrameValue } from '../../ui/safeZFrameToggle.js';
import { RotaryCenterWizard } from '../rotaryCenterWizard.js';
import { cylinderOf, rotaryAxisOf } from '../../engine/probeGeometry.js';
import { applySettings } from '../../ui/settingsPanel.js';
import { FeatureCanvas } from '../../viz/featureCanvas.js';

const wizard = new RotaryCenterWizard();
const layout = new FeatureCanvas();
const num = (val, d) => (val === '' || val == null || isNaN(Number(val))) ? d : Number(val);

let _savedBoxStock = null;

export function activateCylinderStock() {
    const get = window.ddcsGetSettings ? window.ddcsGetSettings() : {};
    const cur = get.stock || {};
    if (cur.shape === 'cylinder' && cur.show) return;
    _savedBoxStock = { ...cur };
    const axis = rotaryAxisOf(get.motors);
    const cross = axis === 'x' ? ['y', 'z'] : axis === 'y' ? ['x', 'z'] : ['x', 'y'];
    const dims = { x: cur.x || 150, y: cur.y || 76.2, z: cur.z || 76.2 };
    const D = Math.max(dims[cross[0]], dims[cross[1]]) || 76.2;
    dims[cross[0]] = D; dims[cross[1]] = D;
    applySettings({ stock: { datum: 'nnp', pin: 'origin', ...cur, ...dims, shape: 'cylinder', show: true } });
}

export function restoreBoxStock() {
    const get = window.ddcsGetSettings ? window.ddcsGetSettings() : {};
    const cur = get.stock || {};
    if (cur.shape !== 'cylinder') return;
    const box = _savedBoxStock || { ...cur };
    applySettings({ stock: { ...cur, ...box, shape: 'box' } });
    _savedBoxStock = null;
}

function renderRotaryCenterStartCanvas(panel, params, stock) {
    const container = el('rotaryCenterLayoutCanvas');
    if (!container || !panel || typeof panel.getPassStarts !== 'function') return;
    const starts = panel.getPassStarts() || [];

    const sw = num(stock && stock.x, 100), sh = num(stock && stock.y, 80);
    // Draw the cylinder cross-section (a circle)
    const items = [{ kind: 'circle', cx: sw / 2, cy: sh / 2, r: Math.min(sw, sh) * 0.4, cls: 'fc-feature-boss' }];
    const handles = starts.map((s, p) => ({ id: 'start:' + p, x: +s.x || 0, y: +s.y || 0, kind: 'move', label: String(p + 1) }));
    
    const spec = {
        stock: (sw > 0 && sh > 0) ? { w: sw, h: sh, ox: 0, oy: 0 } : null,
        placement: { x: 0, y: 0 }, items, handles,
        onDrag: (id, world) => {
            const p = parseInt(String(id).split(':')[1], 10) || 0;
            const z = (starts[p] && starts[p].z) || 0;
            panel.onStartDrag({ x: world.x, y: world.y, z }, p);
            renderRotaryCenterStartCanvas(panel, params, (window.ddcsGetSettings && window.ddcsGetSettings().stock) || {});
        }
    };
    layout.render(container, spec);
}

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
    probeSrcFields: { rc_feed_fast: 'fastFeed', rc_retract: 'retract' },

    onStartDrag(world, passIndex) {
        if (!this.userStarts) this.userStarts = [];
        this.userStarts[passIndex] = world ? { x: world.x, y: world.y, z: world.z } : null;
    },
    
    getPassStarts() {
        const params = this._lastParams || {};
        const stock = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || {};
        const inferred = wizard.inferStarts(params, stock) || [];
        const starts = [];
        for (let i = 0; i < inferred.length; i++) {
            starts[i] = (this.userStarts && this.userStarts[i]) ? this.userStarts[i] : inferred[i];
        }
        return starts;
    },

    onOpen(ctx) {
        activateCylinderStock();
        setTimeout(() => { ctx.update(); }, 50);
    },

    update(ctx) {
        ctx._activePanel = this;
        const settings = window.ddcsGetSettings ? window.ddcsGetSettings() : { probes: {}, stock: {} };
        const method = el('rc_method')?.value || 'known';

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
            safeZFrame: safeZFrameValue('rc_safe_z'),
            f_fast: el('rc_feed_fast')?.value || '200',
            f_slow: el('rc_feed_slow')?.value || '50',
            qStop: el('rc_q')?.value || '1',
            port: settings.probes.probePin,
            level: settings.probes.probeLevel,
            sources: window.ddcsResolveProbeSources(['port', 'level', 'fastFeed', 'retract']),
        };
        this._lastParams = params;

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
        
        const inferredStarts = wizard.inferStarts(params, stock);
        ctx.preview3D(gcode, 'rotaryCenterVizContainer', inferredStarts[0], inferredStarts);
        ctx.previewRotaryFixture('rotaryCenterVizContainer', true);
        
        renderRotaryCenterStartCanvas(this, params, stock);

        const status = el('rotaryCenterVizStatus');
        if (status) status.textContent = `Rotary centre: ${method} | Z0 ${params.datum} | ${params.wcs}`;
    },
};
