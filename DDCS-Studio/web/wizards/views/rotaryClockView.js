/** views/rotaryClockView.js — Rotary clock (A0 to a feature) wizard view. */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { safeZFrameValue } from '../../ui/safeZFrameToggle.js';
import { RotaryClockWizard } from '../rotaryClockWizard.js';
import { restoreBoxStock } from './rotaryCenterView.js';
import { FeatureCanvas } from '../../viz/featureCanvas.js';

const wizard = new RotaryClockWizard();
const layout = new FeatureCanvas();
const num = (val, d) => (val === '' || val == null || isNaN(Number(val))) ? d : Number(val);

function renderRotaryClockStartCanvas(panel, params, stock) {
    const container = el('rotaryClockLayoutCanvas');
    if (!container || !panel || typeof panel.getPassStarts !== 'function') return;
    const starts = panel.getPassStarts() || [];

    const sw = num(stock && stock.x, 100), sh = num(stock && stock.y, 80);
    const items = [{ kind: 'rect', x: 0, y: 0, w: sw, h: sh, cls: 'fc-feature-boss' }];
    
    // The rotary clock probes point A and point B spaced by `span` in Y.
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
            renderRotaryClockStartCanvas(panel, params, (window.ddcsGetSettings && window.ddcsGetSettings().stock) || {});
        }
    };
    layout.render(container, spec);
}

export const rotaryClockView = {
    type: 'rotary_clock',
    panelId: 'wiz_rotary_clock',
    codeElId: 'wiz_rotary_clock_code',
    large: true,
    twoPane: true,
    inputIds: [
        'rcl_action', 'rcl_reference', 'rcl_span', 'rcl_wcs',
        'rcl_dist', 'rcl_retract', 'rcl_safe_z', 'rcl_feed_fast', 'rcl_feed_slow', 'rcl_q',
    ],
    probeSrcFields: { rcl_feed_fast: 'fastFeed', rcl_retract: 'retract' },

    onStartDrag(world, passIndex) {
        if (!this.userStarts) this.userStarts = [];
        this.userStarts[passIndex] = world ? { x: world.x, y: world.y, z: world.z } : null;
        
        // Tie the span to the distance between point A and B.
        if (this.userStarts[0] && this.userStarts[1]) {
            const span = Math.abs(this.userStarts[1].y - this.userStarts[0].y);
            const spanEl = el('rcl_span');
            if (spanEl) spanEl.value = span.toFixed(2);
            this.update(this._ctx); // force re-render
        }
    },
    
    getPassStarts() {
        const params = this._lastParams || {};
        const stock = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || {};
        
        const ptA = wizard.inferStart(params, stock);
        const span = num(params.span, 20);
        // Rotary clock only explicitly returns one start point from inferStart; we manually create the second here.
        const inferred = [ ptA, { x: ptA.x, y: ptA.y + span, z: ptA.z } ];
        
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
        this._ctx = ctx;
        ctx._activePanel = this;
        const settings = window.ddcsGetSettings ? window.ddcsGetSettings() : { probes: {} };
        const action = el('rcl_action')?.value || 'set';
        const params = {
            action,
            reference: el('rcl_reference')?.value || 'top',
            span: el('rcl_span')?.value || '20',
            wcs: el('rcl_wcs')?.value || 'active',
            dist: el('rcl_dist')?.value || '30',
            retract: el('rcl_retract')?.value || '2',
            safeZ: el('rcl_safe_z')?.value || '10',
            safeZFrame: safeZFrameValue('rcl_safe_z'),
            f_fast: el('rcl_feed_fast')?.value || '200',
            f_slow: el('rcl_feed_slow')?.value || '50',
            qStop: el('rcl_q')?.value || '1',
            port: settings.probes.probePin,
            level: settings.probes.probeLevel,
            sources: window.ddcsResolveProbeSources(['port', 'level', 'fastFeed', 'retract']),
        };
        this._lastParams = params;

        const desc = el('rcl_desc');
        if (desc) {
            const actTxt = action === 'report'
                ? 'measures the flat’s tilt and reports it — it does NOT touch the A offset.'
                : action === 'rotate'
                    ? 'measures the tilt then <b>rotates the part</b> to the reference and zeros A there.'
                    : 'measures the tilt and sets the A work offset so the reference reads A0 — without rotating the part.';
            desc.innerHTML = `<b>Clock to a flat:</b> probe the flat at two points across it (span apart in Y); tilt = atan(ΔZ / span). This ${actTxt} No centreline needed. <b>Verify the A direction on your machine</b> — flip the span sign if it datums the wrong way.`;
        }

        const gcode = wizard.generate(params);
        el('wiz_rotary_clock_code').innerHTML = UIUtils.formatGCode(gcode);
        const stock = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || {};
        
        const ptA = wizard.inferStart(params, stock);
        const ptB = { x: ptA.x, y: ptA.y + num(params.span, 20), z: ptA.z };
        const inferredStarts = [ptA, ptB];
        
        ctx.preview3D(gcode, 'rotaryClockVizContainer', ptA, inferredStarts);
        ctx.previewRotaryFixture('rotaryClockVizContainer', true);
        
        renderRotaryClockStartCanvas(this, params, stock);

        const status = el('rotaryClockVizStatus');
        if (status) status.textContent = `Rotary clock: ${action} | ref ${params.reference} | ${params.wcs}`;
    },
};
