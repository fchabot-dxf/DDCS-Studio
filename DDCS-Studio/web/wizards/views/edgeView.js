/** views/edgeView.js — Edge probing wizard view (DOM glue + SVG animator). */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { EdgeWizard } from '../edgeWizard.js';
import { restoreBoxStock } from './rotaryCenterView.js';

const wizard = new EdgeWizard();

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
        console.debug('edge generate => containsG31=', /G31/.test(gcode));
        el('wiz_edge_code').innerHTML = UIUtils.formatGCode(gcode);

        // Update edge status label
        const edgeStatus = el('edgeVizStatus');
        if (edgeStatus) edgeStatus.textContent = `Edge: ${params.axis}${params.dir === 'pos' ? '+' : '-'}`;

    },
};
