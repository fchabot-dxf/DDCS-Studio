/** views/alignmentView.js — Alignment wizard view (DOM glue + FeatureCanvas). */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { safeZFrameValue } from '../../ui/safeZFrameToggle.js';
import { AlignmentWizard } from '../alignmentWizard.js';
import { FeatureCanvas } from '../../viz/featureCanvas.js';

const wizard = new AlignmentWizard();
const layout = new FeatureCanvas();
const num = (val, d) => (val === '' || val == null || isNaN(Number(val))) ? d : Number(val);

function renderAlignmentStartCanvas(panel, params, stock) {
    const container = el('alignmentLayoutCanvas');
    if (!container || !panel || typeof panel.getPassStarts !== 'function') return;
    const starts = panel.getPassStarts() || [];

    const sw = num(stock && stock.x, 100), sh = num(stock && stock.y, 80);
    const items = [{ kind: 'rect', x: 0, y: 0, w: sw, h: sh, cls: 'fc-feature-boss' }];
    
    // Markers are just visual indicators of where the user intends to jog.
    // We label them A and B instead of 1 and 2 to match the Alignment nomenclature.
    const handles = starts.map((s, p) => ({ 
        id: 'start:' + p, 
        x: +s.x || 0, 
        y: +s.y || 0, 
        kind: 'move', 
        label: p === 0 ? 'A' : 'B' 
    }));
    
    const spec = {
        stock: (sw > 0 && sh > 0) ? { w: sw, h: sh, ox: 0, oy: 0 } : null,
        placement: { x: 0, y: 0 }, items, handles,
        onDrag: (id, world) => {
            const p = parseInt(String(id).split(':')[1], 10) || 0;
            const z = (starts[p] && starts[p].z) || 0;
            panel.onStartDrag({ x: world.x, y: world.y, z }, p);
            renderAlignmentStartCanvas(panel, params, (window.ddcsGetSettings && window.ddcsGetSettings().stock) || {});
        }
    };
    layout.render(container, spec);
}

export const alignmentView = {
    type: 'alignment',
    panelId: 'wiz_alignment',
    codeElId: 'wiz_alignment_code',
    large: true,
    twoPane: true,
    inputIds: [
        'al_check_axis', 'al_probe_dir',
        'al_tolerance', 'al_dist', 'al_retract', 'al_safe_z',
        'al_feed_fast', 'al_feed_slow', 'al_port', 'al_level', 'al_q',
    ],
    probeSrcFields: { al_port: 'port', al_level: 'level', al_feed_fast: 'fastFeed', al_retract: 'retract' },

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
        setTimeout(() => {
            ctx.update();
        }, 50);
    },

    update(ctx) {
        ctx._activePanel = this;
        const params = {
            checkAxis:  el('al_check_axis')?.value  || 'X',
            probeDir:   el('al_probe_dir')?.value    || 'pos',
            tolerance:  el('al_tolerance')?.value    || '0.2',
            dist:       el('al_dist')?.value         || '20',
            retract:    el('al_retract')?.value      || '2',
            safeZ:      el('al_safe_z')?.value       || '10',
            safeZFrame: safeZFrameValue('al_safe_z'),
            f_fast:     el('al_feed_fast')?.value    || '200',
            f_slow:     el('al_feed_slow')?.value    || '50',
            qStop:      el('al_q')?.value            || '1',
            port:       window.ddcsGetSettings().probes.probePin,
            level:      window.ddcsGetSettings().probes.probeLevel,
            sources:    window.ddcsResolveProbeSources(['port', 'level', 'fastFeed', 'retract']),
        };
        this._lastParams = params;

        const gcode = wizard.generate(params);
        el('wiz_alignment_code').innerHTML = UIUtils.formatGCode(gcode);
        
        const stock = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || {};
        const inferredStarts = wizard.inferStarts(params, stock);
        ctx.preview3D(gcode, 'alignmentVizContainer', inferredStarts[0], inferredStarts);

        renderAlignmentStartCanvas(this, params, stock);

        const probeAxis = params.checkAxis === 'X' ? 'Y' : 'X';
        const status = el('alignmentVizStatus');
        if (status) {
            status.textContent = `Alignment | Check: ${params.checkAxis} | Probe: ${probeAxis}`;
        }
    },
};
