/** views/cornerView.js — Corner probing wizard view (DOM glue + FeatureCanvas). */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { CornerWizard } from '../cornerWizard.js';
import { restoreBoxStock } from './rotaryCenterView.js';
import { FeatureCanvas } from '../../viz/featureCanvas.js';

const wizard = new CornerWizard();
const layout = new FeatureCanvas();
const num = (val, d) => (val === '' || val == null || isNaN(Number(val))) ? d : Number(val);

function tieCornerTravel(starts) {
    const hasZ = el('c_probe_z_first')?.checked;
    const pZ = hasZ ? 0 : -1;
    const pW1 = hasZ ? 1 : 0;
    const pW2 = hasZ ? 2 : 1;

    let changed = false;
    // Z -> Wall 1
    if (hasZ && starts[pZ] && starts[pW1]) {
        const dx = Math.round(starts[pW1].x - starts[pZ].x), dy = Math.round(starts[pW1].y - starts[pZ].y);
        const fx = el('c_start_x'), fy = el('c_start_y');
        if (fx && fx.value !== String(dx)) { fx.value = String(dx); changed = true; }
        if (fy && fy.value !== String(dy)) { fy.value = String(dy); changed = true; }
        if (changed && fx) fx.dispatchEvent(new Event('input', { bubbles: true }));
    }
    // Wall 1 -> Wall 2
    changed = false;
    if (starts[pW1] && starts[pW2]) {
        const dx = Math.round(starts[pW2].x - starts[pW1].x), dy = Math.round(starts[pW2].y - starts[pW1].y);
        const fx = el('c_cross1_x'), fy = el('c_cross1_y');
        if (fx && fx.value !== String(dx)) { fx.value = String(dx); changed = true; }
        if (fy && fy.value !== String(dy)) { fy.value = String(dy); changed = true; }
        if (changed && fx) fx.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

function renderCornerStartCanvas(panel, params, stock) {
    const container = el('cornerLayoutCanvas');
    if (!container || !panel || typeof panel.getPassStarts !== 'function') return;
    const starts = panel.getPassStarts() || [];

    tieCornerTravel(starts);

    const hookInput = (id, passIndex) => {
        const input = el(id);
        if (input && !input._coHooked) {
            input._coHooked = true;
            input.addEventListener('input', (e) => {
                if (e.isTrusted && typeof panel.onStartDrag === 'function') panel.onStartDrag(null, passIndex);
            });
        }
    };
    const hasZ = el('c_probe_z_first')?.checked;
    hookInput('c_start_x', hasZ ? 1 : -1);
    hookInput('c_start_y', hasZ ? 1 : -1);
    hookInput('c_cross1_x', hasZ ? 2 : 1);
    hookInput('c_cross1_y', hasZ ? 2 : 1);

    const sw = num(stock && stock.x, 100), sh = num(stock && stock.y, 80);
    const items = [{ kind: 'rect', x: 0, y: 0, w: sw, h: sh, cls: 'fc-feature-boss' }];
    const handles = starts.map((s, p) => ({ id: 'start:' + p, x: +s.x || 0, y: +s.y || 0, kind: 'move', label: String(p + 1) }));
    
    const spec = {
        stock: (sw > 0 && sh > 0) ? { w: sw, h: sh, ox: 0, oy: 0 } : null,
        placement: { x: 0, y: 0 }, items, handles,
        onDrag: (id, world) => {
            const p = parseInt(String(id).split(':')[1], 10) || 0;
            const z = (starts[p] && starts[p].z) || 0;
            panel.onStartDrag({ x: world.x, y: world.y, z }, p);
            renderCornerStartCanvas(panel, params, (window.ddcsGetSettings && window.ddcsGetSettings().stock) || {});
        }
    };
    layout.render(container, spec);
}

export const cornerView = {
    type: 'corner',
    panelId: 'wiz_corner',
    codeElId: 'wiz_corner_code',
    large: true,
    twoPane: true,
    inputIds: [
        'c_corner', 'c_probe_seq', 'c_probe_z_first', 'c_sync_a', 'c_wcs',
        'c_start_x', 'c_start_y', 'c_cross1_x', 'c_cross1_y', 'c_safe_z', 'c_scan_depth', 'c_radius', 'c_feed_fast', 'c_feed_slow',
        'c_dist', 'c_retract', 'c_port', 'c_level', 'c_q', 'c_slave',
    ],
    probeSrcFields: { c_port: 'port', c_level: 'level', c_feed_fast: 'fastFeed', c_retract: 'retract' },
    
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
        restoreBoxStock();
        setTimeout(() => { ctx.update(); }, 50);
    },

    update(ctx) {
        ctx._activePanel = this;
        const params = {
            corner: el('c_corner').value,
            probeZ: el('c_probe_z_first')?.checked || false,
            probeZFirst: el('c_probe_z_first')?.checked || false,
            syncA: el('c_sync_a').checked,
            slave: el('c_slave')?.value || '3',
            probeSeq: el('c_probe_seq').value,
            wcs: el('c_wcs').value,
            dist: el('c_dist').value,
            retract: el('c_retract').value,
            f_fast: el('c_feed_fast').value,
            f_slow: el('c_feed_slow')?.value || '50',
            qStop: el('c_q')?.value || '1',
            port: window.ddcsGetSettings().probes.probePin,
            level: window.ddcsGetSettings().probes.probeLevel,
            safeZ: el('c_safe_z').value,
            scanDepth: el('c_scan_depth')?.value || '5',
            radius: el('c_radius')?.value || '2.0',
            startX: el('c_start_x')?.value,
            startY: el('c_start_y')?.value,
            cross1_x: el('c_cross1_x')?.value,
            cross1_y: el('c_cross1_y')?.value,
            sources: window.ddcsResolveProbeSources(['port', 'level', 'fastFeed', 'retract']),
        };
        this._lastParams = params;

        const gcode = wizard.generate(params);
        el('wiz_corner_code').innerHTML = UIUtils.formatGCode(gcode);
        
        const stock = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || {};
        const inferredStarts = wizard.inferStarts(params, stock);
        ctx.preview3D(gcode, 'cornerVizContainer', inferredStarts[0], inferredStarts);
        
        renderCornerStartCanvas(this, params, stock);

        const dirMap = { FL: 'X pos, Y pos', FR: 'X neg, Y pos', BL: 'X pos, Y neg', BR: 'X neg, Y neg' };
        const cornerStatus = el('cornerVizStatus');
        if (cornerStatus) cornerStatus.textContent = `Corner: ${params.corner} (${dirMap[params.corner]}) - ${params.probeSeq}` + (params.probeZ ? ' + Z' : '');
    },
};
