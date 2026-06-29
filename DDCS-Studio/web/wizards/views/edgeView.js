/** views/edgeView.js — Edge probing wizard view (DOM glue + SVG animator + the feature-canvas probe-vector editor). */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { EdgeWizard } from '../edgeWizard.js';
import { restoreBoxStock } from './rotaryCenterView.js';
import { FeatureCanvas } from '../../viz/featureCanvas.js';
import { buildCanvasWidgets } from '../../viz/canvasWidgets.js';

const wizard = new EdgeWizard();
const layout = new FeatureCanvas();
const num = (val, d) => (val === '' || val == null || isNaN(Number(val))) ? d : Number(val);
const r3 = (n) => Math.round(n * 1000) / 1000;

/** Write wizard fields (numbers rounded; ENUM strings — axis/dir — passed through), then fire ONE 'input' so the normal
 *  update() loop redraws. This is the canvas → form half of the two-way sync (the form → canvas half is update() itself). */
function setFields(map) {
    let first = null;
    for (const id in map) {
        const e = el(id);
        if (!e) continue;
        const val = map[id];
        e.value = (typeof val === 'number' && Number.isFinite(val)) ? String(r3(val)) : String(val);
        first = first || e;
    }
    if (first) first.dispatchEvent(new Event('input', { bubbles: true }));
}

/** The probe-VECTOR spec: ONE draggable arrow from the stock centre in the probe direction, its length = the reach. Drag
 *  it → axis/dir/dist (cardinal-snapped); the form fields STAY the one source — this handle is just another view of them. */
function buildEdgeSpec(params, stock) {
    const sw = num(stock && stock.x, 100), sh = num(stock && stock.y, 80);
    const cx = sw / 2, cy = sh / 2;                                   // anchor = the stock centre (the probe start)
    const axis = params.axis === 'Y' ? 'Y' : 'X';
    const dir = params.dir === 'neg' ? 'neg' : 'pos';
    const dist = Math.max(1, num(params.dist, 15));
    const decls = [{ type: 'probeVector', id: 'probe', cx, cy, axis, dir, dist, fieldAxis: 'p_axis', fieldDir: 'p_dir', field: 'p_dist', minR: 1, editMin: 1, label: 'reach', value: dist }];
    const { handles, onDrag, onEdit } = buildCanvasWidgets(decls, setFields);
    const ux = axis === 'Y' ? 0 : (dir === 'neg' ? -1 : 1);
    const uy = axis === 'Y' ? (dir === 'neg' ? -1 : 1) : 0;
    const items = [{ kind: 'line', x1: cx, y1: cy, x2: cx + ux * dist, y2: cy + uy * dist }];   // the arrow SHAFT (tip = the handle)
    return {
        stock: (sw > 0 && sh > 0) ? { w: sw, h: sh, ox: 0, oy: 0 } : null,
        placement: { x: 0, y: 0 }, items, handles, onDrag, onEdit,
    };
}

export function startEdgeAnim() {
    const animate = el('p_animate')?.checked !== false; // respect animate toggle in edge wizard
    const axis = el('p_axis')?.value || 'X';
    const dir = el('p_dir')?.value || 'pos';

    // Stop any running edge animator
    if (window.__edgeAnimator) { try { window.__edgeAnimator.stop(); } catch (e) {} }
    if (!window.__edgeAnimator && window.EdgeVizAnimator) {
        window.__edgeAnimator = new window.EdgeVizAnimator();
    }

    if (window.__edgeAnimator && animate) {
        if (window.__edgeAnimStartTimer) { clearTimeout(window.__edgeAnimStartTimer); window.__edgeAnimStartTimer = null; }
        window.__edgeAnimStartTimer = setTimeout(() => {
            window.__edgeAnimStartTimer = null;
            try { window.__edgeAnimator.play(axis, dir); } catch (e) { /* noop */ }
        }, 80);
    }
}

export const edgeView = {
    type: 'edge',
    panelId: 'wiz_edge',
    codeElId: 'wiz_edge_code',
    large: true,
    twoPane: true,
    inputIds: [
        'p_axis', 'p_dir', 'p_dist', 'p_radius', 'p_feed_fast', 'p_feed_slow',
        'p_retract', 'p_port', 'p_level', 'p_q', 'p_sync_a', 'p_wcs', 'p_slave',
    ],
    // Controller-source chips: which inputs map to which probe-config field (PROBE-CONFIG-SOURCE.md)
    probeSrcFields: { p_port: 'port', p_level: 'level', p_feed_fast: 'fastFeed', p_retract: 'retract' },
    startAnim: startEdgeAnim,

    onOpen(ctx) {
        restoreBoxStock();   // not a rotary op → revert a forced cylinder back to the box (no-op if already a box)
        setTimeout(() => {
            ctx.update();
            // start animator similar to corner animator
            setTimeout(() => { startEdgeAnim(); }, 60);
        }, 50);
    },

    update(ctx) {
        const params = {
            axis: el('p_axis')?.value || 'X',
            dir: el('p_dir')?.value || 'pos',
            wcs: el('p_wcs')?.value || 'active',
            dist: el('p_dist')?.value || '15',
            radius: el('p_radius')?.value || '2',
            retract: el('p_retract')?.value || '2',
            syncA: el('p_sync_a')?.checked || false,
            slave: el('p_slave')?.value || '3',
            f_fast: el('p_feed_fast')?.value || '200',
            f_slow: el('p_feed_slow')?.value || '50',
            qStop: el('p_q')?.value || '1',
            port: window.ddcsGetSettings().probes.probePin,
            level: window.ddcsGetSettings().probes.probeLevel,
            sources: window.ddcsResolveProbeSources(['port', 'level', 'fastFeed', 'retract']),
        };

        console.debug('edgeView.update', params);
        const gcode = wizard.generate(params);
        const stock = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || {};
        ctx.preview3D(gcode, 'probeVizContainer', wizard.inferStart(params, stock));
        // Feature-canvas probe-vector editor (form → canvas half of the sync: every field change re-renders the arrow).
        if (el('edgeLayoutCanvas')) layout.render(el('edgeLayoutCanvas'), buildEdgeSpec(params, stock));
        console.debug('edge generate => containsG31=', /G31/.test(gcode));
        el('wiz_edge_code').innerHTML = UIUtils.formatGCode(gcode);

        // Update edge status label
        const edgeStatus = el('edgeVizStatus');
        if (edgeStatus) edgeStatus.textContent = `Edge: ${params.axis}${params.dir === 'pos' ? '+' : '-'}`;

    },
};
