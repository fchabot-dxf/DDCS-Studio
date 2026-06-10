/** views/cornerView.js — Corner probing wizard view (DOM glue + SVG animator). */
import { el, UIUtils } from '../../ui/uiUtils.js';
import { CornerWizard } from '../cornerWizard.js';

const wizard = new CornerWizard();

export function startCornerAnim() {
    const animate = el('c_animate')?.checked !== false;
    const corner  = el('c_corner')?.value || 'FL';
    const seq     = el('c_probe_seq')?.value || 'YX';
    const zfirst  = el('c_probe_z_first')?.checked || false;

    // Stop any running animation
    if (window.__cornerAnimator) { try { window.__cornerAnimator.stop(); } catch (e) {} }
    // Clear any pending start timer
    if (window.__cornerAnimStartTimer) { clearTimeout(window.__cornerAnimStartTimer); window.__cornerAnimStartTimer = null; }

    if (!animate) return;

    // Create instance once, reuse it — play() handles stopping old loops via token
    if (!window.__cornerAnimator && window.CornerVizAnimator) {
        window.__cornerAnimator = new window.CornerVizAnimator();
    }
    if (window.__cornerAnimator) {
        window.__cornerAnimStartTimer = setTimeout(() => {
            window.__cornerAnimStartTimer = null;
            window.__cornerAnimator.play(corner, seq, zfirst);
        }, 80);
    }
}

export const cornerView = {
    type: 'corner',
    panelId: 'wiz_corner',
    codeElId: 'wiz_corner_code',
    large: true,
    inputIds: [
        'c_corner', 'c_probe_seq', 'c_probe_z_first', 'c_animate', 'c_sync_a', 'c_wcs',
        'c_travel_dist', 'c_safe_z', 'c_scan_depth', 'c_radius', 'c_feed_fast', 'c_feed_slow',
        'c_dist', 'c_retract', 'c_port', 'c_level', 'c_q', 'c_slave',
    ],
    startAnim: startCornerAnim,

    onOpen() {
        setTimeout(async () => {
            if (window.drawCornerViz) await window.drawCornerViz();
            startCornerAnim();
        }, 50);
    },

    update(ctx) {
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
            travelDist: el('c_travel_dist').value,
            scanDepth: el('c_scan_depth')?.value || '5',
            radius: el('c_radius')?.value || '2.0'
        };

        const gcode = wizard.generate(params);
        el('wiz_corner_code').innerHTML = UIUtils.formatGCode(gcode);
        // Infer the spindle start for this corner/config so the preview begins in the right spot.
        const stock = (window.ddcsGetSettings && window.ddcsGetSettings().stock) || {};
        ctx.preview3D(gcode, 'cornerVizContainer', wizard.inferStart(params, stock));

        // Update corner status label 📌
        const dirMap = { FL: 'X pos, Y pos', FR: 'X neg, Y pos', BL: 'X pos, Y neg', BR: 'X neg, Y neg' };
        const cornerStatus = el('cornerVizStatus');
        if (cornerStatus) cornerStatus.textContent = `Corner: ${params.corner} (${dirMap[params.corner]}) - ${params.probeSeq}` + (params.probeZ ? ' + Z' : '');

        // Update visualization and restart animator
        if (window.drawCornerViz) {
            window.drawCornerViz(params.probeZFirst);
        }
        startCornerAnim();
    },
};
