/** views/edgeView.js — Edge probing wizard view (DOM glue + SVG animator + the feature-canvas START-marker editor). */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { EdgeWizard } from '../edgeWizard.js';
import { applyPreviewIntent } from './atcViews.js';   // t1203 — the ONE declared-intent apply (built-in view + twin agree by construction)
import { restoreBoxStock } from './rotaryCenterView.js';
import { FeatureCanvas } from '../../viz/featureCanvas.js';
import { workpieceFeatureItems } from '../../engine/workpiece.js';

const wizard = new EdgeWizard();
const layout = new FeatureCanvas();
const num = (val, d) => (val === '' || val == null || isNaN(Number(val))) ? d : Number(val);

/** The START-marker feature-canvas (TRAVEL-START inc1): replaces the old probe-VECTOR/"reach" ARROW (the GUI element the
 *  human asked to drop) with a draggable ① START-POS marker. A drag writes ONLY the SIM start via panel.onStartDrag →
 *  userStarts[0] (the marker STICKS where dropped, beating the inferred hint, persists in-session) — exactly like middle's
 *  ②-aim. DECOUPLED from MAX PROBE: the start is where probing BEGINS; MAX PROBE (#1, the max search distance) stays a
 *  SEPARATE editable safety field the user types, untouched by the drag. (The incremental probe macro doesn't encode the
 *  start, so it's a sim-only hint — no emit effect, persisted via userStarts like every other wizard's start.) */
function renderEdgeStartCanvas(panel, params, stock) {
    const container = el('edgeLayoutCanvas');
    if (!container || !panel || typeof panel.getPassStarts !== 'function') return;
    const starts = panel.getPassStarts() || [];
    const s0 = starts[0] || { x: 0, y: 0, z: 0 };
    const sw = num(stock && stock.x, 100), sh = num(stock && stock.y, 80);
    const axis = params.axis === 'Y' ? 'Y' : 'X';
    const pos = (params.dir || 'pos') !== 'neg';
    const wx = axis === 'X' ? (pos ? 0 : sw) : (+s0.x || 0);   // the wall-contact: the start's axis coord projected onto the wall
    const wy = axis === 'Y' ? (pos ? 0 : sh) : (+s0.y || 0);
    const items = [{ kind: 'line', x1: +s0.x || 0, y1: +s0.y || 0, x2: wx, y2: wy }];   // start → the wall it probes
    const handles = [{ id: 'start:0', x: +s0.x || 0, y: +s0.y || 0, kind: 'move', label: '1' }];
    const spec = {
        stock: (sw > 0 && sh > 0) ? { w: sw, h: sh, ox: 0, oy: 0 } : null,
        placement: { x: 0, y: 0 }, items: [...workpieceFeatureItems(0, 0), ...items], handles,
        onDrag: (id, world) => {
            const z = (+s0.z) || 0;
            panel.onStartDrag({ x: world.x, y: world.y, z }, 0);   // SIM ONLY: the probe BEGINS here (userStarts[0], persists, beats the hint) — does NOT touch MAX PROBE
            renderEdgeStartCanvas(panel, params, (window.ddcsGetSettings && window.ddcsGetSettings().stock) || {});
        },
    };
    layout.render(container, spec);
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
        ctx.preview3D(gcode, 'probeVizContainer', wizard.inferStart(params, stock), wizard.inferStarts(params, stock));
        applyPreviewIntent(ctx, 'probeVizContainer', 'edge');   // t1203 — the ONE declared-intent apply (this view previously applied none, so a new flag would never reach the panel)
        // TRAVEL-START inc1: the START marker IS the source — render it on the feature canvas (the panel exists after
        // preview3D); dragging it derives the reach (#1). Replaces the old probe-vector/reach arrow.
        renderEdgeStartCanvas(ctx._activePanel, params, stock);
        console.debug('edge generate => containsG31=', /G31/.test(gcode));
        el('wiz_edge_code').innerHTML = UIUtils.formatGCode(gcode);

        // Update edge status label
        const edgeStatus = el('edgeVizStatus');
        if (edgeStatus) edgeStatus.textContent = `Edge: ${params.axis}${params.dir === 'pos' ? '+' : '-'}`;

    },
};
